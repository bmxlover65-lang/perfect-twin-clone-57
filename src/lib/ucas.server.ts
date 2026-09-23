/**
 * Live casino feed over the exchange socket gateway (the same stream the
 * dukex.biz front-end uses). It speaks socket.io v4 over HTTP long-polling so
 * it works inside the edge runtime — no websocket, no API key, no session mint.
 *
 * One polling session is kept alive per worker instance; every game we are
 * asked about is subscribed once and its latest frame cached in memory.
 */

const BASE = "https://ori.exchange24x7.live";
const HEADERS: Record<string, string> = {
  accept: "*/*",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  origin: "https://dukex.biz",
  referer: "https://dukex.biz/",
};

const SEP = "\u001e";

type Frame = { at: number; data: unknown };

let sid: string | null = null;
let sidAt = 0;
let connecting: Promise<string | null> | null = null;
let pumping: Promise<void> | null = null;

const subscribed = new Set<string>();
const states = new Map<string, Frame>();
const results = new Map<string, { at: number; data: unknown[] }>();

async function call(path: string, init?: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      cache: "no-store",
      signal: ac.signal,
      headers: { ...HEADERS, ...(init?.headers as Record<string, string> | undefined) },
    });
  } finally {
    clearTimeout(timer);
  }
}

function post(id: string, payload: string) {
  return call(`/socket.io/?EIO=4&transport=polling&sid=${id}`, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: payload,
  }).catch(() => null);
}

async function handshake(): Promise<string | null> {
  try {
    const res = await call("/socket.io/?EIO=4&transport=polling");
    const text = await res.text();
    const open = /^0(\{.*?\})/.exec(text.split(SEP)[0] ?? "");
    if (!open) return null;
    const id = (JSON.parse(open[1]!) as { sid?: string }).sid;
    if (!id) return null;
    await post(id, '40{"token":""}');
    // drain the namespace-connect ack
    await call(`/socket.io/?EIO=4&transport=polling&sid=${id}`).catch(() => null);
    subscribed.clear();
    sid = id;
    sidAt = Date.now();
    return id;
  } catch {
    return null;
  }
}

async function session(): Promise<string | null> {
  if (sid && Date.now() - sidAt < 5 * 60_000) return sid;
  if (!connecting) connecting = handshake().finally(() => (connecting = null));
  return connecting;
}

function ingest(text: string) {
  for (const packet of text.split(SEP)) {
    if (!packet) continue;
    if (packet === "2") {
      if (sid) void post(sid, "3");
      continue;
    }
    if (!packet.startsWith("42")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(packet.slice(2));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    const [name, payload] = parsed as [string, Record<string, unknown> | undefined];
    const eventId = typeof payload?.["eventId"] === "string" ? (payload["eventId"] as string) : "";
    if (!eventId) continue;
    if (name === "game:state" && payload?.["data"]) {
      states.set(eventId, { at: Date.now(), data: payload["data"] });
    } else if (name === "game:results") {
      const raw = payload?.["data"];
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown[] } | undefined)?.data)
          ? ((raw as { data: unknown[] }).data)
          : [];
      if (list.length) results.set(eventId, { at: Date.now(), data: list });
    }
  }
}

async function pump(id: string) {
  if (pumping) return pumping;
  pumping = (async () => {
    try {
      const res = await call(`/socket.io/?EIO=4&transport=polling&sid=${id}`);
      if (res.status >= 400) {
        sid = null;
        return;
      }
      ingest(await res.text());
    } catch {
      /* transient — next call retries */
    } finally {
      pumping = null;
    }
  })();
  return pumping;
}

async function ensure(eventId: string): Promise<string | null> {
  const id = await session();
  if (!id) return null;
  if (!subscribed.has(eventId)) {
    subscribed.add(eventId);
    await post(id, `42["game:subscribe",{"eventId":${JSON.stringify(eventId)}}]`);
    await post(id, `42["game:subscribeResults",{"eventId":${JSON.stringify(eventId)}}]`);
  }
  return id;
}

/** Latest live frame for a casino event, or null when the gateway is silent. */
export async function ucasState(eventId: string): Promise<{
  data: unknown;
  freshnessMs: number;
} | null> {
  const id = await ensure(eventId);
  if (!id) return null;
  const hit = states.get(eventId);
  if (hit && Date.now() - hit.at < 700) return { data: hit.data, freshnessMs: Date.now() - hit.at };

  for (let i = 0; i < 3; i++) {
    await pump(id);
    const frame = states.get(eventId);
    if (frame && Date.now() - frame.at < 3000) {
      return { data: frame.data, freshnessMs: Date.now() - frame.at };
    }
    if (!sid) {
      const again = await ensure(eventId);
      if (!again) break;
    }
  }
  const last = states.get(eventId);
  return last ? { data: last.data, freshnessMs: Date.now() - last.at } : null;
}

/** Recent round results for a casino event. */
export async function ucasResults(eventId: string): Promise<unknown[]> {
  const id = await ensure(eventId);
  if (!id) return results.get(eventId)?.data ?? [];
  const hit = results.get(eventId);
  if (hit && Date.now() - hit.at < 1500) return hit.data;
  await pump(id);
  return results.get(eventId)?.data ?? hit?.data ?? [];
}
