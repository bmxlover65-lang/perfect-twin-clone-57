import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  fetchEvents,
  fetchProxyHealth,
  fetchSports,
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SportsPage,
});

type Filter = "inplay" | "today" | "tomorrow";

/** Local calendar day of an event start time: 0 = today, 1 = tomorrow, -1 = past/other. */
function dayOffset(eventTime?: string): number {
  if (!eventTime) return 0;
  const parsed = new Date(eventTime);
  if (Number.isNaN(parsed.getTime())) return 0;
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((start.getTime() - today.getTime()) / 86_400_000);
}

const FALLBACK_SPORTS: Sport[] = [
  { sportId: "4", sportName: "Cricket" },
  { sportId: "1", sportName: "Soccer" },
  { sportId: "2", sportName: "Tennis" },
  { sportId: "7", sportName: "Horse Racing" },
  { sportId: "4339", sportName: "Greyhound Racing" },
];

const ORDER = ["4", "1", "2", "7", "4339", "7522", "2378961"];

const SPORT_SHORT_NAMES: Record<string, string> = {
  "4": "Cricket",
  "1": "Soccer",
  "2": "Tennis",
  "7": "Horse Racing",
  "4339": "Greyhound Racing",
  "7522": "Basketball",
  "2378961": "Politics",
};


function fmtOdds(v?: number) {
  return v && v > 0 ? v.toFixed(2) : "—";
}

