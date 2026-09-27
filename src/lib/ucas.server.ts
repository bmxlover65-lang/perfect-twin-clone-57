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
const sportsFrames = new Map<string, { at: number; data: Record<string, unknown> }>();
const sportsSubs = new Map<string, string>();
const sportsRetryAt = new Map<string, number>();
const results = new Map<string, { at: number; data: unknown[] }>();

type SportsMeta = { competitionId: string; sport: string; inPlay: boolean };
const sportsMeta = new Map<string, SportsMeta>();
const sportsMetaPending = new Map<string, Promise<SportsMeta | null>>();

async function findSportsMeta(sportId: string, exEventId: string): Promise<SportsMeta | null> {
  const cached = sportsMeta.get(exEventId);
  if (cached) return cached;
  const pending = sportsMetaPending.get(exEventId);
  if (pending) return pending;
  const lookup = (async () => {
    try {
      const res = await call(`/api/sports/${encodeURIComponent(sportId)}/events`, undefined, 3500);
      if (!res.ok) return null;
      const json = await res.json() as { data?: { exEventId?: string; _id?: string; competitionId?: string; tournamentId?: string; sportName?: string; inPlay?: boolean }[] };
      const match = json.data?.find((row) => String(row.exEventId ?? row._id) === exEventId);
      if (!match) return null;
      const meta = {
        competitionId: String(match.competitionId ?? match.tournamentId ?? ""),
        sport: String(match.sportName ?? ""),
        inPlay: Boolean(match.inPlay),
      };
      sportsMeta.set(exEventId, meta);
      return meta;
    } catch {
      return null;
    } finally {
      sportsMetaPending.delete(exEventId);
    }
  })();
  sportsMetaPending.set(exEventId, lookup);
  return lookup;
}

