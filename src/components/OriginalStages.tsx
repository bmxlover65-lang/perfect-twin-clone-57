import { useEffect, useRef, useState } from "react";
import { creditWin, debit, useWallet } from "@/lib/wallet";
import luckyBg from "@/assets/lucky-bg.gif.asset.json";
import dreamBg from "@/assets/dream/dreambg.png.asset.json";
import dreamHub from "@/assets/dream/wheelhub3.png.asset.json";
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
          <RoundTimer leftSec={leftSec} suspended={suspended} className="absolute right-2 top-2" />

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
    <div
      className="relative flex w-full items-center justify-center overflow-hidden rounded-[4px] py-8"
      style={{
        backgroundImage: `url(${dreamBg.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
      }}
    >
      {roundId ? (
        <span className="pointer-events-none absolute left-2 top-2 text-[0.72rem] font-extrabold text-black/85">
          RID: {roundId}
        </span>
      ) : null}
      <RoundTimer leftSec={leftSec} suspended={suspended} className="absolute right-2 top-2" />

      <div className="relative">

        <div
          className="relative"
          style={{
            transform: `rotate(${rot}deg)`,
            transition: spin ? "transform 6s cubic-bezier(0.12,0.7,0.12,1)" : "none",
          }}
        >
          <svg viewBox="0 0 400 400" className="h-[300px] w-[300px] max-w-full drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] sm:h-[420px] sm:w-[420px]">
            <circle cx={cx} cy={cy} r={r + 6} fill="#111" />
            {DREAM_SEGMENTS.map((v, i) => {
              const a0 = i * step;
              const a1 = a0 + step;
              const [x0, y0] = polar(cx, cy, r, a0);
              const [x1, y1] = polar(cx, cy, r, a1);
              const [tx, ty] = polar(cx, cy, r * 0.78, a0 + step / 2);
              return (
                <g key={i}>
                  <path
                    d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`}
                    fill={DREAM_COLORS[v] ?? "#F5C400"}
                    stroke="#151515"
                    strokeWidth={1.2}
                  />
                  <text
                    x={tx}
                    y={ty}
                    fill="#1A1A1A"
                    fontSize={13}
                    fontWeight={800}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${a0 + step / 2 + 90} ${tx} ${ty})`}
                  >
                    {v}
                  </text>
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r={62} fill="#0B0B0B" />
          </svg>
        </div>
        <img
          src={dreamHub.url}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[128px] sm:w-[128px]"
        />

        <span className="pointer-events-none absolute left-1/2 top-[-14px] -translate-x-1/2 text-[1.7rem] leading-none text-[#F2C500] drop-shadow">
          ▼
        </span>

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
  const [climb, setClimb] = useState(0);
  const [wait, setWait] = useState(5);
  const [crashAt, setCrashAt] = useState(2);
  const [history, setHistory] = useState<number[]>([]);
  const [autos, setAutos] = useState<[boolean, boolean]>([false, false]);
  const [autoX, setAutoX] = useState<[string, string]>(["1.10", "1.10"]);

  const wallet = useWallet();
  const balance = wallet.balance;
  const [bets, setBets] = useState<(null | { entry: number; stake: number; pending?: boolean })[]>([
    null,
    null,
  ]);
  const [flash, setFlash] = useState<(null | { text: string; win: boolean })[]>([null, null]);
  // one bet per round per panel
  const [used, setUsed] = useState<[boolean, boolean]>([false, false]);
  const usedRef = useRef(used);
  usedRef.current = used;

  const airRef = useRef<HTMLAudioElement | null>(null);
  const apiTarget = Number(multiplier) || 0;
  const apiRef = useRef(apiTarget);
  apiRef.current = apiTarget;
  const roundRef = useRef<string | undefined>(roundId);
  roundRef.current = roundId;
  const suspRef = useRef<boolean>(!!suspended);
  suspRef.current = !!suspended;
  const stakeRef = useRef(stake);
  stakeRef.current = stake;
  const autoRef = useRef(autos);
  autoRef.current = autos;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  // browsers block audio until the first real user interaction — track it
  const interactedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const unlock = () => {
      interactedRef.current = true;
      // if a round is already flying when the user first interacts, start the
      // air sound right away instead of waiting for the next round
      if (phaseRef.current === "flying" && !mutedRef.current) {
        try {
          const a = new Audio("/balloon-air.mp3");
          a.volume = 0.35;
          airRef.current = a;
          void a.play().catch(() => undefined);
        } catch {
          // audio unavailable
        }
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const play = (src: string, vol: number, keep?: boolean) => {
    if (mutedRef.current || !interactedRef.current) return;
    try {
      const a = new Audio(src);
      a.volume = vol;
      if (keep) airRef.current = a;
      void a.play().catch(() => undefined);
    } catch {
      // audio unavailable
    }
  };

  // official results feed: roundId -> real crash multiplier
  const winnersRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    let alive = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      const ctrl = new AbortController();
      const to = window.setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch("/api/public/uapi/games/88.0023/results", {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: { roundId?: string; winner?: string }[];
        };
        if (!alive || !Array.isArray(json.data)) return;
        json.data.forEach((r) => {
          const w = Number(r?.winner);
          if (r?.roundId && w > 0) winnersRef.current.set(String(r.roundId), w);
        });
        const recent = json.data
          .slice(0, 12)
          .map((r) => Number(r?.winner))
          .filter((n) => n > 0);
        // the official results feed is the source of truth for the strip
        if (recent.length) setHistory(recent);
        // if the round already burst on the live value, correct it once the
        // official result for that round is published
        const cur = roundRef.current ? winnersRef.current.get(String(roundRef.current)) : undefined;
        if (phaseRef.current === "crashed" && cur && cur > 0) {
          setCrashAt(cur);
          setShown(cur);
        }




      } catch {
        // results unavailable — keep the animated estimate
      } finally {
        window.clearTimeout(to);
        busy = false;
      }
    };
    void load();
    const id = window.setInterval(load, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);


  // round engine — follows the live feed (roundId + multiplier) so the result
  // always matches the real round; falls back to a local curve if the feed is down
  useEffect(() => {

    let raf = 0;
    let last = performance.now();
    let ph: "waiting" | "flying" | "crashed" = "waiting";
    let t = 1; // seconds left in the current phase
    let v = 1;
    let target = 2;
    let curRound = roundRef.current;
    let lastFeedRound = roundRef.current;
    let stale = false;
    let peak = 1;
    let stall = 0;

    const startRound = (apiRound?: string | undefined) => {
      curRound = apiRound;
      const api = apiRef.current;
      // live feed: target grows with the feed; offline: local crash curve
      target = apiRound
        ? Math.max(1.01, api)
        : Math.min(28, Math.max(1.02, 0.92 / Math.max(0.03, 1 - Math.random())));
      peak = 1;
      stall = 0;
      setCrashAt(target);
      v = 1;
      setShown(1);
      setClimb(0);
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

    const burst = (at: number) => {
      // the official result for this round wins over our animated estimate
      const exact = curRound ? winnersRef.current.get(String(curRound)) : undefined;
      const val = exact && exact > 0 ? exact : at;
      target = val;
      ph = "crashed";
      setPhase("crashed");
      setCrashAt(val);
      setShown(val);
      setHistory((h) => (h[0] === val ? h : [val, ...h].slice(0, 10)));
      airRef.current?.pause();
      play(bonusSfx.url, 0.7);
      t = 2.4;
    };


    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const apiRound = roundRef.current;
      const api = apiRef.current;

      // a genuinely new round id from the feed: sync back to live mode
      if (apiRound && apiRound !== lastFeedRound) {
        lastFeedRound = apiRound;
        stale = false;
        startRound(apiRound);
        raf = window.requestAnimationFrame(tick);
        return;
      }
      // stale feed (same id, never advances) → run local rounds instead
      const live = !!apiRound && !stale;

      if (ph === "flying") {
        // the balloon keeps rising through the whole flight (time based)
        setClimb((c) => Math.min(1, c + dt / 5.5));
        if (live) {
          // official winner for this round (once published) is the crash point
          const official = curRound ? winnersRef.current.get(String(curRound)) : undefined;
          if (official && official > 0) {
            peak = official;
            const goal = official;
            // reach the official value at the same pace the real game does
            v = Math.min(goal, v + (goal - v) * Math.min(1, dt * 14) + dt * 0.35);
            if (goal - v < 0.01) {
              v = goal;
              setShown(goal);
              burst(goal);
            } else {
              setShown(v);
              setCrashAt(goal);
            }
            raf = window.requestAnimationFrame(tick);
            return;
          }
          // chase the feed value; it is the single source of truth
          if (api > peak + 0.0001) {
            peak = api;
            stall = 0;
          } else {
            stall += dt;
          }
          const goal = Math.max(1, peak);
          // snap onto the feed value (no visible lag behind the real game)
          v = v + (goal - v) * Math.min(1, dt * 18);
          if (goal - v < 0.01) v = goal;
          setShown(v);
          setCrashAt(goal);

          // the live feed's own multiplier is the round result: as soon as the
          // feed suspends the round (or stops advancing) we burst on that value
          if (peak > 1 && (suspRef.current ? stall > 0.4 : stall > 2.2)) {
            v = peak;
            setShown(peak);
            burst(peak);
          }



        } else {

          // offline pacing: gentle at first, faster the higher it goes
          v = v + dt * (0.09 + (v - 1) * 0.14);
          if (v >= target) {
            v = target;
            setShown(target);
            burst(target);
          } else {
            setShown(v);
          }
        }
      } else {
        t -= dt;
        setWait(Math.max(0, Math.ceil(t)));
        if (t <= 0) {
          if (ph === "crashed") {
            ph = "waiting";
            setPhase("waiting");
            t = 5;
          } else {
            // waiting over: feed never advanced while we waited → mark stale
            // and start a local round; a new feed id will resync automatically
            if (live) stale = true;
            startRound(undefined);
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

  // new round → allow one fresh bet per panel again
  useEffect(() => {
    if (phase === "waiting") setUsed([false, false]);
  }, [phase, roundId]);

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

  // HEAT button: bet only before the round starts, one bet per round per panel
  const pressHeat = (i: 0 | 1) => {
    setBets((prev) => {
      const next = [...prev];
      const b = next[i];
      if (b?.pending) {
        // cancel a queued bet (only allowed while the round has not started)
        if (phase === "flying") return prev;
        creditWin(b.stake);
        next[i] = null;
        setUsed((u) => {
          const n = [...u] as [boolean, boolean];
          n[i] = false;
          return n;
        });
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
        // no new bets once the round has started, and only one bet per round
        if (phase === "flying" || usedRef.current[i]) return prev;
        if (stake <= 0) return prev;
        if (!debit(stake)) return prev;
        next[i] = { entry: 1, stake, pending: true };
        setUsed((u) => {
          const n = [...u] as [boolean, boolean];
          n[i] = true;
          return n;
        });
        setFlash((f) => {
          const n = [...f];
          n[i] = null;
          return n;
        });
      }
      return next;
    });
  };


  // auto cash out: when the shown multiplier reaches the user's target
  useEffect(() => {
    if (phase !== "flying") return;
    ([0, 1] as const).forEach((i) => {
      if (!autos[i]) return;
      const target = Number(autoX[i]);
      const b = bets[i];
      if (!b || b.pending || !(target > 1) || shown < target) return;
      const payout = Math.round(b.stake * target);
      creditWin(payout);
      setFlash((f) => {
        const n = [...f];
        n[i] = { text: `+${payout.toLocaleString("en-IN")}`, win: true };
        return n;
      });
      setBets((p) => {
        const n = [...p];
        n[i] = null;
        return n;
      });
    });
  }, [shown, phase, autos, autoX, bets]);

  const flying = phase === "flying";

  const popped = phase === "crashed";
  const grow = Math.min(1, climb * 0.78 + (Math.log(Math.max(1, shown)) / Math.log(10)) * 0.35);

  const bgIndex = Math.abs(hashStr(roundId ?? "0")) % LOCATIONS.length;

  const histColor2 = (v: number) =>
    v >= 10
      ? "bg-[#7B2FF2] text-white"
      : v >= 2
        ? "bg-[#E8871E] text-white"
        : "bg-[#123A73] text-white";

  const seedHist = [1.81, 5.68, 2.58, 1.12, 1.15, 3.88, 2.59, 1.3, 1.25, 1.03];
  const histList = (history.length ? history : seedHist).slice(0, 12);





  return (
    <div className="w-full rounded-[14px] bg-black p-1.5">
      <div className="relative aspect-[9/16] w-full max-h-[calc(100vh-132px)] overflow-hidden rounded-[10px] sm:aspect-[16/10] sm:max-h-none bg-[linear-gradient(180deg,#4FB6CE_0%,#7ACBD6_38%,#BFE0CC_66%,#F3E4B4_88%,#F7EFD2_100%)]">
        {/* sky artwork — parallax: the ground drops away as the balloon climbs */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={LOCATIONS[bgIndex]!.url}
            alt=""
            className="absolute inset-x-0 bottom-0 h-[210%] w-full object-cover object-bottom opacity-95"
            style={{
              transform: `translateY(${grow * 150}%)`,
              transition: "transform 200ms linear",
            }}
          />
          {/* high altitude: the landscape is gone and only open blue sky is left */}
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,#1FA5DE_0%,#37B6E8_55%,#7FD3F0_100%)]"
            style={{
              opacity: Math.max(0, Math.min(1, (grow - 0.45) / 0.35)),
              transition: "opacity 240ms linear",
            }}
          />
          {/* clouds streaming past while climbing */}
          {flying
            ? [
                { top: 12, size: 32, dur: 5.5, delay: 0 },
                { top: 34, size: 22, dur: 7, delay: 1.4 },
                { top: 58, size: 40, dur: 6.2, delay: 2.6 },
                { top: 74, size: 18, dur: 8, delay: 0.8 },
              ].map((c, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute rounded-full bg-white/70 blur-[1px]"
                  style={{
                    top: `${c.top}%`,
                    left: `${i % 2 === 0 ? 8 + i * 9 : 62 - i * 6}%`,
                    width: `${c.size}%`,
                    height: `${c.size * 0.32}%`,
                    opacity: 0.15 + grow * 0.45,
                    animation: `cloudDrift ${c.dur}s linear ${c.delay}s infinite`,
                  }}
                />
              ))
            : null}
          {/* a small plane crosses the sky high up, like the original */}
          {flying && grow > 0.55 ? (
            <span
              className="pointer-events-none absolute text-[clamp(1.2rem,4vw,2.2rem)]"
              style={{ top: "46%", animation: "planeCross 6s linear infinite" }}
            >
              ✈️
            </span>
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(79,182,206,0.35)_0%,rgba(122,203,214,0.12)_38%,rgba(247,239,210,0)_70%)]" />
        </div>


        {/* balloon — large, centered, scenic; climbs through the middle/upper area */}
        {popped ? (
          <div
            className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-center"
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
            className="absolute left-1/2 z-10 w-[62%] min-w-[160px] max-w-[420px] sm:w-[34%] sm:min-w-[200px]"
            style={{
              bottom: `${20 + grow * 12}%`,
              transform: `translateX(-50%) scale(${flying ? 1 + grow * 0.18 : 1})`,
              transition: "bottom 240ms linear, transform 240ms linear",
            }}
          >


            <img
              src={balloonImg.url}
              alt="Balloon"
              className="w-full animate-[balloonSway_3s_ease-in-out_infinite]"
              style={{ filter: "drop-shadow(0 14px 20px rgba(0,0,0,0.28))" }}
            />
            {/* burner flame — small flame coming out of the black burner above the basket */}
            <div
              className="pointer-events-none absolute left-1/2 z-20"
              style={{
                bottom: "13%",
                transform: "translateX(-50%)",
                width: "9%",
                minWidth: 18,
                maxWidth: 30,
              }}
            >
              <svg viewBox="0 0 34 52" className="w-full animate-[flame-flicker_0.75s_ease-in-out_infinite_alternate]">
                <defs>
                  <linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#E65100" />
                    <stop offset="35%" stopColor="#FF6F00" />
                    <stop offset="70%" stopColor="#FFB300" />
                    <stop offset="100%" stopColor="#FFEB3B" stopOpacity="0.85" />
                  </linearGradient>
                  <filter id="flameGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d="M17 50 C5 40 2 28 9 18 C11 13 14 8 17 2 C20 8 23 13 25 18 C32 28 29 40 17 50 Z"
                  fill="url(#flameGrad)"
                  filter="url(#flameGlow)"
                />
                <path
                  d="M17 43 C11 37 9 30 13 24 C14 21 16 18 17 14 C18 18 20 21 21 24 C25 30 23 37 17 43 Z"
                  fill="#FFF8E1"
                  fillOpacity="0.92"
                />
              </svg>
            </div>
            {flying ? (
              <p className="absolute left-1/2 top-[38%] w-[120%] -translate-x-1/2 text-center text-[clamp(1.8rem,4.8vw,3.6rem)] font-extrabold leading-none text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)]">
                {shown.toFixed(2)}x
              </p>
            ) : (
              <div className="absolute left-1/2 top-[30%] w-[150%] -translate-x-1/2 text-center">
                <p className="text-[clamp(0.8rem,1.6vw,1.2rem)] font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                  Waiting For Next Round
                </p>
                <span className="mt-2 inline-grid h-9 w-9 place-items-center rounded-full bg-black/25 text-[1.05rem] font-extrabold text-white sm:h-11 sm:w-11 sm:text-[1.3rem]">
                  {wait}
                </span>
              </div>
            )}

          </div>
        )}

        {/* top bar: full-line results strip, mute sits below it */}
        <div className="absolute inset-x-0 top-0 px-2 py-2">
          <div className="flex w-full flex-nowrap items-center gap-1 overflow-x-auto">
            {histList.map((v, i) => (
              <span
                key={i}
                className={`shrink-0 rounded-[5px] px-2 py-[3px] text-[0.7rem] font-extrabold sm:px-2.5 sm:text-[0.78rem] ${histColor2(v)}`}
              >
                {v.toFixed(2)}x
              </span>
            ))}
            <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8A33D]">
              <img src={arrowDown.url} alt="" className="h-3 w-3" />
            </span>
          </div>
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
            className="mt-2 shrink-0 text-[#2B2B2B]"
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
        </div>


        {/* profile pill + balance */}
        <div className="absolute left-0 top-[14%] flex items-center gap-2 rounded-r-full bg-[#8B9AA1]/90 py-[3px] pl-2 pr-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
          <img src={profileIcon.url} alt="" className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[0.78rem] font-bold leading-none tracking-tight text-white">
            {Math.round(balance).toLocaleString("en-IN")}
          </span>
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#2C7BE5]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 14.5l6-6 6 6" />
            </svg>
          </span>
        </div>





        {/* countdown */}
        {!flying ? (
          <span className="absolute right-3 top-[14%] flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 text-[0.9rem] font-extrabold text-white">
            {wait}
          </span>
        ) : null}

        {/* bottom controls — mobile: solid purple panel like the reference */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.08)_40%,rgba(0,0,0,0.32)_100%)] sm:block" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1.5 rounded-b-[10px] bg-[#3A2538] px-2 pb-2 pt-2 sm:gap-4 sm:bg-transparent sm:px-4 sm:pb-4 sm:pt-0">
          {/* left cluster: auto toggles + stakes + edits/clear/min/max */}
          <div className="shrink-0">
            <div className="mb-1.5 flex items-end gap-1 sm:mb-1.5 sm:gap-2">
              {([0, 1] as const).map((i) => (
                <div key={i} className="flex w-[84px] items-center gap-1 sm:w-[150px] sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setAutos((a) => (i === 0 ? [!a[0], a[1]] : [a[0], !a[1]]))}
                    className="flex items-center gap-1 text-[0.68rem] font-bold text-white/90 sm:gap-2 sm:text-[0.82rem]"
                    aria-pressed={autos[i]}
                  >
                    Auto
                    <span
                      className={`relative inline-flex h-[18px] w-[34px] items-center rounded-full transition-colors sm:h-5 sm:w-10 ${
                        autos[i] ? "bg-[#2FA84F]" : "bg-[#D9D9D9]"
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all sm:top-[2px] sm:h-4 sm:w-4 ${
                          autos[i] ? "left-[17px] sm:left-[1.35rem]" : "left-[2px]"
                        }`}
                      />
                    </span>
                  </button>
                  {autos[i] ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-[#1E1E1E]/90 px-2 py-[3px] shadow sm:px-2.5">
                      <input
                        value={autoX[i]}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9.]/g, "").slice(0, 6);
                          setAutoX((a) => (i === 0 ? [v, a[1]] : [a[0], v]));
                        }}
                        inputMode="decimal"
                        aria-label="Auto cash out multiplier"
                        className="w-[36px] bg-transparent text-center text-[0.72rem] font-extrabold text-white outline-none sm:w-[46px] sm:text-[0.85rem]"
                      />
                      <span className="text-[0.6rem] font-bold text-white/70 sm:text-[0.75rem]">x</span>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex items-start gap-1.5 sm:gap-2">
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-[5px] sm:gap-x-2 sm:gap-y-1.5">
                {BALLOON_STAKES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStake(s)}
                    className={`h-[26px] w-[76px] rounded-full bg-[#0E2C5C] text-[0.65rem] font-extrabold text-white shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition-transform active:scale-95 sm:h-8 sm:w-[150px] sm:text-[0.95rem] ${
                      stake === s ? "ring-2 ring-[#E01E1E]" : ""
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="grid w-[58px] gap-[5px] sm:w-[110px] sm:gap-1.5">
                {(
                  [
                    ["Edits", 100, "bg-[#E8871E] text-white"],
                    ["Clear", 0, "bg-[#E01E1E] text-white"],
                    ["Min", 10, "bg-[#2A1330] text-white/70"],
                    ["Max", 10000, "bg-[#2A1330] text-white/70"],
                  ] as const
                ).map(([label, val, tone]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStake(val)}
                    className={`h-[26px] rounded-full text-[0.6rem] font-extrabold shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition-transform active:scale-95 sm:h-8 sm:text-[0.9rem] ${tone}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* heat buttons — bet / queue for next round / cash out */}
          <div className="ml-auto grid h-full w-[28%] min-w-[92px] shrink-0 gap-2 sm:w-[24%] sm:min-w-[150px] sm:gap-2">
            {([0, 1] as const).map((i) => {
              const bet = bets[i];
              const fl = flash[i];
              const live = bet && !bet.pending;
              const blocked = !bet && (phase === "flying" || used[i]);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pressHeat(i)}
                  disabled={blocked}
                  className={`relative flex h-[54px] items-center justify-center gap-1 rounded-[10px] border-2 border-white text-[0.78rem] font-extrabold tracking-wide text-white transition-transform active:translate-y-[2px] active:shadow-none sm:h-[52px] sm:gap-3 sm:text-[1.15rem] ${
                    blocked
                      ? "cursor-not-allowed bg-[linear-gradient(180deg,#5A6270_0%,#3D434D_100%)] opacity-60 shadow-[0_3px_0_#2A2F36]"
                      : live
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
                  ) : blocked ? (
                    <span className="text-[0.6rem] font-bold uppercase leading-tight sm:text-[0.8rem]">
                      {used[i] ? "Bet used" : "Bets closed"}
                    </span>
                  ) : (
                    <>
                      <img src={heatIcon.url} alt="" className="h-7 w-7 sm:h-7 sm:w-7" />
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
  if (l.startsWith("WICKET"))
    return "bg-[linear-gradient(180deg,#F98F86,#F26C61)] text-black";
  if (l.startsWith("6")) return "bg-[linear-gradient(180deg,#A9A9F7,#8E8EF0)] text-black";
  if (l.startsWith("4")) return "bg-[linear-gradient(180deg,#7FE0A2,#4CCB7C)] text-black";
  return "bg-[linear-gradient(180deg,#E3DE4A,#CFC820)] text-black";
}

export function BallByBallBoard({
  runners,
  min,
  max,
  news,
  recent,
}: {
  runners: BbbRunner[];
  min: number;
  max: number;
  news?: string | undefined;
  recent?: string[];
}) {
  const open = (s?: string) => (s ?? "").toUpperCase() === "ACTIVE";
  const left = runners.filter((_, i) => i % 2 === 0);
  const right = runners.filter((_, i) => i % 2 === 1);

  const Plate = ({ r }: { r: BbbRunner }) => (
    <div
      className={`relative flex h-[58px] items-center rounded-[8px] px-2 shadow-[0_1px_2px_rgba(0,0,0,0.25)] sm:h-[74px] sm:px-4 ${plateTone(r.label)}`}
    >
      <span className="flex w-[46px] shrink-0 flex-col items-center leading-tight sm:w-[86px]">
        <span className="text-[0.8rem] font-bold sm:text-[1rem]">
          {r.backPrice ? r.backPrice.toFixed(2) : "—"}
        </span>
        <span className="text-[0.6rem] font-semibold opacity-80 sm:text-[0.74rem]">
          {r.backSize ? Math.round(r.backSize).toLocaleString("en-IN") : ""}
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate text-center text-[0.8rem] font-extrabold uppercase tracking-wide sm:text-[1.05rem]">
        {open(r.status) ? r.label : "SUSPENDED"}
      </span>
    </div>
  );

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between bg-[#2E4B5C] px-3 py-[7px]">
        <span className="text-[0.85rem] font-bold text-white sm:text-[0.95rem]">Runs ⓘ</span>
        <span className="text-[0.7rem] font-semibold text-white sm:text-[0.82rem]">
          Min/Max: {min} - {max}
        </span>
      </div>
      <div className="grid grid-cols-2 border-b border-black/10 bg-[#F1F1F1]">
        <span className="py-[6px] text-center text-[0.85rem] font-semibold text-black/80 sm:text-[0.95rem]">
          Back
        </span>
        <span className="py-[6px] text-center text-[0.85rem] font-semibold text-black/80 sm:text-[0.95rem]">
          Back
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-0 px-2 py-2 sm:px-3 sm:py-3">
        <div className="flex flex-col gap-2 border-r border-black/10 pr-2 sm:gap-3 sm:pr-4">
          {left.map((r) => (
            <Plate key={r.selectionId} r={r} />
          ))}
        </div>
        <div className="flex flex-col gap-2 pl-2 sm:gap-3 sm:pl-4">
          {right.map((r) => (
            <Plate key={r.selectionId} r={r} />
          ))}
        </div>
      </div>

      <div className="overflow-hidden bg-[#FFC800] py-[6px]">
        <div className="marquee-track flex w-max gap-16 whitespace-nowrap text-[0.85rem] font-bold text-black sm:text-[0.95rem]">
          {[0, 1].map((k) => (
            <span key={k}>
              {news ??
                "Results are based on stream only. Score board may be different or updated later"}
            </span>
          ))}
        </div>
      </div>

      {recent && recent.length ? (
        <div className="px-2 py-3 sm:px-3">
          <p className="text-[0.9rem] font-bold text-black sm:text-[0.95rem]">Recent Result</p>
          <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">

            {recent.slice(0, 10).map((w, i) => (
              <span
                key={`${w}-${i}`}
                className={`grid h-9 w-9 place-items-center rounded-[6px] text-[0.9rem] font-bold sm:h-11 sm:w-11 sm:text-[1rem] ${
                  w === "W"
                    ? "bg-[linear-gradient(180deg,#F98F86,#F26C61)] text-white"
                    : w === "6"
                      ? "bg-[linear-gradient(180deg,#A9A9F7,#8E8EF0)] text-black"
                      : w === "4"
                        ? "bg-[linear-gradient(180deg,#7FE0A2,#4CCB7C)] text-black"
                        : "bg-[linear-gradient(180deg,#E3DE4A,#CFC820)] text-black"
                }`}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

