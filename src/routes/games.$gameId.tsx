import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Aviator } from "@/components/Aviator";
import { FitBoard } from "@/components/FitBoard";
import { RoundTimer } from "@/components/RoundTimer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEmbed } from "@/lib/embed";

import { applyOverride, useAdminConfig } from "@/lib/admin";
import { logResult } from "@/lib/telemetry";
import { BalanceChip, BetLayer } from "@/components/betting";
import { settleLatest, settleRound } from "@/lib/wallet";
import { CoinStageImage, HeadsTailsPanel } from "@/components/HeadsTails";

import { CardFace } from "@/components/CardFace";
import { cardImage } from "@/lib/card-assets";



import dream1x from "@/assets/dream/note1.png.asset.json";
import dream2x from "@/assets/dream/note2.png.asset.json";
import dream5x from "@/assets/dream/note5.png.asset.json";
import dream10x from "@/assets/dream/note10.png.asset.json";
import dream20x from "@/assets/dream/note20.png.asset.json";
import dream40x from "@/assets/dream/note40.png.asset.json";

import {
  BallByBallBoard,
  BalloonStage,
  DreamWheel,
  LuckyWheel,
  type BbbRunner,
} from "@/components/OriginalStages";
import ballByBallBanner from "@/assets/games/ballbyball.gif.asset.json";
import chip1k from "@/assets/chips/chips1k.svg.asset.json";
import chip5 from "@/assets/chips/chips5.svg.asset.json";
import chip10 from "@/assets/chips/chips10.svg.asset.json";
import chip20 from "@/assets/chips/chips20.svg.asset.json";
import chip50 from "@/assets/chips/chips50.svg.asset.json";
import chip100 from "@/assets/chips/chips100.svg.asset.json";
import chip200 from "@/assets/chips/chips200.svg.asset.json";
import chip500 from "@/assets/chips/chips500.svg.asset.json";



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


/** Strip table-suffixes like " - A" / " B" from the feed's event name. */
function cleanGameName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const cleaned = name.replace(/\s*[-–]\s*[A-Z]$/i, "").trim().replace(/\bVIMAN\b/gi, "VIMAAN");
  return /card\s*race/i.test(cleaned) ? "CARD RACE" : cleaned;
}


/** Andar Bahar shows the two rows as plain "A" / "B" like the live table. */
function isAndarBahar(name?: string | null): boolean {
  return /andar\s*bahar/i.test(name ?? "");
}

function handTitleFor(title: string, gameName?: string | null): string {
  if (!isAndarBahar(gameName)) return title;
  const t = title.toUpperCase();
  if (/ANDAR|CAN\b|CARDSCAN/.test(t)) return "A";
  if (/BAHAR|ARR\b|CARDSARR/.test(t)) return "B";
  return title;
}

function Card({ code }: { code: string }) {
  return <CardFace code={code} />;
}







function Cards({ hand, title }: { hand: Record<string, string>; title: string }) {
  const flatten = (v: unknown): string[] => {
    if (v === undefined || v === null) return [];
    if (Array.isArray(v)) return v.flatMap(flatten);
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).flatMap(flatten);
    return [String(v)];
  };
  const codes = flatten(hand);
  if (!codes.length) return null;
  return (
    <div>
      <p className="text-[0.55rem] font-bold uppercase tracking-wide text-white drop-shadow sm:text-[0.7rem]">
        {title.replace(/_/g, " ").toUpperCase()}
      </p>
      <div className="mt-0.5 flex flex-wrap justify-center gap-0">

        {codes.map((c, i) => (
          <Card key={`${c}-${i}`} code={c} />
        ))}
      </div>
    </div>
  );
}

const OPEN_STATUSES = new Set(["ONLINE", "ACTIVE", "OPEN", "IN_PLAY"]);
function isOpenStatus(status?: string | null) {
  return OPEN_STATUSES.has((status ?? "").toUpperCase());
}

