import { useEffect, useRef, useState } from "react";
import { creditWin, debit, useWallet } from "@/lib/wallet";
import luckyBg from "@/assets/lucky-bg.gif.asset.json";
import balloonImg from "@/assets/balloon/balloon.png.asset.json";
import heatIcon from "@/assets/balloon/heat-icon.webp.asset.json";
import arrowDown from "@/assets/balloon/ArrowDown.webp.asset.json";
import profileIcon from "@/assets/balloon/Profile.webp.asset.json";
import loc1 from "@/assets/balloon/locationLt.png.asset.json";
import loc2 from "@/assets/balloon/locationLt2.png.asset.json";
import loc3 from "@/assets/balloon/locationLt3.png.asset.json";
import skyBg from "@/assets/balloon/sky-bg-1.jpg.asset.json";
import bonusSfx from "@/assets/balloon/balloon_achieve_bonus.mp3.asset.json";

const LOCATIONS = [skyBg, skyBg, loc1, loc2, loc3];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}




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
}: {
  multiplier: string;
  roundId?: string | undefined;
  suspended?: boolean;
  leftSec?: number | undefined;
}) {
  const [muted, setMuted] = useState(false);
  const [stake, setStake] = useState(100);
  const [phase, setPhase] = useState<"waiting" | "flying" | "crashed">("waiting");
  const [shown, setShown] = useState(1);
  const [wait, setWait] = useState(5);
  const [crashAt, setCrashAt] = useState(2);
  const [history, setHistory] = useState<number[]>([]);
  const [autos, setAutos] = useState<[boolean, boolean]>([false, false]);
  const wallet = useWallet();
  const balance = wallet.balance;
  const [bets, setBets] = useState<(null | { entry: number; stake: number; pending?: boolean })[]>([
    null,
    null,
  ]);
  const [flash, setFlash] = useState<(null | { text: string; win: boolean })[]>([null, null]);
  const airRef = useRef<HTMLAudioElement | null>(null);
  const apiTarget = Number(multiplier) || 0;
  const apiRef = useRef(apiTarget);
  apiRef.current = apiTarget;
  const stakeRef = useRef(stake);
  stakeRef.current = stake;
  const autoRef = useRef(autos);
  autoRef.current = autos;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const play = (src: string, vol: number, keep?: boolean) => {
    if (mutedRef.current) return;
    try {
      const a = new Audio(src);
      a.volume = vol;
      if (keep) airRef.current = a;
      void a.play().catch(() => undefined);
    } catch {
      // audio unavailable
    }
  };

  // continuous local round engine — never sits on "waiting" forever
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let ph: "waiting" | "flying" | "crashed" = "waiting";
    let t = 1; // seconds left in the current phase
    let v = 1;
    let target = 2;

    const startRound = () => {
      const api = apiRef.current;
      target =
        api > 1.05
          ? api
          : Math.min(28, Math.max(1.02, 0.92 / Math.max(0.03, 1 - Math.random())));
      setCrashAt(target);
      v = 1;
      setShown(1);
      ph = "flying";
      setPhase("flying");
      play("/balloon-air.mp3", 0.35, true);
      // pending (queued) bets go live; auto bets are debited now
      setBets((prev) =>
        prev.map((b, i) => {
          if (b?.pending) return { entry: 1, stake: b.stake };
          if (b) return b;
          if (!autoRef.current[i]) return null;
          if (!debit(stakeRef.current)) return null;
          return { entry: 1, stake: stakeRef.current };
        }),
      );
      setFlash([null, null]);
    };

    const burst = () => {
      ph = "crashed";
      setPhase("crashed");
      setShown(target);
      setHistory((h) => [target, ...h].slice(0, 10));
      airRef.current?.pause();
      play(bonusSfx.url, 0.7);
      t = 1.8;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (ph === "flying") {
        // real crash-curve pacing: gentle at first, faster the higher it goes
        v = v + dt * (0.09 + (v - 1) * 0.14);
        if (v >= target) {
          v = target;
          setShown(target);
          burst();
        } else {
          setShown(v);
        }
      } else {
        t -= dt;
        setWait(Math.max(0, Math.ceil(t)));
        if (t <= 0) {
          if (ph === "crashed") {
            ph = "waiting";
            setPhase("waiting");
            t = 3;
          } else {
            startRound();
          }
        }
      }

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      airRef.current?.pause();
    };
  }, []);

  // balloon burst → any active HEAT bet is lost (queued bets stay for next round)
  useEffect(() => {
    if (phase !== "crashed") return;
    setBets((prev) =>
      prev.map((b, i) => {
        if (b && !b.pending) {
          setFlash((f) => {
            const n = [...f];
            n[i] = { text: `-${b.stake.toLocaleString("en-IN")}`, win: false };
            return n;
          });
          return null;
        }
        return b;
      }),
    );
  }, [phase]);

  // HEAT button: bet (or queue for the next round), press again to cash out
  const pressHeat = (i: 0 | 1) => {
    setBets((prev) => {
      const next = [...prev];
      const b = next[i];
      if (b?.pending) {
        // cancel a queued bet
        creditWin(b.stake);
        next[i] = null;
        return next;
      }
      if (b) {
        if (phase !== "flying") return prev;
        const payout = Math.round(b.stake * shown);
        creditWin(payout);
        setFlash((f) => {
          const n = [...f];
          n[i] = { text: `+${payout.toLocaleString("en-IN")}`, win: true };
          return n;
        });
        next[i] = null;
      } else {
        if (stake <= 0) return prev;
        if (!debit(stake)) return prev;
        next[i] =
          phase === "flying" ? { entry: shown, stake } : { entry: 1, stake, pending: true };
        setFlash((f) => {
          const n = [...f];
          n[i] = null;
          return n;
        });
      }
      return next;
    });
  };

  const flying = phase === "flying";
  const popped = phase === "crashed";
  const grow = Math.min(1, Math.log(Math.max(1, shown)) / Math.log(12));
  const drift = flying ? Math.sin(shown * 2.2) * 6 : 0;

  const bgIndex = Math.abs(hashStr(roundId ?? "0")) % LOCATIONS.length;

  const histColor2 = (v: number) =>
    v >= 10
      ? "bg-[#7B2FF2] text-white"
      : v >= 2
        ? "bg-[#E8871E] text-white"
        : "bg-[#123A73] text-white";

  const seedHist = [1.81, 5.68, 2.58, 1.12, 1.15, 3.88, 2.59, 1.3, 1.25, 1.03];
  const histList = [...history, ...seedHist].slice(0, 10);




  return (
    <div className="w-full rounded-[14px] bg-black p-1.5">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[10px] bg-[linear-gradient(180deg,#59BFD4_0%,#6EC8DA_60%,#8FD2DC_100%)]">
        {/* sky artwork — parallax: the ground drops away as the balloon climbs */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={LOCATIONS[bgIndex]!.url}
            alt=""
            className="absolute inset-x-0 bottom-0 h-[190%] w-full object-cover object-bottom opacity-35"
            style={{
              transform: `translateY(${grow * 78}%)`,
              transition: "transform 240ms linear",
            }}
          />
        </div>

        {/* balloon — climbs while the round runs and bursts at the crash point */}
        {popped ? (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ animation: "scale-in 220ms cubic-bezier(.2,1.4,.4,1)" }}
          >
            <div className="relative">
              {[...Array(10)].map((_, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#E8384F]"
                  style={{
                    transform: `rotate(${i * 36}deg) translateY(-58px)`,
                    opacity: 0.85,
                    animation: `fade-out 700ms ${i * 12}ms ease-out forwards`,
                  }}
                />
              ))}
              <p className="text-[clamp(1.8rem,5.6vw,3.9rem)] font-extrabold leading-none text-[#C81E1E] drop-shadow-[0_3px_10px_rgba(255,255,255,0.55)]">
                {crashAt.toFixed(2)}x
              </p>
            </div>
            <p className="mt-1 text-[clamp(0.8rem,1.8vw,1.2rem)] font-extrabold uppercase tracking-[0.28em] text-[#C81E1E]">
              Burst
            </p>
          </div>
        ) : (
          <div
            className="absolute left-1/2"
            style={
              flying
                ? {
                    bottom: `${10 + grow * 30}%`,
                    width: `${Math.max(26, 38 - grow * 10)}%`,
                    minWidth: 170,
                    transform: `translateX(calc(-50% + ${drift}px))`,
                    transition: "bottom 220ms linear, width 220ms linear, transform 220ms linear",
                  }
                : {
                    bottom: "18%",
                    width: "38%",
                    minWidth: 180,
                    transform: "translateX(-50%)",
                  }

            }
          >
            <img
              src={balloonImg.url}
              alt="Balloon"
              className="w-full animate-[balloonSway_3s_ease-in-out_infinite]"
              style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.22))" }}
            />
            {/* burner flame under the basket while the balloon is flying */}
            {flying ? (
              <span
                className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 -translate-y-[55%]"
                aria-hidden
              >
                <span
                  className="block h-7 w-5 sm:h-9 sm:w-6"
                  style={{
                    background:
                      "radial-gradient(50% 65% at 50% 70%, #FFF6C8 0%, #FFD23E 35%, #FF8A1E 62%, #F43F0B 85%, transparent 100%)",
                    borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%",
                    transformOrigin: "50% 100%",
                    animation: "flame-flicker 180ms ease-in-out infinite alternate",
                    filter: "drop-shadow(0 0 8px rgba(255,140,30,0.85))",
                  }}
                />
                <span
                  className="absolute inset-x-[22%] bottom-0 block h-[58%]"
                  style={{
                    background:
                      "radial-gradient(50% 60% at 50% 75%, #FFFDE8 0%, #FFE45E 55%, transparent 100%)",
                    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                    transformOrigin: "50% 100%",
                    animation: "flame-flicker 140ms ease-in-out infinite alternate-reverse",
                  }}
                />
              </span>
            ) : null}
            {flying ? (
              <p className="absolute left-1/2 top-[36%] w-[180%] -translate-x-1/2 text-center text-[clamp(1.4rem,3.8vw,2.8rem)] font-extrabold leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                {shown.toFixed(2)}x
              </p>
            ) : (
              <p className="absolute left-1/2 top-[40%] w-[150%] -translate-x-1/2 text-center text-[clamp(0.75rem,1.5vw,1.15rem)] font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
                Next round in {wait}s
              </p>
            )}
          </div>
        )}





        {/* top bar: mute + history + collapse */}
        <div className="absolute inset-x-0 top-0 flex items-start gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              setMuted((m) => {
                const next = !m;
                if (next) {
                  airRef.current?.pause();
                } else if (flying && !popped) {
                  try {
                    const a = new Audio("/balloon-air.mp3");
                    a.volume = 0.35;
                    airRef.current = a;
                    void a.play().catch(() => undefined);
                  } catch {
                    // audio unavailable
                  }
                }
                return next;
              });
            }}
            className="shrink-0 text-[#2B2B2B]"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3z" />
              {muted ? (
                <path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="2" fill="none" />
              ) : (
                <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <div className="mx-auto flex max-w-[78%] flex-nowrap items-center justify-center gap-1.5 overflow-hidden">
            {histList.map((v, i) => (
              <span
                key={i}
                className={`shrink-0 rounded-[5px] px-2.5 py-[3px] text-[0.78rem] font-extrabold ${histColor2(v)}`}
              >
                {v.toFixed(2)}x
              </span>
            ))}
          </div>

          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8A33D]">
            <img src={arrowDown.url} alt="" className="h-3 w-3" />
          </span>
        </div>

        {/* profile pill + balance */}
        <div className="absolute left-0 top-[18%] flex items-center gap-2 rounded-r-[6px] bg-[#8E9BA6]/80 py-1 pl-3 pr-1.5">
          <img src={profileIcon.url} alt="" className="h-5 w-5" />
          <span className="text-[0.8rem] font-extrabold text-white">
            {Math.round(balance).toLocaleString("en-IN")}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1B6FE0]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </span>
        </div>

        {/* countdown */}
        {!flying ? (
          <span className="absolute right-3 top-[18%] flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 text-[0.9rem] font-extrabold text-white">
            {wait}
          </span>
        ) : null}

        {/* bottom overlay controls */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.10)_45%,rgba(0,0,0,0.28)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 px-2 pb-2 sm:gap-3 sm:px-3 sm:pb-3">
          {/* auto toggles + stakes */}
          <div className="w-[42%] max-w-[430px] sm:w-[46%]">

            <div className="mb-1.5 grid grid-cols-2 gap-2">
              {([0, 1] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAutos((a) => (i === 0 ? [!a[0], a[1]] : [a[0], !a[1]]))}
                  className="flex items-center gap-2 text-[0.82rem] font-bold text-[#2B2B2B]"
                  aria-pressed={autos[i]}
                >
                  Auto
                  <span
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                      autos[i] ? "bg-[#2FA84F]" : "bg-[#D9D9D9]"
                    }`}
                  >
                    <span
                      className={`absolute h-4 w-4 rounded-full bg-white shadow transition-all ${
                        autos[i] ? "left-[1.35rem]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 sm:gap-x-2 sm:gap-y-1.5">
              {BALLOON_STAKES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStake(s)}
                  className={`h-6 rounded-[5px] bg-[#123A73] text-[0.7rem] font-extrabold text-white transition-transform active:scale-95 sm:h-7 sm:text-[0.82rem] ${
                    stake === s ? "ring-2 ring-[#F0A500]" : ""
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>


          {/* edits / clear / min / max */}
          <div className="grid w-[16%] min-w-[74px] gap-1 sm:min-w-[100px] sm:gap-1.5">
            {(
              [
                ["Edits", 100, "bg-[#E8871E] text-white"],
                ["Clear", 0, "bg-[#E01E1E] text-white"],
                ["Min", 10, "bg-[#2A1330] text-white/60"],
                ["Max", 10000, "bg-[#2A1330] text-white/60"],
              ] as const
            ).map(([label, val, tone]) => (
              <button
                key={label}
                type="button"
                onClick={() => setStake(val)}
                className={`h-6 rounded-[5px] text-[0.7rem] font-bold transition-transform active:scale-95 sm:h-7 sm:text-[0.82rem] ${tone}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* heat buttons — bet / queue for next round / cash out */}
          <div className="ml-auto grid w-[30%] min-w-[124px] gap-1.5 sm:w-[26%] sm:min-w-[150px] sm:gap-2">
            {([0, 1] as const).map((i) => {
              const bet = bets[i];
              const fl = flash[i];
              const live = bet && !bet.pending;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pressHeat(i)}
                  className={`relative flex h-[44px] items-center justify-center gap-2 rounded-[8px] border-2 border-white text-[0.95rem] font-extrabold tracking-wide text-white transition-transform active:translate-y-[2px] active:shadow-none sm:h-[52px] sm:gap-3 sm:text-[1.15rem] ${
                    live
                      ? "bg-[linear-gradient(180deg,#F0A500_0%,#D98200_100%)] shadow-[0_3px_0_#8A5600]"
                      : bet
                        ? "bg-[linear-gradient(180deg,#8C96A3_0%,#6B7480_100%)] shadow-[0_3px_0_#454C55]"
                        : "bg-[linear-gradient(180deg,#22C93A_0%,#0FA524_100%)] shadow-[0_3px_0_#0B6B18]"
                  }`}
                >
                  {live ? (
                    <span className="flex flex-col leading-tight">
                      <span className="text-[0.6rem] font-bold uppercase opacity-90 sm:text-[0.68rem]">
                        Cash out
                      </span>
                      <span>{Math.round(bet!.stake * shown).toLocaleString("en-IN")}</span>
                    </span>
                  ) : bet ? (
                    <span className="flex flex-col leading-tight">
                      <span className="text-[0.6rem] font-bold uppercase opacity-90 sm:text-[0.68rem]">
                        Waiting {wait}s
                      </span>
                      <span>{bet.stake.toLocaleString("en-IN")}</span>
                    </span>
                  ) : (
                    <>
                      <img src={heatIcon.url} alt="" className="h-6 w-6 sm:h-7 sm:w-7" />
                      HEAT
                    </>
                  )}
                  {fl ? (
                    <span
                      className={`absolute -top-3 right-1 rounded-full px-2 py-0.5 text-[0.7rem] font-extrabold ${
                        fl.win ? "bg-[#1F6B33] text-white" : "bg-[#C01818] text-white"
                      }`}
                      style={{ animation: "fade-out 1.6s 0.6s ease-out forwards" }}
                    >
                      {fl.text}
                    </span>
                  ) : null}
                </button>
              );

            })}
          </div>
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
