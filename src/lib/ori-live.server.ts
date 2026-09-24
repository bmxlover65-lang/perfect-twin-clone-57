/**
 * Live odds stream from the exchange (same stream the reference site uses).
 *
 * The REST /markets endpoint is served from a slow cache and can lag the real
 * board by minutes, so rates and matched amounts differed from the reference.
 * This keeps one socket per server instance, subscribes to each watched event
 * and remembers the newest frame, which the odds endpoint then serves.
 */

type Frame = { at: number; data: Record<string, unknown> };

const HOST = "ori.exchange24x7.live";
const HEADERS = {
  origin: "https://dukex.biz",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
};

type Sock = { send: (s: string) => void; close: () => void };

let sock: Sock | null = null;
let ready = false;
let connecting: Promise<void> | null = null;
let lastAttempt = 0;
const frames = new Map<string, Frame>();
const watched = new Map<string, { sportId: string; lastAsk: number }>();

function subMsg(sportId: string, id: string) {
  return `42${JSON.stringify(["subscribeToAuraOdds", { eventId: sportId, matchId: id, marketId: id, inPlay: true }])}`;
}

function onText(text: string) {
  if (text === "2") return sock?.send("3");
  if (text.startsWith("0")) return sock?.send(`40${JSON.stringify({ token: "" })}`);
  if (text.startsWith("40")) {
    ready = true;
    for (const [id, w] of watched) sock?.send(subMsg(w.sportId, id));
    return;
  }
  if (!text.startsWith("42")) return;
  try {
    const [ev, payload] = JSON.parse(text.slice(2)) as [string, { auraMarketOdds?: Record<string, unknown> }];
    if (ev !== "auraOddsUpdate") return;
    const a = payload?.auraMarketOdds;
    if (!a) return;
    const first = (k: string) => (a[k] as { exEventId?: string }[] | undefined)?.[0]?.exEventId;
    const id = String(a["eventId"] ?? first("betfair") ?? first("bookmakers") ?? first("fancy") ?? "");
    if (id) frames.set(id, { at: Date.now(), data: a });
  } catch {
    /* ignore malformed frame */
  }
}

function reset() {
  sock = null;
  ready = false;
}

async function open(): Promise<void> {
  const url = `https://${HOST}/socket.io/?EIO=4&transport=websocket`;
  // Edge runtime: outbound WebSocket via fetch upgrade (lets us set Origin).
  try {
    const res = await fetch(url, { headers: { ...HEADERS, Upgrade: "websocket" } });
    const ws = (res as unknown as { webSocket?: WebSocket & { accept: () => void } }).webSocket;
    if (ws) {
      ws.accept();
      ws.addEventListener("message", (e) => onText(String(e.data)));
      ws.addEventListener("close", reset);
      ws.addEventListener("error", reset);
      sock = { send: (s) => ws.send(s), close: () => ws.close() };
      return;
    }
  } catch {
    /* fall through to the standard constructor (dev server) */
  }
  const Ctor = (globalThis as { WebSocket?: new (u: string, o?: unknown) => WebSocket }).WebSocket;
  if (!Ctor) return;
  const ws = new Ctor(`wss://${HOST}/socket.io/?EIO=4&transport=websocket`, { headers: HEADERS });
  ws.addEventListener("message", (e) => onText(String((e as MessageEvent).data)));
  ws.addEventListener("close", reset);
  ws.addEventListener("error", reset);
  sock = { send: (s) => ws.readyState === 1 && ws.send(s), close: () => ws.close() };
}

function ensure() {
  if (sock || connecting || Date.now() - lastAttempt < 2000) return;
  lastAttempt = Date.now();
  connecting = open()
    .catch(reset)
    .finally(() => {
      connecting = null;
    });
}

/** Newest streamed frame for an event (null until the stream delivers one). */
export async function oriLiveFrame(sportId: string, exEventId: string, waitMs = 1200) {
  const now = Date.now();
  const prev = watched.get(exEventId);
  watched.set(exEventId, { sportId, lastAsk: now });
  for (const [id, w] of watched) if (now - w.lastAsk > 60_000) { watched.delete(id); frames.delete(id); }
  ensure();
  if (!prev && ready) sock?.send(subMsg(sportId, exEventId));
  const fresh = () => {
    const f = frames.get(exEventId);
    return f && Date.now() - f.at < 15_000 ? f.data : null;
  };
  if (fresh() || prev) return fresh();
  // First request for this event: give the stream a moment to answer.
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    if (ready && !watched.get(exEventId)?.lastAsk) break;
    const f = fresh();
    if (f) return f;
    await new Promise((r) => setTimeout(r, 100));
  }
  return fresh();
}
