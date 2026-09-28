import { createFileRoute } from "@tanstack/react-router";
import { oriEvents, oriOdds, oriSports } from "@/lib/ori.server";
import { ucasResults, ucasState } from "@/lib/ucas.server";

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
        // A stalled primary must never hold the live board hostage; the socket
        // feed takes over as soon as this aborts.
        signal: AbortSignal.timeout(5000),
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

const STREAM_HOSTS = /(^|\.)(diamondtech\.shop|livestream11\.com|xfeed247\.live|zfeed247\.live|feed247\.live|exchange24x7\.live)$/i;

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
  // Each provider whitelists a different client site; send the one it expects.
  const referer = /exchange24x7\.live$/i.test(target.hostname)
    ? "https://dukex.biz/"
    : STREAM_REFERER;
  const doFetch = () =>
    fetch(target.toString(), {
      method,
      redirect: "follow",
      headers: {
        referer,
        origin: referer.replace(/\/$/, ""),
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
      // Fancy and thin Bookmaker markets often have no matched-volume counter.
      // Their prices still move, so never freeze a zero-volume frame behind
      // the generation guard.
      const comparableVolume = matched > 0 && (prev?.matched ?? 0) > 0;
      const older = prev && comparableVolume && (olderGeneration ? matched <= prev.matched : matched < prev.matched);
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
 * Sports now come straight from the exchange host: one key-free call per path,
 * no session round trip, all market groups (match odds / bookmaker / over-under
 * / fancy / sportsbook) in the same frame so they can never drift apart.
 * Anything it cannot answer falls through to the old upstream chain below.
 */
async function oriResponse(splat: string, search: string): Promise<Response | null> {
  const jsonOut = (payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  if (splat === "sports") {
    const sports = await oriSports();
    return sports ? jsonOut({ sports }) : null;
  }

  const ev = /^sports\/([^/]+)\/events$/.exec(splat);
  if (ev) {
    const q = new URLSearchParams(search).get("inPlay");
    const inPlay = q === null || q === "" ? undefined : q === "1" || q === "true";
    const events = await oriEvents(decodeURIComponent(ev[1]!), inPlay);
    if (!events) return null;
    return jsonOut({ refreshedAt: new Date().toISOString(), ttlSec: 1, events });
  }

  const od = /^sports\/([^/]+)\/([^/]+)\/odds$/.exec(splat);
  if (od) {
    const data = await oriOdds(decodeURIComponent(od[1]!), decodeURIComponent(od[2]!));
    return data ? jsonOut(data) : null;
  }

  // Integrators poll the exchange-compatible /markets path. It used to fall
  // through to the slow upstream chain and hang, which left partner sites
  // (e.g. Swaraj247) serving old rates. Answer it from the same live frame
  // as /odds, in the exchange envelope shape.
  const mk = /^sports\/([^/]+)\/([^/]+)\/markets$/.exec(splat);
  if (mk) {
    const sid = decodeURIComponent(mk[1]!);
    const eid = decodeURIComponent(mk[2]!);
    const data = await oriOdds(sid, eid);
    // A stale live frame still lists fancy sessions that already finished
    // (e.g. "49 Over Runs" after the innings ended). The exchange's own
    // market list is authoritative for which markets still exist.
    type Rows = Record<string, unknown>[];
    type RestM = { matchOddsData?: Rows; bookmakersData?: Rows; fancyData?: Rows; sportsbookData?: Rows; isScore?: boolean };
    let rest = null as RestM | null;
    if (!data || data.stale) {
      try {
        const r = await fetch(`https://ori.exchange24x7.live/api/sports/${encodeURIComponent(sid)}/${encodeURIComponent(eid)}/markets`, {
          headers: { accept: "application/json", origin: "https://dukex.biz", referer: "https://dukex.biz/" },
          cache: "no-store",
          signal: AbortSignal.timeout(1500),
        });
        if (r.ok) rest = ((await r.json()) as { data?: { data?: RestM } })?.data?.data ?? null;
      } catch { /* keep live frame */ }
    }
    if (!data && !rest) return null;
    const alive = (rows?: Rows) => (rows ?? []).filter((m) =>
      Number(m["isSettlement"] ?? 0) !== 1 && Number(m["isVoid"] ?? 0) !== 1 &&
      Number(m["isClosed"] ?? 0) !== 1 &&
      !/CLOSE|SETTLE|RESULT|REMOVED/i.test(String((m["oddsData"] as { status?: string } | undefined)?.status ?? "")));
    return jsonOut({
      data: {
        matchOddsData: rest ? alive(rest.matchOddsData) : data!.matchOdds,
        bookmakersData: rest ? alive(rest.bookmakersData) : data!.bookmakers,
        // A failed membership check must never advertise an expired session
        // from an old exchange frame as an active fancy market.
        fancyData: rest ? alive(rest.fancyData) : data?.stale ? [] : alive(data?.fancy as Rows | undefined),
        sportsbookData: rest ? alive(rest.sportsbookData) : data!.sportsbook,
        isScore: rest ? Boolean(rest.isScore) : data!.isScore,
      },
      updatedAt: data?.updatedAt ?? "",
      stale: data?.stale ?? true,
    });
  }

  return null;
}

export async function proxy(splat: string, search: string, body?: string, origin = "") {

  const snapshotKey = sportsSnapshotKey(splat, search);
  try {
    if (body === undefined && /^sports(\/|$)/.test(splat)) {
      const direct = await oriResponse(splat, search);
      if (direct) {
        if (isSportsPath(splat)) {
          const text = await direct.clone().text();
          sportsSnapshot.set(snapshotKey, { at: Date.now(), text });
          if (/^sports\/[^/]+\/events$/.test(splat)) void rememberEventNames(text);
        }
        return direct;
      }
    }
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

    // Casino live state now comes from the key-free exchange socket gateway.
    // The old provider put its casino feed behind auth, so this is the primary
    // source; the upstream chain below stays as a fallback.
    const stateMatch = /^games\/([^/]+)\/state$/.exec(splat);
    if (stateMatch && body === undefined) {
      const eventId = decodeURIComponent(stateMatch[1]!);
      const live = await ucasState(eventId);
      if (live?.data) {
        // Timer over = card is coming out: the board must show suspended even
        // if the table's own status frame is a moment late.
        let data = live.data as { leftSec?: number; status?: string; marketArr?: { runners?: { status?: string }[] | undefined }[] | undefined };
        // A table frame older than 5s is not live: never let players bet on it.
        const timerOver = typeof data.leftSec === "number" && data.leftSec <= 0;
        if ((timerOver || live.freshnessMs > 5000) && !/SUSPEND/i.test(String(data.status ?? ""))) {
          data = {
            ...data,
            status: "SUSPEND",
            marketArr: data.marketArr?.map((m) => ({
              ...m,
              runners: m.runners?.map((r) => ({ ...r, status: "SUSPEND" })),
            })),
          };
        }
        const payload = {
          eventId,
          freshnessMs: live.freshnessMs,
          stale: live.freshnessMs > 5000,
          data,
        };
        const text = JSON.stringify(payload);
        sportsSnapshot.set(snapshotKey, { at: Date.now(), text });
        return new Response(text, {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
    }

    let token = await Promise.race([
      getToken().catch(() => ""),
      new Promise<string>((r) => setTimeout(() => r(""), 2000)),
    ]);
    const preMatch = /^games\/([^/]+)\/results$/.exec(splat);
    if (preMatch) {
      const eventId = decodeURIComponent(preMatch[1]!);
      // official results mirror is the source of truth for casino events
      const data = await mirrorResults(eventId);
      if (data.length) {
        return Response.json(
          { data, source: "mirror" },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      }
      const live = await ucasResults(eventId);
      if (live.length) {
        return Response.json(
          { data: live, source: "socket" },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      }
    }
    // The old casino provider sometimes hangs for 10s+; never let a casino
    // page wait on it. Answer from the last good copy (or a clear error) fast.
    let res: Response;
    if (/^games(\/|$)/.test(splat) && body === undefined) {
      const timed = await Promise.race([
        upstream(splat, search, token, body).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 3000)),
      ]);
      if (!timed) {
        const snap = snapshotResponse(snapshotKey, 504);
        if (snap) return snap;
        return Response.json(
          stateMatch
            ? { eventId: decodeURIComponent(stateMatch[1]!), stale: true, data: { status: "SUSPEND", marketArr: [] } }
            : splat === "games"
              ? { games: [], stale: true, upstreamStatus: 504 }
              : { data: [], stale: true, upstreamStatus: 504 },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      }
      res = timed;
    } else {
      res = await upstream(splat, search, token, body);
    }

    if (res.status === 401 || res.status === 403) {
      token = await getToken(true);
      res = await upstream(splat, search, token, body);
    }
    const text = normalizeStatuses(splat, freshestMarkets(splat, await res.text()));


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
      if (/^sports\/[^/]+\/events$/.test(splat)) void rememberEventNames(text);
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
  // Odds skip this per-copy cache: each copy held its own old frame. Odds now
  // read the shared newest frame (database watermark) on every request.
  return /^sports\/[^/]+\/events$/.test(splat);
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
      // A cached fallback is not a successful refresh. Preserve its original
      // exchange timestamp, rather than resetting the age on each 250ms tick.
      let sourceAt = Date.now();
      if (/^sports\/[^/]+\/[^/]+\/odds$/.test(splat)) {
        try {
          const payload = JSON.parse(text) as { updatedAt?: string; stale?: boolean };
          const stamped = Date.parse(payload.updatedAt ?? "");
          if (Number.isFinite(stamped)) sourceAt = stamped;
        } catch { /* provider response may not be JSON */ }
      }
      // Never let an older exchange frame replace a newer one.
      if (prev?.text && sourceAt < prev.at) return;
      hot.set(key, {
        at: sourceAt,
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
  const isOdds = /^sports\/[^/]+\/[^/]+\/odds$/.test(splat);
  if (!entry || !entry.text) {
    await Promise.race([refreshHot(key, splat, search), new Promise((r) => setTimeout(r, 4000))]);
  } else if (isOdds && Date.now() - entry.at > 3_000) {
    // This isolate's copy is old (other isolates may hold newer ticks). Wait
    // briefly for a real refresh instead of replaying a minutes-old frame.
    await Promise.race([refreshHot(key, splat, search), new Promise((r) => setTimeout(r, 2500))]);
  } else if (Date.now() - entry.at > HOT_REFRESH_MS * 3) {
    void refreshHot(key, splat, search);
  }
  startHot(key, splat, search);
  const fresh = hot.get(key);
  if (!fresh?.text) return proxy(splat, search, undefined, "");
  fresh.lastAccess = Date.now();
  let text = fresh.text;
  const age = Date.now() - fresh.at;
  if (/^sports\/[^/]+\/[^/]+\/odds$/.test(splat) && age > 5_000) {
    try {
      text = JSON.stringify({ ...JSON.parse(text) as Record<string, unknown>, stale: true });
    } catch { /* keep the original provider response */ }
  }
  return new Response(text, {
    status: 200,
    headers: {
      "content-type": fresh.contentType,
      "cache-control": "no-store",
      "x-feed-age-ms": String(age),
    },
  });
}

let lastCasinoSettle = 0;

export const Route = createFileRoute("/api/public/uapi/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        // Any open casino table keeps polling state; use that heartbeat to pay
        // out finished rounds right away (no refresh / cron wait needed).
        if (/^games\/[^/]+\/state$/.test(splat) && Date.now() - lastCasinoSettle > 5000) {
          lastCasinoSettle = Date.now();
          void import("@/lib/casino-autosettle.server")
            .then((m) => m.autoSettleCasino(url.origin))
            .catch(() => undefined);
        }
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
