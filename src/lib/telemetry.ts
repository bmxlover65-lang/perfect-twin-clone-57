import { useEffect, useState } from "react";

/** Shared client-side telemetry so the admin dashboard can see player activity. */

const KEY = "uapi_telemetry";
const EVT = "uapi-telemetry-change";
const LIMIT = 200;

export type BetRow = {
  ts: number;
  gameId: string;
  gameName: string;
  round: string;
  stake: number;
  multiplier: number | null;
  payout: number;
};

export type ChatRow = {
  ts: number;
  user: string;
  text: string;
};

export type ResultRow = {
  ts: number;
  gameId: string;
  gameName: string;
  round: string;
  real: string;
  shown: string;
  forced: boolean;
};

export type Telemetry = {
  balance: number;
  bets: BetRow[];
  chat: ChatRow[];
  results: ResultRow[];
};

export const EMPTY: Telemetry = { balance: 0, bets: [], chat: [], results: [] };

export function readTelemetry(): Telemetry {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Telemetry>;
    return {
      balance: typeof p.balance === "number" ? p.balance : 0,
      bets: p.bets ?? [],
      chat: p.chat ?? [],
      results: p.results ?? [],
    };
  } catch {
    return EMPTY;
  }
}

function write(next: Telemetry) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
}

export function setBalance(balance: number) {
  const t = readTelemetry();
  if (t.balance === balance) return;
  write({ ...t, balance });
}

export function logBet(row: BetRow) {
  const t = readTelemetry();
  write({ ...t, bets: [row, ...t.bets].slice(0, LIMIT) });
}

export function logChat(row: ChatRow) {
  const t = readTelemetry();
  write({ ...t, chat: [row, ...t.chat].slice(0, LIMIT) });
}

export function logResult(row: ResultRow) {
  const t = readTelemetry();
  if (t.results[0] && t.results[0].gameId === row.gameId && t.results[0].round === row.round) return;
  write({ ...t, results: [row, ...t.results].slice(0, LIMIT) });
}

export function clearTelemetry() {
  write(EMPTY);
}

export function useTelemetry(): Telemetry {
  const [t, setT] = useState<Telemetry>(EMPTY);
  useEffect(() => {
    const sync = () => setT(readTelemetry());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    const id = window.setInterval(sync, 2000);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
      window.clearInterval(id);
    };
  }, []);
  return t;
}
