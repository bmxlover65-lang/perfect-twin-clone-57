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

function BaccaratBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const label = (r: (typeof runners)[number]) =>
    (names[String(r.selectionId)] ?? String(r.selectionId)).toUpperCase();
  const tone = (l: string) =>
    l.includes("BANKER") ? "bg-[#C3213A]" : l.includes("TIE") ? "bg-[#118A46]" : "bg-[#1272CE]";
  const tie = runners.find((r) => label(r).includes("TIE"));
  const sides = runners.filter((r) => !label(r).includes("TIE"));

  const Body = ({ r }: { r: (typeof runners)[number] }) => {
    const p = r.price?.back?.[0];
    return (
      <div className="text-center text-white">
        <p className="text-[0.82rem] font-extrabold uppercase tracking-wide">{label(r)}</p>
        <p className="text-sm font-bold">{fmtOdds(p?.price)}</p>
        <p className="text-[0.7rem] opacity-85">{fmtSize(p?.size)}</p>
      </div>
    );
  };

  return (
    <div className="mt-3">
      <p className="mb-1 text-right text-[0.72rem] font-semibold text-ex-muted">
        Min/Max: {market.min ?? 0} - {market.max ?? 0}
      </p>
      <div className="relative flex items-stretch gap-2 overflow-hidden rounded-xl">
        {sides.map((r) => (
          <div
            key={String(r.selectionId)}
            className={`flex flex-1 items-center justify-center py-5 ${tone(label(r))} ${
              tie ? "first:rounded-l-xl last:rounded-r-xl" : "rounded-xl"
            }`}
          >
            <Body r={r} />
          </div>
        ))}
        {tie ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-[92px] w-[92px] items-center justify-center rounded-full border-2 border-black/40 bg-[#118A46]">
              <Body r={tie} />
            </div>
          </div>
        ) : null}
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="text-xl font-extrabold uppercase tracking-[0.14em] text-white">
              Suspended
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MarketBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const hasLay = runners.some((r) => Boolean(r.price?.lay?.[0]?.price));
  const cols = hasLay ? "grid-cols-[1fr_130px_130px]" : "grid-cols-[1fr_130px]";
  const labels = runners.map((r) =>
    (names[String(r.selectionId)] ?? "").toString().toUpperCase(),
  );
  if (
    !hasLay &&
    runners.length >= 2 &&
    runners.length <= 3 &&
    labels.some((l) => l.includes("PLAYER")) &&
    labels.some((l) => l.includes("BANKER"))
  ) {
    return <BaccaratBoard market={market} suspended={suspended} />;
  }


  const cell = (
    p: { price?: number | null; size?: number | null } | undefined,
    side: "back" | "lay",
  ) => {
    const open = Boolean(p?.price) && !suspended;
    if (!open) {
      return (
        <div className="m-[3px] flex h-[46px] items-center justify-center border border-[#e0403f] bg-white">
          <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-[#e0403f]">
            Suspended
          </span>
        </div>
      );
    }
    return (
      <div
        className={`m-[3px] flex h-[46px] flex-col items-center justify-center ${
          side === "back" ? "bg-[#A7D8F0]" : "bg-[#F3C0CB]"
        }`}
      >
        <span className="text-sm font-bold leading-none text-[#111]">{fmtOdds(p?.price)}</span>
        <span className="mt-0.5 text-[0.66rem] font-semibold text-[#111]/70">
          {fmtSize(p?.size)}
        </span>
      </div>
    );
  };

  return (
    <div className="mt-3 overflow-hidden border border-[#d9d9d9] bg-white">
      <header className="flex items-center justify-between bg-black px-2 py-1">
        <h3 className="text-[0.78rem] font-extrabold uppercase tracking-[0.04em] text-white">
          {market.marketName}
        </h3>
        <span className="text-[0.7rem] font-bold text-white">
          Min/Max: {market.min ?? 0} - {market.max ?? 0}
        </span>
      </header>
      <div className="relative">
        {hasLay ? (
          <div className={`grid ${cols} bg-white`}>
            <span />
            <span className="m-[3px] bg-[#A7D8F0] py-1 text-center text-[0.75rem] font-semibold text-[#111]/55">
              Back
            </span>
            <span className="m-[3px] bg-[#F3C0CB] py-1 text-center text-[0.75rem] font-semibold text-[#111]/55">
              Lay
            </span>
          </div>
        ) : null}
        {runners.map((r) => (
          <div
            key={String(r.selectionId)}
            className={`grid items-center border-t border-[#e6e6e6] ${cols}`}
          >
            <span className="truncate px-2 py-2 text-[0.82rem] font-bold uppercase text-[#3a6a8c]">
              {names[String(r.selectionId)] ?? String(r.selectionId)}
            </span>
            {cell(r.price?.back?.[0], "back")}
            {hasLay ? cell(r.price?.lay?.[0], "lay") : null}
          </div>
        ))}
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-extrabold uppercase tracking-wide text-[#8a9199]">
              Suspended
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ABRunner = {
  id: string;
  label: string;
  price?: number | null;
  open: boolean;
};

function AndarBaharPanel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  const byName = (n: string) => markets.find((m) => (m.marketName ?? "").toUpperCase() === n);
  const list = (m?: CasinoMarket): ABRunner[] =>
    (m?.runners ?? []).map((r) => ({
      id: String(r.selectionId),
      label: (m?.runnersName ?? {})[String(r.selectionId)] ?? String(r.selectionId),
      price: r.price?.back?.[0]?.price,
      open: !suspended && (r.status ?? "").toUpperCase() === "ACTIVE",
    }));

  const winner = list(byName("WINNER"));
  const side = list(byName("SIDE BET"));
  const oddEven = list(byName("ODD/EVEN"));
  const suits = list(byName("CARD SUIT"));
  const cards = list(byName("LUCKY CARD"));
  const minmax = byName("WINNER");

  const Price = ({ r }: { r: ABRunner }) => (
    <span className="relative inline-flex items-center justify-center">
      <span>{fmtOdds(r.price)}</span>
      {!r.open ? <span className="absolute text-[0.85em]">🔒</span> : null}
    </span>
  );

  const Chip = ({ r, kind }: { r: ABRunner; kind: "side" | "bet" }) => (
    <div
      className={`flex h-[52px] w-[112px] flex-col items-center justify-center rounded border-2 border-[#E3C000] text-[0.78rem] font-extrabold leading-tight ${
        kind === "side"
          ? r.open
            ? "bg-white text-black"
            : "bg-[#9A9A93] text-black/60"
          : r.open
            ? "bg-[#1272CE] text-white"
            : "bg-[#173049] text-white/45"
      }`}
    >
      <span className="uppercase">{r.label}</span>
      <Price r={r} />
    </div>
  );

  const Bar = ({ r, className = "" }: { r: ABRunner; className?: string }) => (
    <div
      className={`flex h-9 items-center justify-center rounded text-[0.95rem] font-bold ${
        r.open ? "bg-[#3D6480] text-white" : "bg-[#3D6480] text-black/70"
      } ${className}`}
    >
      <Price r={r} />
    </div>
  );

  const suitGlyph: Record<string, { s: string; red: boolean }> = {
    SPADES: { s: "♠", red: false },
    HEARTS: { s: "♥", red: true },
    DIAMONDS: { s: "♦", red: true },
    CLUBS: { s: "♣", red: false },
  };

  const group = (letter: "A" | "B") => {
    const s = side.find((r) => r.label.toUpperCase().endsWith(letter));
    const b1 = winner.find((r) => r.label.toUpperCase().startsWith("1ST") && r.label.endsWith(letter));
    const b2 = winner.find((r) => r.label.toUpperCase().startsWith("2ST") && r.label.endsWith(letter));
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg font-extrabold text-black">{letter}</span>
        {s ? <Chip r={s} kind="side" /> : null}
        {b1 ? <Chip r={b1} kind="bet" /> : null}
        {b2 ? <Chip r={b2} kind="bet" /> : null}
        <span className="text-lg font-extrabold text-black">{letter}</span>
      </div>
    );
  };

  return (
    <div className="mt-1 bg-[#E4E4E4] px-3 py-3">
      <p className="mb-1 text-right text-[0.7rem] font-bold text-black/60">
        Min/Max: {minmax?.min ?? 0} - {minmax?.max ?? 0}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {group("A")}
        {group("B")}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        {["EVEN", "ODD"].map((n) => {
          const r = oddEven.find((x) => x.label.toUpperCase() === n);
          if (!r) return <div key={n} />;
          return (
            <div key={n}>
              <p className="mb-1 text-center text-lg font-extrabold text-black">{n}</p>
              <Bar r={r} />
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-4">
        {suits.map((r) => {
          const g = suitGlyph[r.label.toUpperCase()] ?? { s: "?", red: false };
          return (
            <div key={r.id}>
              <p
                className={`mb-1 text-center text-2xl leading-none ${
                  g.red ? "text-[#E01B24]" : "text-black"
                }`}
              >
                {g.s}
              </p>
              <Bar r={r} />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {cards.map((r) => (
          <div key={r.id} className="text-center">
            <div
              className={`flex h-[52px] w-[52px] flex-col items-center justify-center rounded border border-black/25 ${
                r.open ? "bg-[#C9C9BE]" : "bg-[#9A9A93]"
              }`}
            >
              <span className="text-lg font-extrabold leading-none text-black/70">{r.label}</span>
              <span className="text-[0.6rem] leading-none">
                <span className="text-black/70">♣</span>
                <span className="text-[#E01B24]">♥</span>
              </span>
              {!r.open ? <span className="absolute text-xs">🔒</span> : null}
            </div>
            <p className="mt-0.5 text-[0.72rem] font-bold text-[#E01B24]">{fmtOdds(r.price)}</p>
          </div>
        ))}
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
    <div className="mx-auto max-w-[900px] px-4 py-5">
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

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md bg-ex-panel px-3 py-2">
        <span className="mr-1 text-base font-bold text-ex-text">Recent Result</span>
        {results.slice(0, 10).map((r) => {
          const w = (r.winner ?? "-").toString().trim();
          const lower = w.toLowerCase();
          const isTie = lower.startsWith("tie") || lower.startsWith("draw");
          const first = isTie ? "Tie" : w.slice(0, 1).toUpperCase();
          const tone = isTie
            ? "bg-[#8CD9B5] text-[#0F172A]"
            : first === "L"
              ? "bg-[#8E44C7] text-white"
              : ["B", "T"].includes(first)
                ? "bg-ex-lay text-ex-cell-foreground"
                : "bg-ex-back text-ex-cell-foreground";
          return (
            <span
              key={r.roundId}
              title={`Round ${r.roundId}`}
              className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-bold ${tone}`}
            >
              {first || "-"}
            </span>
          );
        })}
      </div>

    </div>
  );
}
