import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateOperator, jsonError } from "@/lib/operator-auth.server";

const schema = z
  .object({
    gameId: z.string().min(1).max(80),
    roundId: z.string().min(1).max(120),
    winners: z.array(z.string().min(1).max(80)).default([]),
    void: z.boolean().default(false),
  })
  .refine((v) => v.void || v.winners.length > 0, {
    message: "winners is required unless void is true",
  });

/**
 * Operator-declared result. Settles every still-open bet of the calling
 * operator in that game/round: winners are credited, losers closed at 0,
 * a voided round is refunded. GET lists the operator's unsettled rounds.
 */
export const Route = createFileRoute("/api/public/v1/result")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows } = await supabaseAdmin
          .from("bets")
          .select("game_id, round_id, selection, stake, operator_user_id, created_at")
          .eq("operator_id", auth.operator.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(500);

        const map = new Map<string, { gameId: string; roundId: string; bets: number; staked: number }>();
        for (const b of rows ?? []) {
          const key = `${b.game_id}|${b.round_id}`;
          const g =
            map.get(key) ??
            map.set(key, { gameId: b.game_id, roundId: b.round_id, bets: 0, staked: 0 }).get(key)!;
          g.bets += 1;
          g.staked += Number(b.stake ?? 0);
        }
        return Response.json({ status: "ok", pending: [...map.values()] });
      },
      POST: async ({ request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            {
              status: "error",
              code: "bad_request",
              message: "gameId, roundId and winners[] (or void:true) are required",
            },
            { status: 400 },
          );
        }

        const { settleOperatorRound } = await import("@/lib/operator-settle.server");
        const res = await settleOperatorRound({
          operatorId: auth.operator.id,
          gameId: parsed.data.gameId,
          roundId: parsed.data.roundId,
          winners: parsed.data.winners,
          voidRound: parsed.data.void,
        });
        return Response.json({ status: "ok", ...res });
      },
    },
  },
});
