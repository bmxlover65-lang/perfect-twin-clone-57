import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Aviator } from "@/components/Aviator";
import { applyOverride, useAdminConfig } from "@/lib/admin";
import { logResult } from "@/lib/telemetry";
import { BalanceChip, BetLayer, MyBets } from "@/components/betting";
import { settleRound } from "@/lib/wallet";
import { CoinStageImage, HeadsTailsPanel } from "@/components/HeadsTails";
import dream1x from "@/assets/dream/dream1x.png.asset.json";
import dream2x from "@/assets/dream/dream2x.png.asset.json";
import dream5x from "@/assets/dream/dream5x.png.asset.json";
import dream10x from "@/assets/dream/dream10x.png.asset.json";
import dream20x from "@/assets/dream/dream20x.png.asset.json";
import dream40x from "@/assets/dream/dream40x.png.asset.json";

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

const OPEN_STATUSES = new Set(["ONLINE", "ACTIVE", "OPEN", "IN_PLAY"]);
function isOpenStatus(status?: string | null) {
  return OPEN_STATUSES.has((status ?? "").toUpperCase());
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

  const Overlay = () => (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/65">
      <span className="text-lg font-extrabold uppercase tracking-wide text-white">Suspended</span>
    </div>
  );

  const winnerSusp = groupSuspended([...winner, ...(tie ? [tie] : [])]);
  const pairSusp = groupSuspended(pair);

  return (
    <div className="mt-3 space-y-3">
      <p className="text-right text-[0.72rem] font-semibold text-ex-muted">
        Min/Max: {mm?.min ?? 0} - {mm?.max ?? 0}
      </p>
      <div className="relative flex items-stretch overflow-hidden rounded-xl">
        {winner.map((r, i) => (
          <div
            key={r.id}
            className={`flex flex-1 items-center justify-center py-7 ${tone(r.label)} ${
              i === 0 ? "rounded-l-xl" : "rounded-r-xl"
            }`}
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
      <div className="relative grid grid-cols-2 gap-4">
        {pair.map((r) => (
          <div
            key={r.id}
            className={`flex items-center justify-center rounded-xl py-4 ${tone(r.label)}`}
          >
            <Body r={r} />
          </div>
        ))}
        {pairSusp ? <Overlay /> : null}
      </div>
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
  const Plate = ({
    price,
    size,
    locked,
  }: {
    price?: number | null | undefined;
    size?: number | null | undefined;
    locked: boolean;
  }) => (
    <div
      className={`flex h-[55px] w-[215px] -skew-x-[18deg] items-center justify-center rounded-[2px] shadow-[0_2px_5px_rgba(0,0,0,0.25)] ${
        locked
          ? "bg-gradient-to-b from-[#c9d4cf] to-[#b5c2bc]"
          : "bg-gradient-to-br from-[#1a7f5a] to-[#0b5c3c]"
      }`}
    >
      <div className="skew-x-[18deg] text-center leading-tight">
        <p className={`text-[1.15rem] font-extrabold ${locked ? "text-white/70" : "text-[#16261f]"}`}>
          {fmtOdds(price)}
        </p>
        <p className="text-[0.62rem] font-semibold text-[#16261f]/55">{fmtSize(size)}</p>
      </div>
    </div>
  );

  return (
    <div className="mt-3 bg-[#ececec]">
      <div className="flex items-center justify-between gap-4 px-3 py-4">
        {["PLAYER A", "PLAYER B"].map((n) => (
          <div
            key={n}
            className="flex h-[68px] w-[250px] items-center justify-center rounded-[4px] bg-gradient-to-br from-[#1a7f5a] to-[#0b5c3c] text-[1.05rem] font-extrabold tracking-wide text-[#16261f] shadow-[0_2px_5px_rgba(0,0,0,0.25)]"
          >
            {n}
          </div>
        ))}
      </div>

      <div>
        {markets.map((m) => {
          const names = m.runnersName ?? {};
          const runners = m.runners ?? [];
          const a = runners.find((r) => (names[String(r.selectionId)] ?? "").toUpperCase().includes("A"));
          const b = runners.find((r) => (names[String(r.selectionId)] ?? "").toUpperCase().includes("B"));
          const isSusp =
            suspended ||
            runners.every((r) => !isOpenStatus(r.status));
          return (
            <div
              key={m.marketId}
              className={`relative border-t border-[#c9c9c9] px-3 pb-6 pt-0 ${
                isSusp ? "rounded-[14px] border border-[#e0403f]" : ""
              }`}
            >
              <div className="flex justify-center">
                <div className="flex h-[42px] w-[305px] items-center justify-center gap-1.5 rounded-b-[22px] bg-white text-[0.82rem] font-extrabold uppercase tracking-wide text-[#333] shadow-[0_3px_5px_rgba(0,0,0,0.18)]">
                  {m.marketName}
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#5b8dab] text-[0.6rem] font-bold text-white">
                    i
                  </span>
                </div>
              </div>
              <div className="relative -mt-5 flex items-center justify-between">
                <Plate
                  price={a?.price?.back?.[0]?.price}
                  size={a?.price?.back?.[0]?.size}
                  locked={isSusp}
                />
                <Plate
                  price={b?.price?.back?.[0]?.price}
                  size={b?.price?.back?.[0]?.size}
                  locked={isSusp}
                />
                {isSusp ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <span className="text-[1.35rem] font-extrabold uppercase leading-none text-[#e0201c]">
                      Suspended
                    </span>
                  </div>
                ) : null}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}


function MarketBoard({ market, suspended }: { market: CasinoMarket; suspended: boolean }) {
  const names = market.runnersName ?? {};
  const runners = market.runners ?? [];
  const hasLay = runners.some((r) => Boolean(r.price?.lay?.[0]?.price));
  const cols = hasLay ? "grid-cols-[1fr_130px_130px]" : "grid-cols-[1fr_130px]";



  const cell = (
    p: { price?: number | null; size?: number | null } | undefined,
    side: "back" | "lay",
    runnerOpen: boolean,
  ) => {
    const locked = !runnerOpen || !p?.price;
    return (
      <div
        className={`relative m-[3px] flex h-[46px] flex-col items-center justify-center ${
          side === "back" ? "bg-[#72BBEF]" : "bg-[#F9C9D4]"
        }`}
      >
        <span className="text-sm font-bold leading-none text-[#111]">{fmtOdds(p?.price)}</span>
        <span className="mt-0.5 text-[0.66rem] font-semibold text-[#111]/70">
          {fmtSize(p?.size)}
        </span>
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/45 text-sm">
            🔒
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mt-3 overflow-hidden border border-[#d9d9d9] bg-white">
      <header className="bg-black px-2 py-1">
        <h3 className="text-[0.78rem] font-extrabold uppercase tracking-[0.04em] text-white">
          {market.marketName}
        </h3>
      </header>
      <div className="relative">
        <div className={`grid ${cols} items-center bg-white`}>
          <span className="px-2 py-1 text-[0.75rem] font-bold text-[#1f4b66]">
            Min/Max{" "}
            <span className="font-semibold text-[#8a9199]">
              {market.min ?? 0} - {market.max ?? 0}
            </span>
          </span>
          <span className="py-1 text-center text-[0.75rem] font-bold text-[#1f4b66]">Back</span>
          {hasLay ? (
            <span className="py-1 text-center text-[0.75rem] font-bold text-[#1f4b66]">Lay</span>
          ) : null}
        </div>
        {runners.map((r) => {
          const runnerOpen = !suspended && isOpenStatus(r.status ?? "ONLINE");
          return (
            <div
              key={String(r.selectionId)}
              className={`grid items-center border-t border-[#e6e6e6] ${cols}`}
            >
              <span className="truncate px-2 py-2 text-[0.82rem] font-bold uppercase text-[#1f4b66]">
                {names[String(r.selectionId)] ?? String(r.selectionId)}
              </span>
              {cell(r.price?.back?.[0], "back", runnerOpen)}
              {hasLay ? cell(r.price?.lay?.[0], "lay", runnerOpen) : null}
            </div>
          );
        })}
        {suspended ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/55">
            <span className="text-2xl font-extrabold uppercase tracking-wide text-[#5b6670]">
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
        <span className={r.open ? "" : "opacity-50"}>{fmtOdds(r.price)}</span>
        {!r.open ? <span className="absolute text-base">🔒</span> : null}
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
            <div key={r.id} className="w-[48px] text-center">
              <div className="relative flex h-[52px] flex-col items-center justify-center rounded-[2px] bg-gradient-to-b from-[#d9d9d9] to-[#a8a8a8] text-[1.15rem] font-extrabold text-[#111]">
                {rank}
                <span className="absolute bottom-0.5 left-0.5 text-[0.6rem] text-[#111]">♣ ♠</span>
                <span className="absolute bottom-0.5 right-0.5 text-[0.6rem] text-[#E0393B]">♥ ♦</span>
                {!r.open ? (
                  <span className="absolute inset-0 flex items-center justify-center text-base">🔒</span>
                ) : null}
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
    <span className="inline-flex h-[46px] w-[34px] flex-col items-center justify-center rounded-[2px] border border-[#E3C96B] bg-white leading-none">
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
    <div className="mt-3 space-y-2 bg-white p-1">
      {markets.map((m, mi) => {
        const names = m.runnersName ?? {};
        const runners = m.runners ?? [];
        const allClosed =
          runners.length > 0 && runners.every((r) => suspended || !isOpenStatus(r.status));
        return (
          <div key={`${m.marketId}-${mi}`} className="border border-[#d9d9d9]">
            <div className="flex items-center justify-between bg-black px-2 py-[4px]">
              <span className="text-[0.8rem] font-extrabold uppercase tracking-wide text-white">
                {m.marketName}
              </span>
              <span className="text-[0.78rem] font-bold text-white">
                Min/Max: {m.min ?? 100} - {m.max ?? 100000}
              </span>
            </div>
            <div className="relative">
              {runners.map((r, i) => (
                <div
                  key={`${r.selectionId}-${i}`}
                  className={`flex items-stretch ${i ? "border-t border-[#ededed]" : ""}`}
                >
                  <div className="flex min-h-[44px] flex-1 items-center px-2 py-1">
                    <Label text={names[String(r.selectionId)] ?? String(r.selectionId)} />
                  </div>
                  <div className="flex w-[105px] flex-col items-center justify-center bg-[#B7DBF5] leading-tight">
                    <span className="text-[0.85rem] text-[#111]">
                      {fmtOdds(r.price?.back?.[0]?.price)}
                    </span>
                    <span className="text-[0.75rem] text-[#111]">
                      {fmtSize(r.price?.back?.[0]?.size)}
                    </span>
                  </div>
                  <div className="w-[105px] border-l border-[#ededed] bg-white" />
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
        <span className="inline-flex h-[42px] w-[32px] flex-col items-center justify-center rounded-[3px] border border-[#E3C96B] bg-white leading-none shadow-sm">
          <span className="text-[0.95rem] font-bold" style={{ color: suitColor(kingSuit) }}>K</span>
          <span className="text-[0.9rem]" style={{ color: suitColor(kingSuit) }}>{kingSuit}</span>
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
    <div className="mt-3 space-y-2 rounded-[4px] bg-white p-2">
      {markets.map((m, mi) => {
        const names = m.runnersName ?? {};
        const runners = m.runners ?? [];
        const allClosed = runners.every((r) => suspended || !isOpenStatus(r.status));
        return (
          <div key={`${m.marketId}-${mi}`} className="border border-[#d9d9d9]">
            <div className="flex items-center justify-between bg-black px-2 py-[5px]">
              <span className="text-[0.85rem] font-extrabold uppercase tracking-wide text-white">
                {m.marketName}
              </span>
              <span className="text-[0.72rem] font-bold text-white">
                Min/Max: {m.min ?? 100} - {m.max ?? 100000}
              </span>
            </div>
            <div className="relative">
              {runners.map((r, i) => {
                const open = !suspended && isOpenStatus(r.status);
                const label = names[String(r.selectionId)] ?? String(r.selectionId);
                return (
                  <div
                    key={`${r.selectionId}-${i}`}
                    className={`flex items-stretch ${i ? "border-t border-[#e6e6e6]" : ""}`}
                  >
                    <div className="flex min-h-[42px] flex-1 items-center px-2 py-1">
                      <Label text={label} />
                    </div>
                    <div className="flex w-[134px] items-center justify-center border-l border-[#e6e6e6] p-1">
                      {open ? (
                        <div className="flex h-[38px] w-full flex-col items-center justify-center bg-[#72BBEF] leading-none">
                          <span className="text-[0.95rem] font-bold text-[#111]">
                            {fmtOdds(r.price?.back?.[0]?.price)}
                          </span>
                          <span className="text-[0.68rem] text-[#111]">
                            {r.price?.back?.[0]?.size ?? ""}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-[38px] w-full items-center justify-center border-2 border-[#E01B24] bg-white">
                          <span className="text-[0.78rem] font-bold uppercase text-[#E01B24]">
                            Suspended
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="w-[134px] border-l border-[#e6e6e6]" />
                  </div>
                );
              })}
              {allClosed && runners.length ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-[268px]">
                  <span className="text-[1.6rem] font-extrabold uppercase tracking-wide text-[#9aa0a6]">
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
    <div className="bg-black px-2 py-[5px] text-[0.85rem] font-extrabold uppercase tracking-wide text-white">
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
    <div className="mt-3 space-y-2 rounded-[4px] bg-white p-2">
      {winner ? (
        <div className="border border-[#d9d9d9]">
          <Header name="WINNER" />
          <div className="flex items-stretch bg-white">
            <div className="flex-1 p-1">
              <div className="flex h-[22px] items-center justify-center bg-[#dbe9f2] text-[0.7rem] font-bold text-[#9fb6c4]">
                Min/Max: {winner.min ?? 100} - {winner.max ?? 100000}
              </div>
            </div>
            <div className="flex w-[124px] items-center justify-center bg-[#72BBEF] text-[0.85rem] font-semibold text-white/80">
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
            {suspended ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-[248px]">
                <span className="text-[1.5rem] font-extrabold uppercase tracking-wide text-[#9aa0a6]/85">
                  Suspended
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {sides.map((m, mi) => {
          const runners = m.runners ?? [];
          const closed = runners.every((r) => suspended || !isOpenStatus(r.status));
          return (
            <div key={`${m.marketId}-${mi}`} className="border border-[#d9d9d9]">
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
        <div className="border border-[#d9d9d9]">
          <Header name="CARD" />
          <div className="flex items-stretch">
            <div className="flex-1 p-1">
              <MinMax m={card} />
            </div>
            <div className="flex w-[248px] items-center justify-center bg-[#9ED2F0] text-[0.85rem] font-semibold text-white/85">
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
                    <span className="inline-flex h-[42px] w-[34px] flex-col items-center justify-center rounded-[3px] border border-[#E3C96B] bg-white leading-none">
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
            {suspended ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-[248px]">
                <span className="text-[1.5rem] font-extrabold uppercase tracking-wide text-[#9aa0a6]/85">
                  Suspended
                </span>
              </div>
            ) : null}
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
    { v: "1k", src: chip1k.url },
    { v: "5k", src: chip5.url },
    { v: "10k", src: chip10.url },
    { v: "25k", src: chip20.url },
    { v: "50k", src: chip50.url },
    { v: "100k", src: chip100.url },
    { v: "200k", src: chip200.url },
    { v: "500k", src: chip500.url },
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
      <div className="mt-4 flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
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

const PANEL_CHIPS: { v: string; src: string }[] = [
  { v: "1k", src: chip1k.url },
  { v: "5k", src: chip5.url },
  { v: "10k", src: chip10.url },
  { v: "25k", src: chip20.url },
  { v: "50k", src: chip50.url },
  { v: "100k", src: chip100.url },
  { v: "200k", src: chip200.url },
  { v: "500k", src: chip500.url },
];

function ChipRow() {
  const [sel, setSel] = useState("1k");
  return (
    <div className="mt-3 flex flex-nowrap items-center gap-3 overflow-x-auto rounded-b-[6px] bg-[#1F1F1F] px-3 py-2">
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
              className={`relative inline-flex h-[52px] w-[52px] items-center justify-center rounded-full transition-all ${
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
            <span className="text-[0.8rem] font-bold text-white">{c.v}</span>
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

  const Tile = ({ t }: { t: Tile }) => {
    const note = dream ? DREAM_NOTE[t.label.trim()] : undefined;
    if (note) {
      return (
        <div className="relative flex flex-col items-center rounded-[10px] border border-white/5 bg-[#1E3D2B] px-2 py-3">
          <img
            src={note}
            alt={`${t.label}x`}
            className="h-[58px] w-auto select-none object-contain"
            draggable={false}
          />
          <span className="mt-2 text-[1.5rem] font-extrabold leading-none text-white">
            {t.price ? t.price.toFixed(0) : "—"}
          </span>
          <span className="mt-1 text-[1.05rem] font-bold leading-none text-white/90">
            {t.size ? Math.round(t.size) : "—"}
          </span>
          {!t.open ? (
            <div className="absolute inset-0 rounded-[10px] bg-black/55" />
          ) : null}
        </div>
      );
    }
    return (
      <div
        className={`relative flex h-[68px] flex-col items-center justify-center rounded-[6px] border border-white/10 ${
          (dream ? DREAM_TONE[t.label.trim()] : undefined) ?? tileTone(t.label)
        }`}
      >
        <span className="text-[1.1rem] font-extrabold leading-none">{t.label}</span>
        <span className="mt-1 text-[0.72rem] font-bold leading-none">
          {t.price ? t.price.toFixed(2) : "—"}
        </span>
        <span className="mt-[3px] text-[0.66rem] font-semibold leading-none opacity-60">
          {t.size ? Math.round(t.size) : ""}
        </span>
        {!t.open ? <div className="absolute inset-0 rounded-[6px] bg-black/45" /> : null}
      </div>
    );
  };


  const main = toTiles(winner);
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
      <p className="mb-1 text-[1.05rem] font-extrabold text-[#111]">{fmtOdds(price)}</p>
      <div className="relative flex h-[62px] items-center justify-center rounded-xl bg-[#0D3B2B] px-4">
        <span className="text-[1rem] font-bold uppercase text-white/55">{label}</span>
        {r && !r.open ? <Lock /> : null}
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
  const { gameId } = Route.useParams();
  const { admin, cfg } = useAdminConfig();
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


  useEffect(() => {
    let alive = true;
    const run = () =>
      fetchCasinoResults(gameId)
        .then((r) => alive && setResults(r.data ?? []))
        .catch(() => undefined);
    void run();
    const t = setInterval(run, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [gameId, roundKey]);


  useEffect(() => {
    fetchCasinoStream(gameId)
      .then((r) => setStream(r.upstreamIframeUrl ?? null))
      .catch(() => undefined);
  }, [gameId]);

  const d = state?.data ?? null;
  const status = (d?.status ?? "").toUpperCase();
  const suspended = status ? !isOpenStatus(status) : false;
  const markets = d?.marketArr ?? [];
  const cards = (d?.cardsArr ?? {}) as Record<string, Record<string, string>>;

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
      <div className="mx-auto max-w-[900px] px-4 py-5">
        <div className="bg-[#EDEDED] px-3 py-2">
          <Link to="/" className="text-sm text-[#2563EB] hover:underline">
            ← Back to lobby
          </Link>
        </div>
        <div className="flex items-center justify-between bg-[#2E4B5C] px-3 py-2">
          <span className="text-[0.95rem] font-bold uppercase text-white">
            {d?.eventName ?? "Ball By Ball"}
          </span>
          <span className="text-[0.85rem] font-bold text-white">{d?.roundId ?? "—"}</span>
        </div>
        <img
          src={ballByBallBanner.url}
          alt="Ball by Ball"
          loading="lazy"
          className="block w-full"
        />
        <BallByBallBoard
          runners={raw.runners ?? []}
          min={raw.min ?? 100}
          max={raw.max ?? 100000}
          news={raw.news}
        />
        <RecentStrip results={results} />
      </div>
    );
  }

  if (gameId === "88.0030") {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-5">
        <Link to="/" className="text-sm text-[#2563EB] hover:underline">
          ← Back to lobby
        </Link>
        <p className="mt-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Live · Universe Original
        </p>
        <h1 className="text-[1.35rem] font-extrabold uppercase text-foreground">Aviator</h1>
        <div className="mt-2">
          <Aviator />
        </div>
      </div>
    );
  }

  if (isOriginal) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-5">
        <Link to="/" className="text-sm text-[#2563EB] hover:underline">
          ← Back to lobby
        </Link>
        <p className="mt-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Live · Universe Original
        </p>
        <h1 className="text-[1.35rem] font-extrabold uppercase text-foreground">
          {d?.eventName ?? "Loading game…"}
        </h1>
        <p className="mt-1 text-[0.8rem] font-bold text-foreground/80">
          RID: {d?.roundId ?? "—"}
        </p>

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

        {gameId === "88.0021" ? (
          <div className="mt-2">
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


        {gameId !== "88.0023" ? (
          <RecentStrip results={results} dream={gameId === "88.0020"} />
        ) : null}
      </div>
    );
  }

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

      {gameId === "99.0014" && markets.length ? (
        <MuflisPanel markets={markets} suspended={suspended} />
      ) : (gameId === "99.0018" || gameId === "99.0019") && markets.length ? (
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




      ) : (
        markets.map((m, i) => (
          <MarketBoard key={`${m.marketId}-${i}`} market={m} suspended={suspended} />
        ))
      )}


      {!markets.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading live markets…</p>
      ) : null}

      <RecentStrip results={results} />

    </div>
  );
}


function RecentStrip({ results, dream }: { results: CasinoResult[]; dream?: boolean }) {
  return (
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md bg-ex-panel px-3 py-2">
        <span className="mr-1 text-base font-bold text-ex-text">Recent Result</span>
        {results.slice(0, 10).map((r, idx) => {
          const rr = r as CasinoResult & { result?: string; selectionName?: string };
          const raw = (rr.winner ?? rr.result ?? rr.selectionName ?? "-").toString().trim();
          const w = /^EXTRA/i.test(raw)
            ? "EX"
            : /^WICKET/i.test(raw)
              ? "W"
              : (raw.match(/^\d+/)?.[0] ?? raw);
          const lower = w.toLowerCase();
          const isTie = lower.startsWith("tie") || lower.startsWith("draw");
          const isNum = /^\d+$/.test(w);
          const first = isTie ? "Tie" : isNum ? w : w.slice(0, 1).toUpperCase();
          const tone = isNum
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

          const finalTone = (dream ? DREAM_TONE[first] : undefined) ?? tone;

          return (
            <span
              key={`${r.roundId ?? ""}-${idx}`}
              title={`Round ${r.roundId}`}
              className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-bold ${finalTone}`}
            >
              {first || "-"}
            </span>
          );
        })}
      </div>
  );
}
