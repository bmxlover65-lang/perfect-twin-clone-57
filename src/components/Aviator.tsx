import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import plane0 from "@/assets/aviator/plane-0.svg";
import plane1 from "@/assets/aviator/plane-1.svg";
import plane2 from "@/assets/aviator/plane-2.svg";
import plane3 from "@/assets/aviator/plane-3.svg";
import aviatorText from "@/assets/aviator/aviator.svg";
import { type AviatorControl, useAdminConfig } from "@/lib/admin";

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
    <div className="rounded-[14px] border border-white/10 bg-[#1B1C1D] p-2">
      <div className="mb-2 flex justify-center">
        <div className="flex rounded-full bg-[#141516] p-[3px] text-[0.65rem] font-bold text-white/60">
          <span className="rounded-full bg-[#2C2D30] px-3 py-[2px] text-white">Bet</span>
          <span className="px-3 py-[2px]">Auto</span>
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex-1">
          <div className="flex items-center justify-between rounded-full bg-[#0E0F10] px-2 py-1">
            <button
              type="button"
              onClick={() => bump(-100)}
              className="h-6 w-6 rounded-full bg-[#2C2D30] text-white/70"
              aria-label="decrease"
            >
              −
            </button>
            <span className="text-[1.05rem] font-bold text-white">{fmt(state.amount)}</span>
            <button
              type="button"
              onClick={() => bump(100)}
              className="h-6 w-6 rounded-full bg-[#2C2D30] text-white/70"
              aria-label="increase"
            >
              +
            </button>
          </div>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setState((p) => ({ ...p, amount: q }))}
                className="rounded-full border border-white/10 bg-[#0E0F10] py-[3px] text-[0.7rem] font-semibold text-white/70 hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={press}
          className={`w-[46%] rounded-[18px] border-2 px-2 py-2 text-center font-extrabold uppercase text-white ${tone}`}
        >
          <span className="block text-[0.95rem] leading-tight">{label}</span>
          <span className="block text-[0.85rem] leading-tight">
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
  const x = 40 + p * (W - 190) + hoverX;
  const y = H - 40 - Math.sin(p * 1.35) * (H - 110) + hoverY;
  const flewT = phase === "crashed" ? 1 : 0;
  const px = x + flewT * 340;
  const py = y - flewT * 190;
  const path = `M40,${H - 40} Q ${40 + (x - 40) * 0.62},${H - 40} ${x},${y}`;
  const area = `${path} L ${x},${H - 40} Z`;
  const planeW = 108;
  const planeH = planeW * (74 / 150);

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-[#0E0F10]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_120%,rgba(120,20,20,0.55),transparent_60%)]" />
      <svg viewBox={`0 0 ${W} ${H}`} className="relative block h-[300px] w-full">
        <defs>
          <linearGradient id="av-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E01E1E" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E01E1E" stopOpacity="0.02" />
          </linearGradient>
          <radialGradient id="av-stars" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {Array.from({ length: 46 }).map((_, i) => {
          const sx = ((i * 137) % W) + ((i % 5) * 7);
          const sy = ((i * 79) % (H - 60)) + 12;
          return <circle key={i} cx={sx} cy={sy} r={i % 7 === 0 ? 1.6 : 1} fill="url(#av-stars)" />;
        })}

        <line x1="40" y1={H - 40} x2={W - 20} y2={H - 40} stroke="#ffffff22" strokeWidth="2" />
        <line x1="40" y1="20" x2="40" y2={H - 40} stroke="#ffffff22" strokeWidth="2" />

        {phase !== "betting" ? (
          <>
            <path d={area} fill="url(#av-area)" />
            <path d={path} fill="none" stroke="#E01E1E" strokeWidth="4" strokeLinecap="round" />
            <image
              href={PLANE_FRAMES[phase === "crashed" ? 0 : frame]}
              x={px - 6}
              y={py - planeH + planeH * 0.1}
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
      <img
        src={aviatorText}
        alt="Aviator"
        className="pointer-events-none absolute left-3 top-3 h-[22px] w-auto opacity-90"
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === "betting" ? (
          <>
            <p className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-white/80">
              Waiting for next round
            </p>
            <div className="mt-3 h-[6px] w-[220px] overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#E01E1E] transition-[width] duration-100"
                style={{ width: `${Math.max(0, Math.min(100, (countdown / BET_MS) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-[1.6rem] font-extrabold text-white">
              {(countdown / 1000).toFixed(1)}s
            </p>
          </>
        ) : phase === "crashed" ? (
          <>
            <p className="text-[1.15rem] font-extrabold uppercase tracking-[0.18em] text-[#E01E1E]">
              Flew Away!
            </p>
            <p className="text-[3.2rem] font-extrabold leading-none text-white">
              {fmt(multiplier)}x
            </p>
          </>
        ) : (
          <p className="text-[3.6rem] font-extrabold leading-none text-white drop-shadow-[0_4px_14px_rgba(0,0,0,.6)]">
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
  { id: 1, user: "d***5", text: "gg 12x 🔥" },
  { id: 2, user: "R***a", text: "auto cashout 1.60 best" },
  { id: 3, user: "k***9", text: "cashed 2.4x finally" },
  { id: 4, user: "S***h", text: "next one big 🚀" },
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
        const m = Math.max(1, Math.round(Math.pow(Math.E, 0.11 * t * (1 + t * 0.06)) * 100) / 100);
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

  const totals = useMemo(() => {
    const staked = bets.reduce((s, b) => s + b.amount, 0);
    const cashed = bets.filter((b) => b.cashedAt !== undefined).length;
    return { staked, cashed, count: bets.length };
  }, [bets]);

  return (
    <div className="rounded-[16px] border border-white/10 bg-[#141516] p-2">
      {/* history strip */}
      <div className="mb-2 flex items-center gap-2 overflow-x-auto rounded-[12px] bg-[#1B1C1D] px-2 py-[6px]">
        {history.map((h, i) => (
          <span
            key={`${h}-${i}`}
            className={`shrink-0 rounded-full border bg-[#101112] px-2 py-[2px] text-[0.72rem] font-bold ${chipTone(h)}`}
          >
            {fmt(h)}x
          </span>
        ))}
      </div>

      <div className="grid gap-2 lg:grid-cols-[240px_1fr]">
        {/* all bets */}
        <div className="rounded-[14px] bg-[#1B1C1D] p-2">
          <div className="flex items-center justify-between text-[0.72rem] font-bold text-white/70">
            <span>ALL BETS</span>
            <span>{totals.count}</span>
          </div>
          <div className="mt-1 grid grid-cols-[1fr_auto_auto] gap-x-2 border-b border-white/10 pb-1 text-[0.62rem] font-bold uppercase text-white/40">
            <span>User</span>
            <span>Bet</span>
            <span className="text-right">X</span>
          </div>
          <div className="max-h-[320px] space-y-[3px] overflow-y-auto pt-1">
            {bets.map((b) => (
              <div
                key={b.id}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-2 rounded-[6px] px-1 py-[3px] text-[0.72rem] ${
                  b.cashedAt !== undefined
                    ? "bg-[#123A18] text-[#8CFF6B]"
                    : "bg-[#101112] text-white/70"
                }`}
              >
                <span className="truncate">{b.user}</span>
                <span className="font-semibold">{b.amount}</span>
                <span className="text-right font-bold">
                  {b.cashedAt !== undefined ? `${fmt(b.cashedAt)}x` : "—"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 border-t border-white/10 pt-1 text-[0.65rem] text-white/40">
            Total bet {totals.staked} INR · {totals.cashed} cashed out
          </p>
        </div>

        {/* stage + panels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-[12px] bg-[#1B1C1D] px-3 py-1 text-[0.72rem] font-bold text-white/70">
            <span>ROUND #{round}</span>
            <span className={toneFor(multiplier)}>
              {phase === "flying" ? "IN FLIGHT" : phase === "crashed" ? "FLEW AWAY" : "PLACE YOUR BETS"}
            </span>
            <span>Balance: {fmt(balance)} INR</span>
          </div>

          <FlightStage phase={phase} multiplier={multiplier} countdown={countdown} />

          <div className="grid gap-2 md:grid-cols-2">
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
