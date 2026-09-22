/**
 * Live sports feed (Aura exchange socket).
 *
 * The primary sports provider has been down for a while; this module talks to
 * the same public realtime exchange feed that the reference site uses, so the
 * app keeps showing real matches, real odds and real fancy/bookmaker markets.
 *
 * Protocol: socket.io v4 over a raw WebSocket (Engine.IO packet framing).
 *   40{"token":""}                      -> connect namespace
 *   42["subscribeToAuraMatches", {...}] -> stream of "auraMatchUpdate"
 *   42["subscribeToAuraOdds",    {...}] -> stream of "auraOddsUpdate"
 */

const WS_URL = "wss://ori.exchange24x7.live/socket.io/?EIO=4&transport=websocket";

/** Sports we keep a standing match subscription for. */
export const AURA_SPORTS: { sportId: string; sportName: string }[] = [
  { sportId: "4", sportName: "Cricket" },
  { sportId: "1", sportName: "Soccer" },
  { sportId: "2", sportName: "Tennis" },
  { sportId: "7", sportName: "Horse Racing" },
  { sportId: "4339", sportName: "Greyhound Racing" },
  { sportId: "7522", sportName: "Basketball" },
  { sportId: "2378961", sportName: "Politics" },
];

const SPORT_NAME = new Map(AURA_SPORTS.map((s) => [s.sportId, s.sportName]));

type AnyRec = Record<string, unknown>;

type MatchMeta = {
  sportId: string;
  competitionId: string;
  sportName: string;
  inPlay: boolean;
  eventName: string;
};

const matchesBySport = new Map<string, Map<string, AnyRec>>();
const matchSeenAt = new Map<string, number>();
const oddsByMatch = new Map<string, { at: number; data: AnyRec }>();
const matchMeta = new Map<string, MatchMeta>();
const wantedSports = new Set<string>(AURA_SPORTS.map((s) => s.sportId));
const wantedMatches = new Map<string, number>();

let socket: WebSocket | null = null;
let connecting: Promise<void> | null = null;
let namespaceReady = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;

function send(packet: string) {
  try {
    socket?.send(packet);
  } catch {
    /* socket died; the close handler reconnects */
  }
}

function emit(event: string, payload: unknown) {
  send(`42${JSON.stringify([event, payload])}`);
}

function subscribeSport(sportId: string) {
  emit("subscribeToAuraMatches", { eventId: Number(sportId) || sportId, eventType: null });
}

function subscribeMatch(matchId: string) {
  const meta = matchMeta.get(matchId);
  if (!meta) return;
  emit("subscribeToAuraOdds", {
    eventId: meta.sportId,
    eventType: meta.sportId,
    competitionId: meta.competitionId,
    matchId,
    marketId: matchId,
    sport: meta.sportName,
    inPlay: meta.inPlay,
  });
}

function handleMatchUpdate(payload: AnyRec) {
  const list = Array.isArray(payload["matches"]) ? (payload["matches"] as AnyRec[]) : [];
  const now = Date.now();
  for (const m of list) {
    const id = String(m["_id"] ?? m["exEventId"] ?? "");
    if (!id) continue;
    const sportId = String(m["sportId"] ?? m["sportID"] ?? "");
    if (!sportId) continue;
    let bucket = matchesBySport.get(sportId);
    if (!bucket) {
      bucket = new Map();
      matchesBySport.set(sportId, bucket);
    }
    bucket.set(id, m);
    matchSeenAt.set(`${sportId}:${id}`, now);
    matchMeta.set(id, {
      sportId,
      competitionId: String(m["competitionId"] ?? m["tournamentId"] ?? ""),
      sportName: String(m["sportName"] ?? SPORT_NAME.get(sportId) ?? "Cricket"),
      inPlay: Boolean(m["inPlay"]),
      eventName: String(m["eventName"] ?? ""),
    });
  }
  // Drop matches the feed stopped sending (finished / removed upstream).
  for (const [sportId, bucket] of matchesBySport) {
    for (const id of [...bucket.keys()]) {
      const seen = matchSeenAt.get(`${sportId}:${id}`) ?? 0;
      if (now - seen > 60_000) {
        bucket.delete(id);
        matchSeenAt.delete(`${sportId}:${id}`);
      }
    }
  }
}

function handleOddsUpdate(payload: AnyRec) {
  const odds = payload["auraMarketOdds"] as AnyRec | undefined;
  if (!odds) return;
  const id = String(odds["eventId"] ?? "");
  if (!id) return;
  oddsByMatch.set(id, { at: Date.now(), data: odds });
}

