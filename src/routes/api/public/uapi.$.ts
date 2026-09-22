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


// exEventId -> event name, learned from successful events responses. The
// backup exchange keys matches by name, so this lets odds fail over too.
const eventNames = new Map<string, string>();
// normalized event name -> primary provider exEventId, so backup events keep
// the primary ids that live TV and the scoreboard are addressed by.
const primaryIdByName = new Map<string, string>();

async function rememberEventNames(text: string) {
  try {
    const { normalizeName } = await import("@/lib/skyfair.server");
    const parsed = JSON.parse(text) as { events?: { exEventId?: string; eventName?: string }[] };
    for (const e of parsed.events ?? []) {
      if (!e.exEventId || !e.eventName) continue;
      eventNames.set(String(e.exEventId), e.eventName);
      primaryIdByName.set(normalizeName(e.eventName), String(e.exEventId));
    }
  } catch {
    /* ignore */
  }
}

async function backupSports(splat: string) {
  const eventsMatch = /^sports\/([^/]+)\/events$/.exec(splat);
  const oddsMatch = /^sports\/([^/]+)\/([^/]+)\/odds$/.exec(splat);
  if (splat === "sports") {
    const { AURA_SPORTS } = await import("@/lib/aura.server");
    return Response.json({ sports: AURA_SPORTS }, { headers: { "cache-control": "no-store" } });
  }
  if (!eventsMatch && !oddsMatch) return null;


  // Failover order: primary (universeapi) handled by the caller, then the
  // live exchange socket feed (Dream), then the static backup.
  try {
    const aura = await import("@/lib/aura.server");
    if (eventsMatch) {
      const events = await aura.auraEvents(decodeURIComponent(eventsMatch[1]!));
      if (events.length) {
        return Response.json(
          { events, source: "aura", refreshedAt: new Date().toISOString() },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      }
    } else {
      const odds = await aura.auraOdds(
        decodeURIComponent(oddsMatch![1]!),
        decodeURIComponent(oddsMatch![2]!),
      );
      if (odds) return Response.json(odds, { status: 200, headers: { "cache-control": "no-store" } });
    }
  } catch {
    /* fall through to the secondary backup */
  }

  // Third source: The Odds API (free plan, heavily cached).
  try {
    const oa = await import("@/lib/oddsapi.server");
    if (eventsMatch) {
      const events = await oa.oddsApiEvents(decodeURIComponent(eventsMatch[1]!));
      if (events.length) {
        return Response.json(
          { events, source: "oddsapi", refreshedAt: new Date().toISOString() },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      }
    } else {
      const odds = await oa.oddsApiOdds(
        decodeURIComponent(oddsMatch![1]!),
        decodeURIComponent(oddsMatch![2]!),
      );
      if (odds) return Response.json(odds, { status: 200, headers: { "cache-control": "no-store" } });
    }
  } catch {
    /* fall through to the static backup */
  }

  try {

    const backup = await import("@/lib/skyfair.server");
    if (eventsMatch) {
      const events = await backup.backupEvents(decodeURIComponent(eventsMatch[1]!), (n) =>
        primaryIdByName.get(n),
      );
      if (!events.length) return null;
      return Response.json(
        { events, source: "backup", refreshedAt: new Date().toISOString() },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    const sportId = decodeURIComponent(oddsMatch![1]!);
    const exEventId = decodeURIComponent(oddsMatch![2]!);
    const odds = await backup.backupOdds(sportId, exEventId, eventNames.get(exEventId));
    if (!odds) return null;
    return Response.json(odds, { status: 200, headers: { "cache-control": "no-store" } });
  } catch {
    return null;
  }
}

type OddsPayload = {
  matchOdds?: {
    marketType?: string;
    runnersData?: Record<string, string>;
    oddsData?: { status?: string; runners?: { selectionId: string | number; status?: string }[] };
  }[];
  result?: string;
  inPlay?: boolean;
};

/**
 * The primary provider sometimes stops short of publishing the winner when a
 * match ends. Fill that in from the backup exchange so results settle live.
 */
async function mergeBackupResult(splat: string, text: string) {
  const m = /^sports\/([^/]+)\/([^/]+)\/odds$/.exec(splat);
  if (!m) return null;
  let payload: OddsPayload;
  try {
    payload = JSON.parse(text) as OddsPayload;
  } catch {
    return null;
  }
  const market = payload.matchOdds?.find((x) => (x.marketType ?? "MATCH_ODDS") === "MATCH_ODDS");
  const runners = market?.oddsData?.runners ?? [];
  const hasWinner = runners.some((r) => (r.status ?? "").toUpperCase() === "WINNER");
  const status = (market?.oddsData?.status ?? "").toUpperCase();
  const closed = /CLOSED|SETTLED|INACTIVE/.test(status) || payload.inPlay === false;
  if (hasWinner || !closed || !runners.length) return null;

  try {
    const sportId = decodeURIComponent(m[1]!);
    const exEventId = decodeURIComponent(m[2]!);
    const backup = await import("@/lib/skyfair.server");
    const alt = (await backup.backupOdds(sportId, exEventId, eventNames.get(exEventId))) as
      | (OddsPayload & { result?: string })
      | null;
    const winnerName = alt?.result;
    if (!winnerName) return null;
    const target = backup.normalizeName(winnerName);
    let matched = false;
    for (const r of runners) {
      const name = market?.runnersData?.[String(r.selectionId)] ?? "";
      const win = backup.normalizeName(name) === target;
      if (win) matched = true;
      r.status = win ? "WINNER" : "LOSER";
    }
    if (!matched) return null;
    if (market?.oddsData) market.oddsData.status = "CLOSED";
    payload.result = winnerName;
    payload.inPlay = false;
    return Response.json(payload, { status: 200, headers: { "cache-control": "no-store" } });
  } catch {
    return null;
  }
}

type PriceRow = { price?: number; size?: number };
type PricedRunner = {
  selectionId: string | number;
  status?: string;
  price?: { back?: PriceRow[]; lay?: PriceRow[] };
};
type PricedPayload = {
  eventName?: string;
  matchOdds?: {
    marketType?: string;
    runnersData?: Record<string, string>;
    oddsData?: { status?: string; runners?: PricedRunner[] };
  }[];
};

const liveDepth = (rows?: PriceRow[]) => (rows ?? []).some((r) => Number(r?.price) > 0);

/**
 * The upstream sports API is served by several cache generations, so polls
 * alternate between a fresh payload and an older one. That makes the board
 * flip back and forth instead of moving forward. `totalMatched` only ever
 * grows, so per market we keep the highest generation seen and reuse it
 * whenever a poll hands back an older one.
 */
type GenMarket = {
  marketId?: string;
  marketName?: string;
  oddsData?: { totalMatched?: number };
};
type GenPayload = Record<string, unknown> & {
  matchOdds?: GenMarket[];
  bookmakers?: GenMarket[];
  fancy?: GenMarket[];
  sportsbook?: GenMarket[];
};

const marketGenerations = new Map<string, { at: number; matched: number; market: GenMarket }>();

/** Suspended / closed / all-zero market — must always reach the board at once. */
function marketIsDead(market: unknown): boolean {
  const od = (market as { oddsData?: { status?: string; runners?: PricedRunner[] } })?.oddsData;
  if (!od) return false;
  const raw = String(od.status ?? "").toUpperCase();
  if (/SUSPEND|CLOSE|INACTIVE|SETTLE|RESULT|BALL/.test(raw)) return true;
  const runners = od.runners ?? [];
  if (!runners.length) return false;
  return !runners.some((r) => {
    const rs = String(r.status ?? "").toUpperCase();
    if (/SUSPEND|CLOSE|INACTIVE|REMOVED/.test(rs)) return false;
    return [...(r.price?.back ?? []), ...(r.price?.lay ?? [])].some((p) => Number(p?.price) > 0);
  });
}


function freshestMarkets(splat: string, text: string): string {
  if (!/^sports\/[^/]+\/[^/]+\/odds$/.test(splat)) return text;
  let payload: GenPayload;
  try {
    payload = JSON.parse(text) as GenPayload;
  } catch {
    return text;
  }
  let changed = false;
  const now = Date.now();

  // Total traded volume across the whole payload identifies the cache
  // generation: it only grows, so a lower total means the provider handed
  // back an older frame. Bookmaker / fancy / sportsbook prices froze because
  // those older frames kept overwriting the newest ones.
  const groups = ["matchOdds", "bookmakers", "fancy", "sportsbook"] as const;
  let score = 0;
  for (const group of groups) {
    for (const market of payload[group] ?? []) score += Number(market?.oddsData?.totalMatched ?? 0);
  }
  const genKey = `${splat}|__gen`;
  const bestGen = marketGenerations.get(genKey);
  const olderGeneration = Boolean(bestGen && score < bestGen.matched && now - bestGen.at < 15_000);
  if (!olderGeneration) marketGenerations.set(genKey, { at: now, matched: score, market: {} });

  for (const group of groups) {
    const list = payload[group];
    if (!Array.isArray(list)) continue;

    list.forEach((market, i) => {
      const id = market?.marketId ?? market?.marketName;
      if (!id) return;
      const key = `${splat}|${id}`;
      const matched = Number(market?.oddsData?.totalMatched ?? 0);
      const prev = marketGenerations.get(key);
      const older = prev && (olderGeneration ? matched <= prev.matched : matched < prev.matched);
      // A suspension (ball running / market closed) must never be held back by
      // the generation filter — the reference board suspends instantly.
      if (older && !marketIsDead(market) && now - prev.at < 25_000) {
        list[i] = prev.market;
        changed = true;
        return;
      }
      marketGenerations.set(key, { at: now, matched, market });
    });

  }
  if (marketGenerations.size > 4000) {
    for (const [k, v] of marketGenerations) if (now - v.at > 120_000) marketGenerations.delete(k);
  }
  return changed ? JSON.stringify(payload) : text;
}

/**
 * Normalise market status for API consumers (operators). The upstream feed can
 * report a market as OPEN while every runner price is zero/removed, which made
 * integrators show a bettable market that the reference board shows as
 * SUSPENDED. Emit an explicit status plus a `suspended` boolean.
 */
function normalizeStatuses(splat: string, text: string): string {
  if (!/^sports\/[^/]+\/[^/]+\/odds$/.test(splat)) return text;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
  type R = { status?: string; price?: { back?: { price?: number }[]; lay?: { price?: number }[] } };
  type M = {
    oddsData?: { status?: string; suspended?: boolean; runners?: R[] };
  };
  let changed = false;
  for (const group of ["matchOdds", "bookmakers", "fancy", "sportsbook"] as const) {
    const list = payload[group];
    if (!Array.isArray(list)) continue;
    for (const market of list as M[]) {
      const od = market?.oddsData;
      if (!od) continue;
      const raw = String(od.status ?? "OPEN").toUpperCase();
      const runners = od.runners ?? [];
      const hasPrice = runners.some((r) => {
        const rs = String(r.status ?? "").toUpperCase();
        if (/SUSPEND|CLOSE|INACTIVE|REMOVED/.test(rs)) return false;
        return [...(r.price?.back ?? []), ...(r.price?.lay ?? [])].some(
          (p) => Number(p?.price) > 0,
        );
      });
      const closed = /CLOSE|SETTLE|RESULT/.test(raw);
      const suspended =
        /SUSPEND|INACTIVE|BALL/.test(raw) || (!closed && runners.length > 0 && !hasPrice);

      const next = closed ? "CLOSED" : /BALL/.test(raw) ? "BALLRUN" : suspended ? "SUSPENDED" : raw;
      if (od.status !== next || od.suspended !== (closed || suspended)) {
        od.status = next;
        od.suspended = closed || suspended;
        changed = true;
      }
    }
  }
  return changed ? JSON.stringify(payload) : text;
}



/**
 * Keep the displayed exchange prices synchronized with the live backup feed.
 * The primary endpoint can return a valid-looking but delayed snapshot, so
 * waiting for zero prices leaves the board visibly behind the reference site.
 */
async function mergeBackupPrices(splat: string, text: string) {
  const m = /^sports\/([^/]+)\/([^/]+)\/odds$/.exec(splat);
  if (!m) return null;
  let payload: PricedPayload;
  try {
    payload = JSON.parse(text) as PricedPayload;
  } catch {
    return null;
  }
  const market = payload.matchOdds?.find((x) => (x.marketType ?? "MATCH_ODDS") === "MATCH_ODDS");
  const runners = market?.oddsData?.runners ?? [];
  if (!runners.length) return null;
  const status = (market?.oddsData?.status ?? "OPEN").toUpperCase();
  if (/CLOSED|SETTLED|INACTIVE/.test(status)) return null;

  try {
    const sportId = decodeURIComponent(m[1]!);
    const exEventId = decodeURIComponent(m[2]!);
    const backup = await import("@/lib/skyfair.server");
    const alt = (await backup.backupOdds(
      sportId,
      exEventId,
      payload.eventName ?? eventNames.get(exEventId),
    )) as PricedPayload | null;
    const altMarket = alt?.matchOdds?.[0];
    const altRunners = altMarket?.oddsData?.runners ?? [];
    if (!altRunners.length) return null;

    let filled = false;
    for (const r of runners) {
      const name = backup.normalizeName(market?.runnersData?.[String(r.selectionId)] ?? "");
      const hit = altRunners.find(
        (a) =>
          backup.normalizeName(altMarket?.runnersData?.[String(a.selectionId)] ?? "") === name,
      );
      if (!hit) continue;
      if (hit.price && (liveDepth(hit.price.back) || liveDepth(hit.price.lay))) {
        r.price = hit.price;
        filled = true;
      }

    }
    if (!filled) return null;
    return Response.json(payload, { status: 200, headers: { "cache-control": "no-store" } });
  } catch {
    return null;
  }
}


/**
 * Bookmaker / fancy / sportsbook straight from the live exchange socket.
 *
 * The primary provider republishes those markets from a slow cache: expired
 * fancy sessions (e.g. "19 Over Runs" after the over finished) keep hanging
 * around and ball-running suspensions arrive seconds late. The socket feed is
 * the same one the reference book renders, so for an event it knows we take
 * those groups from it verbatim.
 */
/**
 * Union the primary event list with the live socket feed, so a match that only
 * one of the two providers knows still shows on the board.
 */
async function withAuraEvents(splat: string, text: string): Promise<string> {
  const m = /^sports\/([^/]+)\/events$/.exec(splat);
  if (!m) return text;
  let payload: { events?: { exEventId?: string; eventName?: string }[] };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    return text;
  }
  if (!Array.isArray(payload.events)) return text;
  try {
    const aura = await import("@/lib/aura.server");
    const { normalizeName } = await import("@/lib/skyfair.server");
    const live = await aura.auraEvents(decodeURIComponent(m[1]!));
    if (!live.length) return text;
    const seen = new Set(
      payload.events.map((e) => normalizeName(String(e?.eventName ?? ""))).filter(Boolean),
    );
    const extra = live.filter(
      (e) => !seen.has(normalizeName(String((e as { eventName?: string }).eventName ?? ""))),
    );
    if (!extra.length) return text;
    payload.events = [...payload.events, ...(extra as typeof payload.events)];
    return JSON.stringify(payload);
  } catch {
    return text;
  }
}

async function withAuraMarkets(splat: string, text: string): Promise<string> {
  if (!/^sports\/[^/]+\/[^/]+\/odds$/.test(splat)) return text;
  const m = /^sports\/([^/]+)\/([^/]+)\/odds$/.exec(splat)!;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
  try {
    const aura = await import("@/lib/aura.server");
    const live = (await aura.auraOdds(
      decodeURIComponent(m[1]!),
      decodeURIComponent(m[2]!),
    )) as Record<string, unknown> | null;
    if (!live) return text;
    for (const group of ["matchOdds", "bookmakers", "fancy", "sportsbook"] as const) {
      const rows = live[group];
      // An empty live auxiliary group is meaningful: the provider has removed
      // the completed session. Match Odds is retained only during a brief
      // reconnect where that core group is absent.
      if (group !== "matchOdds" || (Array.isArray(rows) && rows.length)) {
        payload[group] = Array.isArray(rows) ? rows : [];
      }
    }
    return JSON.stringify(payload);
  } catch {
    return text;
  }
}

export async function proxy(splat: string, search: string, body?: string, origin = "") {

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
    const text = normalizeStatuses(
      splat,
      await withAuraMarkets(splat, freshestMarkets(splat, await res.text())),
    );


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
        const alt = await backupSports(splat);
        if (alt) return alt;
        const snap = snapshotResponse(snapshotKey, res.status);
        if (snap) return snap;
      }
      return Response.json(
        { error: `Upstream unavailable (${res.status})`, upstreamStatus: res.status },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    // Non-5xx failures (404 "Event not found", 4xx) also fail over to the
    // live exchange feed, which carries events the primary no longer knows.
    if (isSportsPath(splat) && !res.ok) {
      const alt = await backupSports(splat);
      if (alt) return alt;
    }
    if (isSportsPath(splat) && res.ok && text.startsWith("{")) {

      sportsSnapshot.set(snapshotKey, { at: Date.now(), text });
      if (/^sports\/[^/]+\/events$/.test(splat)) void rememberEventNames(text);
    }
    // Upstream answered 200 but with an empty/errored sports payload: fail over.
    if (isSportsPath(splat) && res.ok) {
      let emptySports = false;
      try {
        const parsed = JSON.parse(text) as {
          error?: string;
          events?: unknown[];
          matchOdds?: unknown[];
          bookmakers?: unknown[];
          fancy?: unknown[];
        };
        if (parsed.error) emptySports = true;
        else if (/^sports\/[^/]+\/events$/.test(splat))
          emptySports = Array.isArray(parsed.events) && parsed.events.length === 0;
        else if (/^sports\/[^/]+\/[^/]+\/odds$/.test(splat))
          emptySports =
            !parsed.matchOdds?.length && !parsed.bookmakers?.length && !parsed.fancy?.length;
      } catch {
        emptySports = true;
      }
      if (emptySports) {
        const alt = await backupSports(splat);
        if (alt) return alt;
      } else if (/^sports\/[^/]+\/[^/]+\/odds$/.test(splat)) {
        const merged = await mergeBackupResult(splat, text);
        if (merged) return merged;
        const priced = await mergeBackupPrices(splat, text);
        if (priced) return priced;
      }
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
      const alt = await backupSports(splat).catch(() => null);
      if (alt) return alt;
      const snap = snapshotResponse(snapshotKey, 0);
      if (snap) return snap;
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Upstream request failed", data: [] },
      { status: 200 },
    );
  }

}

// ---------------------------------------------------------------------------
// Hot live cache for sports odds/events.
//
// Integrators poll these paths many times per second. Hitting the provider on
// every single call cost ~180ms per request and rate-limited us, so prices
// looked "stuck". Instead we keep one background refresher per requested path
// that pulls the provider every 300ms while anyone is watching, and answer
// every caller instantly from that always-fresh frame.
// ---------------------------------------------------------------------------
type HotEntry = {
  at: number;
  text: string;
  contentType: string;
  lastAccess: number;
  timer: ReturnType<typeof setInterval> | null;
  inFlight: Promise<void> | null;
};

const hot = new Map<string, HotEntry>();
const HOT_REFRESH_MS = 250;
const HOT_IDLE_MS = 20_000;

function isHotPath(splat: string) {
  return /^sports\/[^/]+\/[^/]+\/odds$/.test(splat) || /^sports\/[^/]+\/events$/.test(splat);
}

async function refreshHot(key: string, splat: string, search: string) {
  const entry = hot.get(key);
  if (entry?.inFlight) return entry.inFlight;
  const run = (async () => {
    try {
      // Never reuse the browser's original cache-buster. A hot entry lives for
      // many refreshes, and replaying that same URL lets provider/CDN caches
      // return one frozen odds frame even though this loop is still running.
      const params = new URLSearchParams(search);
      params.set("_", String(Date.now()));
      const liveSearch = params.size ? `?${params.toString()}` : "";
      const res = await proxy(splat, liveSearch, undefined, "");
      const text = await res.text();
      if (!text) return;
      const prev = hot.get(key);
      hot.set(key, {
        at: Date.now(),
        text,
        contentType: res.headers.get("content-type") ?? "application/json",
        lastAccess: prev?.lastAccess ?? Date.now(),
        timer: prev?.timer ?? null,
        inFlight: null,
      });
    } catch {
      // keep the previous frame; the next tick retries
    } finally {
      const cur = hot.get(key);
      if (cur) cur.inFlight = null;
    }
  })();
  if (entry) entry.inFlight = run;
  await run;
}

function startHot(key: string, splat: string, search: string) {
  const entry = hot.get(key);
  if (entry?.timer) return;
  const timer = setInterval(() => {
    const cur = hot.get(key);
    if (!cur || Date.now() - cur.lastAccess > HOT_IDLE_MS) {
      if (cur?.timer) clearInterval(cur.timer);
      hot.delete(key);
      return;
    }
    void refreshHot(key, splat, search);
  }, HOT_REFRESH_MS);
  const cur = hot.get(key);
  if (cur) cur.timer = timer;
  else
    hot.set(key, {
      at: 0,
      text: "",
      contentType: "application/json",
      lastAccess: Date.now(),
      timer,
      inFlight: null,
    });
}

async function hotProxy(splat: string, search: string) {
  const key = sportsSnapshotKey(splat, search);
  const entry = hot.get(key);
  if (entry) entry.lastAccess = Date.now();
  if (!entry || !entry.text || Date.now() - entry.at > HOT_REFRESH_MS * 3) {
    await refreshHot(key, splat, search);
  }
  startHot(key, splat, search);
  const fresh = hot.get(key);
  if (!fresh?.text) return proxy(splat, search, undefined, "");
  fresh.lastAccess = Date.now();
  return new Response(fresh.text, {
    status: 200,
    headers: {
      "content-type": fresh.contentType,
      "cache-control": "no-store",
      "x-feed-age-ms": String(Date.now() - fresh.at),
    },
  });
}

export const Route = createFileRoute("/api/public/uapi/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        // Same-origin relative URLs: the worker's internal request origin can be
        // localhost, which the browser cannot load from inside the iframe.
        if (isHotPath(splat)) return hotProxy(splat, url.search);
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
