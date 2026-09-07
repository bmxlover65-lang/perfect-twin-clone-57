import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://universeapi.shop/public";

// Failover chain: if the primary provider is down we walk these mirrors in
// order so odds/results keep flowing. Extra mirrors can be added at runtime
// through the UAPI_MIRRORS env var (comma separated base URLs).
function upstreamBases(): string[] {
  const extra = (process.env["UAPI_MIRRORS"] ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [
    UPSTREAM,
    "https://www.universeapi.shop/public",
    "https://api.universeapi.shop/public",
    ...extra,
  ];
}

let cachedToken: string | null = null;
let cachedAt = 0;

function apiKey(): string | undefined {
  return process.env["UAPI_KEY"] || undefined;
}

function authHeaders(): Record<string, string> {
  const key = apiKey();
  return key ? { "X-API-Key": key, "x-api-key": key } : {};
}

// Which base answered last — reused first so we stick to a healthy mirror.
let activeBase = UPSTREAM;

async function mintToken(): Promise<string> {
  let lastError = "Failed to create session";
  const bases = [activeBase, ...upstreamBases().filter((b) => b !== activeBase)];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}",
      });
      const json = (await res.json().catch(() => ({}))) as {
        sessionToken?: string;
        error?: string;
      };
      if (res.ok && json.sessionToken) {
        activeBase = base;
        cachedToken = json.sessionToken;
        cachedAt = Date.now();
        return json.sessionToken;
      }
      lastError = json.error ?? `Failed to create session (${res.status})`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }
  throw new Error(lastError);
}

async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() - cachedAt < 30 * 60 * 1000) return cachedToken;
  return mintToken();
}