async function call(path: string, init?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
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
    warmed = "";
    // Reattach every watched event before declaring the new session ready.
    // Fire-and-forget subscriptions were cancelled when the request ended.
    await Promise.all([...sportsSubs].map(([ev, sp]) => post(id, sportsSub(sp, ev))));
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
    if (name === "auraOddsUpdate") {
      const a = payload?.["auraMarketOdds"] as Record<string, unknown> | undefined;
      const id = a ? String(a["eventId"] ?? (a["betfair"] as { exEventId?: string }[] | undefined)?.[0]?.exEventId ?? "") : "";
       if (a && id) {
         // The exchange timestamp is the actual market tick. Replayed packets
         // after reconnecting must not become a fresh frame on receipt.
         const tick = Number(a["updatedAt"]);
          if (!Number.isFinite(tick) || tick < 1_600_000_000_000 || tick > Date.now() + 5_000) continue;
          const at = tick;
         if (at >= (sportsFrames.get(id)?.at ?? 0)) sportsFrames.set(id, { at, data: a });
       }
      continue;
    }
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

let looping = false;

/** Keep one long-poll loop alive so frames land continuously, not per-request. */
function startLoop(id: string) {
  if (looping) return;
  looping = true;
  void (async () => {
    try {
      let current = id;
      // Runs for the lifetime of the worker; each poll returns as soon as the
      // gateway pushes a frame, so this is an always-fresh stream.
      for (;;) {
        try {
           // A stale subscription may have forced a fresh handshake in a
           // different request. Never keep polling the orphaned session.
           if (sid && current !== sid) current = sid;
          // Engine.IO long-polls are expected to stay open while waiting for
          // the next frame; the normal request timeout caused reconnect churn.
          const res = await call(`/socket.io/?EIO=4&transport=polling&sid=${current}`, undefined, 30_000);
          if (res.status >= 400) {
            sid = null;
            const next = await session();
            if (!next) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
            current = next;
            for (const eventId of [...subscribed]) {
              subscribed.delete(eventId);
              await ensure(eventId);
            }
            continue;
          }
          ingest(await res.text());
          if (sid) current = sid;
          } catch {
            // A dead poll must not retain a seemingly valid sid for five
            // minutes: the next iteration needs to establish a new session.
            if (sid === current) sid = null;
            const next = await session();
            if (next) current = next;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } finally {
      looping = false;
    }
  })();
}

/**
 * Every live table we serve. A cold worker subscribes to all of them in the
 * background on the first request, so opening any other game is instant
 * instead of waiting for a fresh subscribe round trip.
 */
const WARM_IDS = [
  "99.0010", "99.0030", "99.0013", "99.0016", "99.0019", "99.0001", "99.0025",
  "99.0022", "99.0007", "99.0041", "99.0021", "99.0014", "99.0046", "99.0005",
  "99.0018", "88.0019", "88.0020", "88.0021", "88.0023",
];

function subscribe(id: string, eventId: string) {
  if (subscribed.has(eventId)) return Promise.resolve();
  subscribed.add(eventId);
  return Promise.all([
    post(id, `42["game:subscribe",{"eventId":${JSON.stringify(eventId)}}]`),
    post(id, `42["game:subscribeResults",{"eventId":${JSON.stringify(eventId)}}]`),
  ]).then(() => undefined);
}

let warmed = "";

function warmAll(id: string) {
  if (warmed === id) return;
  warmed = id;
  // Background fan-out: never blocks the request that triggered it.
  void (async () => {
    for (const eventId of WARM_IDS) {
      await subscribe(id, eventId).catch(() => undefined);
    }
  })();
}

async function ensure(eventId: string): Promise<string | null> {
  const id = await session();
  if (!id) return null;
  startLoop(id);
  await subscribe(id, eventId);
  warmAll(id);
  return id;
}

async function waitFor(check: () => boolean, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return check();
}

/** Latest live frame for a casino event, or null when the gateway is silent. */
export async function ucasState(eventId: string): Promise<{
  data: unknown;
  freshnessMs: number;
} | null> {
  const id = await ensure(eventId);
  if (!id) return null;
  await waitFor(() => states.has(eventId), 4500);
  const last = states.get(eventId);
  return last ? { data: last.data, freshnessMs: Date.now() - last.at } : null;
}

/** Recent round results for a casino event. */
export async function ucasResults(eventId: string): Promise<unknown[]> {
  const id = await ensure(eventId);
  if (!id) return results.get(eventId)?.data ?? [];
  await waitFor(() => results.has(eventId), 4000);
  return results.get(eventId)?.data ?? [];
}

function sportsSub(sportId: string, ev: string) {
  const meta = sportsMeta.get(ev);
  return `42${JSON.stringify(["subscribeToAuraOdds", {
    eventId: sportId, eventType: sportId, competitionId: meta?.competitionId ?? "",
    matchId: ev, marketId: ev, sport: meta?.sport ?? "", inPlay: meta?.inPlay ?? true,
  }])}`;
}

/** Live sports odds frame (same stream the reference board uses). */
export async function ucasSportsOdds(sportId: string, exEventId: string, waitMs = 1500, meta?: SportsMeta): Promise<{
  data: Record<string, unknown>;
  receivedAt: number;
} | null> {
  if (meta) sportsMeta.set(exEventId, meta);
  else await findSportsMeta(sportId, exEventId);
  const id = await session();
  if (!id) return null;
  startLoop(id);
  if (!sportsSubs.has(exEventId)) {
    sportsSubs.set(exEventId, sportId);
    await post(id, sportsSub(sportId, exEventId));
  }
  const previous = sportsFrames.get(exEventId);
  if (previous && Date.now() - previous.at > 8_000 && Date.now() - (sportsRetryAt.get(exEventId) ?? 0) > 5_000) {
    sportsRetryAt.set(exEventId, Date.now());
    // A silent event is not a fresh tick. Re-subscribe to recover a dropped
    // channel, and rotate the socket when it has stopped delivering entirely.
    if (Date.now() - previous.at > 15_000) {
      if (sid === id) sid = null;
      await session();
    } else {
      await post(id, sportsSub(sportId, exEventId));
    }
  }
  const fresh = () => {
    const f = sportsFrames.get(exEventId);
    return f && Date.now() - f.at < 15_000 ? f : null;
  };
  // A connected relay must answer from its current frame immediately. Waiting
  // for a newer frame here added up to 900ms to every request even though the
  // exchange had not changed its prices. Only a cold subscription waits.
  if (!fresh()) await waitFor(() => Boolean(fresh()), waitMs);
  const frame = fresh();
  return frame ? { data: frame.data, receivedAt: frame.at } : null;
}
