import { createFileRoute } from "@tanstack/react-router";
import { autoSettleCasino } from "@/lib/casino-autosettle.server";

/** Called every few seconds by the scheduler; settles casino rounds from real results. */
export const Route = createFileRoute("/api/public/cron/casino-settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const allowed = [process.env["SUPABASE_PUBLISHABLE_KEY"], process.env["SUPABASE_ANON_KEY"]].filter(Boolean);
        if (!allowed.includes(key)) return new Response("Unauthorized", { status: 401 });
        const out = await autoSettleCasino(new URL(request.url).origin);
        return Response.json({ ok: true, ...out });
      },
    },
  },
});
