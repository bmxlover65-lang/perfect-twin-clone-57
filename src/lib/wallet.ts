import { useEffect, useState } from "react";
import { logBet, setBalance as logBalance } from "@/lib/telemetry";
import { playerSession, remoteBet, remoteCashout, remoteSettle } from "@/lib/player";

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
  status: "open" | "won" | "lost" | "void";
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

/**
 * Place a bet.
 *
 * Integrated launch (`?apiKey=…&userId=…`): the stake is taken from the
 * operator's own wallet through the public API — our demo balance is never
 * touched. Standalone demo play falls back to the local balance.
 *
 * Returns the bet reference, or null when the bet could not be placed.
 */
export function placeBet(
  input: Omit<Bet, "id" | "ts" | "status" | "payout">,
): string | null {
  const w = readWallet();
  const session = playerSession();
  if (input.stake <= 0) return null;
  if (!session && input.stake > w.balance) return null;
  const ref = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const bet: Bet = {
    ...input,
    id: ref,
    ts: Date.now(),
    status: "open",
    payout: 0,
  };
  write({
    balance: session ? w.balance : w.balance - input.stake,
    bets: [bet, ...w.bets].slice(0, LIMIT),
  });
  if (session) {
    void remoteBet(session, {
      gameId: input.gameId,
      roundId: input.round,
      selection: input.label,
      odds: input.odds,
      stake: input.stake,
      reference: ref,
    }).then((r) => {
      if (r.ok) return;
      dropBet(ref);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(BET_ERR, { detail: r.message ?? "Bet was declined." }),
        );
      }
    });
  }
  logBet({
    ts: bet.ts,
    gameId: bet.gameId,
    gameName: bet.gameName,
    round: bet.round,
    stake: bet.stake,
    multiplier: bet.odds,
    payout: 0,
  });
  return ref;
}

export const BET_ERR = "uapi-bet-error";

/** Remove a bet the operator wallet refused (no local money moved). */
function dropBet(ref: string) {
  const w = readWallet();
  write({ ...w, bets: w.bets.filter((b) => b.id !== ref) });
}

/**
 * Cash out a crash-game bet. Integrated play credits the operator wallet;
 * demo play credits the local balance.
 */
export function cashOut(ref: string | undefined, stake: number, multiplier: number): number {
  const payout = Math.round(stake * multiplier);
  const session = playerSession();
  const w = readWallet();
  const bets = w.bets.map((b) =>
    b.id === ref ? { ...b, status: "won" as const, odds: multiplier, payout } : b,
  );
  write({ balance: session ? w.balance : w.balance + payout, bets });
  if (session && ref) void remoteCashout(session, ref, multiplier);
  return payout;
}

/** Cancel a queued bet before the round starts. */
export function cancelBet(ref: string | undefined, stake: number) {
  const session = playerSession();
  const w = readWallet();
  const bets = w.bets.filter((b) => b.id !== ref);
  write({ balance: session ? w.balance : w.balance + stake, bets });
  if (session && ref) void remoteCashout(session, ref, 1);
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



/** Push table-game settlements to the operator wallet in integrated mode. */
function pushSettle(rows: { ref: string; outcome: "won" | "lost" | "void"; multiplier?: number }[]) {
  const session = playerSession();
  if (!session || !rows.length) return;
  for (const r of rows) void remoteSettle(session, r.ref, r.outcome, r.multiplier);
}

/** Settle every open bet of a game for a finished round against the winner. */
export function settleRound(gameId: string, round: string, winner: string) {
  if (!round || !winner) return;
  const w = readWallet();
  let credited = 0;
  let touched = false;
  const settled: { ref: string; outcome: "won" | "lost" | "void"; multiplier?: number }[] = [];
  const bets = w.bets.map((b) => {
    if (b.status !== "open" || b.gameId !== gameId || b.round !== round) return b;
    touched = true;
    const won = isWin(b.label, winner);
    const payout = won ? Math.round(b.stake * b.odds) : 0;
    credited += payout;
    settled.push({ ref: b.id, outcome: won ? "won" : "lost", multiplier: b.odds });
    return { ...b, status: won ? ("won" as const) : ("lost" as const), payout };
  });
  if (!touched) return;
  const session = playerSession();
  write({ balance: session ? w.balance : w.balance + credited, bets });
  pushSettle(settled);
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
  const settled: { ref: string; outcome: "won" | "lost" | "void"; multiplier?: number }[] = [];
  const bets = w.bets.map((b) => {
    if (b.status !== "open" || b.gameId !== gameId) return b;
    touched = true;
    const won = isWin(b.label, winner);
    const payout = won ? Math.round(b.stake * b.odds) : 0;
    credited += payout;
    settled.push({ ref: b.id, outcome: won ? "won" : "lost", multiplier: b.odds });
    return { ...b, status: won ? ("won" as const) : ("lost" as const), payout };
  });
  if (!touched) return;
  const session = playerSession();
  write({ balance: session ? w.balance : w.balance + credited, bets });
  pushSettle(settled);
}

/**
 * Settle open bets from a live feed that marks each runner WINNER / LOSER.
 * Called every poll tick — it only touches bets whose selection is decided.
 */
export function settleFromRunners(
  gameId: string,
  results: { label: string; won: boolean }[],
) {
  if (!results.length) return;
  const w = readWallet();
  let credited = 0;
  let touched = false;
  const settled: { ref: string; outcome: "won" | "lost" | "void"; multiplier?: number }[] = [];
  const bets = w.bets.map((b) => {
    if (b.status !== "open" || b.gameId !== gameId) return b;
    const hit = results.find((r) => isWin(b.label, r.label));
    if (!hit) return b;
    touched = true;
    const payout = hit.won ? Math.round(b.stake * b.odds) : 0;
    credited += payout;
    settled.push({ ref: b.id, outcome: hit.won ? "won" : "lost", multiplier: b.odds });
    return { ...b, status: hit.won ? ("won" as const) : ("lost" as const), payout };
  });
  if (!touched) return;
  const session = playerSession();
  write({ balance: session ? w.balance : w.balance + credited, bets });
  pushSettle(settled);
}


/**
 * Refund (void) open bets that the upstream feed can no longer resolve —
 * e.g. the market/event closed without publishing a winner. Stake goes back
 * so money is never stuck in a bet that will never settle.
 */
export function voidOpen(gameId: string, olderThanMs = 0) {
  const w = readWallet();
  const now = Date.now();
  let refund = 0;
  let touched = false;
  const settled: { ref: string; outcome: "won" | "lost" | "void"; multiplier?: number }[] = [];
  const bets = w.bets.map((b) => {
    if (b.status !== "open" || b.gameId !== gameId) return b;
    if (now - b.ts < olderThanMs) return b;
    touched = true;
    refund += b.stake;
    settled.push({ ref: b.id, outcome: "void" });
    return { ...b, status: "void" as const, payout: b.stake };
  });
  if (!touched) return;
  const session = playerSession();
  write({ balance: session ? w.balance : w.balance + refund, bets });
  pushSettle(settled);
}
