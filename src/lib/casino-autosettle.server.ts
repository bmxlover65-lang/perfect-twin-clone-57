/**
 * Settles open operator casino bets from the live round results, so partner
 * sites never need a page refresh (or a manual result call) to pay out.
 */
import { repairUnpaidBets, settleOperatorBet } from "./operator-settle.server";

type ResultRow = {
  roundId: string;
  results?: { marketName?: string; runners?: { selectionId: string; result?: string }[] | Record<string, string>; runnersName?: Record<string, string> }[];
};

const normal = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

function outcomeFor(row: ResultRow, selection: string, market: string | null): boolean | null {
  const side = /\s+(lay|no)$/i.test(selection) ? "lay" : "back";
  const runner = selection.replace(/\s+(back|lay|yes|no)$/i, "").trim();
  const outcomes: boolean[] = [];
  for (const m of row.results ?? []) {
    if (market && normal(m.marketName ?? "") !== normal(market)) continue;
    const names = m.runnersName ?? {};
    const list = Array.isArray(m.runners)
      ? m.runners.map((r) => [r.selectionId, r.result ?? ""] as const)
      : Object.entries(m.runners ?? {});
    for (const [id, res] of list) {
      if (normal(names[id] ?? "") !== normal(runner)) continue;
      if (/^WINNER$/i.test(String(res))) outcomes.push(side === "back");
      if (/^LOSER$/i.test(String(res))) outcomes.push(side === "lay");
    }
  }
  // Identically named runners in different markets can disagree. Without a
  // market identifier do not guess a payout; refund unresolved bets later.
  return outcomes.length && outcomes.every((value) => value === outcomes[0]) ? outcomes[0] ?? null : null;
}

export async function autoSettleCasino(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await repairUnpaidBets().catch(() => 0);
  const { data: bets } = await supabaseAdmin
    .from("bets")
    .select("id, operator_id, game_id, round_id, market, selection, created_at")
    .eq("status", "open")
    .limit(1000);

  type OpenBet = NonNullable<typeof bets>[number];
  const groups = new Map<string, { operatorId: string; gameId: string; roundId: string; bets: OpenBet[] }>();
  for (const b of bets ?? []) {
    if (!/^\d+\.\d/.test(b.game_id)) continue;
    const k = `${b.operator_id}|${b.game_id}|${b.round_id}`;
    const g = groups.get(k);
    if (g) {
      g.bets.push(b);
    } else groups.set(k, { operatorId: b.operator_id, gameId: b.game_id, roundId: b.round_id, bets: [b] });
  }

  const byGame = new Map<string, ResultRow[]>();
  let settled = 0;
  for (const g of groups.values()) {
    if (!byGame.has(g.gameId)) {
      const res = await fetch(`${origin}/api/public/uapi/games/${encodeURIComponent(g.gameId)}/results?_=${Date.now()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { data?: ResultRow[] } | null;
      byGame.set(g.gameId, Array.isArray(json?.data) ? json.data : []);
    }
    const row = byGame.get(g.gameId)?.find((r) => String(r.roundId) === String(g.roundId));
    for (const bet of g.bets) {
      const outcome = row ? outcomeFor(row, bet.selection, bet.market) : null;
      const voided = outcome === null && Date.now() - new Date(bet.created_at).getTime() > 30 * 60_000;
      if (outcome === null && !voided) continue;
      try {
        await settleOperatorBet({ operatorId: g.operatorId, betId: bet.id, outcome: voided ? "void" : outcome ? "won" : "lost" });
        settled++;
      } catch {
        /* try again next tick */
      }
    }
  }
  return { casinoRounds: settled };
}
