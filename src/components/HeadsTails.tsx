import { useEffect, useRef, useState } from "react";
import { RoundTimer } from "@/components/RoundTimer";
import headsCoin from "@/assets/coin/heads.png.asset.json";
import tailsCoin from "@/assets/coin/tails.png.asset.json";
import coinSound from "@/assets/coin/coinsound.mp3.asset.json";
import headWinSound from "@/assets/coin/headwin.mp3.asset.json";
import tailWinSound from "@/assets/coin/tailwin.mp3.asset.json";
import chip1k from "@/assets/chips/chips1k.svg.asset.json";
import chip5 from "@/assets/chips/chips5.svg.asset.json";
import chip10 from "@/assets/chips/chips10.svg.asset.json";
import chip20 from "@/assets/chips/chips20.svg.asset.json";
import chip50 from "@/assets/chips/chips50.svg.asset.json";
import chip100 from "@/assets/chips/chips100.svg.asset.json";
import chip200 from "@/assets/chips/chips200.svg.asset.json";
import chip500 from "@/assets/chips/chips500.svg.asset.json";

const CHIPS = [
  { v: "100", amount: 100, src: chip1k.url },
  { v: "200", amount: 200, src: chip5.url },
  { v: "500", amount: 500, src: chip10.url },
  { v: "1k", amount: 1000, src: chip20.url },
  { v: "10k", amount: 10000, src: chip50.url },
  { v: "25k", amount: 25000, src: chip100.url },
  { v: "50k", amount: 50000, src: chip200.url },
  { v: "100k", amount: 100000, src: chip500.url },
];

export type CoinSide = "HEADS" | "TAILS";

export function CoinStageImage({
  winner,
  roundId,
  suspended,
  leftSec,
}: {
  winner: CoinSide | null;
  roundId?: string | undefined;
  suspended: boolean;
  leftSec?: number | undefined;
}) {
  const [flipping, setFlipping] = useState(false);
  const [shown, setShown] = useState<CoinSide>("HEADS");
  const flipKey = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const play = (url: string) => {
    try {
      const a = new Audio(url);
      a.volume = 0.6;
      void a.play().catch(() => undefined);
    } catch {
      /* autoplay blocked */
    }
  };

  useEffect(() => {
    if (!suspended || !winner || !roundId) return;
    if (flipKey.current === roundId) return;
    flipKey.current = roundId;
    setShown("HEADS");
    setFlipping(true);
    play(coinSound.url);
    const stop = window.setTimeout(() => {
      setFlipping(false);
      setShown(winner);
      play(winner === "HEADS" ? headWinSound.url : tailWinSound.url);
    }, 2000);
    timers.current.push(stop);
    return () => window.clearTimeout(stop);
  }, [suspended, winner, roundId]);

  useEffect(() => {
    if (!flipping && winner && !suspended) setShown(winner);
  }, [flipping, winner, suspended]);

  return (
    <div className="relative flex w-full items-center justify-center overflow-hidden bg-black py-2">
      {roundId ? (
        <span className="pointer-events-none absolute left-1 top-1 z-20 bg-black/45 px-1.5 py-1 text-[0.63rem] font-extrabold text-white/90">
          RID: {roundId}
        </span>
      ) : null}
      <div className="my-8 h-[min(350px,89vw)] w-[min(350px,89vw)]" style={{ perspective: 900 }}>
        <div
          className={`coin-flipper relative h-full w-full ${flipping ? (winner === "TAILS" ? "coin-flip-tails" : "coin-flip-heads") : ""}`}
          data-face={shown.toLowerCase()}
        >
          <img
            src={headsCoin.url}
            alt="Heads coin"
            className="coin-face absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)]"
            draggable={false}
          />
          <img
            src={tailsCoin.url}
            alt="Tails coin"
            className="coin-face coin-back absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)]"
            draggable={false}
          />
        </div>
      </div>
      <RoundTimer leftSec={leftSec} suspended={suspended || flipping} className="absolute right-1 top-1 z-20" size="h-[50px] w-[50px]" />
      {!flipping && suspended && winner ? (
        <span className="coin-winner absolute left-1/2 top-1/2 z-20 -translate-x-1/2 rounded-[12px] bg-gradient-to-b from-[#FD8F3B] to-[#FD3523] px-5 py-2 text-[1.18rem] font-extrabold uppercase text-white shadow-lg">
          {winner} wins
        </span>
      ) : null}
    </div>
  );
}


export type CoinRunner = {
  id: string;
  label: string;
  price?: number | undefined;
  size?: number | undefined;
  open: boolean;
};

