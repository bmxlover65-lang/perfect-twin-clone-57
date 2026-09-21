import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Radio, RefreshCw, Tv } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLoader } from "@/components/AppLoader";
import { Button } from "@/components/ui/button";

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

function eventClock(eventTime?: string) {
  if (!eventTime) return "";
  const parsed = new Date(eventTime);
  if (Number.isNaN(parsed.getTime())) return eventTime;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PriceCell({
  price,
  size,
  side,
}: {
  price: number | undefined;
  size: number | undefined;
  side: "back" | "lay";
}) {
  const hasPrice = Number(price) > 0;
  return (
    <span
      className={`flex h-[35px] min-w-0 flex-col items-center justify-center border-l border-ex-market-surface text-ex-cell-foreground ${
        side === "back" ? (hasPrice ? "bg-ex-back" : "bg-ex-back-dim/45") : hasPrice ? "bg-ex-lay" : "bg-ex-lay-dim/45"
      }`}
    >
      <strong className="text-[0.75rem] leading-none">{fmtOdds(price)}</strong>
      {hasPrice && Number(size) > 0 ? (
        <small className="mt-0.5 text-[0.52rem] font-medium leading-none opacity-75">{fmtInt(size)}</small>
      ) : null}
    </span>
  );
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
    async (id: string, silent = false) => {
      if (silent && inFlight.current) return;
      inFlight.current = true;
      const currentRequest = ++requestId.current;
      if (!silent) setLoading(true);
      const started = Date.now();
      try {
        const data = await fetchEvents(id);
        if (currentRequest !== requestId.current) return;
        const next = data.events ?? [];
        if (next.length === 0) {
          emptyStreak.current += 1;
          // keep the last good list unless the feed is consistently empty
          if (emptyStreak.current >= 3) setEvents(next);
        } else {
          emptyStreak.current = 0;
          setEvents(next);
        }
        setError(null);
        setRefreshedAt(new Date(data.refreshedAt ?? Date.now()).toLocaleTimeString());
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
    void load(sportId);
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load(sportId, true);
    }, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(sportId, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [sportId, load]);



  const inplay = useMemo(() => events.filter((e) => e.inPlay), [events]);
  const today = useMemo(() => events.filter((e) => dayOffset(e.eventTime) <= 0), [events]);
  const tomorrow = useMemo(() => events.filter((e) => dayOffset(e.eventTime) >= 1), [events]);
  const list = filter === "inplay" ? inplay : filter === "today" ? today : tomorrow;

  const groups = useMemo(() => {
    const map = new Map<string, UEvent[]>();
    for (const event of list) {
      const name = event.tournamentName?.trim() || (event.inPlay ? "Live Matches" : "Upcoming Matches");
      map.set(name, [...(map.get(name) ?? []), event]);
    }
    return [...map.entries()];
  }, [list]);

  const pill = (active: boolean) =>
    `h-8 shrink-0 rounded-[3px] border px-3 text-[0.72rem] font-bold shadow-none ${
      active
        ? "border-ex-header bg-ex-header text-ex-text hover:bg-ex-header"
        : "border-ex-market-rule bg-ex-market-surface text-ex-cell-foreground hover:bg-ex-minmax"
    }`;

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
          onClick={() => void load(sportId)}
          className="h-8 w-8 rounded-full text-ex-text hover:bg-ex-text/10 hover:text-ex-text"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <nav className="flex gap-1.5 overflow-x-auto border-b border-ex-market-rule bg-ex-market-surface px-2 py-2" aria-label="Sports">
        {sports.map((s) => (
          <Button
            key={s.sportId}
            variant="ghost"
            type="button"
            onClick={() => {
              setSportId(s.sportId);
              setFilter("inplay");
            }}
            className={pill(s.sportId === sportId)}
          >
            {SPORT_SHORT_NAMES[s.sportId] ?? s.sportName.replace(" Racing", "")}
          </Button>
        ))}
      </nav>

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
        {groups.map(([tournament, tournamentEvents]) => (
          <div key={tournament} className="border-b-[5px] border-ex-market-rule">
            <div className="grid h-7 grid-cols-[minmax(0,1fr)_64px_64px] items-center bg-ex-header text-ex-text">
              <h2 className="truncate px-2 text-[0.7rem] font-bold uppercase">{tournament}</h2>
              <span className="text-center text-[0.62rem] font-semibold">Back</span>
              <span className="text-center text-[0.62rem] font-semibold">Lay</span>
            </div>

            {tournamentEvents.map((event) => {
              const firstRunner = event.runners?.[0];
              const hasPrices = Number(firstRunner?.backPrice) > 0 || Number(firstRunner?.layPrice) > 0;
              return (
                <Link
                  key={event.exEventId}
                  to="/sports/$sportId/$eventId"
                  params={{ sportId: event.sportId, eventId: event.exEventId }}
                  data-sports-event
                  className="group block border-b border-ex-market-rule bg-ex-market-surface last:border-b-0 hover:bg-ex-minmax/45"
                >
                  <div className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_64px_64px] items-stretch">
                    <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${event.inPlay ? "bg-live-lose" : "bg-ex-muted"}`} />
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-[0.74rem] font-bold leading-[1.15] text-ex-cell-foreground">
                          {event.eventName}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-[0.58rem] leading-none text-ex-muted">
                          <span className={event.inPlay ? "font-bold uppercase text-live-lose" : "font-semibold uppercase"}>
                            {event.inPlay ? "In-Play" : eventClock(event.eventTime) || "Pre-Match"}
                          </span>
                          {event.tv ? <Tv className="h-2.5 w-2.5" aria-label="TV available" /> : null}
                          {Number(event.totalMatched) > 0 ? <span>Matched {fmtInt(event.totalMatched)}</span> : null}
                        </p>
                      </div>
                      {!hasPrices ? <ChevronRight className="h-4 w-4 shrink-0 text-ex-muted group-hover:text-ex-cell-foreground" /> : null}
                    </div>
                    <PriceCell price={firstRunner?.backPrice} size={firstRunner?.backSize} side="back" />
                    <PriceCell price={firstRunner?.layPrice} size={firstRunner?.laySize} side="lay" />
                  </div>

                  {(event.runners ?? []).slice(0, 2).map((runner, index) =>
                    index === 0 ? null : (
                      <div
                        key={String(runner.selectionId)}
                        className="grid h-[35px] grid-cols-[minmax(0,1fr)_64px_64px] border-t border-ex-market-rule/70"
                      >
                        <span className="truncate px-5 py-2 text-[0.62rem] font-medium text-ex-cell-foreground">
                          {runnerName(event, runner.selectionId)}
                        </span>
                        <PriceCell price={runner.backPrice} size={runner.backSize} side="back" />
                        <PriceCell price={runner.layPrice} size={runner.laySize} side="lay" />
                      </div>
                    ),
                  )}
                </Link>
              );
            })}
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
