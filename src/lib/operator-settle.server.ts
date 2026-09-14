import type { Operator } from "./operator-auth.server";

export type SettleOutcome = "won" | "lost" | "void";

type BetRow = {
  id: string;
  operator_user_id: string;
  selection: string;
  odds: number | string;
  stake: number | string;
  reference: string | null;
  game_id: string;
  round_id: string;
  status: string;
};

async function loadOperator(operatorId: string): Promise<Operator | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("operators")
    .select("id, name, currency, callback_url, callback_secret, status, plan_expires_at")
    .eq("id", operatorId)
    .maybeSingle();
  return (data as Operator) ?? null;
}

/** Pays one bet out on the operator's own wallet and closes it. */
async function closeBet(operator: Operator, bet: BetRow, outcome: SettleOutcome, multiplier?: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { walletCall } = await import("./callback-wallet.server");

  const odds = multiplier ?? Number(bet.odds);
  const payout =
    outcome === "won"
      ? Math.round(Number(bet.stake) * odds)
      : outcome === "void"
        ? Math.round(Number(bet.stake))
        : 0;

  let balance: number | null = null;
  let paid = true;
  if (payout > 0) {
    const reference = `${bet.reference ?? bet.id}-${outcome}`;
    const res = await walletCall(operator, outcome === "void" ? "rollback" : "credit", {
      userId: bet.operator_user_id,
      amount: payout,
      reference,
      gameId: bet.game_id,
      roundId: bet.round_id,
      betId: bet.id,
    });
    paid = res.ok;
    balance = res.ok ? res.balance : null;

    await supabaseAdmin.from("transactions").insert({
      operator_id: operator.id,
      bet_id: bet.id,
      operator_user_id: bet.operator_user_id,
      kind: outcome === "void" ? "rollback" : "credit",
      amount: payout,
      balance_after: balance,
      status: res.ok ? "done" : "failed",
      reference,
    });
  }

  await supabaseAdmin
    .from("bets")
    .update({
      status: outcome,
      payout,
      ...(outcome === "won" && multiplier ? { odds: multiplier } : {}),
      settled_at: new Date().toISOString(),
    })
    .eq("id", bet.id);

  return { betId: bet.id, userId: bet.operator_user_id, outcome, payout, paid, balance };
}

/**
 * Operator-declared result for one round: every still-open bet of THIS
 * operator in that game/round is settled against the given winners
 * (or refunded when the round is voided).
 */
export async function settleOperatorRound(input: {
  operatorId: string;
  gameId: string;
  roundId: string;
  winners: string[];
  voidRound?: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const operator = await loadOperator(input.operatorId);
  if (!operator) throw new Error("Operator not found");

  const { data: bets } = await supabaseAdmin
    .from("bets")
    .select("id, operator_user_id, selection, odds, stake, reference, game_id, round_id, status")
    .eq("operator_id", input.operatorId)
    .eq("game_id", input.gameId)
    .eq("round_id", input.roundId)
    .eq("status", "open");

  const winners = input.winners.map((w) => w.trim().toLowerCase()).filter(Boolean);
  const results = [];
  for (const bet of (bets ?? []) as BetRow[]) {
    const outcome: SettleOutcome = input.voidRound
      ? "void"
      : winners.includes(String(bet.selection).trim().toLowerCase())
        ? "won"
        : "lost";
    results.push(await closeBet(operator, bet, outcome));
  }

  return {
    ok: true,
    gameId: input.gameId,
    roundId: input.roundId,
    settled: results.length,
    won: results.filter((r) => r.outcome === "won").length,
    lost: results.filter((r) => r.outcome === "lost").length,
    voided: results.filter((r) => r.outcome === "void").length,
    paidOut: results.reduce((s, r) => s + r.payout, 0),
    failedPayouts: results.filter((r) => r.payout > 0 && !r.paid).length,
    bets: results,
  };
}

/** Operator-declared result for a single open bet. */
export async function settleOperatorBet(input: {
  operatorId: string;
  betId?: string;
  reference?: string;
  outcome: SettleOutcome;
  multiplier?: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const operator = await loadOperator(input.operatorId);
  if (!operator) throw new Error("Operator not found");

  let q = supabaseAdmin
    .from("bets")
    .select("id, operator_user_id, selection, odds, stake, reference, game_id, round_id, status")
    .eq("operator_id", input.operatorId);
  q = input.betId ? q.eq("id", input.betId) : q.eq("reference", input.reference ?? "");

  const { data: bet } = await q.maybeSingle();
  if (!bet) throw new Error("Bet not found");
  if ((bet as BetRow).status !== "open") return { ok: true, duplicate: true, payout: 0 };

  const r = await closeBet(operator, bet as BetRow, input.outcome, input.multiplier);
  return { ok: true, ...r };
}
