import { createFileRoute } from "@tanstack/react-router";
import { authenticateOperator, productDenied } from "@/lib/operator-auth.server";
import { proxy } from "@/routes/api/public/uapi.$";

/**
 * WS /ws/sports?sportId=&exEventId=&apiKey=
 * Pushes { type: "odds", sportId, exEventId, data } whenever the exchange
 * sends a genuinely changed frame. The 100ms loop only minimizes relay delay.
 * data has the same shape as GET /odds.
 */
type WSLike = {
  accept: () => void;
  send: (s: string) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (t: string, cb: (e: unknown) => void) => void;
};

export const Route = createFileRoute("/ws/sports")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sportId = url.searchParams.get("sportId") ?? "";
        const exEventId = url.searchParams.get("exEventId") ?? "";
        const apiKey = url.searchParams.get("apiKey") ?? "";
        const origin = request.headers.get("origin");
        const firstParty = origin === url.origin;

        if ((request.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
          return Response.json(
            { status: "error", code: "upgrade_required", message: "Connect with a WebSocket client (wss://)" },
            { status: 426 },
          );
        }

        const Pair = (globalThis as unknown as { WebSocketPair?: new () => Record<0 | 1, WSLike> })
          .WebSocketPair;
        if (!Pair) return new Response("WebSocket not supported here", { status: 501 });
        const pair = new Pair();
        const client = pair[0];
        const server = pair[1];
        server.accept();

        const headers = new Headers(request.headers);
        headers.set("x-api-key", apiKey);
        const auth = apiKey
          ? await authenticateOperator(new Request(request.url, { headers }))
          : ({ ok: false, error: "Unauthorized" } as const);
        let reject: string | null = null;
        if (!firstParty && !auth.ok) reject = auth.error === "Invalid API key" || !apiKey ? "Unauthorized" : auth.error;
        else if (!firstParty && auth.ok && productDenied(auth, "sports")) reject = "Product not enabled: sports";
        else if (!sportId || !exEventId) reject = "sportId and exEventId are required";

        if (reject) {
          server.close(1008, reject.slice(0, 120));
          return new Response(null, { status: 101, webSocket: client } as ResponseInit);
        }

        server.send(
          JSON.stringify({ type: "subscribed", sportId, exEventId, client: auth.ok ? auth.operator.name : "first-party" }),
        );

        let open = true;
        let last = "";
        const path = `sports/${encodeURIComponent(sportId)}/${encodeURIComponent(exEventId)}/odds`;
        const tick = async () => {
          while (open) {
            try {
              const res = await proxy(path, "", undefined, "");
              const text = await res.text();
              if (res.ok && text !== last) {
                last = text;
                server.send(`{"type":"odds","sportId":${JSON.stringify(sportId)},"exEventId":${JSON.stringify(exEventId)},"data":${text}}`);
              }
            } catch {
              /* keep going; next tick retries */
            }
            await new Promise((r) => setTimeout(r, 100));
          }
        };
        const stop = () => {
          open = false;
        };
        server.addEventListener("close", stop);
        server.addEventListener("error", stop);
        server.addEventListener("message", (e) => {
          if (String((e as { data?: unknown }).data) === "ping") server.send('{"type":"pong"}');
        });
        void tick();

        return new Response(null, { status: 101, webSocket: client } as ResponseInit);
      },
    },
  },
});
