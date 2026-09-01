import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/sports")({
  head: () => ({
    meta: [
      { title: "Live Sports Markets — Universal API" },
      {
        name: "description",
        content:
          "Cricket, football and tennis in-play markets with live match odds, bookmaker and fancy lines from the Universal API.",
      },
      { property: "og:title", content: "Live Sports Markets — Universal API" },
      {
        property: "og:description",
        content: "In-play cricket, football and tennis odds via the Universal API.",
      },
    ],
  }),
  component: SportsPage,
});

interface Market {
  sport: string;
  event: string;
  time: string;
  runners: { name: string; back: number; lay: number }[];
}

const MARKETS: Market[] = [
  {
    sport: "Cricket",
    event: "Mumbai Warriors v Chennai Kings",
    time: "In-play · 12.4 ov",
    runners: [
      { name: "Mumbai Warriors", back: 1.86, lay: 1.88 },
      { name: "Chennai Kings", back: 2.14, lay: 2.18 },
    ],
  },
  {
    sport: "Cricket",
    event: "Delhi XI v Kolkata Riders",
    time: "Starts 19:30",
    runners: [
      { name: "Delhi XI", back: 2.02, lay: 2.06 },
      { name: "Kolkata Riders", back: 1.94, lay: 1.97 },
    ],
  },
  {
    sport: "Football",
    event: "Real Sporting v Atletico Norte",
    time: "In-play · 63'",
    runners: [
      { name: "Real Sporting", back: 1.72, lay: 1.75 },
      { name: "Draw", back: 3.9, lay: 4.1 },
      { name: "Atletico Norte", back: 5.4, lay: 5.8 },
    ],
  },
  {
    sport: "Tennis",
    event: "R. Sharma v L. Novak",
    time: "In-play · Set 2",
    runners: [
      { name: "R. Sharma", back: 1.44, lay: 1.46 },
      { name: "L. Novak", back: 2.82, lay: 2.9 },
    ],
  },
];

function useTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 3000);
    return () => clearInterval(t);
  }, []);
  return tick;
}

const drift = (base: number, tick: number, i: number) =>
  Number((base + Math.sin((tick + i * 3) / 2) * 0.03).toFixed(2));

function SportsPage() {
  const tick = useTick();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <div className="rounded-2xl border border-border/60 bg-lobby p-5">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Universal API</p>
        <h1 className="text-3xl font-bold text-foreground">Sports Exchange</h1>
        <p className="mt-1 max-w-[640px] text-muted-foreground">
          In-play cricket, football and tennis markets with back and lay prices.
        </p>

        <div className="mt-4 space-y-3">
          {MARKETS.map((m, mi) => (
            <article key={m.event} className="overflow-hidden rounded-lg bg-card shadow-sm">
              <header className="flex items-center justify-between bg-board-header px-3 py-2 text-board-header-foreground">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-wide opacity-75">{m.sport}</p>
                  <h2 className="text-sm font-bold">{m.event}</h2>
                </div>
                <span className="rounded-full bg-live-badge px-2 py-0.5 text-[0.68rem] font-bold uppercase text-live-badge-foreground">
                  {m.time}
                </span>
              </header>
              <div className="divide-y divide-border">
                {m.runners.map((r, ri) => (
                  <div key={r.name} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    <div className="flex gap-2">
                      <span className="rounded-md bg-back-odds px-3 py-1 text-sm font-bold text-back-odds-foreground">
                        {drift(r.back, tick, mi + ri)}
                      </span>
                      <span className="rounded-md bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
                        {drift(r.lay, tick, mi + ri + 1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
