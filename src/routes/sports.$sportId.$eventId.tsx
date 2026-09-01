import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { findEvent, sportName } from "@/data/sports";
import {
  buildBoards,
  buildFancy,
  buildSportsbook,
  fmtInt,
  fmtOdds,
  fmtSize,
  type MarketBoard,
  type PriceCell,
} from "@/lib/sports-engine";

export const Route = createFileRoute("/sports/$sportId/$eventId")({
  head: ({ params }) => {
    const ev = findEvent(params.sportId, params.eventId);
    const title = ev ? `${ev.name} — Live Odds | Universal API` : "Event — Universal API";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: ev
            ? `Live match odds, bookmaker, fancy and sportsbook markets for ${ev.name} with TV and scoreboard.`
            : "Live sports event odds via the Universal API.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: ev ? `Live exchange odds for ${ev.name}.` : "Live sports event odds.",
        },
      ],
    };
  },
  loader: ({ params }) => {
    if (!findEvent(params.sportId, params.eventId)) throw notFound();
    return null;
  },
  component: EventPage,
});

function useTick(ms = 1000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return tick;
}

function Cell({ cell, side }: { cell: PriceCell; side: "back" | "lay" }) {
  const tone = side === "back" ? "bg-ex-back" : "bg-ex-lay";
  return (
    <div
      className={`flex h-11 flex-col items-center justify-center rounded-sm ${tone} ${
        cell.price === null ? "opacity-60" : ""
      } text-ex-cell-foreground`}
    >
      <span className="text-sm font-bold leading-none">
        {cell.price === null ? "—" : fmtOdds(cell.price)}
      </span>
      <span className="mt-0.5 text-[0.62rem] leading-none opacity-80">
        {cell.price === null ? "" : fmtSize(cell.size)}
      </span>
    </div>
  );
}

