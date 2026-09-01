import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://universeapi.shop/public";

let cachedToken: string | null = null;
let cachedAt = 0;

async function mintToken(): Promise<string> {
  const res = await fetch(`${UPSTREAM}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

async function upstream(path: string, search: string, token: string) {
  return fetch(`${UPSTREAM}/${path}${search}`, {
    headers: { "x-session-token": token, accept: "application/json" },
  });
}

export const Route = createFileRoute("/api/public/uapi/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        const search = url.search;

        try {
          if (splat === "session") {
            const token = await getToken();
            return Response.json({ sessionToken: token });
          }

          let token = await getToken();
          let res = await upstream(splat, search, token);
          if (res.status === 401 || res.status === 403) {
            token = await getToken(true);
            res = await upstream(splat, search, token);
          }

          const body = await res.text();
          return new Response(body, {
            status: res.status,
            headers: {
              "content-type": res.headers.get("content-type") ?? "application/json",
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Upstream request failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
