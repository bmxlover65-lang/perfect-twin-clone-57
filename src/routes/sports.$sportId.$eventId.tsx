import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import {
  fetchOdds,
  fmtOdds,
  fmtSize,
  runnerName,
  sportsSocketUrl,
  type Market,
  type OddsResponse,
} from "@/lib/uapi";
import { BalanceChip, BetLayer } from "@/components/betting";
import { createFeedState, mergeFeed } from "@/lib/feed-merge";
import { Scoreboard } from "@/components/Scoreboard";
import { LiveTv } from "@/components/LiveTv";
import { AppLoader } from "@/components/AppLoader";
import { readWallet, settleFancyLines, settleFromRunners, voidOpen, voidOpenWhere } from "@/lib/wallet";
import { fancyResult, matchOutcome, pullScore, pullSideScore, readTrack, sideOutcome } from "@/lib/fancy-settle";
import soccerBanner from "@/assets/sports/soccer-banner.jpg.asset.json";
import tennisBanner from "@/assets/sports/tennis-banner.jpg.asset.json";
import cricketBanner from "@/assets/sports/cricket-banner.jpg.asset.json";
import horseBanner from "@/assets/sports/horse-banner.jpg.asset.json";
import greyhoundBanner from "@/assets/sports/greyhound-banner.jpg.asset.json";

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
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
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

const SPORT_BANNERS: Record<string, { url: string }> = {
  "1": soccerBanner,
  "2": tennisBanner,
  "4": cricketBanner,
  "7": horseBanner,
  "4339": greyhoundBanner,
};

/* Dukex ladder tones: best price is the strongest colour. */
const BACK_TONE = ["bg-dx-back1", "bg-dx-back2", "bg-dx-back3"];
const LAY_TONE = ["bg-dx-lay1", "bg-dx-lay2", "bg-dx-lay3"];

function Cell({
  price,
  size,
  side,
  dim,
  depth = 0,
  label,
  betOdds,
  raw = false,
}: {
  /** Race boards print rates exactly like Dukex: 9.6, 108.72, 102.3. */
  raw?: boolean;
  label?: string;
  /** Fancy rows show the run line; the payout rate comes from the size. */
  betOdds?: number | undefined;
  price?: number | undefined;
  size?: number | undefined;
  side: "back" | "lay";
  dim?: boolean;
  depth?: number;
}) {
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

  const tone = (side === "back" ? BACK_TONE : LAY_TONE)[depth] ?? BACK_TONE[0];
  return (
    <div
      data-bet-label={label && price ? label : undefined}
      data-bet-odds={label && price ? String(betOdds ?? price) : undefined}
      className={`relative flex h-full min-h-[42px] cursor-pointer flex-col items-center justify-center overflow-hidden border-l border-dx-page ${tone} ${
        dim ? "opacity-60" : ""
      } ${flash} text-dx-ink`}
    >
      <span className={`${raw ? "text-[0.85rem]" : "text-[0.8rem]"} font-bold leading-tight`}>{price ? (raw ? String(Number(price)) : fmtOdds(price)) : "0"}</span>
      <span className={`${raw ? "text-[0.7rem]" : "text-[0.66rem]"} leading-tight`}>
        {!price ? "0.00" : raw ? String(Number((Number(size) || 0).toFixed(2))) : betOdds !== undefined ? fmtSize(size) || "0.00" : dxSize(size)}
      </span>
    </div>
  );
}

function InfoIcon({ light = false, text }: { light?: boolean; text?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const t = setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [open]);
  return (
    <span className="relative inline-flex shrink-0" data-nobet="">
      <span
        role="button"
        tabIndex={0}
        aria-label="Market info"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`flex h-[15px] w-[15px] items-center justify-center rounded-full border text-[0.6rem] font-bold leading-none ${
          light ? "border-dx-page text-dx-page" : "border-dx-ink text-dx-ink"
        }`}
      >
        i
      </span>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-0 top-[19px] z-30 w-[190px] rounded-md border border-dx-rule bg-dx-page p-2 text-left text-[0.66rem] font-semibold leading-snug text-dx-ink shadow-lg"
        >
          {text ?? "Bets are matched at the shown rate. Suspended markets do not accept bets."}
        </span>
      ) : null}
    </span>
  );
}

function marketInfo(market: Market): string {
  const m = market as Market & { min?: number; max?: number };
  const delay = market.oddsData?.betDelay;
  return [
    m.min || m.max ? `Min ${m.min ?? 0} · Max ${m.max ?? 0}` : null,
    delay ? `Bet delay ${delay}s` : null,
    "Suspended markets do not accept bets. Settled on the official result.",
  ]
    .filter(Boolean)
    .join(" · ");
}

function Suspended({ label }: { label: string }) {
  return (
    <div data-suspended="true" className="absolute inset-0 z-10 flex items-center justify-center border-2 border-ex-suspend bg-dx-page/75">
      <span className="text-[1.9rem] font-bold uppercase text-ex-suspend">{label}</span>
    </div>
  );
}

