import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchEvents,
  fetchProxyHealth,
  fetchSports,
  fmtInt,
  fmtOdds,
  runnerName,
  type ProxyHealth,
  type Sport,
  type UEvent,
} from "@/lib/uapi";


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

type Filter = "all" | "inplay" | "pre";

const FALLBACK_SPORTS: Sport[] = [
  { sportId: "4", sportName: "Cricket" },
  { sportId: "1", sportName: "Soccer" },
  { sportId: "2", sportName: "Tennis" },
  { sportId: "7", sportName: "Horse Racing" },
  { sportId: "4339", sportName: "Greyhound Racing" },
];

const ORDER = ["4", "1", "2", "7", "4339"];

function SportsPage() {
  const [sports, setSports] = useState<Sport[]>(FALLBACK_SPORTS);
  const [sportId, setSportId] = useState("4");
  const [filter, setFilter] = useState<Filter>("all");
  const [events, setEvents] = useState<UEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState("");
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [latency, setLatency] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [errorLog, setErrorLog] = useState<{ at: string; message: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [health, setHealth] = useState<ProxyHealth | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("admin");
    if (q === "1") localStorage.setItem("uapi_admin", "1");
    if (q === "0") localStorage.removeItem("uapi_admin");
    setIsAdmin(localStorage.getItem("uapi_admin") === "1");
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const run = () =>
      fetchProxyHealth()
        .then(setHealth)
        .catch(() => undefined);
    void run();
    const t = setInterval(run, 60000);
    return () => clearInterval(t);
  }, [isAdmin]);



  useEffect(() => {
    fetchSports()
      .then((r) => {
        if (r.sports?.length) {
          const list = [...r.sports].sort(
            (a, b) => ORDER.indexOf(a.sportId) - ORDER.indexOf(b.sportId),
          );
          setSports(list);
        }
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(
    async (id: string, silent = false) => {
      if (!silent) setLoading(true);
      const started = Date.now();
      try {
        const data = await fetchEvents(id);
        setEvents(data.events ?? []);
        setError(null);
        setRefreshedAt(new Date(data.refreshedAt ?? Date.now()).toLocaleTimeString());
        setLatency(Date.now() - started);
        setLastPoll(new Date());
        setPollCount((n) => n + 1);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load events";
        setError(message);
        setLatency(Date.now() - started);
        setLastPoll(new Date());
        setPollCount((n) => n + 1);
        setErrorLog((log) =>
          [{ at: new Date().toLocaleTimeString(), message }, ...log].slice(0, 8),
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(sportId);
    const t = setInterval(() => void load(sportId, true), 400);
    return () => clearInterval(t);
  }, [sportId, load]);

  const inplay = useMemo(() => events.filter((e) => e.inPlay), [events]);
  const pre = useMemo(() => events.filter((e) => !e.inPlay), [events]);
  const list = filter === "inplay" ? inplay : filter === "pre" ? pre : events;

  const pill = (active: boolean) =>
  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-nav-active text-background" : "bg-muted text-foreground hover:opacity-80"
    }`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sports</h1>
          <p className="mt-2 max-w-[620px] text-muted-foreground">
            Real in-play and pre-match events with live exchange odds. Data source:{" "}
            <span className="font-semibold text-foreground">
              Universal API (universeapi.store/public)
            </span>{" "}
            through the server proxy <code className="font-mono">/api/public/uapi/sports/…</code>,
            polled every 15s.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {loading
              ? "Loading live events…"
              : `List refreshed ${refreshedAt} · ${inplay.length} in-play · ${pre.length} pre-match`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(sportId)}
          className="rounded-full bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:opacity-80"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {sports.map((s) => (
          <button
            key={s.sportId}
            type="button"
            onClick={() => {
              setSportId(s.sportId);
              setFilter("all");
            }}
            className={pill(s.sportId === sportId)}
          >
            {s.sportName.replace(" Racing", "")}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => setFilter("all")} className={pill(filter === "all")}>
          All ({events.length})
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

      {error ? (
        <p className="mt-6 rounded-xl border border-border/60 bg-card p-4 text-sm text-live-lose">
          {error}
        </p>
      ) : null}


      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-4">
        <header className="flex items-center justify-between px-1 pb-3">
          <h2 className="text-sm font-bold text-foreground">
            {filter === "inplay"
              ? "In-play events"
              : filter === "pre"
                ? "Pre-match events"
                : "All events"}
          </h2>
          <span className="text-sm text-muted-foreground">{list.length}</span>
        </header>

        <div className="space-y-3">
          {list.map((e) => (
            <Link
              key={e.exEventId}
              to="/sports/$sportId/$eventId"
              params={{ sportId: e.sportId, eventId: e.exEventId }}
              className="flex items-center justify-between gap-4 rounded-xl border border-transparent bg-muted px-4 py-3 transition-colors hover:border-border/60"
            >
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">{e.eventName}</h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  {e.inPlay ? <span className="h-2 w-2 shrink-0 rounded-full bg-live-lose" /> : null}
                  <span>
                    {e.inPlay ? "In-play" : "Pre-match"}
                    {e.isScore ? " · Score" : ""}
                    {e.tv ? " · TV" : ""} · matched {fmtInt(e.totalMatched)}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(e.runners ?? []).slice(0, 4).map((r) => (
                    <span
                      key={String(r.selectionId)}
                      className="rounded-md bg-card px-2 py-1 text-xs text-muted-foreground"
                    >
                      {runnerName(e, r.selectionId)}{" "}
                      <span className="font-bold text-foreground">
                        {fmtOdds(r.backPrice)}/{fmtOdds(r.layPrice)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">Odds →</span>
            </Link>
          ))}
          {!loading && !list.length ? (
            <p className="px-1 py-6 text-sm text-muted-foreground">No events right now.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
