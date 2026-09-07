import { createFileRoute } from "@tanstack/react-router";
import { authenticateOperator, jsonError, productDenied, productOf } from "@/lib/operator-auth.server";

/**
 * Result feed for pass-through operators.
 *
 * Their platform holds the bets, so all they need from us is the settled
 * result of every round — poll this as often as once per second and settle
 * win/loss inside their own wallet.
 *
 * GET /api/public/v1/results?gameId=88.0023&since=2026-09-07T18:00:00Z&limit=50
 */
export const Route = createFileRoute("/api/public/v1/results")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);

        const url = new URL(request.url);
        const gameId = url.searchParams.get("gameId");
        const roundId = url.searchParams.get("roundId");
        const since = url.searchParams.get("since");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);

        if (gameId) {
          const denied = productDenied(auth, productOf(gameId));
          if (denied) return jsonError(denied);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("rounds")
          .select("game_id, round_id, status, result, settled_at, created_at")
          .order("settled_at", { ascending: false, nullsFirst: false })
          .limit(limit);

        if (gameId) q = q.eq("game_id", gameId);
        if (roundId) q = q.eq("round_id", roundId);
        if (since) q = q.gt("settled_at", since);

        const { data, error } = await q;
        if (error) {
          return Response.json(
            { status: "error", code: "query_failed", message: error.message },
            { status: 500 },
          );
        }

        return Response.json(
          {
            status: "ok",
            serverTime: new Date().toISOString(),
            count: data?.length ?? 0,
            results: (data ?? []).map((r) => ({
              gameId: r.game_id,
              roundId: r.round_id,
              status: r.status,
              result: r.result,
              settledAt: r.settled_at,
              createdAt: r.created_at,
            })),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
