import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchOdds,
  fmtInt,
  fmtOdds,
  fmtSize,
  runnerName,
  sportsSocketUrl,
  type Market,
  type OddsResponse,
} from "@/lib/uapi";
import { BalanceChip, BetLayer } from "@/components/betting";
import { createFeedState, mergeFeed } from "@/lib/feed-merge";
import { Scoreboard } from "@/components/Scoreboard";
import { LiveTv } from "@/components/LiveTv";
import { settleFromRunners, voidOpen } from "@/lib/wallet";

export const Route = createFileRoute("/sports/$sportId/$eventId")({
  head: ({ params }) => {
    const title = `Live Odds ${params.eventId} — Universal API`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Live match odds, bookmaker, fancy and sportsbook markets with TV and scoreboard for this event.",
        },
        { property: "og:title", content: title },
        { property: "og:description", content: "Live exchange odds, TV and scoreboard." },
      ],
    };
  },
  component: EventPage,
});

const SPORT_NAMES: Record<string, string> = {
  "1": "Soccer",
  "2": "Tennis",
  "4": "Cricket",
  "7": "Horse Racing",
  "4339": "Greyhound Racing",
};

function Cell({
  price,
  size,
  side,
  dim,
}: {
  price?: number | undefined;
  size?: number | undefined;
  side: "back" | "lay";
  dim?: boolean;
}) {
  const has = Boolean(price);
  const prev = useRef<number | undefined>(price);
  const [flash, setFlash] = useState<"rate-up" | "rate-down" | "">("");

  useEffect(() => {
    const before = prev.current;
    prev.current = price;
    if (before === undefined || price === undefined || before === price) return;
    setFlash(price > before ? "rate-up" : "rate-down");
    const t = setTimeout(() => setFlash(""), 550);
    return () => clearTimeout(t);
  }, [price]);

  const tone =
    side === "back" ? (has ? "bg-ex-back" : "bg-ex-back-dim") : has ? "bg-ex-lay" : "bg-ex-lay-dim";
  return (
    <div
      className={`relative flex h-[66px] flex-col items-center justify-center overflow-hidden rounded-[5px] border border-ex-market-surface/80 ${tone} ${
        dim ? "opacity-40" : ""
      } ${flash} text-ex-cell-foreground`}
    >
      <span className="relative z-10 text-[1.1rem] font-bold leading-none">{fmtOdds(price)}</span>
      {has && size ? (
        <span className="relative z-10 mt-1 text-[0.78rem] leading-none opacity-80">
          {fmtSize(size)}
        </span>
      ) : null}
    </div>
  );
}


function InfoIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ex-text text-[0.72rem] font-extrabold leading-none text-ex-text">
      i
    </span>
  );
}

function Suspended({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-ex-suspend bg-ex-market-surface/80">
      <span className="text-[1.9rem] font-medium uppercase tracking-normal text-ex-suspend sm:text-[2.2rem]">
        {label}
      </span>
    </div>
  );
}


// The upstream feed sometimes keeps a market "OPEN" while every price is
// zeroed out, or reports SUSPEND / INACTIVE variants. The reference board
// shows those as suspended/closed, so derive the state instead of trusting
// the raw string.
function marketState(market: Market): { status: string; dim: boolean; label: string } {
  const raw = String(market.oddsData?.status ?? "OPEN").toUpperCase();
  const runners = market.oddsData?.runners ?? [];
  const hasPrice = runners.some((r) => {
    const rs = String(r.status ?? "").toUpperCase();
    if (/SUSPEND|CLOSE|INACTIVE|REMOVED/.test(rs)) return false;
    const all = [...(r.price?.back ?? []), ...(r.price?.lay ?? [])];
    return all.some((p) => Number(p?.price) > 0);
  });
  const closed = /CLOSE|SETTLE|RESULT/.test(raw);
  const suspended = /SUSPEND|INACTIVE/.test(raw) || (!closed && runners.length > 0 && !hasPrice);
  const dim = closed || suspended;
  const status = closed ? "CLOSED" : suspended ? "SUSPENDED" : raw;
  return { status, dim, label: closed ? "Closed" : "Suspended" };
}