function onMessage(raw: string) {
  if (raw === "2") {
    send("3");
    return;
  }
  if (raw.startsWith("0")) {
    send('40{"token":""}');
    return;
  }
  if (raw.startsWith("40")) {
    namespaceReady = true;
    for (const s of wantedSports) subscribeSport(s);
    for (const m of wantedMatches.keys()) subscribeMatch(m);
    return;
  }
  if (!raw.startsWith("42")) return;
  try {
    const [event, payload] = JSON.parse(raw.slice(2)) as [string, AnyRec];
    if (event === "auraMatchUpdate") handleMatchUpdate(payload);
    else if (event === "auraOddsUpdate") handleOddsUpdate(payload);
  } catch {
    /* ignore malformed frame */
  }
}

async function openSocket(): Promise<WebSocket> {
  // Workers expose the standard constructor; fall back to the fetch upgrade.
  try {
    return new WebSocket(WS_URL);
  } catch {
    const res = await fetch(WS_URL.replace(/^ws/, "http"), {
      headers: { Upgrade: "websocket" },
    });
    const ws = (res as unknown as { webSocket?: WebSocket & { accept?: () => void } }).webSocket;
    if (!ws) throw new Error("WebSocket upgrade failed");
    ws.accept?.();
    return ws;
  }
}

function connect(): Promise<void> {
  if (connecting) return connecting;
  connecting = (async () => {
    namespaceReady = false;
    const ws = await openSocket();
    socket = ws;
    ws.addEventListener("message", (e) => onMessage(String((e as MessageEvent).data)));
    const drop = () => {
      if (socket === ws) {
        socket = null;
        namespaceReady = false;
        connecting = null;
      }
    };
    ws.addEventListener("close", drop);
    ws.addEventListener("error", drop);
    if (!heartbeat) {
      heartbeat = setInterval(() => {
        if (!socket || !namespaceReady) return;
        // Re-arm subscriptions periodically; the upstream drops idle ones.
        for (const s of wantedSports) subscribeSport(s);
        const now = Date.now();
        for (const [id, at] of wantedMatches) {
          if (now - at > 120_000) {
            wantedMatches.delete(id);
            emit("unsubscribeFromAuraOdds", { eventId: matchMeta.get(id)?.sportId, matchId: id, marketId: id });
          } else {
            subscribeMatch(id);
          }
        }
      }, 15_000);
    }
    const started = Date.now();
    while (!namespaceReady && Date.now() - started < 8000) {
      await new Promise((r) => setTimeout(r, 50));
    }
  })().catch(() => {
    socket = null;
    connecting = null;
  });
  return connecting;
}

