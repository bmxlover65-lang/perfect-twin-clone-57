import type { EventDef } from "@/data/sports";

/** Deterministic pseudo-random in [0,1) from a numeric seed. */
export function rnd(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function fmtOdds(v: number) {
  if (!v) return "0";
  return Number(v.toFixed(v >= 10 ? 0 : 2)).toString();
}

export function fmtSize(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return Math.round(v).toString();
}

export function fmtInt(v: number) {
  return v.toLocaleString("en-US");
}

export interface PriceCell {
  price: number | null;
  size: number;
}

export interface RunnerRow {
  name: string;
  back: PriceCell[];
  lay: PriceCell[];
}

export interface MarketBoard {
  id: string;
  title: string;
  matched: number;
  status: "OPEN" | "SUSPENDED" | "ONLINE";
  runners: RunnerRow[];
}

const step = (price: number, i: number) => {
  if (price <= 0) return 0;
  const inc = price < 2 ? 0.01 : price < 4 ? 0.05 : price < 10 ? 0.1 : 1;
  return Number((price + inc * i).toFixed(2));
};

function ladder(price: number, tick: number, seed: number): RunnerRow["back"] {
  if (price <= 0) {
    return [
      { price: null, size: 0 },
      { price: null, size: 0 },
      { price: null, size: 0 },
    ];
  }
  return [2, 1, 0].map((i) => ({
    price: step(price, -i),
    size: Math.round(200 + rnd(seed + i + tick) * 4000),
  }));
}

function layLadder(price: number, tick: number, seed: number): RunnerRow["lay"] {
  if (price <= 0) {
    return [
      { price: null, size: 0 },
      { price: null, size: 0 },
      { price: null, size: 0 },
    ];
  }
  return [1, 2, 3].map((i) => ({
    price: step(price, i),
    size: Math.round(150 + rnd(seed + 10 + i + tick) * 3500),
  }));
}

/** Live drift of a base price, deterministic per second. */
export function drift(base: number, tick: number, seed: number) {
  if (base <= 0) return 0;
  const amp = base < 2 ? 0.02 : base < 6 ? 0.15 : base * 0.06;
  return Number((base + (rnd(seed + Math.floor(tick / 3)) - 0.5) * amp).toFixed(2));
}

export function buildBoards(ev: EventDef, tick: number): MarketBoard[] {
  const prices = ev.runners.map((_, i) => drift(ev.base[i] ?? 0, tick, i * 7 + 3));

  const matchOdds: MarketBoard = {
    id: "match",
    title: "Match Odds",
    matched: ev.matched + Math.floor(rnd(tick) * 900),
    status: ev.inPlay ? "OPEN" : "OPEN",
    runners: ev.runners.map((name, i) => ({
      name,
      back: ladder(prices[i] ?? 0, tick, i * 31),
      lay: layLadder(prices[i] ?? 0, tick, i * 53),
    })),
  };

  const suspended = ev.inPlay && Math.floor(tick / 12) % 4 === 0;
  const bookmaker: MarketBoard = {
    id: "bookmaker",
    title: "Bookmaker",
    matched: Math.round(ev.matched * 148 + rnd(tick + 5) * 50000),
    status: suspended ? "SUSPENDED" : "OPEN",
    runners: ev.runners.map((name, i) => {
      const p = (prices[i] ?? 0) > 0 ? Math.round(((prices[i] ?? 1) - 1) * 100) : 0;
      return {
        name,
        back: [2, 1, 0].map((k) => ({
          price: p ? p + k * Math.max(1, Math.round(p * 0.04)) : null,
          size: Math.round(500_000 + rnd(tick + i + k) * 2_000_000),
        })),
        lay: [1, 2, 3].map((k) => ({
          price: p ? p + k * Math.max(2, Math.round(p * 0.06)) : null,
          size: Math.round(500_000 + rnd(tick + i + k + 9) * 2_000_000),
        })),
      };
    }),
  };

  return [matchOdds, bookmaker];
}

export interface FancyRow {
  title: string;
  tag?: string;
  no: { price: number; size: number };
  yes: { price: number; size: number };
}

export function buildFancy(ev: EventDef, tick: number): FancyRow[] {
  if (!ev.inPlay) return [];
  const a = ev.runners[1]?.split(" ").map((w) => w[0]).join("") ?? "TM";
  const runs = 230 + Math.floor(rnd(Math.floor(tick / 6)) * 20);
  return [
    {
      title: `${a} 20 Over Runs ADV`,
      tag: "BALLRUN",
      no: { price: runs, size: 100 },
      yes: { price: runs + 2, size: 100 },
    },
    {
      title: `${a} Only 20th Over Runs`,
      no: { price: 14, size: 110 },
      yes: { price: 14, size: 90 },
    },
  ];
}

export interface SportsbookBoard {
  title: string;
  matched: number;
  rows: { name: string; price: number; size: number }[];
}

export function buildSportsbook(ev: EventDef, tick: number): SportsbookBoard[] {
  if (!ev.inPlay) return [];
  const a = ev.runners[0]?.split(" ").map((w) => w[0]).join("") ?? "TM";
  const digits = Array.from({ length: 10 }, (_, d) => ({
    name: String(d),
    price: 9.6,
    size: 99_000 + Math.round(rnd(tick + d) * 1500),
  }));
  return [
    { title: `${a} 6 Over Last Digit`, matched: 1600, rows: digits },
    { title: `${a} 10 Over Last Digit`, matched: 400, rows: digits },
  ];
}
