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
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[0.7rem] font-bold uppercase tracking-wide text-ex-muted">
        {title.replace(/_/g, " ")}
      </span>
      <div className="flex gap-1.5">
        {codes.map((c, i) => (
          <Card key={`${c}-${i}`} code={c} />
        ))}
      </div>
    </div>
  );
}

function MarketBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  return (
    <div className="overflow-hidden rounded-md bg-ex-panel">
      <header className="flex items-center justify-between bg-ex-header px-3 py-2">
        <h3 className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-ex-text">
          {market.marketName}
        </h3>
        <span className="text-[0.68rem] text-ex-muted">
          min {market.min ?? 0} · max {market.max ?? 0}
        </span>
      </header>
      <div className={`relative space-y-1 p-2 ${suspended ? "opacity-40" : ""}`}>
        {(market.runners ?? []).map((r) => {
          const back = r.price?.back?.[0];
          return (
            <div
              key={String(r.selectionId)}
              className="grid grid-cols-[1fr_92px] items-center gap-1 rounded bg-ex-row px-3 py-2"
            >
              <span className="truncate text-sm font-bold text-ex-text">
                {names[String(r.selectionId)] ?? String(r.selectionId)}
              </span>
              <span
                className={`flex flex-col items-center rounded py-1 text-sm font-bold ${
                  back ? "bg-ex-back text-ex-cell-foreground" : "bg-ex-back-dim text-ex-muted"
                }`}
              >
                {fmtOdds(back?.price)}
                <span className="text-[0.62rem] font-semibold opacity-80">
                  {fmtSize(back?.size)}
                </span>
              </span>
            </div>
          );
        })}
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Lobby
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Universe Live · {gameId}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {d?.eventName ?? "Loading game…"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            RID {d?.roundId ?? "—"} · status {status || "—"} · left {d?.leftSec ?? 0}s · betDelay{" "}
            {d?.betDelay ?? 0}s · age {age}s{state?.stale ? " · stale" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Source: Universal API <code className="font-mono">GET /games/{gameId}/state</code> ·{" "}
            <code className="font-mono">/games/{gameId}/results</code> · polled every 1s
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-live-pill px-3 py-1 text-sm font-semibold text-live-pill-foreground">
          <span className="h-2 w-2 rounded-full bg-current" /> Live
        </span>
      </div>

      {error ? <p className="mt-3 text-sm text-live-lose">{error}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-lg bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ex-text">
            Live TV
          </header>
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
        </div>
        <div className="overflow-hidden rounded-lg bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ex-text">
            Round cards
          </header>
          <div className="space-y-3 p-4">
            {Object.entries(cards).length ? (
              Object.entries(cards).map(([k, v]) =>
                typeof v === "object" ? <Cards key={k} title={k} hand={v} /> : null,
              )
            ) : (
              <p className="text-sm text-ex-muted">Cards appear when the round is dealt.</p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-base font-bold text-foreground">
        Live markets{" "}
        <span className="text-sm font-normal text-muted-foreground">
          · {markets.length} markets · {suspended ? "suspended" : "open"}
        </span>
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {markets.map((m) => (
          <MarketBoard key={m.marketId} market={m} suspended={suspended} />
        ))}
        {!markets.length ? (
          <p className="text-sm text-muted-foreground">Loading live markets…</p>
        ) : null}
      </div>

      <p className="mt-8 text-base font-bold text-foreground">
        Result history{" "}
        <span className="text-sm font-normal text-muted-foreground">
          · last {results.length} settled rounds
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

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ex-header text-ex-text">
            <tr>
              <th className="px-3 py-2 font-bold">Round ID</th>
              <th className="px-3 py-2 font-bold">Winner</th>
              <th className="px-3 py-2 font-bold">Cards</th>
              <th className="px-3 py-2 font-bold">Settled markets</th>
            </tr>
          </thead>
          <tbody>
            {results.slice(0, 12).map((r) => (
              <tr key={r.roundId} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.roundId}</td>
                <td className="px-3 py-2 font-bold text-foreground">{r.winner ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {Object.entries(r.cards ?? {})
                    .map(
                      ([k, v]) =>
                        `${k.replace(/_/g, " ")}: ${Object.values(v)
                          .map((c) => c.replace(/_+$/, ""))
                          .join(" ")}`,
                    )
                    .join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {(r.results ?? []).length}
                </td>
              </tr>
            ))}
            {!results.length ? (
              <tr>
                <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={4}>
                  Loading result history…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