async function ready() {
  if (!socket || !namespaceReady) {
    connecting = null;
    await connect();
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Match list for one sport, shaped like the app's UEvent. */
export async function auraEvents(sportId: string): Promise<AnyRec[]> {
  await ready();
  if (!wantedSports.has(sportId)) {
    wantedSports.add(sportId);
    if (namespaceReady) subscribeSport(sportId);
  }
  const deadline = Date.now() + 5000;
  while (!(matchesBySport.get(sportId)?.size ?? 0) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const bucket = matchesBySport.get(sportId);
  if (!bucket) return [];
  const events = [...bucket.values()].map((m) => ({
    sportId: String(m["sportId"] ?? sportId),
    sportName: String(m["sportName"] ?? SPORT_NAME.get(sportId) ?? ""),
    exEventId: String(m["exEventId"] ?? m["_id"] ?? ""),
    eventName: String(m["eventName"] ?? ""),
    marketName: String(m["marketName"] ?? "Match Odds"),
    tournamentName: String(m["tournamentName"] ?? ""),
    eventTime: String(m["eventTime"] ?? m["openDate"] ?? ""),
    inPlay: Boolean(m["inPlay"]),
    status: String(m["status"] ?? ""),
    tv: Boolean(m["tv"]),
    isScore: Boolean(m["isScore"]),
    isFancy: Boolean(m["isFancy"]),
    isBookmakers: Boolean(m["isBookmakers"]),
    isSportsbook: Boolean(m["isSportsbook"]),
    isStreaming: Boolean(m["isStreaming"]),
    totalMatched: num(m["totalMatched"]),
    betDelay: num(m["betDelay"]),
    runnersData: (m["runnersData"] as Record<string, string> | undefined) ?? null,
    runners: Array.isArray(m["runners"]) ? (m["runners"] as AnyRec[]) : [],
  }));
  events.sort((a, b) => {
    if (a.inPlay !== b.inPlay) return a.inPlay ? -1 : 1;
    return (a.eventTime || "").localeCompare(b.eventTime || "");
  });
  return events;
}

function flag(v: unknown): boolean {
  return v === true || Number(v) === 1;
}

function toMarket(m: AnyRec, fallbackRunners: Record<string, string> | null) {
  return {
    marketId: String(m["exMarketId"] ?? m["marketId"] ?? ""),
    marketName: String(m["marketName"] ?? ""),
    marketType: String(m["marketType"] ?? ""),
    oddsType: String(m["oddsType"] ?? ""),
    min: num(m["min"]) || undefined,
    max: num(m["max"]) || undefined,
    sequence: num(m["sequence"]),
    // Session-type flags the reference book uses to tab fancy markets and to
    // remove finished sessions the moment they settle.
    isSettlement: flag(m["isSettlement"]) ? 1 : 0,
    isVoid: flag(m["isVoid"]) ? 1 : 0,
    isClosed: flag(m["isClosed"]) ? 1 : 0,
    isLineMarket: flag(m["isLineMarket"]),
    isKhadoMarket: flag(m["isKhadoMarket"]),
    isMeterMarket: flag(m["isMeterMarket"]),
    isBallbyball: flag(m["isBallbyball"]),
    isSuperFancy: flag(m["isSuperFancy"]),
    runnersData: (m["runnersData"] as Record<string, string> | undefined) ?? fallbackRunners,
    oddsData: (m["oddsData"] as AnyRec | undefined) ?? {},
  };
}

type AuraMarket = ReturnType<typeof toMarket>;

/** A finished / voided / closed session must disappear from the board at once. */
function isFinished(m: AuraMarket): boolean {
  if (m.isSettlement || m.isVoid || m.isClosed) return true;
  const status = String((m.oddsData as AnyRec)["status"] ?? "").toUpperCase();
  return /CLOSE|SETTLE|RESULT|REMOVED|FINISH/.test(status);
}


/** Full odds payload for one match, shaped like the app's OddsResponse. */
export async function auraOdds(sportId: string, exEventId: string): Promise<AnyRec | null> {
  await ready();
  if (!matchMeta.has(exEventId)) {
    // Make sure the sport's match list (and therefore the metadata) is loaded.
    await auraEvents(sportId);
  }
  const meta = matchMeta.get(exEventId);
  if (!meta) return null;
  wantedMatches.set(exEventId, Date.now());
  if (namespaceReady) subscribeMatch(exEventId);
  const deadline = Date.now() + 5000;
  while (!oddsByMatch.has(exEventId) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const hit = oddsByMatch.get(exEventId);
  if (!hit) return null;
  const o = hit.data;
  const runnersData = (matchesBySport.get(meta.sportId)?.get(exEventId)?.["runnersData"] ??
    null) as Record<string, string> | null;

  const pick = (key: string) =>
    (Array.isArray(o[key]) ? (o[key] as AnyRec[]) : []).map((m) => toMarket(m, runnersData));
  const sportsbookAll = [...pick("sportsbook"), ...pick("sportsBook")];
  const seen = new Set<string>();
  const sportsbook = sportsbookAll.filter((m) => {
    const key = m.marketId || m.marketName;
    if (!key || seen.has(key) || isFinished(m)) return false;
    seen.add(key);
    return true;
  });
  // Finished sessions (over already bowled, market settled or voided) are
  // dropped here so they can never linger on the board.
  const fancy = pick("fancy")
    .filter((m) => !isFinished(m))
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  return {
    exEventId,
    eventName: meta.eventName,
    sportId: meta.sportId,
    inPlay: Boolean(o["inPlay"]),
    tv: Boolean(o["tv"]),
    isScore: Boolean(o["isScore"]),
    betDelay: num(o["betDelay"]),
    totalMatched: num(o["totalMatched"]),
    updatedAt: new Date(num(o["updatedAt"]) || Date.now()).toISOString(),
    matchOdds: pick("betfair"),
    bookmakers: pick("bookmakers").filter((m) => !isFinished(m)),
    fancy,
    sportsbook,
  };

}

// Warm the socket + match subscriptions as soon as the server module loads so
// the first page view already has matches instead of waiting for a cold start.
void connect().catch(() => undefined);
