import { useEffect, useRef, useState } from "react";
import headsCoin from "@/assets/coin/heads.png.asset.json";
import tailsCoin from "@/assets/coin/tails.png.asset.json";
import headPlate from "@/assets/coin/head-bet.jpg.asset.json";
import tailPlate from "@/assets/coin/tails-bet.jpg.asset.json";
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
  // phase: betting -> flipping (result locked, coin spins ~8s) -> reveal
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

  // Start the flip the moment the round is suspended (result is being drawn).
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

  // Alternate faces quickly while flipping so it reads as a real toss.
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
    <div className="relative flex w-full items-center justify-center bg-black py-6">
      <img
        src={face === "HEADS" ? headsCoin.url : tailsCoin.url}
        alt={`${face} coin`}
        width={240}
        height={240}
        className="h-[230px] w-[230px] select-none object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
        draggable={false}
        style={flipping ? { animation: "uapi-coin-flip 0.28s linear infinite" } : undefined}
      />
      {!flipping && !suspended && leftSec != null ? (
        <span className="absolute bottom-3 right-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#F2C500] text-[1.05rem] font-extrabold text-[#F2C500]">
          {leftSec}
        </span>
      ) : null}
      {!flipping && suspended && winner ? (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F2C500] px-4 py-1 text-[0.8rem] font-extrabold uppercase text-black">
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

function Plate({ r }: { r: CoinRunner; active: boolean }) {
  const heads = r.label.toUpperCase().startsWith("H");
  return (
    <div className="relative">
      <img
        src={heads ? headPlate.url : tailPlate.url}
        alt={r.label}
        width={260}
        height={92}
        className="h-auto w-full select-none rounded-[6px] object-contain"
        draggable={false}
      />
      {!r.open ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-black/50 text-[1.2rem]">
          🔒
        </span>
      ) : null}
    </div>
  );
}

export function HeadsTailsPanel({
  runners,
  min,
  max,
}: {
  runners: CoinRunner[];
  min: number;
  max: number;
}) {
  const [chip, setChip] = useState("1k");
  return (
    <div className="bg-black p-2">
      <p className="mb-1 text-right text-[0.62rem] font-semibold text-white/40">
        Min:{min} Max:{max}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {runners.map((r) => (
          <Plate key={r.id} r={r} active={r.open} />
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
    </div>
  );
}
