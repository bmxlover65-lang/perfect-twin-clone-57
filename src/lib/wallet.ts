import { useEffect, useState } from "react";
import { logBet, setBalance as logBalance } from "@/lib/telemetry";

/** Shared client wallet + bet book used by every casino game. */

const KEY = "uapi_wallet";
const EVT = "uapi-wallet-change";
const LIMIT = 100;

export type Bet = {
  id: string;
  ts: number;
  gameId: string;
  gameName: string;
  round: string;
  label: string;
  odds: number;
  stake: number;
  status: "open" | "won" | "lost";
  payout: number;
};

export type Wallet = { balance: number; bets: Bet[] };

export const EMPTY_WALLET: Wallet = { balance: 100000, bets: [] };

export function readWallet(): Wallet {
  if (typeof window === "undefined") return EMPTY_WALLET;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_WALLET;
    const p = JSON.parse(raw) as Partial<Wallet>;
    return {
      balance: typeof p.balance === "number" ? p.balance : EMPTY_WALLET.balance,
      bets: p.bets ?? [],
    };
  } catch {
    return EMPTY_WALLET;
  }
}

function write(next: Wallet) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
  logBalance(Math.round(next.balance));
}

export function placeBet(
  input: Omit<Bet, "id" | "ts" | "status" | "payout">,
): boolean {
  const w = readWallet();
  if (input.stake <= 0 || input.stake > w.balance) return false;
  const bet: Bet = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    status: "open",
    payout: 0,
  };
  write({ balance: w.balance - input.stake, bets: [bet, ...w.bets].slice(0, LIMIT) });
  logBet({
    ts: bet.ts,
    gameId: bet.gameId,
    gameName: bet.gameName,
    round: bet.round,
    stake: bet.stake,
    multiplier: bet.odds,
    payout: 0,
  });
  return true;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "WINNER A" -> "a", "PLAYER B" -> "b" — lets side markets settle off the feed winner. */
function sideOf(s: string) {
  const m = s.trim().toUpperCase().match(/(?:^|[^A-Z0-9])([AB12])$/);
  return m?.[1] ? m[1].toLowerCase() : "";
}


function isWin(label: string, winner: string) {
  const sa = sideOf(label);
  const sb = sideOf(winner);
  if (sa && sb) return sa === sb || (sa === "a" && sb === "1") || (sa === "b" && sb === "2");
  const a = norm(label);
  const b = norm(winner);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}


/** Settle every open bet of a game for a finished round against the winner. */
export function settleRound(gameId: string, round: string, winner: string) {
  if (!round || !winner) return;
  const w = readWallet();
  let credited = 0;
  let touched = false;
  const bets = w.bets.map((b) => {
    if (b.status !== "open" || b.gameId !== gameId || b.round !== round) return b;
    touched = true;
    const won = isWin(b.label, winner);
    const payout = won ? Math.round(b.stake * b.odds) : 0;
    credited += payout;
    return { ...b, status: won ? ("won" as const) : ("lost" as const), payout };
  });
  if (!touched) return;
  write({ balance: w.balance + credited, bets });
}

export function creditWin(amount: number) {
  const w = readWallet();
  write({ ...w, balance: w.balance + amount });
}

export function debit(amount: number): boolean {
  const w = readWallet();
  if (amount > w.balance) return false;
  write({ ...w, balance: w.balance - amount });
  return true;
}

export function useWallet(): Wallet {
  const [w, setW] = useState<Wallet>(EMPTY_WALLET);
  useEffect(() => {
    const sync = () => setW(readWallet());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return w;
}

/** Settle every open bet of a game against a single result (feeds without roundId). */
export function settleLatest(gameId: string, key: string, winner: string) {
  if (typeof window === "undefined" || !key || !winner) return;
  const seenKey = `uapi_settled_${gameId}`;
  if (window.localStorage.getItem(seenKey) === key) return;
  window.localStorage.setItem(seenKey, key);
  const w = readWallet();
  let credited = 0;
  let touched = false;
  const bets = w.bets.map((b) => {
    if (b.status !== "open" || b.gameId !== gameId) return b;
    touched = true;
    const won = isWin(b.label, winner);
    const payout = won ? Math.round(b.stake * b.odds) : 0;
    credited += payout;
    return { ...b, status: won ? ("won" as const) : ("lost" as const), payout };
  });
  if (!touched) return;
  write({ balance: w.balance + credited, bets });
}
