import { createFileRoute } from "@tanstack/react-router";
import { authenticateOperator, jsonError, productDenied } from "@/lib/operator-auth.server";
import { proxy } from "@/routes/api/public/uapi.$";

/**
 * B2B sports endpoints (all require an API key with the `sports` product):
 *
 *   GET  /api/public/v1/sports/events?sportId=4
 *   GET  /api/public/v1/sports/:sportId/events
 *   GET  /api/public/v1/sports/:sportId/:exEventId/odds
 *   GET  /api/public/v1/sports/:sportId/:exEventId/state
 *   GET|POST /api/public/v1/sports/:sportId/:exEventId/tv/embed
 *   GET|POST /api/public/v1/sports/:sportId/:exEventId/score/embed
 *   GET  /api/public/v1/sports/tv?sportId=&eventId=
 *   GET  /api/public/v1/sports/scoreboard?sportId=&eventId=
 */

function notFound(path: string) {
  return Response.json(
    { status: "error", code: "unknown_endpoint", message: `Unknown sports endpoint: ${path}` },
    { status: 404 },
  );
}

function embedPayload(origin: string, sportId: string, eventId: string, kind: "tv" | "score") {
  const page = kind === "tv" ? "player" : "scoreboard";
  const q = `sportId=${encodeURIComponent(sportId)}&exEventId=${encodeURIComponent(eventId)}&tv=true`;
  return {
    status: "ok",
    sportId,
    exEventId: eventId,
    iframePath: `/api/public/uapi/tv/sports/${page}?${q}`,
    iframeUrl: `${origin}/api/public/uapi/tv/sports/${page}?${q}`,
    expiresInSec: 1800,
  };
}

const handler = async ({ request, params }: { request: Request; params: unknown }) => {
  const auth = await authenticateOperator(request);
  if (!auth.ok) return jsonError(auth);
  const denied = productDenied(auth, "sports");
  if (denied) return jsonError(denied);

  const url = new URL(request.url);
  const origin = url.origin;
  const path = ((params as { _splat?: string })._splat ?? "").replace(/^\/+|\/+$/g, "");
  const qs = url.searchParams;

  const pass = async (upstreamPath: string, search: string) => {
    const res = await proxy(upstreamPath, search, undefined, "");
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  };

  // /events?sportId=4
  if (path === "events") {
    const sportId = qs.get("sportId") ?? "4";
    const inPlay = qs.get("inPlay");
    const search = inPlay ? `?inPlay=${inPlay === "true" || inPlay === "1" ? "1" : "0"}` : "";
    return pass(`sports/${encodeURIComponent(sportId)}/events`, search);
  }

  // /tv?sportId=&eventId=  |  /scoreboard?sportId=&eventId=
  if (path === "tv" || path === "scoreboard") {
    const sportId = qs.get("sportId") ?? "4";
    const eventId = qs.get("eventId") ?? qs.get("exEventId") ?? "";
    if (!eventId) {
      return Response.json(
        { status: "error", code: "missing_event", message: "eventId is required" },
        { status: 400 },
      );
    }
    return Response.json(embedPayload(origin, sportId, eventId, path === "tv" ? "tv" : "score"));
  }

  const seg = path.split("/");

  // /:sportId/events
  if (seg.length === 2 && seg[1] === "events") {
    return pass(`sports/${encodeURIComponent(seg[0]!)}/events`, url.search);
  }

  // /:sportId/:exEventId/(odds|state|score)
  if (seg.length === 3 && seg[0] && seg[1]) {
    const sportId = encodeURIComponent(seg[0]);
    const eventId = encodeURIComponent(seg[1]);
    if (seg[2] === "odds" || seg[2] === "state") {
      return pass(`sports/${sportId}/${eventId}/odds`, "");
    }
    if (seg[2] === "score") {
      return Response.json(embedPayload(origin, seg[0], seg[1], "score"));
    }
    if (seg[2] === "launch") {
      return Response.json({
        status: "ok",
        launchUrl: `${origin}/sports/${sportId}/${eventId}?embed=1`,
      });
    }
  }

  // /:sportId/:exEventId/tv/embed  |  /:sportId/:exEventId/score/embed
  if (seg.length === 4 && seg[3] === "embed" && (seg[2] === "tv" || seg[2] === "score")) {
    return Response.json(embedPayload(origin, seg[0]!, seg[1]!, seg[2] === "tv" ? "tv" : "score"));
  }

  return notFound(path);
};

export const Route = createFileRoute("/api/public/v1/sports/$")({
  server: { handlers: { GET: handler, POST: handler } },
});
