export type RunnerLite = {
  selectionId: string | number;
  status: string;
  handicap: number;
  backPrice: number;
  backSize: number;
  layPrice: number;
  laySize: number;
};

export type UEvent = {
  sportId: string;
  sportName?: string;
  exEventId: string;
  eventName: string;
  marketName?: string;
  tournamentName?: string;
  eventTime?: string;
  inPlay: boolean;
  status?: string;
  tv?: boolean;
  isScore?: boolean;
  isFancy?: boolean;
  isBookmakers?: boolean;
  isSportsbook?: boolean;
  isStreaming?: boolean;
  totalMatched?: number;
  betDelay?: number;
  runnersData?: Record<string, string> | null;
  runners?: RunnerLite[];
};

export type EventsResponse = {
  refreshedAt?: string;
  ttlSec?: number;
  events: UEvent[];
  error?: string;
};

export type PricePoint = { price: number; size: number };

export type OddsRunner = {
  selectionId: string | number;
  status: string;
  handicap?: number;
  price?: { back?: PricePoint[]; lay?: PricePoint[] };
};

export type Market = {
  marketId: string;
  marketName: string;
  marketType?: string;
  min?: number;
  max?: number;
  runnersData?: Record<string, string> | null;
  oddsData?: {
    status?: string;
    inPlay?: boolean;
    betDelay?: number;
    totalMatched?: number;
    runners?: OddsRunner[];
  };
};

export type OddsResponse = {
  exEventId?: string;
  eventName?: string;
  sportId?: string;
  inPlay?: boolean;
  tv?: boolean;
  isScore?: boolean;
  betDelay?: number;
  totalMatched?: number;
  updatedAt?: string;
  openDate?: string;
  stale?: boolean;
  matchOdds?: Market[];
  bookmakers?: Market[];
  fancy?: Market[];
  sportsbook?: Market[];
  error?: string;
};

export type Sport = { sportId: string; sportName: string };

const BASE = "/api/public/uapi";

async function get<T>(path: string, live = false, timeoutMs = live ? 6000 : 15000): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = live ? `${BASE}/${path}${separator}_=${Date.now()}` : `${BASE}/${path}`;
  // A request that never answers (weak mobile network) used to block every
  // later poll, freezing the board on old cards. Give up after 6s so the
  // next poll can run.
  let res: Response;
  try {
    res = await fetch(url, {
      cache: live ? "no-store" : "default",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "application/json",
        ...(live ? { "cache-control": "no-cache" } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live feed reconnecting";
    throw new Error(/abort|signal timed out|timeout/i.test(message) ? "Live feed reconnecting" : message);
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function fetchSports() {
  return get<{ sports: Sport[] }>("sports");
}

export function fetchEvents(sportId: string, inPlay?: boolean) {
  const q = inPlay === true ? "?inPlay=1" : inPlay === false ? "?inPlay=0" : "";
  return get<EventsResponse>(`sports/${encodeURIComponent(sportId)}/events${q}`, true);
}

export function fetchOdds(sportId: string, exEventId: string) {
  return get<OddsResponse>(
    `sports/${encodeURIComponent(sportId)}/${encodeURIComponent(exEventId)}/odds`,
    true,
  );
}

export async function sportsSocketUrl(sportId: string, exEventId: string) {
  const { sessionToken } = await fetchSessionToken();
  const params = new URLSearchParams({ sportId, exEventId, sessionToken });
  return `wss://universeapi.shop/public/ws/sports?${params.toString()}`;
}

export function fetchSessionToken() {
  return get<{ sessionToken: string }>("session");
}

export type ProxyHealth = {
  ok: boolean;
  keyConfigured: boolean;
  authMode: "b2b-api-key" | "public-session";
  latencyMs: number;
  upstream: string;
  checkedAt: string;
  error?: string;
};

export function fetchProxyHealth() {
  return get<ProxyHealth>("health");
}


export function embedUrl(kind: "tv" | "player" | "scoreboard", sportId: string, exEventId: string, token: string) {
  const q = new URLSearchParams({ sportId, exEventId, tv: "true", sessionToken: token });
  return `https://universeapi.shop/public/tv/sports/${kind}?${q.toString()}`;
}

export function runnerName(market: Market | UEvent, selectionId: string | number): string {
  const map = market.runnersData;
  const key = String(selectionId);
  if (map && typeof map === "object" && map[key]) return map[key];
  return key;
}

export function fmtOdds(price: number | undefined | null): string {
  if (!price) return "—";
  const v = Math.round(price * 100) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}


export function fmtSize(size: number | undefined | null): string {
  if (!size) return "";
  const n = Math.round(size);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}



export function fmtInt(n: number | undefined | null): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n ?? 0));
}

/* ---------------- Casino (live games) ---------------- */

export type CasinoGame = { eventId: string; eventName: string };

export type CasinoRunner = {
  selectionId: string;
  status?: string;
  price?: { back?: PricePoint[]; lay?: PricePoint[] };
};

export type CasinoMarket = {
  marketId: string;
  marketName: string;
  min?: number;
  max?: number;
  index?: number;
  runners?: CasinoRunner[];
  runnersName?: Record<string, string> | null;
};

export type CasinoCard = Record<string, string>;

export type CasinoState = {
  eventId?: string;
  freshnessMs?: number;
  stale?: boolean;
  data?: {
    roundId?: string;
    eventId?: string;
    eventName?: string;
    status?: string;
    roundStatus?: string;
    leftSec?: number;
    betDelay?: number;
    updatedAt?: string;
    marketArr?: CasinoMarket[];
    cardsArr?: Record<string, CasinoCard> | CasinoCard | null;
    gameResult?: string | null;
  } | null;
  error?: string;
};

export type CasinoResult = {
  roundId: string;
  eventId: string;
  eventName?: string;
  winner?: string;
  cards?: Record<string, CasinoCard>;
  results?: {
    marketId: string;
    marketName: string;
    index?: number;
    runners?: Record<string, string>;
    runnersName?: Record<string, string>;
  }[];
};

export function fetchCasinoGames() {
  return get<{ games: CasinoGame[] }>("games");
}

export function fetchCasinoState(eventId: string) {
  // live=true: cache-buster + no-store so suspension/result frames are never
  // served from an intermediate cache (that showed up as a 1-2s lag).
  // A cold live-table connection includes the exchange handshake before its
  // first frame. Give that first request enough time to complete.
  return get<CasinoState>(`games/${encodeURIComponent(eventId)}/state`, true, 15000);
}

export function fetchCasinoResults(eventId: string) {
  return get<{ data: CasinoResult[] }>(`games/${encodeURIComponent(eventId)}/results`, true);
}

export async function fetchCasinoStream(eventId: string) {
  const res = await fetch(`${BASE}/tv/streaming`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ eventId }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    upstreamIframeUrl?: string;
    playerUrl?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `Stream request failed (${res.status})`);
  return json;
}
