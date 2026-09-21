import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLoader } from "@/components/AppLoader";
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

const ORDER = ["4", "1", "2", "7", "4339"];

const SPORT_SHORT_NAMES: Record<string, string> = {
  "4": "Cricket",
  "1": "Soccer",
  "2": "Tennis",
  "7": "Horse",
  "4339": "Greyhound",
};

/** Royal-style event date label: "09-22-2026 4:00". */
function eventDateLabel(eventTime?: string) {
  if (!eventTime) return "";
  const d = new Date(eventTime);
  if (Number.isNaN(d.getTime())) return eventTime;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}-${d.getFullYear()} ${d.getHours()}:${p(d.getMinutes())}`;
}

function SportsPage() {
  const [sports, setSports] = useState<Sport[]>(FALLBACK_SPORTS);
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
        const results = await Promise.all(ORDER.map((id) => fetchEvents(id).catch(() => null)));
        if (currentRequest !== requestId.current) return;
        const next = results.flatMap((r, i) =>
          (r?.events ?? []).map((e) => ({ ...e, sportId: e.sportId || ORDER[i] || "4" })),
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



  const inplay = useMemo(() => events.filter((e) => e.inPlay), [events]);
  const today = useMemo(() => events.filter((e) => e.inPlay || dayOffset(e.eventTime) === 0), [events]);
  const tomorrow = useMemo(() => events.filter((e) => !e.inPlay && dayOffset(e.eventTime) >= 1), [events]);
  const list = filter === "inplay" ? inplay : filter === "today" ? today : tomorrow;

  /** Royal-style grouping: one section per sport, ordered Cricket → Soccer → Tennis → Horse → Greyhound. */
  const groups = useMemo(() => {
    const nameOf = (id: string) =>
      sports.find((s) => s.sportId === id)?.sportName ?? SPORT_SHORT_NAMES[id] ?? "Other";
    const map = new Map<string, UEvent[]>();
    for (const event of list) {
      map.set(event.sportId, [...(map.get(event.sportId) ?? []), event]);
    }
    const ids = [...map.keys()].sort((a, b) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return ids.map((id) => [nameOf(id), map.get(id)!] as const);
  }, [list, sports]);


  if (loading && events.length === 0) return <AppLoader />;

  return (
    <main className="sports-theme mx-auto min-h-[calc(100vh-76px)] max-w-[1200px] bg-ex-market-surface pb-5 sm:min-h-0 sm:bg-transparent sm:px-4 sm:py-6">
      <header className="flex h-10 items-center justify-between bg-ex-header px-3 text-ex-text sm:rounded-t-[4px]">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="h-4 w-4 text-live-badge" aria-hidden="true" />
          <h1 className="truncate text-[0.86rem] font-extrabold uppercase">Sports Exchange</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh matches"
          onClick={() => void load()}
          className="h-8 w-8 rounded-full text-ex-text hover:bg-ex-text/10 hover:text-ex-text"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <div
        className="grid grid-cols-3 gap-[3px] border-b border-ex-market-rule bg-ex-market-surface p-2"
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
            className={`h-10 w-full rounded-[3px] border text-[0.82rem] font-medium shadow-none ${
              filter === key
                ? "border-ex-header bg-ex-header text-ex-text hover:bg-ex-header"
                : "border-ex-market-rule bg-ex-market-surface text-ex-cell-foreground hover:bg-ex-minmax"
            }`}
          >
            {label}
          </Button>
        ))}
        <span className="col-span-3 text-right text-[0.6rem] text-ex-muted">
          {loading ? "Updating…" : refreshedAt}
        </span>
      </div>

      {error ? (
        <p className="border-b border-ex-market-rule bg-ex-market-surface px-3 py-2 text-xs text-ex-suspend">
          Feed reconnecting · {error}
        </p>
      ) : null}

      <section aria-label="Match list">
        {groups.map(([sportName, sportEvents]) => (
          <div key={sportName}>
            <h2 className="bg-ex-header py-1.5 text-center text-[0.88rem] font-medium text-ex-text">{sportName}</h2>
            {sportEvents.map((event) => (
              <Link
                key={event.exEventId}
                to="/sports/$sportId/$eventId"
                params={{ sportId: event.sportId, eventId: event.exEventId }}
                data-sports-event
                className="block border-b border-ex-market-rule/70 bg-ex-market-surface px-2.5 py-1.5 last:border-b-0"
              >
                <p className="text-[0.85rem] leading-snug">
                  <span className="font-medium text-ex-link">{event.eventName}</span>
                  {event.inPlay ? (
                    <span className="ml-2 text-[0.75rem] font-medium text-ex-inplay">In-Play</span>
                  ) : eventDateLabel(event.eventTime) ? (
                    <span className="ml-2 text-[0.75rem] text-ex-muted">{eventDateLabel(event.eventTime)}</span>
                  ) : null}
                </p>
              </Link>
            ))}
          </div>
        ))}

        {!loading && !list.length ? (
          <p className="bg-ex-market-surface px-3 py-10 text-center text-[0.95rem] text-ex-cell-foreground">
            There are no events to be displayed.
          </p>
        ) : null}
      </section>

      {isAdmin ? (
        <div className="mx-2 mt-3 border border-ex-market-rule bg-ex-market-surface p-2 text-[0.62rem] text-ex-muted">
          Polls {pollCount} · {latency}ms · {lastPoll?.toLocaleTimeString() ?? "—"} · {health?.ok ? "Feed OK" : "Feed checking"}
          {errorLog[0] ? ` · ${errorLog[0].message}` : ""}
        </div>
      ) : null}
    </main>
  );
}
