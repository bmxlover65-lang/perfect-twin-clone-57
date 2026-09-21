/**
 * Royal exchange events feed (extra sports source).
 *
 * Pulls the same event list the Royal site's sports page uses:
 *   POST /api/exchange/market/matchodds/allEventsList   body: {"key":"2"}
 * Response: { data: { "<bucket>": RoyalEvent[] }, meta: { status_code: 200 } }
 *
 * The domain is unreachable from some networks, so every caller must treat a
 * failure as "no data" and fall through to the socket feed (aura.server.ts).
 */

const ROYAL_BASES = [
  "https://royal444.com",
  "https://www.royal444.com",
  "https://royall444.com",
  "https://www.royall444.com",
];

const ROYAL_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-A556B) AppleWebKit/537.36 (KHTML, like Gecko) Edg/153.0.0.0 Mobile Safari/537.36";

type AnyRec = Record<string, unknown>;

/** Royal bucket sportId -> our sportId (Betfair-style ids already match). */
const SPORT_ID_BY_NAME: [RegExp, string][] = [
  [/cricket/i, "4"],
  [/soccer|football/i, "1"],
  [/tennis/i, "2"],
  [/horse/i, "7"],
  [/greyhound/i, "4339"],
  [/basketball/i, "7522"],
  [/politic/i, "2378961"],
];
const KNOWN_SPORT_IDS = new Set(["1", "2", "4", "7", "4339", "7522", "2378961"]);

