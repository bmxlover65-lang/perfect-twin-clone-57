/**
 * Real-time result feed.
 *
 * One place that turns the two upstream sources into a single, ordered stream
 * of declared rounds:
 *
 *   1. the live state frame (`gameResult` on the current round) — fastest,
 *      arrives the moment the dealer declares,
 *   2. the result-history endpoint — slower, but authoritative and carries the
 *      dealt cards / nested market winners.
 *
 * The first source to name a winner for a round wins; history later enriches
 * that same round without re-firing anything. Everything downstream — the
 * winner banner, the celebration and bet settlement — runs off this feed, so
 * they can never disagree or lag behind each other.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CasinoResult } from "@/lib/uapi";
import { endWinCelebration } from "@/components/WinCelebration";
import { settleLatest, settleRound } from "@/lib/wallet";

export const LUCKY7_GAMES = ["99.0030", "99.0010", "99.0019"];

export type AnyResult = CasinoResult & {
  _id?: string;
  result?: string;
  selectionName?: string;
};

/** Winner label from a result row — flat `winner` field or nested market results. */
export function deriveWinner(r?: AnyResult, lucky7?: boolean): string {
  if (!r) return "";
  const flat = (r.winner ?? r.result ?? r.selectionName ?? "").toString().trim();
  const markets = r.results ?? [];
  // Lucky 7 rule: when the dealt card is a 7 the round is a TIE — neither
  // LOW nor HIGH wins, so the feed reports no WINNER-market winner.
  if (lucky7) {
    const cardCode = String((r as { cards?: { card?: string } }).cards?.card ?? "");
    const clean = cardCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    let rank = clean.slice(1);
    if (rank === "T") rank = "10";
    if (rank === "7") return "TIE";
  }
  // Prefer an explicit WINNER market, but fall back to ANY market that has a
  // declared winning runner — some tables never publish a "WINNER" market.
  const ordered = [
    ...markets.filter((m) => /winner/i.test(m.marketName ?? "")),
    ...markets.filter((m) => !/winner/i.test(m.marketName ?? "")),
  ];
  for (const nested of ordered) {
    const nRunners = nested?.runners as unknown;
    let derived = "";
    if (Array.isArray(nRunners)) {
      const w = (nRunners as { selectionId?: string | number; result?: string }[]).find(
        (x) => String(x.result ?? "").toUpperCase() === "WINNER",
      );
      if (w) derived = (nested.runnersName ?? {})[String(w.selectionId)] ?? "";
    } else if (nRunners && typeof nRunners === "object") {
      const id = Object.entries(nRunners as Record<string, string>).find(
        ([, v]) => String(v).toUpperCase() === "WINNER",
      )?.[0];
      if (id) derived = (nested.runnersName ?? {})[id] ?? "";
    }
    if (derived) return derived;
  }
  return flat.replace(/_/g, " ");
}

export type FeedResult = {
  /** Round the winner belongs to (or a synthetic key when the feed omits it). */
  round: string;
  winner: string;
  at: number;
  source: "live" | "history";
  row?: AnyResult;
};

type Options = {
  gameId: string;
  /** Round id from the live state frame. */
  round: string;
  /** True while the current round accepts bets. */
  open: boolean;
  /** `gameResult` from the live state frame. */
  liveWinner: string;
  /** Rows from the result-history endpoint, newest first. */
  results: CasinoResult[];
};

/**
 * Live result stream for one table.
 *
 * Returns the round currently being shown (the declared winner that the banner
 * and the celebration belong to) plus the ordered history behind it.
 */
export function useResultFeed({ gameId, round, open, liveWinner, results }: Options): {
  current: FeedResult | null;
  history: AnyResult[];
} {
  const lucky7 = LUCKY7_GAMES.includes(gameId);
  const [current, setCurrent] = useState<FeedResult | null>(null);

  const declared = useRef(new Map<string, FeedResult>());
  const settled = useRef(new Set<string>());
  const celebRound = useRef("");
  const booted = useRef(false);

  // A fresh table starts clean.
  useEffect(() => {
    declared.current = new Map();
    settled.current = new Set();
    celebRound.current = "";
    booted.current = false;
    setCurrent(null);
  }, [gameId]);

  const publish = (next: FeedResult) => {
    const prev = declared.current.get(next.round);
    if (prev && prev.winner === next.winner) return;
    declared.current.set(next.round, { ...next, at: prev?.at ?? next.at });
    if (!settled.current.has(next.round)) {
      settled.current.add(next.round);
      settleRound(gameId, next.round, next.winner);
    }
    // The first winner seen after mount is a leftover round — record it so bets
    // still settle, but never flash its banner/celebration. Likewise, a result
    // that lands after the table has already moved to the next round stays
    // recorded but off screen.
    const onScreenRound = celebRound.current;
    const stillCurrent = !onScreenRound || onScreenRound === next.round;
    if (booted.current && stillCurrent) setCurrent(declared.current.get(next.round) ?? next);
  };

  // 1. Live frame — the instant the dealer declares.
  useEffect(() => {
    const winner = (liveWinner ?? "").trim();
    if (!round || !winner) return;
    publish({ round, winner, at: Date.now(), source: "live" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, liveWinner, gameId]);

  // 2. Result history — authoritative, and carries cards / nested markets.
  useEffect(() => {
    results.slice(0, 6).forEach((r, idx) => {
      const row = r as AnyResult;
      const winner = deriveWinner(row, lucky7);
      const rid = String(row.roundId ?? "");
      if (!rid) {
        // Some tables publish result rows without a round id.
        if (idx === 0 && winner) {
          const key = String(row._id ?? winner);
          if (!settled.current.has(key)) {
            settled.current.add(key);
            settleLatest(gameId, key, winner);
          }
          if (booted.current) setCurrent({ round: key, winner, at: Date.now(), source: "history", row });
        }
        return;
      }
      if (!winner) return;
      const prev = declared.current.get(rid);
      // Keep the live winner text (it lands first) but attach the richer row.
      if (prev) {
        declared.current.set(rid, { ...prev, row });
        if (booted.current && idx === 0 && (!celebRound.current || celebRound.current === rid)) {
          setCurrent(declared.current.get(rid) ?? prev);
        }
        return;
      }
      publish({ round: rid, winner, at: Date.now(), source: "history", row });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, gameId, lucky7]);

  // Mark the feed live once we have seen one frame, so stale rounds present at
  // mount never trigger a banner or confetti.
  useEffect(() => {
    if (!booted.current && (round || results.length)) {
      const t = setTimeout(() => {
        booted.current = true;
      }, 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [round, results.length]);

  // A round change clears the previous winner and celebration. Keep the feed
  // state only for the same brief three-second result window used by the table
  // callout, even if the next round has not opened yet.
  useEffect(() => {
    if (!round) return;
    if (celebRound.current && celebRound.current !== round) {
      const age = current ? Date.now() - current.at : Number.POSITIVE_INFINITY;
      if (open || age > 3000) {
        endWinCelebration();
        setCurrent((c) => (c && c.round !== round ? null : c));
        celebRound.current = round;
      }
      return;
    }
    celebRound.current = round;
  }, [round, open, current]);

  // Keep this dependency meaningful for callers: an open frame for the same
  // round must never clear a freshly declared result.
  void open;

  const history = useMemo(() => results as AnyResult[], [results]);
  return { current, history };
}
