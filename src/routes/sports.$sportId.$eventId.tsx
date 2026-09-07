import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchOdds,
  fmtInt,
  fmtOdds,
  fmtSize,
  runnerName,
  type Market,
  type OddsResponse,
} from "@/lib/uapi";
import { BalanceChip, BetLayer } from "@/components/betting";
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
      className={`relative flex h-[52px] flex-col items-center justify-center overflow-hidden rounded-sm ${tone} ${
        dim ? "opacity-40" : ""
      } ${flash} text-ex-cell-foreground`}
    >
      <span className="relative z-10 text-[0.88rem] font-bold leading-none">{fmtOdds(price)}</span>
      {has && size ? (
        <span className="relative z-10 mt-1 text-[0.65rem] leading-none opacity-80">
          {fmtSize(size)}
        </span>
      ) : null}
    </div>
  );
}


function BoardHeader({
  name,
  matched,
  status,
  dim,
}: {
  name: string;
  matched?: number | undefined;
  status: string;
  dim: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-ex-line/60 bg-ex-row px-3 py-2.5">
      <span className={`text-[0.95rem] font-bold ${dim ? "text-ex-muted" : "text-ex-text"}`}>
        {name}
      </span>
      <span
        className={`flex shrink-0 items-center gap-3 text-[0.75rem] ${dim ? "text-ex-muted/70" : "text-ex-muted"}`}
      >
        <span>Matched {fmtInt(matched)}</span>
        <span className="rounded-sm bg-ex-cell/20 px-2 py-1 font-bold uppercase tracking-wide text-ex-text">
          {status}
        </span>
      </span>
    </header>
  );
}


function Suspended({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="text-base font-extrabold uppercase tracking-[0.18em] text-ex-text">
        {label}
      </span>
    </div>
  );
}

function Board({ market }: { market: Market }) {
  const odds = market.oddsData;
  const status = (odds?.status ?? "OPEN").toUpperCase();
  const dim = status === "SUSPENDED" || status === "CLOSED";
  const runners = odds?.runners ?? [];

  return (
    <div className="overflow-hidden rounded-md bg-ex-row">
      <BoardHeader
        name={market.marketName.trim()}
        matched={odds?.totalMatched}
        status={status}
        dim={dim}
      />
      <div className="relative">
        {runners.map((r) => {
          const back = [...(r.price?.back ?? [])].slice(0, 3).reverse();
          const lay = (r.price?.lay ?? []).slice(0, 3);
          return (
            <div
              key={String(r.selectionId)}
              data-runner-row
              className="relative border-b border-ex-line/30 px-3 py-2 pb-5 last:border-b-0"
            >
              <span
                className={`block truncate pb-1.5 text-[0.95rem] font-bold ${dim ? "text-ex-muted" : "text-ex-text"}`}
              >
                {runnerName(market, r.selectionId)}
              </span>
              <div className="grid grid-cols-6 gap-1">
                {[0, 1, 2].map((i) => (
                  <Cell key={`b${i}`} price={back[i]?.price} size={back[i]?.size} side="back" dim={dim} />
                ))}
                {[0, 1, 2].map((i) => (
                  <Cell key={`l${i}`} price={lay[i]?.price} size={lay[i]?.size} side="lay" dim={dim} />
                ))}
              </div>
            </div>
          );
        })}

        {dim ? <Suspended label={status === "CLOSED" ? "Closed" : "Suspended"} /> : null}
      </div>
    </div>
  );
}

function FancyRow({ market }: { market: Market }) {
  const odds = market.oddsData;
  const status = (odds?.status ?? "OPEN").toUpperCase();
  const dim = status === "SUSPENDED" || status === "CLOSED";
  const r = odds?.runners?.[0];
  const no = r?.price?.lay?.[0];
  const yes = r?.price?.back?.[0];

  return (
    <div className="relative flex items-center justify-between gap-3 rounded-md bg-ex-row px-3 py-3">
      <span className={`truncate text-sm font-bold ${dim ? "text-ex-muted" : "text-ex-text"}`}>
        {market.marketName.trim()}
      </span>
      <div className="flex shrink-0 gap-1">
        <div className="w-[96px]">
          <div className="pb-1 text-center text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ex-muted">
            No
          </div>
          <Cell price={no?.price} size={no?.size} side="lay" dim={dim} />
        </div>
        <div className="w-[96px]">
          <div className="pb-1 text-center text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ex-muted">
            Yes
          </div>
          <Cell price={yes?.price} size={yes?.size} side="back" dim={dim} />
        </div>
      </div>
      {dim ? (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
          <span className="text-base font-extrabold uppercase tracking-[0.18em] text-ex-text">
            Suspended
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg bg-ex-panel">
      <header className="flex items-center justify-between bg-ex-header px-4 py-2.5">
        <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ex-text">
          {title}
        </h2>
        <span className="text-xs text-ex-muted">{count}</span>
      </header>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

function EventPage() {
  const { sportId, eventId } = Route.useParams();
  const [data, setData] = useState<OddsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closedSince = useRef<number>(0);
  const requestId = useRef(0);
  const [age, setAge] = useState(0);


  const load = useCallback(async () => {
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
    }
  }, [sportId, eventId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, 1000);
    const a = setInterval(() => setAge((v) => v + 1), 1000);
    return () => {
      clearInterval(t);
      clearInterval(a);
    };
  }, [load]);


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
    <div className="sports-theme mx-auto max-w-[1200px] px-4 py-6">
      <Link to="/sports" className="text-sm text-muted-foreground hover:text-foreground">
        ← Sports list
      </Link>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {SPORT_NAMES[sportId] ?? `Sport ${sportId}`}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">
        {data?.eventName ?? "Loading event…"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
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


      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <LiveTv
          sportId={sportId}
          eventId={eventId}
          className="overflow-hidden rounded-lg bg-ex-panel"
        />


        <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
          <header className="bg-[#24485D] px-4 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-white">
            Scoreboard
          </header>
          <Scoreboard sportId={sportId} eventId={eventId} />
        </div>

      </div>


      <p className="mt-6 flex items-center justify-between text-base font-bold text-foreground">
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
        <div className="mt-3 space-y-4">
          {matchOdds.length ? (
            <Section title="Match odds" count={matchOdds.length}>
              {matchOdds.map((m) => (
                <Board key={m.marketId} market={m} />
              ))}
            </Section>
          ) : null}

          {bookmakers.length ? (
            <Section title="Bookmaker" count={bookmakers.length}>
              {bookmakers.map((m) => (
                <Board key={m.marketId} market={m} />
              ))}
            </Section>
          ) : null}

          {fancy.length ? (
            <Section title="Fancy" count={fancy.length}>
              {fancy.map((m) => (
                <FancyRow key={m.marketId} market={m} />
              ))}
            </Section>
          ) : null}

          {sportsbook.length ? (
            <Section title="Sportsbook" count={sportsbook.length}>
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
