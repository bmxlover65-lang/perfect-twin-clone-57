import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateOperator, jsonError } from "@/lib/operator-auth.server";
import { walletCall } from "@/lib/callback-wallet.server";

const schema = z.object({
  userId: z.string().min(1).max(120),
  reference: z.string().min(1).max(120),
  multiplier: z.number().min(1).max(10_000),
});

export const Route = createFileRoute("/api/public/v1/cashout")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { status: "error", code: "method_not_allowed", message: "Use POST with a JSON body" },
          { status: 405 },
        ),
      POST: async ({ request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            {
              status: "error",
              code: "bad_request",
              message: "userId, reference and multiplier are required",
            },
            { status: 400 },
          );
        }
        const { userId, reference, multiplier } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bet } = await supabaseAdmin
          .from("bets")
          .select("id, stake, status, operator_user_id, game_id, round_id")
          .eq("operator_id", auth.operator.id)
          .eq("reference", reference)
          .maybeSingle();

        if (!bet || bet.operator_user_id !== userId) {
          return Response.json(
            { status: "error", code: "not_found", message: "Bet not found" },
            { status: 404 },
          );
        }
        if (bet.status !== "open") {
          return Response.json(
            { status: "error", code: "already_settled", message: "Bet is already settled" },
            { status: 409 },
          );
        }

        // Cashout multiplier must be backed by the recorded crash round.
        const { data: cr } = await supabaseAdmin
          .from("balloon_rounds")
          .select("crash")
          .eq("round_id", String(bet.round_id))
          .maybeSingle();
        if (!cr || (cr.crash !== null && multiplier > Number(cr.crash))) {
          return Response.json(
            { status: "error", code: "invalid_multiplier", message: "Multiplier not valid for this round" },
            { status: 409 },
          );
        }
        const payout = Math.round(Number(bet.stake) * multiplier);
        const credit = await walletCall(auth.operator, "credit", {
          userId,
          amount: payout,
          reference: `${reference}-win`,
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

        await supabaseAdmin
          .from("bets")
          .update({ status: "won", payout, odds: multiplier, settled_at: new Date().toISOString() })
          .eq("id", bet.id);

        await supabaseAdmin.from("transactions").insert({
          operator_id: auth.operator.id,
          bet_id: bet.id,
          operator_user_id: userId,
          kind: "credit",
          amount: payout,
          balance_after: credit.balance,
          status: "done",
          reference: `${reference}-win`,
        });

        return Response.json({ status: "ok", payout, balance: credit.balance });
      },
    },
  },
});
