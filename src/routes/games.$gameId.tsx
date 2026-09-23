import { createFileRoute, Link } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Info, LockKeyhole } from "lucide-react";
import { Aviator } from "@/components/Aviator";
import { FitBoard } from "@/components/FitBoard";
import { RoundTimer } from "@/components/RoundTimer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEmbed } from "@/lib/embed";
import { AppLoader } from "@/components/AppLoader";
import { Button } from "@/components/ui/button";
import { CasinoLivePlayer } from "@/components/CasinoLivePlayer";
import { getGame } from "@/data/games";

import { applyOverride, useAdminConfig } from "@/lib/admin";
import { logResult } from "@/lib/telemetry";
import { BetLayer, ErrorToast, SuccessToast } from "@/components/betting";
import { placeBet, readWallet } from "@/lib/wallet";
import { playerSession } from "@/lib/player";
import {
  deriveWinner,
  useResultFeed,
  LUCKY7_GAMES,
  type AnyResult,
  type FeedResult,
} from "@/lib/result-feed";
import { CoinStageImage, HeadsTailsPanel } from "@/components/HeadsTails";

import { CardFace } from "@/components/CardFace";
import { CARD_BACK, cardImage } from "@/lib/card-assets";
import { LUCKY7_CARD_IMAGES } from "@/lib/lucky7-card-assets";
import hkCard from "@/assets/cards/HK.png.asset.json";
import skCard from "@/assets/cards/SK.png.asset.json";
import dkCard from "@/assets/cards/DK.png.asset.json";
import ckCard from "@/assets/cards/CK.png.asset.json";



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
import ballByBallResult from "@/assets/ball-by-ball-result.png";
import casinoStageMark from "@/assets/universe-casino-loader.gif.asset.json";
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
  fmtInt,
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
// Live studio TV. Each table game publishes on the studio WebRTC server as
// GAME<nn>, where nn is the suffix of its 99.00nn id. Only these ids have a
// published stream, so unknown games keep falling back to the feed lookup.
const STUDIO_STREAM_IDS = new Set([
  "01", "05", "07", "10", "13", "14", "16", "18", "19", "21", "22", "25", "30", "41", "46",
]);

function studioStreamUrl(gameId: string): string | null {
  const m = /^99\.00(\d{2})$/.exec(gameId);
  if (!m || !STUDIO_STREAM_IDS.has(m[1]!)) return null;
  return `https://player.universestudio.games/index.html?appName=PLATINGE7&streamingName=GAME${m[1]}&url=livecdnplatin.com&token=178610215242255360831371`;
}

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
      <p className="text-[0.8rem] font-bold uppercase text-white drop-shadow">
        {title.replace(/_/g, " ").toUpperCase()}
      </p>
      <div className="mt-0.5 flex flex-wrap justify-start gap-0">

        {codes.map((c, i) => (
          <Card key={`${c}-${i}`} code={c} />
        ))}
      </div>
    </div>
  );
}

function OneDayCards({ hand, title }: { hand: Record<string, string>; title: string }) {
  const codes = Object.values(hand);
  if (!codes.length) return null;
  return (
    <div>
      <p className="text-[0.76rem] font-extrabold uppercase leading-none text-white [text-shadow:0_1px_2px_var(--casino-market-text)]">
        {title.replace(/_/g, " ").toUpperCase()}
      </p>
      <div className="mt-[3px] flex gap-[2px] [&_img]:h-[34px] [&_img]:w-[24px] [&_img]:rounded-[2px] [&_span[aria-label]]:h-[34px] [&_span[aria-label]]:w-[24px]">
        {codes.map((code, index) => <Card key={`${code}-${index}`} code={code} />)}
      </div>
    </div>
  );
}

function JokerCards({ hand, title, sideThird = false }: { hand: Record<string, string>; title: string; sideThird?: boolean }) {
  const codes = Object.values(hand);
  if (!codes.length) return null;
  return (
    <div>
      <p className="text-[0.76rem] font-extrabold uppercase leading-none text-white [text-shadow:0_1px_2px_var(--casino-market-text)]">
        {title.replace(/_/g, " ").toUpperCase()}
      </p>
      <div className="mt-[2px] flex gap-[2px] [&_img]:h-[31px] [&_img]:w-[22px] [&_img]:rounded-[2px] [&_span[aria-label]]:h-[31px] [&_span[aria-label]]:w-[22px]">
        {codes.map((code, index) =>
          sideThird && index === 2 ? (
            <span key={`${code}-${index}`} className="flex h-[31px] w-[31px] items-center justify-center">
              <span className="flex rotate-90"><Card code={code} /></span>
            </span>
          ) : (
            <Card key={`${code}-${index}`} code={code} />
          ),
        )}
      </div>
    </div>
  );
}

const OPEN_STATUSES = new Set(["ONLINE", "ACTIVE", "OPEN", "IN_PLAY"]);
function isOpenStatus(status?: string | null) {
  return OPEN_STATUSES.has((status ?? "").toUpperCase());
}

/** Preserve a runner's first closed state until the round changes. */
function stabilizeCasinoState(previous: CasinoState | null, incoming: CasinoState): CasinoState {
  const prevData = previous?.data;
  const nextData = incoming.data;
  if (!prevData || !nextData || String(prevData.roundId ?? "") !== String(nextData.roundId ?? "")) {
    return incoming;
  }
  const previousMarkets = new Map(
    (prevData.marketArr ?? []).map((market) => [String(market.marketId), market]),
  );
  const marketArr = (nextData.marketArr ?? []).map((market) => {
    const previousMarket = previousMarkets.get(String(market.marketId));
    if (!previousMarket) return market;
    const previousRunners = new Map(
      (previousMarket.runners ?? []).map((runner) => [String(runner.selectionId), runner]),
    );
    return {
      ...market,
      runners: (market.runners ?? []).map((runner) => {
        const previousRunner = previousRunners.get(String(runner.selectionId));
        const previousStatus = previousRunner?.status;
        if (!previousStatus || isOpenStatus(previousStatus)) return runner;
        return { ...runner, status: previousStatus };
      }),
    };
  });
  return { ...incoming, data: { ...nextData, marketArr } };
}

