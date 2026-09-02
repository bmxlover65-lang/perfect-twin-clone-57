import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import plane0 from "@/assets/aviator/plane-0.svg";
import plane1 from "@/assets/aviator/plane-1.svg";
import plane2 from "@/assets/aviator/plane-2.svg";
import plane3 from "@/assets/aviator/plane-3.svg";
import { type AviatorControl, useAdminConfig } from "@/lib/admin";
import { logBet, logChat, setBalance as saveBalance } from "@/lib/telemetry";

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
  if (m < 2) return "text-[#34B3F1]";
  if (m < 10) return "text-[#913EF8]";
  return "text-[#C017B4]";
}

function chipTone(m: number) {
  if (m < 2) return "border-[#34B3F1]/40 text-[#34B3F1]";
  if (m < 10) return "border-[#913EF8]/40 text-[#913EF8]";
  return "border-[#C017B4]/40 text-[#C017B4]";
}

/* ---------------- fake live bets ---------------- */

const NAMES = [
  "d***5", "R***a", "k***9", "S***h", "m***t", "A***v", "p***l", "N***i",
  "b***7", "V***y", "j***n", "T***u", "z***3", "H***k", "y***s", "L***o",
];

type LiveBet = {
  id: number;
  user: string;
  amount: number;
  cashedAt?: number;
  target: number;
};

