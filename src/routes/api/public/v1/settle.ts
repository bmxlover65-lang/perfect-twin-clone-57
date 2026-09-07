import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateOperator, jsonError } from "@/lib/operator-auth.server";
import { walletCall } from "@/lib/callback-wallet.server";

const schema = z.object({
  userId: z.string().min(1).max(120),
  reference: z.string().min(1).max(120),
  outcome: z.enum(["won", "lost", "void"]),
  multiplier: z.number().min(0).max(10_000).optional(),
});

/**
 * Settle a table-game bet: credit the operator wallet on a win, refund on a
 * void, and just close the bet on a loss (stake already debited at bet time).
 */
export const Route = createFileRoute("/api/public/v1/settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { status: "error", code: "bad_request", message: "userId, reference and outcome are required" },
            { status: 400 },
          );
        }
        const { userId, reference, outcome } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bet } = await supabaseAdmin
          .from("bets")
          .select("id, stake, odds, status, operator_user_id, game_id, round_id")
          .eq("operator_id", auth.operator.id)
          .eq("reference", reference)
          .maybeSingle();

        if (!bet || bet.operator_user_id !== userId) {
          return Response.json({ status: "error", code: "not_found", message: "Bet not found" }, { status: 404 });
        }
        if (bet.status !== "open") {
          return Response.json({ status: "ok", duplicate: true, payout: 0 });
        }

        const multiplier = parsed.data.multiplier ?? Number(bet.odds);
        const payout =
          outcome === "won"
            ? Math.round(Number(bet.stake) * multiplier)
            : outcome === "void"
              ? Math.round(Number(bet.stake))
              : 0;

        let balance: number | null = null;
        if (payout > 0) {
          const credit = await walletCall(auth.operator, "credit", {
            userId,
            amount: payout,
            reference: `${reference}-${outcome}`,
            gameId: bet.game_id,
            roundId: bet.round_id,
            betId: bet.id,
          });
          if (!credit.ok) {
            return Response.json(
              { status: "error", code: credit.code, message: credit.message },
              { status: credit.status },
            );
          }
          balance = credit.balance;
        }

        await supabaseAdmin
          .from("bets")
          .update({
            status: outcome,
            payout,
            ...(outcome === "won" ? { odds: multiplier } : {}),
            settled_at: new Date().toISOString(),
          })
          .eq("id", bet.id);

        if (payout > 0) {
          await supabaseAdmin.from("transactions").insert({
            operator_id: auth.operator.id,
            bet_id: bet.id,
            operator_user_id: userId,
            kind: outcome === "void" ? "rollback" : "credit",
            amount: payout,
            balance_after: balance,
            status: "done",
            reference: `${reference}-${outcome}`,
          });
        }

        return Response.json({ status: "ok", payout, balance });
      },
    },
  },
});
