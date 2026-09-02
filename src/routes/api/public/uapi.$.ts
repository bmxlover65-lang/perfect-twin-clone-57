import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://universeapi.shop/public";

let cachedToken: string | null = null;
let cachedAt = 0;

function apiKey(): string | undefined {
  return process.env["UAPI_KEY"] || undefined;
}

function authHeaders(): Record<string, string> {
  const key = apiKey();
  return key ? { "X-API-Key": key, "x-api-key": key } : {};
}

async function mintToken(): Promise<string> {
  const res = await fetch(`${UPSTREAM}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: "{}",
  });
  const json = (await res.json().catch(() => ({}))) as { sessionToken?: string; error?: string };
  if (!res.ok || !json.sessionToken) {
    throw new Error(json.error ?? `Failed to create session (${res.status})`);
  }
  cachedToken = json.sessionToken;
  cachedAt = Date.now();
  return json.sessionToken;
}

async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() - cachedAt < 30 * 60 * 1000) return cachedToken;
  return mintToken();
}

async function upstream(path: string, search: string, token: string, body?: string) {
  return fetch(`${UPSTREAM}/${path}${search}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-session-token": token,
      accept: "application/json",
      ...authHeaders(),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body }),
  });
}

// The stream provider only allows its own client hostname. Fetch the player
// page server-side with that referer and re-serve it from our origin.
const STREAM_REFERER = "https://universeapi.shop/";

async function streamPage(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response("Bad stream url", { status: 400 });
  }
  if (!/(^|\.)diamondtech\.shop$/i.test(target.hostname)) {
    return new Response("Stream host not allowed", { status: 403 });
  }
  const res = await fetch(target.toString(), {
    redirect: "follow",
    headers: {
      referer: STREAM_REFERER,
      origin: STREAM_REFERER.replace(/\/$/, ""),
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,*/*",
    },
  });
  const html = await res.text();
  return new Response(html, {
    status: res.status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function rewriteTvHtml(html: string, origin: string) {
  return html.replace(/https:\/\/[a-z0-9.-]*diamondtech\.shop\/[^"'\s]+/gi, (m) => {
    const clean = m.replace(/&amp;/g, "&");
    return `${origin}/api/public/uapi/stream?u=${encodeURIComponent(clean)}`;
  });
}


// Secondary results mirror: used when the primary feed returns 5xx/empty
// for a casino event (e.g. BALLOON 88.0023).
const MIRROR_RESULTS =
  "https://vimaan.ludoexchange.com/casinoapp/users/casino/casinoEventResults";

const mirrorCache = new Map<string, { at: number; data: unknown[] }>();

async function mirrorResults(eventId: string): Promise<unknown[]> {
  const hit = mirrorCache.get(eventId);
  if (hit && Date.now() - hit.at < 5000) return hit.data;
  try {
    const res = await fetch(MIRROR_RESULTS, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ eventId }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: unknown[] };
    const data = Array.isArray(json.data) ? json.data : [];
    mirrorCache.set(eventId, { at: Date.now(), data });
    return data;
  } catch {
    return hit?.data ?? [];
  }
}


async function proxy(splat: string, search: string, body?: string, origin = "") {
  try {
    if (splat === "stream") {
      const u = new URLSearchParams(search).get("u") ?? "";
      return streamPage(u);
    }

    if (splat === "health") {
      const t0 = Date.now();
      let ok = true;
      let message = "";
      try {
        await getToken(true);
      } catch (e) {
        ok = false;
        message = e instanceof Error ? e.message : "session failed";
      }
      return Response.json({
        ok,
        keyConfigured: Boolean(apiKey()),
        authMode: apiKey() ? "b2b-api-key" : "public-session",
        latencyMs: Date.now() - t0,
        upstream: UPSTREAM,
        checkedAt: new Date().toISOString(),
        error: message || undefined,
      });
    }
    if (splat === "session") {
      const token = await getToken();
      return Response.json({ sessionToken: token });
    }

    let token = await getToken();
    let res = await upstream(splat, search, token, body);
    if (res.status === 401 || res.status === 403) {
      token = await getToken(true);
      res = await upstream(splat, search, token, body);
    }
    const text = await res.text();
    const resultsMatch = /^games\/([^/]+)\/results$/.exec(splat);
    // Upstream currently 502s on some casino endpoints (e.g. /results).
    // Degrade gracefully instead of surfacing a 502 to the app.
    if (!res.ok && res.status >= 500) {
      if (resultsMatch) {
        const data = await mirrorResults(decodeURIComponent(resultsMatch[1]!));
        return Response.json(
          { data, upstreamStatus: res.status, source: data.length ? "mirror" : "none" },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      }
      return Response.json(
        { error: `Upstream unavailable (${res.status})`, upstreamStatus: res.status },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    if (resultsMatch) {
      let empty = false;
      try {
        const parsed = JSON.parse(text) as { data?: unknown[] };
        empty = !Array.isArray(parsed.data) || parsed.data.length === 0;
      } catch {
        empty = true;
      }
      if (empty) {
        const data = await mirrorResults(decodeURIComponent(resultsMatch[1]!));
        if (data.length) {
          return Response.json(
            { data, source: "mirror" },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        }
      }
    }

    const contentType = res.headers.get("content-type") ?? "application/json";
    const out = splat.startsWith("tv/") ? rewriteTvHtml(text, origin) : text;
    return new Response(out, {
      status: res.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });

  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upstream request failed", data: [] },
      { status: 200 },
    );
  }

}

export const Route = createFileRoute("/api/public/uapi/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        return proxy(splat, url.search, undefined, url.origin);
      },
      POST: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        const body = await request.text().catch(() => "{}");
        return proxy(splat, url.search, body || "{}", url.origin);

      },
    },
  },
});
