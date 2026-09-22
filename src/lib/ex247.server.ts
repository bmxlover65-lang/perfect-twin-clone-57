/**
 * Public exchange REST feed (api2.exchange24x7.live).
 *
 * The reference books (dukex and friends) read their Match Odds straight from
 * this host: it needs no key and ships the full Betfair ladder — three back and
 * three lay levels per runner. Our primary provider often returns a single,
 * sometimes all-zero, level, so we use this as the Match Odds source whenever
 * it knows the event.
 */

const BASE = "https://api2.exchange24x7.live/api/v1";

const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  origin: "https://dukex.biz",
  referer: "https://dukex.biz/",
};

type RawPrice = { price?: number; size?: number };
type RawRunnerOdds = {
  selectionId?: number | string;
  handicap?: number;
  status?: string;
  ex?: { availableToBack?: RawPrice[]; availableToLay?: RawPrice[] };
};
type RawMarketOdds = {
  marketId?: string;
  status?: string;
  inplay?: boolean;
  betDelay?: number;
  totalMatched?: number;
  runners?: RawRunnerOdds[];
};
type RawRunner = { selectionId?: number | string; runnerName?: string };
type RawMatch = {
  eventId?: string;
  eventName?: string;
  competitionId?: string;
  competitionName?: string;
  sportId?: number;
  openDate?: string;
  markets?: { marketId?: string; marketName?: string; runners?: RawRunner[] }[];
  matchOdds?: RawMarketOdds[] | null;
};

async function jget<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Loose name key so "India v West Indies" matches across providers. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(vs?|v\/s)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

type CompCache = { at: number; comps: string[] };
type MatchCache = { at: number; matches: RawMatch[] };

const comps = new Map<string, CompCache>();
const matches = new Map<string, MatchCache>();
/** name key -> competitionId, so a refresh costs one request, not a full scan. */
const compOfEvent = new Map<string, { comp: string; at: number }>();

const COMP_TTL = 10 * 60_000;
const MATCH_TTL = 2_500;
const MAP_TTL = 10 * 60_000;

async function competitions(sportId: string): Promise<string[]> {
  const hit = comps.get(sportId);
  if (hit && Date.now() - hit.at < COMP_TTL) return hit.comps;
  const data = await jget<{ data?: { competitionId?: string }[] }>(`get-legues/${sportId}`);
  const list = (data?.data ?? []).map((c) => String(c.competitionId ?? "")).filter(Boolean);
  if (list.length) comps.set(sportId, { at: Date.now(), comps: list });
  return list;
}

async function compMatches(sportId: string, comp: string): Promise<RawMatch[]> {
  const key = `${sportId}:${comp}`;
  const hit = matches.get(key);
  if (hit && Date.now() - hit.at < MATCH_TTL) return hit.matches;
  const data = await jget<{ data?: RawMatch[] }>(`get-matches/${sportId}/${comp}`);
  const rows = data?.data ?? [];
  matches.set(key, { at: Date.now(), matches: rows });
  return rows;
}

/** Scan every competition of a sport (bounded concurrency) and index by name. */
async function allMatches(sportId: string): Promise<RawMatch[]> {
  const list = await competitions(sportId);
  const out: RawMatch[] = [];
  const queue = [...list];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (;;) {
      const comp = queue.shift();
      if (!comp) return;
      const rows = await compMatches(sportId, comp);
      for (const m of rows) {
        out.push(m);
        const key = nameKey(String(m.eventName ?? ""));
        if (key && m.competitionId) {
          compOfEvent.set(`${sportId}:${key}`, { comp: String(m.competitionId), at: Date.now() });
        }
      }
    }
  });
  await Promise.all(workers);
  return out;
}

type Price = { price: number; size: number };
type Runner = {
  selectionId: string;
  status: string;
  handicap: number;
  price: { back: Price[]; lay: Price[] };
};
export type Ex247Market = {
  marketId: string;
  marketName: string;
  min: number;
  max: number;
  runnersData: Record<string, string>;
  oddsData: {
    status: string;
    inPlay: boolean;
    betDelay: number;
    totalMatched: number;
    runners: Runner[];
  };
};

function levels(rows: RawPrice[] | undefined): Price[] {
  return (rows ?? [])
    .slice(0, 3)
    .map((p) => ({ price: Number(p.price ?? 0), size: Number(p.size ?? 0) }))
    .filter((p) => p.price > 0);
}

function toMarkets(match: RawMatch): Ex247Market[] {
  const names = new Map<string, Record<string, string>>();
  const titles = new Map<string, string>();
  for (const m of match.markets ?? []) {
    const id = String(m.marketId ?? "");
    if (!id) continue;
    titles.set(id, String(m.marketName ?? "Match Odds"));
    const map: Record<string, string> = {};
    for (const r of m.runners ?? []) {
      if (r.selectionId != null) map[String(r.selectionId)] = String(r.runnerName ?? r.selectionId);
    }
    names.set(id, map);
  }

  const out: Ex247Market[] = [];
  for (const odds of match.matchOdds ?? []) {
    const id = String(odds.marketId ?? "");
    if (!id) continue;
    out.push({
      marketId: id,
      marketName: titles.get(id) ?? "Match Odds",
      min: 100,
      max: 500000,
      runnersData: names.get(id) ?? {},
      oddsData: {
        status: String(odds.status ?? "OPEN").toUpperCase(),
        inPlay: Boolean(odds.inplay),
        betDelay: Number(odds.betDelay ?? 0),
        totalMatched: Number(odds.totalMatched ?? 0),
        runners: (odds.runners ?? []).map((r) => ({
          selectionId: String(r.selectionId ?? ""),
          status: String(r.status ?? "ACTIVE").toUpperCase(),
          handicap: Number(r.handicap ?? 0),
          price: {
            back: levels(r.ex?.availableToBack),
            lay: levels(r.ex?.availableToLay),
          },
        })),
      },
    });
  }
  // Match Odds first, the rest in feed order.
  return out.sort((a, b) =>
    a.marketName === "Match Odds" ? -1 : b.marketName === "Match Odds" ? 1 : 0,
  );
}

/** Match Odds ladder for an event, looked up by its name. */
export async function ex247MatchOdds(
  sportId: string,
  eventName: string,
): Promise<Ex247Market[] | null> {
  const key = nameKey(eventName);
  if (!key) return null;

  const cached = compOfEvent.get(`${sportId}:${key}`);
  if (cached && Date.now() - cached.at < MAP_TTL) {
    const rows = await compMatches(sportId, cached.comp);
    const hit = rows.find((m) => nameKey(String(m.eventName ?? "")) === key);
    if (hit) return toMarkets(hit);
  }

  const all = await allMatches(sportId);
  const hit = all.find((m) => nameKey(String(m.eventName ?? "")) === key);
  return hit ? toMarkets(hit) : null;
}

export type Ex247Event = {
  sportId: string;
  exEventId: string;
  eventName: string;
  competitionName: string;
  openDate?: string;
  inPlay: boolean;
};

/** Every event this feed lists for a sport. */
export async function ex247Events(sportId: string): Promise<Ex247Event[]> {
  const all = await allMatches(sportId);
  return all
    .filter((m) => m.eventId && m.eventName)
    .map((m) => ({
      sportId,
      exEventId: `ex:${m.eventId}`,
      eventName: String(m.eventName),
      competitionName: String(m.competitionName ?? ""),
      openDate: m.openDate,
      inPlay: (m.matchOdds ?? []).some((o) => o?.inplay),
    }));
}
