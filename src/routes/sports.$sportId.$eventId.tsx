import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  embedUrl,
  fetchOdds,
  fetchSessionToken,
  fmtInt,
  fmtOdds,
  fmtSize,
  runnerName,
  type Market,
  type OddsResponse,
} from "@/lib/uapi";

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

function Cell({ price, size, side }: { price?: number; size?: number; side: "back" | "lay" }) {
  const tone = side === "back" ? "bg-ex-back" : "bg-ex-lay";
  return (
    <div
      className={`flex h-11 flex-col items-center justify-center rounded-sm ${tone} ${
        price ? "" : "opacity-60"
      } text-ex-cell-foreground`}
    >
      <span className="text-sm font-bold leading-none">{fmtOdds(price)}</span>
      <span className="mt-0.5 text-[0.62rem] leading-none opacity-80">{fmtSize(size)}</span>
    </div>
  );
}

function Board({ market }: { market: Market }) {
  const odds = market.oddsData;
  const status = (odds?.status ?? "OPEN").toUpperCase();
  const suspended = status === "SUSPENDED" || status === "CLOSED";
  const runners = odds?.runners ?? [];

  return (
    <div className="overflow-hidden rounded-lg bg-ex-row">
      <header className="flex items-center justify-between border-b border-border/50 bg-ex-header px-3 py-2">
        <span
          className={`text-sm font-bold ${suspended ? "text-muted-foreground" : "text-foreground"}`}
        >
          {market.marketName.trim()}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Matched {fmtInt(odds?.totalMatched)}</span>
          <span className="font-bold uppercase">{status}</span>
        </span>
      </header>

      <div className="grid grid-cols-[1fr_repeat(6,minmax(52px,72px))] items-center gap-1 px-3 pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
        <span />
        <span className="col-span-3 text-center">Back</span>
        <span className="col-span-3 text-center">Lay</span>
      </div>

      <div className="relative space-y-1 p-3 pt-1">
        {runners.map((r) => {
          const back = [...(r.price?.back ?? [])].slice(0, 3).reverse();
          const lay = (r.price?.lay ?? []).slice(0, 3);
          return (
            <div
              key={String(r.selectionId)}
              className="grid grid-cols-[1fr_repeat(6,minmax(52px,72px))] items-center gap-1"
            >
              <span
                className={`truncate pr-2 text-sm font-semibold ${
                  suspended ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {runnerName(market, r.selectionId)}
              </span>
              {[0, 1, 2].map((i) => (
                <Cell key={`b${i}`} price={back[i]?.price} size={back[i]?.size} side="back" />
              ))}
              {[0, 1, 2].map((i) => (
                <Cell key={`l${i}`} price={lay[i]?.price} size={lay[i]?.size} side="lay" />
              ))}
            </div>
          );
        })}
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded bg-ex-row/85 px-6 py-2 text-sm font-extrabold uppercase tracking-wide text-foreground">
              {status === "CLOSED" ? "Closed" : "Suspended"}
            </span>
          </div>
        ) : null}
      </div>
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
    <section className="overflow-hidden rounded-xl border border-border/60 bg-ex-panel">
      <header className="flex items-center justify-between bg-ex-header px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

function EventPage() {
  const { sportId, eventId } = Route.useParams();
  const [data, setData] = useState<OddsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [age, setAge] = useState(0);

  const load = useCallback(async () => {
    try {
      const odds = await fetchOdds(sportId, eventId);
      setData(odds);
      setAge(0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load odds");
    }
  }, [sportId, eventId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    const a = setInterval(() => setAge((v) => v + 1), 1000);
    return () => {
      clearInterval(t);
      clearInterval(a);
    };
  }, [load]);

  useEffect(() => {
    fetchSessionToken()
      .then((r) => setToken(r.sessionToken))
      .catch(() => undefined);
  }, []);

  const matchOdds = data?.matchOdds ?? [];
  const bookmakers = data?.bookmakers ?? [];
  const fancy = data?.fancy ?? [];
  const sportsbook = data?.sportsbook ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
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

      {error ? <p className="mt-3 text-sm text-live-lose">{error}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            Live TV
          </header>
          {token ? (
            <iframe
              title="Live TV"
              src={embedUrl("player", sportId, eventId, token)}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              className="aspect-video w-full border-0 bg-table-felt"
            />
          ) : (
            <div className="aspect-video w-full bg-table-felt" />
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            Scoreboard
          </header>
          {token ? (
            <iframe
              title="Scoreboard"
              src={embedUrl("scoreboard", sportId, eventId, token)}
              className="h-[260px] w-full border-0 bg-table-felt"
            />
          ) : (
            <div className="h-[260px] w-full bg-table-felt" />
          )}
        </div>
      </div>

      <p className="mt-6 text-base font-bold text-foreground">
        Live odds{" "}
        <span className="text-sm font-normal text-muted-foreground">· auto-refresh every 2s</span>
      </p>

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
              <Board key={m.marketId} market={m} />
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
    </div>
  );
}