function makeBets(seed: number): LiveBet[] {
  const out: LiveBet[] = [];
  const n = 9 + (seed % 6);
  for (let i = 0; i < n; i += 1) {
    const amt = [50, 100, 200, 500, 1000, 2500][(seed + i * 7) % 6]!;
    out.push({
      id: seed * 100 + i,
      user: NAMES[(seed * 3 + i * 5) % NAMES.length]!,
      amount: amt,
      target: 1.2 + ((seed * 13 + i * 29) % 700) / 100,
    });
  }
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

const QUICK = [100, 200, 500, 1000];

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
    ? "CASH OUT"
    : state.staged || (state.active && state.cashedAt === null)
      ? "CANCEL"
      : "BET";

  const tone = canCash
    ? "bg-[#D07206] border-[#FFBF69] shadow-[0_4px_0_#8a4a04]"
    : state.staged || state.active
      ? "bg-[#B02216] border-[#F76C6C] shadow-[0_4px_0_#7b160e]"
      : "bg-[#28A909] border-[#8CFF6B] shadow-[0_4px_0_#1a6f06]";

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

  const bump = (delta: number) =>
    setState((p) => ({ ...p, amount: Math.max(10, Math.round((p.amount + delta) * 100) / 100) }));

  return (
    <div className="rounded-[14px] border border-white/10 bg-[#1B1C1D] p-1.5 sm:p-2">
      <div className="mb-2 flex justify-center">
        <div className="flex rounded-full bg-[#141516] p-[3px] text-[0.6rem] font-bold text-white/60 sm:text-[0.65rem]">
          <span className="rounded-full bg-[#2C2D30] px-3 py-[2px] text-white">Bet</span>
          <span className="px-3 py-[2px]">Auto</span>
        </div>
      </div>

      <div className="flex items-stretch gap-1.5 sm:gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1 rounded-full bg-[#0E0F10] px-1.5 py-1 sm:px-2">
            <button
              type="button"
              onClick={() => bump(-100)}
              className="h-6 w-6 shrink-0 rounded-full bg-[#2C2D30] text-white/70"
              aria-label="decrease"
            >
              −
            </button>
            <span className="truncate text-[0.9rem] font-bold text-white sm:text-[1.05rem]">
              {fmt(state.amount)}
            </span>
            <button
              type="button"
              onClick={() => bump(100)}
              className="h-6 w-6 shrink-0 rounded-full bg-[#2C2D30] text-white/70"
              aria-label="increase"
            >
              +
            </button>
          </div>
          <div className="mt-1 grid grid-cols-4 gap-[3px] sm:gap-1">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setState((p) => ({ ...p, amount: q }))}
                className="rounded-full border border-white/10 bg-[#0E0F10] py-[3px] text-[0.62rem] font-semibold text-white/70 hover:text-white sm:text-[0.7rem]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={press}
          className={`w-[42%] shrink-0 rounded-[18px] border-2 px-1.5 py-2 text-center font-extrabold uppercase text-white sm:w-[46%] sm:px-2 ${tone}`}
        >
          <span className="block text-[0.82rem] leading-tight sm:text-[0.95rem]">{label}</span>
          <span className="block text-[0.72rem] leading-tight sm:text-[0.85rem]">
            {canCash ? `${fmt(state.amount * multiplier)} INR` : `${fmt(state.amount)} INR`}
          </span>
        </button>
      </div>


      {state.cashedAt ? (
        <p className="mt-1 text-center text-[0.72rem] font-bold text-[#28A909]">
          Cashed out {fmt(state.cashedAt)}x · {fmt(state.amount * state.cashedAt)} INR
        </p>
      ) : state.staged ? (
        <p className="mt-1 text-center text-[0.72rem] font-semibold text-white/50">
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
    <div className="relative overflow-hidden rounded-[14px] bg-black">
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

      <svg viewBox={`0 0 ${W} ${H}`} className="relative block h-[175px] w-full sm:h-[300px]">
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
        className="absolute left-3 top-2 z-10 text-[1.05rem] font-bold text-white/85"
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === "betting" ? (
          <p className="px-4 text-center text-[0.82rem] font-bold uppercase tracking-[0.04em] text-white sm:text-[1.35rem]">
            Waiting for next round
          </p>
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
type ChatMsg = { id: number; user: string; text: string; mine?: boolean };

const SEED_CHAT: ChatMsg[] = [
  { id: 1, user: "d***5", text: "gg 12x!" },
  { id: 2, user: "R***a", text: "auto cashout 1.60 best" },
  { id: 3, user: "k***9", text: "cashed 2.4x finally" },
  { id: 4, user: "S***h", text: "next one big" },
];

export function Aviator() {
  const { admin, cfg } = useAdminConfig();
  const avRef = useRef<AviatorControl | null>(null);
  avRef.current = admin ? cfg.aviator : null;

  const [tab, setTab] = useState<"all" | "my" | "top">("all");
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>(SEED_CHAT);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("betting");
  const [multiplier, setMultiplier] = useState(1);
  const [countdown, setCountdown] = useState(BET_MS);
  const [history, setHistory] = useState<number[]>([2.31, 1.14, 5.62, 1.02, 11.4, 1.87, 3.05, 1.45]);
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

  // chatter from other players
  useEffect(() => {
    const lines = ["nice one", "1.5x safe", "big red again", "cash early bro", "lets go", "auto 2x on"];
    const id = window.setInterval(() => {
      setChat((c) =>
        [
          ...c,
          {
            id: Date.now(),
            user: NAMES[Math.floor(Math.random() * NAMES.length)]!,
            text: lines[Math.floor(Math.random() * lines.length)]!,
          },
        ].slice(-40),
      );
    }, 9000);
    return () => window.clearInterval(id);
  }, []);

  const totals = useMemo(() => {
    const staked = bets.reduce((s, b) => s + b.amount, 0);
    const cashed = bets.filter((b) => b.cashedAt !== undefined).length;
    return { staked, cashed, count: bets.length };
  }, [bets]);

  return (
    <div className="rounded-[16px] border border-white/10 bg-[#141516] p-1.5 sm:p-2">
      {/* history strip */}
      <div className="mb-2 flex items-center gap-2 rounded-[12px] bg-[#1B1C1D] px-2 py-[6px]">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto sm:gap-3">
          {history.map((h, i) => (
            <span
              key={`${h}-${i}`}
              className={`shrink-0 text-[0.68rem] font-bold sm:text-[0.78rem] ${chipTone(h)}`}
            >
              {fmt(h)}x
            </span>
          ))}
        </div>
        <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-[#E01E1E]/60 px-2 text-[0.7rem] text-white/70">
          ⟳ <span className="text-[0.55rem]">▾</span>
        </span>
      </div>

      <div className="grid gap-2 lg:grid-cols-[240px_1fr]">
        {/* bets + chat */}
        <div className="order-2 min-w-0 rounded-[14px] bg-[#1B1C1D] p-1.5 lg:order-1 sm:p-2">
          <div className="mx-auto flex w-full max-w-[280px] rounded-full bg-[#101112] p-[3px] text-[0.68rem] font-bold text-white/55 sm:w-[86%] sm:text-[0.72rem]">
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

          <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-2 border-b sm:gap-x-3 border-white/10 pb-1 text-[0.62rem] font-semibold text-white/40">
            <span>{tab === "my" ? "Round" : "User"}</span>
            <span>Bet&nbsp;&nbsp;X</span>
            <span className="text-right">Cash out</span>
          </div>

          {tab === "my" ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-[2px] rounded-[4px] border border-[#2C2D30] bg-[#101112] px-2 py-[5px] text-[0.6rem] text-white/60 sm:text-[0.66rem]">
              <span>
                This game is <span className="text-[#2FA8F5]">✅ Provably Fair</span>
              </span>
              <span>
                Powered by <span className="font-bold text-white underline">VIMAAN</span>
              </span>
            </div>
          ) : null}

          <div className="max-h-[300px] space-y-[3px] overflow-y-auto pt-1">
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
              : bets.map((b) => (
                  <div
                    key={b.id}
                    className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-2 border-b border-white/[0.06] sm:gap-x-3 px-1 py-[5px] text-[0.72rem] ${
                      b.cashedAt !== undefined ? "text-[#8CFF6B]" : "text-white/70"
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
                      <span className="truncate">{b.user}</span>
                    </span>
                    <span className="font-semibold text-white/85">{b.amount}</span>
                    <span className="text-right font-bold">
                      {b.cashedAt !== undefined ? `${fmt(b.cashedAt)}x` : ""}
                    </span>
                  </div>
                ))}
            {tab === "my" && myBets.length === 0 ? (
              <p className="py-6 text-center text-[0.72rem] text-white/40">No bets yet</p>
            ) : null}
          </div>

          <p className="mt-1 border-t border-white/10 pt-1 text-[0.65rem] text-white/40">
            Total bet {totals.staked} INR · {totals.cashed} cashed out
          </p>


          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            className="mt-2 w-full rounded-full bg-[#101112] py-[5px] text-[0.7rem] font-bold text-white/70"
          >
            {chatOpen ? "Hide chat" : `Chat (${chat.length})`}
          </button>

          {chatOpen ? (
            <div className="mt-2 rounded-[10px] bg-[#101112] p-2">
              <div className="max-h-[180px] space-y-[5px] overflow-y-auto">
                {chat.map((m) => (
                  <div key={m.id} className="text-[0.72rem] leading-tight">
                    <span className={m.mine ? "font-bold text-[#8CFF6B]" : "font-bold text-[#34B3F1]"}>
                      {m.mine ? "You" : m.user}
                    </span>{" "}
                    <span className="text-white/75">{m.text}</span>
                  </div>
                ))}
              </div>
              <form
                className="mt-2 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = draft.trim();
                  if (!text) return;
                  setChat((c) => [...c, { id: Date.now(), user: "You", text, mine: true }].slice(-40));
                  logChat({ ts: Date.now(), user: "You", text });
                  setDraft("");
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message"
                  className="min-w-0 flex-1 rounded-full bg-[#1B1C1D] px-3 py-1 text-[0.72rem] text-white outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[#28A909] px-3 py-1 text-[0.7rem] font-bold text-white"
                >
                  Send
                </button>
              </form>
            </div>
          ) : null}
        </div>

        {/* stage + panels */}
        <div className="order-1 min-w-0 space-y-2 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 rounded-[12px] bg-[#1B1C1D] px-3 py-1 text-[0.66rem] font-bold text-white/70 sm:text-[0.72rem]">
            <span>ROUND #{round}</span>
            <span className={toneFor(multiplier)}>
              {phase === "flying" ? "IN FLIGHT" : phase === "crashed" ? "FLEW AWAY" : "PLACE YOUR BETS"}
            </span>
            <span>Balance: {fmt(balance)} INR</span>
          </div>

          <FlightStage phase={phase} multiplier={multiplier} countdown={countdown} />

          <div className="grid gap-2 sm:grid-cols-2">
            <BetPanel
              state={p1}
              setState={setP1}
              phase={phase}
              multiplier={multiplier}
              onWin={win}
              balance={balance}
            />
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
