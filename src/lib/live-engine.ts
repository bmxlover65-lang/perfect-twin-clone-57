import { useEffect, useState } from "react";
import type { GameDef } from "@/data/games";

const ROUND_SECONDS = 30;
const BETTING_SECONDS = 18;
const RESULT_SECONDS = 6;

/** Deterministic 32-bit hash -> 0..1 */
function rand(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export type Phase = "open" | "suspended" | "result";

export interface LiveRunner {
  label: string;
  odds: number;
  volume: number;
}

export interface LiveMarket {
  title: string;
  min: number;
  max: number;
  runners: LiveRunner[];
  suspended: boolean;
}

export interface PlayingCard {
  rank: string;
  suit: "S" | "H" | "C" | "D";
  hidden?: boolean;
}

export interface LiveState {
  round: number;
  rid: string;
  phase: Phase;
  secondsLeft: number;
  markets: LiveMarket[];
  playerA: PlayingCard[];
  playerB: PlayingCard[];
  recent: string[];
  lastWinner: string;
}

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: PlayingCard["suit"][] = ["S", "H", "C", "D"];

function dealCard(seed: string): PlayingCard {
  return {
    rank: RANKS[Math.floor(rand(seed, "r") * RANKS.length)] ?? "A",
    suit: SUITS[Math.floor(rand(seed, "s") * SUITS.length)] ?? "S",
  };
}

function roundHand(game: GameDef, round: number, who: string, reveal: number, count: number): PlayingCard[] {
  return Array.from({ length: count }, (_, i) =>
    i < reveal ? dealCard(`${game.id}:${round}:${who}:${i}`) : { rank: "", suit: "S", hidden: true },
  );
}

export function computeState(game: GameDef, elapsedSeconds: number): LiveState {
  const round = Math.floor(elapsedSeconds / ROUND_SECONDS);
  const inRound = elapsedSeconds % ROUND_SECONDS;

  let phase: Phase = "open";
  if (inRound >= BETTING_SECONDS && inRound < BETTING_SECONDS + RESULT_SECONDS) phase = "suspended";
  else if (inRound >= BETTING_SECONDS + RESULT_SECONDS) phase = "result";

  const secondsLeft =
    phase === "open" ? BETTING_SECONDS - inRound : ROUND_SECONDS - inRound;

  const markets: LiveMarket[] = game.markets.map((m, mi) => ({
    title: m.title,
    min: m.min,
    max: m.max,
    suspended: phase !== "open",
    runners: m.runners.map((label, ri) => {
      const base = m.odds[ri] ?? 2;
      const drift = base < 3 ? (rand(game.id, round, mi, ri, "o") - 0.5) * 0.08 : 0;
      const odds = Math.max(1.01, base + drift);
      const volume = Math.floor(
        m.max * (0.35 + rand(game.id, round, mi, ri, "v") * 0.65),
      );
      return {
        label,
        odds: Number(odds.toFixed(2)),
        volume,
      };
    }),
  }));

  const reveal = phase === "open" ? Math.min(3, Math.floor(inRound / 6)) : 3;
  const pickResult = (r: number) =>
    game.results[Math.floor(rand(game.id, r, "w") * game.results.length)] ?? "-";
  const winner = pickResult(round);
  const recent = Array.from({ length: 10 }, (_, i) => {
    const r = round - i - (phase === "result" ? 0 : 1);
    return pickResult(Math.max(r, 0));
  });

  return {
    round,
    rid: `${game.id.replace(".", "")}${String(9000000 + (round % 999999)).slice(0, 7)}`,
    phase,
    secondsLeft: Math.max(0, secondsLeft),
    markets,
    playerA: roundHand(game, round, "A", reveal, 3),
    playerB: roundHand(game, round, "B", phase === "open" ? Math.max(0, reveal - 1) : 3, 3),
    recent,
    lastWinner: winner,
  };
}

/** SSR-stable start point so server and first client render match. */
const BASE_ELAPSED = 0;

export function useLiveGame(game: GameDef): LiveState {
  const [elapsed, setElapsed] = useState(BASE_ELAPSED);

  useEffect(() => {
    setElapsed(Math.floor(Date.now() / 1000) % 100000);
    const t = setInterval(() => {
      setElapsed(Math.floor(Date.now() / 1000) % 100000);
    }, 250);
    return () => clearInterval(t);
  }, [game.id]);

  return computeState(game, elapsed);
}