function Board({ market }: { market: Market }) {
  const odds = market.oddsData;
  const { dim, label } = marketState(market);
  const runners = odds?.runners ?? [];

  return (
    <article className="overflow-hidden border-b-[5px] border-ex-market-rule bg-ex-market-surface">
      <header className="grid h-8 grid-cols-[minmax(0,1fr)_100px_100px] items-center bg-ex-market-surface text-ex-cell-foreground sm:grid-cols-[minmax(0,1fr)_120px_120px]">
        <span className="flex h-full min-w-0 items-center gap-1.5 bg-ex-header px-2 text-ex-text">
          <span className="truncate text-[0.78rem] font-semibold">{market.marketName.trim()}</span>
          <InfoIcon />
        </span>
        <span className="flex h-full items-center justify-center gap-1.5 px-2 text-[0.68rem]">
          <span className="h-4 w-4 rounded-[2px] bg-live-badge" />
          Cash Out
        </span>
        <span className="truncate pr-2 text-right text-[0.68rem]">
          Matched {fmtInt(odds?.totalMatched)}
        </span>
      </header>
      <div className="grid h-7 grid-cols-[minmax(0,1fr)_100px_100px] border-b border-ex-market-rule text-[0.7rem] text-ex-cell-foreground sm:grid-cols-[minmax(0,1fr)_120px_120px]">
        <div className="m-1 flex items-center justify-center rounded-[3px] bg-ex-minmax text-[0.64rem] text-ex-muted">
          Min/Max&nbsp;&nbsp; {market.min && market.min > 0 ? market.min : 1}-
          {market.max && market.max > 0 ? market.max : 50000}
        </div>
        <div className="flex items-center justify-center bg-ex-back/55 font-medium">Back</div>
        <div className="flex items-center justify-center bg-ex-lay/55 font-medium">Lay</div>
      </div>
      <div className="relative">
        {runners.map((r) => {
          const back = r.price?.back?.[0];
          const lay = r.price?.lay?.[0];
          return (
            <div
              key={String(r.selectionId)}
              data-runner-row
              className="relative grid min-h-[74px] grid-cols-[minmax(0,1fr)_100px_100px] items-stretch border-b border-ex-market-rule bg-ex-market-row last:border-b-0 sm:grid-cols-[minmax(0,1fr)_120px_120px]"
            >
              <span
                className={`flex min-w-0 items-center truncate px-2 text-[0.83rem] font-medium ${dim ? "text-ex-muted" : "text-ex-cell-foreground"}`}
              >
                {runnerName(market, r.selectionId)}
              </span>
              <div className="p-[3px]"><Cell price={back?.price} size={back?.size} side="back" dim={dim} /></div>
              <div className="p-[3px]"><Cell price={lay?.price} size={lay?.size} side="lay" dim={dim} /></div>
            </div>
          );
        })}

        {dim ? <Suspended label={label} /> : null}
      </div>
    </article>
  );
}

function FancyRow({ market }: { market: Market }) {
  const odds = market.oddsData;
  const { dim, label } = marketState(market);
  const r = odds?.runners?.[0];
  const no = r?.price?.lay?.[0];
  const yes = r?.price?.back?.[0];

  return (
    <article className="relative overflow-hidden border-b-[5px] border-ex-market-rule bg-ex-market-surface">
      <header className="grid h-8 grid-cols-[minmax(0,1fr)_100px_100px] items-center bg-ex-market-surface text-ex-cell-foreground sm:grid-cols-[minmax(0,1fr)_120px_120px]">
        <span className="flex h-full min-w-0 items-center gap-1.5 bg-ex-header px-2 text-ex-text">
          <span className="truncate text-[0.78rem] font-semibold">{market.marketName.trim()}</span>
          <InfoIcon />
        </span>
        <span className="flex h-full items-center justify-center gap-1.5 px-2 text-[0.68rem]">
          <span className="h-4 w-4 rounded-[2px] bg-live-badge" />
          Cash Out
        </span>
        <span className="truncate pr-2 text-right text-[0.68rem]">
          Matched {fmtInt(odds?.totalMatched)}
        </span>
      </header>
      <div className="grid h-7 grid-cols-[minmax(0,1fr)_100px_100px] border-b border-ex-market-rule text-[0.7rem] text-ex-cell-foreground sm:grid-cols-[minmax(0,1fr)_120px_120px]">
        <div className="m-1 flex items-center justify-center rounded-[3px] bg-ex-minmax text-[0.64rem] text-ex-muted">
          Min/Max&nbsp;&nbsp; {market.min && market.min > 0 ? market.min : 100}-
          {market.max && market.max > 0 ? market.max : 25000}
        </div>
        <div className="flex items-center justify-center bg-ex-lay/55 font-medium">No</div>
        <div className="flex items-center justify-center bg-ex-back/55 font-medium">Yes</div>
      </div>
      <div className="grid min-h-[74px] grid-cols-[minmax(0,1fr)_100px_100px] items-center bg-ex-market-row px-2 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
        <span className={`truncate text-[0.82rem] font-medium ${dim ? "text-ex-muted" : "text-ex-cell-foreground"}`}>
          {market.marketName.trim()}
        </span>
        <div className="px-[3px]">
          <div className="pb-1 text-center text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ex-muted">
            No
          </div>
          <Cell price={no?.price} size={no?.size} side="lay" dim={dim} />
        </div>
        <div className="px-[3px]">
          <div className="pb-1 text-center text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ex-muted">
            Yes
          </div>
          <Cell price={yes?.price} size={yes?.size} side="back" dim={dim} />
        </div>
      </div>
      {dim ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-ex-suspend bg-ex-market-surface/80">
          <span className="text-[1.7rem] font-medium uppercase tracking-normal text-ex-suspend">
            {label}
          </span>
        </div>
      ) : null}
    </article>
  );
}