async function upstream(path: string, search: string, token: string, body?: string) {
  const bases = [activeBase, ...upstreamBases().filter((b) => b !== activeBase)];
  let last: Response | null = null;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/${path}${search}`, {
        method: body === undefined ? "GET" : "POST",
        cache: "no-store",
        headers: {
          "x-session-token": token,
          accept: "application/json",
          ...authHeaders(),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body }),
      });
      if (res.status < 500) {
        activeBase = base;
        return res;
      }
      last = res;
    } catch {
      last = null;
    }
  }
  return last ?? new Response(JSON.stringify({ error: "All upstreams unavailable" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

// The stream provider only allows its own client hostname. Everything that the
// player loads (page, scripts, RTS signalling) is fetched server-side with that
// referer and re-served from our origin, otherwise the CDN answers 403.
const STREAM_REFERER = "https://universeapi.shop/";

const STREAM_HOSTS = /(^|\.)(diamondtech\.shop|livestream11\.com|xfeed247\.live|zfeed247\.live|feed247\.live)$/i;

function proxyPrefix(origin: string) {
  return `${origin}/api/public/uapi/sproxy/`;
}

function rewriteStreamText(text: string, origin: string) {
  return text.replace(
    /https:\/\/[a-z0-9.-]*(?:diamondtech\.shop|livestream11\.com|[xz]?feed247\.live)/gi,
    (m) => `${proxyPrefix(origin)}${m}`,
  );
}

const RETRY_PAGE = `<!doctype html><html><head><meta charset="utf-8"/>
<style>html,body{margin:0;height:100%;background:#000;color:#cfd6dd;font:13px/1.4 system-ui,sans-serif;display:flex;align-items:center;justify-content:center}</style>
<script>setTimeout(function(){location.reload()},5000)</script>
</head><body>Live TV reconnecting…</body></html>`;


async function streamPage(rawUrl: string, origin: string, method = "GET", body?: string) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response("Bad stream url", { status: 400 });
  }
  if (!STREAM_HOSTS.test(target.hostname)) {
    return new Response("Stream host not allowed", { status: 403 });
  }
  const doFetch = () =>
    fetch(target.toString(), {
      method,
      redirect: "follow",
      headers: {
        referer: STREAM_REFERER,
        origin: STREAM_REFERER.replace(/\/$/, ""),
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        accept: "*/*",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
    });

  // The stream CDN drops connections fairly often; retry before giving up so
  // the player iframe never lands on a broken-page error.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await doFetch();
      if (res.status < 500) break;
    } catch {
      res = null;
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  if (!res || (res.status >= 500 && /text\/html/i.test(res.headers.get("content-type") ?? ""))) {
    return new Response(RETRY_PAGE, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }



  const type = res.headers.get("content-type") ?? "application/octet-stream";
  const textual = /text\/html|javascript|text\/css|json|mpegurl/i.test(type);
  const headers: Record<string, string> = {
    "content-type": type,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  };

  if (!textual) {
    return new Response(await res.arrayBuffer(), { status: res.status, headers });
  }
  return new Response(rewriteStreamText(await res.text(), origin), {
    status: res.status,
    headers,
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
  // keep a very short window only to collapse bursts; always re-fetch otherwise
  if (hit && Date.now() - hit.at < 700) return hit.data;
  try {
    const res = await fetch(MIRROR_RESULTS, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "cache-control": "no-cache",
      },
      body: JSON.stringify({ eventId }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: unknown[] };
    const data = Array.isArray(json.data) ? json.data : [];
    if (data.length) mirrorCache.set(eventId, { at: Date.now(), data });
    return data.length ? data : (hit?.data ?? []);
  } catch {
    return hit?.data ?? [];
  }
}

// Last-good sports snapshots. The upstream sports ingest worker goes down from
// time to time and answers 503 ("Sports odds unavailable"); serving the last
// good frame keeps the board rendered instead of blanking the whole page.
const sportsSnapshot = new Map<string, { at: number; text: string }>();

// Snapshot every live feed path (sports odds/events and casino state), so an
// outage on any provider still renders the last known prices and results.
function isSportsPath(splat: string) {
  return /^sports\//.test(splat) || /^games(\/|$)/.test(splat);
}

function sportsSnapshotKey(splat: string, search: string) {
  const params = new URLSearchParams(search);
  // The browser adds this cache-buster on every live request. Keeping it in
  // the key made every snapshot unique, so an outage could never find the
  // previous successful response.
  params.delete("_");
  const query = params.toString();
  return query ? `${splat}?${query}` : splat;
}

function snapshotResponse(key: string, upstreamStatus: number) {
  const hit = sportsSnapshot.get(key);
  if (!hit) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(hit.text) as Record<string, unknown>;
  } catch {
    return null;
  }
  payload["stale"] = true;
  payload["upstreamStatus"] = upstreamStatus;
  payload["snapshotAgeMs"] = Date.now() - hit.at;
  return Response.json(payload, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}


async function proxy(splat: string, search: string, body?: string, origin = "") {
  const snapshotKey = sportsSnapshotKey(splat, search);
  try {
    if (splat === "stream") {
      const u = new URLSearchParams(search).get("u") ?? "";
      return streamPage(u, origin, "GET");
    }

    if (splat.startsWith("sproxy/")) {
      const raw = splat.slice("sproxy/".length).replace(/^(https?):\/+/i, "$1://");
      return streamPage(`${raw}${search}`, origin, body === undefined ? "GET" : "POST", body);
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
    const preMatch = /^games\/([^/]+)\/results$/.exec(splat);
    if (preMatch) {
      // official results mirror is the source of truth for casino events
      const data = await mirrorResults(decodeURIComponent(preMatch[1]!));
      if (data.length) {
        return Response.json(
          { data, source: "mirror" },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      }
    }
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
      if (isSportsPath(splat)) {
        const snap = snapshotResponse(snapshotKey, res.status);
        if (snap) return snap;
      }
      return Response.json(
        { error: `Upstream unavailable (${res.status})`, upstreamStatus: res.status },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    if (isSportsPath(splat) && res.ok && text.startsWith("{")) {
      sportsSnapshot.set(snapshotKey, { at: Date.now(), text });
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
    if (isSportsPath(splat)) {
      const snap = snapshotResponse(snapshotKey, 0);
      if (snap) return snap;
    }
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
        // Same-origin relative URLs: the worker's internal request origin can be
        // localhost, which the browser cannot load from inside the iframe.
        return proxy(splat, url.search, undefined, "");
      },
      POST: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        const body = await request.text().catch(() => "{}");
        return proxy(splat, url.search, body || "{}", "");

      },
    },
  },
});
