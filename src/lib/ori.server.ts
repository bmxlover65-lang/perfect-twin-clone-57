/**
 * Direct exchange feed (ori.exchange24x7.live).
 *
 * One key-free REST host that serves the whole sports board in the exact shape
 * our app already consumes: sports catalog, event list (with inPlay + top of
 * book) and a single /markets call that returns Match Odds, Bookmaker, Fancy
 * and Sportsbook together, each with three back and three lay levels.
 *
 * Using it directly removes the session-token round trip, so the board reacts
 * within one refresh tick instead of lagging a second behind.
 */

const BASE = "https://ori.exchange24x7.live/api";

const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  origin: "https://dukex.biz",
  referer: "https://dukex.biz/",
};

async function jget<T>(path: string, timeoutMs = 5000): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Envelope<T> = { success?: boolean; data?: T };

type RawMarket = Record<string, unknown> & {
  marketId?: string;
  marketName?: string;
  oddsData?: { status?: string; inPlay?: boolean; betDelay?: number; totalMatched?: number };
};

type RawMarkets = {
  fancyData?: RawMarket[];
  matchOddsData?: RawMarket[];
  bookmakersData?: RawMarket[];
  sportsbookData?: RawMarket[];
  isScore?: boolean;
};

export async function oriSports(): Promise<{ sportId: string; sportName: string }[] | null> {
  const json = await jget<Envelope<{ sportId?: string; name?: string; sportName?: string }[]>>(
    "sports",
  );
  const rows = json?.data;
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows
    .filter((s) => s?.sportId)
    .map((s) => ({ sportId: String(s.sportId), sportName: String(s.sportName ?? s.name ?? "") }));
}

export async function oriEvents(
  sportId: string,
  inPlay?: boolean,
): Promise<Record<string, unknown>[] | null> {
  const q = inPlay === undefined ? "" : `?inPlay=${inPlay ? 1 : 0}`;
  const json = await jget<Envelope<Record<string, unknown>[]>>(
    `sports/${encodeURIComponent(sportId)}/events${q}`,
  );
  const rows = json?.data;
  if (!Array.isArray(rows)) return null;
  return rows;
}

/** Drop settled / voided markets so the board never shows a dead line. */
function live(rows: RawMarket[] | undefined): RawMarket[] {
  return (rows ?? []).filter(
    (m) => Number(m["isSettlement"] ?? 0) !== 1 && Number(m["isVoid"] ?? 0) !== 1,
  );
}

function bySequence(rows: RawMarket[]): RawMarket[] {
  return [...rows].sort((a, b) => Number(a["sequence"] ?? 0) - Number(b["sequence"] ?? 0));
}

export type OriOdds = {
  exEventId: string;
  eventName?: string;
  sportId: string;
  inPlay: boolean;
  isScore: boolean;
  betDelay: number;
  totalMatched: number;
  updatedAt: string;
  matchOdds: RawMarket[];
  bookmakers: RawMarket[];
  fancy: RawMarket[];
  sportsbook: RawMarket[];
};

export async function oriOdds(sportId: string, exEventId: string): Promise<OriOdds | null> {
  const { oriLiveFrame } = await import("./ori-live.server");
  const liveFrame = await oriLiveFrame(sportId, exEventId).catch(() => null);
  let raw: RawMarkets | undefined;
  if (liveFrame) {
    const f = liveFrame as Record<string, RawMarket[] | boolean | undefined>;
    raw = {
      matchOddsData: f["betfair"] as RawMarket[],
      bookmakersData: f["bookmakers"] as RawMarket[],
      fancyData: f["fancy"] as RawMarket[],
      sportsbookData: (f["sportsbook"] ?? f["sportsBook"]) as RawMarket[],
      isScore: Boolean(f["isScore"]),
    };
  } else {
    const json = await jget<Envelope<{ data?: RawMarkets }>>(
      `sports/${encodeURIComponent(sportId)}/${encodeURIComponent(exEventId)}/markets`,
    );
    raw = json?.data?.data;
  }
  if (!raw) return null;

  const matchOdds = bySequence(live(raw.matchOddsData));
  const bookmakers = bySequence(live(raw.bookmakersData));
  const fancy = bySequence(live(raw.fancyData));
  const sportsbook = bySequence(live(raw.sportsbookData));
  if (!matchOdds.length && !bookmakers.length && !fancy.length && !sportsbook.length) return null;

  const head = matchOdds[0] ?? bookmakers[0];
  return {
    exEventId,
    eventName: String((head?.["eventName"] as string) ?? ""),
    sportId,
    inPlay: Boolean(head?.oddsData?.inPlay),
    isScore: Boolean(raw.isScore),
    betDelay: Number(head?.oddsData?.betDelay ?? 0),
    totalMatched: Number(head?.oddsData?.totalMatched ?? 0),
    updatedAt: new Date().toISOString(),
    matchOdds,
    bookmakers,
    fancy,
    sportsbook,
  };
}
