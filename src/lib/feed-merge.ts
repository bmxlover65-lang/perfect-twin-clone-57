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

  for (const g of GROUPS) {
    const list = payload[g] ?? [];
    list.forEach((market, i) => {
      const key = keyOf(g, market);
      if (!key.endsWith("|")) {
        const prev = state.markets.get(key);
        const matched = matchedOf(market);
        const older = prev && (stale ? matched <= prev.matched : matched < prev.matched);
        if (older) return;
        state.markets.set(key, { at: now, matched, order: i, market });
      }
    });
  }

  for (const [k, v] of state.markets) if (now - v.at > KEEP_MS) state.markets.delete(k);

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
