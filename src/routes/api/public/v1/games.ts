import { createFileRoute } from "@tanstack/react-router";
import { authenticateOperator, jsonError, productDenied } from "@/lib/operator-auth.server";
import { GAMES } from "@/data/games";

/** Full casino game list: ids, markets, selections, odds and launch URLs. */
export const Route = createFileRoute("/api/public/v1/games")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      __tmp: async ({ request }: { request: Request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);
        const denied = productDenied(auth, "casino");
        if (denied) return jsonError(denied);

        const origin = new URL(request.url).origin;
        const games = GAMES.map((g) => ({
          gameId: g.id,
          name: g.name,
          type: g.kind,
          product: "casino",
          markets: g.markets.map((m) => ({
            market: m.title,
            min: m.min,
            max: m.max,
            selections: m.runners.map((r, i) => ({ selection: r, odds: m.odds[i] ?? null })),
          })),
          launchUrl: `${origin}/games/${g.id}?embed=1&apiKey=YOUR_KEY&userId=PLAYER_ID`,
          image: g.image ?? null,
        }));

        return Response.json({ status: "ok", count: games.length, games });
      },
    },
  },
});
