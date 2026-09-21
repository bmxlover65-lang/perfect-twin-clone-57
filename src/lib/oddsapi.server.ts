/**
 * The Odds API (the-odds-api.com) — last-resort sports source.
 *
 * Free plan: 500 credits/month, so every upstream call is cached aggressively
 * and this source only runs when the primary feed AND the socket feed both
 * fail. One call to /v4/sports/upcoming/odds returns the next upcoming games
 * across all sports, which we group into our sportIds.
 */

const BASE = "https://api.the-odds-api.com/v4";
const CACHE_MS = 10 * 60 * 1000; // 10 minutes per upstream call

type AnyRec = Record<string, unknown>;

type OAOutcome = { name?: string; price?: number };
type OAMarket = { key?: string; outcomes?: OAOutcome[] };
type OABookmaker = { key?: string; title?: string; markets?: OAMarket[] };
type OAGame = {
  id?: string;
  sport_key?: string;
  sport_title?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: OABookmaker[];
};

const SPORT_ID_BY_KEY: [RegExp, string][] = [
  [/^cricket/i, "4"],
  [/^soccer/i, "1"],
  [/^tennis/i, "2"],
  [/^basketball/i, "7522"],
  [/horse/i, "7"],
  [/greyhound/i, "4339"],
  [/politic/i, "2378961"],
];

function mapSportId(sportKey: string): string | null {
  for (const [re, id] of SPORT_ID_BY_KEY) if (re.test(sportKey)) return id;
  return null;
}

let cache: { at: number; games: OAGame[] } | null = null;
let inflight: Promise<OAGame[]> | null = null;

async function pull(): Promise<OAGame[]> {
  const key = process.env["ODDS_API_KEY"];
  if (!key) return [];
  const url =
    `${BASE}/sports/upcoming/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${encodeURIComponent(key)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    return Array.isArray(json) ? (json as OAGame[]) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function games(): Promise<OAGame[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.games;
  if (!inflight) {
    inflight = pull()
      .then((list) => {
        if (list.length) cache = { at: Date.now(), games: list };
        return cache?.games ?? [];
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function bestPrices(game: OAGame): Map<string, number> {
  const best = new Map<string, number>();
  for (const bm of game.bookmakers ?? []) {
    for (const market of bm.markets ?? []) {
      if (market.key !== "h2h") continue;
      for (const outcome of market.outcomes ?? []) {
        const name = String(outcome.name ?? "");
        const price = Number(outcome.price);
        if (!name || !Number.isFinite(price)) continue;
        const prev = best.get(name);
        if (prev === undefined || price > prev) best.set(name, price);
      }
    }
  }
  return best;
}

function runnersOf(game: OAGame) {
  const best = bestPrices(game);
  const names = [game.home_team, game.away_team]
    .filter((n): n is string => Boolean(n))
    .concat([...best.keys()].filter((n) => n !== game.home_team && n !== game.away_team));
  const seen = new Set<string>();
  return names
    .filter((n) => (seen.has(n) ? false : (seen.add(n), true)))
    .map((name) => ({
      selectionId: name,
      status: "ACTIVE",
      handicap: 0,
      backPrice: best.get(name) ?? 0,
      backSize: 0,
      layPrice: 0,
      laySize: 0,
    }));
}

function runnersDataOf(runners: { selectionId: string }[]) {
  const map: Record<string, string> = {};
  for (const r of runners) map[r.selectionId] = r.selectionId;
  return Object.keys(map).length ? map : null;
}

function toEvent(game: OAGame, sportId: string) {
  const runners = runnersOf(game);
  const commence = String(game.commence_time ?? "");
  const inPlay = commence ? Date.parse(commence) <= Date.now() : false;
  return {
    sportId,
    sportName: String(game.sport_title ?? ""),
    exEventId: `oa:${String(game.id ?? "")}`,
    eventName:
      game.home_team && game.away_team
        ? `${game.home_team} v ${game.away_team}`
        : String(game.sport_title ?? "Match"),
    marketName: "Match Odds",
    tournamentName: String(game.sport_title ?? ""),
    eventTime: commence,
    inPlay,
    status: "OPEN",
    tv: false,
    isScore: false,
    isFancy: false,
    isBookmakers: false,
    isSportsbook: false,
    isStreaming: false,
    totalMatched: 0,
    betDelay: 0,
    runnersData: runnersDataOf(runners),
    runners,
  };
}

/** Match list for one sport, shaped like the app's UEvent. */
export async function oddsApiEvents(sportId: string): Promise<AnyRec[]> {
  const list = await games();
  const events = list
    .filter((g) => mapSportId(String(g.sport_key ?? "")) === sportId)
    .map((g) => toEvent(g, sportId));
  events.sort((a, b) => {
    if (a.inPlay !== b.inPlay) return a.inPlay ? -1 : 1;
    return (a.eventTime || "").localeCompare(b.eventTime || "");
  });
  return events;
}

/** Match Odds payload for one event, shaped like the app's OddsResponse. */
export async function oddsApiOdds(sportId: string, exEventId: string): Promise<AnyRec | null> {
  const id = exEventId.startsWith("oa:") ? exEventId.slice(3) : exEventId;
  const list = await games();
  const game = list.find((g) => String(g.id ?? "") === id);
  if (!game) return null;
  const runners = runnersOf(game);
  const commence = String(game.commence_time ?? "");
  const inPlay = commence ? Date.parse(commence) <= Date.now() : false;
  return {
    exEventId,
    eventName:
      game.home_team && game.away_team
        ? `${game.home_team} v ${game.away_team}`
        : String(game.sport_title ?? "Match"),
    sportId,
    inPlay,
    tv: false,
    isScore: false,
    betDelay: 0,
    totalMatched: 0,
    updatedAt: new Date().toISOString(),
    matchOdds: [
      {
        marketId: `oa-${id}`,
        marketName: "Match Odds",
        marketType: "MATCH_ODDS",
        runnersData: runnersDataOf(runners),
        oddsData: {
          status: "OPEN",
          inPlay,
          betDelay: 0,
          totalMatched: 0,
          runners: runners.map((r) => ({
            selectionId: r.selectionId,
            status: r.status,
            handicap: 0,
            price: {
              back: r.backPrice ? [{ price: r.backPrice, size: 0 }] : [],
              lay: [],
            },
          })),
        },
      },
    ],
    bookmakers: [],
    fancy: [],
    sportsbook: [],
  };
}
