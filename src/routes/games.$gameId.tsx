import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  fetchCasinoResults,
  fetchCasinoState,
  fetchCasinoStream,
  fmtOdds,
  fmtSize,
  type CasinoMarket,
  type CasinoResult,
  type CasinoState,
} from "@/lib/uapi";

export const Route = createFileRoute("/games/$gameId")({
  head: ({ params }) => {
    const title = `Live game ${params.gameId} — Universal API`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Live round state, markets, odds, cards and settled result history for casino game ${params.gameId} from the Universal API.`,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Live casino round state, odds and result history.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: GamePage,
});

function Card({ code }: { code: string }) {
  const clean = code.replace(/_+$/, "");
  const suit = clean.slice(0, 1);
  const rank = clean.slice(1);
  const map: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const red = suit === "H" || suit === "D";
  return (
    <span
      className={`inline-flex h-11 w-8 flex-col items-center justify-center rounded bg-white text-[0.7rem] font-bold leading-none shadow ${
        red ? "text-red-600" : "text-black"
      }`}
    >
      <span>{rank || "?"}</span>
      <span className="text-sm">{map[suit] ?? "?"}</span>
    </span>
  );
}

function Cards({ hand, title }: { hand: Record<string, string>; title: string }) {
  const codes = Object.values(hand).filter(Boolean);
  if (!codes.length) return null;
  return (
    <div>
      <p className="text-[0.68rem] font-extrabold uppercase tracking-wide text-white drop-shadow">
        {title.replace(/_/g, " ")}
      </p>
      <div className="mt-0.5 flex gap-1">
        {codes.map((c, i) => (
          <Card key={`${c}-${i}`} code={c} />
        ))}
      </div>
    </div>
  );
}

function MarketBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  return (
    <div className="mt-3 overflow-hidden rounded-md bg-ex-panel">
      <header className="flex items-center justify-between bg-ex-header px-3 py-2">
        <h3 className="text-[0.8rem] font-extrabold uppercase tracking-[0.06em] text-ex-text">
          {market.marketName}
        </h3>
        <span className="text-[0.72rem] text-ex-muted">
          Min/Max: {market.min ?? 0} - {market.max ?? 0}
        </span>
      </header>
      <div className="relative p-3">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(Math.max(runners.length, 1), 4)}, minmax(0,1fr))`,
          }}
        >
          {runners.map((r) => {
            const back = r.price?.back?.[0];
            const open = Boolean(back?.price) && !suspended;
            return (
              <div key={String(r.selectionId)} className="text-center">
                <p className="truncate text-[0.78rem] font-bold uppercase tracking-wide text-ex-text">
                  {names[String(r.selectionId)] ?? String(r.selectionId)}
                </p>
                <div
                  className={`mt-1.5 flex flex-col items-center justify-center rounded py-2 ${
                    open ? "bg-ex-back text-ex-cell-foreground" : "bg-ex-back-dim text-ex-muted"
                  }`}
                >
                  <span className="text-base font-bold leading-none">{fmtOdds(back?.price)}</span>
                  <span className="mt-1 text-[0.68rem] font-semibold opacity-80">
                    {fmtSize(back?.size)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="text-sm font-extrabold uppercase tracking-[0.25em] text-ex-text">
              Suspended
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GamePage() {
  const { gameId } = Route.useParams();
  const [state, setState] = useState<CasinoState | null>(null);
  const [results, setResults] = useState<CasinoResult[]>([]);
  const [stream, setStream] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [age, setAge] = useState(0);

  const load = useCallback(async () => {
    try {
      const s = await fetchCasinoState(gameId);
      setState(s);
      setAge(0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load live state");
    }
  }, [gameId]);

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
    let alive = true;
    const run = () =>
      fetchCasinoResults(gameId)
        .then((r) => alive && setResults(r.data ?? []))
        .catch(() => undefined);
    void run();
    const t = setInterval(run, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [gameId]);

  useEffect(() => {
    fetchCasinoStream(gameId)
      .then((r) => setStream(r.upstreamIframeUrl ?? null))
      .catch(() => undefined);
  }, [gameId]);

  const d = state?.data ?? null;
  const status = (d?.status ?? "").toUpperCase();
  const suspended = status !== "ONLINE";
  const markets = d?.marketArr ?? [];
  const cards = (d?.cardsArr ?? {}) as Record<string, Record<string, string>>;

  return (
    <div className="sports-theme mx-auto max-w-[900px] px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to lobby
          </Link>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Live · Universe Live
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {d?.eventName ?? "Loading game…"}
          </h1>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-live-pill px-3 py-1 text-sm font-semibold text-live-pill-foreground">
          <span className="h-2 w-2 rounded-full bg-current" /> Live
        </span>
      </div>

      {error ? <p className="mt-3 text-sm text-live-lose">{error}</p> : null}

      <div className="relative mt-4 overflow-hidden rounded-md bg-black">
        {stream ? (
          <iframe
            title="Live game stream"
            src={stream}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            className="aspect-video w-full border-0 bg-black"
          />
        ) : (
          <div className="aspect-video w-full bg-black" />
        )}
        <div className="pointer-events-none absolute left-2 top-2 space-y-1">
          <p className="text-[0.72rem] font-extrabold uppercase tracking-wide text-white drop-shadow">
            RID: {d?.roundId ?? "—"}
          </p>
          {Object.entries(cards).map(([k, v]) =>
            typeof v === "object" ? <Cards key={k} title={k} hand={v} /> : null,
          )}
        </div>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-[0.72rem] font-bold text-white">
          {status || "—"} · {d?.leftSec ?? 0}s
        </span>
      </div>

      {markets.map((m) => (
        <MarketBoard key={m.marketId} market={m} suspended={suspended} />
      ))}
      {!markets.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading live markets…</p>
      ) : null}

      <p className="mt-6 text-base font-bold text-foreground">
        Last results{" "}
        <span className="text-sm font-normal text-muted-foreground">
          · {results.length} settled rounds
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {results.map((r) => (
          <span
            key={r.roundId}
            title={`Round ${r.roundId}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ex-panel text-sm font-bold text-ex-text"
          >
            {r.winner ?? "-"}
          </span>
        ))}
      </div>
    </div>
  );
}