function mapSportId(rawId: unknown, sportName: unknown): string {
  const id = String(rawId ?? "");
  if (KNOWN_SPORT_IDS.has(id)) return id;
  const name = String(sportName ?? "");
  for (const [re, mapped] of SPORT_ID_BY_NAME) if (re.test(name)) return mapped;
  return id;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

let cache: { at: number; bySport: Map<string, AnyRec[]>; raw: Map<string, AnyRec> } | null = null;
let inflight: Promise<void> | null = null;

async function pull(): Promise<void> {
  let lastErr: unknown = null;
  for (const base of ROYAL_BASES) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${base}/api/exchange/market/matchodds/allEventsList`, {
        method: "POST",
        cache: "no-store",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": ROYAL_UA,
          referer: `${base}/`,
          origin: base,
        },
        body: JSON.stringify({ key: "2" }),
      }).finally(() => clearTimeout(timer));
      const json = (await res.json().catch(() => ({}))) as {
        data?: Record<string, AnyRec[]>;
        meta?: { status_code?: number; status?: boolean };
      };
      if (!res.ok || !json.data || typeof json.data !== "object") {
        lastErr = new Error(`Royal events HTTP ${res.status}`);
        continue;
      }
      const bySport = new Map<string, AnyRec[]>();
      const raw = new Map<string, AnyRec>();
      for (const list of Object.values(json.data)) {
        if (!Array.isArray(list)) continue;
        for (const ev of list) {
          if (!ev || typeof ev !== "object") continue;
          const sportId = mapSportId(ev["sportId"], ev["sportName"]);
          const exEventId = String(ev["exEventId"] ?? ev["_id"] ?? "");
          if (!exEventId) continue;
          let bucket = bySport.get(sportId);
          if (!bucket) {
            bucket = [];
            bySport.set(sportId, bucket);
          }
          bucket.push(ev);
          raw.set(exEventId, ev);
        }
      }
      cache = { at: Date.now(), bySport, raw };
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Royal events unavailable");
}

async function fresh(): Promise<typeof cache> {
  if (cache && Date.now() - cache.at < 3000) return cache;
  if (!inflight) {
    inflight = pull()
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
  }
  await inflight;
  return cache;
}

function priceRows(side: unknown): { price: number; size: number }[] {
  if (!Array.isArray(side)) return [];
  const rows: { price: number; size: number }[] = [];
  for (const cell of side) {
    if (Array.isArray(cell)) {
      rows.push({ price: num(cell[0]), size: num(cell[1]) });
    } else if (cell && typeof cell === "object") {
      const c = cell as AnyRec;
      rows.push({ price: num(c["price"] ?? c["odds"]), size: num(c["size"] ?? c["volume"]) });
    }
  }
  return rows.filter((r) => r.price > 0);
}

function runnersOf(ev: AnyRec): AnyRec[] {
  const odds = (ev["oddsData"] as AnyRec | undefined) ?? {};
  const list = Array.isArray(odds["runners"]) ? (odds["runners"] as AnyRec[]) : [];
  return list.map((r) => {
    const price = (r["price"] as AnyRec | undefined) ?? {};
    const back = priceRows(price["back"] ?? r["back"]);
    const lay = priceRows(price["lay"] ?? r["lay"]);
    return {
      selectionId: String(r["selectionId"] ?? ""),
      runnerName: String(r["runnerName"] ?? r["name"] ?? ""),
      status: String(r["status"] ?? "ACTIVE"),
      backPrice: back[0]?.price ?? 0,
      layPrice: lay[0]?.price ?? 0,
      price: { back, lay },
    };
  });
}

function runnersDataOf(runners: AnyRec[]): Record<string, string> | null {
  const map: Record<string, string> = {};
  for (const r of runners) {
    if (r["selectionId"] && r["runnerName"]) map[String(r["selectionId"])] = String(r["runnerName"]);
  }
  return Object.keys(map).length ? map : null;
}

/** Match list for one sport, shaped like the app's UEvent. */
export async function royalEvents(sportId: string): Promise<AnyRec[]> {
  const snap = await fresh();
  const list = snap?.bySport.get(sportId) ?? [];
  const events = list.map((ev) => {
    const odds = (ev["oddsData"] as AnyRec | undefined) ?? {};
    const runners = runnersOf(ev);
    return {
      sportId,
      sportName: String(ev["sportName"] ?? ""),
      exEventId: String(ev["exEventId"] ?? ev["_id"] ?? ""),
      eventName: String(ev["eventName"] ?? ""),
      marketName: String(ev["marketName"] ?? "Match Odds"),
      tournamentName: String(ev["tournamentName"] ?? ""),
      eventTime: String(ev["eventTime"] ?? ""),
      inPlay: Boolean(odds["inPlay"] ?? ev["inPlay"]),
      status: String(odds["status"] ?? ev["status"] ?? ""),
      tv: false,
      isScore: false,
      isFancy: false,
      isBookmakers: false,
      isSportsbook: false,
      isStreaming: false,
      totalMatched: num(odds["totalMatched"]),
      betDelay: num(odds["betDelay"]),
      runnersData: runnersDataOf(runners),
      runners,
    };
  });
  events.sort((a, b) => {
    if (a.inPlay !== b.inPlay) return a.inPlay ? -1 : 1;
    return (a.eventTime || "").localeCompare(b.eventTime || "");
  });
  return events;
}

/** Match Odds payload for one event, shaped like the app's OddsResponse. */
export async function royalOdds(sportId: string, exEventId: string): Promise<AnyRec | null> {
  const snap = await fresh();
  const ev = snap?.raw.get(exEventId);
  if (!ev) return null;
  const odds = (ev["oddsData"] as AnyRec | undefined) ?? {};
  const runners = runnersOf(ev);
  const status = String(odds["status"] ?? "OPEN").toUpperCase();
  return {
    exEventId,
    eventName: String(ev["eventName"] ?? ""),
    sportId,
    inPlay: Boolean(odds["inPlay"]),
    tv: false,
    isScore: false,
    betDelay: num(odds["betDelay"]),
    totalMatched: num(odds["totalMatched"]),
    updatedAt: new Date().toISOString(),
    matchOdds: [
      {
        marketId: String(ev["marketId"] ?? ""),
        marketName: String(ev["marketName"] ?? "Match Odds"),
        marketType: "MATCH_ODDS",
        runnersData: runnersDataOf(runners),
        oddsData: {
          status,
          inPlay: Boolean(odds["inPlay"]),
          betDelay: num(odds["betDelay"]),
          totalMatched: num(odds["totalMatched"]),
          runners,
        },
      },
    ],
    bookmakers: [],
    fancy: [],
    sportsbook: [],
  };
}
