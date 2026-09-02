import { useEffect, useRef, useState } from "react";
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
  { v: "100", src: chip100.url },
  { v: "400", src: chip200.url },
  { v: "500", src: chip500.url },
  { v: "1k", src: chip1k.url },
  { v: "3k", src: chip20.url },
  { v: "3.2k", src: chip10.url },
  { v: "5k", src: chip5.url },
  { v: "100k", src: chip50.url },
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
  const [face, setFace] = useState<CoinSide>("HEADS");
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
    setFlipping(true);
    play(coinSound.url);
    const stop = window.setTimeout(() => {
      setFlipping(false);
      setShown(winner);
      play(winner === "HEADS" ? headWinSound.url : tailWinSound.url);
    }, 8000);
    timers.current.push(stop);
    return () => window.clearTimeout(stop);
  }, [suspended, winner, roundId]);

  useEffect(() => {
    if (!flipping && winner && !suspended) setShown(winner);
  }, [flipping, winner, suspended]);

  useEffect(() => {
    if (!flipping) {
      setFace(shown);
      return undefined;
    }
    const i = window.setInterval(
      () => setFace((f) => (f === "HEADS" ? "TAILS" : "HEADS")),
      140,
    );
    return () => window.clearInterval(i);
  }, [flipping, shown]);

  return (
    <div className="relative flex w-full items-center justify-center bg-black py-5">
      <img
        src={face === "HEADS" ? headsCoin.url : tailsCoin.url}
        alt={`${face} coin`}
        className="h-[min(320px,78vw)] w-[min(320px,78vw)] select-none object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)]"
        draggable={false}
        style={flipping ? { animation: "uapi-coin-flip 0.28s linear infinite" } : undefined}
      />
      {!flipping && !suspended && leftSec != null ? (
        <span className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#F2C500] bg-[#F2C500] text-[1.1rem] font-black text-black shadow-[0_4px_12px_rgba(242,197,0,0.45)]">
          {leftSec}
        </span>
      ) : null}
      {!flipping && suspended && winner ? (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-[#F2C500] px-4 py-1 text-[0.8rem] font-extrabold uppercase text-black">
          {winner} wins
        </span>
      ) : null}
      <style>{`@keyframes uapi-coin-flip{0%{transform:rotateY(0deg) translateY(0) scale(1)}50%{transform:rotateY(180deg) translateY(-34px) scale(1.06)}100%{transform:rotateY(360deg) translateY(0) scale(1)}}`}</style>
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
    "relative flex flex-col items-center justify-center rounded-[10px] border-2 p-2 text-white shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition-transform active:scale-[0.98]";
  const theme = heads
    ? "border-[#C4B5FD] bg-gradient-to-b from-[#A78BFA] to-[#7C3AED]"
    : "border-[#93C5FD] bg-gradient-to-b from-[#60A5FA] to-[#2563EB]";
  const innerBg = heads ? "bg-[#5B21B6]/55" : "bg-[#1E40AF]/55";
  const barBg = heads ? "bg-[#4C1D95]/80" : "bg-[#1E3A8A]/80";

  return (
    <button
      type="button"
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
        <span className="absolute inset-0 grid place-items-center rounded-[10px] bg-black/60 text-[1.2rem]">
          🔒
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
      if (raw.startsWith("T")) return { key: "T", tone: "bg-[#F472B6] text-black" };
      if (raw.startsWith("H")) return { key: "H", tone: "bg-[#60A5FA] text-black" };
      return { key: raw.slice(0, 1), tone: "bg-white/20 text-white" };
    });

  return (
    <div className="bg-black p-2">
      <p className="mb-2 text-right text-[0.62rem] font-semibold text-white/40">
        Min:{min} Max:{max}
      </p>
      <div className="grid grid-cols-2 gap-3">
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
          <span className="mr-1 shrink-0 text-[0.95rem] font-bold text-white">Recent Result</span>
          {recentItems.map((item, idx) => (
            <span
              key={`${item.key}-${idx}`}
              className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-2 text-sm font-black ${item.tone}`}
            >
              {item.key}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