// The upstream feed sometimes keeps a market "OPEN" while every price is
// zeroed out, or reports SUSPEND / INACTIVE variants.
function marketState(market: Market): { status: string; dim: boolean; label: string } {
  const raw = String(market.oddsData?.status ?? "OPEN").toUpperCase();
  const runners = market.oddsData?.runners ?? [];
  const hasPrice = runners.some((r) => {
    const rs = String(r.status ?? "").toUpperCase();
    if (/SUSPEND|CLOSE|INACTIVE|REMOVED/.test(rs)) return false;
    const all = [...(r.price?.back ?? []), ...(r.price?.lay ?? [])];
    return all.some((p) => Number(p?.price) > 0);
  });
  const closed = /CLOSE|SETTLE|RESULT/.test(raw);
  const ballRunning = /BALL/.test(raw);
  const suspended =
    ballRunning || /SUSPEND|INACTIVE/.test(raw) || (!closed && runners.length > 0 && !hasPrice);
  const dim = closed || suspended;
  const status = closed ? "CLOSED" : suspended ? "SUSPENDED" : raw;
  return { status, dim, label: closed ? "Closed" : ballRunning ? "Ball Running" : "Suspended" };
}

function MarketTitle({ name, matched, race = false }: { name: string; matched?: number | undefined; race?: boolean }) {
  if (race) {
    const n = Number(matched) || 0;
    const m = n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n));
    return (
      <header className="flex h-[30px] items-stretch border-b border-dx-rule bg-dx-page text-dx-ink">
        <span className="flex items-center gap-2 rounded-tr-[12px] bg-dx-title px-2.5 text-[0.8rem] font-bold text-dx-page">
          <span className="max-w-[190px] truncate">{name.trim()}</span>
          <InfoIcon light />
        </span>
        <span className="ml-auto flex items-center pr-2.5 text-[0.82rem]">
          Matched&nbsp;<b>€ {m}</b>
        </span>
      </header>
    );
  }
  return (
    <header className="flex h-[26px] items-stretch border-b border-dx-rule bg-dx-page text-dx-ink">
      <span className="flex items-center gap-1.5 rounded-tr-[10px] bg-dx-title px-2 text-[0.72rem] font-bold text-dx-page">
        <span className="max-w-[170px] truncate">{name.trim()}</span>
        <InfoIcon light />
      </span>
      <span className="ml-2 flex items-center gap-1 text-[0.68rem] font-semibold">
        <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-dx-cash">
          <span className="h-2 w-2 rounded-full bg-dx-ink" />
        </span>
        Cash Out
      </span>
      <span className="ml-auto flex items-center pr-2 text-[0.6rem]">
        Matched&nbsp;<b>€{odds2k(matched)}</b>
      </span>
    </header>
  );
}

