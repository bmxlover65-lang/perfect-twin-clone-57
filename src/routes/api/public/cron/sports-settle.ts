import { createFileRoute } from "@tanstack/react-router";
import { autoSettleSports } from "@/lib/sports-autosettle.server";

/** Called every minute by the scheduler. Only settles from real feed/score data. */
export const Route = createFileRoute("/api/public/cron/sports-settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const allowed = [process.env["SUPABASE_PUBLISHABLE_KEY"], process.env["SUPABASE_ANON_KEY"]].filter(Boolean);
        if (!allowed.includes(key)) return new Response("Unauthorized", { status: 401 });
        const origin = new URL(request.url).origin;
        const out = await autoSettleSports(origin);
        const { autoSettleCasino } = await import("@/lib/casino-autosettle.server");
        const casino = await autoSettleCasino(origin).catch(() => ({ casinoRounds: 0 }));
        return Response.json({ ok: true, ...out, ...casino });
      },
    },
  },
});