function fmtInt(v?: number) {
  if (!v || v <= 0) return "";
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(2)}Cr`;
  if (v >= 100_000) return `${(v / 100_000).toFixed(2)}L`;
  if (v >= 1000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}

function runnerName(event: UEvent, index: number) {
  const data = event.runnersData ?? {};
  const key = event.runners?.[index]?.selectionId;
  const byId = key != null ? data[String(key)] : undefined;
  if (byId) return byId;
  const values = Object.values(data);
  if (values[index]) return values[index];
  const parts = event.eventName.split(/\s+v\s+|\s+vs\.?\s+/i);
  return parts[index] ?? (index === 2 ? "The Draw" : `Runner ${index + 1}`);
}

function SportsPage() {
  const [sports, setSports] = useState<Sport[]>(FALLBACK_SPORTS);
  const [sportId, setSportId] = useState("4");
  const [filter, setFilter] = useState<Filter>("inplay");
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
  const requestId = useRef(0);

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

  const inFlight = useRef(false);
  const emptyStreak = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (silent && inFlight.current) return;
      inFlight.current = true;
      const currentRequest = ++requestId.current;
      if (!silent) setLoading(true);
      const started = Date.now();
      try {
        const bySport = new Map<string, UEvent[]>();
        // Paint each sport the moment it arrives instead of waiting for the slowest one.
        const results = await Promise.all(
          ORDER.map((id) =>
            fetchEvents(id)
              .then((r) => {
                const list = (r?.events ?? []).map((e) => ({ ...e, sportId: e.sportId || id }));
                if (currentRequest !== requestId.current) return list;
                bySport.set(id, list);
                const partial = ORDER.flatMap((sid) => bySport.get(sid) ?? []);
                if (partial.length > 0) {
                  emptyStreak.current = 0;
                  setEvents(partial);
                  setError(null);
                }
                return list;
              })
              .catch(() => null),
          ),
        );
        if (currentRequest !== requestId.current) return;
        const next = results.flatMap((r, i) =>
          (r ?? []).map((e) => ({ ...e, sportId: e.sportId || ORDER[i] || "4" })),
        );
        if (next.length === 0) {
          emptyStreak.current += 1;
          // keep the last good list unless the feed is consistently empty
          if (emptyStreak.current >= 3) setEvents(next);
        } else {
          emptyStreak.current = 0;
          setEvents(next);
        }
        setError(null);
        setRefreshedAt(new Date().toLocaleTimeString());
        setLatency(Date.now() - started);
        setLastPoll(new Date());
        setPollCount((n) => n + 1);
      } catch (e) {
        if (currentRequest !== requestId.current) return;
        const message = e instanceof Error ? e.message : "Failed to load events";
        setError(message);
        setLatency(Date.now() - started);
        setLastPoll(new Date());
        setPollCount((n) => n + 1);
        setErrorLog((log) =>
          [{ at: new Date().toLocaleTimeString(), message }, ...log].slice(0, 8),
        );
      } finally {
        inFlight.current = false;
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    emptyStreak.current = 0;
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load(true);
    }, 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);



  const sportEventsAll = useMemo(() => events.filter((e) => e.sportId === sportId), [events, sportId]);
  const inplay = useMemo(() => sportEventsAll.filter((e) => e.inPlay), [sportEventsAll]);
  const today = useMemo(
    () => sportEventsAll.filter((e) => e.inPlay || dayOffset(e.eventTime) === 0),
    [sportEventsAll],
  );
  const tomorrow = useMemo(
    () => sportEventsAll.filter((e) => !e.inPlay && dayOffset(e.eventTime) >= 1),
    [sportEventsAll],
  );
  const list = filter === "inplay" ? inplay : filter === "today" ? today : tomorrow;

  // If the selected tab has nothing, show the first tab that does.
  useEffect(() => {
    if (list.length > 0) return;
    if (inplay.length > 0) setFilter("inplay");
    else if (today.length > 0) setFilter("today");
    else if (tomorrow.length > 0) setFilter("tomorrow");
  }, [list.length, inplay.length, today.length, tomorrow.length]);

  const sportTabs = useMemo(
    () =>
      [...sports].sort((a, b) => {
        const ia = ORDER.indexOf(a.sportId);
        const ib = ORDER.indexOf(b.sportId);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }),
    [sports],
  );

  const pill = (active: boolean) =>
    `h-auto shrink-0 rounded-full border px-4 py-2 text-sm font-semibold shadow-none transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground hover:bg-primary"
        : "border-border bg-transparent text-foreground hover:bg-muted"
    }`;


  return (
    <main className="mx-auto min-h-[calc(100vh-76px)] max-w-[1200px] px-4 py-5 sm:py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[2rem] font-bold leading-tight text-foreground">Sports</h1>
          <p className="mt-1.5 max-w-[620px] text-[0.95rem] font-medium leading-relaxed text-muted-foreground">
            All events for each sport (in-play + pre-match). Open one to verify odds, TV, and scoreboard.
          </p>
          {refreshedAt ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {`List refreshed ${refreshedAt}`}
            </p>
          ) : null}
        </div>
        <Button
          variant="secondary"
          onClick={() => void load()}
          className="mt-1 h-auto shrink-0 rounded-full border border-border bg-muted px-5 py-2.5 text-sm font-semibold text-foreground shadow-none hover:bg-accent"
        >
          Refresh
        </Button>
      </div>

      <nav
        className="mt-5 flex flex-wrap gap-2"
        aria-label="Sports"
      >
        {sportTabs.map((s) => (
          <Button
            key={s.sportId}
            variant="ghost"
            type="button"
            onClick={() => {
              setSportId(s.sportId);
              setFilter("inplay");
            }}
            aria-current={s.sportId === sportId}
            className={pill(s.sportId === sportId)}
          >
            {SPORT_SHORT_NAMES[s.sportId] ?? s.sportName}
          </Button>
        ))}
      </nav>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Match time filter"
      >
        {(
          [
            ["inplay", `In-Play (${inplay.length})`],
            ["today", `Today (${today.length})`],
            ["tomorrow", `Tomorrow (${tomorrow.length})`],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant="ghost"
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={pill(filter === key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <section className="mt-5 rounded-2xl border border-border bg-card p-3.5" aria-label="Match list">
        <header className="flex items-center justify-between px-1 pb-3">
          <h2 className="text-sm font-bold text-foreground">
            {filter === "inplay" ? "In-play events" : filter === "today" ? "Today events" : "Tomorrow events"}
          </h2>
          <span className="text-sm text-muted-foreground">{list.length}</span>
        </header>

        <div className="space-y-2.5">
          {list.map((event) => (
            <Link
              key={event.exEventId}
              to="/sports/$sportId/$eventId"
              params={{ sportId: event.sportId, eventId: event.exEventId }}
              data-sports-event
              className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3.5 py-3 transition-colors hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-foreground">{event.eventName}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {event.inPlay ? <span className="h-2 w-2 shrink-0 rounded-full bg-live-lose" /> : null}
                  <span>
                    {event.inPlay ? "In-play" : "Pre-match"}
                    {event.isScore ? " · Score" : ""}
                    {event.tv ? " · TV" : ""}
                    {fmtInt(event.totalMatched) ? ` · matched ${fmtInt(event.totalMatched)}` : ""}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(event.runners ?? []).slice(0, 3).map((runner, index) => (
                    <span key={String(runner.selectionId)} className="rounded-md bg-card px-2 py-1 text-[0.68rem] text-muted-foreground">
                      {runnerName(event, index)}{" "}
                      <strong className="text-foreground">
                        {fmtOdds(runner.backPrice)}/{fmtOdds(runner.layPrice)}
                      </strong>
                    </span>
                  ))}
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">Odds →</span>
            </Link>
          ))}
        </div>
        {!loading && !list.length ? (
          <p className="px-1 py-7 text-sm text-muted-foreground">
            There are no events to be displayed.
          </p>
        ) : null}
      </section>

      {isAdmin ? (
        <div className="mt-3 rounded-lg border border-border bg-card p-2 text-[0.62rem] text-muted-foreground">
          Polls {pollCount} · {latency}ms · {lastPoll?.toLocaleTimeString() ?? "—"} · {health?.ok ? "Feed OK" : "Feed checking"}
          {errorLog[0] ? ` · ${errorLog[0].message}` : ""}
        </div>
      ) : null}
    </main>
  );
}
