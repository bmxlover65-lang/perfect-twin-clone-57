/**
 * Settles open operator casino bets from the live round results, so partner
 * sites never need a page refresh (or a manual result call) to pay out.
 */
import { settleOperatorRound } from "./operator-settle.server";

type ResultRow = {
  roundId: string;
  results?: { runners?: { selectionId: string; result?: string }[] | Record<string, string>; runnersName?: Record<string, string> }[];
};

function winnersOf(row: ResultRow): string[] {
  const out: string[] = [];
  for (const m of row.results ?? []) {
    const names = m.runnersName ?? {};
    const list = Array.isArray(m.runners)
      ? m.runners.map((r) => [r.selectionId, r.result ?? ""] as const)
      : Object.entries(m.runners ?? {});
    for (const [id, res] of list) {
      if (/WIN/i.test(String(res)) && names[id]) out.push(names[id]!);
    }
  }
  return out;
}

export async function autoSettleCasino(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: bets } = await supabaseAdmin
    .from("bets")
    .select("operator_id, game_id, round_id, created_at")
    .eq("status", "open")
    .limit(1000);

  const groups = new Map<string, { operatorId: string; gameId: string; roundId: string; at: number }>();
  for (const b of bets ?? []) {
    if (!/^\d+\.\d/.test(b.game_id)) continue;
    const k = `${b.operator_id}|${b.game_id}|${b.round_id}`;
    const at = new Date(b.created_at).getTime();
    const g = groups.get(k);
    if (!g || at < g.at) groups.set(k, { operatorId: b.operator_id, gameId: b.game_id, roundId: b.round_id, at });
  }

  const byGame = new Map<string, ResultRow[]>();
  let settled = 0;
  for (const g of groups.values()) {
    if (!byGame.has(g.gameId)) {
      const res = await fetch(`${origin}/api/public/uapi/games/${encodeURIComponent(g.gameId)}/results?_=${Date.now()}`, {
        cache: "no-store",
      }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { data?: ResultRow[] } | null;
      byGame.set(g.gameId, json?.data ?? []);
    }
    const row = byGame.get(g.gameId)!.find((r) => String(r.roundId) === String(g.roundId));
    try {
      if (row) {
        const winners = winnersOf(row);
        await settleOperatorRound({ ...g, winners, voidRound: winners.length === 0 });
        settled++;
      } else if (Date.now() - g.at > 30 * 60_000) {
        // Round never produced a result in 30 min — refund.
        await settleOperatorRound({ ...g, winners: [], voidRound: true });
        settled++;
      }
    } catch {
      /* try again next tick */
    }
  }
  return { casinoRounds: settled };
}
