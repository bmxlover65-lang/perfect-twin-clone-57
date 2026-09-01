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

export function BalloonStage({
  multiplier,
  roundId,
  suspended,
  leftSec,
}: {
  multiplier: string;
  roundId?: string | undefined;
  suspended?: boolean;
  leftSec?: number | undefined;
}) {
  const [muted, setMuted] = useState(false);
  const [stake, setStake] = useState(100);
  const [flying, setFlying] = useState(false);
  const [popped, setPopped] = useState(false);
  const [shown, setShown] = useState(1);
  const [history, setHistory] = useState<number[]>([]);
  const airRef = useRef<HTMLAudioElement | null>(null);
  const doneFor = useRef<string | null>(null);
  const target = Number(multiplier) || 1;

  // live count-up towards the API multiplier while the round is flying
  useEffect(() => {
    if (popped) return;
    let raf = 0;
    const tick = () => {
      setShown((v) => v + Math.max(0.004, (target - v) * 0.06));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [target, popped]);

  // new round → reset + air sound
  useEffect(() => {
    if (!roundId || doneFor.current === roundId) return;
    doneFor.current = roundId;
    setPopped(false);
    setFlying(true);
    setShown(1);
    if (!muted) {
      try {
        const a = new Audio("/balloon-air.mp3");
        a.volume = 0.35;
        airRef.current = a;
        void a.play().catch(() => undefined);
      } catch {
        // audio unavailable
      }
    }
  }, [roundId, muted]);

  // round ends → pop
  useEffect(() => {
    if (!suspended || popped) return;
    setPopped(true);
    setFlying(false);
    setShown(target);
    setHistory((h) => [target, ...h].slice(0, 9));
    airRef.current?.pause();
    if (!muted) {
      try {
        const a = new Audio("/balloon-pop.mp3");
        a.volume = 0.7;
        void a.play().catch(() => undefined);
      } catch {
        // audio unavailable
      }
    }
  }, [suspended, popped, target, muted]);

  const grow = Math.min(1, Math.log(Math.max(1, shown)) / Math.log(20));
  const size = 120 + grow * 170;
  const bottom = 90 + grow * 190;

  const histColor = (v: number) =>
    v >= 4 ? "bg-[#F0A500] text-black" : v >= 2 ? "bg-[#E4572E] text-black" : "bg-[#2E86DE] text-white";

  const bgIndex = Math.abs(hashStr(roundId ?? "0")) % LOCATIONS.length;

  return (
    <div className="w-full overflow-hidden rounded-[10px] bg-[#12212B]">
      {/* history strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-[#1B2E3A] px-2 py-1.5">
        {history.length === 0 ? (
          <span className="rounded bg-[#2E86DE] px-2.5 py-0.5 text-[0.72rem] font-extrabold text-white">
            {target.toFixed(2)}x
          </span>
        ) : (
          history.map((v, i) => (
            <span
              key={i}
              className={`shrink-0 rounded px-2.5 py-0.5 text-[0.72rem] font-extrabold ${histColor(v)}`}
            >
              {v.toFixed(2)}x
            </span>
          ))
        )}
        <img src={arrowDown.url} alt="" className="ml-auto h-3.5 w-3.5 shrink-0 invert" />
      </div>

      {/* mute + avatar row */}
      <div className="flex items-center gap-2 bg-[#16303E] px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setMuted((m) => !m);
            airRef.current?.pause();
          }}
          className="text-white/90"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3z" />
            {muted ? (
              <path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" strokeWidth="2" fill="none" />
            ) : (
              <path d="M16 8a5 5 0 010 8" stroke="currentColor" strokeWidth="2" fill="none" />
            )}
          </svg>
        </button>
        <span className="flex items-center gap-1 rounded bg-[#27475A] px-2 py-1">
          <img src={profileIcon.url} alt="" className="h-4 w-4" />
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </span>
        {!suspended && leftSec != null ? (
          <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/70 text-[0.85rem] font-extrabold text-white">
            {leftSec}
          </span>
        ) : null}
      </div>

      {/* sky stage */}
      <div className="relative h-[380px] overflow-hidden sm:h-[430px]">
        {/* parallax background artwork — scrolls down as balloon climbs */}
        <img
          src={LOCATIONS[bgIndex]!.url}
          alt=""
          className="absolute left-0 w-full transition-transform duration-500 ease-out"
          style={{
            bottom: 0,
            height: "165%",
            objectFit: "cover",
            transform: `translateY(${grow * 38}%)`,
          }}
        />

        {/* clouds */}
        {[12, 62, 84].map((l, i) => (
          <span
            key={i}
            className="absolute h-[10px] w-[52px] rounded-full bg-white/60 blur-[2px]"
            style={{ left: `${l}%`, top: `${16 + i * 11}%` }}
          />
        ))}

        {/* balloon */}
        <div
          className="absolute left-1/2 transition-all duration-300 ease-out"
          style={{
            bottom: `${bottom}px`,
            width: `${size}px`,
            opacity: popped ? 0 : 1,
            transform: `translateX(-50%) scale(${popped ? 1.4 : 1})`,
          }}
        >
          <img
            src={balloonImg.url}
            alt="Balloon"
            className="w-full animate-[balloonSway_3s_ease-in-out_infinite]"
            style={{ filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.25))" }}
          />
          <p className="absolute left-1/2 top-[26%] -translate-x-1/2 text-[1.5rem] font-extrabold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">
            {shown.toFixed(2)}x
          </p>
        </div>

        {popped ? (
          <div className="absolute left-1/2 top-[38%] -translate-x-1/2 text-center">
            <p className="text-[0.95rem] font-extrabold uppercase tracking-[0.2em] text-[#B81D5B]">
              Balloon burst
            </p>
            <p className="text-[2.6rem] font-extrabold leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              {target.toFixed(2)}x
            </p>
          </div>
        ) : null}
      </div>


      {/* betting panel */}
      <div className="grid grid-cols-[1fr_auto_1.15fr] gap-2 bg-[#12212B] p-3">
        {/* stakes */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[0.72rem] font-bold text-white/80">
            Auto
            <span className={`relative inline-flex h-4 w-7 items-center rounded-full ${flying ? "bg-[#2E86DE]" : "bg-[#3A4B57]"}`}>
              <span className={`absolute h-3 w-3 rounded-full bg-white transition-all ${flying ? "left-3.5" : "left-0.5"}`} />
            </span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {BALLOON_STAKES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStake(s)}
                className={`h-8 rounded bg-[#1E3A4C] text-[0.75rem] font-bold text-white/90 ${
                  stake === s ? "ring-2 ring-[#F0A500]" : ""
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {/* edit/clear/min/max */}
        <div className="grid content-start gap-1.5 pt-5">
          <button type="button" className="h-8 rounded bg-[#F0A500] px-3 text-[0.72rem] font-extrabold text-black">
            Edits
          </button>
          <button
            type="button"
            onClick={() => setStake(0)}
            className="h-8 rounded bg-[#D64545] px-3 text-[0.72rem] font-extrabold text-white"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setStake(10)}
            className="h-8 rounded bg-[#7A4BC2] px-3 text-[0.72rem] font-extrabold text-white"
          >
            Min
          </button>
          <button
            type="button"
            onClick={() => setStake(10000)}
            className="h-8 rounded bg-[#3A4BC2] px-3 text-[0.72rem] font-extrabold text-white"
          >
            Max
          </button>
        </div>
        {/* heat buttons */}
        <div className="grid content-start gap-2 pt-5">
          {[0, 1].map((i) => (
            <button
              key={i}
              type="button"
              disabled={!!suspended}
              className="flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[linear-gradient(180deg,#3CCB4E_0%,#1E9E30_100%)] text-[1.05rem] font-extrabold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_3px_0_#146B21] disabled:opacity-40"
            >
              <svg width="20" height="22" viewBox="0 0 24 26" fill="none">
                <path d="M12 1 C14 6 20 8 20 15 A8 8 0 1 1 4 15 C4 10 8 8 9 4 C10 7 12 8 12 8 C11 5 11 3 12 1 Z" fill="#FF6B1A" stroke="#B33A00" strokeWidth="1.2" />
                <path d="M12 12 C13.5 15 16 16 16 19 A4 4 0 1 1 8 19 C8 16.5 10.5 15.5 12 12 Z" fill="#FFD23E" />
              </svg>
              HEAT
            </button>
          ))}
          <span className="text-center text-[0.7rem] font-bold text-white/60">
            Stake: {stake || 0}
          </span>
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
