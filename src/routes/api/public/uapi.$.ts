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


async function proxy(splat: string, search: string, body?: string) {
  try {
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
    // Upstream currently 502s on some casino endpoints (e.g. /results).
    // Degrade gracefully instead of surfacing a 502 to the app.
    if (!res.ok && res.status >= 500) {
      return Response.json(
        splat.endsWith("/results")
          ? { data: [], upstreamStatus: res.status }
          : { error: `Upstream unavailable (${res.status})`, upstreamStatus: res.status },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
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
        return proxy(splat, new URL(request.url).search);
      },
      POST: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const body = await request.text().catch(() => "{}");
        return proxy(splat, new URL(request.url).search, body || "{}");
      },
    },
  },
});