function Board({ board }: { board: MarketBoard }) {
  const suspended = board.status === "SUSPENDED";
  return (
    <div className="overflow-hidden rounded-lg bg-ex-row">
      <header className="flex items-center justify-between border-b border-border/50 bg-ex-header px-3 py-2">
        <span className={`text-sm font-bold ${suspended ? "text-muted-foreground" : "text-foreground"}`}>
          {board.title}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Matched {fmtInt(board.matched)}</span>
          <span className="font-bold uppercase">{board.status}</span>
        </span>
      </header>

      <div className="grid grid-cols-[1fr_repeat(6,minmax(52px,72px))] items-center gap-1 px-3 pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
        <span />
        <span className="col-span-3 text-center">Back</span>
        <span className="col-span-3 text-center">Lay</span>
      </div>

      <div className="relative space-y-1 p-3 pt-1">
        {board.runners.map((r) => (
          <div
            key={r.name}
            className="grid grid-cols-[1fr_repeat(6,minmax(52px,72px))] items-center gap-1"
          >
            <span
              className={`truncate pr-2 text-sm font-semibold ${
                suspended ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {r.name}
            </span>
            {r.back.map((c, i) => (
              <Cell key={`b${i}`} cell={c} side="back" />
            ))}
            {r.lay.map((c, i) => (
              <Cell key={`l${i}`} cell={c} side="lay" />
            ))}
          </div>
        ))}
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded bg-ex-row/85 px-6 py-2 text-sm font-extrabold uppercase tracking-wide text-foreground">
              Suspended
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
  const tick = useTick();
  const ev = findEvent(sportId, eventId);
  if (!ev) return null;

  const boards = buildBoards(ev, tick);
  const fancy = buildFancy(ev, tick);
  const sportsbook = buildSportsbook(ev, tick);
  const matched = ev.matched + (ev.inPlay ? tick * 13 : 0);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <Link to="/sports" className="text-sm text-muted-foreground hover:text-foreground">
        ← Sports list
      </Link>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {sportName(sportId)}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{ev.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {sportId}/{eventId} · {ev.inPlay ? "in-play" : "pre-match"} · matched {fmtInt(matched)} ·
        age 0.{tick % 10}s · betDelay {ev.inPlay ? 6 : 0}s
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            Live TV
          </header>
          <div className="aspect-video w-full bg-table-felt" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-ex-panel">
          <header className="bg-ex-header px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            Scoreboard
          </header>
          <div className="bg-table-felt p-4 text-board-body-foreground">
            <div className="grid grid-cols-[1fr_repeat(5,auto)] gap-x-3 text-[0.65rem] font-bold uppercase tracking-wide opacity-70">
              <span />
              <span>Score</span>
              <span>Ovs</span>
              <span>RR</span>
              <span>4s</span>
              <span>6s</span>
            </div>
            {ev.runners.slice(0, 2).map((r, i) => (
              <div
                key={r}
                className="mt-3 grid grid-cols-[1fr_repeat(5,auto)] items-center gap-x-3 border-b border-white/10 pb-3 text-sm"
              >
                <span className="flex items-center gap-2 font-bold">
                  {i === 1 ? (
                    <span className="rounded bg-brand-mark px-1 text-[0.6rem] font-bold text-white">
                      BAT
                    </span>
                  ) : null}
                  {r
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
                <span className="font-bold">{i === 1 ? `${180 + (tick % 40)}-4` : "—"}</span>
                <span>{i === 1 ? "19.0" : ""}</span>
                <span>{i === 1 ? "11.79" : ""}</span>
                <span>{i === 1 ? "14" : ""}</span>
                <span>{i === 1 ? "9" : ""}</span>
              </div>
            ))}
            <p className="mt-3 text-center text-xs opacity-70">Last balls: w,2,6,0,4,ww</p>
            <div className="mt-2 flex justify-center gap-2">
              {["w", "2", "6", "•", "4", "ww"].map((b, i) => (
                <span
                  key={i}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[0.65rem] font-bold"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-base font-bold text-foreground">
        Live odds <span className="text-sm font-normal text-muted-foreground">· live via WebSocket</span>
      </p>

      <div className="mt-3 space-y-4">
        <Section title="Match odds" count={1}>
          {boards[0] ? <Board board={boards[0]} /> : null}
        </Section>
        <Section title="Bookmaker" count={1}>
          {boards[1] ? <Board board={boards[1]} /> : null}
        </Section>

        {fancy.length ? (
          <Section title="Fancy" count={fancy.length}>
            {fancy.map((f) => (
              <div
                key={f.title}
                className="flex items-center justify-between gap-3 rounded-lg bg-ex-row px-3 py-2"
              >
                <span className="text-sm font-semibold text-foreground">{f.title}</span>
                <div className="flex items-center gap-1">
                  <div className="flex h-11 w-[72px] flex-col items-center justify-center rounded-sm bg-ex-lay text-ex-cell-foreground">
                    <span className="text-sm font-bold leading-none">{f.no.price}</span>
                    <span className="text-[0.62rem] opacity-80">{f.no.size}</span>
                  </div>
                  {f.tag ? (
                    <span className="px-1 text-[0.55rem] font-bold uppercase text-muted-foreground [writing-mode:vertical-rl]">
                      {f.tag}
                    </span>
                  ) : null}
                  <div className="flex h-11 w-[72px] flex-col items-center justify-center rounded-sm bg-ex-back text-ex-cell-foreground">
                    <span className="text-sm font-bold leading-none">{f.yes.price}</span>
                    <span className="text-[0.62rem] opacity-80">{f.yes.size}</span>
                  </div>
                </div>
              </div>
            ))}
          </Section>
        ) : null}

        {sportsbook.length ? (
          <Section title="Sportsbook" count={sportsbook.length}>
            {sportsbook.map((sb) => (
              <div key={sb.title} className="overflow-hidden rounded-lg bg-ex-row">
                <header className="flex items-center justify-between border-b border-border/50 bg-ex-header px-3 py-2">
                  <span className="text-sm font-bold text-foreground">{sb.title}</span>
                  <span className="flex gap-3 text-xs text-muted-foreground">
                    <span>Matched {fmtInt(sb.matched)}</span>
                    <span className="font-bold">ONLINE</span>
                  </span>
                </header>
                <div className="space-y-1 p-3">
                  {sb.rows.map((row) => (
                    <div
                      key={row.name}
                      className="grid grid-cols-[1fr_repeat(6,minmax(52px,72px))] items-center gap-1"
                    >
                      <span className="text-sm text-foreground">{row.name}</span>
                      <Cell cell={{ price: null, size: 0 }} side="back" />
                      <Cell cell={{ price: null, size: 0 }} side="back" />
                      <Cell cell={{ price: row.price, size: row.size }} side="back" />
                      <Cell cell={{ price: null, size: 0 }} side="lay" />
                      <Cell cell={{ price: null, size: 0 }} side="lay" />
                      <Cell cell={{ price: null, size: 0 }} side="lay" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}
