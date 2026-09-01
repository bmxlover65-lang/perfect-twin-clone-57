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
  const hasLay = runners.some((r) => Boolean(r.price?.lay?.[0]?.price));
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-ex-line bg-ex-panel">
      <header className="bg-ex-header px-3 py-1.5">
        <h3 className="text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-ex-text">
          {market.marketName}
        </h3>
      </header>
      <div className="relative">
        <div
          className={`grid items-center border-b border-ex-line bg-ex-header/60 px-3 py-1.5 text-[0.72rem] font-bold text-ex-muted ${
            hasLay ? "grid-cols-[1fr_120px_120px]" : "grid-cols-[1fr_120px]"
          }`}
        >
          <span>Min/Max: {market.min ?? 0} - {market.max ?? 0}</span>
          <span className="text-center">{hasLay ? "Back" : ""}</span>
          {hasLay ? <span className="text-center">Lay</span> : null}
        </div>
        {runners.map((r) => {
          const back = r.price?.back?.[0];
          const lay = r.price?.lay?.[0];
          const cell = (
            p: { price?: number | string; size?: number | string } | undefined,
            side: "back" | "lay",
          ) => {
            const open = Boolean(p?.price) && !suspended;
            const cls = open
              ? side === "back"
                ? "bg-ex-back text-ex-cell-foreground"
                : "bg-ex-lay text-ex-cell-foreground"
              : side === "back"
                ? "bg-ex-back-dim text-ex-muted"
                : "bg-ex-lay-dim text-ex-muted";
            return (
              <div className={`flex h-[46px] flex-col items-center justify-center ${cls}`}>
                <span className="text-sm font-bold leading-none">{fmtOdds(p?.price)}</span>
                <span className="mt-0.5 text-[0.66rem] font-semibold opacity-80">
                  {fmtSize(p?.size)}
                </span>
              </div>
            );
          };
          return (
            <div
              key={String(r.selectionId)}
              className={`grid items-center gap-px border-b border-ex-line last:border-0 ${
                hasLay ? "grid-cols-[1fr_120px_120px]" : "grid-cols-[1fr_120px]"
              }`}
            >
              <span className="truncate px-3 text-[0.82rem] font-bold uppercase text-ex-text">
                {names[String(r.selectionId)] ?? String(r.selectionId)}
              </span>
              {cell(back, "back")}
              {hasLay ? cell(lay, "lay") : null}
            </div>
          );
        })}
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-lg font-extrabold uppercase tracking-[0.14em] text-white">
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
