import { useCallback, useEffect, useRef, useState } from "react";
import plane0 from "@/assets/aviator/plane-0.svg";
import plane1 from "@/assets/aviator/plane-1.svg";
import plane2 from "@/assets/aviator/plane-2.svg";
import plane3 from "@/assets/aviator/plane-3.svg";
import historyIcon from "@/assets/aviator/history.svg";
import arrowIcon from "@/assets/aviator/arrow-down.svg";
import fairIcon from "@/assets/aviator/provably-fair.svg";
import propellerImg from "@/assets/aviator/propeller.png.asset.json";
import av1 from "@/assets/aviator/av1.png";
import av2 from "@/assets/aviator/av2.png";
import av3 from "@/assets/aviator/av3.png";
import av4 from "@/assets/aviator/av4.png";
import av5 from "@/assets/aviator/av5.png";
import av6 from "@/assets/aviator/av6.png";
import bgSound from "@/assets/aviator/aviator-background.mp3.asset.json";
import crashSound from "@/assets/aviator/plane-crash.mp3.asset.json";
import beepSound from "@/assets/aviator/beep.mp3.asset.json";
import winSound from "@/assets/aviator/win.mp3.asset.json";

import { type AviatorControl, useAdminConfig } from "@/lib/admin";
import { logBet, setBalance as saveBalance } from "@/lib/telemetry";

const PLANE_FRAMES = [plane0, plane1, plane2, plane3];
if (typeof window !== "undefined") {
  PLANE_FRAMES.forEach((src) => {
    const img = new window.Image();
    img.src = src;
  });
}

const AVATARS = [av1, av2, av3, av4, av5, av6];

/* ---------------- round engine ---------------- */

type Phase = "betting" | "flying" | "crashed";

const BET_MS = 6000;
const CRASH_HOLD_MS = 3500;

function randomCrash(): number {
  // 3% instant-bust, otherwise classic 1/(1-u) curve with 97% RTP
  const r = Math.random();
  if (r < 0.03) return 1.0;
  const u = Math.random();
  return Math.max(1.01, Math.floor((0.97 / (1 - u)) * 100) / 100);
}

function fmt(n: number) {
  return n.toFixed(2);
}

function chipTone(m: number) {
  if (m < 2) return "text-[#20BFFF]";
  if (m < 10) return "text-[#8B5CF6]";
  return "text-[#FF2DAA]";
}

function HistToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label="Round history"
      className="flex h-[22px] w-[36px] shrink-0 items-center justify-center gap-[3px] rounded-full border border-[#FF003C]/70 bg-[#141517]"
    >
      <img src={historyIcon} alt="" className="h-[12px] w-[13px]" />
      <img
        src={arrowIcon}
        alt=""
        className={`h-[6px] w-[8px] transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}



/* ---------------- fake live bets ---------------- */

const NAMES = [
  "dhruv5", "Rohan22", "kabir9", "Simran", "monty", "Arjunv", "poojal", "Nikkii",
  "bunny7", "Vikky", "jassn", "Tanuu", "zoya3", "Harryk", "yashs", "Luckyoo",
  "shiva88", "prem01", "kajalr", "imrank", "deepu", "sanjayy", "meena4", "rockz",
  "gagan2", "heena7", "tushar", "vandna", "amit91", "rani12", "sonuk", "priya5",
  "mannu3", "jyoti8", "farhan", "neha01", "gulshan", "riya09", "sameer", "kiranp",
];

type LiveBet = {
  id: number;
  user: string;
  amount: number;
  cashedAt?: number;
  busted?: boolean;
  bal: number;
  target: number;
};

function maskName(n: string) {
  const s = n.replace(/\s+/g, "").toLowerCase();
  if (s.length < 3) return s;
  return `${s[0]}${"*".repeat(Math.max(3, Math.min(7, s.length - 2)))}${s[s.length - 1]}`;
}

// realistic cash-out target: most players bail early, a few chase big multipliers,
// and a chunk never cash out at all (target far above any realistic crash).
function makeTarget(r: number) {
  if (r < 0.28) return 0; // greedy players who never cash out -> they bust
  if (r < 0.72) return Math.round((1.15 + (r - 0.28) * 3.2) * 100) / 100;
  if (r < 0.93) return Math.round((2.6 + (r - 0.72) * 22) * 100) / 100;
  return Math.round((7 + (r - 0.93) * 260) * 100) / 100;
}

function makeBets(seed: number): LiveBet[] {
  const out: LiveBet[] = [];
  const n = 46 + (seed % 24);
  const base = [50, 100, 200, 310, 500, 881, 1000, 2500, 5000];
  for (let i = 0; i < n; i += 1) {
    const pick = base[(seed * 7 + i * 11) % base.length]!;
    // slight organic jitter so amounts don't look generated
    const amt = pick + ((seed * 13 + i * 17) % 5) * (pick >= 500 ? 10 : 1);
    const r = ((seed * 37 + i * 61) % 1000) / 1000;
    out.push({
      id: seed * 100 + i + Math.floor(Math.random() * 7),
      user: NAMES[(seed * 3 + i * 5) % NAMES.length]!,
      amount: amt,
      bal: 500 + ((seed * 91 + i * 137) % 96000),
      target: makeTarget(r),
    });
  }
  // biggest bets on top like the real lobby
  out.sort((a, b) => b.amount - a.amount);
  return out;
}


/* ---------------- bet panel ---------------- */

type PanelState = {
  amount: number;
  staged: boolean; // queued for next round
  active: boolean; // in play this round
  cashedAt: number | null;
  auto: boolean;
  autoCashout: number;
};

const initialPanel = (amount: number): PanelState => ({
  amount,
  staged: false,
  active: false,
  cashedAt: null,
  auto: false,
  autoCashout: 1.1,
});

const QUICK = [10, 50, 100, 500, 1000, 2500, 5000, 10000];

function BetPanel({
  state,
  setState,
  phase,
  multiplier,
  onWin,
  balance,
  mode,
}: {
  state: PanelState;
  setState: (fn: (p: PanelState) => PanelState) => void;
  phase: Phase;
  multiplier: number;
  onWin: (amount: number) => void;
  balance: number;
  mode: "bet" | "auto";
}) {
  const canCash = phase === "flying" && state.active && state.cashedAt === null;

  const label = canCash
    ? "Cash Out"
    : state.staged || (state.active && state.cashedAt === null)
      ? "Cancel"
      : "Cash In";

  const tone = canCash
    ? "bg-[#F59E0B] hover:bg-[#f8ac2b]"
    : state.staged || state.active
      ? "bg-[#EF0000] hover:bg-[#ff1717]"
      : "bg-[#18C800] hover:bg-[#1ed100]";


  const press = () => {
    if (canCash) {
      const win = state.amount * multiplier;
      onWin(win);
      setState((p) => ({ ...p, cashedAt: multiplier }));
      return;
    }
    if (state.staged || (state.active && state.cashedAt === null)) {
      setState((p) => ({ ...p, staged: false, active: false }));
      return;
    }
    if (state.amount > balance) return;
    setState((p) => ({ ...p, staged: true, cashedAt: null }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <button
        type="button"
        onClick={press}
        className={`rounded-full py-[8px] text-center text-[0.72rem] font-bold text-white shadow-[0_1px_0_rgba(0,0,0,0.4)] sm:py-[10px] sm:text-[0.95rem] ${tone}`}
      >
        {label}
        {canCash ? (
          <span className="ml-1 text-[0.8rem]">{fmt(state.amount * multiplier)}</span>
        ) : null}
      </button>

      {mode === "auto" ? (
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, auto: !p.auto }))}
            aria-pressed={state.auto}
            className={`relative h-[20px] w-[40px] shrink-0 rounded-full transition-colors ${
              state.auto ? "bg-[#18B800]" : "bg-[#2A2C30]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all ${
                state.auto ? "left-[22px]" : "left-[2px]"
              }`}
            />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-[#0B0C0E] px-3 py-[3px]">
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={state.autoCashout}
              onChange={(e) => {
                const v = Number(e.target.value);
                setState((p) => ({ ...p, autoCashout: Number.isFinite(v) ? v : p.autoCashout }));
              }}
              className="min-w-0 flex-1 bg-transparent text-center text-[0.78rem] font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setState((p) => ({ ...p, autoCashout: 1.1, auto: false }))}
              aria-label="Clear auto cashout"
              className="shrink-0 text-[0.8rem] leading-none text-white/45 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {state.cashedAt ? (
        <p className="text-center text-[0.62rem] font-bold text-[#18B800]">
          {fmt(state.cashedAt)}x · {fmt(state.amount * state.cashedAt)}
        </p>
      ) : state.staged ? (
        <p className="text-center text-[0.62rem] font-semibold text-[#9CA3AF]">
          Waiting · {state.amount}
        </p>
      ) : state.active ? (
        <p className="text-center text-[0.62rem] font-semibold text-white/45">{state.amount}</p>
      ) : null}
    </div>
  );
}

/** Mobile slot: own stake grid + auto row + cash-in button (matches mobile reference). */
function MobileBetSlot({
  state,
  setState,
  phase,
  multiplier,
  onWin,
  balance,
  mode,
}: {
  state: PanelState;
  setState: (fn: (p: PanelState) => PanelState) => void;
  phase: Phase;
  multiplier: number;
  onWin: (amount: number) => void;
  balance: number;
  mode: "bet" | "auto";
}) {
  const canCash = phase === "flying" && state.active && state.cashedAt === null;
  const label = canCash
    ? "Cash Out"
    : state.staged || (state.active && state.cashedAt === null)
      ? "Cancel"
      : "Cash In";
  const tone = canCash
    ? "bg-[#F59E0B]"
    : state.staged || state.active
      ? "bg-[#EF0000]"
      : "bg-[#18C800]";

  const press = () => {
    if (canCash) {
      onWin(state.amount * multiplier);
      setState((p) => ({ ...p, cashedAt: multiplier }));
      return;
    }
    if (state.staged || (state.active && state.cashedAt === null)) {
      setState((p) => ({ ...p, staged: false, active: false }));
      return;
    }
    if (state.amount > balance) return;
    setState((p) => ({ ...p, staged: true, cashedAt: null }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      {mode === "auto" ? (
        <div className="flex items-center gap-2">
          <span className="text-[0.66rem] font-semibold text-[#C9CBD1]">Auto</span>
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, auto: !p.auto }))}
            aria-pressed={state.auto}
            className={`relative h-[18px] w-[36px] shrink-0 rounded-full transition-colors ${
              state.auto ? "bg-[#18B800]" : "bg-[#2A2C30]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${
                state.auto ? "left-[20px]" : "left-[2px]"
              }`}
            />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-[5px]">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setState((p) => ({ ...p, amount: q }))}
            className={`rounded-full border bg-[#151618] py-[4px] text-center text-[0.66rem] font-semibold ${
              state.amount === q
                ? "border-[#16C800] text-white"
                : "border-[#44474D] text-[#C9CBD1]"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={press}
        className={`rounded-[8px] py-[10px] text-center text-[0.95rem] font-bold text-white ${tone}`}
      >
        {label}
      </button>

      {mode === "auto" ? (
        <div className="flex items-center gap-1 rounded-full bg-[#0B0C0E] px-2 py-[2px]">
          <input
            type="number"
            step="0.01"
            min="1.01"
            value={state.autoCashout}
            onChange={(e) => {
              const v = Number(e.target.value);
              setState((p) => ({ ...p, autoCashout: Number.isFinite(v) ? v : p.autoCashout }));
            }}
            className="min-w-0 flex-1 bg-transparent text-center text-[0.72rem] font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      ) : null}

      {state.cashedAt ? (
        <p className="text-center text-[0.6rem] font-bold text-[#18B800]">
          {fmt(state.cashedAt)}x · {fmt(state.amount * state.cashedAt)}
        </p>
      ) : null}
    </div>
  );
}





/* ---------------- flight canvas ---------------- */

function FlightStage({
  phase,
  multiplier,
  countdown,
  muted,
  setMuted,
}: {
  phase: Phase;
  multiplier: number;
  countdown: number;
  muted: boolean;
  setMuted: (fn: (v: boolean) => boolean) => void;
}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setT(Date.now());
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  // progress 0..1 across the plot area
  const p = phase === "flying" ? Math.min(1, Math.log(multiplier) / Math.log(25)) : phase === "crashed" ? 1 : 0;
  const W = 760;
  const H = 320;
  const hoverScale = phase === "flying" ? Math.max(0, Math.min(1, multiplier - 2)) : 0;
  const hoverY = Math.sin(t / 1000) * 16 * hoverScale;
  const hoverX = Math.cos(t / 1500) * 34 * hoverScale;
  const x = 40 + p * (W - 200) + hoverX;
  const y = H - 40 - Math.sin(p * 1.35) * (H - 120) + hoverY;
  const flewT = phase === "crashed" ? 1 : 0;
  const px = x + flewT * 360;
  const py = y - flewT * 200;
  const path = `M40,${H - 40} Q ${40 + (x - 40) * 0.62},${H - 40} ${x},${y}`;
  const area = `${path} L ${x},${H - 40} Z`;
  const planeW = 96;
  const planeH = planeW * (74 / 150);
  const tick = (t / 22) % 60;


  // blue -> purple/magenta glow as the multiplier climbs
  const glow = Math.max(0, Math.min(1, (multiplier - 1.5) / 12));
  const glowInner = `rgba(${Math.round(7 + glow * 59)},${Math.round(58 - glow * 38)},${Math.round(97 - glow * 3)},${0.62 + glow * 0.2})`;
  const glowMid = glow > 0.45 ? "rgba(66,20,94,0.42)" : "rgba(7,58,97,0.32)";

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-[#232629] bg-[#030507]">
      {/* spribe-style rotating sun rays from the bottom-left */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-[3%] top-[92%] h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, #101318 0deg 6.5deg, #030507 6.5deg 13deg)",
            borderRadius: "9999px",
            maskImage: "radial-gradient(circle, #000 0%, #000 52%, transparent 82%)",
            WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 52%, transparent 82%)",
            animation: "av-spin 90s linear infinite",
            animationPlayState: phase === "flying" ? "running" : "paused",
          }}
        />
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${glowInner}, ${glowMid} 38%, transparent 68%)`,
            opacity: phase === "flying" ? 1 : 0,
          }}
        />



      </div>
      <style>{`@keyframes av-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes av-prop{to{transform:rotate(360deg)}}
@keyframes av-row-in{from{opacity:0;transform:translateY(-10px) scale(0.98)}to{opacity:1;transform:none}}
.av-row-in{animation:av-row-in .38s cubic-bezier(.2,.8,.3,1)}`}</style>


      <svg viewBox={`0 0 ${W} ${H}`} className="relative block h-[240px] w-full sm:h-[300px] lg:h-[380px]">
        <defs>
          <linearGradient id="av-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF1238" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FF1238" stopOpacity="0.03" />
          </linearGradient>

          <filter id="av-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line x1="40" y1={H - 40} x2={W - 20} y2={H - 40} stroke="#ffffff22" strokeWidth="2" />
        <line x1="40" y1="20" x2="40" y2={H - 40} stroke="#ffffff22" strokeWidth="2" />
        {/* moving axis ticks like the real game */}
        {Array.from({ length: 12 }).map((_, i) => (
          <circle
            key={`bx${i}`}
            cx={70 + ((i * 60 + (phase === "flying" ? -tick : 0) + 720) % 720)}
            cy={H - 24}
            r="2.5"
            fill="#ffffff35"
          />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <circle
            key={`by${i}`}
            cy={H - 70 - ((i * 56 + (phase === "flying" ? tick : 0)) % 240)}
            cx="24"
            r="2.5"
            fill="#20BFFF"
          />
        ))}

        {/* plane parked at the start position while waiting */}
        {phase === "betting" ? (
          <image
            href={PLANE_FRAMES[0]}
            x={18}
            y={H - 40 - planeH * 0.62}
            width={planeW}
            height={planeH}
            opacity={0.95}
          />
        ) : null}

        {phase === "flying" ? (
          <>
            <path d={area} fill="url(#av-area)" />
            <path
              d={path}
              fill="none"
              stroke="#FF1238"
              strokeWidth="4.5"
              strokeLinecap="round"
              filter="url(#av-glow)"
            />

            <image
              href={PLANE_FRAMES[0]}
              x={px - planeW * 0.72}
              y={py - planeH * 0.62}
              width={planeW}
              height={planeH}
            />


          </>
        ) : null}
      </svg>

      <button
        type="button"
        onClick={() => setMuted((v) => !v)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute left-3 top-2 z-10 text-white/85"
      >
        <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
          <path d="M2 6.5h3L9.5 3v12L5 11.5H2z" fill="currentColor" />
          {muted ? (
            <>
              <path d="M13 6.5l5 5M18 6.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M13 6a4 4 0 010 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              <path d="M15.5 4a7 7 0 010 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </>
          )}
        </svg>
      </button>


      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === "betting" ? (
          <>
            <img
              src={propellerImg.url}
              alt=""
              aria-hidden="true"
              className="mb-2 h-[64px] w-[64px] sm:mb-3 sm:h-[110px] sm:w-[110px]"
              style={{ animation: "av-prop 2.6s linear infinite" }}
            />

            <p className="px-4 text-center text-[1.15rem] uppercase tracking-[0.02em] text-white sm:text-[2rem]">
              Waiting for next round
            </p>
            <div className="mt-4 h-[5px] w-[200px] overflow-hidden rounded-full bg-[#3A3D42] sm:w-[240px]">
              <div
                className="h-full rounded-full bg-[#EF1B2E]"
                style={{ width: `${Math.max(0, Math.min(100, (countdown / BET_MS) * 100))}%` }}
              />
            </div>
          </>


        ) : phase === "crashed" ? (
          <>
            <p className="text-[1.35rem] font-medium uppercase tracking-[0.01em] text-white sm:text-[2.1rem]">
              Flew Away!
            </p>

            <p className="mt-1 text-[2.8rem] font-extrabold leading-none text-[#FF1238] drop-shadow-[0_4px_14px_rgba(0,0,0,.7)] sm:text-[4.6rem] lg:text-[5.6rem]">
              {fmt(multiplier)}x
            </p>
          </>
        ) : (
          <p className="text-[2.9rem] font-extrabold leading-none text-white drop-shadow-[0_6px_26px_rgba(0,0,0,.65)] sm:text-[4.8rem] lg:text-[6.4rem]">
            {fmt(multiplier)}x
          </p>
        )}


      </div>
    </div>
  );
}


/* ---------------- main ---------------- */

type MyBet = { round: number; amount: number; cashedAt: number | null; crash: number };



export function Aviator() {
  const { admin, cfg } = useAdminConfig();
  const avRef = useRef<AviatorControl | null>(null);
  avRef.current = admin ? cfg.aviator : null;

  const [tab, setTab] = useState<"all" | "my" | "top">("all");
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [phase, setPhase] = useState<Phase>("betting");
  const [multiplier, setMultiplier] = useState(1);
  const [countdown, setCountdown] = useState(BET_MS);
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState<number[]>([2.31, 1.14, 5.62, 1.02, 11.4, 1.87, 3.05, 1.45, 4.35, 23.12, 2.53, 1.46, 3.53, 1.4, 14.99, 11.63, 3.68, 3.1, 1.75, 7.28, 1.79, 1.02, 1.0, 1.78, 27.0, 2.03, 2.45, 2.3, 2.48, 4.03]);
  const [round, setRound] = useState(1);
  const [balance, setBalance] = useState(5000);
  const [bets, setBets] = useState<LiveBet[]>(() => makeBets(1));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [feed, setFeed] = useState<{ id: number; text: string; kind: "join" | "leave" | "win" }[]>([]);
  const [online, setOnline] = useState(1842);
  const [muted, setMuted] = useState(true);
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const sfx = useCallback(
    (src: string, vol = 0.6) => {
      if (muted) return;
      try {
        const a = new Audio(src);
        a.volume = vol;
        void a.play();
      } catch {
        /* autoplay blocked */
      }
    },
    [muted],
  );


  const [slots, setSlots] = useState<PanelState[]>(() => [100, 100, 100, 100].map(initialPanel));
  const setSlot = useCallback(
    (i: number, fn: (p: PanelState) => PanelState) =>
      setSlots((s) => s.map((p, j) => (j === i ? fn(p) : p))),
    [],
  );
  const setAllSlots = useCallback(
    (fn: (p: PanelState) => PanelState) => setSlots((s) => s.map(fn)),
    [],
  );
  const [mode, setMode] = useState<"bet" | "auto">("bet");


  const crashRef = useRef(1);
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>("betting");
  phaseRef.current = phase;

  // official results feed (same upstream round series as the live crash game)
  const seenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<number[]>([]); // unused official winners, oldest first
  const bootedRef = useRef(false);

  useEffect(() => {
    let stop = false;
    let busy = false;
    const pull = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        const ctrl = new AbortController();
        const to = window.setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch("/api/public/uapi/games/88.0023/results", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        window.clearTimeout(to);
        const json = (await res.json()) as { data?: { roundId?: string; winner?: string }[] };
        const rows = Array.isArray(json?.data) ? json.data : [];
        if (!rows.length) return;
        // newest first from upstream
        const fresh: number[] = [];
        for (const r of rows) {
          const id = String(r?.roundId ?? "");
          const w = Number(r?.winner);
          if (!id || !(w > 0)) continue;
          if (seenRef.current.has(id)) continue;
          seenRef.current.add(id);
          fresh.push(w);
        }
        if (bootedRef.current && fresh.length) {
          // push oldest-first into the queue so rounds play out in real order
          queueRef.current.push(...fresh.reverse());
          if (queueRef.current.length > 12) queueRef.current = queueRef.current.slice(-12);
        }
        bootedRef.current = true;
        const strip = rows
          .map((r) => Number(r?.winner))
          .filter((n) => n > 0)
          .slice(0, 24);
        if (strip.length) setHistory(strip);
      } catch {
        /* keep last known results */
      } finally {
        busy = false;
        if (!stop) window.setTimeout(pull, 1500);
      }
    };
    void pull();
    return () => {
      stop = true;
    };
  }, []);


  const win = useCallback((amt: number) => {
    setBalance((b) => Math.round((b + amt) * 100) / 100);
    sfx(winSound.url, 0.65);
  }, [sfx]);

  // round loop
  useEffect(() => {
    let raf = 0;
    let mounted = true;

    const beginBetting = () => {
      const ctl = avRef.current;
      crashRef.current =
        ctl && ctl.mode === "never"
          ? 1
          : ctl && ctl.mode === "forced"
            ? Math.max(1, ctl.crash)
            : randomCrash();
      startRef.current = performance.now();
      setPhase("betting");
      setMultiplier(1);
      setBets(makeBets(Math.floor(Math.random() * 999) + 1));
      const tick = () => {
        if (!mounted) return;
        const left = BET_MS - (performance.now() - startRef.current);
        setCountdown(Math.max(0, left));
        if (left <= 0) {
          beginFlight();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const beginFlight = () => {
      // stage bets
      setSlots((list) =>
        list.map((p) =>
          p.staged
            ? { ...p, staged: false, active: true, cashedAt: null }
            : { ...p, active: false, cashedAt: null },
        ),
      );

      setBalance((b) => b);
      startRef.current = performance.now();
      setPhase("flying");
      const tick = () => {
        if (!mounted) return;
        const t = (performance.now() - startRef.current) / 1000;
        const m = Math.max(1, Math.round(Math.pow(Math.E, 0.045 * t * (1 + t * 0.012)) * 100) / 100);
        if (m >= crashRef.current) {
          setMultiplier(crashRef.current);
          setPhase("crashed");
          setHistory((h) => [crashRef.current, ...h].slice(0, 24));
          setRound((r) => r + 1);
          // everyone who did not cash out before the crash loses the round
          setBets((list) =>
            list.map((b) =>
              b.cashedAt === undefined ? { ...b, busted: true, bal: Math.max(0, b.bal - b.amount) } : b,
            ),
          );
          window.setTimeout(() => {
            if (mounted) beginBetting();
          }, CRASH_HOLD_MS);
          return;
        }
        setMultiplier(m);
        setBets((list) =>
          list.map((b) =>
            b.cashedAt === undefined && b.target > 1 && b.target <= m
              ? {
                  ...b,
                  cashedAt: Math.round(b.target * 100) / 100,
                  bal: Math.round(b.bal + b.amount * (b.target - 1)),
                }
              : b,
          ),
        );

        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    beginBetting();
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // deduct stake when flight starts
  useEffect(() => {
    if (phase !== "flying") return;
    let stake = 0;
    for (const p of slots) if (p.active && p.cashedAt === null) stake += p.amount;
    if (stake) setBalance((b) => Math.round((b - stake) * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // auto cashout
  useEffect(() => {
    if (phase !== "flying") return;
    slots.forEach((p, i) => {
      if (p.auto && p.active && p.cashedAt === null && multiplier >= p.autoCashout) {
        win(p.amount * p.autoCashout);
        setSlot(i, (q) => ({ ...q, cashedAt: q.autoCashout }));
      }
    });
  }, [multiplier, phase, slots, win, setSlot]);

  // record my bets when the round settles
  useEffect(() => {
    if (phase !== "crashed") return;
    const rows: MyBet[] = [];
    for (const p of slots) {
      if (p.active) rows.push({ round, amount: p.amount, cashedAt: p.cashedAt, crash: multiplier });
    }

    if (rows.length) {
      setMyBets((m) => [...rows, ...m].slice(0, 40));
      for (const r of rows) {
        logBet({
          ts: Date.now(),
          gameId: "88.0030",
          gameName: "Aviator",
          round: String(r.round),
          stake: r.amount,
          multiplier: r.cashedAt,
          payout: r.cashedAt ? Math.round(r.amount * r.cashedAt * 100) / 100 : 0,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    saveBalance(balance);
  }, [balance]);

  // engine loop while the plane is in the air
  useEffect(() => {
    if (muted) {
      bgRef.current?.pause();
      return;
    }
    if (phase === "flying") {
      if (!bgRef.current) {
        const a = new Audio(bgSound.url);
        a.loop = true;
        a.volume = 0.35;
        bgRef.current = a;
      }
      void bgRef.current.play().catch(() => undefined);
    } else {
      bgRef.current?.pause();
    }
  }, [phase, muted]);

  useEffect(() => () => bgRef.current?.pause(), []);

  // crash sound
  useEffect(() => {
    if (phase === "crashed") sfx(crashSound.url, 0.7);
  }, [phase, sfx]);

  // countdown beeps 3..2..1
  const beepRef = useRef(-1);
  useEffect(() => {
    if (phase !== "betting") {
      beepRef.current = -1;
      return;
    }
    const secs = Math.ceil(countdown / 1000);
    if (secs <= 3 && secs >= 1 && beepRef.current !== secs) {
      beepRef.current = secs;
      sfx(beepSound.url, 0.5);
    }
  }, [countdown, phase, sfx]);

  // players keep joining (betting + flying) — new rows animate in at the top
  const [freshIds, setFreshIds] = useState<number[]>([]);
  useEffect(() => {
    if (phase === "crashed") return;
    const id = window.setInterval(() => {
      const seed = Math.floor(Math.random() * 9999);
      const extra = makeBets(seed).slice(0, 1 + (seed % 2));
      if (!extra.length) return;
      setBets((list) => (list.length > 140 ? [...extra, ...list.slice(0, 140)] : [...extra, ...list]));
      const ids = extra.map((b) => b.id);
      setFreshIds((f) => [...ids, ...f].slice(0, 24));
      window.setTimeout(() => setFreshIds((f) => f.filter((x) => !ids.includes(x))), 600);
    }, phase === "betting" ? 480 : 800);
    return () => window.clearInterval(id);
  }, [phase]);


  // live join / leave ticker + online counter
  useEffect(() => {
    const id = window.setInterval(() => {
      const name = maskName(NAMES[Math.floor(Math.random() * NAMES.length)]!);
      const kind = Math.random() < 0.62 ? "join" : "leave";
      const delta = kind === "join" ? 1 + Math.floor(Math.random() * 6) : -(1 + Math.floor(Math.random() * 5));
      setOnline((o) => Math.max(900, Math.min(4800, o + delta)));
      setFeed((f) =>
        [
          {
            id: Date.now() + Math.random(),
            kind: kind as "join" | "leave",
            text: kind === "join" ? `${name} joined the table` : `${name} left the table`,
          },
          ...f,
        ].slice(0, 20),
      );
    }, 1600);
    return () => window.clearInterval(id);
  }, []);

  // announce real cash-outs in the feed
  useEffect(() => {
    if (phase !== "flying") return;
    const id = window.setInterval(() => {
      const done = bets.filter((b) => b.cashedAt !== undefined);
      if (!done.length) return;
      const b = done[Math.floor(Math.random() * done.length)]!;
      setFeed((f) =>
        [
          {
            id: Date.now() + Math.random(),
            kind: "win" as const,
            text: `${maskName(b.user)} cashed out ${fmt(b.cashedAt!)}x · ${fmt(b.amount * b.cashedAt!)}`,
          },
          ...f,
        ].slice(0, 20),
      );
    }, 1400);
    return () => window.clearInterval(id);
  }, [phase, bets]);



  return (
    <div className="overflow-hidden rounded-[16px] border border-[#303238] bg-[#090A0C] p-1.5 sm:p-2">
      <div className="grid items-stretch gap-2 lg:h-[680px] lg:grid-cols-[minmax(340px,27%)_1fr]">
        {/* bets + chat */}
        <div className="order-2 flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#303238] bg-[#151618] p-1.5 lg:order-1 sm:p-2">

          <div className="mx-auto flex w-full max-w-[280px] rounded-full bg-[#0B0C0E] p-[3px] text-[0.68rem] font-bold text-white/55 sm:w-[86%] sm:text-[0.72rem]">
            {([["all", "All Bets"], ["my", "My Bets"]] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex-1 rounded-full px-2 py-[4px] ${
                  tab === k ? "bg-[#2C2D30] text-white" : ""
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "all" ? (
            <div className="mt-2 flex items-start justify-between text-[0.78rem] font-bold text-white/85">
              <span className="flex flex-col leading-tight">
                ALL BETS
                <span className="text-[0.74rem] font-semibold text-white/60">{bets.length}</span>
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span>Users</span>
                <span className="text-[0.74rem] font-semibold text-white/60">{online.toLocaleString()}</span>
              </span>


            </div>
          ) : null}

          {tab === "my" ? (
            <div className="mt-2 flex items-start justify-between text-[0.78rem] font-bold text-white/85">
              <span className="flex flex-col leading-tight">
                MY BETS
                <span className="text-[0.74rem] font-semibold text-white/60">
                  {myBets.length + slots.filter((p) => p.staged || p.active).length}
                </span>
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span>Balance</span>
                <span className="text-[0.74rem] font-semibold text-[#18C800]">{fmt(balance)}</span>
              </span>
            </div>
          ) : null}

          <div className="mt-2 grid grid-cols-[1fr_38px_44px_54px] gap-x-2 border-b border-white/10 px-2 pb-1 text-[0.65rem] font-semibold text-white/40">
            <span>{tab === "my" ? "Round" : "User"}</span>
            <span>Bet</span>
            <span>X</span>
            <span className="text-right">Cash out</span>
          </div>

          <div
            className="flex h-[340px] w-full min-w-0 flex-1 flex-col gap-0 overflow-y-auto overflow-x-hidden overscroll-contain pt-1 lg:h-0 lg:min-h-0"
            style={{
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              display: "flex",
              flexDirection: "column",
            }}
          >


            {tab === "my"
              ? [
                  ...slots
                    .filter((p) => p.staged || p.active)
                    .map((p, i) => (
                      <div
                        key={`live-${i}`}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 rounded-[7px] border border-[#20BFFF]/40 bg-[#0C1C2B] px-1.5 py-[5px] text-[0.68rem] text-white sm:gap-x-3 sm:px-2 sm:text-[0.72rem]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <img src={AVATARS[0]} alt="" className="h-[22px] w-[22px] rounded-full object-cover" />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate font-semibold text-[#20BFFF]">You</span>
                            <span className="text-[0.6rem] text-white/45">
                              #{round} {p.staged ? "queued" : "live"}
                            </span>
                          </span>
                        </span>
                        <span className="font-semibold">{p.amount}</span>
                        <span className="rounded-full bg-[#0B1B27] px-[6px] py-[1px] text-[0.62rem] font-bold text-[#20BFFF]">
                          {p.cashedAt ? `${fmt(p.cashedAt)}x` : phase === "flying" ? `${fmt(multiplier)}x` : "—"}
                        </span>
                        <span className="text-right font-bold">
                          {p.cashedAt ? fmt(p.amount * p.cashedAt) : ""}
                        </span>
                      </div>
                    )),
                  ...myBets.map((b, i) => (
                    <div
                      key={`${b.round}-${i}`}
                      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 rounded-[7px] border px-1.5 py-[5px] text-[0.68rem] sm:gap-x-3 sm:px-2 sm:text-[0.72rem] ${
                        b.cashedAt
                          ? "border-[#3B8F20] bg-[#0D4206] text-white"
                          : "border-white/[0.06] bg-[#1A1113] text-white/50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <img src={AVATARS[0]} alt="" className="h-[22px] w-[22px] rounded-full object-cover" />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate font-semibold">You</span>
                          <span className="text-[0.6rem] text-white/40">#{b.round}</span>
                        </span>
                      </span>
                      <span className="font-semibold">{b.amount}</span>
                      <span
                        className={`rounded-full px-[6px] py-[1px] text-[0.62rem] font-bold ${
                          b.cashedAt ? "bg-[#052208] text-[#7CFF56]" : "bg-[#2A1113] text-[#F98080]"
                        }`}
                      >
                        {b.cashedAt ? `${fmt(b.cashedAt)}x` : `${fmt(b.crash)}x`}
                      </span>
                      <span className="text-right font-bold">
                        {b.cashedAt ? fmt(b.amount * b.cashedAt) : ""}
                      </span>
                    </div>
                  )),
                ]
              : bets.slice(0, 80).map((b, i) => {
                  const done = b.cashedAt !== undefined;
                  return (
                    <div
                      key={`${b.id}-${i}`}
                      className={`grid shrink-0 grid-cols-[1fr_38px_44px_54px] items-center gap-x-2 px-2 py-[7px] text-[0.72rem] sm:text-[0.76rem] ${
                        freshIds.includes(b.id) ? "av-row-in" : ""
                      } ${
                        done
                          ? "rounded-[7px] border border-[#3B8F20] bg-[#0D4206] text-white"
                          : "border-b border-white/[0.05] bg-[#131416] text-white/70"
                      }`}

                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <img
                          src={AVATARS[b.id % AVATARS.length]}
                          alt=""
                          loading="lazy"
                          width={96}
                          height={96}
                          className="h-[26px] w-[26px] shrink-0 rounded-full object-cover"
                        />
                        <span className={`truncate ${done ? "font-semibold text-white" : "text-[#7E92B5]"}`}>
                          {maskName(b.user)}
                        </span>
                      </span>
                      <span className={`font-semibold ${done ? "text-white" : "text-white/90"}`}>{b.amount}</span>

                      <span
                        className={`shrink-0 justify-self-start rounded-full px-2 py-[1px] text-[0.65rem] font-bold ${
                          done ? "border border-[#3B8F20]/60 bg-[#052208] text-[#7CFF56]" : ""
                        }`}
                      >
                        {done ? `${fmt(b.cashedAt!)}x` : ""}
                      </span>
                      <span className={`text-right font-bold ${done ? "text-white" : "text-white/25"}`}>
                        {done ? fmt(b.amount * b.cashedAt!) : "—"}
                      </span>
                    </div>
                  );
                })}



            {tab === "my" && myBets.length === 0 ? (
              <p className="py-6 text-center text-[0.72rem] text-white/40">No bets yet</p>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-[2px] border-t border-white/10 px-1 pt-[6px] text-[0.6rem] text-white/45 sm:text-[0.66rem]">
            <span className="flex items-center gap-1">
              This game is
              <img src={fairIcon} alt="" className="h-[13px] w-[12px]" />
              <span className="font-semibold text-white/80">Provably Fair</span>
            </span>
            <span>
              Powered by <span className="font-bold text-white underline">VIMAAN</span>
            </span>
          </div>

        </div>

        {/* stage + panels */}
        <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-2 lg:min-h-0">
          {/* history strip — sits above the flying stage */}
          <div className="rounded-[8px] border border-[#34363B] bg-[#202125] px-3 py-2">
            {histOpen ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.03em] text-white">
                  Round History
                </span>
                <HistToggle open={histOpen} onClick={() => setHistOpen(false)} />
              </div>
            ) : null}

            <div className="flex min-w-0 items-center gap-[6px] sm:gap-2">
              <div
                className={`flex min-w-0 flex-1 items-center gap-x-[6px] gap-y-[5px] sm:gap-x-2 ${
                  histOpen
                    ? "flex-wrap justify-center"
                    : "flex-nowrap overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }`}
              >
                {(histOpen ? history : history.slice(0, 40)).map((h, i) => (
                  <span
                    key={`${h}-${i}`}
                    className={`shrink-0 rounded-full bg-[#090B0E] px-[8px] py-[2px] text-[0.68rem] font-semibold sm:text-[0.72rem] ${chipTone(h)}`}
                  >
                    {fmt(h)}x
                  </span>
                ))}
              </div>
              {histOpen ? null : <HistToggle open={histOpen} onClick={() => setHistOpen(true)} />}
            </div>
          </div>



          <FlightStage phase={phase} multiplier={multiplier} countdown={countdown} muted={muted} setMuted={setMuted} />

          <div className="rounded-[12px] border border-[#292D32] bg-[#111315] p-[10px] sm:p-3">
            <div className="mx-auto mb-2 flex w-[200px] rounded-full bg-[#0B0C0E] p-[3px] text-[0.72rem] font-bold text-white/55">
              {(["bet", "auto"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                  }}
                  className={`flex-1 rounded-full py-[4px] capitalize ${
                    mode === m ? "bg-[#2C2D30] text-white" : ""
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* mobile: two slots with own stake grids + center action column */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-[8px] sm:hidden">
              <MobileBetSlot
                state={slots[0]!}
                setState={(fn) => setSlot(0, fn)}
                phase={phase}
                multiplier={multiplier}
                onWin={win}
                balance={balance}
                mode={mode}
              />
              <div className="flex w-[62px] flex-col gap-[6px] pt-[6px]">
                <button
                  type="button"
                  onClick={() => {
                    const v = Number(window.prompt("Custom stake", String(slots[0]!.amount)) ?? "");
                    if (Number.isFinite(v) && v >= 10) setAllSlots((p) => ({ ...p, amount: v }));
                  }}
                  className="rounded-full bg-[#F59E0B] py-[5px] text-[0.7rem] font-bold text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setAllSlots((p) => ({ ...p, amount: 10, staged: false }))}
                  className="rounded-full bg-[#EF0000] py-[5px] text-[0.7rem] font-bold text-white"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setAllSlots((p) => ({ ...p, amount: 10 }))}
                  className="rounded-full border border-[#44474D] bg-[#151618] py-[5px] text-[0.7rem] font-semibold text-[#9CA3AF]"
                >
                  Min
                </button>
                <button
                  type="button"
                  onClick={() => setAllSlots((p) => ({ ...p, amount: 10000 }))}
                  className="rounded-full border border-[#44474D] bg-[#151618] py-[5px] text-[0.7rem] font-semibold text-[#9CA3AF]"
                >
                  Max
                </button>
              </div>
              <MobileBetSlot
                state={slots[1]!}
                setState={(fn) => setSlot(1, fn)}
                phase={phase}
                multiplier={multiplier}
                onWin={win}
                balance={balance}
                mode={mode}
              />
            </div>

            <div className="hidden grid-cols-4 gap-[6px] sm:grid sm:gap-[8px]">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAllSlots((p) => ({ ...p, amount: q }))}
                  className={`rounded-full border bg-[#151618] py-[6px] text-center text-[0.68rem] font-semibold transition-colors sm:py-[7px] sm:text-[0.82rem] ${
                    slots[0]!.amount === q
                      ? "border-[#16C800] text-white"
                      : "border-[#44474D] text-[#C9CBD1] hover:text-white"
                  }`}
                >
                  {q}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setAllSlots((p) => ({ ...p, amount: 10 }))}
                className="rounded-full border border-[#44474D] bg-[#151618] py-[6px] text-[0.68rem] font-semibold text-[#9CA3AF] sm:py-[7px] sm:text-[0.82rem]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={() => setAllSlots((p) => ({ ...p, amount: 10000 }))}
                className="rounded-full border border-[#44474D] bg-[#151618] py-[6px] text-[0.68rem] font-semibold text-[#9CA3AF] sm:py-[7px] sm:text-[0.82rem]"
              >
                Max
              </button>
              <button
                type="button"
                onClick={() => {
                  const v = Number(window.prompt("Custom stake", String(slots[0]!.amount)) ?? "");
                  if (Number.isFinite(v) && v >= 10) setAllSlots((p) => ({ ...p, amount: v }));
                }}
                className="rounded-full bg-[#F59E0B] py-[6px] text-[0.68rem] font-bold text-white sm:py-[7px] sm:text-[0.82rem]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setAllSlots((p) => ({ ...p, amount: 10, staged: false }))}
                className="rounded-full bg-[#EF0000] py-[6px] text-[0.68rem] font-bold text-white sm:py-[7px] sm:text-[0.82rem]"
              >
                Clear
              </button>
            </div>

            <div className="mt-2 hidden grid-cols-4 gap-[6px] sm:mt-3 sm:grid sm:gap-[8px]">
              {slots.map((s, i) => (
                <BetPanel
                  key={i}
                  state={s}
                  setState={(fn) => setSlot(i, fn)}
                  phase={phase}
                  multiplier={multiplier}
                  onWin={win}
                  balance={balance}
                  mode={mode}
                />
              ))}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
