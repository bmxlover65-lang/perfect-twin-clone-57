import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const Frame = z.object({
  sportId: z.string().min(1).max(20),
  eventId: z.string().min(1).max(40),
  eventName: z.string().max(300).default(""),
  runnersData: z.record(z.string(), z.string()).nullable().default(null),
  odds: z.record(z.string(), z.unknown()),
});
const Body = z.object({ frames: z.array(Frame).min(1).max(100) });

function authorized(request: Request) {
  const secret = process.env["RELAY_SECRET"];
  const got = request.headers.get("x-relay-secret") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

export const Route = createFileRoute("/api/public/relay/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { buildAuraOdds } = await import("@/lib/aura.server");
        const { putRelayFrame } = await import("@/lib/ori.server");
        let stored = 0;
        await Promise.all(
          parsed.data.frames.map(async (f) => {
            const odds = buildAuraOdds(f.odds, { exEventId: f.eventId, sportId: f.sportId, eventName: f.eventName }, f.runnersData);
            if (!odds.matchOdds.length && !odds.bookmakers.length && !odds.fancy.length && !odds.sportsbook.length) return;
            if (await putRelayFrame(f.sportId, f.eventId, odds as never)) stored++;
          }),
        );
        return Response.json({ ok: true, stored });
      },
    },
  },
});
