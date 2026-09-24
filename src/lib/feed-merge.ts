/**
 * The upstream sports feed is served from several cache generations, so
 * consecutive frames alternate between a fresh snapshot and an older one.
 * Match odds still look alive (the two generations differ), but bookmaker,
 * fancy and sportsbook markets appear frozen because they keep flipping
 * between the same two stale states.
 *
 * This merger keeps, per market, the newest version ever seen and rebuilds a
 * payload from it, so the board only ever moves forward.
 */
import type { Market, OddsResponse } from "@/lib/uapi";

const GROUPS = ["matchOdds", "bookmakers", "fancy", "sportsbook"] as const;
type Group = (typeof GROUPS)[number];

type Slot = { at: number; matched: number; order: number; market: Market };

export type FeedState = {
  markets: Map<string, Slot>;
  bestScore: number;
  bestAt: number;
};

export function createFeedState(): FeedState {
  return { markets: new Map(), bestScore: -1, bestAt: 0 };
}

const KEEP_MS = 25_000;
const GEN_MS = 15_000;

const matchedOf = (m: Market) => Number(m.oddsData?.totalMatched ?? 0) || 0;
const keyOf = (g: Group, m: Market) => `${g}|${m.marketId ?? m.marketName ?? ""}`;

/** Suspended / closed / all-zero frame: always let it through immediately. */
function isDead(m: Market): boolean {
  const raw = String(m.oddsData?.status ?? "").toUpperCase();
  if (/SUSPEND|CLOSE|INACTIVE|SETTLE|RESULT|BALL/.test(raw)) return true;
  const runners = m.oddsData?.runners ?? [];
  if (!runners.length) return false;
  return !runners.some((r) => {
    const rs = String(r.status ?? "").toUpperCase();
    if (/SUSPEND|CLOSE|INACTIVE|REMOVED/.test(rs)) return false;
    return [...(r.price?.back ?? []), ...(r.price?.lay ?? [])].some((p) => Number(p?.price) > 0);
  });
}


export function mergeFeed(state: FeedState, payload: OddsResponse): OddsResponse {
  const now = Date.now();

  let score = 0;
  for (const g of GROUPS) for (const m of payload[g] ?? []) score += matchedOf(m);

  // A frame whose total volume dropped is an older cache generation. Only let
  // it through for markets that genuinely advanced.
  const stale = state.bestScore >= 0 && score < state.bestScore && now - state.bestAt < GEN_MS;
  if (!stale) {
    state.bestScore = score;
    state.bestAt = now;
  }

  // Markets the feed no longer serves (finished fancy sessions, closed
  // bookmakers) must disappear at once — the reference book drops them the
  // moment the over/market is over.
  const present = new Set<string>();

  for (const g of GROUPS) {
    const list = payload[g] ?? [];
    list.forEach((market, i) => {
      const key = keyOf(g, market);
      if (!key.endsWith("|")) {
        present.add(key);
        const prev = state.markets.get(key);
        const matched = matchedOf(market);
        const dim = isDead(market);
        // Thin Bookmaker/Fancy lines commonly keep totalMatched at zero. Their
        // price/status frame is still live, so volume cannot be used to reject
        // it as an older generation.
        const comparableVolume = matched > 0 && (prev?.matched ?? 0) > 0;
        const older = prev && !dim && comparableVolume && (stale ? matched <= prev.matched : matched < prev.matched);
        if (older) return;
        // Live frames carry prices only; keep race card details from the full frame.
        const extra = (prev?.market as { racingInfo?: unknown } | undefined)?.racingInfo;
        const next = extra && !(market as { racingInfo?: unknown }).racingInfo
          ? ({ ...market, racingInfo: extra } as typeof market)
          : market;
        state.markets.set(key, { at: now, matched, order: i, market: next });
      }
    });
  }

  for (const [k, v] of state.markets) {
    if (!present.has(k) || now - v.at > KEEP_MS) state.markets.delete(k);
  }

  const out: OddsResponse = { ...payload };
  for (const g of GROUPS) {
    const rows: Slot[] = [];
    for (const [k, v] of state.markets) if (k.startsWith(`${g}|`)) rows.push(v);
    if (!rows.length) continue;
    rows.sort((a, b) => a.order - b.order || a.market.marketName.localeCompare(b.market.marketName));
    out[g] = rows.map((r) => r.market);
  }
  return out;
}

