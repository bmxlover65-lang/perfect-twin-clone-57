import { useCallback, useEffect, useRef, useState } from "react";
import plane0 from "@/assets/aviator/plane-0.svg";
import plane1 from "@/assets/aviator/plane-1.svg";
import plane2 from "@/assets/aviator/plane-2.svg";
import plane3 from "@/assets/aviator/plane-3.svg";
import historyIcon from "@/assets/aviator/history.svg";
import arrowIcon from "@/assets/aviator/arrow-down.svg";
import fairIcon from "@/assets/aviator/provably-fair.svg";

import { type AviatorControl, useAdminConfig } from "@/lib/admin";
import { logBet, setBalance as saveBalance } from "@/lib/telemetry";

const PLANE_FRAMES = [plane0, plane1, plane2, plane3];

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

function toneFor(m: number) {
  if (m < 2) return "text-[#20BFFF]";
  if (m < 10) return "text-[#913EF8]";
  return "text-[#C017B4]";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function chipTone(m: number) {
  if (m < 2) return "border-[#20BFFF]/40 text-[#20BFFF]";
  if (m < 10) return "border-[#913EF8]/40 text-[#913EF8]";
  return "border-[#C017B4]/40 text-[#C017B4]";
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
  target: number;
};

function maskName(n: string) {
  const s = n.replace(/\s+/g, "").toLowerCase();
  if (s.length < 3) return s;
  return `${s[0]}${"*".repeat(Math.max(3, Math.min(7, s.length - 2)))}${s[s.length - 1]}`;
}

function makeBets(seed: number): LiveBet[] {
  const out: LiveBet[] = [];
  const n = 46 + (seed % 24);
  const base = [50, 100, 200, 310, 500, 881, 1000, 2500, 5000];
  for (let i = 0; i < n; i += 1) {
    const pick = base[(seed * 7 + i * 11) % base.length]!;
    // slight organic jitter so amounts don't look generated
    const amt = pick + ((seed * 13 + i * 17) % 5) * (pick >= 500 ? 10 : 1);
    out.push({
      id: seed * 100 + i,
      user: NAMES[(seed * 3 + i * 5) % NAMES.length]!,
      amount: amt,
      target: 1.15 + ((seed * 13 + i * 29) % 850) / 100,
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
  autoCashout: 2,
});

const QUICK = [10, 50, 100, 500, 1000, 2500, 5000, 10000];

function BetPanel({
  state,
  setState,
  phase,
  multiplier,
  onWin,
  balance,
}: {
  state: PanelState;
  setState: (fn: (p: PanelState) => PanelState) => void;
  phase: Phase;
  multiplier: number;
  onWin: (amount: number) => void;
  balance: number;
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
      : "bg-[#18B800] hover:bg-[#1ed100]";


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
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[0.72rem] font-semibold text-[#9CA3AF]">Auto</span>
        <button
          type="button"
          role="switch"
          aria-checked={state.auto}
          onClick={() => setState((p) => ({ ...p, auto: !p.auto }))}
          className={`relative h-[20px] w-[40px] rounded-full transition-colors ${
            state.auto ? "bg-[#18B800]" : "bg-[#303238]"
          }`}
        >
          <span
            className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all ${
              state.auto ? "left-[22px]" : "left-[2px]"
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-[5px]">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setState((p) => ({ ...p, amount: q }))}
            className={`rounded-full border bg-transparent py-[5px] text-center text-[0.72rem] font-semibold transition-colors ${
              state.amount === q
                ? "border-[#18B800] text-white shadow-[0_0_0_1px_rgba(24,184,0,0.45)]"
                : "border-[#4A4C52] text-[#C9CBD1] hover:text-white"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={press}
        className={`rounded-[10px] py-[11px] text-center text-[1rem] font-bold text-white shadow-[0_2px_0_rgba(0,0,0,0.35)] ${tone}`}
      >
        {label}
        {canCash ? (
          <span className="ml-1 text-[0.8rem]">{fmt(state.amount * multiplier)}</span>
        ) : null}
      </button>

      {state.cashedAt ? (
        <p className="text-center text-[0.7rem] font-bold text-[#18B800]">
          Cashed out {fmt(state.cashedAt)}x · {fmt(state.amount * state.cashedAt)} INR
        </p>
      ) : state.staged ? (
        <p className="text-center text-[0.7rem] font-semibold text-[#9CA3AF]">
          Waiting for next round
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
}: {
  phase: Phase;
  multiplier: number;
  countdown: number;
}) {
  const [frame, setFrame] = useState(0);
  const [muted, setMuted] = useState(true);
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % 4);
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


  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[#303238] bg-[#05070A]">
      {/* spribe-style rotating sun rays */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-[5%] top-[88%] h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-45"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, #101317 0deg 6deg, #050608 6deg 12deg)",
            borderRadius: "9999px",
            maskImage: "radial-gradient(circle, #000 0%, #000 45%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 45%, transparent 78%)",
            animation: "av-spin 90s linear infinite",
            animationPlayState: phase === "flying" ? "running" : "paused",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_112%,rgba(190,25,25,0.28),transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(20,90,190,0.35),transparent_55%)]" />
      </div>
      <style>{`@keyframes av-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes av-prop{to{transform:rotate(360deg)}}`}</style>

      <svg viewBox={`0 0 ${W} ${H}`} className="relative block h-[240px] w-full sm:h-[300px] lg:h-[380px]">
        <defs>
          <linearGradient id="av-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E01E1E" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#E01E1E" stopOpacity="0.02" />
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
            fill="#2FA8F5"
          />
        ))}


        {phase !== "betting" ? (
          <>
            <path d={area} fill="url(#av-area)" />
            <path
              d={path}
              fill="none"
              stroke="#E01E1E"
              strokeWidth="5"
              strokeLinecap="round"
              filter="url(#av-glow)"
            />
            <image
              href={PLANE_FRAMES[phase === "crashed" ? 0 : frame]}
              x={px - planeW * 0.72}
              y={py - planeH * 0.62}
              width={planeW}
              height={planeH}
              opacity={phase === "crashed" ? 0 : 1}
              style={{
                transition:
                  phase === "crashed" ? "opacity 1.1s linear, x 1.1s linear, y 1.1s linear" : "none",
              }}
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
              src={PLANE_FRAMES[frame]}
              alt=""
              className="mb-3 h-[26px] w-[52px] opacity-90 sm:h-[32px] sm:w-[64px]"
            />
            <p className="px-4 text-center text-[0.95rem] font-bold uppercase tracking-[0.05em] text-white sm:text-[1.35rem]">
              Waiting for next round
            </p>
            <div className="mt-3 h-[4px] w-[168px] overflow-hidden rounded-full bg-white/10 sm:w-[220px]">
              <div
                className="h-full rounded-full bg-[#FF003C]"
                style={{ width: `${Math.max(0, Math.min(100, (countdown / BET_MS) * 100))}%` }}
              />
            </div>
          </>

        ) : phase === "crashed" ? (
          <>
            <p className="text-[0.8rem] font-extrabold uppercase tracking-[0.18em] text-[#E01E1E] sm:text-[1.15rem]">
              Flew Away!
            </p>

            <p className="text-[2rem] font-extrabold leading-none text-[#E01E1E] drop-shadow-[0_4px_14px_rgba(0,0,0,.7)] sm:text-[3.4rem]">
              {fmt(multiplier)}x
            </p>
          </>
        ) : (
          <p className="text-[2.1rem] font-extrabold leading-none text-white drop-shadow-[0_4px_14px_rgba(0,0,0,.6)] sm:text-[3.6rem]">
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

  const [p1, setP1] = useState<PanelState>(() => initialPanel(100));
  const [p2, setP2] = useState<PanelState>(() => initialPanel(200));

  const crashRef = useRef(1);
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>("betting");
  phaseRef.current = phase;

  const win = useCallback((amt: number) => setBalance((b) => Math.round((b + amt) * 100) / 100), []);

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
      setP1((p) => (p.staged ? { ...p, staged: false, active: true, cashedAt: null } : { ...p, active: false, cashedAt: null }));
      setP2((p) => (p.staged ? { ...p, staged: false, active: true, cashedAt: null } : { ...p, active: false, cashedAt: null }));
      setBalance((b) => b);
      startRef.current = performance.now();
      setPhase("flying");
      const tick = () => {
        if (!mounted) return;
        const t = (performance.now() - startRef.current) / 1000;
        const m = Math.max(1, Math.round(Math.pow(Math.E, 0.065 * t * (1 + t * 0.035)) * 100) / 100);
        if (m >= crashRef.current) {
          setMultiplier(crashRef.current);
          setPhase("crashed");
          setHistory((h) => [crashRef.current, ...h].slice(0, 24));
          setRound((r) => r + 1);
          window.setTimeout(() => {
            if (mounted) beginBetting();
          }, CRASH_HOLD_MS);
          return;
        }
        setMultiplier(m);
        setBets((list) =>
          list.map((b) => (b.cashedAt === undefined && b.target <= m ? { ...b, cashedAt: m } : b)),
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
    if (p1.active && p1.cashedAt === null) stake += p1.amount;
    if (p2.active && p2.cashedAt === null) stake += p2.amount;
    if (stake) setBalance((b) => Math.round((b - stake) * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // auto cashout
  useEffect(() => {
    if (phase !== "flying") return;
    if (p1.auto && p1.active && p1.cashedAt === null && multiplier >= p1.autoCashout) {
      win(p1.amount * p1.autoCashout);
      setP1((p) => ({ ...p, cashedAt: p.autoCashout }));
    }
    if (p2.auto && p2.active && p2.cashedAt === null && multiplier >= p2.autoCashout) {
      win(p2.amount * p2.autoCashout);
      setP2((p) => ({ ...p, cashedAt: p.autoCashout }));
    }
  }, [multiplier, phase, p1, p2, win]);

  // record my bets when the round settles
  useEffect(() => {
    if (phase !== "crashed") return;
    const rows: MyBet[] = [];
    for (const p of [p1, p2]) {
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

  // players keep joining while the plane flies (feels like a real lobby)
  useEffect(() => {
    if (phase !== "flying") return;
    const id = window.setInterval(() => {
      setBets((list) => {
        if (list.length > 110) return list;
        const seed = Math.floor(Math.random() * 9999);
        const extra = makeBets(seed).slice(0, 1 + (seed % 3));
        return [...list, ...extra];
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [phase]);

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#303238] bg-[#090A0C] p-1.5 sm:p-2">
      {/* history strip */}
      <div className="mb-2 rounded-[12px] border border-[#303238] bg-[#141518] px-3 py-[6px]">
        <div className="flex items-center gap-2">
          <div
            className={`flex min-w-0 flex-1 items-center gap-[6px] sm:gap-2 ${
              histOpen
                ? "max-h-[120px] flex-wrap overflow-y-auto"
                : "flex-nowrap overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            }`}
          >
            {(histOpen ? history : history.slice(0, 30)).map((h, i) => (
              <span
                key={`${h}-${i}`}
                className={`shrink-0 rounded-full bg-[#0B0C0E] px-2.5 py-[3px] text-[0.72rem] font-bold sm:text-[0.82rem] ${toneFor(h)}`}
              >
                {fmt(h)}x
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setHistOpen((v) => !v)}
            aria-expanded={histOpen}
            className="flex h-[26px] shrink-0 items-center gap-1 rounded-full border border-[#FF003C]/60 px-2"
            aria-label="Round history"
          >
            <img src={historyIcon} alt="" className="h-[13px] w-[14px]" />
            <img
              src={arrowIcon}
              alt=""
              className={`h-[8px] w-[10px] transition-transform ${histOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[400px_1fr]">
        {/* bets + chat */}
        <div className="order-2 min-w-0 rounded-[14px] border border-[#303238] bg-[#151618] p-1.5 lg:order-1 sm:p-2">

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
                Users
                <span className="text-[0.74rem] font-semibold text-white/60">{myBets.length}</span>
              </span>
            </div>
          ) : null}

          <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-2 border-b sm:gap-x-3 border-white/10 pb-1 text-[0.62rem] font-semibold text-white/40">
            <span>{tab === "my" ? "Round" : "User"}</span>
            <span>Bet&nbsp;&nbsp;X</span>
            <span></span>
            <span className="text-right">Cash out</span>
          </div>





          <div className="max-h-[340px] space-y-[3px] overflow-y-auto pt-1 lg:max-h-[560px]">
            {tab === "my"
              ? myBets.map((b, i) => (
                  <div
                    key={`${b.round}-${i}`}
                    className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-2 rounded-[6px] px-1 sm:gap-x-3 py-[4px] text-[0.72rem] ${
                      b.cashedAt ? "bg-[#123A18] text-[#8CFF6B]" : "bg-[#3A1212] text-[#F98080]"
                    }`}
                  >
                    <span>#{b.round}</span>
                    <span className="font-semibold">{b.amount}</span>
                    <span className="text-right font-bold">
                      {b.cashedAt ? `${fmt(b.cashedAt)}x` : `${fmt(b.crash)}x`}
                    </span>
                  </div>
                ))
              : bets.map((b) => {
                  const done = b.cashedAt !== undefined;
                  return (
                    <div
                      key={b.id}
                      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 px-2 sm:gap-x-3 py-[5px] text-[0.72rem] ${
                        done
                          ? "rounded-[7px] border border-[#3B8F20] bg-[#0D4206] text-white"
                          : "border-b border-white/[0.06] bg-[#111315] text-white/70"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold text-white"
                          style={{
                            background: `conic-gradient(from 0deg, hsl(${(b.id * 47) % 360} 70% 45%), hsl(${(b.id * 91) % 360} 70% 40%))`,
                          }}
                        >
                          {b.user.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate">{maskName(b.user)}</span>
                      </span>
                      <span className="font-semibold text-white/85">{b.amount}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-[1px] text-[0.65rem] font-bold ${
                          done
                            ? "border border-[#3B8F20]/60 bg-[#052208] text-[#7CFF56]"
                            : ""
                        }`}
                      >
                        {done ? `${fmt(b.cashedAt!)}x` : ""}
                      </span>
                      <span className={`text-right font-bold ${done ? "text-white" : ""}`}>
                        {done ? fmt(b.amount * b.cashedAt!) : ""}
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
        <div className="order-1 min-w-0 space-y-2 lg:order-2">
          <FlightStage phase={phase} multiplier={multiplier} countdown={countdown} />


          <div className="flex items-start gap-2 rounded-[14px] border border-[#303238] bg-[#151618] p-2 sm:gap-3 sm:p-3">
            <BetPanel
              state={p1}
              setState={setP1}
              phase={phase}
              multiplier={multiplier}
              onWin={win}
              balance={balance}
            />

            <div className="flex w-[68px] shrink-0 flex-col gap-[6px] pt-[26px] sm:w-[86px]">
              <button
                type="button"
                onClick={() => {
                  const v = Number(window.prompt("Custom stake", String(p1.amount)) ?? "");
                  if (Number.isFinite(v) && v >= 10) {
                    setP1((p) => ({ ...p, amount: v }));
                    setP2((p) => ({ ...p, amount: v }));
                  }
                }}
                className="rounded-[6px] bg-[#F59E0B] py-[6px] text-[0.78rem] font-bold text-white"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setP1((p) => ({ ...p, amount: 10, staged: false }));
                  setP2((p) => ({ ...p, amount: 10, staged: false }));
                }}
                className="rounded-[6px] bg-[#EF0000] py-[6px] text-[0.78rem] font-bold text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setP1((p) => ({ ...p, amount: 10 }));
                  setP2((p) => ({ ...p, amount: 10 }));
                }}
                className="rounded-[6px] border border-[#4A4C52] bg-transparent py-[6px] text-[0.78rem] font-semibold text-[#9CA3AF]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={() => {
                  setP1((p) => ({ ...p, amount: 10000 }));
                  setP2((p) => ({ ...p, amount: 10000 }));
                }}
                className="rounded-[6px] border border-[#4A4C52] bg-transparent py-[6px] text-[0.78rem] font-semibold text-[#9CA3AF]"
              >
                Max
              </button>
            </div>

            <BetPanel
              state={p2}
              setState={setP2}
              phase={phase}
              multiplier={multiplier}
              onWin={win}
              balance={balance}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
