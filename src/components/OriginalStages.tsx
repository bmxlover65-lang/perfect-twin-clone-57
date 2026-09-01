import { useEffect, useRef, useState } from "react";
import luckyBg from "@/assets/lucky-bg.gif.asset.json";



/* ---------- Lucky 0 to 9 wheel ---------- */

const LUCKY_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function segColor(n: number) {
  if (n === 0) return "#3FB65B";
  return n % 2 === 1 ? "#E7503C" : "#151515";
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
}

export function LuckyWheel({
  winner,
  roundId,
  suspended,
  leftSec,
}: {
  winner?: string | null;
  roundId?: string | undefined;
  suspended?: boolean;
  leftSec?: number | undefined;
}) {
  const cx = 200;
  const cy = 200;
  const r = 190;
  const step = 360 / LUCKY_ORDER.length;
  const [rot, setRot] = useState(0);
  const [spin, setSpin] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const spunFor = useRef<string | null>(null);

  useEffect(() => {
    if (!suspended || winner == null || winner === "" || !roundId) return;
    if (spunFor.current === roundId) return;
    spunFor.current = roundId;
    const num = Number(String(winner).replace(/[^0-9]/g, ""));
    const idx = LUCKY_ORDER.indexOf(Number.isFinite(num) ? num : 0);
    const seg = (idx < 0 ? 0 : idx) * step + step / 2;
    const base = Math.ceil(rot / 360) * 360;
    setShowWin(false);
    setSpin(true);
    setRot(base + 360 * 6 - seg);
    try {
      const audio = new Audio("/wheel-spin.mp3");
      audio.volume = 0.6;
      void audio.play().catch(() => undefined);
    } catch {
      // audio unavailable
    }
    const t = window.setTimeout(() => {
      setSpin(false);
      setShowWin(true);
    }, 6200);
    return () => window.clearTimeout(t);
  }, [suspended, winner, roundId, rot, step]);

  useEffect(() => {
    if (!suspended) setShowWin(false);
  }, [suspended]);

  return (
    <div className="relative w-full overflow-hidden rounded-[4px] bg-black">
      <img
        src={luckyBg.url}
        alt=""
        className="h-[430px] w-full object-cover opacity-90"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <svg
            viewBox="0 0 400 400"
            className="h-[400px] w-[400px] max-w-full drop-shadow-[0_0_18px_rgba(0,0,0,0.6)]"
            style={{
              transform: `rotate(${rot}deg)`,
              transition: spin ? "transform 6s cubic-bezier(0.12,0.7,0.12,1)" : "none",
            }}
          >
            {LUCKY_ORDER.map((n, i) => {
              const a0 = i * step;
              const a1 = a0 + step;
              const [x0, y0] = polar(cx, cy, r, a0);
              const [x1, y1] = polar(cx, cy, r, a1);
              const [tx, ty] = polar(cx, cy, r * 0.72, a0 + step / 2);
              return (
                <g key={n}>
                  <path
                    d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`}
                    fill={segColor(n)}
                    stroke="#F2C500"
                    strokeWidth={2}
                  />
                  <text
                    x={tx}
                    y={ty}
                    fill="#fff"
                    fontSize={30}
                    fontWeight={800}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${a0 + step / 2} ${tx} ${ty})`}
                  >
                    {n}
                  </text>
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r={54} fill="#151515" stroke="#F2C500" strokeWidth={2} />
          </svg>
          <span className="pointer-events-none absolute left-1/2 top-[-4px] -translate-x-1/2 text-[1.4rem] leading-none text-[#F2C500]">
            ▼
          </span>
          {!suspended && leftSec != null ? (
            <span className="pointer-events-none absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#F2C500] text-[1.05rem] font-extrabold text-[#F2C500]">
              {leftSec}
            </span>
          ) : null}
          {showWin && winner ? (
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#F2C500] px-4 py-1 text-[0.8rem] font-extrabold uppercase text-black">
              {winner} wins
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Dream Catcher wheel ---------- */

const DREAM_SEGMENTS: number[] = (() => {
  const out: number[] = [];
  const pattern = [1, 2, 1, 5, 1, 2, 1, 10, 1, 2, 1, 5, 1, 2, 1, 20, 1, 2, 1, 5, 1, 2, 1, 10, 1, 2, 1, 40];
  while (out.length < 54) out.push(pattern[out.length % pattern.length] as number);
  return out;
})();

const DREAM_COLORS: Record<number, string> = {
  1: "#F5C400",
  2: "#3D9BE9",
  5: "#8E44C7",
  10: "#2CA35B",
  20: "#EF7C1B",
  40: "#E7503C",
};

export function DreamWheel({
  winner,
  roundId,
  suspended,
  leftSec,
}: {
  winner?: string | null;
  roundId?: string | undefined;
  suspended?: boolean;
  leftSec?: number | undefined;
}) {
  const cx = 200;
  const cy = 200;
  const r = 190;
  const step = 360 / DREAM_SEGMENTS.length;
  const [rot, setRot] = useState(0);
  const [spin, setSpin] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const spunFor = useRef<string | null>(null);

  useEffect(() => {
    if (!suspended || !winner || !roundId) return;
    if (spunFor.current === roundId) return;
    spunFor.current = roundId;
    const target = Number(winner);
    const idx = DREAM_SEGMENTS.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0);
    const pick = idx.length ? (idx[Math.floor(Math.random() * idx.length)] as number) : 0;
    const seg = pick * step + step / 2;
    const base = Math.ceil(rot / 360) * 360;
    setShowWin(false);
    setSpin(true);
    setRot(base + 360 * 6 - seg);
    try {
      const audio = new Audio("/wheel-spin.mp3");
      audio.volume = 0.6;
      void audio.play().catch(() => undefined);
    } catch {
      // audio not available
    }
    const t = window.setTimeout(() => {
      setSpin(false);
      setShowWin(true);
    }, 6200);
    return () => window.clearTimeout(t);
  }, [suspended, winner, roundId, rot, step]);

  useEffect(() => {
    if (!suspended) setShowWin(false);
  }, [suspended]);

  return (
    <div className="relative flex w-full items-center justify-center rounded-[4px] bg-black py-4">
      <div className="relative">
        <svg
          viewBox="0 0 400 400"
          className="h-[420px] w-[420px] max-w-full"
          style={{
            transform: `rotate(${rot}deg)`,
            transition: spin ? "transform 6s cubic-bezier(0.12,0.7,0.12,1)" : "none",
          }}
        >
          {DREAM_SEGMENTS.map((v, i) => {
            const a0 = i * step;
            const a1 = a0 + step;
            const [x0, y0] = polar(cx, cy, r, a0);
            const [x1, y1] = polar(cx, cy, r, a1);
            const [tx, ty] = polar(cx, cy, r * 0.8, a0 + step / 2);
            return (
              <g key={i}>
                <path
                  d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`}
                  fill={DREAM_COLORS[v] ?? "#F5C400"}
                  stroke="#111"
                  strokeWidth={0.6}
                />
                <text
                  x={tx}
                  y={ty}
                  fill="#fff"
                  fontSize={12}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${a0 + step / 2} ${tx} ${ty})`}
                >
                  {v}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={58} fill="#0B0B0B" stroke="#F2C500" strokeWidth={2} />
        </svg>
        <span className="pointer-events-none absolute left-1/2 top-[-6px] -translate-x-1/2 text-[1.4rem] leading-none text-[#F2C500]">
          ▼
        </span>
        {!suspended && leftSec != null ? (
          <span className="pointer-events-none absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#F2C500] text-[1.05rem] font-extrabold text-[#F2C500]">
            {leftSec}
          </span>
        ) : null}
        {showWin && winner ? (
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#F2C500] px-4 py-1 text-[0.8rem] font-extrabold uppercase text-black">
            {winner}x wins
          </span>
        ) : null}
      </div>
    </div>
  );
}


/* ---------- Heads & Tails coin ---------- */

export function CoinStage({ side }: { side: "HEADS" | "TAILS" }) {
  return (
    <div className="flex w-full items-center justify-center rounded-[4px] bg-black py-6">
      <svg viewBox="0 0 200 200" className="h-[210px] w-[210px]">
        <defs>
          <linearGradient id="coinFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE07A" />
            <stop offset="45%" stopColor="#F5B924" />
            <stop offset="100%" stopColor="#C98A0C" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="94" fill="#B8790A" />
        <circle cx="100" cy="100" r="88" fill="url(#coinFace)" />
        <circle cx="100" cy="100" r="66" fill="none" stroke="#D9A21C" strokeWidth="3" />
        <path id="coinArc" d="M 38 100 A 62 62 0 0 1 162 100" fill="none" />
        <text fill="#8A6207" fontSize="20" fontWeight="800" letterSpacing="4">
          <textPath href="#coinArc" startOffset="50%" textAnchor="middle">
            UNIVERSE
          </textPath>
        </text>
        <text
          x="100"
          y="103"
          fill="#9A6E08"
          fontSize="24"
          fontWeight="800"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {side}
        </text>
        <text
          x="100"
          y="163"
          fill="#8A6207"
          fontSize="14"
          fontWeight="800"
          textAnchor="middle"
          letterSpacing="2"
        >
          COIN
        </text>
      </svg>
    </div>
  );
}

/* ---------- Balloon ---------- */

const BALLOON_STAKES = [10, 50, 100, 500, 1000, 2500, 5000, 10000];

export function BalloonStage({ multiplier }: { multiplier: string }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E1E1E] text-white">
          🔊
        </span>
        <span className="h-7 w-7 rounded-full bg-[#2A2A2A]" />
      </div>
      <div className="overflow-hidden rounded-[4px]">
        <div className="relative flex h-[430px] items-center justify-center bg-[linear-gradient(180deg,#1B1F8C_0%,#3C42B4_55%,#8189D6_100%)]">
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-white/50"
              style={{ left: `${18 + i * 9}%`, top: `${30 + ((i * 37) % 45)}%` }}
            />
          ))}
          <p className="text-[3.2rem] font-extrabold leading-none text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]">
            {multiplier}
            <span className="text-[1.6rem] font-bold">x</span>
          </p>
        </div>
        <div className="h-[80px] w-full bg-[#2E7D32]" />
      </div>
      <div className="mt-1 grid grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1fr)_minmax(0,1.4fr)] gap-2 rounded-[4px] bg-[#151515] p-3">
        <div className="col-span-2 grid grid-cols-2 gap-2">
          {BALLOON_STAKES.map((s) => (
            <button
              key={s}
              type="button"
              className="h-9 rounded bg-[#242424] text-[0.78rem] font-bold text-white/90"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          {["Edits", "Clear", "Min", "Max"].map((s) => (
            <button
              key={s}
              type="button"
              className="h-9 rounded bg-[#242424] text-[0.78rem] font-bold text-white/90"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="grid content-start gap-2">
          <button
            type="button"
            className="h-9 rounded bg-[#2C2C2C] text-[0.85rem] font-extrabold text-white"
          >
            BET
          </button>
          <button
            type="button"
            className="h-9 rounded bg-[#2C2C2C] text-[0.85rem] font-extrabold text-white"
          >
            HEAT
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ball by Ball ---------- */

export type BbbRunner = {
  selectionId: string;
  label: string;
  status?: string;
  backPrice?: number | null;
  backSize?: number | null;
};

function plateTone(label: string) {
  const l = label.toUpperCase();
  if (l.startsWith("WICKET")) return "bg-[#7A2222]";
  if (l.startsWith("EXTRA")) return "bg-[#22646E]";
  if (l.startsWith("6")) return "bg-[#3B3F86]";
  if (l.startsWith("4")) return "bg-[#1F6B33]";
  return "bg-[#6F6A16]";
}

export function BallByBallBoard({
  runners,
  min,
  max,
  news,
}: {
  runners: BbbRunner[];
  min: number;
  max: number;
  news?: string | undefined;
}) {
  const open = (s?: string) => (s ?? "").toUpperCase() === "ACTIVE";
  return (
    <div className="mt-0 bg-white">
      <div className="flex items-center justify-between bg-[#2E4B5C] px-3 py-[6px]">
        <span className="text-[0.85rem] font-bold text-white">Runs</span>
        <span className="text-[0.78rem] font-bold text-white">
          Min/Max: {min} - {max}
        </span>
      </div>
      <div className="grid grid-cols-2 border-b border-black/10 bg-[#EDEDED]">
        <span className="py-1 text-center text-[0.85rem] font-bold text-black/80">Back</span>
        <span className="py-1 text-center text-[0.85rem] font-bold text-black/80">Back</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3">
        {runners.map((r) => (
          <div
            key={r.selectionId}
            className={`relative flex h-[58px] items-center rounded-[6px] px-4 ${plateTone(r.label)}`}
          >
            <span className="flex w-[70px] flex-col items-center leading-tight">
              <span className="text-[0.85rem] font-bold text-white">
                {r.backPrice ? r.backPrice.toFixed(2) : "—"}
              </span>
              <span className="text-[0.72rem] font-semibold text-white/80">
                {r.backSize ? Math.round(r.backSize).toLocaleString("en-US") : ""}
              </span>
            </span>
            <span className="flex-1 text-center text-[0.85rem] font-extrabold uppercase text-white">
              {open(r.status) ? r.label : "SUSPENDED"}
            </span>
          </div>
        ))}
      </div>
      {news ? (
        <p className="px-3 pb-3 text-[0.78rem] font-medium text-black/70">{news}</p>
      ) : null}
    </div>
  );
}
