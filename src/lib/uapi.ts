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
  stale?: boolean;
  matchOdds?: Market[];
  bookmakers?: Market[];
  fancy?: Market[];
  sportsbook?: Market[];
  error?: string;
};

export type Sport = { sportId: string; sportName: string };

const BASE = "/api/public/uapi";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { headers: { accept: "application/json" } });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function fetchSports() {
  return get<{ sports: Sport[] }>("sports");
}

export function fetchEvents(sportId: string, inPlay?: boolean) {
  const q = inPlay === true ? "?inPlay=1" : inPlay === false ? "?inPlay=0" : "";
  return get<EventsResponse>(`sports/${encodeURIComponent(sportId)}/events${q}`);
}

export function fetchOdds(sportId: string, exEventId: string) {
  return get<OddsResponse>(
    `sports/${encodeURIComponent(sportId)}/${encodeURIComponent(exEventId)}/odds`,
  );
}

export function fetchSessionToken() {
  return get<{ sessionToken: string }>("session");
}

export function embedUrl(kind: "player" | "scoreboard", sportId: string, exEventId: string, token: string) {
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
  return price >= 100 ? String(Math.round(price)) : price.toFixed(2).replace(/\.00$/, "");
}

export function fmtSize(size: number | undefined | null): string {
  if (!size) return "";
  if (size >= 1000000) return `${(size / 1000000).toFixed(1)}M`;
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
  return String(Math.round(size));
}

export function fmtInt(n: number | undefined | null): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n ?? 0));
}
