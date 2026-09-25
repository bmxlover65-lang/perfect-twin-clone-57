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
  // The list is opened before a match page. Subscribe to visible live events
  // now so the first odds request already has an exchange frame available.
  for (const row of rows.slice(0, 24)) {
    const eventId = String(row["exEventId"] ?? row["eventId"] ?? "");
    if (eventId && (inPlay === true || Boolean(row["inPlay"]))) {
       void warmOddsStream(sportId, eventId, {
         competitionId: String(row["competitionId"] ?? row["tournamentId"] ?? ""),
         sport: String(row["sportName"] ?? ""),
         inPlay: Boolean(row["inPlay"]),
       });
    }
  }
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
  stale?: boolean;
  matchOdds: RawMarket[];
  bookmakers: RawMarket[];
  fancy: RawMarket[];
  sportsbook: RawMarket[];
};

// Worker instances don't share memory, so each one can hold a different
// (sometimes older) frame. The newest live frame is shared through the database so every request returns the newest rate and never steps backwards.
type Shared = { at: number; odds: OriOdds };
const localShared = new Map<string, Shared>();

function hasPrices(odds: OriOdds): boolean {
  return [...odds.matchOdds, ...odds.bookmakers, ...odds.fancy, ...odds.sportsbook].some((market) => {
    const runners = (market.oddsData as { runners?: { price?: { back?: { price?: number }[]; lay?: { price?: number }[] } }[] } | undefined)?.runners ?? [];
    return runners.some((runner) => [...(runner.price?.back ?? []), ...(runner.price?.lay ?? [])].some((point) => Number(point.price) > 0));
  });
}

async function readShared(s: string, e: string): Promise<Shared | null> {
  const k = `${s}|${e}`;
  const local = localShared.get(k) ?? null;
  // Worker instances do not share memory. A 15-second local shortcut served
  // yesterday's *generation* to one client while another isolate had already
  // received the next exchange frame. Check the shared watermark once the
  // local frame is a second old, but coalesce simultaneous reads in an isolate.
  if (local && Date.now() - local.at < 1_000) return local;
  let remote: Shared | null = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("sports_odds_live").select("at, odds").eq("key", k).maybeSingle();
    if (data) remote = { at: Number(data.at), odds: data.odds as unknown as OriOdds };
  } catch {
    /* shared store unavailable */
  }
  const newest = !local ? remote : !remote ? local : remote.at > local.at ? remote : local;
  if (newest && newest !== local) localShared.set(k, newest);
  return newest;
}

async function writeShared(s: string, e: string, v: Shared) {
  const k = `${s}|${e}`;
  const prev = localShared.get(k);
  if (prev && prev.at >= v.at) return;
  localShared.set(k, v);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("put_sports_odds", { _key: k, _at: v.at, _odds: v.odds as never });
  } catch {
    /* shared store unavailable */
  }
}

export async function oriOdds(sportId: string, exEventId: string): Promise<OriOdds | null> {
  const shared = await readShared(sportId, exEventId);
  // Cold worker instances can answer from the newest shared exchange frame
  // immediately while their own subscription warms in the background.
  if (shared && hasPrices(shared.odds) && Date.now() - shared.at < 1_000) {
    void warmOddsStream(sportId, exEventId);
    return { ...shared.odds, stale: false };
  }
  const own = await oriOddsInner(sportId, exEventId, shared);
  return own;
}

async function warmOddsStream(sportId: string, exEventId: string, meta?: { competitionId: string; sport: string; inPlay: boolean }) {
  const { ucasSportsOdds } = await import("./ucas.server");
  const frame = await ucasSportsOdds(sportId, exEventId, 0, meta).catch(() => null);
  if (!frame) return;
  const local = localShared.get(`${sportId}|${exEventId}`);
  if (local && local.at >= frame.receivedAt) return;
  await oriOddsInner(sportId, exEventId, local ?? null);
}