function formatOdds(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

function Plate({
  r,
  selected,
  onClick,
}: {
  r: CoinRunner;
  selected: boolean;
  onClick: () => void;
}) {
  const heads = r.label.toUpperCase().startsWith("H");
  const base =
    "coin-bet-plate relative flex h-[72px] flex-col items-center justify-center overflow-hidden rounded-[6px] border p-1.5 text-white shadow-[0_2px_7px_rgba(103,130,139,0.9)] transition-transform active:scale-[0.98]";
  const theme = heads
    ? "border-[#C4B5FD] bg-gradient-to-b from-[#A78BFA] to-[#7C3AED]"
    : "border-[#93C5FD] bg-gradient-to-b from-[#60A5FA] to-[#2563EB]";
  const innerBg = heads ? "bg-[#5B21B6]/55" : "bg-[#1E40AF]/55";
  const barBg = heads ? "bg-[#4C1D95]/80" : "bg-[#1E3A8A]/80";

  return (
    <button
      type="button"
      data-market-option=""
      data-market-plate=""
      data-bet-label={r.label}
      data-bet-odds={r.price ?? undefined}
      data-suspended={r.open ? undefined : "true"}
      onClick={onClick}
      className={`${base} ${theme} ${selected ? "ring-2 ring-[#F2C500]" : ""}`}
    >
      {/* decorative side dots */}
      <span className="pointer-events-none absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/60" />
      <span className="pointer-events-none absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/60" />

      <div className={`grid h-[38px] w-[96px] place-items-center rounded-full ${innerBg} px-4 shadow-inner`}>
        <span className="text-center text-[0.9rem] font-black leading-tight tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          {r.label.toUpperCase()}
        </span>
      </div>

      <div className={`mt-1.5 flex w-full items-center justify-center rounded py-1 ${barBg}`}>
        <span className="text-[1rem] font-black leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          {formatOdds(r.price)}
        </span>
      </div>

      {!r.open ? (
        <span className="absolute inset-0 z-10 grid place-items-center bg-black/40">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-label="Locked">
            <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            <rect x="5" y="10" width="14" height="11" rx="2" fill="white" />
            <circle cx="12" cy="15" r="1.5" fill="#243849" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}

export function HeadsTailsPanel({
  runners,
  min,
  max,
  recent,
}: {
  runners: CoinRunner[];
  min: number;
  max: number;
  recent?: string[];
}) {
  const [chip, setChip] = useState("1k");
  const [selected, setSelected] = useState<string | null>(null);

  const recentItems = (recent ?? [])
    .slice(0, 10)
    .map((r) => {
      const raw = r.toString().trim().toUpperCase();
          if (raw.startsWith("T")) return { key: "T", tone: "border-[#273C68] bg-[#0F1626] text-[#6198FF]" };
          if (raw.startsWith("H")) return { key: "H", tone: "border-[#533668] bg-[#1F1426] text-[#CC85FF]" };
      return { key: raw.slice(0, 1), tone: "bg-white/20 text-white" };
    });

  return (
    <div className="bg-black p-2">
      <p className="mb-2 text-right text-[0.62rem] font-semibold text-white/55">
        Min:{min} Max:{max}
      </p>
       <div className="grid grid-cols-2 gap-[11px]">
        {runners.map((r) => (
          <Plate
            key={r.id}
            r={r}
            selected={selected === r.id}
            onClick={() => setSelected((s) => (s === r.id ? null : r.id))}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto bg-black px-2 py-2">
        {CHIPS.map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => setChip(c.v)}
            className="relative inline-flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`relative inline-flex h-[42px] w-[42px] items-center justify-center rounded-full ${
                chip === c.v ? "ring-2 ring-[#F2C500]" : ""
              }`}
            >
              <img
                src={c.src}
                alt={`${c.v} chip`}
                className="absolute inset-0 h-full w-full select-none object-contain"
                draggable={false}
              />
            </span>
            <span className="absolute inset-0 flex items-center justify-center text-[0.62rem] font-extrabold text-black">
              {c.v}
            </span>
          </button>
        ))}
      </div>

      {recentItems.length ? (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-md bg-black px-1 py-2">
          <span className="mr-1 shrink-0 text-[1.05rem] font-bold text-white">Recent Result</span>
          {recentItems.map((item, idx) => (
            <span
              key={`${item.key}-${idx}`}
              className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border-2 px-2 text-base font-black ${item.tone}`}
            >
              {item.key}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
