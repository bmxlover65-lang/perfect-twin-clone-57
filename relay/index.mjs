// Universal odds relay — always-on exchange socket that pushes every new
// frame to the main site so partner sites get rates without delay.
// Needs Node 22+. Env: TARGET_URL (e.g. https://universalapi.store), RELAY_SECRET, PORT.
import http from "node:http";

const WS_URL = "wss://ori.exchange24x7.live/socket.io/?EIO=4&transport=websocket";
const TARGET = (process.env.TARGET_URL || "https://universalapi.store").replace(/\/$/, "");
const SECRET = process.env.RELAY_SECRET || "";
const SPORTS = ["4", "1", "2", "7", "4339", "7522"];
const NAMES = { 4: "Cricket", 1: "Soccer", 2: "Tennis", 7: "Horse Racing", 4339: "Greyhound Racing", 7522: "Basketball" };

const matches = new Map(); // id -> meta
const lastTick = new Map();
const pending = new Map();
let ws = null, ready = false, pushed = 0, lastFrameAt = 0;

const emit = (e, p) => { try { ws?.send("42" + JSON.stringify([e, p])); } catch {} };
const subMatch = (id) => {
  const m = matches.get(id);
  if (m) emit("subscribeToAuraOdds", { eventId: m.sportId, eventType: m.sportId, competitionId: m.competitionId, matchId: id, marketId: id, sport: m.sportName, inPlay: m.inPlay });
};
const subAll = () => {
  for (const s of SPORTS) emit("subscribeToAuraMatches", { eventId: Number(s), eventType: null });
  for (const [id, m] of matches) if (m.inPlay) subMatch(id);
};

function onMatches(p) {
  for (const m of p?.matches ?? []) {
    const id = String(m._id ?? m.exEventId ?? "");
    const sportId = String(m.sportId ?? "");
    if (!id || !sportId) continue;
    const was = matches.get(id);
    matches.set(id, {
      sportId, competitionId: String(m.competitionId ?? m.tournamentId ?? ""),
      sportName: String(m.sportName ?? NAMES[sportId] ?? "Cricket"), inPlay: Boolean(m.inPlay),
      eventName: String(m.eventName ?? ""), runnersData: m.runnersData ?? null, seen: Date.now(),
    });
    if (m.inPlay && (!was || !was.inPlay) && ready) subMatch(id);
  }
}

function onOdds(p) {
  const o = p?.auraMarketOdds;
  const id = String(o?.eventId ?? "");
  const tick = Number(o?.updatedAt);
  if (!id || !(tick > 1.6e12) || tick > Date.now() + 5000) return;
  if (tick <= (lastTick.get(id) ?? 0)) return;
  lastTick.set(id, tick);
  lastFrameAt = Date.now();
  const m = matches.get(id);
  if (!m) return;
  pending.set(id, { sportId: m.sportId, eventId: id, eventName: m.eventName, runnersData: m.runnersData, odds: o });
}

async function flush() {
  if (!pending.size) return;
  const frames = [...pending.values()].slice(0, 100);
  for (const f of frames) pending.delete(f.eventId);
  try {
    const r = await fetch(TARGET + "/api/public/relay/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-relay-secret": SECRET },
      body: JSON.stringify({ frames }),
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) pushed += frames.length; else console.log("ingest", r.status);
  } catch (e) { console.log("ingest error", String(e)); }
}

function connect() {
  ready = false;
  ws = new WebSocket(WS_URL);
  ws.onmessage = (ev) => {
    const raw = String(ev.data);
    if (raw === "2") return ws.send("3");
    if (raw.startsWith("0")) return ws.send('40{"token":""}');
    if (raw.startsWith("40")) { ready = true; subAll(); return; }
    if (!raw.startsWith("42")) return;
    try {
      const [e, p] = JSON.parse(raw.slice(2));
      if (e === "auraMatchUpdate") onMatches(p);
      else if (e === "auraOddsUpdate") onOdds(p);
    } catch {}
  };
  ws.onclose = ws.onerror = () => { if (ws) { ws = null; setTimeout(connect, 1000); } };
}

connect();
setInterval(flush, 250);
setInterval(() => { if (ready) subAll(); }, 15000);
// Silent socket for 30s -> reconnect.
setInterval(() => { if (lastFrameAt && Date.now() - lastFrameAt > 30000) { lastFrameAt = 0; try { ws?.close(); } catch {} } }, 5000);
setInterval(() => { for (const [id, m] of matches) if (Date.now() - m.seen > 10 * 60000) matches.delete(id); }, 60000);

http.createServer((_, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, connected: ready, matches: matches.size, live: [...matches.values()].filter((m) => m.inPlay).length, pushed, lastFrameAgoMs: lastFrameAt ? Date.now() - lastFrameAt : null, secretSet: Boolean(SECRET) }));
}).listen(Number(process.env.PORT) || 10000);
console.log("relay up ->", TARGET);
