import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { EVENTS, SPORTS } from "@/data/sports";
import { drift, fmtOdds } from "@/lib/sports-engine";

export const Route = createFileRoute("/sports/")({
  head: () => ({
    meta: [
      { title: "Live Sports Events & Odds — Universal API" },
      {
        name: "description",
        content:
          "All in-play and pre-match events per sport with live match odds, TV and scoreboard availability from the Universal API.",
      },
      { property: "og:title", content: "Live Sports Events & Odds — Universal API" },
      {
        property: "og:description",
        content: "In-play and pre-match cricket, soccer, tennis, horse and greyhound markets.",
      },
    ],
  }),
  component: SportsPage,
});

function useTick(ms = 1000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return tick;
}

type Filter = "all" | "inplay" | "pre";

function SportsPage() {
  const tick = useTick();
  const [sportId, setSportId] = useState("4");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshedAt, setRefreshedAt] = useState<string>("");

  useEffect(() => {
    setRefreshedAt(new Date().toLocaleTimeString());
  }, [sportId]);

  const all = useMemo(() => EVENTS.filter((e) => e.sportId === sportId), [sportId]);
  const inplay = all.filter((e) => e.inPlay);
  const pre = all.filter((e) => !e.inPlay);
  const list = filter === "inplay" ? inplay : filter === "pre" ? pre : all;

  const pill = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-nav-active text-background"
        : "bg-muted text-foreground hover:bg-accent"
    }`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sports</h1>
          <p className="mt-2 max-w-[620px] text-muted-foreground">
            All events for each sport (in-play + pre-match). Open one to verify odds, TV, and
            scoreboard.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            List refreshed {refreshedAt} · {inplay.length} in-play · {pre.length} pre-match
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshedAt(new Date().toLocaleTimeString())}
          className="rounded-full bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {SPORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSportId(s.id);
              setFilter("all");
            }}
            className={pill(s.id === sportId)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => setFilter("all")} className={pill(filter === "all")}>
          All ({all.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("inplay")}
          className={pill(filter === "inplay")}
        >
          In-play ({inplay.length})
        </button>
        <button type="button" onClick={() => setFilter("pre")} className={pill(filter === "pre")}>
          Pre-match ({pre.length})
        </button>
      </div>

      <section className="mt-6 rounded-2xl border border-border/60 bg-ex-panel p-4">
        <header className="flex items-center justify-between px-1 pb-3">
          <h2 className="text-sm font-bold text-foreground">
            {filter === "inplay" ? "In-play events" : filter === "pre" ? "Pre-match events" : "All events"}
          </h2>
          <span className="text-sm text-muted-foreground">{list.length}</span>
        </header>

        <div className="space-y-3">
          {list.map((e) => (
            <Link
              key={e.eventId}
              to="/sports/$sportId/$eventId"
              params={{ sportId: e.sportId, eventId: e.eventId }}
              className="flex items-center justify-between gap-4 rounded-xl bg-ex-row px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">{e.name}</h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  {e.inPlay ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-live-lose" />
                  ) : null}
                  <span>
                    {e.inPlay ? "In-play" : "Pre-match"}
                    {e.score ? " · Score" : ""} · matched{" "}
                    {e.matched + (e.inPlay ? Math.floor(tick * 13) : 0)}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.runners.map((r, i) => {
                    const p = drift(e.base[i] ?? 0, tick, i * 7 + 3);
                    return (
                      <span
                        key={r}
                        className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                      >
                        {r}{" "}
                        <span className="font-bold text-foreground">
                          {fmtOdds(p)}/{fmtOdds(p ? p * 1.02 : 0)}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">Odds →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