/** Original-style suspended veil: faded market background + bold red SUSPENDED text. */
function SuspendVeil({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <div
      data-suspended="true"
      className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-casino-suspend-veil ${className}`}
    >
      <span
        className={`font-extrabold uppercase tracking-[0.06em] text-casino-suspend-text ${
          size === "sm" ? "text-[1.15rem]" : "text-[1.5rem] sm:text-[1.8rem]"
        }`}
      >
        SUSPENDED
      </span>
    </div>
  );
}



function BaccaratPanel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  type R = { id: string; label: string; price?: number | null | undefined; size?: number | null | undefined; open: boolean };
  const byName = (n: string) => markets.find((m) => (m.marketName ?? "").toUpperCase() === n);
  const list = (m?: CasinoMarket): R[] =>
    (m?.runners ?? []).map((r) => ({
      id: String(r.selectionId),
      label: ((m?.runnersName ?? {})[String(r.selectionId)] ?? String(r.selectionId)).toUpperCase(),
      price: r.price?.back?.[0]?.price,
      size: r.price?.back?.[0]?.size,
      open: !suspended && isOpenStatus(r.status),
    }));

  const winner = list(byName("WINNER"));
  const tie = list(byName("TIE"))[0];
  const pair = list(byName("PAIR"));
  const mm = byName("WINNER");

  const Body = ({ r }: { r: R }) => (
    <div className="text-center text-white">
      <p className="text-[0.95rem] font-extrabold uppercase tracking-wide">{r.label}</p>
      <p className="text-[0.95rem] font-bold">{fmtOdds(r.price)}</p>
      <p className="text-[0.72rem] opacity-90">{fmtSize(r.size)}</p>
    </div>
  );

  const tone = (l: string) => (l.includes("BANKER") ? "bg-[#C22539]" : "bg-[#1173CE]");
  const groupSuspended = (rs: R[]) => rs.length > 0 && rs.every((r) => !r.open);

  const Overlay = () => <SuspendVeil />;


  const winnerSusp = groupSuspended([...winner, ...(tie ? [tie] : [])]);
  const pairSusp = groupSuspended(pair);

  return (
    <div className="mt-0 space-y-2 bg-casino-market-body px-2 pb-2 pt-1">
      <p className="text-right text-[0.72rem] font-semibold text-casino-market-text/70">
        Min/Max: {mm?.min ?? 0} - {mm?.max ?? 0}
      </p>
      <div className="relative flex items-stretch overflow-hidden">
        {winner.map((r) => (
          <div
            key={r.id}
            className={`flex flex-1 items-center justify-center py-7 ${tone(r.label)}`}
          >
            <Body r={r} />
          </div>
        ))}
        {tie ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full border-[3px] border-black/45 bg-[#128A46]">
              <Body r={tie} />
            </div>
          </div>
        ) : null}
        {winnerSusp ? <Overlay /> : null}
      </div>
      <div className="relative grid grid-cols-2 gap-[6px]">
        {pair.map((r) => (
          <div key={r.id} className={`flex items-center justify-center py-4 ${tone(r.label)}`}>
            <Body r={r} />
          </div>
        ))}
        {pairSusp ? <Overlay /> : null}
      </div>
      <ChipRow />
    </div>

  );
}

function PokerPanel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  const Plate = ({ price, size, locked }: {
    price?: number | null | undefined;
    size?: number | null | undefined;
    locked: boolean;
  }) => (
    <div className="relative mx-auto flex h-[34px] w-[118px] max-w-[96%] flex-col items-center justify-center rounded-[4px] bg-casino-market-rate text-casino-market-text shadow-[0_3px_8px_color-mix(in_oklab,var(--casino-market-header)_25%,transparent)] sm:h-[56px] sm:w-[160px]">
      <span className="text-[0.95rem] font-bold leading-none sm:text-[1.15rem]">{fmtOdds(price)}</span>
      <span className="mt-[2px] text-[0.6rem] font-normal leading-none sm:text-[0.7rem]">
        {size == null ? "" : String(Math.round(size))}
      </span>

      {locked ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-[5px] bg-casino-suspend-veil text-[0.72rem] font-extrabold uppercase text-casino-suspend-text">
          Suspended
        </span>
      ) : null}

    </div>
  );

  const marketTitle = (name?: string | null) => {
    const title = (name ?? "").toUpperCase();
    if (/^PAIR$/.test(title)) return "PAIR ( DUBBLE ) 1:4";
    if (/^FLUSH$/.test(title)) return "FLUSH ( COLOR ) 1:8";
    if (/^STRAIGHT$/.test(title)) return "STRAIGHT ( ROWN ) 1:14";
    if (/STRAIGHT FLUSH/.test(title)) return "STRAIGHT FLUSH ( PAKKI ROWN ) 1:40";
    return title;
  };

  return (
    <div className="bg-casino-market-body">
      {markets.map((m) => {
          const names = m.runnersName ?? {};
          const runners = m.runners ?? [];
          const a = runners.find((r) => (names[String(r.selectionId)] ?? "").toUpperCase().includes("A"));
          const b = runners.find((r) => (names[String(r.selectionId)] ?? "").toUpperCase().includes("B"));
          const isSusp =
            suspended ||
            runners.every((r) => !isOpenStatus(r.status));
          return (
            <section key={m.marketId} className="border-b-2 border-board-header-foreground sm:border-b sm:border-casino-market-divider">
              <header className="flex h-[20px] items-center justify-between bg-casino-market-header px-1.5 sm:h-[26px] sm:px-2">
                <h3 className="truncate text-[0.68rem] font-extrabold uppercase text-board-header-foreground sm:text-[0.8rem]">
                  {marketTitle(m.marketName)}
                </h3>
                <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-board-header-foreground text-[0.55rem] font-black text-casino-market-header sm:h-4 sm:w-4 sm:text-[0.65rem]">
                  i
                </span>
              </header>
              <div className="relative grid min-h-[62px] grid-cols-2 pb-1.5 pt-1 sm:min-h-0 sm:pb-5 sm:pt-1.5">
                {[a, b].map((r, index) => (
                  <div key={r ? String(r.selectionId) : index} className="min-w-0 px-1.5 pb-0.5">
                    <p className="mb-[3px] truncate text-center text-[0.66rem] font-medium uppercase text-casino-market-text sm:text-[0.82rem]">
                      {r ? names[String(r.selectionId)] : index === 0 ? "PLAYER A" : "PLAYER B"}
                    </p>

                    <Plate
                      price={r?.price?.back?.[0]?.price}
                      size={r?.price?.back?.[0]?.size}
                      locked={isSusp || !r}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}



function MarketBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const hasLay = runners.some((r) => Boolean(r.price?.lay?.[0]?.price));
  const cols = hasLay ? "grid-cols-[1fr_130px_130px]" : "grid-cols-[1fr_130px]";
  // Original strips the side prefix inside a side-specific section
  // ("DRAGON ODD" -> "ODD" under the "DRAGON ODD/EVEN" header).
  const sidePrefix = (market.marketName ?? "").trim().toUpperCase().split(/\s+/)[0] ?? "";
  const runnerLabel = (raw: string) => {
    const up = raw.trim();
    if (sidePrefix && up.toUpperCase().startsWith(`${sidePrefix} `)) {
      return up.slice(sidePrefix.length + 1);
    }
    return up;
  };




  const cell = (
    p: { price?: number | null; size?: number | null } | undefined,
    side: "back" | "lay",
    runnerOpen: boolean,
  ) => {
    const locked = !runnerOpen || !p?.price;
    return (
      <div
        className={`relative m-[3px] flex h-[40px] flex-col items-center justify-center rounded-[5px] ${
          side === "back" ? "bg-casino-market-rate" : "bg-ex-lay"
        }`}
      >
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/45 text-sm">
            🔒
          </span>
        ) : (
          <>
            <span className="text-sm font-bold leading-none text-[#111]">
              {p?.price ? fmtOdds(p.price) : ""}
            </span>
            <span className="mt-0.5 text-[0.66rem] font-semibold text-[#111]/70">
              {p?.price ? fmtSize(p?.size) : ""}
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mt-0 overflow-hidden border-b border-casino-market-divider bg-casino-market-body">
      <header className="flex h-[34px] items-center bg-casino-market-header px-2">
        <h3 className="text-[0.78rem] font-extrabold uppercase tracking-[0.04em] text-board-header-foreground">
          {market.marketName}
        </h3>
      </header>
      <div className="relative">
        <div className={`grid ${cols} items-center bg-casino-market-body`}>
          <span className="px-2 py-1 text-[0.75rem] font-bold text-casino-market-text">
            Min/Max{" "}
            <span className="font-semibold text-casino-market-text/65">
              {market.min ?? 0} - {market.max ?? 0}
            </span>
          </span>
          <span className="py-1 text-center text-[0.75rem] font-bold text-casino-market-text">Back</span>
          {hasLay ? (
            <span className="py-1 text-center text-[0.75rem] font-bold text-casino-market-text">Lay</span>
          ) : null}
        </div>
        {runners.map((r) => {
          const runnerOpen = !suspended && isOpenStatus(r.status ?? "ONLINE");
          return (
            <div
              key={String(r.selectionId)}
              className={`grid items-center border-t border-casino-market-divider ${cols}`}
            >
              <span className="px-2 py-2 text-[0.82rem] font-bold text-casino-market-text">
                {runnerLabel(names[String(r.selectionId)] ?? String(r.selectionId))}
              </span>

              {cell(r.price?.back?.[0], "back", runnerOpen)}
              {hasLay ? cell(r.price?.lay?.[0], "lay", runnerOpen) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}


/** Rank label ("A", "2" … "K") rendered as the real printed card artwork. */
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
function RankCardLabel({ rank }: { rank: string }) {
  const src = cardImage(`S${rank}`);
  if (!src) return <>{rank}</>;
  return (
    <img
      src={src}
      alt={rank}
      loading="lazy"
      className="mx-auto block h-[40px] w-[29px] rounded-[3px] object-cover shadow-sm sm:h-[46px] sm:w-[33px]"
    />
  );
}

/** Light blue sectioned board with 2-column plates (Lucky 7, 20-20 TP, 20-20 DT) — original style. */

function DarkGridBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const raw = market.runners ?? [];
  // 20-20 Dragon Tiger: TIE runner sits centered on its own row below Dragon/Tiger.
  const tieIdx = raw.findIndex(
    (r) => (names[String(r.selectionId)] ?? "").trim().toUpperCase() === "TIE",
  );
  const reordered =
    tieIdx > -1 && tieIdx !== raw.length - 1
      ? [...raw.slice(0, tieIdx), ...raw.slice(tieIdx + 1), raw[tieIdx]!]
      : raw;
  // Lucky 7 shows EVEN first, then ODD (matches the original board).
  const runners = /LUCKY ODD\/EVEN/i.test(market.marketName ?? "")
    ? [...reordered].sort((a, b) => {
        const la = (names[String(a.selectionId)] ?? "").toUpperCase();
        const lb = (names[String(b.selectionId)] ?? "").toUpperCase();
        const rank = (l: string) => (l.startsWith("EVEN") ? 0 : l.startsWith("ODD") ? 1 : 2);
        return rank(la) - rank(lb);
      })
    : reordered;
  const odd = runners.length % 2 === 1;

  return (
    <div className="mt-0 border-b-2 border-board-header-foreground sm:border-b-0">
      <header className="flex h-[20px] items-center justify-between gap-2 bg-casino-market-header px-1.5 sm:h-[26px] sm:px-2">
        <h3 className="truncate whitespace-nowrap text-[0.68rem] font-extrabold uppercase tracking-[0.02em] text-board-header-foreground sm:text-[0.8rem]">
          {market.marketName}
        </h3>
        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-board-header-foreground text-[0.55rem] font-black text-casino-market-header sm:h-4 sm:w-4 sm:text-[0.65rem]">
          i
        </span>


      </header>
      <div className="relative bg-casino-market-body px-2 py-1 sm:px-3 sm:py-3">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:gap-x-4 sm:gap-y-3">

          {runners.map((r, i) => {
            const p = r.price?.back?.[0];
            const locked = !suspended && (!isOpenStatus(r.status ?? "ONLINE") || !p?.price);
            const last = odd && i === runners.length - 1;
            return (
              <div
                key={String(r.selectionId)}
                className={`min-w-0 ${last ? "col-span-2 mx-auto w-[calc(50%-0.5rem)]" : ""}`}
              >
                <div className="px-1 pb-[3px] text-center text-[0.66rem] font-medium uppercase text-casino-market-text sm:text-[0.8rem] sm:font-semibold">
                  {(() => {
                    const label = String(names[String(r.selectionId)] ?? r.selectionId).trim();
                    return /CARD/i.test(market.marketName ?? "") && RANKS.includes(label.toUpperCase())
                      ? <RankCardLabel rank={label.toUpperCase()} />
                      : <span className="block truncate">{label}</span>;
                  })()}
                </div>

                <div className="relative mx-auto flex h-[34px] w-[118px] max-w-full flex-col items-center justify-center rounded-[4px] bg-casino-market-rate text-casino-market-text shadow-[0_3px_8px_color-mix(in_oklab,var(--casino-market-header)_25%,transparent)] sm:h-[56px] sm:w-[150px] sm:rounded-[6px]">
                  {locked ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-black/35 text-sm">
                      🔒
                    </span>
                  ) : (
                    <>
                      <span className="text-[0.95rem] font-bold leading-none sm:text-[1.1rem]">
                        {fmtOdds(p?.price)}
                      </span>
                      <span className="mt-[2px] text-[0.6rem] font-normal leading-none text-casino-market-text/90 sm:text-[0.7rem]">
                        {p?.size == null ? "" : String(Math.round(p.size))}

                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {suspended ? <SuspendVeil /> : null}


      </div>
    </div>
  );
}


/** Light row board: label left, blue back (and pink lay) boxes right (Joker TP, 1Day TP) — original style. */
function DarkRowBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const hasLay = runners.some((r) => Boolean(r.price?.lay?.[0]?.price));
  const cols = hasLay ? "grid-cols-[1fr_92px_92px]" : "grid-cols-[1fr_110px]";

  const plate = (
    p: { price?: number | null; size?: number | null } | undefined,
    side: "back" | "lay",
    locked: boolean,
  ) => (
    <div
      className={`relative m-[2px] flex h-[44px] flex-col items-center justify-center rounded-[5px] border border-casino-market-divider ${
        side === "back" ? "bg-casino-market-rate" : "bg-ex-lay"
      }`}
    >
      {locked ? (
        <span className="absolute inset-0 flex items-center justify-center text-sm">🔒</span>
      ) : (
        <>
          <span className="text-[0.95rem] font-extrabold leading-none text-[#111]">
            {fmtOdds(p?.price)}
          </span>
          <span className="mt-0.5 text-[0.64rem] font-semibold text-[#111]/70">
            {fmtSize(p?.size)}
          </span>
        </>
      )}
    </div>
  );

  return (
    <div className="mt-0 overflow-hidden border-b border-casino-market-divider bg-casino-market-body">
      <div className={`grid min-h-[34px] ${cols} items-center bg-casino-market-header px-2`}>
        <span className="py-1.5 text-[0.8rem] font-extrabold uppercase text-board-header-foreground">
          {market.marketName}{" "}
          <span className="ml-1 text-[0.68rem] font-semibold normal-case text-board-header-foreground/75">
            Min: {market.min ?? 0} Max: {market.max ?? 0}
          </span>
        </span>
        <span className="py-1.5 text-center text-[0.72rem] font-bold text-board-header-foreground">Back</span>
        {hasLay ? (
          <span className="py-1.5 text-center text-[0.72rem] font-bold text-board-header-foreground">Lay</span>
        ) : null}
      </div>
      <div className="relative">
        {runners.map((r) => {
          const open = !suspended && isOpenStatus(r.status ?? "ONLINE");
          return (
            <div
              key={String(r.selectionId)}
              className={`grid items-center border-t border-casino-market-divider ${cols} px-2`}
            >
              <span className="truncate py-1 text-[0.85rem] font-bold uppercase text-casino-market-text">
                {names[String(r.selectionId)] ?? String(r.selectionId)}
              </span>
              {plate(r.price?.back?.[0], "back", !open || !r.price?.back?.[0]?.price)}
              {hasLay ? plate(r.price?.lay?.[0], "lay", !open || !r.price?.lay?.[0]?.price) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ABRunner = {
  id: string;
  label: string;
  price?: number | null | undefined;

  open: boolean;
};

function DTLPanel({
  markets,
  suspended,
  resultDeclared,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
  resultDeclared: boolean;
}) {
  const [tab, setTab] = useState<"DRAGON" | "TIGER" | "LION">("DRAGON");
  const byName = (n: string) => markets.find((m) => (m.marketName ?? "").toUpperCase() === n);
  type Row = { id: string; label: string; price?: number | null | undefined; open: boolean };
  const list = (m?: CasinoMarket): Row[] =>
    (m?.runners ?? []).map((r) => ({
      id: String(r.selectionId),
      label: ((m?.runnersName ?? {})[String(r.selectionId)] ?? "").toUpperCase(),
      price: r.price?.back?.[0]?.price,
      open: !suspended && isOpenStatus(r.status),
    }));

  const winner = list(byName("WINNER")).find((r) => r.label === tab);
  const color = list(byName(`${tab} CARD COLOR`));
  const oddEven = list(byName(`${tab} ODD/EVEN`));
  const cards = list(byName(`${tab} CARD`));
  const red = color.find((r) => r.label.endsWith("RED"));
  const black = color.find((r) => r.label.endsWith("BLACK"));
  const odd = oddEven.find((r) => r.label.endsWith("ODD"));
  const even = oddEven.find((r) => r.label.endsWith("EVEN"));

  const PriceBox = ({ r }: { r?: Row | undefined }) =>
    r ? (
      <div className="relative flex h-[52px] w-[112px] items-center justify-center border border-[#4A7FB5] bg-[#1F2B3A] text-[0.95rem] font-bold text-white">
        {r.open ? <span>{fmtOdds(r.price)}</span> : <span className="text-base">🔒</span>}
      </div>
    ) : (
      <div className="h-[52px] w-[112px]" />
    );

  const RowLine = ({ label, r }: { label: ReactNode; r?: Row | undefined }) => (
    <div className="flex items-center justify-between border-b border-[#2B2F35] bg-[#33383F] px-4 py-2">
      <span className="text-[0.95rem] font-semibold text-white/85">{label}</span>
      <div className="pr-[110px]">
        <PriceBox r={r} />
      </div>
    </div>
  );

  return (
    <div className="mt-1 bg-[#2A2E33]">
      <div className="grid grid-cols-3 bg-[#3B4149]">
        {(["DRAGON", "TIGER", "LION"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-3 text-[0.95rem] font-bold capitalize ${
              tab === t
                ? "border-b-[3px] border-[#E8C33A] text-white"
                : "border-b-[3px] border-transparent text-white/75"
            }`}
          >
            {t.toLowerCase()}
          </button>
        ))}
      </div>

      {resultDeclared ? (
        <div className="mx-2 mt-2 bg-[#3B4149] px-3 py-1.5 text-[0.82rem] font-extrabold uppercase tracking-wide text-[#E8C33A]">
          Result Declared
        </div>
      ) : null}

      <div className="mt-2">
        <RowLine label="Winner" r={winner} />
        <RowLine
          label={
            <span className="flex gap-2 text-xl leading-none text-[#E0393B]">
              <span>♥</span>
              <span>♦</span>
            </span>
          }
          r={red}
        />
        <RowLine
          label={
            <span className="flex gap-2 text-xl leading-none text-white">
              <span>♣</span>
              <span>♠</span>
            </span>
          }
          r={black}
        />
        <RowLine label="Odd" r={odd} />
        <RowLine label="Even" r={even} />
      </div>

      <div className="flex flex-wrap justify-center gap-1 px-3 py-5">
        {cards.map((r) => {
          const rank = r.label.replace(`${tab} `, "");
          return (
            <div key={r.id} className="w-[44px] text-center">
              <div className="relative flex h-[56px] flex-col items-center justify-center rounded-[3px] border border-[#4A5058] bg-gradient-to-b from-[#3A4048] to-[#22272D] text-[1.05rem] font-extrabold text-white/90">
                {r.open ? rank : <span className="text-base">🔒</span>}
                <span className="absolute bottom-0.5 left-0.5 text-[0.55rem] text-white/70">♣ ♠</span>
                <span className="absolute bottom-0.5 right-0.5 text-[0.55rem] text-[#E0393B]">♥ ♦</span>
              </div>
              <p className="bg-[#2A2E33] py-0.5 text-[0.72rem] font-bold text-[#3FA36B]">
                {fmtOdds(r.price)}
              </p>
            </div>
          );
        })}
      </div>

    </div>
  );
}

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
      open: !suspended && isOpenStatus(r.status),
    }));

  const winner = list(byName("WINNER"));
  const side = list(byName("SIDE BET"));
  const oddEven = list(byName("ODD/EVEN"));
  const suits = list(byName("CARD SUIT"));
  const cards = list(byName("LUCKY CARD"));
  const minmax = byName("WINNER");

  const Price = ({ r }: { r: ABRunner }) => (
    <span className="inline-flex items-center justify-center">
      {r.open ? fmtOdds(r.price) : <span className="text-[0.9em]">🔒</span>}
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
            ? "bg-[#183A5A] text-white"
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

      <div className="mt-5 flex flex-wrap justify-center gap-1.5">
        {cards.map((r) => (
          <div key={r.id} className="text-center">
            <div
              className={`flex h-[52px] w-[48px] flex-col items-center justify-center rounded border border-black/25 ${
                r.open ? "bg-[#C9C9BE]" : "bg-[#9A9A93]"
              }`}
            >
              <span className="text-lg font-extrabold leading-none text-black/70">
                {r.open ? r.label : "🔒"}
              </span>
              <span className="text-[0.6rem] leading-none">
                <span className="text-black/70">♣</span>
                <span className="text-[#E01B24]">♥</span>
              </span>

            </div>
            <p className="mt-0.5 text-[0.72rem] font-bold text-[#E01B24]">{fmtOdds(r.price)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DT20Panel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const red = (s: string) => s === "♥" || s === "♦";

  const Suits = ({ list }: { list: string[] }) => (
    <>
      {list.map((s) => (
        <span
          key={s}
          className="text-[0.72rem] leading-none"
          style={{ color: red(s) ? "#E01B24" : "#111" }}
        >
          {s}
        </span>
      ))}
    </>
  );

  const CardTile = ({ rank }: { rank: string }) => (
    <span className="inline-flex h-[34px] w-[25px] flex-col items-center justify-center rounded-[2px] border border-[#E3C96B] bg-white leading-none">
      <span className="text-[0.85rem] font-bold text-[#555]">{rank}</span>
      <span className="mt-[2px] flex gap-[2px]">
        <Suits list={["♣", "♦"]} />
      </span>
      <span className="flex gap-[2px]">
        <Suits list={["♠", "♥"]} />
      </span>
    </span>
  );

  const Label = ({ text }: { text: string }) => {
    const up = text.toUpperCase().trim();
    const rankOnly = RANKS.find((r) => up === r || up === `CARD ${r}`);
    if (rankOnly) return <CardTile rank={rankOnly} />;

    const base = up.replace(/[♥♦♠♣]/g, "").trim();
    const suits =
      base === "ODD" || base === "BLACK"
        ? ["♠", "♣"]
        : base === "EVEN" || base === "RED"
          ? ["♥", "♦"]
          : [];
    return (
      <span className="inline-flex items-center gap-[3px] text-[0.85rem] font-bold uppercase text-[#6E88A0]">
        {base}
        <span className="ml-[2px] flex gap-[3px]">
          <Suits list={suits} />
        </span>
      </span>
    );
  };

  return (
    <div className="mt-0 space-y-2 bg-casino-market-body p-1">
      {markets.map((m, mi) => {
        const names = m.runnersName ?? {};
        const runners = m.runners ?? [];
        const allClosed =
          runners.length > 0 && runners.every((r) => suspended || !isOpenStatus(r.status));
        return (
          <div key={`${m.marketId}-${mi}`} className="border-b border-casino-market-divider">
            <div className="flex h-[34px] items-center justify-between bg-casino-market-header px-2">
              <span className="text-[0.8rem] font-extrabold uppercase tracking-wide text-board-header-foreground">
                {m.marketName}
              </span>
              <span className="text-[0.72rem] font-bold text-board-header-foreground/85">
                Min/Max: {m.min ?? 100} - {m.max ?? 100000}
              </span>
            </div>
            <div className="relative">
              {runners.map((r, i) => (
                <div
                  key={`${r.selectionId}-${i}`}
                  className={`flex items-stretch ${i ? "border-t border-casino-market-divider" : ""}`}
                >
                  <div className="flex min-h-[44px] flex-1 items-center px-2 py-1">
                    <Label text={names[String(r.selectionId)] ?? String(r.selectionId)} />
                  </div>
                  <div className="m-1 flex w-[105px] flex-col items-center justify-center rounded-[5px] bg-casino-market-rate leading-tight">
                    <span className="text-[0.85rem] text-[#111]">
                      {fmtOdds(r.price?.back?.[0]?.price)}
                    </span>
                    <span className="text-[0.75rem] text-[#111]">
                      {fmtSize(r.price?.back?.[0]?.size)}
                    </span>
                  </div>
                  <div className="w-[105px] border-l border-casino-market-divider bg-casino-market-body" />
                </div>
              ))}
              {allClosed ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-[210px]">
                  <span className="text-[1.7rem] font-bold uppercase tracking-wide text-[#9aa0a6]">
                    Suspended
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function CardRacePanel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  const suitColor = (s: string) => (s === "♥" || s === "♦" ? "#E01B24" : "#111");

  const Label = ({ text }: { text: string }) => {
    const up = text.toUpperCase();
    const kingSuit =
      up.startsWith("HEART") ? "♥" :
      up.startsWith("DIAMOND") ? "♦" :
      up.startsWith("SPADE") ? "♠" :
      up.startsWith("CLUB") ? "♣" : null;

    if (kingSuit) {
      return (
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-[42px] w-[32px] shrink-0 flex-col items-center justify-center rounded-[3px] border border-[#E3C96B] bg-white leading-none shadow-sm">
            <span className="text-[0.95rem] font-bold" style={{ color: suitColor(kingSuit) }}>K</span>
            <span className="text-[0.9rem]" style={{ color: suitColor(kingSuit) }}>{kingSuit}</span>
          </span>
          <span className="text-[0.9rem] font-bold leading-tight text-[#555]">{up}</span>
        </span>
      );
    }


    const suffix =
      up === "RED" ? ["♥", "♦"] :
      up === "BLACK" ? ["♠", "♣"] :
      up.startsWith("ANY SUIT") ? ["♥", "♠", "♦", "♣"] : [];

    return (
      <span className="inline-flex items-center gap-1 text-[0.95rem] font-bold text-[#555]">
        {up.replace(/♥|♦|♠|♣/g, "").trim()}
        {suffix.map((s) => (
          <span key={s} style={{ color: suitColor(s) }} className="text-[0.85rem]">
            {s}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="mt-0 space-y-2 bg-casino-market-body p-1">
      {markets.map((m, mi) => {
        const names = m.runnersName ?? {};
        const runners = m.runners ?? [];
        return (
          <div key={`${m.marketId}-${mi}`} className="overflow-hidden border-b border-casino-market-divider">
            <div className="flex h-[34px] items-center justify-between bg-casino-market-header px-2">
              <span className="text-[0.85rem] font-extrabold uppercase tracking-wide text-board-header-foreground">
                {m.marketName}
              </span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-board-header-foreground text-[0.65rem] font-extrabold text-casino-market-header">
                i
              </span>
            </div>
            <div className="relative">
              {runners.map((r, i) => {
                const open = !suspended && isOpenStatus(r.status);
                const label = names[String(r.selectionId)] ?? String(r.selectionId);
                return (
                  <div
                    key={`${r.selectionId}-${i}`}
                    className={`flex items-stretch ${i ? "border-t border-casino-market-divider" : ""}`}
                  >
                    <div className="flex min-h-[42px] flex-1 items-center px-2 py-1">
                      <Label text={label} />
                    </div>
                    <div className="flex w-[134px] items-center justify-center p-1">
                      <div className={`flex h-[38px] w-full flex-col items-center justify-center rounded-[5px] leading-none ${open ? "bg-casino-market-rate" : "bg-casino-market-rate/55"}`}>
                        <span className="text-[0.95rem] font-bold text-[#12314e]">
                          {fmtOdds(r.price?.back?.[0]?.price)}
                        </span>
                        <span className="text-[0.68rem] text-[#4a6c8c]">
                          {r.price?.back?.[0]?.size ?? ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {runners.length > 0 &&
              runners.every((r) => suspended || !isOpenStatus(r.status)) ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-[1.5rem] font-extrabold uppercase tracking-[0.04em] text-[#DE7A7A]">
                    SUSPENDED
                  </span>
                </div>
              ) : null}
            </div>

          </div>
        );
      })}
    </div>
  );
}

function AAAPanel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  const find = (n: string) =>
    markets.find((m) => (m.marketName ?? "").toUpperCase() === n);
  const winner = find("WINNER");
  const card = find("CARD");
  const sides = ["ODD/EVEN", "COLOR", "UNDER/OVER"]
    .map((n) => find(n))
    .filter(Boolean) as CasinoMarket[];

  const MinMax = ({ m }: { m: CasinoMarket }) => (
    <div className="flex h-[22px] items-center justify-center bg-[#dbe9f2] text-[0.7rem] font-bold text-[#9fb6c4]">
      Min/Max: {m.min ?? 100} - {m.max ?? 100000}
    </div>
  );

  const Watermark = () => (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="text-[1.6rem] font-extrabold uppercase tracking-wide text-[#9aa0a6]/85">
        Suspended
      </span>
    </div>
  );

  const Header = ({ name }: { name: string }) => (
    <div className="flex h-[34px] items-center bg-casino-market-header px-2 text-[0.85rem] font-extrabold uppercase tracking-wide text-board-header-foreground">
      {name}
    </div>
  );

  const SuspCell = () => (
    <div className="flex h-[38px] w-full items-center justify-center border-2 border-[#E01B24] bg-white">
      <span className="text-[0.78rem] font-bold uppercase text-[#E01B24]">Suspended</span>
    </div>
  );

  const PriceCell = ({
    price,
    size,
    tone,
  }: {
    price?: number | null | undefined;
    size?: number | null | undefined;
    tone: "back" | "lay";
  }) => (
    <div
      className="flex h-[38px] w-full flex-col items-center justify-center leading-none"
      style={{ background: tone === "back" ? "#72BBEF" : "#F9C9D4" }}
    >
      <span className="text-[0.92rem] font-bold text-[#111]">{fmtOdds(price)}</span>
      <span className="text-[0.66rem] text-[#111]">{size ?? ""}</span>
    </div>
  );

  return (
    <div className="mt-0 space-y-2 bg-casino-market-body p-1">
      {winner ? (
        <div className="border-b border-casino-market-divider">
          <Header name="WINNER" />
          <div className="flex items-stretch bg-white">
            <div className="flex-1 p-1">
              <div className="flex h-[22px] items-center justify-center bg-[#dbe9f2] text-[0.7rem] font-bold text-[#9fb6c4]">
                Min/Max: {winner.min ?? 100} - {winner.max ?? 100000}
              </div>
            </div>
            <div className="flex w-[124px] items-center justify-center bg-casino-market-rate text-[0.85rem] font-semibold text-casino-market-text/70">
              Back
            </div>
            <div className="flex w-[124px] items-center justify-center bg-[#F9C9D4] text-[0.85rem] font-semibold text-white">
              Lay
            </div>
          </div>
          <div className="relative">
            {(winner.runners ?? []).map((r, i) => {
              const open = !suspended && isOpenStatus(r.status);
              const label = (winner.runnersName ?? {})[String(r.selectionId)] ?? "";
              return (
                <div key={`${r.selectionId}-${i}`} className="flex items-stretch border-t border-[#eee]">
                  <div className="flex min-h-[44px] flex-1 items-center px-2 text-[0.92rem] font-bold text-[#444]">
                    {label}
                  </div>
                  <div className="w-[124px] p-1">
                    {open ? (
                      <PriceCell
                        price={r.price?.back?.[0]?.price}
                        size={r.price?.back?.[0]?.size}
                        tone="back"
                      />
                    ) : (
                      <SuspCell />
                    )}
                  </div>
                  <div className="w-[124px] p-1">
                    {open ? (
                      <PriceCell
                        price={r.price?.lay?.[0]?.price}
                        size={r.price?.lay?.[0]?.size}
                        tone="lay"
                      />
                    ) : (
                      <SuspCell />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {sides.map((m, mi) => {
          const runners = m.runners ?? [];
          const closed = runners.every((r) => suspended || !isOpenStatus(r.status));
          return (
            <div key={`${m.marketId}-${mi}`} className="border-b border-casino-market-divider">
              <Header name={m.marketName ?? ""} />
              <div className="p-1">
                <MinMax m={m} />
              </div>
              <div className="relative">
                {runners.map((r, i) => {
                  const label = ((m.runnersName ?? {})[String(r.selectionId)] ?? "").toUpperCase();
                  const isRed = label === "RED";
                  const isBlack = label === "BLACK";
                  return (
                    <div
                      key={`${r.selectionId}-${i}`}
                      className="flex h-[72px] flex-col items-center justify-center leading-tight"
                      style={{ background: i === 0 ? "#D9A0A8" : "#78AEDB" }}
                    >
                      <span className="text-[0.95rem] font-bold text-white">
                        {isRed ? (
                          <span className="text-[#E01B24]">♥ ♦</span>
                        ) : isBlack ? (
                          <span className="text-[#111]">♠ ♣</span>
                        ) : (
                          label
                        )}
                      </span>
                      <span className="text-[0.95rem] font-bold text-white">
                        {fmtOdds(r.price?.back?.[0]?.price)}
                      </span>
                      <span className="text-[0.78rem] text-white">
                        {r.price?.back?.[0]?.size ?? ""}
                      </span>
                    </div>
                  );
                })}
                {closed ? <Watermark /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {card ? (
        <div className="border-b border-casino-market-divider">
          <Header name="CARD" />
          <div className="flex items-stretch">
            <div className="flex-1 p-1">
              <MinMax m={card} />
            </div>
            <div className="flex w-[248px] items-center justify-center bg-casino-market-rate text-[0.85rem] font-semibold text-casino-market-text/70">
              Back
            </div>
          </div>
          <div className="relative">
            {(card.runners ?? []).map((r, i) => {
              const open = !suspended && isOpenStatus(r.status);
              const rank = ((card.runnersName ?? {})[String(r.selectionId)] ?? "").toUpperCase();
              return (
                  <div key={`${r.selectionId}-${i}`} className="flex items-stretch border-t border-[#eee]">
                    <div className="flex min-h-[52px] flex-1 items-center px-2">
                      <span className="inline-flex h-[34px] w-[25px] flex-col items-center justify-center rounded-[3px] border border-[#E3C96B] bg-white leading-none">
                      <span className="text-[1rem] font-bold text-[#333]">{rank}</span>
                      <span className="mt-[1px] text-[0.5rem] leading-none">
                        <span className="text-[#111]">♠</span>
                        <span className="text-[#E01B24]">♦</span>
                      </span>
                      <span className="text-[0.5rem] leading-none">
                        <span className="text-[#111]">♣</span>
                        <span className="text-[#E01B24]">♥</span>
                      </span>
                    </span>
                  </div>
                  <div className="w-[248px] p-1">
                    {open ? (
                      <PriceCell
                        price={r.price?.back?.[0]?.price}
                        size={r.price?.back?.[0]?.size}
                        tone="back"
                      />
                    ) : (
                      <SuspCell />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}



function MuflisPanel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  const winner =
    markets.find((m) => (m.marketName ?? "").toUpperCase() === "WINNER") ?? markets[0];
  const names = winner?.runnersName ?? {};
  const runners = winner?.runners ?? [];
  const pick = (letter: "A" | "B") =>
    runners.find((r) =>
      (names[String(r.selectionId)] ?? "").toUpperCase().trim().endsWith(letter),
    );

  const chips: { v: string; src: string }[] = [
    { v: "100", src: chip1k.url },
    { v: "200", src: chip5.url },
    { v: "500", src: chip10.url },
    { v: "1k", src: chip20.url },
    { v: "2k", src: chip50.url },
    { v: "5k", src: chip100.url },
    { v: "10k", src: chip200.url },
    { v: "25k", src: chip500.url },
    { v: "50k", src: chip1k.url },
    { v: "100k", src: chip5.url },
  ];


  const Side = ({ letter }: { letter: "A" | "B" }) => {
    const r = pick(letter);
    const open = !suspended && isOpenStatus(r?.status);
    return (
      <div className="relative flex-1">
        <div
          className={`relative flex h-[105px] items-center justify-center overflow-hidden ${
            letter === "A" ? "rounded-l-[14px]" : "rounded-r-[14px]"
          } bg-[#0B0B0D]`}
        >
          <div
            className={`absolute top-0 h-full w-[210px] bg-[#4A4A4A] ${
              letter === "A" ? "right-0 rounded-l-[14px]" : "left-0 rounded-r-[14px]"
            }`}
          />
          <div className="relative text-center leading-tight">
            <p className="text-[1.3rem] font-extrabold uppercase tracking-wide text-white">
              Player {letter}
            </p>
            <p className="mt-1 text-[1.3rem] font-extrabold text-white">
              {fmtOdds(r?.price?.back?.[0]?.price)}
            </p>
          </div>
          {!open ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0B0B0D]">
              <span className="text-[1.15rem] font-extrabold uppercase tracking-wide text-[#e0201c]">
                Suspended
              </span>
            </div>
          ) : null}

        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 rounded-[14px] bg-[#2C2F33] p-3">
      <p className="mb-2 text-right text-[0.7rem] font-semibold text-white/50">
        Min:{winner?.min ?? 100} Max:{winner?.max ?? 500000}
      </p>
      <div className="flex items-stretch gap-1">
        <Side letter="A" />
        <Side letter="B" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {chips.map((c) => (
          <span key={c.v} className="relative inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center">
            <img
              src={c.src}
              alt={`${c.v} chip`}
              className="absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
            />
            <span className="relative z-10 text-[0.8rem] font-extrabold text-[#111]">{c.v}</span>
          </span>
        ))}
      </div>



    </div>
  );
}

/** Scales boards on desktop, but renders natively (full width) on phones. */
function Fit({
  children,
  designWidth,
  mobileNative,
}: {
  children: ReactNode;
  designWidth: number;
  mobileNative?: boolean;
}) {
  const mobile = useIsMobile();
  const embed = useEmbed();
  if (embed) return <div className="w-full">{children}</div>;
  if (mobile && mobileNative) return <div className="w-full">{children}</div>;
  return <FitBoard designWidth={designWidth}>{children}</FitBoard>;
}

const PANEL_CHIPS: { v: string; src: string }[] = [
  { v: "100", src: chip1k.url },
  { v: "200", src: chip5.url },
  { v: "500", src: chip10.url },
  { v: "1k", src: chip20.url },
  { v: "2k", src: chip50.url },
  { v: "5k", src: chip100.url },
  { v: "10k", src: chip200.url },
  { v: "25k", src: chip500.url },
  { v: "50k", src: chip1k.url },
  { v: "100k", src: chip5.url },
];

function ChipRow() {
  const [sel, setSel] = useState("100");
  return (
    <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-b-[6px] bg-[#1F1F1F] px-2 py-2 sm:gap-3 sm:px-3">
      {PANEL_CHIPS.map((c) => {
        const active = sel === c.v;
        return (
          <button
            key={c.v}
            type="button"
            onClick={() => setSel(c.v)}
            className="relative inline-flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`relative inline-flex h-[42px] w-[42px] items-center justify-center rounded-full transition-all sm:h-[52px] sm:w-[52px] ${
                active ? "ring-[3px] ring-[#D4AF1F]" : "ring-2 ring-transparent"
              }`}
            >
              <img
                src={c.src}
                alt={`${c.v} chip`}
                className="absolute inset-0 h-full w-full select-none object-contain"
                draggable={false}
              />
            </span>
            <span className="text-[0.7rem] font-bold text-white sm:text-[0.8rem]">{c.v}</span>
          </button>
        );
      })}
    </div>
  );
}

export function tileTone(label: string): string {
  const l = label.trim().toUpperCase();
  if (l === "0" || l === "GREEN") return "bg-[#12563A] text-[#DFF6E9]";
  if (l === "HEADS") return "bg-[#12563A] text-[#DFF6E9]";
  if (l === "RED" || l === "TAILS") return "bg-[#6B2B24] text-[#F0C7C1]";
  if (/^\d+$/.test(l)) {
    return Number(l) % 2 === 1
      ? "bg-[#6B2B24] text-[#F0C7C1]"
      : "bg-[#232323] text-[#D8D8D8]";
  }
  return "bg-[#232323] text-[#D8D8D8]";
}

export const DREAM_NOTE: Record<string, string> = {
  "1": dream1x.url,
  "2": dream2x.url,
  "5": dream5x.url,
  "10": dream10x.url,
  "20": dream20x.url,
  "40": dream40x.url,
};

export const DREAM_TONE: Record<string, string> = {
  "1": "bg-[#C79A00] text-white",
  "2": "bg-[#2B6FA8] text-white",
  "5": "bg-[#6B3391] text-white",
  "10": "bg-[#1F7A44] text-white",
  "20": "bg-[#B45810] text-white",
  "40": "bg-[#A5372A] text-white",
};

function NumberPanel({
  markets,
  suspended,
  perRow,
  dream,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
  perRow: number;
  dream?: boolean;
}) {
  const winner =
    markets.find((m) => (m.marketName ?? "").toUpperCase() === "WINNER") ?? markets[0];
  const side = markets.filter((m) => m !== winner);

  type Tile = { id: string; label: string; price?: number | undefined; size?: number | undefined; open: boolean };
  const toTiles = (m?: CasinoMarket): Tile[] => {
    const names = m?.runnersName ?? {};
    return (m?.runners ?? []).map((r) => ({
      id: String(r.selectionId),
      label: names[String(r.selectionId)] ?? String(r.selectionId),
      price: r.price?.back?.[0]?.price,
      size: r.price?.back?.[0]?.size,
      open: !suspended && isOpenStatus(r.status),
    }));
  };

  const DREAM_ORDER = ["1", "2", "5", "10", "20", "40"];

  const DREAM_BORDER: Record<string, string> = {
    "1": "#C79A00",
    "2": "#2B6FA8",
    "5": "#6B3391",
    "10": "#1F7A44",
    "20": "#B45810",
    "40": "#A5372A",
  };

  const Tile = ({ t }: { t: Tile }) => {
    const key = t.label.trim();
    const note = dream ? DREAM_NOTE[key] : undefined;
    if (note) {
      return (
        <div
          className="relative overflow-hidden rounded-[6px] border-2 bg-black"
          style={{ borderColor: DREAM_BORDER[key] ?? "#333" }}
        >
          <img
            src={note}
            alt={`${key}x`}
            className="block w-full select-none object-cover"
            style={{ aspectRatio: "16 / 9" }}
            draggable={false}
          />
          {!t.open ? (
            <div className="absolute inset-0 bg-black/55" />
          ) : null}
        </div>
      );
    }


    return (
      <div
        className={`relative flex h-[54px] flex-col items-center justify-center rounded-[6px] border border-white/10 sm:h-[68px] ${
          (dream ? DREAM_TONE[t.label.trim()] : undefined) ?? tileTone(t.label)
        }`}
      >
        <span className="text-[0.95rem] font-extrabold leading-none sm:text-[1.1rem]">
          {t.label}
        </span>
        <span className="mt-1 text-[0.66rem] font-bold leading-none sm:text-[0.72rem]">
          {t.price ? t.price.toFixed(2) : "—"}
        </span>
        <span className="mt-[3px] text-[0.6rem] font-semibold leading-none opacity-60 sm:text-[0.66rem]">
          {t.size ? Math.round(t.size) : ""}
        </span>

        {!t.open ? <div className="absolute inset-0 rounded-[6px] bg-black/45" /> : null}
      </div>
    );
  };


  const main = dream
    ? toTiles(winner).sort((a, b) => {
        const ai = DREAM_ORDER.indexOf(a.label.trim());
        const bi = DREAM_ORDER.indexOf(b.label.trim());
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      })
    : toTiles(winner);

  const order = ["EVEN", "RED", "BLACK", "ODD"];
  const extras = side
    .flatMap((m) => toTiles(m))
    .sort((a, b) => {
      const ai = order.indexOf(a.label.toUpperCase());
      const bi = order.indexOf(b.label.toUpperCase());
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });


  return (
    <div className="mt-3 rounded-[6px] bg-[#141414] p-3">
      <p className="mb-2 text-right text-[0.68rem] font-semibold text-white/50">
        Min:{winner?.min ?? 100} Max:{winner?.max ?? 100000}
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}
      >
        {main.map((t) => (
          <Tile key={t.id} t={t} />
        ))}
      </div>
      {extras.length ? (
        <div
          className="mt-2 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(extras.length, 4)}, minmax(0, 1fr))` }}
        >
          {extras.map((t) => (
            <Tile key={t.id} t={t} />
          ))}
        </div>
      ) : null}
      <ChipRow />
    </div>
  );
}


function DragonTigerPanel({

  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  type Row = {
    id: string;
    label: string;
    back?: number | null | undefined;
    backSize?: number | null | undefined;
    lay?: number | null | undefined;
    laySize?: number | null | undefined;
    open: boolean;
  };
  const byName = (n: string) => markets.find((m) => (m.marketName ?? "").toUpperCase() === n);
  const list = (m?: CasinoMarket): Row[] =>
    (m?.runners ?? []).map((r) => ({
      id: String(r.selectionId),
      label: ((m?.runnersName ?? {})[String(r.selectionId)] ?? String(r.selectionId)).toUpperCase(),
      back: r.price?.back?.[0]?.price,
      backSize: r.price?.back?.[0]?.size,
      lay: r.price?.lay?.[0]?.price,
      laySize: r.price?.lay?.[0]?.size,
      open: !suspended && isOpenStatus(r.status),
    }));

  const winnerMkt = byName("WINNER");
  const winner = list(winnerMkt);
  const dragon = winner.find((r) => r.label.includes("DRAGON"));
  const tiger = winner.find((r) => r.label.includes("TIGER"));
  const pair = list(byName("PAIR"))[0];
  const cardMax = byName("DRAGON CARD")?.max ?? 20000;

  const Lock = () => (
    <span className="absolute inset-0 flex items-center justify-center text-white">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M12 2a5 5 0 0 0-5 5v3H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
      </svg>
    </span>
  );

  const WinCell = ({
    r,
    side,
    rounded,
  }: {
    r?: Row | undefined;
    side: "back" | "lay";
    rounded: "l" | "r";
  }) => {
    const open = Boolean(r?.open);
    const bg = side === "back" ? (open ? "#72BBEF" : "#3F5468") : open ? "#F9C9D4" : "#7B5661";
    return (
      <div
        className={`relative flex h-[62px] w-[80px] flex-col items-center justify-center ${
          rounded === "l" ? "rounded-l-full" : "rounded-r-full"
        }`}
        style={{ background: bg }}
      >
        {open ? (
          <>
            <span className="text-[1.05rem] font-extrabold leading-none text-[#111]">
              {fmtOdds(side === "back" ? r?.back : r?.lay)}
            </span>
            <span className="mt-1 text-[0.7rem] font-semibold text-[#111]/70">
              {fmtSize(side === "back" ? r?.backSize : r?.laySize)}
            </span>
          </>
        ) : (
          <Lock />
        )}
      </div>
    );
  };

  const GreenBox = ({
    r,
    label,
    price,
  }: {
    r?: Row | undefined;
    label: ReactNode;
    price?: number | null | undefined;
  }) => (
    <div className="text-center">
      <p className="mb-1 text-[1.05rem] font-extrabold text-[#111]">
        {r && !r.open ? "" : fmtOdds(price)}
      </p>
      <div className="relative flex h-[62px] items-center justify-center rounded-xl bg-[#0D3B2B] px-4">
        {r && !r.open ? (
          <Lock />
        ) : (
          <span className="text-[1rem] font-bold uppercase text-white/55">{label}</span>
        )}
      </div>
    </div>
  );

  const SideBlock = ({ side }: { side: "DRAGON" | "TIGER" }) => {
    const oe = list(byName(`${side} ODD/EVEN`));
    const color = list(byName(`${side} CARD COLOR`));
    const even = oe.find((r) => r.label.endsWith("EVEN"));
    const odd = oe.find((r) => r.label.endsWith("ODD"));
    const red = color.find((r) => r.label.includes("RED"));
    const black = color.find((r) => r.label.includes("BLACK"));
    const mkt = byName(`${side} ODD/EVEN`);
    return (
      <div className="bg-white">
        <div className="bg-gradient-to-r from-[#0F5F44] to-[#1B8A5F] py-2 text-center text-[1.05rem] font-extrabold text-white">
          {side}
        </div>
        <div className="grid grid-cols-2 gap-3 px-3 pt-3">
          <GreenBox r={even} label="Even" price={even?.back} />
          <GreenBox r={odd} label="Odd" price={odd?.back} />
        </div>
        <div className="grid grid-cols-2 gap-3 px-3 pt-3">
          <GreenBox
            r={red}
            price={red?.back}
            label={<span className="text-[#E0393B]">♥ ♦</span>}
          />
          <GreenBox
            r={black}
            price={black?.back}
            label={<span className="text-black/70">♠ ♣</span>}
          />
        </div>
        <p className="px-3 pb-2 pt-2 text-right text-[0.7rem] font-semibold text-black/55">
          Min:{mkt?.min ?? 100} Max:{mkt?.max ?? 100000}
        </p>
      </div>
    );
  };

  const CardBlock = ({ side }: { side: "DRAGON" | "TIGER" }) => {
    const cards = list(byName(`${side} CARD`));
    if (!cards.length) return null;
    return (
      <div className="mt-3 bg-white">
        <div className="flex items-center justify-between border-b border-[#e2e2e2] px-3 py-2">
          <p className="text-[1rem] font-extrabold uppercase text-[#111]">
            {side} Card <span className="ml-2">{fmtOdds(cards[0]?.back)}</span>
          </p>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2c6f9e] text-[0.62rem] font-bold text-white">
            i
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 px-3 py-4">
          {cards.map((r) => (
            <div key={r.id} className="w-[54px] text-center">
              <div className="relative flex h-[62px] flex-col items-center justify-center rounded-[3px] bg-gradient-to-b from-[#d9d9d9] to-[#9f9f9f] text-[1.1rem] font-extrabold text-[#111]">
                {r.label}
                <span className="absolute bottom-1 left-1 text-[0.58rem] text-black/80">♣ ♠</span>
                <span className="absolute bottom-1 right-1 text-[0.58rem] text-[#E0393B]">♥ ♦</span>
                {!r.open ? (
                  <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="currentColor" aria-hidden="true">
                      <path d="M12 2a5 5 0 0 0-5 5v3H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
                    </svg>
                  </span>
                ) : null}

              </div>
              <p className="mt-0.5 text-[0.72rem] font-bold text-[#1B8A5F]">{fmtOdds(r.back)}</p>
            </div>
          ))}
        </div>
        <p className="px-3 pb-2 text-right text-[0.7rem] font-semibold text-black/55">
          Min:100 Max:{cardMax}
        </p>
      </div>
    );
  };

  return (
    <div className="mt-1">
      <div className="flex items-end justify-between px-1">
        <span className="text-[1.05rem] font-extrabold uppercase text-white/45">Dragon</span>
        <span className="text-[1.05rem] font-extrabold uppercase text-white/45">Tiger</span>
      </div>
      <div className="mt-1 flex items-center justify-between rounded-full bg-[#F1F1F1] pr-0">
        <div className="flex">
          <WinCell r={dragon} side="back" rounded="l" />
          <WinCell r={dragon} side="lay" rounded="r" />
        </div>
        <div className="flex">
          <WinCell r={tiger} side="back" rounded="l" />
          <WinCell r={tiger} side="lay" rounded="r" />
        </div>
      </div>

      {pair ? (
        <div className="relative mt-3 flex h-[62px] items-center justify-between rounded-2xl bg-[#0D3B2B] px-5">
          <span className="text-[1rem] font-bold uppercase text-white/55">{pair.label}</span>
          <span className="text-[1rem] font-bold text-white/55">{fmtOdds(pair.back)}</span>
          {!pair.open ? <Lock /> : null}
        </div>
      ) : null}

      <p className="mt-1 bg-white px-3 py-1 text-right text-[0.7rem] font-semibold text-black/55">
        Min:{winnerMkt?.min ?? 100} Max:{winnerMkt?.max ?? 100000}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <SideBlock side="DRAGON" />
        <SideBlock side="TIGER" />
      </div>

      <CardBlock side="DRAGON" />
      <CardBlock side="TIGER" />
    </div>
  );
}


function GamePage() {
  const embed = useEmbed();
  const shell = (w: string) =>
    embed
      ? "mx-auto min-h-dvh w-full max-w-full bg-table-felt px-0 py-0"
      : `mx-auto ${w} px-4 py-3 sm:py-5`;
  const { gameId } = Route.useParams();
  const { admin, cfg } = useAdminConfig();
  const [state, setState] = useState<CasinoState | null>(null);
  const [results, setResults] = useState<CasinoResult[]>([]);
  const [stream, setStream] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [age, setAge] = useState(0);

  // Some games (e.g. VIMAAN) have no upstream live event. Polling them only
  // produces 404 "Unknown game" / 400 "Valid eventId required" noise.
  const NO_FEED = new Set(["88.0030"]);
  const feedDead = useRef(NO_FEED.has(gameId));

  useEffect(() => {
    feedDead.current = NO_FEED.has(gameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const load = useCallback(async () => {
    if (feedDead.current) return;
    try {
      const s = await fetchCasinoState(gameId);
      setState(s);
      setAge(0);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load live state";
      if (/unknown game|valid eventid required|\(40\d\)/i.test(msg)) {
        feedDead.current = true;
        return;
      }
      setError(msg);
    }
  }, [gameId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 350);
    const a = setInterval(() => setAge((v) => v + 1), 1000);
    return () => {
      clearInterval(t);
      clearInterval(a);
    };
  }, [load]);


  const roundKey = state?.data?.roundId ? String(state.data.roundId) : "";

  useEffect(() => {
    if (!roundKey) return;
    const dd = state?.data as unknown as
      | { gameResult?: string; multiplier?: string; eventName?: string }
      | undefined;
    const real = String(dd?.gameResult ?? dd?.multiplier ?? "");
    if (!real) return;
    const shown = applyOverride(cfg, admin, gameId, real) ?? real;
    logResult({
      ts: Date.now(),
      gameId,
      gameName: dd?.eventName ?? gameId,
      round: roundKey,
      real,
      shown,
      forced: shown !== real,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, gameId, admin, cfg]);


  const feedStatus = (state?.data?.status ?? "").toUpperCase();

  // Result polling. Any feed trigger — new roundId or a status change
  // (OPEN -> SUSPENDED/CLOSED) — instantly refreshes the result plates,
  // plus a short burst so the declared winner lands without a manual reload.
  useEffect(() => {
    if (NO_FEED.has(gameId)) return;
    let alive = true;
    let dead = false;
    const run = () => {
      if (dead) return;
      return fetchCasinoResults(gameId)
        .then((r) => alive && setResults(r.data ?? []))
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "";
          if (/unknown game|valid eventid required|\(40\d\)/i.test(msg)) dead = true;
        });
    };
    void run();
    const burst = [200, 500, 900, 1400, 2000, 2800].map((ms) => setTimeout(run, ms));
    const t = setInterval(run, 600);

    return () => {
      alive = false;
      burst.forEach(clearTimeout);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, roundKey, feedStatus]);


  // auto settlement — every finished round settles my open bets
  useEffect(() => {
    results.slice(0, 6).forEach((r) => {
      const rr = r as CasinoResult & { result?: string; selectionName?: string };
      const winner = (rr.winner ?? rr.result ?? rr.selectionName ?? "").toString().trim();
      const rid = String(r.roundId ?? "");
      if (rid) settleRound(gameId, rid, winner);
    });
    const top = results[0] as (CasinoResult & { _id?: string; result?: string; selectionName?: string }) | undefined;
    if (top && !top.roundId) {
      const winner = (top.winner ?? top.result ?? top.selectionName ?? "").toString().trim();
      settleLatest(gameId, String(top._id ?? winner), winner);
    }
  }, [results, gameId]);


  useEffect(() => {
    fetchCasinoStream(gameId)
      .then((r) => setStream(r.upstreamIframeUrl ?? null))
      .catch(() => undefined);
  }, [gameId]);

  const d = state?.data ?? null;
  const status = (d?.status ?? "").toUpperCase();
  const suspended = status ? !isOpenStatus(status) : false;
  const markets = d?.marketArr ?? [];
  const liveCards = (d?.cardsArr ?? {}) as Record<string, Record<string, string>>;
  // When the live feed has already cleared the table for the next round but the
  // settled round is still on screen, show the cards from the declared result so
  // players see the real dealt cards instead of face-down placeholders.
  const resultCards = useMemo(() => {
    const raw = (results[0]?.cards ?? {}) as Record<string, unknown>;
    const out: Record<string, Record<string, string>> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) {
        const hand: Record<string, string> = {};
        v.forEach((c, i) => (hand[String(i)] = String(c)));
        out[k.replace(/_/g, " ").trim().toUpperCase()] = hand;
      } else if (v && typeof v === "object") {
        out[k.replace(/_/g, " ").trim().toUpperCase()] = v as Record<string, string>;
      } else if (typeof v === "string") {
        out[k.replace(/_/g, " ").trim().toUpperCase() || "CARD"] = { "0": v };
      }
    }
    return out;
  }, [results]);

  const liveHasRealCard = Object.values(liveCards).some((h) =>
    h && typeof h === "object"
      ? Object.values(h).some((c) => c && String(c) !== "0")
      : Boolean(h) && String(h) !== "0",
  );
  // Prefer the live feed whenever it sends a card slot for this round (even a
  // face-down "0"), so the table never shows the previous round's card.
  const cards =
    liveHasRealCard || Object.keys(liveCards).length || !Object.keys(resultCards).length
      ? liveCards
      : resultCards;




  // Keep the hand layout stable across the round (like the live table): while the
  // dealer has not turned the cards yet we still show face-down placeholders and
  // only swap in the real card once the feed sends its code.
  const layoutRef = useRef<{ title: string; count: number }[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [overlayScale, setOverlayScale] = useState(1);

  const handLayout = useMemo(() => {
    const nested = Object.entries(cards).filter(
      ([, v]) => typeof v === "object" && v !== null,
    ) as [string, Record<string, string>][];
    let hands: { title: string; hand: Record<string, string> }[] = [];
    if (nested.length) {
      hands = nested.map(([k, v]) => ({ title: k, hand: v }));
    } else if (Object.keys(cards).length) {
      hands = [
        {
          title: d?.eventName?.toUpperCase().startsWith("LUCKY") ? "LUCKY CARD" : "CARD",
          hand: cards as unknown as Record<string, string>,
        },
      ];
    }
    // Live table shows the joker/blind card on top of the player hands.
    hands = hands
      .map((h, i) => ({ h: { ...h, title: handTitleFor(h.title, d?.eventName) }, i }))
      .sort((a, b) => {
        const ja = /JOKER/i.test(a.h.title) ? 0 : 1;
        const jb = /JOKER/i.test(b.h.title) ? 0 : 1;
        const ab = a.h.title === "A" ? 0 : a.h.title === "B" ? 1 : 2;
        const bb = b.h.title === "A" ? 0 : b.h.title === "B" ? 1 : 2;
        return ja - jb || ab - bb || a.i - b.i;
      })
      .map(({ h }) => h);
    if (hands.length) {

      const remembered = new Map(layoutRef.current.map((h) => [h.title, h.count]));
      const padded = hands.map((h) => {
        const codes = Object.values(h.hand);
        const want = Math.max(codes.length, remembered.get(h.title) ?? 0);
        const hand: Record<string, string> = {};
        for (let i = 0; i < want; i += 1) hand[String(i)] = codes[i] ?? "0";
        return { title: h.title, hand };
      });
      layoutRef.current = padded.map((h) => ({
        title: h.title,
        count: Object.keys(h.hand).length,
      }));
      return padded;
    }
    // No cards in the feed yet → keep last round's shape with face-down cards.
    return layoutRef.current.map((h) => {
      const hand: Record<string, string> = {};
      for (let i = 0; i < h.count; i += 1) hand[String(i)] = "0";
      return { title: h.title, hand };
    });
  }, [cards, d?.eventName]);



  // Keep the card overlay fully inside the video like the live table does.
  useEffect(() => {
    const fit = () => {
      const stage = stageRef.current;
      const overlay = overlayRef.current;
      if (!stage || !overlay) return;
      const availH = stage.clientHeight - 24;
      const availW = stage.clientWidth - 24;
      const h = overlay.offsetHeight;
      const w = overlay.offsetWidth;
      if (!h || !w || availH <= 0) return;
      const next = Math.min(1, availH / h, availW / w);
      setOverlayScale((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    if (overlayRef.current) ro.observe(overlayRef.current);
    return () => ro.disconnect();
  }, [handLayout]);





  const isOriginal = gameId.startsWith("88.");
  const isBbb = gameId === "4.3544687543453";
  const raw = (d ?? {}) as unknown as {
    multiplier?: string;
    runners?: BbbRunner[];
    news?: string;
    min?: number;
    max?: number;
  };

  if (isBbb) {
    return (
      <div className={shell("max-w-[900px]")}>
        <div className="bg-[#EDEDED] px-3 py-2">
          {embed ? null : (

            <Link to="/" className="text-sm text-[#2563EB] hover:underline">

              ← Back to lobby

            </Link>

          )}
        </div>
        <div className="flex items-center justify-between bg-[#2E4B5C] px-3 py-2">
          <span className="text-[0.95rem] font-bold uppercase text-white">
            {d?.eventName ?? "Ball By Ball"}
          </span>
          <span className="flex items-center gap-2 text-[0.85rem] font-bold text-white">
            {d?.roundId ?? "—"} <BalanceChip />
          </span>
        </div>
        <img
          src={ballByBallBanner.url}
          alt="Ball by Ball"
          loading="lazy"
          className="block w-full"
        />
        <BetLayer
          gameId={gameId}
          gameName={d?.eventName ?? "Ball By Ball"}
          round={String(d?.roundId ?? "")}
          disabled={!(raw.runners ?? []).some((r) => (r.status ?? "").toUpperCase() === "ACTIVE")}
        >
          <BallByBallBoard
            runners={raw.runners ?? []}
            min={raw.min ?? 100}
            max={raw.max ?? 100000}
            news={raw.news}
            recent={results.slice(0, 10).map((r) => {
              const rr = r as CasinoResult & { result?: string; selectionName?: string };
              const s = (rr.winner ?? rr.result ?? rr.selectionName ?? "-").toString().trim();
              if (/^EXTRA/i.test(s)) return "EX";
              if (/^WICKET/i.test(s)) return "W";
              return s.match(/^\d+/)?.[0] ?? s;
            })}
          />

        </BetLayer>
      </div>

    );
  }

  if (gameId === "88.0030") {
    return (
      <div className={shell("max-w-[1080px]")}>
        {embed ? null : (

          <Link to="/" className="text-sm text-[#2563EB] hover:underline">

            ← Back to lobby

          </Link>

        )}
        <div className={embed ? "" : "mt-2"}>
          <Aviator />
        </div>

      </div>
    );
  }

  if (isOriginal) {
    return (
      <div className={shell("max-w-[1240px]")}>
        {embed ? null : (

          <Link to="/" className="text-sm text-[#2563EB] hover:underline">

            ← Back to lobby

          </Link>

        )}
        {embed ? null : (
          <div className="mt-2">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Live · Universe Original
            </p>
            <h1 className="text-[1.35rem] font-extrabold uppercase text-foreground">
              {cleanGameName(d?.eventName) ?? "Loading game…"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.8rem] font-bold text-foreground/80">
              <span>RID: {d?.roundId ?? "—"}</span>
            </p>
          </div>
        )}


        {error ? <p className="mt-3 text-sm text-live-lose">{error}</p> : null}

        {gameId === "88.0019" ? (
          <div className="mt-2">
            <LuckyWheel
              winner={applyOverride(
                cfg,
                admin,
                gameId,
                (d as unknown as { gameResult?: string })?.gameResult ??
                  results[0]?.winner ??
                  null,
              )}
              roundId={d?.roundId ? String(d.roundId) : undefined}
              suspended={suspended}
              leftSec={Math.max(0, (d?.leftSec ?? 0) - age)}
            />
          </div>
        ) : gameId === "88.0020" ? (
          <DreamWheel
            winner={applyOverride(
              cfg,
              admin,
              gameId,
              (d as unknown as { gameResult?: string })?.gameResult ??
                results[0]?.winner ??
                null,
            )}
            roundId={d?.roundId ? String(d.roundId) : undefined}
            suspended={suspended}
            leftSec={Math.max(0, (d?.leftSec ?? 0) - age)}
          />

        ) : gameId === "88.0021" ? (
          <CoinStageImage
            winner={(() => {
              const w = (
                applyOverride(
                  cfg,
                  admin,
                  gameId,
                  (d as unknown as { gameResult?: string })?.gameResult ??
                    results[0]?.winner ??
                    "",
                ) ?? ""
              )
                .toString()
                .toUpperCase();
              if (w.startsWith("T")) return "TAILS";
              if (w.startsWith("H")) return "HEADS";
              return null;
            })()}
            roundId={d?.roundId ? String(d.roundId) : undefined}
            suspended={suspended}
            leftSec={Math.max(0, (d?.leftSec ?? 0) - age)}
          />

        ) : (
          <BalloonStage
            multiplier={
              applyOverride(cfg, admin, gameId, raw.multiplier ?? "1.00") ?? "1.00"
            }
            roundId={d?.roundId ? String(d.roundId) : undefined}
            suspended={suspended}
            leftSec={Math.max(0, (d?.leftSec ?? 0) - age)}
          />
        )}

        <BetLayer
          gameId={gameId}
          gameName={d?.eventName ?? gameId}
          round={String(d?.roundId ?? "")}
          disabled={suspended}
        >
          <Fit mobileNative designWidth={900}>
          {gameId === "88.0021" ? (
            <div>
              <HeadsTailsPanel
                runners={(markets[0]?.runners ?? []).map((r) => ({
                  id: String(r.selectionId),
                  label:
                    markets[0]?.runnersName?.[String(r.selectionId)] ?? String(r.selectionId),
                  price: r.price?.back?.[0]?.price,
                  size: r.price?.back?.[0]?.size,
                  open: !suspended && isOpenStatus(r.status),
                }))}
                min={markets[0]?.min ?? 100}
                max={markets[0]?.max ?? 100000}
                recent={results.slice(0, 10).map((r) => {
                  const rr = r as CasinoResult & { result?: string; selectionName?: string };
                  return (rr.winner ?? rr.result ?? rr.selectionName ?? "-").toString().trim();
                })}
              />
            </div>
          ) : gameId !== "88.0023" && markets.length ? (
            <NumberPanel
              markets={markets}
              suspended={suspended}
              perRow={gameId === "88.0019" ? 5 : gameId === "88.0020" ? 3 : 2}
              dream={gameId === "88.0020"}
            />
          ) : null}
          </Fit>

        </BetLayer>


        {gameId !== "88.0021" && gameId !== "88.0023" ? (
          <RecentStrip
            results={results}
            dream={gameId === "88.0020"}
            lucky7={gameId === "99.0030"}
          />
        ) : null}

      </div>
    );
  }

  return (
    <div className={shell("max-w-[900px]")}>
      {embed ? null : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to lobby
            </Link>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Live · Universe Live
            </p>
            <h1 className="mt-1 text-[1.35rem] font-extrabold leading-tight text-foreground sm:text-2xl">
              {cleanGameName(d?.eventName) ?? "Loading game…"}
            </h1>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="flex items-center gap-2 rounded-full bg-live-pill px-3 py-1 text-sm font-semibold text-live-pill-foreground">
              <span className="h-2 w-2 rounded-full bg-current" /> Live
            </span>
          </span>
        </div>
      )}


      {error && !embed ? <p className="mt-3 text-sm text-live-lose">{error}</p> : null}

      <div
        ref={stageRef}
        className={`relative overflow-hidden bg-black ${embed ? "" : "mt-4 rounded-none sm:rounded-md"}`}
      >

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
        <div
          ref={overlayRef}
          className="pointer-events-none absolute left-1 top-1 z-20 max-w-[calc(100%-0.5rem)] origin-top-left space-y-1 overflow-visible sm:left-3 sm:top-3 sm:max-w-[calc(100%-1.5rem)]"
          style={{ transform: `scale(${overlayScale})` }}
        >
          <p className="text-[0.6rem] font-bold uppercase tracking-wide text-white drop-shadow sm:text-[0.72rem]">
            RID: {d?.roundId ?? "—"}
          </p>
          {handLayout.map((h) => (
            <Cards key={h.title} title={h.title} hand={h.hand} />
          ))}
        </div>


        <RoundTimer
          leftSec={Math.max(0, (d?.leftSec ?? 0) - age)}
          suspended={suspended}
          className="absolute right-1 top-1 z-20 sm:right-2 sm:top-2"
          size="h-9 w-9 sm:h-14 sm:w-14"
        />

        <ResultBanner results={results} gameId={gameId} gameName={d?.eventName ?? null} />
      </div>


      <BetLayer
        gameId={gameId}
        gameName={d?.eventName ?? gameId}
        round={String(d?.roundId ?? "")}
        disabled={suspended}
      >
        <Fit designWidth={860} mobileNative>
        {gameId === "99.0014" && markets.length ? (
          <MuflisPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0018" && markets.length ? (
          <DT20Panel markets={markets} suspended={suspended} />
        ) : gameId === "99.0021" && markets.length ? (
          <DragonTigerPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0041" && markets.length ? (
          <DTLPanel markets={markets} suspended={suspended} resultDeclared={suspended} />
        ) : gameId === "99.0025" && markets.length ? (
          <AndarBaharPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0001" && markets.length ? (
          <BaccaratPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0007" && markets.length ? (
          <PokerPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0046" && markets.length ? (
          <CardRacePanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0005" && markets.length ? (
          <AAAPanel markets={markets} suspended={suspended} />
        ) : ["99.0030", "99.0010", "99.0019"].includes(gameId) && markets.length ? (
          markets.map((m, i) => (
            <DarkGridBoard key={`${m.marketId}-${i}`} market={m} suspended={suspended} />
          ))
        ) : ["99.0016", "99.0013"].includes(gameId) && markets.length ? (
          markets.map((m, i) => (
            <DarkRowBoard key={`${m.marketId}-${i}`} market={m} suspended={suspended} />
          ))
        ) : (
          markets.map((m, i) => (
            <MarketBoard key={`${m.marketId}-${i}`} market={m} suspended={suspended} />
          ))
        )}
        </Fit>
        {/* Recent Result sits flush under the last market, like the original. */}
        <RecentStrip results={results} lucky7={gameId === "99.0030"} />
      </BetLayer>



      {!markets.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading live markets…</p>
      ) : null}



    </div>
  );
}


/** "RESULT DECLARED" overlay — shows the winning selection right after a round settles. */
const LUCKY7_GAMES = ["99.0030", "99.0010", "99.0019"];

function lucky7Label(winner: string): string | null {
  const w = winner.trim().toUpperCase();
  if (/^(H|HIGH)\b|HIGH\s*CARD|8\s*TO\s*K/.test(w)) return "HIGH CARD ( 8 TO K ) WIN";
  if (/^(L|LOW)\b|LOW\s*CARD|A\s*TO\s*6/.test(w)) return "LOW CARD ( A TO 6 ) WIN";
  if (/^(TIE|DRAW|7)$/.test(w) || /TIE/.test(w)) return "TIE";
  return null;
}

type AnyResult = CasinoResult & { _id?: string; result?: string; selectionName?: string };

/** Winner label from a result row — flat `winner` field or nested market results. */
function deriveWinner(r?: AnyResult, lucky7?: boolean): string {
  if (!r) return "";
  const flat = (r.winner ?? r.result ?? r.selectionName ?? "").toString().trim();
  const markets = r.results ?? [];
  // Lucky 7 rule: when the dealt card is a 7 the round is a TIE — neither
  // LOW nor HIGH wins, so the feed reports no WINNER-market winner.
  if (lucky7) {
    const cardCode = String((r as { cards?: { card?: string } }).cards?.card ?? "");
    const clean = cardCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    let rank = clean.slice(1);
    if (rank === "T") rank = "10";
    if (rank === "7") return "TIE";
  }
  // Prefer an explicit WINNER market, but fall back to ANY market that has a
  // declared winning runner — some tables never publish a "WINNER" market.
  const ordered = [
    ...markets.filter((m) => /winner/i.test(m.marketName ?? "")),
    ...markets.filter((m) => !/winner/i.test(m.marketName ?? "")),
  ];
  for (const nested of ordered) {
    const nRunners = nested?.runners as unknown;
    let derived = "";
    if (Array.isArray(nRunners)) {
      const w = (nRunners as { selectionId?: string | number; result?: string }[]).find(
        (x) => String(x.result ?? "").toUpperCase() === "WINNER",
      );
      if (w) derived = (nested.runnersName ?? {})[String(w.selectionId)] ?? "";
    } else if (nRunners && typeof nRunners === "object") {
      const id = Object.entries(nRunners as Record<string, string>).find(
        ([, v]) => String(v).toUpperCase() === "WINNER",
      )?.[0];
      if (id) derived = (nested.runnersName ?? {})[id] ?? "";
    }
    if (derived) return derived;
  }
  return flat.replace(/_/g, " ");
}


function ResultBanner({
  results,
  gameId,
  gameName,
}: {
  results: CasinoResult[];
  gameId?: string;
  gameName?: string | null;
}) {

  const top = results[0] as AnyResult | undefined;
  const key = String(top?.roundId ?? top?._id ?? "");
  const winner = deriveWinner(top, !!gameId && LUCKY7_GAMES.includes(gameId));
  const seen = useRef<string>("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!key || !winner) return;
    if (!seen.current) {
      seen.current = key;
      return;
    }
    if (seen.current === key) return;
    seen.current = key;
    setShow(true);
    const t = setTimeout(() => setShow(false), 8000);
    return () => clearTimeout(t);
  }, [key, winner]);

  if (!show || !winner) return null;
  const l7 = gameId && LUCKY7_GAMES.includes(gameId) ? lucky7Label(winner) : null;
  const short = winner.replace(/player\s*/i, "").trim().toUpperCase();
  const ab = isAndarBahar(gameName);
  const dt = /dragon\s*tiger/i.test(gameName ?? "");
  let expanded = winner.toUpperCase().replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (ab) {
    const c = chipLabel(winner);
    if (c === "A" || c === "B") expanded = c === "A" ? "ANDAR" : "BAHAR";
  } else if (dt && (short === "D" || short === "T")) expanded = short === "D" ? "DRAGON" : "TIGER";
  else if (/^(player\s*)?[ab]$/i.test(winner)) expanded = `PLAYER ${short}`;
  const label = l7 ?? (/win/i.test(expanded) ? expanded : `${expanded} WIN`);


  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <span className="rounded-[6px] bg-[#F26A2E] px-4 py-2 text-[1.05rem] font-bold uppercase tracking-wide text-white shadow-[0_4px_14px_rgba(0,0,0,0.45)] [animation:scale-in_0.25s_ease-out]">
        {label}
      </span>
    </div>
  );

}

/**
 * Real feed winner label -> the short chip label each table shows on
 * universeapi.shop (A/B, D/T/L, P/B/T, L/H, 8..11, H/T, numbers, suits).
 */
function chipLabel(raw: string): string {
  const u = raw.toUpperCase().trim();
  if (!u || u === "-") return "-";
  if (/^EXTRA/.test(u)) return "EX";
  if (/^WICKET/.test(u)) return "W";
  if (/(1ST|2ND|1st|2nd)\s*BET\s*A\b/i.test(u) || /^ANDAR/.test(u)) return "A";
  if (/(1ST|2ND|1st|2nd)\s*BET\s*B\b/i.test(u) || /^BAHAR/.test(u)) return "B";
  if (/^AMAR/.test(u)) return "A";
  if (/^AKBAR/.test(u)) return "B";
  if (/^ANTHONY/.test(u)) return "C";
  if (/^LOW\s*CARD/.test(u)) return "L";
  if (/^HIGH\s*CARD/.test(u)) return "H";
  if (/^DRAGON/.test(u)) return "D";
  if (/^TIGER/.test(u)) return "T";
  if (/^LION/.test(u)) return "L";
  if (/^BANKER/.test(u)) return "B";
  if (/^HEAD/.test(u)) return "H";
  if (/^TAIL/.test(u)) return "T";
  if (/^TIE|^DRAW/.test(u)) return "Tie";
  const player = u.match(/PLAYER[\s_]*([A-Z]|\d+)/);
  if (player) return player[1]!;
  if (/^PLAYER$/.test(u)) return "P";
  const num = u.match(/^\d+(\.\d+)?/);
  if (num) return num[0]!;
  return u.slice(0, 1);
}

function RecentStrip({
  results,
  dream,
  lucky7,
}: {
  results: CasinoResult[];
  dream?: boolean;
  lucky7?: boolean;
}) {
  return (

      <div className="mt-0 flex items-center gap-2 overflow-x-auto bg-black px-3 py-2.5">
        <span className="mr-1 shrink-0 text-[0.95rem] font-bold text-white">Recent Result</span>



        {results.slice(0, 10).map((r, idx) => {
          const rr = r as AnyResult;
          const raw = (deriveWinner(rr, lucky7) || "-").trim();
          const playerMatch = raw.match(/player[\s_]*([a-z]|\d+)/i);
          const w = chipLabel(raw);
          const lower = w.toLowerCase();
          // Lucky 7: only LOW / HIGH are real outcomes — a 7 voids the winner
          // market, so anything else the feed reports is the tie round.
          const l7Tie = !!lucky7 && !["L", "H"].includes(w.toUpperCase());
          const isTie = !l7Tie && (lower.startsWith("tie") || lower.startsWith("draw"));
          const isNum = !l7Tie && /^\d+$/.test(w);
          const first = l7Tie ? "T" : isTie ? "T" : isNum ? w : w.slice(0, 1).toUpperCase();

          const PLAYER32_TONE: Record<string, string> = {
            "8": "bg-[#E67E22] text-white",
            "9": "bg-[#27AE60] text-white",
            "10": "bg-[#E67E22] text-white",
            "11": "bg-[#8E44AD] text-white",
          };
          const tone =
            isNum && playerMatch
              ? (PLAYER32_TONE[w] ?? "bg-[#E67E22] text-white")
              : isNum
                ? w === "0"
                  ? "bg-[#12563A] text-white"
                  : Number(w) % 2 === 1
                    ? "bg-[#D9483B] text-white"
                    : "bg-[#1E1E1E] text-white"
                : isTie
                  ? "bg-[#8CD9B5] text-[#0F172A]"
                  : first === "L"
                    ? "bg-[#8E44C7] text-white"
                    : ["B", "T"].includes(first)
                      ? "bg-ex-lay text-ex-cell-foreground"
                      : "bg-ex-back text-ex-cell-foreground";

          const finalTone = l7Tie
            ? "bg-[#8CD9B5] text-[#0F172A]"
            : ((dream ? DREAM_TONE[first] : undefined) ?? tone);

          const suit = /heart/i.test(raw)
            ? "♥"
            : /spade/i.test(raw)
              ? "♠"
              : /diamond/i.test(raw)
                ? "♦"
                : /club/i.test(raw)
                  ? "♣"
                  : null;
          if (suit) {
            const col = suit === "♥" || suit === "♦" ? "#E01B24" : "#111";
            return (
              <span
                key={`${r.roundId ?? ""}-${idx}`}
                title={`Round ${r.roundId}`}
                className="flex h-10 w-[30px] shrink-0 flex-col items-center justify-center rounded-[4px] border border-[#d9d9d9] bg-white leading-none shadow-sm"
                style={{ color: col }}
              >
                <span className="text-[0.9rem] font-extrabold">K</span>
                <span className="text-[0.85rem] font-bold">{suit}</span>
              </span>
            );
          }

          return (
            <span
              key={`${r.roundId ?? ""}-${idx}`}
              title={`Round ${r.roundId}`}
              className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold ${finalTone}`}
            >
              {first || "-"}
            </span>
          );

        })}
      </div>
  );
}
