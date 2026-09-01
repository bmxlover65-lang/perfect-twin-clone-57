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
  const tone =
    side === "back" ? (has ? "bg-ex-back" : "bg-ex-back-dim") : has ? "bg-ex-lay" : "bg-ex-lay-dim";
  return (
    <div
      className={`flex h-[52px] flex-col items-center justify-center rounded-sm ${tone} ${
        dim ? "opacity-40" : ""
      } text-ex-cell-foreground`}
    >
      <span className="text-[0.88rem] font-bold leading-none">{fmtOdds(price)}</span>
      {has && size ? (
        <span className="mt-1 text-[0.65rem] leading-none opacity-80">{fmtSize(size)}</span>
      ) : null}
    </div>
  );
}

const GRID = "grid grid-cols-[1fr_repeat(6,minmax(72px,96px))] items-center gap-1.5";


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
    <header className="flex items-center justify-between border-b border-ex-line/60 bg-ex-row px-4 py-3">
      <span className={`text-[0.95rem] font-bold ${dim ? "text-ex-muted" : "text-ex-text"}`}>{name}</span>
      <span className={`flex items-center gap-4 text-[0.78rem] ${dim ? "text-ex-muted/70" : "text-ex-muted"}`}>
        <span>Matched {fmtInt(matched)}</span>
        <span className="font-bold uppercase tracking-wide text-ex-text">{status}</span>
      </span>
    </header>
  );
}

function BackLayHead() {
  return (
    <div
      className={`${GRID} border-b border-ex-line/40 px-4 py-1.5 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ex-muted`}
    >

      <span />
      <span className="col-span-3 text-center">Back</span>
      <span className="col-span-3 text-center">Lay</span>
    </div>
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
      <BackLayHead />
      <div className="relative">
        {runners.map((r) => {
          const back = [...(r.price?.back ?? [])].slice(0, 3).reverse();
          const lay = (r.price?.lay ?? []).slice(0, 3);
          return (
            <div
              key={String(r.selectionId)}
              className={`${GRID} border-b border-ex-line/30 px-4 py-2 last:border-b-0`}
            >
              <span
                className={`truncate pr-2 text-[0.95rem] font-bold ${dim ? "text-ex-muted" : "text-ex-text"}`}
              >

                {runnerName(market, r.selectionId)}
              </span>
              {[0, 1, 2].map((i) => (
                <Cell key={`b${i}`} price={back[i]?.price} size={back[i]?.size} side="back" dim={dim} />
              ))}
              {[0, 1, 2].map((i) => (
                <Cell key={`l${i}`} price={lay[i]?.price} size={lay[i]?.size} side="lay" dim={dim} />
              ))}
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
    const t = setInterval(() => void load(), 1000);
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
      <p className="mt-1 text-xs text-muted-foreground">
        Source: Universal API <code className="font-mono">GET /sports/{sportId}/{eventId}/odds</code>{" "}
        via server proxy, polled every 1s · TV &amp; scoreboard iframes minted with a live session
        token
      </p>


      {error ? <p className="mt-3 text-sm text-live-lose">{error}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ex-text">
            Live TV
          </header>
          {token ? (
            <iframe
              title="Live TV"
              src={embedUrl("tv", sportId, eventId, token)}
              className="h-[340px] w-full border-0 bg-black"
            />
          ) : (
            <div className="h-[340px] w-full bg-black" />
          )}
        </div>

        <div className="overflow-hidden rounded-lg bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ex-text">
            Scoreboard
          </header>
          {token ? (
            <iframe
              title="Scoreboard"
              src={embedUrl("scoreboard", sportId, eventId, token)}
              className="h-[340px] w-full border-0 bg-black"
            />
          ) : (
            <div className="h-[340px] w-full bg-black" />
          )}
        </div>
      </div>


      <p className="mt-6 text-base font-bold text-foreground">
        Live odds <span className="text-sm font-normal text-muted-foreground">· live via WebSocket</span>
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

    </div>
  );
}