function Section({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden bg-ex-market-surface">
      <div>{children}</div>
    </section>
  );
}

function EventPage() {
  const { sportId, eventId } = Route.useParams();
  const [data, setData] = useState<OddsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closedSince = useRef<number>(0);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const inFlightSince = useRef(0);
  const lastSocketMessage = useRef(0);
  const [age, setAge] = useState(0);


  const load = useCallback(async () => {
    // Safety: if a previous request got stuck (network hang), force-release the
    // lock after 5s so the per-second updates never stop permanently.
    if (inFlight.current) {
      if (Date.now() - inFlightSince.current < 5000) return;
      inFlight.current = false;
    }
    inFlight.current = true;
    inFlightSince.current = Date.now();
    const currentRequest = ++requestId.current;
    try {
      const odds = await fetchOdds(sportId, eventId);
      if (currentRequest !== requestId.current) return;
      setData(odds);
      setAge(0);
      setError(null);
    } catch (e) {
      if (currentRequest !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load odds");
    } finally {
      inFlight.current = false;
    }
  }, [sportId, eventId]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      try {
        const url = await sportsSocketUrl(sportId, eventId);
        if (!active) return;
        socket = new WebSocket(url);
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(String(event.data)) as { type?: string; data?: OddsResponse };
            if (message.type !== "odds" || !message.data) return;
            lastSocketMessage.current = Date.now();
            setData(message.data);
            setAge(0);
            setError(null);
          } catch {
            // Ignore malformed provider frames and keep the HTTP fallback alive.
          }
        };
        socket.onclose = () => {
          if (active) reconnect = setTimeout(() => void connect(), 2000);
        };
        socket.onerror = () => socket?.close();
      } catch {
        if (active) reconnect = setTimeout(() => void connect(), 2000);
      }
    };

    lastSocketMessage.current = 0;
    void connect();
    void load();
    // WebSocket is the fastest source. HTTP automatically takes over whenever
    // socket updates stop, and the server then serves its last-good snapshot if
    // the provider itself is unavailable.
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (Date.now() - lastSocketMessage.current > 900) void load();
    }, 300);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const a = setInterval(() => setAge((v) => v + 1), 1000);
    return () => {
      active = false;
      clearInterval(t);
      clearInterval(a);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (reconnect) clearTimeout(reconnect);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, [load, sportId, eventId]);



  const matchOdds = data?.matchOdds ?? [];
  const bookmakers = data?.bookmakers ?? [];
  const fancy = data?.fancy ?? [];
  const sportsbook = data?.sportsbook ?? [];

  // Every feed tick: if the upstream marks a runner WINNER / LOSER, settle
  // the matching open bets right away — result always comes from the feed.
  useEffect(() => {
    if (!data) return;
    const results: { label: string; won: boolean }[] = [];
    for (const m of [...matchOdds, ...bookmakers, ...fancy, ...sportsbook]) {
      const names = m.runnersData ?? {};
      for (const r of m.oddsData?.runners ?? []) {
        const st = String(r.status ?? "").toUpperCase();
        if (st !== "WINNER" && st !== "LOSER") continue;
        const label = names[String(r.selectionId)] ?? String(r.selectionId);
        results.push({ label, won: st === "WINNER" });
      }
    }
    settleFromRunners(`sports-${eventId}`, results);

    // Feed no longer serves any market for this event (match over / removed):
    // after 30s of an empty feed, refund whatever is still open.
    const live = matchOdds.length + bookmakers.length + fancy.length + sportsbook.length;
    if (live === 0) {
      if (!closedSince.current) closedSince.current = Date.now();
      else if (Date.now() - closedSince.current > 30_000) voidOpen(`sports-${eventId}`);
    } else {
      closedSince.current = 0;
    }
  }, [data, eventId, matchOdds, bookmakers, fancy, sportsbook]);


  return (
    <div className="sports-theme mx-auto max-w-[1200px] px-0 py-0 sm:px-4 sm:py-6">
      <Link to="/sports" className="text-sm text-muted-foreground hover:text-foreground">
        <span className="hidden sm:inline">← Sports list</span>
      </Link>

      <p className="bg-ex-header py-2 text-center text-base font-bold uppercase text-ex-text sm:mt-4 sm:bg-transparent sm:py-0 sm:text-left sm:text-xs sm:tracking-[0.12em] sm:text-muted-foreground">
        {SPORT_NAMES[sportId] ?? `Sport ${sportId}`}
      </p>
      <h1 className="px-2 pt-2 text-base font-bold text-foreground sm:mt-1 sm:px-0 sm:pt-0 sm:text-2xl">
        {data?.eventName ?? "Loading event…"}
      </h1>
      <p className="px-2 pb-2 text-[0.7rem] text-muted-foreground sm:mt-2 sm:px-0 sm:pb-0 sm:text-sm">
        {sportId}/{eventId} · {data?.inPlay ? "in-play" : "pre-match"} · matched{" "}
        {fmtInt(data?.totalMatched)} · age {age}s · betDelay {data?.betDelay ?? 0}s
        {data?.stale ? " · stale" : ""}
      </p>


      {error ? (
        <p className="mt-3 text-sm text-live-lose">
          {data ? "Feed reconnecting… showing last prices" : error}
        </p>
      ) : data?.stale ? (
        <p className="mt-3 text-sm text-ex-muted">Feed reconnecting… showing last prices</p>
      ) : null}


      <div className="grid gap-0 sm:mt-5 sm:gap-4 lg:grid-cols-2">
        <LiveTv
          sportId={sportId}
          eventId={eventId}
          className="overflow-hidden bg-ex-panel sm:rounded-lg"
        />


        <div className="overflow-hidden bg-ex-panel sm:rounded-lg sm:border sm:border-ex-line">
          <header className="bg-ex-header px-4 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ex-text">
            Scoreboard
          </header>
          <Scoreboard sportId={sportId} eventId={eventId} />
        </div>

      </div>


      <p className="flex items-center justify-between bg-ex-market-surface px-2 py-2 text-sm font-bold text-ex-cell-foreground sm:mt-6">
        <span>
          Live odds{" "}
          <span className="text-sm font-normal text-muted-foreground">· live via WebSocket</span>
        </span>
        <BalanceChip />
      </p>

      <BetLayer
        gameId={`sports-${eventId}`}
        gameName={data?.eventName ?? `Event ${eventId}`}
        round={eventId}
        exposureLayout="sports"
      >
        <div className="space-y-0 sm:mt-3 sm:space-y-4">
          {matchOdds.length ? (
            <Section>
              {matchOdds.map((m) => (
                <Board key={m.marketId} market={m} />
              ))}
            </Section>
          ) : null}

          {bookmakers.length ? (
            <Section>
              {bookmakers.map((m) => (
                <Board key={m.marketId} market={m} />
              ))}
            </Section>
          ) : null}

          {fancy.length ? (
            <Section>
              {fancy.map((m) => (
                <FancyRow key={m.marketId} market={m} />
              ))}
            </Section>
          ) : null}

          {sportsbook.length ? (
            <Section>
              {sportsbook.map((m) => (
                <Board key={m.marketId} market={m} />
              ))}
            </Section>
          ) : null}

          {!data && !error ? (
            <p className="text-sm text-muted-foreground">Loading live markets…</p>
          ) : null}
        </div>
      </BetLayer>



    </div>
  );
}
