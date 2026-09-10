import { createFileRoute } from "@tanstack/react-router";
import { authenticateOperator, jsonError, productDenied, productOf } from "@/lib/operator-auth.server";

export const Route = createFileRoute("/api/public/v1/bets")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      __tmp: async ({ request }: { request: Request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);

        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const gameId = url.searchParams.get("gameId");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("bets")
          .select(
            "id, operator_user_id, game_id, round_id, market, selection, odds, stake, payout, status, reference, created_at, settled_at",
          )
          .eq("operator_id", auth.operator.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (gameId) {
          const denied = productDenied(auth, productOf(gameId));
          if (denied) return jsonError(denied);
        }
        if (userId) q = q.eq("operator_user_id", userId);
        if (gameId) q = q.eq("game_id", gameId);

        const { data, error } = await q;
        if (error) {
          return Response.json({ status: "error", code: "query_failed", message: error.message }, { status: 500 });
        }
        return Response.json({ status: "ok", count: data?.length ?? 0, bets: data ?? [] });
      },
    },
  },
});
