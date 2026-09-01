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
  { v: "1k", src: chip1k.url },
  { v: "5k", src: chip5.url },
  { v: "10k", src: chip10.url },
  { v: "25k", src: chip20.url },
  { v: "50k", src: chip50.url },
  { v: "100k", src: chip100.url },
  { v: "200k", src: chip200.url },
  { v: "500k", src: chip500.url },
];

export type CoinSide = "HEADS" | "TAILS";

export function CoinStageImage({
  side,
  roundId,
  spinning,
}: {
  side: CoinSide;
  roundId?: string | undefined;
  spinning: boolean;
}) {
  const [flip, setFlip] = useState(false);
  const prevRound = useRef<string | undefined>(undefined);
  const prevSide = useRef<CoinSide | undefined>(undefined);

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
    if (!roundId) return;
    if (prevRound.current && prevRound.current !== roundId) {
      setFlip(true);
      play(coinSound.url);
      const t = setTimeout(() => setFlip(false), 1800);
      prevRound.current = roundId;
      return () => clearTimeout(t);
    }
    prevRound.current = roundId;
    return undefined;
  }, [roundId]);

  useEffect(() => {
    if (prevSide.current && prevSide.current !== side) {
      play(side === "HEADS" ? headWinSound.url : tailWinSound.url);
    }
    prevSide.current = side;
  }, [side]);

  const animate = flip || spinning;

  return (
    <div className="flex w-full items-center justify-center bg-black py-6">
      <img
        src={side === "HEADS" ? headsCoin.url : tailsCoin.url}
        alt={`${side} coin`}
        width={240}
        height={240}
        className="h-[230px] w-[230px] select-none object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
        draggable={false}
        style={animate ? { animation: "uapi-coin-flip 0.55s linear infinite" } : undefined}
      />
      <style>{`@keyframes uapi-coin-flip{0%{transform:rotateY(0deg) translateY(0)}50%{transform:rotateY(180deg) translateY(-24px)}100%{transform:rotateY(360deg) translateY(0)}}`}</style>
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

function Plate({ r, active }: { r: CoinRunner; active: boolean }) {
  const heads = r.label.toUpperCase().startsWith("H");
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-[10px] border-2 px-4 py-5 ${
        heads
          ? "border-[#C9A227] bg-[#1F4A32]"
          : "border-[#8C4A46] bg-[#4A2320]"
      } ${active ? "" : "opacity-90"}`}
    >
      <div className="relative">
        <img
          src={heads ? headPlate.url : tailPlate.url}
          alt={r.label}
          width={190}
          height={68}
          className="h-[64px] w-[180px] select-none rounded-[4px] object-cover"
          draggable={false}
        />
        {!r.open ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-black/45 text-[1.1rem]">
            🔒
          </span>
        ) : null}
      </div>
      <span className="mt-2 text-[0.85rem] font-bold text-white/85">
        {r.price ? r.price.toFixed(2) : "—"}
      </span>
      <span className="text-[0.75rem] font-semibold text-white/45">
        {r.size ? Math.round(r.size) : ""}
      </span>
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
    <div className="rounded-[6px] bg-[#141414] p-3">
      <p className="mb-2 text-right text-[0.68rem] font-semibold text-white/50">
        Min:{min} Max:{max}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {runners.map((r) => (
          <Plate key={r.id} r={r} active={r.open} />
        ))}
      </div>
      <div className="mt-3 flex flex-nowrap items-center gap-3 overflow-x-auto rounded-b-[6px] bg-[#1F1F1F] px-3 py-2">
        {CHIPS.map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => setChip(c.v)}
            className="relative inline-flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`relative inline-flex h-[46px] w-[46px] items-center justify-center rounded-full ${
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
            <span className="text-[0.68rem] font-bold text-white">{c.v}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