/** Dukex prints cell volumes with two decimals: 474.92, 8.43K, 5.00M. */
function dxSize(v?: number): string {
  const n = Number(v) || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

/** Dukex prints matched volume short (€2M, €15M). */
function odds2k(v?: number): string {
  const n = Number(v) || 0;
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

function Board({
  market,
  levels = 3,
  backOnly = false,
  book = false,
  race = false,
}: {
  market: Market;
  /** Horse / greyhound: best Back/Lay only, cloth number, silks and runner info chips. */
  race?: boolean;
  levels?: 1 | 3;
  backOnly?: boolean;
  /** Bookmaker rows use the pale yellow runner column like Dukex. */
  book?: boolean;
}) {
  const odds = market.oddsData;
  const { dim, label } = marketState(market);
  const runners = (odds?.runners ?? [])
    .filter((runner) => !/REMOVED/.test(String(runner.status ?? "").toUpperCase()))
    .sort((a, b) => race ? Number((a as { sortPriority?: number }).sortPriority ?? 0) - Number((b as { sortPriority?: number }).sortPriority ?? 0) : 0);
  if (race) levels = 1;
  const info = ((market as unknown as { racingInfo?: Record<string, RaceInfo> }).racingInfo ?? {}) as Record<string, RaceInfo>;
  const cols = backOnly ? 1 : levels * 2;
  const grid =
    cols === 6
      ? "grid-cols-[minmax(0,2.3fr)_repeat(6,minmax(0,1fr))]"
      : cols === 2
        ? race
          ? "grid-cols-[minmax(0,1fr)_79px_79px]"
          : "grid-cols-[minmax(0,1fr)_76px_76px]"
        : "grid-cols-[minmax(0,1fr)_90px]";
  const backOrder = levels === 3 ? [2, 1, 0] : [0];
  const layOrder = levels === 3 ? [0, 1, 2] : [0];
  const min = market.min && market.min > 0 ? market.min : 100;
  const max = market.max && market.max > 0 ? market.max : book ? 200000 : 10000;

  return (
    <article className="mb-3 bg-dx-page">
      <MarketTitle name={market.marketName} matched={odds?.totalMatched} race={race} />
      <div className="relative">
      {race ? (
        <div className={`grid h-[34px] border-b border-dx-rule text-dx-ink ${grid}`}>
          <div className="flex items-center px-2.5">
            <span className="flex h-[22px] w-full items-center justify-center gap-3 rounded-[2px] bg-dx-minmax text-[0.72rem] font-bold">
              <span className="text-dx-title">Min/Max</span>
              <span>{min}-{max >= 1000 ? `${(max / 1000).toFixed(1)}K` : max}</span>
            </span>
          </div>
          <div className="flex items-center justify-center bg-dx-backhead-race text-[0.92rem] font-bold">Back</div>
          <div className="flex items-center justify-center bg-dx-layhead-race text-[0.92rem] font-bold">Lay</div>
        </div>
      ) : (
      <div className={`grid h-[26px] border-b border-dx-rule text-[0.72rem] text-dx-ink ${grid}`}>
        <div className="flex items-center px-1.5">
          <span className="whitespace-nowrap rounded-[3px] bg-dx-minmax px-1 py-[1px] text-[0.56rem] font-semibold text-dx-title">
            Min/Max&nbsp; {min} - {max}
          </span>
        </div>
        <div
          className="flex items-center justify-center bg-dx-backhead font-medium"
          style={{ gridColumn: `span ${backOnly ? 1 : levels}` }}
        >
          Back
        </div>
        {backOnly ? null : (
          <div
            className="flex items-center justify-center bg-dx-layhead font-medium"
            style={{ gridColumn: `span ${levels}` }}
          >
            Lay
          </div>
        )}
      </div>
      )}
      <div className="relative">
        {runners.map((r) => (
          <Fragment key={String(r.selectionId)}>
          <div
            data-runner-row
            className={`relative grid ${race ? "min-h-[50px]" : "min-h-[48px]"} items-stretch border-b border-dx-rule ${
              book ? "bg-dx-book" : "bg-dx-page"
            } ${grid}`}
          >
            {race ? (
              <RaceRunner name={runnerName(market, r.selectionId)} info={info[String(r.selectionId)]} />
            ) : (
            <span className="flex min-w-0 items-start px-1.5 pt-[7px] text-[0.8rem] font-bold leading-[1.2] text-dx-ink">
              <span className="line-clamp-2 break-words">{runnerName(market, r.selectionId)}</span>
            </span>
            )}
            {backOrder.map((i) => {
              const p = r.price?.back?.[i];
              return <Cell key={`b${i}`} label={`${runnerName(market, r.selectionId)} Back`} price={p?.price} size={p?.size} side="back" dim={dim} depth={i} raw={race} />;
            })}
            {backOnly
              ? null
              : layOrder.map((i) => {
                  const p = r.price?.lay?.[i];
                  return <Cell key={`l${i}`} label={`${runnerName(market, r.selectionId)} Lay`} price={p?.price} size={p?.size} side="lay" dim={dim} depth={i} raw={race} />;
                })}
          </div>
          {race && info[String(r.selectionId)] ? <RaceChips info={info[String(r.selectionId)] as RaceInfo} /> : null}
          </Fragment>
        ))}
      </div>
        {dim ? <Suspended label={label} /> : null}
      </div>
    </article>
  );
}

type RaceInfo = {
  CLOTH_NUMBER?: string;
  STALL_DRAW?: string;
  JOCKEY_NAME?: string;
  TRAINER_NAME?: string;
  AGE?: string;
  WEIGHT_VALUE?: string;
  WEIGHT_UNITS?: string;
  COLOURS_FILENAME_URL?: string;
  COLOURS_FILENAME?: string;
};

function silkSrc(info?: RaceInfo): string | undefined {
  const f = info?.COLOURS_FILENAME ?? "";
  if (f.startsWith("data:")) return f;
  if (/^[A-Za-z0-9+/=]{40,}$/.test(f)) return `data:image/png;base64,${f}`;
  return info?.COLOURS_FILENAME_URL || undefined;
}

function RaceRunner({ name, info }: { name: string; info?: RaceInfo | undefined }) {
  return (
    <span className="flex min-w-0 items-center gap-1 px-2 text-[0.8rem] font-bold leading-[1.2] text-dx-ink">
      {info?.CLOTH_NUMBER ? (
        <span className="w-5 shrink-0 text-center text-[0.72rem] leading-tight">
          {info.CLOTH_NUMBER}
          {info.STALL_DRAW ? <span className="block text-[0.6rem] font-semibold">({info.STALL_DRAW})</span> : null}
        </span>
      ) : null}
      {silkSrc(info) ? (
        <img src={silkSrc(info)} referrerPolicy="no-referrer" alt="" width={24} height={22} className="h-[22px] w-6 shrink-0 object-contain" loading="lazy" />
      ) : null}
      <span className="max-w-[5.8rem] truncate">{name}</span>
    </span>
  );
}

function RaceChips({ info }: { info: RaceInfo }) {
  const chips = [
    info.JOCKEY_NAME && ["Jockey", info.JOCKEY_NAME],
    info.TRAINER_NAME && ["Trainer", info.TRAINER_NAME],
    info.AGE && ["Age", info.AGE],
    info.WEIGHT_VALUE && ["Weight", `${info.WEIGHT_VALUE} ${info.WEIGHT_UNITS ?? ""}`.trim()],
  ].filter(Boolean) as [string, string][];
  if (!chips.length) return null;
  return (
    <div className="flex flex-nowrap gap-[5px] overflow-hidden border-b border-dx-rule bg-dx-page px-[3px] py-[3px]" data-nobet="">
      {chips.map(([k, v]) => (
        <span key={k} className="whitespace-nowrap rounded-[2px] bg-dx-minmax px-[3px] py-[1px] text-[0.62rem] text-dx-ink">
          <b>{k} :</b> {v}
        </span>
      ))}
    </div>
  );
}

function FancyRow({ market }: { market: Market }) {
  const odds = market.oddsData;
  const { dim, label } = marketState(market);
  const r = odds?.runners?.[0];
  const no = r?.price?.lay?.[0];
  const yes = r?.price?.back?.[0];

  return (
    <div
      data-runner-row
      className="relative grid min-h-[44px] grid-cols-[minmax(0,1fr)_79px_79px] border-b border-dx-rule bg-dx-page"
    >
      <span className="flex min-w-0 items-center gap-1 px-1.5 text-[0.72rem] font-bold leading-tight text-dx-ink">
        <span className="min-w-0 flex-1">{market.marketName.trim()}</span>
        <InfoIcon text={marketInfo(market)} />
      </span>
      <Cell label={`${market.marketName.trim()} @${no?.price ?? 0} No`} betOdds={no?.size ? 1 + no.size / 100 : undefined} price={no?.price} size={no?.size} side="lay" dim={dim} />
      <Cell label={`${market.marketName.trim()} @${yes?.price ?? 0} Yes`} betOdds={yes?.size ? 1 + yes.size / 100 : undefined} price={yes?.price} size={yes?.size} side="back" dim={dim} />
      {dim ? (
        <div data-suspended="true" className="absolute inset-y-0 right-0 z-10 flex w-[158px] items-center justify-center border border-ex-suspend bg-dx-page/75">
          <span className="text-[0.85rem] font-bold uppercase text-ex-suspend">{label}</span>
        </div>
      ) : null}
    </div>
  );
}

type FancyFlags = {
  isKhadoMarket?: boolean;
  isMeterMarket?: boolean;
  isBallbyball?: boolean;
  isSuperFancy?: boolean;
  isLineMarket?: boolean;
};

type MarketFlags = FancyFlags & {
  popular?: boolean;
  tableFlag?: string;
};

function isPopularMarket(market: Market): boolean {
  return Boolean((market as MarketFlags).popular);
}

function marketGroupName(market: Market): string {
  const flags = market as MarketFlags;
  const name = market.marketName.trim();
  const type = `${market.marketType ?? ""} ${flags.tableFlag ?? ""}`.toUpperCase();
  if (/BOOKMAKER/.test(type) || /^BOOKMAKER$/i.test(name)) return "Bookmaker";
  if (/MATCH_ODDS/.test(type) || /^MATCH ODDS$/i.test(name)) return "Match Odds";
  if (/FANCY|LINE|KHADO|METER|BALL/.test(type) || fancyTab(market) !== "Fancy") return "Fancy";
  return name;
}

/** Dukex groups session markets into tabs; derive each one's tab. */
function fancyTab(m: Market): string {
  const f = m as unknown as FancyFlags;
  const name = `${m.marketName ?? ""}`.toUpperCase();
  if (f.isKhadoMarket) return "Khado";
  if (f.isMeterMarket) return "Meter";
  if (f.isBallbyball) return "Ball by Ball";
  if (f.isLineMarket || /\bLINE\b/.test(name)) return "Line Market";
  if (/ODD\s*\/?\s*EVEN/.test(name)) return "Odd/Even";
  return "Fancy";
}

// Dukex always shows the full filter bar, even when a filter is empty.
const FANCY_TABS = ["Fancy", "Line Market", "Ball by Ball", "Meter", "Khado"];
const SB_TABS = ["Match", "Odds/Evens", "Batsman", "Bowler", "Extra"];

function sbTab(m: Market): string {
  const n = m.marketName.toUpperCase();
  if (/ODD|EVEN/.test(n)) return "Odds/Evens";
  if (/BOWLER|WICKETS? BY|DISMISS/.test(n)) return "Bowler";
  if (/BATSMAN|BATTER|RUNS BY|PLAYER|TOP BAT/.test(n)) return "Batsman";
  if (/EXTRA|WIDE|NO ?BALL|BOUNDAR|SIX|FOUR|DIGIT/.test(n)) return "Extra";
  return "Match";
}

function FilterBar({ tabs, active, onPick, tone }: { tabs: string[]; active: string; onPick: (t: string) => void; tone: string }) {
  return (
    <div className={`flex justify-center px-2 py-1 ${tone}`}>
      <div className="flex gap-0 overflow-x-auto rounded-[4px] bg-dx-minmax/40 p-[2px]">
        {["ALL", ...tabs].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            className={`whitespace-nowrap rounded-[3px] px-2 py-[3px] text-[0.68rem] font-semibold ${
              active === t ? "bg-dx-page text-dx-ink" : "text-dx-page"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function FancySection({ markets, sportsbook }: { markets: Market[]; sportsbook: Market[] }) {
  const [tab, setTab] = useState("ALL");
  const [sb, setSb] = useState("ALL");
  const [head, setHead] = useState<"fancy" | "sb">(markets.length ? "fancy" : "sb");
  const active = tab;
  const shown = active === "ALL" ? markets : markets.filter((m) => fancyTab(m) === active);
  const sbShown = sb === "ALL" ? sportsbook : sportsbook.filter((m) => sbTab(m) === sb);

  return (
    <section className="mb-3 bg-dx-page">
      <div className="flex h-[26px] items-stretch border-b-2 border-dx-fancy text-[0.68rem] font-bold text-dx-page">
        {markets.length ? (
          <button
            type="button"
            onClick={() => setHead("fancy")}
            className="flex items-center gap-1.5 rounded-tr-[10px] bg-dx-fancy px-2"
          >
            Fancy Bet <InfoIcon light text="Fancy / session bets: No = runs below the line, Yes = at or above. Settled on the official score." />
          </button>
        ) : null}
        {sportsbook.length ? (
          <button
            type="button"
            onClick={() => setHead("sb")}
            className="flex items-center gap-1.5 rounded-tr-[10px] bg-dx-sb px-2"
          >
            Sportsbook <InfoIcon light text="Sportsbook markets pay the decimal rate shown. Settled on the official result." />
          </button>
        ) : null}
      </div>
      {head === "fancy" ? (
        <>
          <FilterBar tabs={FANCY_TABS} active={active} onPick={setTab} tone="bg-dx-fancy-bar" />
          <div className="grid h-[22px] grid-cols-[minmax(0,1fr)_79px_79px] text-[0.66rem] font-semibold text-dx-ink">
            <span />
            <span className="flex items-center justify-center bg-dx-lay1">No</span>
            <span className="flex items-center justify-center bg-dx-back1">Yes</span>
          </div>
          {shown.map((m) => (
            <FancyRow key={m.marketId} market={m} />
          ))}
        </>
      ) : (
        <div>
          <FilterBar tabs={SB_TABS} active={sb} onPick={setSb} tone="bg-dx-sb" />
          {sbShown.map((m) => (
            <Board key={m.marketId} market={m} levels={1} backOnly />
          ))}
        </div>
      )}
    </section>
  );
}

/** Goal / run line markets ("Over/Under 2.5 Goals", totals, handicaps). */
function isLineMarket(m: Market) {
  const name = `${m.marketName ?? ""} ${m.marketType ?? ""}`.toUpperCase();
  return /OVER|UNDER|TOTAL|HANDICAP|LINE/.test(name);
}

function EventBanner({
  sportId,
  eventName,
  openDate,
  inPlay,
  suspended,
}: {
  sportId: string;
  eventName: string;
  openDate?: string | undefined;
  inPlay?: boolean | undefined;
  suspended?: boolean | undefined;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const at = openDate ? Date.parse(openDate) : NaN;
  // Same as the reference: live countdown until the start, then "Bet Started".
  const left = Number.isFinite(at) ? Math.max(0, Math.floor((at - now) / 1000)) : 0;
  const started = inPlay || (Number.isFinite(at) && left === 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const banner = SPORT_BANNERS[sportId] ?? soccerBanner;
  const status = suspended ? "Suspended" : inPlay ? "Open" : "Upcoming";
  const gameTime = Number.isFinite(at)
    ? (() => {
        const d = new Date(at);
        const h = d.getHours() % 12 || 12;
        return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? "AM" : "PM"}`;
      })()
    : "—";
  const clock = `${left >= 86400 ? `${Math.floor(left / 86400)}d ` : ""}${pad(Math.floor((left % 86400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  if (sportId === "7" || sportId === "4339") {
    return (
      <div className="relative h-[90px] bg-gradient-to-b from-dx-race-sky to-dx-page px-2 pt-1.5 text-[0.78rem] font-bold text-dx-page" data-nobet="" data-event-banner="">
        <div className="flex items-start justify-between">
          <span data-banner-status="" className={`uppercase ${suspended ? "text-ex-suspend" : ""}`}>{suspended ? "Suspended" : "Open"}</span>
          <span className="text-dx-cash">Game time <span className="text-dx-page">{gameTime}</span></span>
        </div>
        <p className="mt-4 text-center">Time Remaining <span className="text-dx-cash">{clock}</span></p>
        <p className={`mt-2 text-center text-dx-cash ${started ? "" : "opacity-50"}`}>Bet Started</p>
      </div>
    );
  }
  return (
    <div className="relative h-[92px] overflow-hidden bg-dx-ink text-dx-page" data-nobet="" data-event-banner="">
      <img
        src={banner.url}
        alt=""
        aria-hidden="true"
        width={1536}
        height={512}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-dx-ink/55" />
      <div className="relative grid h-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3">
        <div className="min-w-0">
          <span
            data-banner-status=""
            className={`block text-[0.72rem] font-bold uppercase ${suspended ? "text-ex-suspend" : "text-dx-cash"}`}
          >
            {status}
          </span>
          <span className="line-clamp-2 text-[0.82rem] font-bold leading-tight">{eventName}</span>
        </div>
        <span className="shrink-0 text-right text-[0.68rem] font-semibold">
          <span className="block">Game time {gameTime}</span>
          <span className="block text-[0.95rem] font-bold text-dx-cash">
            {started
              ? "Bet Started"
              : `${sportId === "7" || sportId === "4339" ? "Time Remaining" : "Count Down"} ${left >= 86400 ? `${Math.floor(left / 86400)}d ` : ""}${pad(Math.floor((left % 86400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`}
          </span>
        </span>
      </div>
    </div>
  );
}

function TvIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M8 22h8" />
    </svg>
  );
}

function EventPage() {
  const { sportId, eventId } = Route.useParams();
  const [data, setData] = useState<OddsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const racePrices = useRef<Record<string, number>>({});
  const closedSince = useRef<number>(0);
  const marketSeen = useRef<Map<string, number>>(new Map());
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const inFlightSince = useRef(0);
  const lastSocketMessage = useRef(0);
  const feed = useRef(createFeedState());
  const [age, setAge] = useState(0);


  const load = useCallback(async () => {
    // Safety: if a previous request got stuck (network hang), force-release the
    // lock after 5s so the per-second updates never stop permanently.
    if (inFlight.current) {
      if (Date.now() - inFlightSince.current < 5000) return;
      inFlight.current = false;
    }
    inFlight.current = true;
    inFlightSince.current = Date.now();
    const currentRequest = ++requestId.current;
    try {
      const odds = await fetchOdds(sportId, eventId);
      if (currentRequest !== requestId.current) return;
      setData(mergeFeed(feed.current, odds));
      setAge(0);
      setError(null);
    } catch (e) {
      if (currentRequest !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load odds");
    } finally {
      inFlight.current = false;
    }
  }, [sportId, eventId]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      try {
        const url = await sportsSocketUrl(sportId, eventId);
        if (!active) return;
        socket = new WebSocket(url);
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(String(event.data)) as { type?: string; data?: OddsResponse };
            if (message.type !== "odds" || !message.data) return;
            lastSocketMessage.current = Date.now();
            setData(mergeFeed(feed.current, message.data));
            setAge(0);
            setError(null);
          } catch {
            // Ignore malformed provider frames and keep the HTTP fallback alive.
          }
        };
        socket.onclose = () => {
          if (active) reconnect = setTimeout(() => void connect(), 2000);
        };
        socket.onerror = () => socket?.close();
      } catch {
        if (active) reconnect = setTimeout(() => void connect(), 2000);
      }
    };

    lastSocketMessage.current = 0;
    void connect();
    void load();
    // WebSocket is the fastest source. HTTP automatically takes over whenever
    // socket updates stop, and the server then serves its last-good snapshot if
    // the provider itself is unavailable.
    // Always poll too: a socket can keep sending an old snapshot from a stale
    // server copy. mergeFeed keeps whichever frame is newest.
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, 150);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const a = setInterval(() => setAge((v) => v + 1), 1000);
    return () => {
      active = false;
      clearInterval(t);
      clearInterval(a);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (reconnect) clearTimeout(reconnect);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, [load, sportId, eventId]);



  const allMatchOdds = data?.matchOdds ?? [];
  // The provider ships goal/run lines inside the match-odds list; the
  // reference board shows them as their own Over/Under section.
  const matchOdds = allMatchOdds.filter((m) => !isLineMarket(m));
  const lines = allMatchOdds.filter(isLineMarket);
  const bookmakers = data?.bookmakers ?? [];
  const rawFancy = data?.fancy ?? [];
  // Finished sessions (the over already bowled, market settled/void) are
  // removed from the board, exactly like the reference book does.
  const fancy = rawFancy.filter((m) => {
    const raw = String(m.oddsData?.status ?? "").toUpperCase();
    if (/CLOSE|SETTLE|RESULT|REMOVED/.test(raw)) return false;
    const extra = m as unknown as { isSettlement?: number; isVoid?: number; isClosed?: number };
    return !extra.isSettlement && !extra.isVoid && !extra.isClosed;
  });

  // Totals / handicap markets arrive inside the sportsbook list too; the
  // reference board shows every one of them in the Over/Under section.
  const allSportsbook = data?.sportsbook ?? [];
  const sportsbook = allSportsbook.filter((m) => !isLineMarket(m));
  const sportsbookLines = allSportsbook.filter(isLineMarket);
  const overUnder = [...lines, ...sportsbookLines];


  // Every feed tick: if the upstream marks a runner WINNER / LOSER, settle
  // the matching open bets right away — result always comes from the feed.
  useEffect(() => {
    if (!data) return;
    const results: { label: string; won: boolean }[] = [];
    // Read result frames from the raw groups before closed markets are removed
    // from the visible board, otherwise a one-frame WINNER can be missed.
    for (const m of [...allMatchOdds, ...bookmakers, ...rawFancy, ...allSportsbook]) {
      const names = m.runnersData ?? {};
      for (const r of m.oddsData?.runners ?? []) {
        const st = String(r.status ?? "").toUpperCase();
        if (st !== "WINNER" && st !== "LOSER") continue;
        const label = names[String(r.selectionId)] ?? String(r.selectionId);
        results.push({ label, won: st === "WINNER" });
      }
    }
    settleFromRunners(`sports-${eventId}`, results);

    // Races: the feed never names a winner, but just before the market closes
    // the winning runner trades at ~1.01. Remember the last back price of each
    // runner in the WIN market so the close can settle from it.
    if (sportId === "7" || sportId === "4339") {
      const win = allMatchOdds[0];
      const names = win?.runnersData ?? {};
      const prices: Record<string, number> = {};
      for (const r of win?.oddsData?.runners ?? []) {
        const p = Number(r.price?.back?.[0]?.price ?? 0);
        if (p > 0) prices[names[String(r.selectionId)] ?? String(r.selectionId)] = p;
      }
      if (Object.keys(prices).length) racePrices.current = prices;
    }

    // A single session market can vanish without a published winner (the over
    // finished, the book removed it). Refund its open bets after 45s instead of
    // leaving the stake stuck forever.
    const all = [...matchOdds, ...overUnder, ...bookmakers, ...fancy, ...sportsbook];
    const now = Date.now();
    // Only session/fancy markets disappear as part of normal play. Main odds,
    // racing and tennis markets must never be refunded because of one slow frame.
    for (const m of fancy) {
      const name = (m.marketName ?? "").trim();
      if (name) marketSeen.current.set(name.toUpperCase(), now);
    }
    // Settle any fancy line the real score has already decided first.
    if (sportId === "4") {
      const track = readTrack(eventId);
      settleFancyLines(`sports-${eventId}`, (mk) => fancyResult(track, mk));
    }
    for (const [name, at] of marketSeen.current) {
      if (now - at < 120_000) continue;
      marketSeen.current.delete(name);
      voidOpenWhere(`sports-${eventId}`, (label) => label.toUpperCase().startsWith(name));
    }

    // Feed no longer serves any market for this event (match over / removed):
    // after 30s of an empty feed, refund whatever is still open.
    const live = all.length;
    if (live === 0) {
      if (!closedSince.current) closedSince.current = Date.now();
      else if (Date.now() - closedSince.current > (sportId === "4" ? 600_000 : 30_000)) {
        const side = sportId === "1" || sportId === "2" ? sideOutcome(eventId) : null;
        if (side) settleFromRunners(`sports-${eventId}`, side);
        if (sportId === "7" || sportId === "4339") {
          const entries = Object.entries(racePrices.current);
          const fav = entries.filter(([, p]) => p <= 1.1);
          if (fav.length === 1)
            settleFromRunners(`sports-${eventId}`, entries.map(([label]) => ({ label, won: label === fav[0]![0] })));
        }
        voidOpen(`sports-${eventId}`);
      }
      // Match is over: once nothing of ours is still waiting on it, leave the
      // page so a finished match never stays on screen.
      if (
        closedSince.current &&
        Date.now() - closedSince.current > 20_000 &&
        !readWallet().bets.some((b) => b.status === "open" && b.gameId === `sports-${eventId}`)
      ) {
        window.location.replace("/sports");
      }
    } else {
      closedSince.current = 0;
    }
  }, [data, eventId, sportId, allMatchOdds, bookmakers, rawFancy, allSportsbook, matchOdds, overUnder, fancy, sportsbook]);


  // Real fancy results: follow the live cricket score ball by ball and settle
  // each Yes/No line the moment its final number is known.
  useEffect(() => {
    if (sportId !== "4") return;
    let alive = true;
    const tick = async () => {
      const track = await pullScore(eventId);
      if (!alive || !track) return;
      settleFancyLines(`sports-${eventId}`, (mk) => fancyResult(track, mk));
      // Match over: the scoreboard names the winner — pay Match Odds /
      // Bookmaker bets from it (tie / no result refunds).
      const out = matchOutcome(track);
      if (out?.void) voidOpen(`sports-${eventId}`);
      else if (out) settleFromRunners(`sports-${eventId}`, out.results);
    };
    void tick();
    const t = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [sportId, eventId]);

  // Soccer / tennis: remember the live score so the final result can pay
  // Match Odds bets when the feed closes the event.
  useEffect(() => {
    if (sportId !== "1" && sportId !== "2") return;
    void pullSideScore(sportId, eventId);
    const t = window.setInterval(() => void pullSideScore(sportId, eventId), 5000);
    return () => window.clearInterval(t);
  }, [sportId, eventId]);

  // Dukex keeps the media panel closed until the TV icon is pressed.
  const [showTv, setShowTv] = useState(false);
  const [view, setView] = useState("All");

  if (!data && !error) return <AppLoader />;

  const marketCategories = new Map<string, string>();
  matchOdds.forEach((market) => marketCategories.set(market.marketId, "Match Odds"));
  bookmakers.forEach((market) => marketCategories.set(market.marketId, "Bookmaker"));
  fancy.forEach((market) => marketCategories.set(market.marketId, "Fancy"));
  sportsbook.forEach((market) => marketCategories.set(market.marketId, "Sportsbook"));
  overUnder.forEach((market) => marketCategories.set(market.marketId, market.marketName.trim()));
  const views = [
    "All",
    "Popular",
    ...(matchOdds.length ? ["Match Odds"] : []),
    ...(bookmakers.length ? ["Bookmaker"] : []),
    ...(fancy.length ? ["Fancy"] : []),
    ...(sportsbook.length ? ["Sportsbook"] : []),
    ...Array.from(new Set(overUnder.map((market) => market.marketName.trim()))),
  ];
  const pick = (m: Market) =>
    view === "All" ||
    (view === "Popular" && isPopularMarket(m)) ||
    view === marketCategories.get(m.marketId) ||
    view === marketGroupName(m) ||
    view === m.marketName.trim();
  const visibleFancy = fancy.filter(pick);
  const visibleSportsbook = sportsbook.filter(pick);
  const showFancy = visibleFancy.length > 0 || visibleSportsbook.length > 0;
  const hasPanels = !eventId.startsWith("sf:");
  const isRace = sportId === "7" || sportId === "4339";
  const hasTv = hasPanels && data?.tv !== false;
  const hasScoreboard =
    hasPanels && (data?.isScore === true || (data?.isScore !== false && ["1", "2", "4"].includes(sportId)));

  return (
    <div className="sports-theme mx-auto max-w-[1200px] bg-dx-page pb-6">
      {isRace && hasPanels && !showTv ? (
        <EventBanner
          sportId={sportId}
          eventName={data?.eventName ?? SPORT_NAMES[sportId] ?? "Live event"}
          openDate={data?.openDate ?? (allMatchOdds[0] as { eventTime?: string } | undefined)?.eventTime}
          inPlay={data?.inPlay}
          suspended={matchOdds.length > 0 && matchOdds.every((m) => marketState(m).dim)}
        />
      ) : null}
      {isRace ? (
        <div className="relative flex h-[36px] items-center justify-center bg-dx-bar text-[1rem] font-bold text-dx-page">
          {SPORT_NAMES[sportId] ?? "Racing"}
          {hasTv ? (
            <button
              type="button"
              aria-label={showTv ? "Close live TV" : "Open live TV"}
              aria-expanded={showTv}
              onClick={() => setShowTv((v) => !v)}
              className="absolute right-3 text-dx-page"
            >
              <TvIcon />
            </button>
          ) : null}
        </div>
      ) : (<>
      <div className="relative flex h-[34px] items-center justify-center bg-dx-bar text-[0.95rem] font-bold text-dx-page">
        <Link to="/sports" className="absolute left-3 text-[0.8rem] font-semibold text-dx-page/80">
          ‹ Back
        </Link>
        <span className="max-w-[70%] truncate">
          {SPORT_NAMES[sportId] ?? `Sport ${sportId}`}
          {data?.eventName ? ` > ${data.eventName}` : ""}
        </span>
        {hasTv ? (
          <button
            type="button"
            aria-label={showTv ? "Close live TV" : "Open live TV"}
            aria-expanded={showTv}
            onClick={() => setShowTv((v) => !v)}
            className={`absolute right-3 ${showTv ? "text-dx-cash" : "text-ex-suspend"}`}
          >
            <TvIcon />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-dx-rule px-2 py-1.5">
        <h1 className="min-w-0 truncate text-[0.82rem] font-bold text-dx-ink">
          {data?.eventName ?? "Loading event…"}
        </h1>
        <span className="flex shrink-0 items-center gap-2">
          {data?.inPlay ? (
            <span className="text-[0.68rem] font-bold text-ex-inplay">In-Play</span>
          ) : null}
          <BalanceChip />
        </span>
      </div>
      </>)}

      {error || data?.stale ? (
        <p className="px-2 py-1 text-[0.7rem] text-ex-suspend">Feed reconnecting… showing last prices</p>
      ) : null}

      {!isRace && hasPanels && !showTv ? (
        <EventBanner
          sportId={sportId}
          eventName={data?.eventName ?? SPORT_NAMES[sportId] ?? "Live event"}
          openDate={data?.openDate ?? (allMatchOdds[0] as { eventTime?: string } | undefined)?.eventTime ?? (bookmakers[0] as { eventTime?: string } | undefined)?.eventTime}
          inPlay={data?.inPlay}
          suspended={matchOdds.length > 0 && matchOdds.every((m) => marketState(m).dim)}
        />
      ) : null}

      {hasTv && showTv ? (
        <div className="grid gap-0 lg:grid-cols-2" data-nobet="">
          <div className="overflow-hidden bg-dx-ink">
            <LiveTv sportId={sportId} eventId={eventId} className="overflow-hidden bg-dx-ink" />
          </div>
          {data?.inPlay && hasScoreboard ? (
            <div className="overflow-hidden bg-dx-ink">
              <Scoreboard sportId={sportId} eventId={eventId} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-1.5 overflow-x-auto px-1 py-1.5">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-[0.8rem] font-semibold text-dx-page ${
              isRace
                ? view === v ? "bg-dx-race-active" : "bg-dx-race-pill"
                : view === v ? "bg-dx-pill-active" : "bg-dx-pill"
            }`}
          >
            {isRace && v === "Match Odds" ? (matchOdds[0]?.marketName.trim() ?? v) : v}
          </button>
        ))}
      </div>

      <BetLayer
        gameId={`sports-${eventId}`}
        gameName={data?.eventName ?? `Event ${eventId}`}
        round={eventId}
        exposureLayout="sports"
      >
        <div>
          {matchOdds.filter(pick).map((m) => <Board key={m.marketId} market={m} race={sportId === "7" || sportId === "4339"} />)}
          {bookmakers.filter(pick).map((m) => <Board key={m.marketId} market={m} book />)}
          {showFancy ? (
            <FancySection markets={visibleFancy} sportsbook={visibleSportsbook} />
          ) : null}
          {overUnder.filter(pick).map((m) => <Board key={m.marketId} market={m} />)}
          {data && !matchOdds.length && !bookmakers.length && !fancy.length && !sportsbook.length && !overUnder.length ? (
            <p className="px-2 py-6 text-center text-[0.8rem] text-ex-muted">No open markets right now.</p>
          ) : null}
          <p className="px-2 pt-1 text-right text-[0.6rem] text-ex-muted">
            updated {age}s ago · delay {data?.betDelay ?? 0}s
          </p>
        </div>
      </BetLayer>
    </div>
  );
}