/** Original-style suspended veil: faded market background + bold red SUSPEND text. */
function SuspendVeil({
  className = "",
  size = "md",
  solid = true,
  repeat = 1,
  bordered = true,
}: {
  className?: string;
  size?: "sm" | "md";
  solid?: boolean;
  repeat?: number;
  bordered?: boolean;
}) {
  return (
    <div
      data-suspended="true"
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center ${
        repeat > 1 ? "justify-around" : "justify-center"
      } ${bordered ? "border border-[#f0b3b3]" : ""} ${className}`}
      style={{ background: solid ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.45)" }}
    >
      {Array.from({ length: Math.max(1, repeat) }).map((_, i) => (
        <span
          key={i}
          className={`font-bold uppercase leading-none text-[#e28b8b] ${
            size === "sm" ? "text-[1.15rem]" : "text-[1.5rem]"
          }`}
        >
          SUSPENDED
        </span>
      ))}
    </div>
  );
}


/** Round "i" badge in a market header; tapping it reveals the min/max limits. */
function MarketInfo({ min, max }: { min: number; max: number }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative flex shrink-0 items-center gap-2">
      {open ? (
        <span className="whitespace-nowrap text-[0.68rem] font-bold text-board-header-foreground/90">
          Min/Max: {min} - {max}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Min and max limits"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-[0.68rem] font-bold italic text-casino-market-header"
      >
        i
      </button>
    </span>
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

  const LockOverlay = () => (
    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-baccarat-lock text-board-header-foreground">
      <LockKeyhole className="h-5 w-5" strokeWidth={3} />
    </span>
  );

  const chipBet = useChipBet();

  const BetPlate = ({
    r,
    variant,
    align = "center",
  }: {
    r: R;
    variant: "player" | "banker" | "tie" | "player-pair" | "banker-pair";
    align?: "left" | "right" | "center";
  }) => {
    const tone = variant === "player" || variant === "banker-pair"
      ? "bg-baccarat-blue"
      : variant === "tie"
        ? "bg-baccarat-green"
        : "bg-baccarat-red";
    const chipProps = chipBet
      ? {
          "data-market-option": "",
          "data-nobet": "",
          onClick: () => {
            if (r.open && r.price) chipBet.bet(r.label, r.price);
          },
        }
      : {
          "data-market-option": "",
          "data-market-plate": "",
          "data-bet-label": r.label,
          "data-bet-odds": String(r.price ?? ""),
        };
    const alignCls =
      align === "left"
        ? "items-start pl-3"
        : align === "right"
          ? "items-end pr-3"
          : "items-center";
    return (
      <button
        type="button"
        {...chipProps}
        disabled={!r.open}
        className={`relative flex h-full w-full min-w-0 flex-col justify-center overflow-hidden text-board-header-foreground ${variant === "tie" ? "pointer-events-auto" : ""} ${tone} ${alignCls} ${r.open ? "" : "brightness-[0.62] saturate-[0.8]"}`}
      >
        <span className="text-[1rem] font-bold uppercase leading-tight">{r.label}</span>
        {r.open || variant === "player" || variant === "banker" ? <span className="mt-[3px] text-[1rem] font-bold leading-none">{fmtOdds(r.price)}</span> : null}
        {!r.open ? <LockOverlay /> : null}
      </button>
    );
  };

  const player = winner.find((r) => r.label.includes("PLAYER")) ?? winner[0];
  const banker = winner.find((r) => r.label.includes("BANKER")) ?? winner[1];
  const playerPair = pair.find((r) => r.label.includes("PLAYER")) ?? pair[0];
  const bankerPair = pair.find((r) => r.label.includes("BANKER")) ?? pair[1];

  const marketLocked = suspended || [...winner, ...pair, ...(tie ? [tie] : [])].every((runner) => !runner.open);

  return (
    <div className="relative mt-0 bg-baccarat-surface pb-1.5 pt-2">
      <div className="relative mx-2 h-[89px] overflow-visible rounded-[18px]">
        <div className="grid h-full grid-cols-2 overflow-hidden rounded-[18px]">
          {player ? <BetPlate r={player} variant="player" align="left" /> : null}
          {banker ? <BetPlate r={banker} variant="banker" align="right" /> : null}
        </div>
        {tie ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="h-[89px] w-[89px] overflow-hidden rounded-full border-[3px] border-baccarat-ring">
              <BetPlate r={tie} variant="tie" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-2.5 grid h-[76px] grid-cols-2 gap-2 px-2">
        {playerPair ? <BetPlate r={playerPair} variant="player-pair" /> : null}
        {bankerPair ? <BetPlate r={bankerPair} variant="banker-pair" /> : null}
      </div>
      <BaccaratChipRow />
      {marketLocked ? <span data-suspended="" hidden /> : null}
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
  const Plate = ({ runner, label, locked }: {
    runner?: (CasinoMarket["runners"] extends (infer R)[] | undefined ? R : never) | undefined;
    label: string;
    locked: boolean;
  }) => {
    const point = runner?.price?.back?.[0];
    return (
      <button
        type="button"
        data-market-option=""
        data-market-plate=""
        data-bet-label={label}
        data-bet-odds={point?.price ?? ""}
        disabled={locked || !point?.price}
        className={`relative h-[62px] w-[190px] max-w-[96%] overflow-hidden rounded-bl-[6px] rounded-br-[42px] rounded-tl-[42px] rounded-tr-[6px] bg-background shadow-[0_4px_6px_color-mix(in_oklab,var(--foreground)_22%,transparent)] ${
          locked ? "opacity-70" : ""
        }`}
      >
        <span
          className={`absolute inset-y-0 left-[14px] right-[14px] -skew-x-[28deg] ${
            locked ? "bg-muted" : "bg-poker-gold"
          }`}
        />
        <span className="relative flex h-full flex-col items-center justify-center text-poker-plate-text">
          <span className="text-[1.3rem] font-extrabold leading-none">{fmtOdds(point?.price)}</span>
          <span className="mt-[3px] text-[0.72rem] font-medium leading-none opacity-70">
            {point?.size == null ? "" : String(Math.round(point.size))}
          </span>
        </span>
      </button>
    );
  };


  return (
    <div className="bg-poker-panel px-2 pb-2 pt-2">
      <div className="mb-3 grid h-[56px] grid-cols-2 gap-5 px-1">
        <div className="flex items-center justify-center rounded-[10px] bg-poker-gold text-[1.1rem] font-extrabold uppercase text-poker-plate-text">PLAYER A</div>
        <div className="flex items-center justify-center rounded-[10px] bg-poker-gold text-[1.1rem] font-extrabold uppercase text-poker-plate-text">PLAYER B</div>
      </div>
      {[...markets].sort((x, y) => { const o = ["WINNER", "ONE PAIR", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "STRAIGHT FLUSH", "FLUSH", "FULL HOUSE", "FOUR OF A KIND"]; const xi = o.indexOf((x.marketName ?? "").trim().toUpperCase()); const yi = o.indexOf((y.marketName ?? "").trim().toUpperCase()); return (xi < 0 ? 99 : xi) - (yi < 0 ? 99 : yi); }).map((m) => {
          const names = m.runnersName ?? {};
          const runners = m.runners ?? [];
          const a = runners.find((r) => (names[String(r.selectionId)] ?? "").toUpperCase().includes("A"));
          const b = runners.find((r) => (names[String(r.selectionId)] ?? "").toUpperCase().includes("B"));
          const isSusp =
            suspended ||
            runners.every((r) => !isOpenStatus(r.status));
          return (
            <section key={m.marketId} className={`relative mb-2 overflow-hidden rounded-bl-[6px] rounded-br-[52px] rounded-tl-[52px] rounded-tr-[6px] bg-background pb-3 shadow-[0_2px_6px_color-mix(in_oklab,var(--foreground)_22%,transparent)] ${isSusp ? "border-2 border-casino-suspend-text" : "border border-border"}`}>
              <header className="mx-2 mt-2 flex h-[34px] items-center justify-center rounded-bl-[4px] rounded-br-[30px] rounded-tl-[30px] rounded-tr-[4px] border border-border bg-background px-2 shadow-[0_2px_4px_color-mix(in_oklab,var(--foreground)_16%,transparent)]">
                <h3 className={`truncate text-[0.92rem] font-extrabold uppercase ${isSusp ? "text-foreground/45" : "text-foreground"}`}>
                  {m.marketName}
                </h3>
                <span className="absolute right-5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-foreground/50 text-[0.62rem] font-bold text-foreground/60">
                  i
                </span>
              </header>
              <div className="relative grid h-[78px] grid-cols-2 items-center pt-1">
                {[a, b].map((r, index) => (
                  <div key={r ? String(r.selectionId) : index} className="min-w-0 text-center">
                    <Plate
                      runner={r}
                      label={r ? (names[String(r.selectionId)] ?? String(r.selectionId)) : index === 0 ? "PLAYER A" : "PLAYER B"}
                      locked={isSusp || !r}
                    />
                  </div>
                ))}
                {isSusp ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[1.7rem] font-bold text-casino-suspend-text">
                    SUSPENDED
                  </span>
                ) : null}
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
  const marketLocked = suspended || (runners.length > 0 && runners.every((runner) => !isOpenStatus(runner.status ?? "ONLINE")));
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
              {Math.max(100, market.min ?? 0)} - {market.max ?? 0}
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
        {marketLocked ? <SuspendVeil /> : null}
      </div>
    </div>
  );
}


/** Mini white card: rank on top, four suit glyphs below (blacks left, reds right). */
function RankSuitMini({ rank }: { rank: string }) {
  return (
    <span className="flex h-[25px] w-[18px] shrink-0 flex-col items-center justify-center rounded-[1px] border border-ex-cell-foreground bg-ex-market-surface py-px leading-none shadow-sm">
      <span className="text-[0.5rem] font-extrabold text-ex-cell-foreground">{rank}</span>
      <span className="grid grid-cols-2 gap-x-px text-[0.34rem] leading-none">
        <span className="text-card-black">♠</span>
        <span className="text-card-red">♥</span>
        <span className="text-card-black">♣</span>
        <span className="text-card-red">♦</span>
      </span>
    </span>
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
      className="mx-auto block h-[40px] w-[29px] rounded-[3px] bg-white object-contain shadow-sm sm:h-[46px] sm:w-[33px]"
    />
  );
}

/** Suit glyphs printed inside the rate plate (Lucky Color / Lucky Card Suit — original style). */
function labelSuits(label: string): string[] {
  const up = label.trim().toUpperCase();
  if (up === "RED") return ["♥", "♦"];
  if (up === "BLACK") return ["♠", "♣"];
  if (up.startsWith("HEART")) return ["♥"];
  if (up.startsWith("DIAMOND")) return ["♦"];
  if (up.startsWith("SPADE")) return ["♠"];
  if (up.startsWith("CLUB")) return ["♣"];
  return [];
}
function PlateSuits({ suits }: { suits: string[] }) {
  if (!suits.length) return null;
  return (
    <span className="pointer-events-none absolute left-[12px] top-1/2 flex -translate-y-1/2 flex-col items-center justify-center leading-none sm:left-[14px]">
      {suits.map((s) => (
        <span
          key={s}
          className="text-[0.62rem] leading-[1.05] sm:text-[0.8rem]"
          style={{ color: s === "♥" || s === "♦" ? "#E01B24" : "#111" }}
        >
          {s}
        </span>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- Lucky 7 */
/* Markup + classes map 1:1 onto the original Lucky 7 stylesheet. */
function Lucky7Board({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const [showInfo, setShowInfo] = useState(false);
  const names = market.runnersName ?? {};
  const rawRunners = market.runners ?? [];
  const name = (market.marketName ?? "").trim();
  const minBet = Math.max(100, market.min ?? 0);
  const maxBet = market.max ?? 100000;
  const tieIndex = rawRunners.findIndex((runner) =>
    /^tie$/i.test(String(names[String(runner.selectionId)] ?? runner.selectionId).trim()),
  );
  const runners = tieIndex < 0
    ? rawRunners
    : [
        ...rawRunners.slice(0, tieIndex),
        ...rawRunners.slice(tieIndex + 1),
        rawRunners[tieIndex],
      ].filter((runner): runner is NonNullable<typeof runner> => Boolean(runner));

  return (
    <section className="lucky7-market">
      <header className="lucky7-market-header">
        <strong>{name}</strong>
        <span className="lucky7-market-minmax">
          <button
            type="button"
            aria-label={`${name} minimum and maximum bet`}
            data-nobet=""
            onClick={() => setShowInfo((value) => !value)}
            className="lucky7-market-info"
          >
            i
          </button>
          {showInfo ? (
            <span className="lucky7-market-info-panel">
              Min/Max: {minBet.toLocaleString("en-US")} - {maxBet.toLocaleString("en-US")}
            </span>
          ) : null}
        </span>
      </header>
      <div className="lucky7-market-body">
        <div className="lucky7-market-row">
          {runners.map((r, index) => {
            const label = String(names[String(r.selectionId)] ?? r.selectionId).trim();
            const p = r.price?.back?.[0];
            const locked = !isOpenStatus(r.status ?? "ONLINE") || !p?.price;
            const rank = label.toUpperCase().replace(/^CARD\s+/, "").trim();
            const cardSrc = LUCKY7_CARD_IMAGES[rank];
            const suits = labelSuits(label);
            const wide = runners.length % 2 === 1 && index === runners.length - 1 && /^tie$/i.test(label);
            return (
              <div
                key={String(r.selectionId)}
                data-market-option=""
                data-bet-label={label.toUpperCase()}
                data-bet-odds={String(p?.price ?? "")}
                className={`lucky7-runner${wide ? " is-wide" : ""}`}
              >
                <span className="lucky7-runner-title">{label}</span>
                <button
                  type="button"
                  data-market-plate=""
                  data-bet-label={label.toUpperCase()}
                  data-bet-odds={String(p?.price ?? "")}
                  disabled={locked || suspended}
                  aria-disabled={locked || suspended}
                  className={`lucky7-runner-box${locked ? " is-locked" : ""}`}
                >
                  {cardSrc ? (
                    <span className="lucky7-plate-suits">
                      <img src={cardSrc} alt="" loading="lazy" className="lucky7-card-art" />
                    </span>
                  ) : suits.length ? (
                    <span className="lucky7-plate-suits">
                      {suits.map((s) => (
                        <span
                          key={s}
                          className={s === "♥" || s === "♦" ? "is-red" : undefined}
                        >
                          {s}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  <span className="lucky7-runner-values">
                    <span className="lucky7-runner-odds">{p?.price ? String(Number(p.price)) : fmtOdds(p?.price)}</span>
                    <span className="lucky7-runner-size">{p?.size == null ? "" : String(p.size)}</span>
                  </span>
                  {locked && !suspended ? <LockKeyhole className="lucky7-runner-lock" aria-hidden="true" /> : null}
                </button>
              </div>
            );
          })}
        </div>
        {suspended ? (
          <div data-suspended="" className="lucky7-suspended">SUSPENDED</div>
        ) : null}
      </div>
    </section>
  );
}


/** Reference badge mapping: tone high=blue, low=pink, tie=yellow. */
function refBadge(raw: string, game: string): { letter: string; tone: "high" | "low" | "tie" } {
  const l = raw.toUpperCase();
  if (game === "99.0030") {
    return /LOW|^L/.test(l) ? { letter: "L", tone: "low" } : /HIGH|^H/.test(l) ? { letter: "H", tone: "high" } : { letter: "T", tone: "tie" };
  }
  if (game === "99.0019") {
    return /DRAGON|^D/.test(l) ? { letter: "D", tone: "high" } : /TIGER/.test(l) || l === "T" ? { letter: "T", tone: "low" } : { letter: "T", tone: "tie" };
  }
  if (game === "99.0022") {
    const n = l.match(/\d+/)?.[0] ?? "?";
    return { letter: n, tone: ("c" + n) as "tie" };
  }
  if (game === "99.0001") {
    return /TIE|^T$/.test(l) ? { letter: "T", tone: "tie" } : /BANKER|^B$/.test(l) ? { letter: "B", tone: "low" } : { letter: "P", tone: "high" };
  }
  return /\bB\b|\(\s*B\s*\)|PLAYER B|^B$/.test(l)
    ? { letter: "B", tone: "low" }
    : /\bA\b|\(\s*A\s*\)|PLAYER A|^A$/.test(l)
      ? { letter: "A", tone: "high" }
      : { letter: l.trim()[0] || "?", tone: "tie" };
}

function Lucky7Recent({ results, game = "99.0030" }: { results: CasinoResult[]; game?: string }) {
  return (
    <section className="lucky7-results">
      <h5 className="lucky7-results-title">Recent Result</h5>
      <ul className="lucky7-results-list">
        {results.slice(0, 10).map((r, idx) => {
          const raw = (deriveWinner(r as AnyResult, true) || "-").trim();
          const b = refBadge(raw, game);
          const first = b.letter;
          const tone = b.tone;
          return (
            <li key={`${String((r as AnyResult).roundId ?? idx)}-${idx}`}>
              <button
                type="button"
                data-nobet=""
                className={`lucky7-result-chip${tone === "low" ? " is-low" : tone === "tie" ? " is-tie" : tone === "high" ? "" : ` is-${tone}`}`}
              >
                {first}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}


/** Light blue sectioned board with 2-column plates (20-20 TP, 20-20 DT) — original style. */




function DarkGridBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const [showInfo, setShowInfo] = useState(false);
  const names = market.runnersName ?? {};
  const raw = market.runners ?? [];
  // Lucky 7's "LUCKY CARD" market uses the dedicated card board: numbered
  // tiles, printed card artwork inside the blue plate, rate/max beside it.
  const isLuckyCard = /^LUCKY CARD$/i.test((market.marketName ?? "").trim());
  const isLuckyCardSuit = /^LUCKY CARD SUIT$/i.test((market.marketName ?? "").trim());
  const isLuckyCardMarket = isLuckyCard || isLuckyCardSuit;
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
      <header className="relative flex h-[24px] items-center justify-between gap-2 bg-casino-market-header px-1.5 sm:h-[28px] sm:px-2">
        <h3 className="truncate whitespace-nowrap text-[0.72rem] font-extrabold uppercase tracking-[0.02em] text-board-header-foreground sm:text-[0.85rem]">
          {market.marketName}
        </h3>
        {showInfo ? (
          <button
            type="button"
            aria-label="Hide Min/Max info"
            onClick={() => setShowInfo(false)}
            className="shrink-0 whitespace-nowrap rounded-[3px] bg-white px-1.5 py-[1px] text-[0.66rem] font-extrabold leading-tight text-[#16324F] sm:text-[0.74rem]"
          >
            Min/Max: {Math.max(100, market.min ?? 0)} - {market.max ?? 100000}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Min/Max info"
            onClick={() => setShowInfo(true)}
            className="shrink-0 text-board-header-foreground"
          >
            <Info className="h-[13px] w-[13px] sm:h-[15px] sm:w-[15px]" strokeWidth={2.4} />
          </button>
        )}
      </header>
      <div className={`relative bg-casino-market-body ${isLuckyCard ? "py-1" : isLuckyCardSuit ? "px-2 py-1" : "px-2 py-1 sm:px-3 sm:py-3"}`}>
        <div className={`grid grid-cols-2 ${isLuckyCard ? "mx-auto max-w-[332px] justify-between gap-x-[64px] gap-y-1.5 px-[34px]" : isLuckyCardSuit ? "gap-x-3 gap-y-1" : "gap-x-2 gap-y-1.5 sm:gap-x-4 sm:gap-y-3"}`}>

          {runners.map((r, i) => {
            const p = r.price?.back?.[0];
            const locked = !suspended && (!isOpenStatus(r.status ?? "ONLINE") || !p?.price);
            const last = odd && i === runners.length - 1;
            if (isLuckyCard) {
              const label = String(names[String(r.selectionId)] ?? r.selectionId).trim().toUpperCase();
              return (
                <div
                  key={String(r.selectionId)}
                  data-market-option=""
                  data-bet-label={label}
                  data-bet-odds={String(p?.price ?? "")}
                  className="w-[100px] min-w-0 [&:has([data-has-exposure='true'])]:pb-7"
                >
                  <div className="pb-[3px] text-center text-[0.66rem] font-semibold leading-none text-casino-market-text">
                    {label}
                  </div>
                  <div
                    data-market-plate=""
                    className="relative flex h-[38px] w-[100px] items-center justify-start gap-2 rounded-[5px] bg-casino-market-rate px-2.5 shadow-[0_3px_8px_color-mix(in_oklab,var(--casino-market-header)_28%,transparent)]"
                  >
                    <RankSuitMini rank={label} />
                    <div className="flex flex-col items-start justify-center leading-none text-casino-market-text">
                      <span className="text-[0.72rem] font-extrabold">
                        {fmtOdds(p?.price)}
                      </span>
                      <span className="mt-[2px] text-[0.52rem] font-medium">
                        {p?.size == null ? "" : String(Math.round(p.size))}
                      </span>
                    </div>
                    {locked ? (
                      <span className="absolute inset-0 z-10 flex items-center justify-center rounded-[7px] bg-black/35 text-sm">
                        🔒
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            }
            return (
              <div
                key={String(r.selectionId)}
                data-market-option=""
                className={`min-w-0 pb-1.5 [&:has([data-has-exposure='true'])]:pb-8 ${last ? "col-span-2 mx-auto w-[calc(50%-0.5rem)]" : ""}`}
              >
                <div className={`px-1 pb-[3px] text-center font-medium uppercase text-casino-market-text ${isLuckyCardSuit ? "text-[0.67rem] leading-none" : "text-[0.66rem] sm:text-[0.8rem] sm:font-semibold"}`}>
                  {(() => {
                    const label = String(names[String(r.selectionId)] ?? r.selectionId).trim();
                    return /CARD/i.test(market.marketName ?? "") && RANKS.includes(label.toUpperCase())
                      ? <RankCardLabel rank={label.toUpperCase()} />
                      : <span className="block truncate">{label}</span>;
                  })()}
                </div>

                <div data-market-plate="" className={`relative mx-auto flex max-w-full flex-col items-center justify-center rounded-[5px] bg-casino-market-rate text-casino-market-text shadow-[0_3px_8px_color-mix(in_oklab,var(--casino-market-header)_28%,transparent)] ${isLuckyCardSuit ? "h-[37px] w-[100px]" : "h-[40px] w-[108px] sm:h-[56px] sm:w-[150px]"}`}>
                  <PlateSuits suits={labelSuits(String(names[String(r.selectionId)] ?? ""))} />
                  {locked ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-black/35 text-sm">
                      🔒
                    </span>
                  ) : (

                    <>
                      <span className={`${isLuckyCardSuit ? "text-[0.76rem]" : "text-[0.95rem] sm:text-[1.1rem]"} font-bold leading-none`}>
                        {fmtOdds(p?.price)}
                      </span>
                      <span className={`${isLuckyCardSuit ? "text-[0.58rem]" : "text-[0.6rem] sm:text-[0.7rem]"} mt-[2px] font-normal leading-none text-casino-market-text/90`}>
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
  const marketLocked = suspended || (runners.length > 0 && runners.every((runner) => !isOpenStatus(runner.status ?? "ONLINE")));
  const cols = hasLay
    ? "grid-cols-[minmax(0,1fr)_92px_92px] sm:grid-cols-[minmax(0,1fr)_104px_104px]"
    : "grid-cols-[minmax(0,1fr)_126px] sm:grid-cols-[minmax(0,1fr)_152px]";

  const plate = (
    p: { price?: number | null; size?: number | null } | undefined,
    side: "back" | "lay",
    locked: boolean,
  ) => (
    <div
      className={`relative m-[3px] flex h-[52px] flex-col items-center justify-center rounded-[5px] sm:h-[58px] sm:rounded-[6px] ${
        side === "back" ? "bg-casino-market-rate" : "bg-ex-lay"
      }`}
    >
      <span className="text-[1.15rem] font-bold leading-none text-[#111]">
        {fmtOdds(p?.price)}
      </span>
      <span className="mt-[3px] text-[0.72rem] font-medium leading-none text-[#111]/70">
        {fmtSize(p?.size)}
      </span>
      {locked ? (
        <span
          data-suspended="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-[6px]"
          style={{ background: "rgba(255,255,255,0.55)" }}
        />
      ) : null}
    </div>
  );

  return (
    <div className="mt-0 overflow-hidden bg-casino-market-body">
      <div className={`grid min-h-[34px] ${cols} items-center bg-casino-market-header px-2.5`}>
        <span className="flex min-w-0 items-center gap-1 py-1.5">
          <span className="truncate text-[0.78rem] font-extrabold uppercase text-board-header-foreground sm:text-[0.9rem]">
            {market.marketName}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[0.56rem] font-normal text-board-header-foreground/80 sm:text-[0.68rem]">
            Min:{Math.max(100, market.min ?? 0)} Max:{market.max ?? 0}
          </span>
        </span>

        <span className="py-1.5 text-center text-[0.8rem] font-semibold text-board-header-foreground">Back</span>
        {hasLay ? (
          <span className="py-1.5 text-center text-[0.8rem] font-semibold text-board-header-foreground">Lay</span>
        ) : null}
      </div>
      <div className="relative">
        {runners.map((r) => {
          const open = !suspended && isOpenStatus(r.status ?? "ONLINE");
          return (
            <div
              key={String(r.selectionId)}
              data-runner-row=""
              className={`grid min-h-[62px] items-center border-b border-casino-market-divider ${cols} px-1.5 sm:min-h-[68px] sm:px-2.5`}
            >
              <span
                data-runner-name=""
                className="relative block truncate py-1 text-[0.82rem] font-medium uppercase text-casino-market-text sm:text-[0.95rem]"
              >
                {names[String(r.selectionId)] ?? String(r.selectionId)}
              </span>

              {plate(r.price?.back?.[0], "back", !open || !r.price?.back?.[0]?.price)}
              {hasLay ? plate(r.price?.lay?.[0], "lay", !open || !r.price?.lay?.[0]?.price) : null}
            </div>
          );
        })}
        {marketLocked ? <SuspendVeil /> : null}
      </div>

    </div>
  );
}

/** Joker Teen Patti reference board: compact white runner rows with one blue Back price. */

/** Dukex list-layout market (1 Day TP / Joker TP / 32 Cards). */
function RefListMarket({
  market,
  suspended,
  minMax = false,
  backOnly,
}: {
  market: CasinoMarket;
  suspended: boolean;
  minMax?: boolean;
  backOnly?: boolean;
}) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const hasLay = backOnly === undefined ? runners.some((r) => Boolean(r.price?.lay?.[0]?.price)) || minMax : !backOnly;
  const cols = hasLay ? "minmax(0,1fr) 78px 78px" : backOnly && !minMax ? "minmax(0,1fr) 90px" : "minmax(0,1fr) 156px";
  const locked =
    suspended || (runners.length > 0 && runners.every((r) => !isOpenStatus(r.status ?? "ONLINE")));
  return (
    <section className="reflist-market">
      <header className="reflist-header">
        <span>{market.marketName}</span>
        <span className="reflist-info">i</span>
      </header>
      <div className="reflist-body">
      {minMax ? (
        <div className="reflist-row is-head" style={{ gridTemplateColumns: cols }}>
          <div className="reflist-minmax">
            <span>Min/Max {Math.max(100, market.min ?? 0)} - {market.max ?? 500000}</span>
          </div>
          <span className="reflist-colhead">Back</span>
          <span className="reflist-colhead is-lay">Lay</span>
        </div>
      ) : null}
        {runners.map((runner) => {
          const label = names[String(runner.selectionId)] ?? String(runner.selectionId);
          const open = !locked && isOpenStatus(runner.status ?? "ONLINE");
          const cell = (side: "back" | "lay") => {
            const point = side === "back" ? runner.price?.back?.[0] : runner.price?.lay?.[0];
            return (
              <button
                type="button"
                data-market-option=""
                data-market-plate=""
                data-bet-label={label}
                data-bet-odds={point?.price ?? ""}
                disabled={!open || !point?.price}
                className={`reflist-cell${side === "lay" ? " is-lay" : ""}`}
              >
                <span className="reflist-odds">{fmtOdds(point?.price)}</span>
                <span className="reflist-size">{point?.size == null ? "" : String(Math.round(point.size))}</span>
              </button>
            );
          };
          return (
            <div key={String(runner.selectionId)} data-runner-row="" className="reflist-row" style={{ gridTemplateColumns: cols }}>
              <span data-runner-name="" className="reflist-name">{/CARD$/i.test((market.marketName ?? "").trim()) && /^(A|[2-9]|10|J|Q|K)$/i.test(String(label).trim()) && LUCKY7_CARD_IMAGES[String(label).trim().toUpperCase()] ? <img src={LUCKY7_CARD_IMAGES[String(label).trim().toUpperCase()]} alt={String(label)} className="reflist-cardimg h-[30px] w-auto" /> : /CARD COLOR$/i.test((market.marketName ?? "").trim()) && /^RED$/i.test(String(label).trim()) ? <span>RED <span className="reflist-suits text-[#d42a2a]">♥ ♦</span></span> : /CARD COLOR$/i.test((market.marketName ?? "").trim()) && /^BLACK$/i.test(String(label).trim()) ? <span>BLACK <span className="reflist-suits text-[#111]">♠ ♣</span></span> : <span>{label}</span>}</span>
              {cell("back")}
              {hasLay ? cell("lay") : null}
            </div>
          );
        })}
        {locked ? <div data-suspended="" className="reflist-suspended">SUSPENDED</div> : null}
      </div>
    </section>
  );
}

function JokerTeenPattiBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const allClosed =
    suspended ||
    (runners.length > 0 && runners.every((r) => !isOpenStatus(r.status ?? "ONLINE") || !r.price?.back?.[0]?.price));
  return (
    <div className="mt-0 overflow-hidden bg-ex-market-surface">
      <header className="flex h-[38px] items-center justify-between bg-[#2c3e50] px-3">
        <span className="text-[1rem] font-bold uppercase tracking-wide text-white">
          {market.marketName}
        </span>
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-[#2c3e50]">
          <Info className="h-[12px] w-[12px]" strokeWidth={3} />
        </span>
      </header>
      <div className={`relative ${allClosed ? "border-2 border-[#F0A9A9]" : ""}`}>
        {runners.map((runner) => {
          const back = runner.price?.back?.[0];
          const open = !suspended && isOpenStatus(runner.status ?? "ONLINE") && Boolean(back?.price);
          return (
            <div
              key={String(runner.selectionId)}
              data-runner-row=""
              className="grid h-[50px] grid-cols-[minmax(0,1fr)_112px] border-b border-casino-market-divider bg-white last:border-b-0"
            >
              <span
                data-runner-name=""
                className={`flex h-full items-center px-3 text-[1rem] font-bold uppercase leading-none ${allClosed ? "text-[#98a2ad]" : "text-[#1e3a52]"}`}
              >
                {names[String(runner.selectionId)] ?? String(runner.selectionId)}
              </span>
              <button
                type="button"
                data-market-option=""
                data-market-plate=""
                data-bet-label={String(names[String(runner.selectionId)] ?? runner.selectionId)}
                data-bet-odds={String(back?.price ?? "")}
                disabled={!open}
                className={`relative flex flex-col items-center justify-center bg-[#8FCBF0] text-[#11263a] disabled:cursor-not-allowed ${allClosed ? "opacity-70" : ""}`}
              >
                <span className="text-[1.05rem] font-bold leading-none">{fmtOdds(back?.price)}</span>
                <span className="mt-1 text-[0.78rem] font-normal leading-none">{back?.size == null ? "" : String(Math.round(back.size))}</span>
              </button>
            </div>
          );
        })}
        {allClosed ? (
          <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <span className="text-[1.6rem] font-bold uppercase tracking-wide text-[#E08585]">SUSPENDED</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}


/** 20-20 Dragon Tiger reference board: Dragon/Tiger above with Tie centred below. */
/** 20-20 Teen Patti board — dark navy header + ice-blue body with two big blue rate plates per market. */
function TP20Board({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const [showInfo, setShowInfo] = useState(false);
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  return (
    <section className="overflow-hidden">
      <header className="flex h-[32px] items-center justify-between gap-2 bg-casino-market-header px-2.5">
        {showInfo ? (
          <button
            type="button"
            aria-label="Hide Min/Max info"
            onClick={() => setShowInfo(false)}
            className="whitespace-nowrap rounded-[4px] bg-white px-2 py-[2px] text-[0.68rem] font-extrabold leading-tight text-[#16324F]"
          >
            Min/Max: {Math.max(100, market.min ?? 0)} - {market.max ?? 100000}
          </button>
        ) : (
          <h3 className="truncate text-[0.8rem] font-extrabold uppercase tracking-wide text-board-header-foreground">
            {market.marketName}
          </h3>
        )}
        <button
          type="button"
          aria-label="Min/Max info"
          onClick={() => setShowInfo((v) => !v)}
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-board-header-foreground text-casino-market-header"
        >
          <Info className="h-[11px] w-[11px]" strokeWidth={3} />
        </button>
      </header>
      <div className="relative bg-[#C7DCF0] px-2 py-2">
        <div className={`grid gap-x-2 gap-y-2 ${runners.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {runners.map((r) => {
            const label = String(names[String(r.selectionId)] ?? r.selectionId).trim().toUpperCase();
            const p = r.price?.back?.[0];
            const open = !suspended && isOpenStatus(r.status ?? "ONLINE") && Boolean(p?.price);
            return (
              <div key={String(r.selectionId)} data-market-option="" className="min-w-0">
                <div className="truncate pb-1 text-center text-[0.8rem] font-bold uppercase text-[#16324F]">
                  {label}
                </div>
                <button
                  type="button"
                  data-market-plate=""
                  data-bet-label={label}
                  data-bet-odds={String(p?.price ?? "")}
                  disabled={!open}
                  className="mx-auto flex h-[44px] w-full max-w-[150px] flex-col items-center justify-center rounded-[8px] bg-[#9CCBF2] shadow-[0_2px_4px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed"
                >
                  <span className="text-[0.95rem] font-extrabold leading-none text-[#111]">{fmtOdds(p?.price)}</span>
                  <span className="mt-0.5 text-[0.65rem] leading-none text-[#333]">
                    {p?.size == null ? "" : String(Math.round(p.size))}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        {suspended ? (
          <div
            data-suspended=""
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-[#D0021B] bg-[rgba(255,255,255,0.45)]"
          >
            <span className="text-[1.3rem] font-extrabold uppercase tracking-wide text-[#D0021B]">Suspended</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DragonTiger20Board({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const named = (label: string) => runners.find((runner) =>
    String(names[String(runner.selectionId)] ?? "").trim().toUpperCase() === label,
  );
  const ordered = [named("DRAGON"), named("TIGER"), named("TIE")];
  const plate = (runner: (typeof runners)[number] | undefined, fallback: string, last: boolean) => {
    const back = runner?.price?.back?.[0];
    const label = runner ? String(names[String(runner.selectionId)] ?? fallback) : fallback;
    const open = Boolean(runner && !suspended && isOpenStatus(runner.status ?? "ONLINE") && back?.price);
    return (
      <div key={runner ? String(runner.selectionId) : fallback} className={last ? "col-span-2 mx-auto w-1/2" : "min-w-0"}>
        <p className="pb-1 text-center text-[0.68rem] font-semibold uppercase leading-none text-casino-market-text">{label}</p>
        <button
          type="button"
          data-market-option=""
          data-market-plate=""
          data-bet-label={label}
          data-bet-odds={String(back?.price ?? "")}
          disabled={!open}
          className="relative mx-auto flex h-[37px] w-[98px] max-w-[94%] flex-col items-center justify-center rounded-[4px] bg-casino-market-rate text-ex-cell-foreground shadow-[0_2px_6px_color-mix(in_oklab,var(--casino-market-header)_24%,transparent)] disabled:cursor-not-allowed"
        >
          <span className="text-[0.82rem] font-bold leading-none">{fmtOdds(back?.price)}</span>
          <span className="mt-1 text-[0.66rem] font-normal leading-none">{back?.size == null ? "" : String(Math.round(back.size))}</span>
        </button>
      </div>
    );
  };
  return (
    <div className="mt-0 overflow-hidden border border-casino-market-divider bg-casino-market-body">
      <header className="flex h-[22px] items-center justify-between bg-casino-market-header px-1.5">
        <span className="text-[0.7rem] font-bold uppercase text-board-header-foreground">{market.marketName}</span>
        <span className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-board-header-foreground text-casino-market-header">
          <Info className="h-[10px] w-[10px]" strokeWidth={3} />
        </span>
      </header>
      <div className="relative grid grid-cols-2 gap-x-2 gap-y-3.5 px-4 pb-2 pt-1.5">
        {ordered.map((runner, index) => plate(
          runner,
          index === 0 ? "DRAGON" : index === 1 ? "TIGER" : "TIE",
          index === 2,
        ))}
        {suspended ? <SuspendVeil /> : null}
      </div>
    </div>
  );
}

/** 1 Day Teen Patti mobile board — matches the compact live-table layout. */
function OneDayTeenPattiBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];

  const priceCell = (
    runner: CasinoMarket["runners"] extends (infer R)[] | undefined ? R : never,
    side: "back" | "lay",
  ) => {
    const point = side === "back" ? runner?.price?.back?.[0] : runner?.price?.lay?.[0];
    const open = !suspended && isOpenStatus(runner?.status ?? "ONLINE") && Boolean(point?.price);
    const label = names[String(runner?.selectionId)] ?? String(runner?.selectionId ?? "");
    return (
      <button
        type="button"
        data-market-option=""
        data-market-plate=""
        data-bet-label={label}
        data-bet-odds={point?.price ?? ""}
        disabled={!open}
        className={`flex h-full min-w-0 flex-col items-center justify-center rounded-none border-l border-casino-market-divider text-foreground ${
          side === "back" ? "bg-casino-market-rate" : "bg-ex-lay"
        }`}
      >
        <span className="text-[1.05rem] font-extrabold leading-none">{fmtOdds(point?.price)}</span>
        <span className="mt-1 text-[0.75rem] font-normal leading-none">
          {point?.size == null ? "" : String(Math.round(point.size))}
        </span>
      </button>
    );
  };

  return (
    <section className="overflow-hidden border border-casino-market-divider bg-ex-market-surface">
      <header className="flex h-[32px] items-center bg-casino-market-header px-2 text-[0.95rem] font-extrabold uppercase tracking-wide text-board-header-foreground">
        {market.marketName}
      </header>
      <div className="relative">
        <div className="grid h-[40px] grid-cols-[minmax(0,1fr)_92px_92px] items-stretch border-b border-casino-market-divider">
          <div className="flex items-center justify-center px-2">
            <span className="flex h-[26px] w-full max-w-[220px] items-center justify-center rounded-[6px] bg-[#DCE7E6] text-[0.78rem] font-bold text-casino-market-text">
              Min/Max&nbsp; {Math.max(100, market.min ?? 0)} - {market.max ?? 500000}
            </span>
          </div>
          <span className="flex items-center justify-center border-l border-casino-market-divider bg-casino-market-rate text-[0.9rem] font-extrabold text-casino-market-text">
            Back
          </span>
          <span className="flex items-center justify-center border-l border-casino-market-divider bg-ex-lay text-[0.9rem] font-extrabold text-casino-market-text">
            Lay
          </span>
        </div>
        {runners.map((runner) => (
          <div
            key={String(runner.selectionId)}
            data-runner-row=""
            className="grid h-[52px] grid-cols-[minmax(0,1fr)_92px_92px] border-b border-casino-market-divider last:border-b-0"
          >
            <span data-runner-name="" className="flex h-full min-w-0 items-center bg-background px-2 text-[0.92rem] font-bold uppercase text-foreground">
              <span className="truncate">{names[String(runner.selectionId)] ?? String(runner.selectionId)}</span>
            </span>
            {priceCell(runner, "back")}
            {priceCell(runner, "lay")}
          </div>
        ))}
        {suspended ? (
          <div
            data-suspended=""
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[40px] z-20 flex items-center justify-center border-2 border-[#D0021B] bg-[rgba(255,255,255,0.5)]"
          >
            <span className="text-[1.6rem] font-extrabold uppercase tracking-wide text-[#D0021B]">Suspended</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** 32 Cards reference board: compact white rows with blue Back and pink Lay columns. */
function Cards32Panel({ markets, suspended }: { markets: CasinoMarket[]; suspended: boolean }) {
  const orderedNames = ["WINNER", "CARD COLOR", "CARD TOTAL", "LUCKY NUMBER"];
  const ordered = [...markets].sort((a, b) => {
    const ai = orderedNames.indexOf((a.marketName ?? "").trim().toUpperCase());
    const bi = orderedNames.indexOf((b.marketName ?? "").trim().toUpperCase());
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  /** Per-row suspended cover — dukex style: red border box + centered red text. */
  const RowSuspend = () => (
    <span
      data-suspended="true"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border border-[#D0021B] bg-[rgba(255,255,255,0.5)]"
    >
      <span className="text-[1.3rem] font-bold text-[#D0021B]">SUSPENDED</span>
    </span>
  );

  return (
    <div className="bg-ex-market-surface">
      {ordered.map((market) => {
        const names = market.runnersName ?? {};
        const runners = market.runners ?? [];
        const hasLay = runners.some((runner) => Boolean(runner.price?.lay?.[0]?.price));
        const cols = hasLay
          ? "grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]"
          : "grid-cols-[minmax(0,1.7fr)_minmax(0,2fr)]";
        const marketLocked =
          suspended ||
          (runners.length > 0 &&
            runners.every((runner) => !isOpenStatus(runner.status ?? "ONLINE")));

        return (
          <section
            key={String(market.marketId)}
            className="border-b border-border bg-ex-market-surface"
          >
            <header className="flex h-[32px] items-center justify-between bg-casino-market-header px-2">
              <h3 className="truncate text-[0.85rem] font-extrabold uppercase leading-none tracking-wide text-board-header-foreground">
                {market.marketName}
              </h3>
              <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-board-header-foreground text-casino-market-header">
                <Info className="h-[11px] w-[11px]" strokeWidth={3} />
              </span>
            </header>
            <div className="relative">
              {runners.map((runner) => {
                const back = runner.price?.back?.[0];
                const lay = runner.price?.lay?.[0];
                const label = names[String(runner.selectionId)] ?? String(runner.selectionId);
                const open = !suspended && isOpenStatus(runner.status ?? "ONLINE");
                const rowLocked = !marketLocked && !open;
                const cell = (point: typeof back, side: "back" | "lay") => (
                  <button
                    type="button"
                    data-market-option=""
                    data-market-plate=""
                    data-bet-label={label}
                    data-bet-odds={point?.price ?? ""}
                    disabled={!open || !point?.price}
                    className={`flex h-full min-w-0 flex-col items-center justify-center border-l border-casino-market-divider ${side === "back" ? "bg-ex-back" : "bg-ex-lay"}`}
                  >
                    <span className="text-[0.95rem] font-extrabold leading-none text-foreground">
                      {fmtOdds(point?.price)}
                    </span>
                    <span className="mt-[4px] text-[0.62rem] font-medium leading-none text-foreground/70">
                      {point?.size == null ? "" : String(Math.round(point.size))}
                    </span>
                  </button>
                );

                return (
                  <div
                    key={String(runner.selectionId)}
                    data-runner-row=""
                    className={`relative grid h-[48px] ${cols} border-b border-border last:border-b-0`}
                  >
                    <span
                      data-runner-name=""
                      className="flex min-w-0 items-center bg-ex-market-surface px-2 text-[0.8rem] font-semibold leading-tight text-ex-cell-foreground"
                    >
                      <span className="truncate">{label}</span>
                    </span>
                    {cell(back, "back")}
                    {hasLay ? cell(lay, "lay") : null}
                    {rowLocked ? <RowSuspend /> : null}
                  </div>
                );
              })}
              {marketLocked ? (
                <span
                  data-suspended="true"
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border border-[#D0021B] bg-[rgba(255,255,255,0.5)]"
                >
                  <span className="text-[1.5rem] font-bold text-[#D0021B]">SUSPENDED</span>
                </span>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type ABRunner = {
  id: string;
  label: string;
  price?: number | null | undefined;
  size?: number | null | undefined;
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

  const DtlLock = () => (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden="true">
        <path d="M12 2a5 5 0 0 0-5 5v3H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
      </svg>
    </span>
  );

  const PriceBox = ({ r }: { r?: Row | undefined }) => {
    const bettable = Boolean(r?.open && r?.price);
    return (
      <div
        {...(bettable
          ? {
              "data-market-plate": "",
              "data-market-option": "",
              "data-bet-label": r?.label ?? "",
              "data-bet-odds": String(r?.price ?? ""),
            }
          : {})}
        className={`relative flex h-[58px] w-[150px] items-center justify-center rounded-[2px] border border-[#5b9bd5] bg-[#333b43] ${
          bettable ? "cursor-pointer" : ""
        }`}
      >
        <span
          className={`text-[1.15rem] font-bold text-white ${r?.open ? "" : "opacity-40"}`}
        >
          {fmtOdds(r?.price)}
        </span>
        {r?.open ? null : <DtlLock />}
      </div>
    );
  };

  const RowLine = ({ label, r }: { label: ReactNode; r?: Row | undefined }) => (
    <div className="flex min-h-[68px] items-center justify-between border-b border-[#1b2126] bg-[#333b43] px-3">
      <span className="text-[1rem] font-bold text-white">{label}</span>
      <PriceBox r={r} />
    </div>
  );

  return (
    <div className="bg-[#2b3238] font-[Tahoma,Helvetica,sans-serif]">
      <div className="grid grid-cols-3 bg-[#39424a]">
        {(["DRAGON", "TIGER", "LION"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-[14px] text-[1.05rem] capitalize ${
              tab === t
                ? "border-b-[4px] border-[#f2c319] font-semibold text-white"
                : "border-b-[4px] border-transparent text-white/60"
            }`}
          >
            {t.toLowerCase()}
          </button>
        ))}
      </div>

      {resultDeclared ? (
        <div className="bg-casino-market-header px-3 py-1 text-[0.72rem] font-extrabold uppercase text-board-header-foreground">
          Result Declared
        </div>
      ) : null}

      <div className="relative">
        <RowLine label="Winner" r={winner} />
        <RowLine
          label={
            <span className="flex gap-3 text-[1.35rem] leading-none text-[#e0201c]">
              <span>♥</span>
              <span>♦</span>
            </span>
          }
          r={red}
        />
        <RowLine
          label={
            <span className="flex gap-3 text-[1.35rem] leading-none text-black">
              <span>♣</span>
              <span>♠</span>
            </span>
          }
          r={black}
        />
        <RowLine label="Odd" r={odd} />
        <RowLine label="Even" r={even} />
      </div>

      {cards.length ? (
        <div className="bg-[#2b3238] px-2 pb-4 pt-3">
          <p className="pb-3 text-center text-[1.15rem] font-bold text-white">
            {fmtOdds(cards[0]?.price)}
          </p>
          <div className="flex flex-wrap justify-center gap-[6px]">
            {cards.map((r) => {
              const rank = r.label.replace(`${tab} `, "").trim();
              const bettable = r.open && Boolean(r.price);
              return (
                <div
                  key={r.id}
                  {...(bettable
                    ? {
                        "data-market-plate": "",
                        "data-market-option": "",
                        "data-bet-label": r.label,
                        "data-bet-odds": String(r.price),
                      }
                    : {})}
                  className={bettable ? "cursor-pointer" : ""}
                >
                  <div
                    className={`relative flex h-[68px] w-[46px] items-center justify-center rounded-[3px] border-2 border-[#f2c319] ${
                      bettable ? "bg-[#f2f2f2]" : "bg-[#9a9a9a]"
                    }`}
                  >
                    <span className="text-[1.35rem] font-bold leading-none text-black">{rank}</span>
                    <span className="absolute left-[3px] top-[3px] text-[0.55rem] leading-[0.62rem] text-black">♠</span>
                    <span className="absolute right-[3px] top-[3px] text-[0.55rem] leading-[0.62rem] text-[#e0201c]">♦</span>
                    <span className="absolute bottom-[3px] left-[3px] text-[0.55rem] leading-[0.62rem] text-black">♣</span>
                    <span className="absolute bottom-[3px] right-[3px] text-[0.55rem] leading-[0.62rem] text-[#e0201c]">♥</span>
                    {bettable ? null : <DtlLock />}
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
      size: r.price?.back?.[0]?.size,
      open: !suspended && isOpenStatus(r.status),
    }));

  const winner = list(byName("WINNER"));
  const side = list(byName("SIDE BET"));
  const oddEven = list(byName("ODD/EVEN"));
  const suits = list(byName("CARD SUIT"));
  const cards = list(byName("LUCKY CARD"));
  const minmax = byName("WINNER");

  const Lock = ({ size = 22 }: { size?: number }) => (
    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-white">
      <svg viewBox="0 0 24 24" style={{ width: size, height: size }} fill="currentColor" aria-hidden="true">
        <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
      </svg>
    </span>
  );
  const PL = () => <div className="flex h-[17px] items-center justify-center text-[11px] font-semibold text-[#243a48]">0</div>;
  const plate = (r: ABRunner) => ({
    type: "button" as const,
    "data-market-option": "",
    "data-market-plate": "",
    "data-bet-label": r.label,
    "data-bet-odds": String(r.price ?? ""),
    disabled: !r.open,
  });

  const Chip = ({ r, kind }: { r: ABRunner; kind: "side" | "bet1" | "bet2" }) => (
    <div className="min-w-0">
      <button
        {...plate(r)}
        className={`relative flex h-[52px] w-full flex-col items-center justify-center overflow-hidden rounded-[6px] border-[4px] border-[#fff153] font-bold leading-none ${
          r.open
            ? kind === "side"
              ? "bg-[#ececec] text-[#243a48]"
              : kind === "bet1"
                ? "bg-[#2d6fa8] text-white"
                : "bg-[#243240] text-white"
            : "bg-[#243240] text-white"
        }`}
      >
        <span className={`whitespace-nowrap text-[9px] font-bold uppercase ${r.open ? "" : "opacity-30"}`}>{r.label}</span>
        <span className={`mt-[3px] text-[16px] font-bold ${r.open ? "" : "opacity-0"}`}>{fmtOdds(r.price)}</span>
        {!r.open ? <Lock /> : null}
      </button>
      <PL />
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
      <div className="grid h-[72px] grid-cols-[18px_repeat(3,minmax(0,1fr))_18px] gap-x-[3px]">
        <span className="flex h-[52px] items-center justify-center text-[13px] font-bold text-[#243a48]">{letter}</span>
        {s ? <Chip r={s} kind="side" /> : <div />}
        {b1 ? <Chip r={b1} kind="bet1" /> : <div />}
        {b2 ? <Chip r={b2} kind="bet2" /> : <div />}
        <span className="flex h-[52px] items-center justify-center text-[13px] font-bold text-[#243a48]">{letter}</span>
      </div>
    );
  };

  return (
    <div className="relative mt-0 bg-[#e0e0e0] p-[2px] pt-[4px] font-[Tahoma,Helvetica,Arial,sans-serif] text-[12px] text-[#243a48]">
      <span className="sr-only">Min/Max: {Math.max(100, minmax?.min ?? 0)} - {minmax?.max ?? 0}</span>
      <div className="space-y-[2px]">
        {group("A")}
        {group("B")}
      </div>

      <div className="mt-[8px] grid grid-cols-2 gap-x-[4px]">
        {["ODD", "EVEN"].map((n) => {
          const r = oddEven.find((x) => x.label.toUpperCase() === n);
          if (!r) return <div key={n} />;
          return (
            <div key={n}>
              <p className="flex h-[18px] items-center justify-center text-[12px] font-bold text-[#111]">{n}</p>
              <button
                {...plate(r)}
                className={`relative mt-[4px] flex h-[48px] w-full items-center justify-center overflow-hidden rounded-[6px] border border-[#5a9fd4] text-[16px] font-bold ${
                  r.open ? "bg-[#72bbef] text-[#111]" : "bg-[#243240] text-white"
                }`}
              >
                <span className={r.open ? "" : "opacity-0"}>{fmtOdds(r.price)}</span>
                {!r.open ? <Lock /> : null}
              </button>
              <PL />
            </div>
          );
        })}
      </div>

      <div className="mt-[4px] grid grid-cols-4 gap-x-[4px]">
        {suits.map((r) => {
          const g = suitGlyph[r.label.toUpperCase()] ?? { s: "?", red: false };
          return (
            <div key={r.id}>
              <p className={`flex h-[22px] items-center justify-center text-[22px] leading-none ${g.red ? "text-[#e11d2e]" : "text-[#111]"}`}>
                {g.s}
              </p>
              <button
                {...plate(r)}
                className={`relative mt-[2px] flex h-[48px] w-full items-center justify-center overflow-hidden rounded-[6px] border-[4px] border-[#fff153] text-[16px] font-bold ${
                  r.open ? "bg-[#ececec] text-[#243a48]" : "bg-[#243240] text-white"
                }`}
              >
                <span className={r.open ? "" : "opacity-0"}>{fmtOdds(r.price)}</span>
                {!r.open ? <Lock /> : null}
              </button>
              <PL />
            </div>
          );
        })}
      </div>

      <div className="mt-[7px] pb-[8px]">
        <p className="flex h-[21px] items-center justify-center text-[14px] font-bold text-[#111]">{fmtOdds(cards[0]?.price)}</p>
        <div className="mx-auto mt-[6px] flex max-w-[330px] flex-wrap justify-center gap-x-[3px] gap-y-[4px]">
          {cards.map((r) => {
            const img = LUCKY7_CARD_IMAGES[r.label.trim().toUpperCase()];
            return (
              <div key={r.id} className="flex w-[38px] flex-col items-center">
                <button
                  {...plate(r)}
                  className="relative block h-[48px] w-[34px] overflow-hidden rounded-[2px] border border-[#d4af37] bg-white p-0"
                >
                  {img ? (
                    <img src={img} alt={r.label} className={`block h-[46px] w-[32px] object-cover ${r.open ? "" : "opacity-40"}`} />
                  ) : (
                    <span className="text-[16px] font-bold text-[#111]">{r.label}</span>
                  )}
                  {!r.open ? (
                    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[#9aa3ab]">
                      <LockKeyhole className="h-[14px] w-[14px]" strokeWidth={2.6} />
                    </span>
                  ) : null}
                </button>
                <PL />
              </div>
            );
          })}
        </div>
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
      <span className="inline-flex items-center gap-[3px] text-[0.85rem] font-bold uppercase text-[#1b2c3d]">
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
        const isWinner = (m.marketName ?? "").trim().toUpperCase() === "WINNER";

        // dukex 20-20 Dragon Tiger WINNER layout: ice-blue board, big rounded
        // rate boxes under DRAGON / TIGER labels, TIE centered below.
        if (isWinner) {
          const byName = (key: string) =>
            runners.find(
              (r) =>
                (names[String(r.selectionId)] ?? "").toUpperCase().includes(key),
            );
          const dragon = byName("DRAGON");
          const tiger = byName("TIGER");
          const tie = byName("TIE");

          const BigBox = ({ r, side }: { r: (typeof runners)[number] | undefined; side: string }) => {
            const price = r?.price?.back?.[0]?.price;
            const size = r?.price?.back?.[0]?.size;
            const open = !suspended && isOpenStatus(r?.status) && Boolean(price);
            return (
              <div
                {...(open
                  ? {
                      "data-market-plate": "",
                      "data-market-option": "",
                      "data-bet-label": side,
                      "data-bet-odds": String(price),
                    }
                  : {})}
                className={`flex h-[80px] w-[45%] max-w-[190px] flex-col items-center justify-center rounded-[14px] shadow-[0_2px_6px_rgba(0,0,0,0.18)] ${
                  open ? "cursor-pointer bg-[#9CCBF2]" : "bg-[#9CCBF2]/80"
                }`}
              >
                <span className="text-[1.3rem] font-extrabold leading-tight text-[#111]">
                  {fmtOdds(price)}
                </span>
                <span className="mt-[2px] text-[0.8rem] text-[#111]">
                  {size == null ? "" : fmtInt(size)}
                </span>
              </div>
            );
          };

          return (
            <div key={`${m.marketId}-${mi}`} className="border-b border-casino-market-divider">
              <div className="flex h-[34px] items-center justify-between gap-2 bg-casino-market-header px-2">
                <span className="truncate text-[0.8rem] font-extrabold uppercase tracking-wide text-board-header-foreground">
                  {m.marketName}
                </span>
                <MarketInfo min={Math.max(100, m.min ?? 0)} max={m.max ?? 100000} />
              </div>
              <div className="relative bg-[#C7DCF0] px-3 pb-6 pt-2">
                <div className="flex items-start justify-between">
                  <div className="flex w-1/2 flex-col items-center gap-2">
                    <span className="text-[1.05rem] font-extrabold uppercase text-[#3a4a5a]">DRAGON</span>
                    <BigBox r={dragon} side="DRAGON" />
                  </div>
                  <div className="flex w-1/2 flex-col items-center gap-2">
                    <span className="text-[1.05rem] font-extrabold uppercase text-[#3a4a5a]">TIGER</span>
                    <BigBox r={tiger} side="TIGER" />
                  </div>
                </div>
                {tie ? (
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <span className="text-[1.05rem] font-extrabold uppercase text-[#3a4a5a]">TIE</span>
                    <BigBox r={tie} side="TIE" />
                  </div>
                ) : null}
                {allClosed ? (
                  <span
                    data-suspended="true"
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border border-[#D0021B] bg-[rgba(255,255,255,0.5)]"
                  >
                    <span className="text-[2rem] font-bold text-[#D0021B]">SUSPENDED</span>
                  </span>
                ) : null}
              </div>
            </div>
          );
        }

        return (
          <div key={`${m.marketId}-${mi}`} className="border-b border-casino-market-divider">
            <div className="flex h-[34px] items-center justify-between gap-2 bg-casino-market-header px-2">
              <span className="truncate text-[0.8rem] font-extrabold uppercase tracking-wide text-board-header-foreground">
                {m.marketName}
              </span>
              <MarketInfo min={Math.max(100, m.min ?? 0)} max={m.max ?? 100000} />
            </div>
            <div className="relative">
              {runners.map((r, i) => {
                const label = names[String(r.selectionId)] ?? String(r.selectionId);
                const price = r.price?.back?.[0]?.price;
                const open = !suspended && isOpenStatus(r.status) && Boolean(price);
                return (
                <div
                  key={`${r.selectionId}-${i}`}
                  className={`flex items-stretch ${i ? "border-t border-casino-market-divider" : ""}`}
                >
                  <div className="flex min-h-[44px] flex-1 items-center px-2 py-1">
                    <Label text={label} />
                  </div>
                  <div
                    {...(open
                      ? {
                          "data-market-plate": "",
                          "data-market-option": "",
                          "data-bet-label": String(label).toUpperCase(),
                          "data-bet-odds": String(price),
                        }
                      : {})}
                    className={`my-[3px] mr-[3px] flex w-[92px] shrink-0 flex-col items-center justify-center rounded-[5px] bg-casino-market-rate leading-tight ${
                      open ? "cursor-pointer" : ""
                    }`}
                  >
                    <span className="text-[0.9rem] font-bold text-[#111]">{fmtOdds(price)}</span>
                    <span className="text-[0.72rem] text-[#111]">
                      {fmtInt(r.price?.back?.[0]?.size)}
                    </span>
                  </div>
                </div>
                );
              })}
              {allClosed ? <SuspendVeil size="sm" /> : null}

            </div>
          </div>
        );
      })}
    </div>
  );
}


const CARD_RACE_K: Record<string, string> = { "♥": hkCard.url, "♠": skCard.url, "♦": dkCard.url, "♣": ckCard.url };

// Card Race — measured against Dukex at 393px (Tahoma 12px, 22px headers, 92px back column).
function CardRacePanel({
  markets,
  suspended,
}: {
  markets: CasinoMarket[];
  suspended: boolean;
}) {
  const suitColor = (s: string) => (s === "♥" || s === "♦" ? "#e0283e" : "#243a48");
  const kingOf = (up: string) =>
    up.startsWith("HEART") ? "♥" : up.startsWith("DIAMOND") ? "♦" : up.startsWith("SPADE") ? "♠" : up.startsWith("CLUB") ? "♣" : null;

  const Label = ({ text }: { text: string }) => {
    const up = text.toUpperCase();
    const k = kingOf(up);
    if (k) return <img src={CARD_RACE_K[k]} alt={`K ${k}`} className="h-[40px] w-[30px] border-2 border-[#e6c200]" />;
    const suffix = up === "RED" ? ["♥", "♦"] : up === "BLACK" ? ["♠", "♣"] : [];
    return (
      <span className="inline-flex items-center text-[12px] font-bold leading-[18px] text-[#243a48]">
        {up.replace(/♥|♦|♠|♣/g, "").trim()}
        {suffix.length ? (
          <span className="ml-[8px] inline-flex gap-[5px] text-[11px]">
            {suffix.map((s) => <span key={s} style={{ color: suitColor(s) }}>{s}</span>)}
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <div className="bg-[#ededed] font-['Tahoma',Helvetica,sans-serif]">
      {markets.map((m, mi) => {
        const names = m.runnersName ?? {};
        const runners = m.runners ?? [];
        return (
          <section key={`${m.marketId}-${mi}`} className="mb-[3px]">
            <header className="flex h-[22px] items-center justify-between rounded-t-[5px] px-[5px] py-[2px] text-[12px] font-bold text-white" style={{ background: "linear-gradient(180deg,#2e4b5e,#243a48)" }}>
              <span>{m.marketName}</span>
              <span className="flex h-[13px] w-[13px] items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-[#243a48]">i</span>
            </header>
            <div className="relative bg-white">
              {runners.map((r, i) => {
                const open = !suspended && isOpenStatus(r.status);
                const label = names[String(r.selectionId)] ?? String(r.selectionId);
                const isK = !!kingOf(String(label).toUpperCase());
                return (
                  <div key={`${r.selectionId}-${i}`} className={`flex items-stretch border-t border-[#dee2e6] ${isK ? "h-[57px]" : "h-[48px]"}`}>
                    <div className="flex flex-1 items-center bg-white px-[12px] py-[8px]">
                      <Label text={String(label)} />
                    </div>
                    <div
                      {...(open && r.price?.back?.[0]?.price
                        ? {
                            "data-market-plate": "",
                            "data-market-option": "",
                            "data-bet-label": String(label).toUpperCase(),
                            "data-bet-odds": String(r.price.back[0]!.price),
                          }
                        : {})}
                      className={`flex w-[92px] shrink-0 flex-col items-center justify-center bg-[#72bbef] px-[6px] py-[8px] leading-none ${open ? "cursor-pointer" : ""}`}
                    >
                      <span className="text-[14px] font-bold text-[#333]">{fmtOdds(r.price?.back?.[0]?.price)}</span>
                      <span className="mt-[2px] text-[10px] text-[#555]">{r.price?.back?.[0]?.size ?? ""}</span>
                    </div>
                  </div>
                );
              })}
              {runners.length > 0 && runners.every((r) => suspended || !isOpenStatus(r.status)) ? (
                <div data-suspended="true" className="reflist-suspended" style={{ inset: 0 }}>SUSPENDED</div>
              ) : null}
            </div>
          </section>
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
    <div className="aaa-minmax">
      Min/Max: {Math.max(100, m.min ?? 0)} - {m.max ?? 100000}
    </div>
  );

  const Suspend = ({ large = false }: { large?: boolean }) => (
    <div data-suspended="true" className={`aaa-suspend${large ? " is-large" : ""}`}>SUSPEND</div>
  );

  const Header = ({ name }: { name: string }) => (
    <div className="aaa-header">{name}</div>
  );

  const PriceCell = ({
    label,
    price,
    size,
    tone,
    locked,
  }: {
    label: string;
    price?: number | null | undefined;
    size?: number | null | undefined;
    tone: "back" | "lay";
    locked?: boolean;
  }) => (
    <button
      type="button"
      disabled={locked || !price}
      data-market-option=""
      data-market-plate=""
      data-bet-label={label}
      data-bet-odds={price ?? ""}
      className={`aaa-price is-${tone}`}
    >
      <span className="aaa-odds">{fmtOdds(price)}</span>
      <span className="aaa-size">{size ?? ""}</span>
    </button>
  );

  return (
    <div className="aaa-board">
      {winner ? (
        <section className="aaa-market">
          <Header name="WINNER" />
          <div className="aaa-winner-head">
            <div className="aaa-minmax-wrap">
              <div className="aaa-minmax">
                Min/Max: {Math.max(100, winner.min ?? 0)} - {winner.max ?? 100000}
              </div>
            </div>
            <div className="aaa-column is-back">Back</div>
            <div className="aaa-column is-lay">Lay</div>
          </div>
          <div className="aaa-market-body">
            {(winner.runners ?? []).map((r, i) => {
              const open = !suspended && isOpenStatus(r.status);
              const label = (winner.runnersName ?? {})[String(r.selectionId)] ?? "";
              return (
                <div key={`${r.selectionId}-${i}`} className="aaa-winner-row">
                  <div className="aaa-runner">{label}</div>
                  <div className="aaa-winner-price">
                    <PriceCell
                      label={label}
                      price={r.price?.back?.[0]?.price}
                      size={r.price?.back?.[0]?.size}
                      tone="back"
                      locked={!open}
                    />
                  </div>
                  <div className="aaa-winner-price">
                    <PriceCell
                      label={label}
                      price={r.price?.lay?.[0]?.price}
                      size={r.price?.lay?.[0]?.size}
                      tone="lay"
                      locked={!open}
                    />
                  </div>
                </div>
              );
            })}
            {(winner.runners ?? []).every((r) => suspended || !isOpenStatus(r.status)) ? (
              <Suspend />
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="aaa-side-grid">
        {sides.map((m, mi) => {
          const runners = m.runners ?? [];
          const closed = runners.every((r) => suspended || !isOpenStatus(r.status));
          return (
            <section key={`${m.marketId}-${mi}`} className="aaa-market aaa-side-market">
              <Header name={m.marketName ?? ""} />
              <div className="aaa-side-minmax">
                <MinMax m={m} />
              </div>
              <div className="aaa-market-body">
                {runners.map((r, i) => {
                  const label = ((m.runnersName ?? {})[String(r.selectionId)] ?? "").toUpperCase();
                  const isRed = label === "RED";
                  const isBlack = label === "BLACK";
                  const open = !suspended && isOpenStatus(r.status);
                  return (
                    <button
                      type="button"
                      key={`${r.selectionId}-${i}`}
                      disabled={!open || !r.price?.back?.[0]?.price}
                      data-market-option=""
                      data-market-plate=""
                      data-bet-label={label}
                      data-bet-odds={r.price?.back?.[0]?.price ?? ""}
                      className={`aaa-side-price is-${i === 0 ? "lay" : "back"}`}
                    >
                      <span className="aaa-side-label">
                        {isRed ? (
                          <span className="aaa-red-suits">♥ ♦</span>
                        ) : isBlack ? (
                          <span className="aaa-black-suits">♠ ♣</span>
                        ) : (
                          label
                        )}
                      </span>
                      <span className="aaa-side-odds">{fmtOdds(r.price?.back?.[0]?.price)}</span>
                      <span className="aaa-side-size">{r.price?.back?.[0]?.size ?? ""}</span>
                    </button>
                  );
                })}
                {closed ? <Suspend /> : null}
              </div>
            </section>
          );
        })}
      </div>

      {card ? (
        <section className="aaa-market">
          <Header name="CARD" />
          <div className="aaa-card-head">
            <div className="aaa-minmax-wrap">
              <MinMax m={card} />
            </div>
            <div className="aaa-column is-back">Back</div>
          </div>
          <div className="aaa-market-body">
            {(card.runners ?? []).map((r, i) => {
              const open = !suspended && isOpenStatus(r.status);
              const rank = ((card.runnersName ?? {})[String(r.selectionId)] ?? "").toUpperCase();
              return (
                <div key={`${r.selectionId}-${i}`} className="aaa-card-row">
                  <div className="aaa-card-rank">
                    {LUCKY7_CARD_IMAGES[rank] ? <img src={LUCKY7_CARD_IMAGES[rank]} alt={rank} /> : rank}
                  </div>
                  <div className="aaa-card-price">
                    <PriceCell
                      label={rank}
                      price={r.price?.back?.[0]?.price}
                      size={r.price?.back?.[0]?.size}
                      tone="back"
                      locked={!open}
                    />
                  </div>
                </div>
              );
            })}
            {(card.runners ?? []).every((r) => suspended || !isOpenStatus(r.status)) ? (
              <Suspend large />
            ) : null}
          </div>
        </section>
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
    { v: "1k", src: chip1k.url },
    { v: "5k", src: chip5.url },
    { v: "10k", src: chip10.url },
    { v: "25k", src: chip20.url },
    { v: "50k", src: chip1k.url },
    { v: "100k", src: chip10.url },
    { v: "200k", src: chip1k.url },
  ];

  const Hand = () => (
    <div className="flex items-end justify-center gap-[4px]">
      {[0, 1, 2].map((i) => (
        <img
          key={i}
          src={CARD_BACK}
          alt=""
          className="h-[46px] w-[34px] rounded-[1px] border border-[#111] bg-white object-cover"
          draggable={false}
        />
      ))}
    </div>
  );

  const chipBet = useChipBet();

  const Side = ({ letter }: { letter: "A" | "B" }) => {
    const r = pick(letter);
    const point = r?.price?.back?.[0];
    const open = !suspended && isOpenStatus(r?.status) && !!point?.price;
    const label = `PLAYER ${letter}`;
    const openProps = chipBet
      ? {
          "data-market-option": "",
          "data-nobet": "",
          onClick: () => chipBet.bet(label, point!.price!),
        }
      : {
          "data-market-plate": "",
          "data-market-option": "",
          "data-bet-label": label,
          "data-bet-odds": String(point!.price),
        };
    return (
      <button
        type="button"
        {...(open ? openProps : {})}
        disabled={!open}
        className={`relative flex h-[88px] w-full flex-col items-center justify-center gap-[5px] rounded-[16px] shadow-[0_2px_3px_rgba(0,0,0,0.35)] ${
          open ? "bg-[#060606]" : "bg-[#2b2b2b]"
        }`}
      >
        <span
          className={`text-[18px] font-bold uppercase leading-none ${
            open ? "text-white" : "text-[#8a8a8a]"
          }`}
        >
          {label}
        </span>
        <span className={`text-[13px] font-bold leading-none ${open ? "text-white" : "text-[#8a8a8a]"}`}>
          {fmtOdds(point?.price)}
        </span>
        {open ? null : (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" strokeWidth="2.6" />
              <rect x="4.5" y="10" width="15" height="12" rx="1.5" fill="#fff" />
            </svg>
          </span>
        )}
      </button>
    );
  };

  const selChip = chipBet?.chip ?? "1k";

  return (
    <div className="bg-[#ededed] px-2 pb-[34px] pt-2">
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Hand />
        <Hand />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Side letter="A" />
        <Side letter="B" />
      </div>
      <div className="mt-[30px] flex items-center justify-between gap-[3px] px-[6px]">
        {chips.map((c) => (
          <button
            key={c.v}
            type="button"
            data-nobet=""
            aria-label={`${c.v} chip`}
            onClick={() => chipBet?.select(c.v)}
            className={`relative inline-flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full shadow-[0_0_7px_2px_rgba(255,150,40,0.55)] transition-transform ${
              selChip === c.v ? "scale-110 ring-2 ring-[#D4AF1F]" : ""
            }`}
          >
            <img
              src={c.src}
              alt={`${c.v} chip`}
              className="absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
            />
            <span className="relative z-10 text-[11px] font-bold text-[#111]">{c.v}</span>
          </button>
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

/** "1k" → 1000, "500k" → 500000, "100" → 100. */
function chipAmount(v: string): number {
  const t = v.trim().toLowerCase();
  if (t.endsWith("k")) return Math.round(parseFloat(t) * 1000);
  return Math.round(Number(t) || 0);
}

/** Chip games: pick a chip, tap a plate → bet placed directly (no slip). */
const ChipBetContext = createContext<{
  chip: string;
  select: (v: string) => void;
  bet: (label: string, odds: number) => void;
} | null>(null);

function ChipBetProvider({
  gameId,
  gameName,
  round,
  disabled,
  children,
}: {
  gameId: string;
  gameName: string;
  round: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [chip, setChip] = useState("100");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const busy = useRef(false);
  const roundRef = useRef(round);
  roundRef.current = round;

  const bet = useCallback(
    (label: string, odds: number) => {
      if (disabled) return;
      if (busy.current) {
        setErr("Do Not Place Bet At The Same Time.");
        return;
      }
      const stake = chipAmount(chip);
      if (stake < 100) {
        setErr("Minimum bet is 100.");
        return;
      }
      if (!playerSession() && stake > readWallet().balance) {
        setErr("You have Insufficient Balance.");
        return;
      }
      busy.current = true;
      const placed = placeBet({
        gameId,
        gameName,
        round: roundRef.current,
        label,
        odds,
        stake,
      });
      window.setTimeout(() => {
        busy.current = false;
      }, 600);
      if (!placed) {
        setErr("You have Insufficient Balance.");
        return;
      }
      setOk(`Bet Placed · ${label} @ ${odds} · ${stake}`);
    },
    [chip, disabled, gameId, gameName],
  );

  return (
    <ChipBetContext.Provider value={{ chip, select: setChip, bet }}>
      {children}
      {err ? <ErrorToast message={err} onDone={() => setErr(null)} /> : null}
      {ok ? <SuccessToast message={ok} onDone={() => setOk(null)} /> : null}
    </ChipBetContext.Provider>
  );
}

const useChipBet = () => useContext(ChipBetContext);

const BACCARAT_CHIPS: { v: string; src: string }[] = [
  { v: "1k", src: chip1k.url },
  { v: "5k", src: chip5.url },
  { v: "10k", src: chip10.url },
  { v: "25k", src: chip20.url },
  { v: "50k", src: chip50.url },
  { v: "100k", src: chip100.url },
  { v: "200k", src: chip200.url },
  { v: "500k", src: chip500.url },
];

function BaccaratChipRow() {
  const cb = useChipBet();
  const sel = cb?.chip ?? "1k";
  return (
    <div className="mx-2 mt-2.5 flex h-[94px] flex-nowrap items-center gap-[9px] overflow-x-auto bg-background/70 px-1">
      {BACCARAT_CHIPS.map((chip) => (
        <button
          key={chip.v}
          type="button"
          aria-label={`${chip.v} chip`}
          data-nobet=""
          onClick={() => cb?.select(chip.v)}
          className={`relative flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full shadow-[0_0_10px_rgba(255,150,40,0.55)] transition-transform ${sel === chip.v ? "scale-110 ring-2 ring-[#FFD24A]" : ""}`}
        >
          <img src={chip.src} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          <span className="relative z-10 text-[0.68rem] font-medium text-casino-market-text">{chip.v}</span>
        </button>
      ))}
    </div>
  );
}

function ChipRow() {
  const cb = useChipBet();
  const sel = cb?.chip ?? "100";
  return (
    <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-b-[6px] bg-[#1F1F1F] px-2 py-2 sm:gap-3 sm:px-3">
      {PANEL_CHIPS.map((c) => {
        const active = sel === c.v;
        return (
          <button
            key={c.v}
            type="button"
            data-nobet=""
            onClick={() => cb?.select(c.v)}
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
  if (l === "0" || l === "GREEN") return "bg-[#0E8A3C] text-white";
  if (l === "HEADS") return "bg-[#0E8A3C] text-white";
  if (l === "RED" || l === "TAILS" || l === "ODD") return "bg-[#D9392F] text-white";
  if (/^\d+$/.test(l)) {
    return Number(l) % 2 === 1
      ? "bg-[#D9392F] text-white"
      : "bg-[#1C1C1C] text-white";
  }
  return "bg-[#1C1C1C] text-white";
}

export const DREAM_NOTE: Record<string, string> = {
  "1": dream1x.url,
  "2": dream2x.url,
  "5": dream5x.url,
  "10": dream10x.url,
  "20": dream20x.url,
  "40": dream40x.url,
};

export const DREAM_PLATE: Record<string, { bg: string; bg2: string; oval: string; text: string }> = {
  "1": { bg: "#E7B948", bg2: "#C9962C", oval: "#6B4E12", text: "#F3D083" },
  "2": { bg: "#78ACDF", bg2: "#5590C8", oval: "#183C66", text: "#A9CDEE" },
  "5": { bg: "#C58FE3", bg2: "#A96FCB", oval: "#4A2162", text: "#DDB3F2" },
  "10": { bg: "#5CC677", bg2: "#3EA95B", oval: "#154F2B", text: "#9DE9AF" },
  "20": { bg: "#E9854D", bg2: "#CD6730", oval: "#6B2C10", text: "#F6B78C" },
  "40": { bg: "#EA6A70", bg2: "#CF4A51", oval: "#6B161B", text: "#F5A5A9" },
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

  const chipBet = useChipBet();

  const Tile = ({ t }: { t: Tile }) => {
    const key = t.label.trim();
    const note = dream ? DREAM_NOTE[key] : undefined;
    const directBet =
      chipBet && t.open && t.price
        ? {
            role: "button" as const,
            tabIndex: 0,
            "data-nobet": "",
            onClick: () => chipBet.bet(t.label, t.price!),
            className: "cursor-pointer",
          }
        : {};
    const plate = dream ? DREAM_PLATE[key] : undefined;
    if (plate) {
      return (
        <div
          {...directBet}
          className={`relative flex items-center justify-center overflow-hidden rounded-[4px] ${directBet.className ?? ""}`}
          style={{
            aspectRatio: "16 / 10",
            background: `linear-gradient(180deg, ${plate.bg} 0%, ${plate.bg2} 100%)`,
            boxShadow: `inset 0 0 0 2px ${plate.bg2}`,
          }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-[5px]">
            <span
              className="flex h-[54%] w-[74%] items-center justify-center rounded-[50%]"
              style={{ background: plate.oval }}
            >
              <span
                className="font-serif text-[1.9rem] font-black leading-none"
                style={{ color: plate.text }}
              >
                {key}
              </span>
            </span>
            <span
              className="rounded-[2px] px-[7px] py-[2px] text-[0.62rem] font-extrabold uppercase leading-none"
              style={{ background: plate.oval, color: plate.text }}
            >
              Pays {key}x
            </span>
          </div>
          {!t.open ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <LockKeyhole className="h-5 w-5 text-white/80" strokeWidth={3} />
            </div>
          ) : null}
        </div>
      );
    }
    void note;
    void DREAM_BORDER;


    return (
      <div
        {...directBet}
        className={`relative flex ${dream ? "h-[54px] sm:h-[68px]" : "h-[64px] sm:h-[88px]"} flex-col items-center justify-center rounded-[8px] border-2 ${
          dream ? "border-white/10" : "border-[#F0433F]"
        } ${
          (dream ? DREAM_TONE[t.label.trim()] : undefined) ?? tileTone(t.label)
        } ${directBet.className ?? ""}`}
      >
        <span className={`${dream ? "text-[0.95rem] sm:text-[1.1rem]" : "text-[1.35rem] sm:text-[1.6rem]"} font-extrabold leading-none`}>
          {t.label}
        </span>
        {dream ? (
          <>
            <span className="mt-1 text-[0.66rem] font-bold leading-none sm:text-[0.72rem]">
              {t.price ? t.price.toFixed(2) : "—"}
            </span>
            <span className="mt-[3px] text-[0.6rem] font-semibold leading-none opacity-60 sm:text-[0.66rem]">
              {t.size ? Math.round(t.size) : ""}
            </span>
          </>
        ) : null}

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
        Min:{Math.max(100, winner?.min ?? 0)} Max:{winner?.max ?? 100000}
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
  const [tab, setTab] = useState<"DRAGON" | "TIGER">("DRAGON");
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
    const bg = side === "back" ? (open ? "rgb(167,216,253)" : "#d8e5ec") : open ? "rgb(249,201,212)" : "#eadde0";
    const price = side === "back" ? r?.back : r?.lay;
    const bettable = open && side === "back" && Boolean(price);
    return (
      <div
        {...(bettable
          ? {
              "data-market-plate": "",
              "data-market-option": "",
              "data-bet-label": r?.label ?? "",
              "data-bet-odds": String(price ?? ""),
            }
          : {})}
        className={`relative flex h-[60px] flex-1 flex-col items-center justify-center ${
          bettable ? "cursor-pointer" : ""
        } ${rounded === "l" ? "rounded-l-full" : "rounded-r-full border-l border-white"}`}
        style={{ background: bg }}
      >
        <span className={`text-[0.95rem] font-bold leading-none text-[#111] ${open ? "" : "opacity-40"}`}>
          {fmtOdds(price)}
        </span>
        <span className={`mt-1 text-[0.62rem] font-semibold text-[#111]/70 ${open ? "" : "opacity-40"}`}>
          {(() => { const v = side === "back" ? r?.backSize : r?.laySize; return v == null ? "" : String(Math.round(v)); })()}
        </span>
        {open ? null : <Lock />}

      </div>
    );
  };

  const MaroonBox = ({
    r,
    label,
    price,
  }: {
    r?: Row | undefined;
    label: ReactNode;
    price?: number | null | undefined;
  }) => {
    const bettable = Boolean(r?.open && price);
    return (
      <div className="min-w-0 text-center">
        <p className="mb-[6px] text-[0.95rem] font-bold text-[#111]">{fmtOdds(price)}</p>
        <div
          {...(bettable
            ? {
                "data-market-plate": "",
                "data-market-option": "",
                "data-bet-label": r?.label ?? "",
                "data-bet-odds": String(price ?? ""),
              }
            : {})}
          className={`relative flex h-[44px] items-center justify-center rounded-[10px] px-2 ${
            bettable ? "cursor-pointer" : ""
          }`}
          style={{
            background: "linear-gradient(180deg,#8c2b3f 0%,#5f1526 100%)",
            opacity: r && !r.open ? 0.75 : 1,
          }}
        >
          <span
            className={`text-[0.82rem] font-bold uppercase text-white ${
              r && !r.open ? "opacity-40" : ""
            }`}
          >
            {label}
          </span>
          {r && !r.open ? <Lock /> : null}
        </div>
      </div>
    );
  };

  const SideBlock = ({ side }: { side: "DRAGON" | "TIGER" }) => {
    const oe = list(byName(`${side} ODD/EVEN`));
    const color = list(byName(`${side} CARD COLOR`));
    const even = oe.find((r) => r.label.endsWith("EVEN"));
    const odd = oe.find((r) => r.label.endsWith("ODD"));
    const red = color.find((r) => r.label.includes("RED"));
    const black = color.find((r) => r.label.includes("BLACK"));
    const oeMkt = byName(`${side} ODD/EVEN`);
    const colMkt = byName(`${side} CARD COLOR`);
    return (
      <div className="bg-white px-2 pb-1 pt-2">
        <div className="grid grid-cols-4 gap-2">
          <MaroonBox r={even} label="Even" price={even?.back} />
          <MaroonBox r={odd} label="Odd" price={odd?.back} />
          <MaroonBox
            r={red}
            price={red?.back}
            label={<span className="text-[1rem] text-[#ff5757]">♦ ♥</span>}
          />
          <MaroonBox
            r={black}
            price={black?.back}
            label={<span className="text-[1rem] text-black">♣ ♠</span>}
          />
        </div>
        <div className="grid grid-cols-2 pt-1">
          <p className="text-center text-[0.62rem] font-semibold text-black/60">
            Min:{Math.max(100, oeMkt?.min ?? 0)} Max:{oeMkt?.max ?? 100000}
          </p>
          <p className="text-center text-[0.62rem] font-semibold text-black/60">
            Min:{Math.max(100, colMkt?.min ?? 0)} Max:{colMkt?.max ?? 100000}
          </p>
        </div>
      </div>
    );
  };

  const CardTile = ({ rank, locked }: { rank: string; locked: boolean }) => (
    <div className="relative flex h-[62px] w-[48px] flex-col items-center justify-center rounded-[5px] border-2 border-[#D9A521] bg-white">
      <span className="absolute left-[4px] top-[1px] text-[0.85rem] font-bold leading-none text-[#111]">
        {rank}
      </span>
      <span className="mt-3 grid grid-cols-2 gap-x-[3px] text-[0.6rem] leading-[0.78rem]">
        <span className="text-black">♠</span>
        <span className="text-[#e0201c]">♦</span>
        <span className="text-black">♣</span>
        <span className="text-[#e0201c]">♥</span>
      </span>
      {locked ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-[3px] bg-black/35" />
          <Lock />
        </>
      ) : null}
    </div>
  );

  const CardBlock = ({ side }: { side: "DRAGON" | "TIGER" }) => {
    const cards = list(byName(`${side} CARD`));
    if (!cards.length) return null;
    return (
      <div className="bg-[#e9edf0] pb-3">
        <div className="flex items-center justify-between bg-[#ededed] px-3 py-[10px]">
          <p className="text-[0.95rem] font-bold uppercase text-[#23282c]">
            {side} Card <span className="ml-2">{cards[0]?.back == null ? "" : cards[0].back.toFixed(2)}</span>
          </p>
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#555] text-[0.62rem] font-bold text-[#333]">
            i
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-[10px] gap-y-[10px] px-2 pt-3">
          {cards.map((r) => {
            const rank = r.label.replace(`${side} `, "").trim().toUpperCase();
            const bettable = r.open && Boolean(r.back);
            return (
              <div
                key={r.id}
                {...(bettable
                  ? {
                      "data-market-plate": "",
                      "data-market-option": "",
                      "data-bet-label": r.label,
                      "data-bet-odds": String(r.back),
                    }
                  : {})}
                className={bettable ? "cursor-pointer" : ""}
              >
                <CardTile rank={rank} locked={!bettable} />
              </div>
            );
          })}
        </div>
        <p className="px-3 pt-2 text-right text-[0.6rem] font-semibold text-black/55">
          Min:100 Max:{cardMax}
        </p>
      </div>
    );
  };


  return (
    <div className="mt-1 space-y-[6px] bg-l7-page py-[5px] font-[Tahoma,Helvetica,sans-serif]">
      <div className="rounded-[6px] border border-l7-card-border bg-white px-2 py-[10px]">
        <div className="grid grid-cols-2 gap-[6px]">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[0.8rem] font-bold text-[#23282c]">DRAGON</span>
          <div className="flex h-[60px] w-full max-w-[180px]">
          <WinCell r={dragon} side="back" rounded="l" />
          <WinCell r={dragon} side="lay" rounded="r" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[0.8rem] font-bold text-[#23282c]">TIGER</span>
          <div className="flex h-[60px] w-full max-w-[180px]">
          <WinCell r={tiger} side="back" rounded="l" />
          <WinCell r={tiger} side="lay" rounded="r" />
          </div>
        </div>
        </div>
      </div>

      {pair ? (
        <div
          {...(pair.open && pair.back
            ? {
                "data-market-plate": "",
                "data-market-option": "",
                "data-bet-label": pair.label,
                "data-bet-odds": String(pair.back),
              }
            : {})}
          className={`relative mx-[6px] flex h-[58px] items-center justify-between rounded-[14px] px-5 ${
            pair.open && pair.back ? "cursor-pointer" : ""
          }`}
          style={{
            background: "linear-gradient(180deg,#8c2b3f 0%,#5f1526 100%)",
            opacity: pair.open ? 1 : 0.8,
          }}
        >
          <span className={`text-[0.9rem] font-bold uppercase text-white ${pair.open ? "" : "opacity-45"}`}>
            {pair.label}
          </span>
          <span className={`text-[1rem] font-bold text-white ${pair.open ? "" : "opacity-45"}`}>
            {pair.back == null ? "" : pair.back.toFixed(2)}
          </span>
          {!pair.open ? <Lock /> : null}
        </div>
      ) : null}

      <p className="bg-white px-3 py-1 text-right text-[0.62rem] font-semibold text-black/60">
        Min:{Math.max(100, winnerMkt?.min ?? 0)} Max:{winnerMkt?.max ?? 100000}
      </p>

      <div className="grid grid-cols-2">
        {(["DRAGON", "TIGER"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setTab(side)}
            className={`h-[54px] text-[0.95rem] font-bold uppercase text-white ${
              tab === side ? "border-t-[3px] border-black" : ""
            }`}
            style={{
              background:
                tab === side
                  ? "linear-gradient(180deg,#8c2b3f 0%,#5f1526 100%)"
                  : "linear-gradient(180deg,#bd7f8d 0%,#a96574 100%)",
            }}
          >
            {side}
          </button>
        ))}
      </div>
      <SideBlock side={tab} />


      <CardBlock side={tab} />
    </div>
  );
}


function GamePage() {
  const embed = useEmbed();
  const shell = (w: string) =>
    embed
      ? "mx-auto min-h-dvh w-full max-w-full bg-table-felt px-0 py-0"
      : `mx-auto w-full ${w} px-0 py-0 sm:px-4 sm:py-5`;
  const { gameId } = Route.useParams();
  const fallbackGameName = getGame(gameId)?.name ?? gameId;
  const { admin, cfg } = useAdminConfig();
  const [state, setState] = useState<CasinoState | null>(null);
  // Last frame seen for this table, kept for the tab session. Re-opening a
  // game paints the real board straight away instead of the loading splash,
  // and the first live frame replaces it a moment later.
  const cacheKey = `ucas:${gameId}`;
  useEffect(() => {
    setState(null);
    try {
      const raw = sessionStorage.getItem(`ucas:${gameId}`);
      if (raw) setState(JSON.parse(raw) as CasinoState);
    } catch {
      // no cached frame — the splash shows until the feed answers
    }
  }, [gameId]);
  const [results, setResults] = useState<CasinoResult[]>([]);
  const [stream, setStream] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [age, setAge] = useState(0);
  const [roundSuspended, setRoundSuspended] = useState(false);
  const suspensionRound = useRef("");
  const bbbFrameRef = useRef<{
    mid: string;
    data: { runners?: BbbRunner[]; news?: string; min?: number; max?: number; gameResult?: string };
    roundId: string;
    leftSec: number;
    ts: number;
  } | null>(null);
  // Smooth local clock for the Ball by Ball round: the feed only reports whole
  // seconds and repeats/jumps values, so the ring is driven off a fixed end
  // time that is only re-synced when a new round starts or the feed drifts.
  const bbbClock = useRef<{ round: string; endAt: number; total: number } | null>(null);

  const roundWasOpen = useRef(false);

  // Some games (e.g. VIMAAN) have no upstream live event. Polling them only
  // produces 404 "Unknown game" / 400 "Valid eventId required" noise.
  const NO_FEED = new Set(["88.0030"]);
  const feedDead = useRef(NO_FEED.has(gameId));

  useEffect(() => {
    feedDead.current = NO_FEED.has(gameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (feedDead.current || inFlight.current) return;
    inFlight.current = true;
    try {
      const s = await fetchCasinoState(gameId);
      setState((previous) => stabilizeCasinoState(previous, s));
      try {
        if (s?.data) sessionStorage.setItem(cacheKey, JSON.stringify(s));
      } catch {
        // storage full or blocked — caching is only an optimisation
      }
      setAge(0);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load live state";
      if (/unknown game|valid eventid required|\(40\d\)/i.test(msg)) {
        feedDead.current = true;
        return;
      }
      setError(msg);
    } finally {
      inFlight.current = false;
    }
  }, [gameId, cacheKey]);

  useEffect(() => {
    void load();
    // The upstream caches frames for ~700ms, so polling faster than that only
    // burns bandwidth and makes the page janky. Round/result changes still
    // trigger instant bursts below.
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, 800);
    const a = setInterval(() => setAge((v) => v + 1), 1000);
    const wake = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(t);
      clearInterval(a);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [load]);


  const roundKey = state?.data?.roundId ? String(state.data.roundId) : "";

  // Single real-time result stream: live frame + result history merged, and it
  // owns settlement, the winner banner and the celebration lifecycle.
  const { current: liveResult } = useResultFeed({
    gameId,
    round: roundKey,
    open: isOpenStatus(String(state?.data?.status ?? "")),
    liveWinner: String(
      (state?.data as unknown as { gameResult?: string | null } | undefined)?.gameResult ?? "",
    ),
    results,
  });



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

  // The upstream occasionally alternates OPEN/SUSPENDED frames near result
  // time. Original tables enter suspension once and stay there until the next
  // round, so stabilise the visual phase instead of flashing the veil.
  useEffect(() => {
    if (!roundKey) return;
    const openNow = isOpenStatus(feedStatus);
    if (suspensionRound.current !== roundKey) {
      suspensionRound.current = roundKey;
      roundWasOpen.current = openNow;
      setRoundSuspended(!openNow);
      return;
    }
    // A round can start with a late/suspended frame and only then go live.
    // Until the round has actually been open once, keep following the feed so
    // the plates unlock as soon as betting opens.
    if (openNow && !roundWasOpen.current) {
      roundWasOpen.current = true;
      setRoundSuspended(false);
      return;
    }
    if (openNow) roundWasOpen.current = true;
    else if (roundWasOpen.current) setRoundSuspended(true);
  }, [roundKey, feedStatus]);



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
    const burst = [150, 450, 900, 1600, 2600].map((ms) => setTimeout(run, ms));
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void run();
    }, 1500);

    return () => {
      alive = false;
      burst.forEach(clearTimeout);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, roundKey, feedStatus]);


  // The declared result is the earliest signal that the table has moved on.
  // Pull a fresh live frame right away plus a short burst, so the next round's
  // open plates appear the moment the result feed ticks over.
  const latestResultRound = String(results[0]?.roundId ?? "");
  useEffect(() => {
    if (!latestResultRound) return;
    void load();
    const burst = [150, 400, 800, 1500, 2500].map((ms) => setTimeout(() => void load(), ms));
    return () => burst.forEach(clearTimeout);
  }, [latestResultRound, load]);

  // Settlement is handled by the shared result feed above.



  useEffect(() => {
    // Live studio streams for the table games. Verified published stream names
    // on the studio WebRTC server: GAME<nn> where nn is the game id suffix.
    const studio = studioStreamUrl(gameId);
    if (studio) {
      setStream(studio);
      return;
    }
    // Instant games render their own animation — no live studio stream exists,
    // so asking for one only produces a 400 from the feed.
    if (gameId.startsWith("88.")) {
      setStream(null);
      return;
    }
    fetchCasinoStream(gameId)
      .then((r) => setStream(r.upstreamIframeUrl ?? null))
      .catch(() => undefined);
  }, [gameId]);

  const d = state?.data ?? null;
  const status = (d?.status ?? "").toUpperCase();
  const suspended = status ? roundSuspended : false;
  const markets = d?.marketArr ?? [];
  const coinWinner = (() => {
    if (gameId !== "88.0021") return null;
    const directResult = String((d as unknown as { gameResult?: string })?.gameResult ?? "").trim();
    const liveRoundResult = liveResult?.round === roundKey ? liveResult.winner.trim() : "";
    const historyRoundResult =
      String(results[0]?.roundId ?? "") === roundKey
        ? deriveWinner(results[0] as AnyResult)
        : "";
    const sourceResult = directResult || liveRoundResult || historyRoundResult;
    const shownResult = String(applyOverride(cfg, admin, gameId, sourceResult) ?? sourceResult).toUpperCase();
    if (shownResult.startsWith("T")) return "TAILS" as const;
    if (shownResult.startsWith("H")) return "HEADS" as const;
    return null;
  })();
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

  if (!state && !error && !NO_FEED.has(gameId)) return <AppLoader />;





  const isOriginal = gameId.startsWith("88.");
  const isBbb = gameId === "4.3544687543453";

  const raw = (d ?? {}) as unknown as {
    multiplier?: string;
    runners?: BbbRunner[];
    news?: string;
    min?: number;
    max?: number;
    leftSec?: number;
    gameResult?: string;
  };

  if (isBbb) {
    // The upstream alternates between the live market frame and a stale frame
    // from the previous market id (leftSec 0, everything SUSPENDED). Keep the
    // last open frame and count its timer down locally so the board does not
    // flicker into a locked state every other poll.
    const nowMs = Date.now();
    const liveMid = String((d as unknown as { marketId?: string })?.marketId ?? "");
    const frameOpen = (raw.runners ?? []).some((r) => isOpenStatus(r.status));
    // The upstream also flips back and forth between two open markets. Once a
    // round is on screen, stay on it until its own timer runs out so the round
    // id, the countdown and an open bet slip do not jump every other poll.
    const held = bbbFrameRef.current;
    const heldLeft = held ? held.leftSec - (nowMs - held.ts) / 1000 : 0;
    const stick = !!held && held.mid !== liveMid && heldLeft > 1.5;
    if (frameOpen && !stick) {
      bbbFrameRef.current = {
        mid: liveMid,
        data: raw,
        roundId: String(d?.roundId ?? ""),
        leftSec: raw.leftSec ?? 0,
        ts: nowMs,
      };
    }
    const cached = bbbFrameRef.current;
    const cachedLeft = cached ? cached.leftSec - (nowMs - cached.ts) / 1000 : 0;
    const useCached = (!frameOpen || stick) && !!cached && cached.mid !== liveMid && cachedLeft > 0;
    const view = useCached && cached ? cached.data : raw;
    const viewRound = useCached && cached ? cached.roundId : String(d?.roundId ?? "");
    const feedLeft = useCached ? Math.max(0, cachedLeft) : Math.max(0, (raw.leftSec ?? 0) - age);
    // Re-sync only on a new round or when the feed drifts more than a second
    // from the local clock; otherwise count down smoothly from the round start.
    const clock = bbbClock.current;
    const localLeft = clock ? (clock.endAt - nowMs) / 1000 : 0;
    if (!clock || clock.round !== viewRound || feedLeft - localLeft > 1 || localLeft - feedLeft > 1.5) {
      bbbClock.current = {
        round: viewRound,
        endAt: nowMs + feedLeft * 1000,
        total: Math.max(clock && clock.round === viewRound ? clock.total : 0, Math.ceil(feedLeft) || 20),
      };
    }
    const viewLeft = Math.max(0, (bbbClock.current!.endAt - nowMs) / 1000);
    const viewTotal = Math.max(bbbClock.current!.total, 1);

    const bbbRecent = results.slice(0, 14).map((r) => {
      const rr = r as CasinoResult & { result?: string; selectionName?: string };
      const s = (rr.winner ?? rr.result ?? rr.selectionName ?? "-").toString().trim();
      if (/^EXTRA/i.test(s)) return "EX";
      if (/^WICKET/i.test(s)) return "W";
      return s.match(/^\d+/)?.[0] ?? s;
    });
    const normalizeBallResult = (value: string) => {
      const s = value.trim().toUpperCase();
      if (/^EXTRA/.test(s)) return "EXTRA RUNS";
      if (/^WICKET/.test(s) || s === "W") return "WICKET";
      const runs = s.match(/^\d+/)?.[0];
      return runs ? `${runs} ${runs === "1" ? "RUN" : "RUNS"}` : s;
    };
    const bbbOpen = (view.runners ?? []).some((r) => isOpenStatus(r.status));
    const liveBallResult = normalizeBallResult(
      view.gameResult ||
        (liveResult?.round === roundKey ? liveResult.winner : "") ||
        (!bbbOpen && String(results[0]?.roundId ?? "") === roundKey ? bbbRecent[0] ?? "" : ""),
    );

    return (
      <div className={shell("max-w-[620px]")}>
        <div className="bg-secondary px-2 py-1">
          {embed ? null : (

            <Link to="/" className="text-sm text-[#2563EB] hover:underline">

              ← Back to lobby

            </Link>

          )}
        </div>
        <div className="grid h-[26px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-casino-market-header px-2">
          <span className="truncate text-[0.7rem] font-bold uppercase text-board-header-foreground">
            {d?.eventName ?? "Ball By Ball"}
          </span>
          <span className="shrink-0 text-[0.55rem] font-bold text-board-header-foreground">
            {viewRound || "—"}
          </span>

        </div>
        <div className="relative aspect-video overflow-hidden bg-secondary">
          <img
            src={ballByBallBanner.url}
            alt="Ball by Ball"
            loading="eager"
            className="block h-full w-full object-cover"
          />
          <RoundTimer
            leftSec={viewLeft}

            suspended={!bbbOpen}
            total={viewTotal}
            variant="bbb"
            className="absolute right-1.5 top-1.5 z-20"
            size="h-[52px] w-[52px]"
          />
          {!bbbOpen && liveBallResult ? (
            <div className="bbb-result-ball absolute left-1/2 top-1/2 z-20 grid h-[136px] w-[136px] -translate-x-1/2 -translate-y-1/2 place-items-center">
              <img
                src={ballByBallResult}
                alt=""
                width={768}
                height={768}
                className="absolute inset-0 h-full w-full object-contain"
              />
              <span className="relative z-[1] max-w-[104px] text-center text-[1.05rem] font-extrabold leading-tight text-board-header-foreground">
                {liveBallResult}
              </span>
            </div>
          ) : null}
        </div>
        <BetLayer
          gameId={gameId}
          gameName={d?.eventName ?? "Ball By Ball"}
          round={viewRound}
          disabled={!bbbOpen}
        >
          <BallByBallBoard
            runners={view.runners ?? []}
            min={Math.max(100, view.min ?? 0)}
            max={view.max ?? 100000}
            news={view.news}
            recent={bbbRecent}
          />


        </BetLayer>
      </div>

    );
  }

  if (gameId === "88.0030") {
    return (
      <div className={embed ? shell("max-w-[1080px]") : "mx-auto w-full max-w-[1080px] px-0 py-3 sm:px-4 sm:py-5"}>
        {embed ? null : (

          <Link to="/" className="ml-4 text-sm text-[#2563EB] hover:underline sm:ml-0">

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
              {cleanGameName(d?.eventName) ?? fallbackGameName}
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
            winner={coinWinner}
            roundId={d?.roundId ? String(d.roundId) : undefined}
            suspended={suspended}
            leftSec={Math.min(20, Math.max(0, (d?.leftSec ?? 0) - age))}
          />

        ) : (
          <BalloonStage
            multiplier={
              applyOverride(cfg, admin, gameId, raw.multiplier ?? "1.00") ?? "1.00"
            }
            roundId={d?.roundId ? String(d.roundId) : undefined}
            suspended={suspended}
            status={status}
            leftSec={Math.max(0, (d?.leftSec ?? 0) - age)}
          />
        )}

        {gameId === "88.0021" ? (
          <Fit mobileNative designWidth={900}>
            <HeadsTailsPanel
              gameId={gameId}
              gameName={d?.eventName ?? gameId}
              round={String(d?.roundId ?? "")}
              disabled={suspended}
              runners={(markets[0]?.runners ?? []).map((r) => ({
                id: String(r.selectionId),
                label:
                  markets[0]?.runnersName?.[String(r.selectionId)] ?? String(r.selectionId),
                price: r.price?.back?.[0]?.price,
                size: r.price?.back?.[0]?.size,
                open: !suspended && isOpenStatus(r.status),
              }))}
              min={Math.max(100, markets[0]?.min ?? 0)}
              max={markets[0]?.max ?? 100000}
              recent={[
                ...(suspended && coinWinner ? [coinWinner] : []),
                ...results
                  .filter((r) => !(suspended && coinWinner && String(r.roundId ?? "") === roundKey))
                  .map((r) => deriveWinner(r as AnyResult)),
              ].slice(0, 10)}
            />
          </Fit>
        ) : gameId === "88.0023" ? null : (
          <BetLayer
            gameId={gameId}
            gameName={d?.eventName ?? gameId}
            round={String(d?.roundId ?? "")}
            disabled={suspended}
          >
            <ChipBetProvider
              gameId={gameId}
              gameName={d?.eventName ?? gameId}
              round={String(d?.roundId ?? "")}
              disabled={suspended}
            >
            <Fit mobileNative designWidth={900}>
              {markets.length ? (
                <NumberPanel
                  markets={markets}
                  suspended={suspended}
                  perRow={gameId === "88.0019" ? 5 : gameId === "88.0020" ? 3 : 2}
                  dream={gameId === "88.0020"}
                />
              ) : null}
            </Fit>
            </ChipBetProvider>
          </BetLayer>
        )}


        {gameId !== "88.0021" && gameId !== "88.0023" ? (
          <RecentStrip
            results={results}
            dream={gameId === "88.0020"}
            lucky7={gameId === "99.0030"}
            grey={gameId === "88.0019"}
          />
        ) : null}

      </div>
    );
  }

  return (
    <div
      className={
        gameId === "99.0030" && !embed
          ? "mx-auto w-full max-w-[430px] px-0 py-0 sm:px-1 sm:py-5"
          : shell(gameId === "99.0030" ? "max-w-[430px]" : "max-w-[900px]")
      }
    >
      {embed ? null : (
        <div className="hidden grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:grid">
          <div className="min-w-0">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to lobby
            </Link>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Live · Universe Live
            </p>
            <h1 className="mt-1 text-[1.35rem] font-extrabold leading-tight text-foreground sm:text-2xl">
              {cleanGameName(d?.eventName) ?? fallbackGameName}
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
        data-one-day-teen-patti={gameId === "99.0013" ? "true" : undefined}
        className={`relative overflow-hidden bg-black ${embed ? "" : "mt-0 rounded-none sm:mt-4 sm:rounded-md"}`}
      >

        {stream ? (
          <CasinoLivePlayer
            title="Live game stream"
            src={stream}
            loaderSrc={casinoStageMark.url}
            className={`${gameId === "99.0030" ? "aspect-[1.82/1]" : gameId === "99.0013" ? "aspect-[1.72/1]" : ["99.0001", "99.0016", "99.0019", "99.0022"].includes(gameId) ? "aspect-[1.78/1]" : "aspect-video"} w-full ${gameId === "99.0030" ? "" : "sm:aspect-video"}`}
          />
        ) : (
          <div className={`${gameId === "99.0030" ? "aspect-[1.82/1]" : gameId === "99.0013" ? "aspect-[1.72/1]" : ["99.0001", "99.0016", "99.0019", "99.0022"].includes(gameId) ? "aspect-[1.78/1]" : "aspect-video"} w-full bg-black ${gameId === "99.0030" ? "" : "sm:aspect-video"}`} />
        )}
        {!stream ? (
          <img
            src={casinoStageMark.url}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-auto w-[38%] max-w-[170px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-90"
          />
        ) : null}
        <div
          ref={overlayRef}
          className={`pointer-events-none absolute left-1 top-1 z-20 max-w-[calc(100%-0.5rem)] origin-top-left overflow-visible sm:left-3 sm:top-3 sm:max-w-[calc(100%-1.5rem)] ${["99.0001", "99.0013", "99.0016", "99.0019", "99.0022"].includes(gameId) ? "space-y-1.5" : "space-y-1"}`}
          style={{ transform: ["99.0001", "99.0013", "99.0016", "99.0019", "99.0022"].includes(gameId) ? undefined : `scale(${overlayScale})` }}
        >
          <p className={`${["99.0001", "99.0013", "99.0016", "99.0019", "99.0022"].includes(gameId) ? "text-[0.68rem] font-extrabold" : "text-[0.6rem] font-bold sm:text-[0.72rem]"} uppercase text-white drop-shadow`}>
            RID: {d?.roundId ?? "—"}
          </p>
          {handLayout.map((h) => (
             gameId === "99.0001"
               ? <JokerCards key={h.title} title={h.title} hand={h.hand} sideThird />
               : gameId === "99.0013"
              ? <OneDayCards key={h.title} title={h.title} hand={h.hand} />
              : gameId === "99.0016"
                ? <JokerCards key={h.title} title={h.title} hand={h.hand} />
                : gameId === "99.0019"
                  ? <JokerCards key={h.title} title={h.title} hand={h.hand} />
              : <Cards key={h.title} title={h.title} hand={h.hand} />
          ))}
        </div>


        <RoundTimer
          leftSec={Math.max(0, (d?.leftSec ?? 0) - age)}
          suspended={suspended}
          className="absolute right-1 top-1 z-20 sm:right-2 sm:top-2"
          size="h-9 w-9 sm:h-14 sm:w-14"
        />

        <ResultBanner result={liveResult} gameId={gameId} gameName={d?.eventName ?? null} />
      </div>


      <BetLayer
        gameId={gameId}
        gameName={d?.eventName ?? gameId}
        round={String(d?.roundId ?? "")}
        disabled={suspended}
        exposureLayout={["99.0016", "99.0013"].includes(gameId) ? "row" : "market"}
      >
        <ChipBetProvider
          gameId={gameId}
          gameName={d?.eventName ?? gameId}
          round={String(d?.roundId ?? "")}
          disabled={suspended}
        >
        <div className="casino-ref-font"><Fit designWidth={860} mobileNative>
        {gameId === "99.0014" && markets.length ? (
          <MuflisPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0018" && markets.length ? (
          <div className="reflist is-dt">{markets.map((m, i) => <RefListMarket key={`${m.marketId}-${i}`} market={m} suspended={suspended} backOnly />)}</div>
        ) : gameId === "99.0021" && markets.length ? (
          <DragonTigerPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0041" && markets.length ? (
          <DTLPanel markets={markets} suspended={suspended} resultDeclared={suspended} />
        ) : gameId === "99.0025" && markets.length ? (
          <AndarBaharPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0001" && markets.length ? (
          <BaccaratPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0022" && markets.length ? (
          <div className="reflist">{[...markets].sort((a, b) => { const o = ["WINNER", "CARD COLOR", "CARD TOTAL", "LUCKY NUMBER"]; const ai = o.indexOf((a.marketName ?? "").trim().toUpperCase()); const bi = o.indexOf((b.marketName ?? "").trim().toUpperCase()); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); }).map((m, i) => <RefListMarket key={`${m.marketId}-${i}`} market={m} suspended={suspended} />)}</div>
        ) : gameId === "99.0007" && markets.length ? (
          <PokerPanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0046" && markets.length ? (
          <CardRacePanel markets={markets} suspended={suspended} />
        ) : gameId === "99.0005" && markets.length ? (
          <AAAPanel markets={markets} suspended={suspended} />
        ) : ["99.0030", "99.0010", "99.0019"].includes(gameId) && markets.length ? (
          // Reference MarketPanel (grid layout) — shared by Lucky 7, 20-20 Teen Patti, 20-20 Dragon Tiger.
          <div className="lucky7-board">
            {markets.map((m, i) => (
              <Lucky7Board key={`${m.marketId}-${i}`} market={m} suspended={suspended} />
            ))}
          </div>
        ) : gameId === "99.0013" && markets.length ? (
          <div className="reflist">{markets.map((m, i) => (
            <RefListMarket key={`${m.marketId}-${i}`} market={m} suspended={suspended} minMax />
          ))}</div>
        ) : gameId === "99.0016" && markets.length ? (
          <div className="reflist">{markets.map((m, i) => (
            <RefListMarket key={`${m.marketId}-${i}`} market={m} suspended={suspended} backOnly />
          ))}</div>
        ) : (
          markets.map((m, i) => (
            <MarketBoard key={`${m.marketId}-${i}`} market={m} suspended={suspended} />
          ))
        )}
        </Fit></div>
        </ChipBetProvider>
        {/* Recent Result sits flush under the last market, like the original. */}
        {["99.0030", "99.0010", "99.0019", "99.0013", "99.0016", "99.0001", "99.0022"].includes(gameId) ? (
          <Lucky7Recent results={results} game={gameId} />
        ) : (
          <RecentStrip results={results} oneDay={gameId === "99.0013"} joker={gameId === "99.0016"} dragonTiger={gameId === "99.0019"} baccarat={gameId === "99.0001"} cards32={gameId === "99.0022"} cardRace={gameId === "99.0046"} />
        )}
      </BetLayer>



      {!markets.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading live markets…</p>
      ) : null}



    </div>
  );
}


/** "RESULT DECLARED" overlay — shows the winning selection right after a round settles. */
function lucky7Label(winner: string): string | null {
  const w = winner.trim().toUpperCase();
  if (/^(H|HIGH)\b|HIGH\s*CARD|8\s*TO\s*K/.test(w)) return "HIGH CARD ( 8 TO K ) WIN";
  if (/^(L|LOW)\b|LOW\s*CARD|A\s*TO\s*6/.test(w)) return "LOW CARD ( A TO 6 ) WIN";
  if (/^(TIE|DRAW|7)$/.test(w) || /TIE/.test(w)) return "TIE";
  return null;
}



/**
 * Winner banner — driven purely by the real-time result feed: it appears with
 * the declared round and disappears when the next round opens.
 */
function ResultBanner({
  result,
  gameId,
  gameName,
}: {
  result: FeedResult | null;
  gameId?: string;
  gameName?: string | null;
}) {
  const winner = (result?.winner ?? "").trim();
  const key = result ? `${result.round}|${winner}` : "";
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!key || !winner) {
      setShow(false);
      return;
    }
    setShow(true);
    // The original result callout stays visible briefly, then clears even if
    // the next live frame has not opened yet.
    const t = setTimeout(() => setShow(false), 3000);
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
  oneDay,
  joker,
  dragonTiger,
  baccarat,
  cards32,
  cardRace,
  grey,
}: {
  results: CasinoResult[];
  dream?: boolean;
  lucky7?: boolean;
  oneDay?: boolean;
  joker?: boolean;
  dragonTiger?: boolean;
  baccarat?: boolean;
  cards32?: boolean;
  cardRace?: boolean;
  grey?: boolean;
}) {
  return (

      <div className={`mt-0 flex items-center overflow-x-auto ${grey ? "bg-[#E6E6E6]" : "bg-black"} ${cardRace ? "h-[59px] gap-[9px] p-[5px]" : oneDay ? "h-[42px] gap-2 px-1.5 py-1" : joker || dragonTiger || cards32 ? "h-[40px] gap-2 px-1 py-1" : baccarat ? "h-[51px] gap-2.5 px-1 py-1.5" : "mt-[5px] h-[36px] gap-[9px] px-[5px]"}`}>
        <span className={`mr-3 shrink-0 font-['Tahoma',Helvetica,sans-serif] ${cardRace ? "mt-[8px] self-start text-[14px]" : "text-[12px]"} font-bold ${grey ? "text-black" : "text-white"}`}>Recent Result</span>



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
            dragonTiger && isTie
              ? "bg-[#F6D743] text-black"
              : baccarat && isTie
                ? "bg-[#F6D743] text-black"
              : isNum && playerMatch
              ? (PLAYER32_TONE[w] ?? "bg-[#E67E22] text-white")
              : isNum
                ? w === "0"
                  ? "bg-[#0E8A3C] text-white"
                  : Number(w) % 2 === 1
                    ? "bg-[#D9392F] text-white"
                    : "bg-[#1C1C1C] text-white"
                : isTie
                  ? "bg-[#8CD9B5] text-[#0F172A]"
                    : baccarat && first === "B"
                      ? "bg-[#F9A9BA] text-black"
                    : baccarat && first === "P"
                      ? "bg-baccarat-blue text-board-header-foreground"
                    : first === "L"
                    ? (lucky7 ? "bg-[#F9A9BA] text-white" : "bg-[#4CD964] text-black")
                    : first === "C"
                      ? "bg-[#FFFF33] text-black"
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
          if (suit && cardRace) {
            return <img key={`${r.roundId ?? ""}-${idx}`} title={`Round ${r.roundId}`} src={CARD_RACE_K[suit]} alt={`K ${suit}`} className="h-[43px] w-[32px] shrink-0 border-2 border-[#e6c200]" />;
          }
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
              className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
                lucky7
                  ? "h-[22px] min-w-[22px] px-1.5 text-[0.7rem]"
                  : joker || dragonTiger || cards32
                    ? "h-6 min-w-7 px-1.5 text-[0.7rem]"
                    : oneDay || baccarat
                      ? "h-7 min-w-9 px-2 text-[0.78rem]"
                      : dream
                        ? "h-8 min-w-8 border-2 border-white px-1 text-[0.8rem]"
                   : "h-[26px] min-w-[26px] px-1 font-['Tahoma',Helvetica,sans-serif] text-[12px]"
              } ${finalTone}`}
            >
              {(dragonTiger || baccarat) && isTie ? "Tie" : first || "-"}
            </span>
          );

        })}
      </div>
  );
}