async function oriOddsInner(sportId: string, exEventId: string, shared: Shared | null): Promise<OriOdds | null> {
  const { ucasSportsOdds } = await import("./ucas.server");
  // A shared frame is already safe to return if this isolate's subscription is
  // cold; don't make the caller wait the full cold-start window to confirm it.
  const liveFrame = await ucasSportsOdds(sportId, exEventId, shared ? 300 : 1500).catch(() => null);
  if (shared && hasPrices(shared.odds) && liveFrame && liveFrame.receivedAt < shared.at) {
    return { ...shared.odds, stale: Date.now() - shared.at > 5_000 };
  }
  if (shared && hasPrices(shared.odds) && !liveFrame && Date.now() - shared.at <= 5_000) {
    return { ...shared.odds, stale: false };
  }
  let raw: RawMarkets | undefined;
  let fromRest = !liveFrame;
  if (liveFrame) {
    const f = liveFrame.data as Record<string, RawMarket[] | boolean | undefined>;
    raw = {
      matchOddsData: f["betfair"] as RawMarket[],
      bookmakersData: f["bookmakers"] as RawMarket[],
      fancyData: f["fancy"] as RawMarket[],
      sportsbookData: (f["sportsbook"] ?? f["sportsBook"]) as RawMarket[],
      isScore: Boolean(f["isScore"]),
    };
    // Some exchange socket frames contain an empty, suspended ladder while
    // the direct markets endpoint still has open prices. Check the source
    // before replacing a usable board with a zero-only frame.
    const socketHasPrices = [...(raw.matchOddsData ?? []), ...(raw.bookmakersData ?? []), ...(raw.fancyData ?? []), ...(raw.sportsbookData ?? [])].some((market) =>
      ((market.oddsData as { runners?: { price?: { back?: { price?: number }[]; lay?: { price?: number }[] } }[] } | undefined)?.runners ?? []).some((runner) =>
        [...(runner.price?.back ?? []), ...(runner.price?.lay ?? [])].some((point) => Number(point.price) > 0)));
    if (!socketHasPrices) {
      const rest = await jget<Envelope<{ data?: RawMarkets }>>(`sports/${encodeURIComponent(sportId)}/${encodeURIComponent(exEventId)}/markets`, 1800);
      if (rest?.data?.data) {
        raw = rest.data.data;
        fromRest = true;
      }
    }
  } else {
    const json = await jget<Envelope<{ data?: RawMarkets }>>(
      `sports/${encodeURIComponent(sportId)}/${encodeURIComponent(exEventId)}/markets`,
    );
    raw = json?.data?.data;
  }
  if (!raw) return shared ? { ...shared.odds, stale: true } : null;

  const matchOdds = bySequence(live(raw.matchOddsData));
  const bookmakers = bySequence(live(raw.bookmakersData));
  const fancy = bySequence(live(raw.fancyData));
  const sportsbook = bySequence(live(raw.sportsbookData));
  if (!matchOdds.length && !bookmakers.length && !fancy.length && !sportsbook.length) {
    return shared ? { ...shared.odds, stale: true } : null;
  }

  const head = matchOdds[0] ?? bookmakers[0];
  const result: OriOdds = {
    exEventId,
    eventName: String((head?.["eventName"] as string) ?? ""),
    sportId,
    inPlay: Boolean(head?.oddsData?.inPlay),
    isScore: Boolean(raw.isScore),
    betDelay: Number(head?.oddsData?.betDelay ?? 0),
    totalMatched: Number(head?.oddsData?.totalMatched ?? 0),
    // Keep this stable until the exchange sends a genuinely new frame. The
    // WebSocket relay compares payloads and must not mistake a regenerated
    // timestamp for a price update.
    // REST has no market-tick timestamp. Keep the last known exchange tick
    // when available; a fetched snapshot is useful but cannot claim freshness.
    updatedAt: new Date(fromRest ? shared?.at ?? Date.now() : liveFrame?.receivedAt ?? Date.now()).toISOString(),
    stale: fromRest,
    matchOdds,
    bookmakers,
    fancy,
    sportsbook,
  };
  // Must be awaited: the hosting cuts off unawaited work once the response is
  // sent, so fire-and-forget writes never reached the shared store and every
  // copy kept serving its own old frame. The write is a single quick call.
  if (liveFrame && !fromRest && hasPrices(result)) await writeShared(sportId, exEventId, { at: liveFrame.receivedAt, odds: result });
  return result;
}
