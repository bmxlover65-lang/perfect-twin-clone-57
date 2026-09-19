import { useEmbed } from "@/lib/embed";
import { useEffect, useRef, useState } from "react";
import { RoundTimer } from "@/components/RoundTimer";
import { SuccessToast } from "@/components/betting";
import { cancelBet, cashOut, placeBet } from "@/lib/wallet";
import { playerSession } from "@/lib/player";
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
import balloonPlane from "@/assets/vimaan/plane.png.asset.json";
import balloonPlane2 from "@/assets/vimaan/plane-2.png.asset.json";
import balloonStars from "@/assets/vimaan/stars.png.asset.json";
import balloonClouds from "@/assets/vimaan/clouds.png.asset.json";

const LOCATIONS = [skyBg, skyBg, loc1, loc2, loc3];
const BALLOON_STAKES = [10, 50, 100, 500, 1000, 2500, 5000, 10000];

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
          <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-[86px] w-[86px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#F2C500] bg-[#151515] text-[2.2rem] font-black leading-none text-[#F2C500]">
            U
          </span>
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

/** Dream Catcher's own sound: a slowing flapper tick, different from Lucky 0-9. */
function playDreamSpin() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    let t = 0;
    let gap = 0.045;
    while (t < 6) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1400 - t * 90;
      gain.gain.setValueAtTime(0.09, start + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t + 0.035);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + t);
      osc.stop(start + t + 0.04);
      t += gap;
      gap *= 1.045;
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 7000);
  } catch {
    // audio unavailable
  }
}


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
    playDreamSpin();
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
          <svg viewBox="0 0 400 400" className="h-[400px] w-[400px] max-w-full drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] sm:h-[600px] sm:w-[600px]">
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
          className="pointer-events-none absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[180px] sm:w-[180px]"
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


export function BalloonStage({

  multiplier,
  roundId,
  suspended,
  status,
}: {
  multiplier: string;
  roundId?: string | undefined;
  suspended?: boolean;
  status?: string | undefined;
  leftSec?: number | undefined;
}) {
  const [muted, setMuted] = useState(false);
  const [stake, setStake] = useState(100);
  const [phase, setPhase] = useState<"waiting" | "flying" | "crashed">("waiting");
  const [shown, setShown] = useState(1);
  const [climb, setClimb] = useState(0);
  const [wait, setWait] = useState(8);
  const [crashAt, setCrashAt] = useState(2);
  const [history, setHistory] = useState<number[]>([]);
  const [autos, setAutos] = useState<[boolean, boolean]>([false, false]);
  const [autoX, setAutoX] = useState<[string, string]>(["1.10", "1.10"]);

  const embedded = useEmbed();
  const [bets, setBets] = useState<(null | { entry: number; stake: number; pending?: boolean; ref?: string })[]>([
    null,
    null,
  ]);
  const [flash, setFlash] = useState<(null | { text: string; win: boolean })[]>([null, null]);
  // one bet per round per panel
  const [used, setUsed] = useState<[boolean, boolean]>([false, false]);
  const [betOk, setBetOk] = useState<string | null>(null);
  const usedRef = useRef(used);
  usedRef.current = used;

  const airRef = useRef<HTMLAudioElement | null>(null);
  const apiTarget = Number(multiplier) || 0;
  const apiRef = useRef(apiTarget);
  apiRef.current = apiTarget;
  const roundRef = useRef<string | undefined>(roundId);
  roundRef.current = roundId;
  const statusRef = useRef((status ?? "").toUpperCase());
  statusRef.current = (status ?? "").toUpperCase();
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
    const id = window.setInterval(load, 250);
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
    const initialStatus = statusRef.current;
    let ph: "waiting" | "flying" | "crashed" =
      roundRef.current && (initialStatus === "RUN" || (!initialStatus && apiRef.current >= 1))
        ? "flying"
        : "waiting";
    let t = 8; // seconds left in the current phase
    let v = 1;
    let target = 2;
    let curRound = roundRef.current;
    let lastFeedRound = roundRef.current;
    let lastStatus = statusRef.current;
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
          const ref = placeBet({
            gameId: "balloon",
            gameName: "Balloon",
            round: String(curRound ?? roundRef.current ?? "live"),
            label: "Cash out",
            odds: 1,
            stake: stakeRef.current,
          });
          if (!ref) return null;
          return { entry: 1, stake: stakeRef.current, ref };
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

    if (ph === "flying") startRound(curRound);


    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const apiRound = roundRef.current;
      const api = apiRef.current;
      const apiStatus = statusRef.current;

      // a genuinely new round id from the feed: sync back to live mode
      if (apiRound && apiRound !== lastFeedRound) {
        lastFeedRound = apiRound;
        stale = false;
        curRound = apiRound;
        if (apiStatus === "RUN") {
          startRound(apiRound);
        } else {
          ph = "waiting";
          setPhase("waiting");
          setShown(1);
          setClimb(0);
          t = 8;
        }
        lastStatus = apiStatus;
        raf = window.requestAnimationFrame(tick);
        return;
      }
      // Balloon's upstream has explicit WAIT → RUN → BLAST states. Follow
      // those transitions directly so take-off and burst happen with the real
      // table, even though the round id may stay unchanged between frames.
      if (apiStatus !== lastStatus) {
        if (apiStatus === "RUN" && ph !== "flying") {
          startRound(apiRound);
          lastStatus = apiStatus;
          raf = window.requestAnimationFrame(tick);
          return;
        }
        if (apiStatus === "BLAST" && ph === "flying") {
          burst(Math.max(1, api, peak));
          lastStatus = apiStatus;
          raf = window.requestAnimationFrame(tick);
          return;
        }
        if (apiStatus === "WAIT" && ph !== "crashed") {
          ph = "waiting";
          setPhase("waiting");
          setShown(1);
          setClimb(0);
          t = 8;
        }
        lastStatus = apiStatus;
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
            // The history row is the authoritative burst event. Do not ease
            // toward it after publication; the real game stops immediately.
            peak = official;
            v = official;
            setShown(official);
            burst(official);
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
            t = 8;
          } else {
            // With a live round id, wait for the upstream id to advance. This
            // keeps take-off locked to the real game instead of starting an
            // independent local round after the countdown.
            if (apiRound) {
              t = 0.25;
            } else {
              stale = true;
              startRound(undefined);
            }
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
        cancelBet(b.ref, b.stake);
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
        const payout = cashOut(b.ref, b.stake, shown);
        setFlash((f) => {
          const n = [...f];
          n[i] = { text: `+${payout.toLocaleString("en-IN")}`, win: true };
          return n;
        });
        next[i] = null;
      } else {
        // no new bets once the round has started, and only one bet per round
        if (phase === "flying" || usedRef.current[i]) return prev;
        if (stake < 100) return prev;
        const ref = placeBet({
          gameId: "balloon",
          gameName: "Balloon",
          round: String(roundRef.current ?? "live"),
          label: "Cash out",
          odds: 1,
          stake,
        });
        if (!ref) return prev;
        next[i] = { entry: 1, stake, pending: true, ref };
        setBetOk("Casino BetPlace Successful.");
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
      const payout = cashOut(b.ref, b.stake, target);
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
  const grow = Math.min(1, climb * 0.66 + (Math.log(Math.max(1, shown)) / Math.log(10)) * 0.22);

  const bgIndex = Math.abs(hashStr(roundId ?? "0")) % LOCATIONS.length;

  const histColor2 = (v: number) =>
    v >= 10
      ? "bg-[#7B2FF2] text-white"
      : v >= 2
        ? "bg-[#E8871E] text-white"
        : "bg-[#123A73] text-white";

  const seedHist = [1.81, 5.68, 2.58, 1.12, 1.15, 3.88, 2.59, 1.3, 1.25, 1.03];
  const histList = (history.length ? history : seedHist).slice(0, 12);
  const crowd = [
    { name: "t••••••s", amount: "100.00", tone: "bg-[#D85C45]", winning: false },
    { name: "a••••••7", amount: "+75.50", tone: "bg-[#E1AF31]", winning: true },
  ];





  return (
    <div className={`w-full bg-[linear-gradient(160deg,#2B2B2E_0%,#0A0A0B_55%,#1A1A1D_100%)] p-1 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/10 ${embedded ? "min-h-dvh rounded-none" : "rounded-[10px]"}`}>
      <div className={`relative w-full overflow-hidden bg-[linear-gradient(180deg,#4FB6CE_0%,#7ACBD6_38%,#BFE0CC_66%,#F3E4B4_88%,#F7EFD2_100%)] ${embedded ? "h-[calc(100dvh-0.5rem)] rounded-[7px]" : "h-[calc(100dvh-132px)] min-h-[650px] rounded-[7px] sm:h-auto sm:min-h-0 sm:aspect-[16/10]"}`}>
        {/* premium cinematic vignette + top sheen */}
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            background:
              "radial-gradient(120% 85% at 50% 40%, transparent 52%, rgba(0,0,0,0.42) 100%), linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 22%)",
          }}
        />
        {/* sky artwork — parallax: the ground drops away as the balloon climbs */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={(flying || popped ? LOCATIONS[bgIndex] : loc2)!.url}
            alt=""
            className="absolute inset-x-0 bottom-0 h-auto w-full object-contain object-bottom opacity-95 sm:bottom-0"
            style={{
              transform: `translateY(${grow * 72}%)`,
              transition: "transform 800ms ease-out",
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
                 { top: 3, size: 11, dur: 11, delay: 0 },
                 { top: 7, size: 8, dur: 13, delay: 2.2 },
                 { top: 1, size: 13, dur: 12, delay: 4.4 },
                 { top: 9, size: 7, dur: 14, delay: 1.2 },
              ].map((c, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute rounded-full bg-white/70 blur-[1px]"
                  style={{
                    top: `${c.top}%`,
                    left: `${i % 2 === 0 ? 8 + i * 9 : 62 - i * 6}%`,
                    width: `${c.size}%`,
                     height: `${c.size * 0.3}%`,
                     opacity: 0.12 + grow * 0.26,
                    animation: `cloudDrift ${c.dur}s linear ${c.delay}s infinite`,
                  }}
                />
              ))
            : null}
          {/* supplied Balloon atmosphere appears only during flight, matching the reference round */}
          {flying ? (
            <>
              <div className="balloon-cloud-fall pointer-events-none absolute inset-x-0 top-0 h-[25%] opacity-0">
                <img
                  src={balloonStars.url}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-x-[7%] top-0 h-[60%] w-[86%] object-cover opacity-[0.38]"
                />
                <img
                  src={balloonClouds.url}
                  alt=""
                  aria-hidden="true"
                  className="absolute left-[8%] top-[4%] h-[26%] w-[20%] object-cover opacity-52"
                />
                <img
                  src={balloonClouds.url}
                  alt=""
                  aria-hidden="true"
                  className="absolute right-[12%] top-[16%] h-[23%] w-[18%] object-cover opacity-46"
                />
              </div>
              <div className="balloon-plane-flight pointer-events-none absolute inset-x-0 bottom-[25%] h-[31%] overflow-visible">
                <svg viewBox="0 0 337 176" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                  <path
                    className="balloon-air-trail"
                    d="M -24 143 C 76 151, 151 143, 226 120 S 317 92, 390 111"
                    pathLength="100"
                    fill="none"
                    stroke="#FFD8C0"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
                <img
                  src={Math.floor(shown * 10) % 2 === 0 ? balloonPlane.url : balloonPlane2.url}
                  alt=""
                  aria-hidden="true"
                  className="balloon-plane-run absolute left-0 top-0 h-auto w-[54px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.2)] sm:w-[66px]"
                />
              </div>
            </>
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(79,182,206,0.12)_0%,rgba(122,203,214,0.05)_38%,rgba(247,239,210,0)_70%)]" />
        </div>


        {/* The Royal game keeps the balloon visible through flight, result and countdown. */}
          <div
            className={`absolute left-1/2 z-10 ${flying || popped ? "w-[40%] min-w-[124px] max-w-[220px] sm:w-[25%] sm:min-w-[158px]" : "w-[40%] min-w-[128px] max-w-[142px] sm:w-[24%] sm:min-w-[145px] sm:max-w-[172px]"}`}
            style={{
              top: flying || popped ? undefined : "34%",
              bottom: flying || popped ? `${31 + grow * 8}%` : undefined,
              transform: "translateX(-50%)",
              transition: "bottom 240ms linear, top 240ms linear, transform 240ms linear",
            }}
          >


            <img
              src={balloonImg.url}
              alt="Balloon"
              className="w-full animate-[balloonSway_3s_ease-in-out_infinite]"
              style={{ filter: "drop-shadow(0 14px 20px rgba(0,0,0,0.28))" }}
            />
            {/* burner flame — small flame coming out of the black burner above the basket */}
            {flying ? <div
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
            </div> : null}
            {flying || popped ? (
              <p
                className="absolute left-1/2 top-[36%] w-[120%] -translate-x-1/2 text-center text-[clamp(1.65rem,5.3vw,3.3rem)] font-extrabold leading-none text-white"
                style={{
                  textShadow:
                    "0 2px 2px rgba(0,0,0,0.42), 0 0 10px rgba(255,255,255,0.3)",
                }}
              >
                {(popped ? crashAt : shown).toFixed(2)}x
              </p>
            ) : (
              <div className="absolute left-1/2 top-[30%] w-[118%] -translate-x-1/2 text-center">
                <p className="whitespace-nowrap text-[clamp(0.66rem,2vw,1.05rem)] font-extrabold leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                  Waiting For Next Round
                </p>
                <span
                  className="mt-[7px] inline-grid h-10 w-10 place-items-center rounded-full sm:h-12 sm:w-12"
                  style={{
                    background: `conic-gradient(#63F22E ${(Math.min(8, Math.max(0, wait)) / 8) * 360}deg, rgba(0,0,0,0.18) 0deg)`,
                    padding: 3,
                  }}
                >
                  <span className="grid h-full w-full place-items-center rounded-full bg-black/30 text-[1rem] font-extrabold text-white sm:text-[1.25rem]">
                    {wait}
                  </span>
                </span>
              </div>
            )}
          </div>

        {/* top bar: full-line results strip, mute sits below it */}
        <div className="absolute inset-x-0 top-0 z-20 px-2.5 py-2.5">
          <div className="flex w-full flex-nowrap items-center gap-[5px] overflow-hidden">
            {histList.slice(0, 7).map((v, i) => (
              <span
                key={i}
                className={`balloon-result-pill shrink-0 rounded-[4px] px-[7px] py-[4px] text-[0.58rem] font-extrabold leading-none shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.28)] ring-1 ring-inset ring-white/15 sm:px-2.5 sm:text-[0.78rem] ${histColor2(v)}`}
              >
                {v.toFixed(2)}x
              </span>
            ))}
            <span className="ml-auto flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#E8A33D] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.28)] sm:h-7 sm:w-7">
              <img src={arrowDown.url} alt="" className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
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
            className="mt-2.5 shrink-0 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
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


        {/* profile and anonymised live activity; never exposes the integration user's balance */}
        <div className="absolute left-0 top-[11%] z-20">
          <div className="flex w-fit items-center gap-1 rounded-r-full bg-[#4E9AC5]/70 py-[3px] pl-2 pr-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.18)]">
            <img src={profileIcon.url} alt="" className="h-[18px] w-[18px] shrink-0" />
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#2C7BE5] shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 14.5l6-6 6 6" />
              </svg>
            </span>
          </div>
          <div className="mt-2 space-y-[2px] pl-1.5">
            {crowd.map((person, index) => (
              <div
                key={person.name}
                className="flex h-[17px] items-center text-[0.48rem] font-extrabold text-[#17251E] drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]"
                style={{ opacity: 1 - index * 0.06 }}
              >
                <span className={`mr-0.5 grid h-[14px] w-[14px] place-items-center rounded-full ring-1 ring-white/60 ${person.tone}`}>
                  <img src={profileIcon.url} alt="" className="h-[9px] w-[9px] brightness-0 invert" />
                </span>
                <span className="w-[44px] truncate">{person.name}</span>
                <span className={`ml-1 tabular-nums ${person.winning ? "text-[#168D3B]" : ""}`}>{person.amount}</span>
              </div>
            ))}
          </div>
        </div>





        {betOk ? <SuccessToast message={betOk} onDone={() => setBetOk(null)} /> : null}

        {/* compact Royal-style betting dock */}
        <div className="balloon-bet-dock absolute inset-x-0 bottom-[34px] z-20 mx-auto flex w-[min(327px,calc(100%-8px))] items-end gap-[24px] rounded-[13px] px-[6px] pb-[5px] pt-[7px] sm:bottom-[44px] sm:w-[min(620px,calc(100%-24px))] sm:gap-4 sm:px-4 sm:pb-4">
          {/* left cluster: auto toggles + stakes + edits/clear/min/max */}
          <div className="shrink-0">
            <div className="mb-[4px] grid w-[218px] grid-cols-[141px_77px] items-center sm:w-[370px] sm:grid-cols-[250px_120px]">
              {([0, 1] as const).map((i) => (
                <div
                  key={i}
                  className={`flex w-[77px] items-center justify-between text-white ${i === 0 ? "pl-[2px]" : "sm:w-[110px]"}`}
                >
                  <button
                    type="button"
                    onClick={() => setAutos((a) => (i === 0 ? [!a[0], a[1]] : [a[0], !a[1]]))}
                    className="contents text-[0.68rem] font-extrabold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] sm:text-[0.82rem]"
                    aria-pressed={autos[i]}
                  >
                    Auto
                    <span
                      className={`relative inline-flex h-[15px] w-[32px] items-center rounded-full border border-white/45 transition-colors sm:h-5 sm:w-10 ${
                        autos[i] ? "bg-[#2FA84F]" : "bg-[#D9D9D9]"
                      }`}
                    >
                      <span
                          className={`absolute top-[1px] h-[11px] w-[11px] rounded-full bg-white shadow transition-all sm:top-[2px] sm:h-4 sm:w-4 ${
                           autos[i] ? "left-[18px] sm:left-[1.35rem]" : "left-[2px]"
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
            <div className="flex items-start gap-[18px] sm:gap-2">
              <div className="grid grid-cols-2 gap-x-[13px] gap-y-[3px] sm:gap-x-2 sm:gap-y-1.5">
                {BALLOON_STAKES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStake(s)}
                    className={`balloon-stake h-[18px] w-[51px] rounded-full text-[0.6rem] font-extrabold transition-transform active:scale-95 sm:h-8 sm:w-[150px] sm:text-[0.95rem] ${
                      stake === s ? "ring-2 ring-[#E01E1E]" : s < 100 ? "opacity-65" : ""
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="grid w-[48px] gap-[3px] sm:w-[110px] sm:gap-1.5">
                {(
                  [
                    [
                      "Edits",
                      100,
                      "border border-[#8A4A05] bg-[linear-gradient(180deg,#F5A63A_0%,#E8871E_52%,#C26A0C_100%)] text-white",
                    ],
                    [
                      "Clear",
                      0,
                      "border border-[#7C0B0B] bg-[linear-gradient(180deg,#F04A4A_0%,#DE1C1C_52%,#A81010_100%)] text-white",
                    ],
                    [
                      "Min",
                      100,
                      "border border-white/55 bg-[linear-gradient(180deg,#4A2A58_0%,#33193F_55%,#241029_100%)] text-white/85",
                    ],
                    [
                      "Max",
                      10000,
                      "border border-white/55 bg-[linear-gradient(180deg,#4A2A58_0%,#33193F_55%,#241029_100%)] text-white/85",
                    ],
                  ] as const
                ).map(([label, val, tone]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStake(val)}
                    className={`h-[19px] rounded-full text-[0.58rem] font-extrabold shadow-[0_1px_2px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform active:scale-95 sm:h-8 sm:text-[0.9rem] ${tone}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* heat buttons — bet / queue for next round / cash out */}
          <div className="ml-auto mr-[5px] grid h-[84px] w-[96px] shrink-0 grid-rows-2 gap-[6px] sm:mr-0 sm:h-[136px] sm:w-[24%] sm:min-w-[150px] sm:max-w-none sm:gap-2">
            {([0, 1] as const).map((i) => {
              const bet = bets[i];
              const fl = flash[i];
              const live = bet && !bet.pending;
               const blocked = !bet && (phase === "flying" || used[i] || stake < 100);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pressHeat(i)}
                  disabled={blocked}
                  aria-label={blocked ? "Betting locked" : live ? "Cash out" : "Place heat bet"}
                  className={`relative flex h-full items-center justify-center gap-1 rounded-[7px] border-2 border-[#0C2A14] text-[1.1rem] font-extrabold text-white ring-1 ring-inset ring-white/35 transition-transform active:translate-y-[2px] active:shadow-none sm:gap-3 sm:text-[1.15rem] ${
                    blocked
                      ? "cursor-not-allowed bg-[linear-gradient(180deg,#259A42_0%,#14752C_52%,#07551B_100%)] shadow-[0_3px_0_#063B13]"
                      : live
                        ? "bg-[linear-gradient(180deg,#F0A500_0%,#D98200_100%)] shadow-[0_3px_0_#8A5600]"
                        : bet
                          ? "bg-[linear-gradient(180deg,#8C96A3_0%,#6B7480_100%)] shadow-[0_3px_0_#454C55]"
                          : "bg-[linear-gradient(180deg,#2FC552_0%,#159532_52%,#08621F_100%)] shadow-[0_3px_0_#063B13,inset_0_1px_0_rgba(255,255,255,0.4)]"
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
                      <img src={heatIcon.url} alt="" className="h-[33px] w-[33px] sm:h-8 sm:w-8" />
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

/** Recent-result bubble colours, matching the live reference board. */
function resultTone(label: string) {
  const l = label.toUpperCase();
  if (l.startsWith("W")) return "#D32F2F";
  if (l.startsWith("EX")) return "#7E57C2";
  if (l.startsWith("4") || l.startsWith("6")) return "#2E9E4F";
  if (l.startsWith("0")) return "#9AA1A8";
  return "#2F6FD0";
}

/** Reference shows 11 / 12.2 rather than 11.00 / 12.20. */
function fmtPrice(n: number) {
  return String(Number(n.toFixed(2)));
}

function plateTone(label: string) {
  const l = label.toUpperCase();
  if (l.startsWith("WICKET")) return "bbb-tone-wicket";
  if (l.startsWith("6")) return "bbb-tone-six";
  if (l.startsWith("4")) return "bbb-tone-four";
  return "bbb-tone-runs";
}

const open = (s?: string) =>
  ["ACTIVE", "ONLINE", "OPEN", "IN_PLAY"].includes((s ?? "").toUpperCase());

/**
 * One rate plate. Declared at module level on purpose: defining it inside the
 * board would give it a new component type on every live poll, which remounts
 * the plates, kills the shine animation and drops an open bet slip.
 */
const Plate = ({ r, index }: { r: BbbRunner; index: number }) => (
    <div
      data-market-option=""
      data-market-plate=""
      data-bet-label={r.label}
      data-bet-odds={r.backPrice ?? undefined}
      data-suspended={open(r.status) ? undefined : "true"}
      className={`bbb-rate-plate relative flex h-[68px] min-w-0 items-center gap-1 overflow-hidden rounded-[7px] px-2 text-casino-market-text sm:h-[70px] sm:px-2.5 ${plateTone(r.label)}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span className="pointer-events-none absolute bottom-0 left-[42%] top-0 z-[1] border-l-[3px] border-dashed border-casino-market-text" />
      <span className="relative z-[1] flex w-[42%] shrink-0 flex-col items-center justify-center leading-none">
        <span className="text-[0.72rem] font-extrabold sm:text-[0.76rem]">
          {r.backPrice ? fmtPrice(r.backPrice) : "—"}
        </span>
        <span className="mt-0.5 text-[0.62rem] font-medium sm:text-[0.65rem]">
          {r.backSize ? Math.round(r.backSize).toLocaleString("en-US", { useGrouping: false }) : ""}
        </span>
      </span>
      <span className="relative z-[1] flex min-w-0 flex-1 items-center justify-center gap-1 break-words text-center text-[0.78rem] font-extrabold uppercase leading-[0.86rem] sm:text-[0.82rem] sm:leading-[0.9rem]">
        <span className={r.label.length > 9 ? "min-w-0 break-words" : "whitespace-nowrap"}>
          {r.label}
        </span>
      </span>
      {open(r.status) ? null : (
        <span className="pointer-events-none absolute inset-0 z-[4] grid place-items-center bg-black/35">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] opacity-90" aria-label="Locked">
            <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="5" y="10" width="14" height="11" rx="2" fill="white" />
          </svg>
        </span>
      )}
    </div>
);

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
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="bg-background text-casino-market-text">
      <div className="flex h-[28px] items-center justify-between bg-casino-market-header px-2">
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="flex items-center gap-1 text-[0.68rem] font-bold text-board-header-foreground"
        >
          Runs
          <span className="grid h-[14px] w-[14px] place-items-center rounded-full border border-board-header-foreground text-[0.55rem] leading-none">
            i
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[0.56rem] font-medium text-board-header-foreground">
            Min/Max: {min} - {max}
          </span>
          <button
            type="button"
            aria-label="Open Ball by Ball rules"
            onClick={() => setRulesOpen(true)}
            className="grid h-[16px] w-[16px] place-items-center rounded-full border border-board-header-foreground text-[0.58rem] font-extrabold leading-none text-board-header-foreground"
          >
            i
          </button>
        </div>
      </div>
      <div className="grid h-[26px] grid-cols-2 border-b border-casino-market-divider bg-casino-market-body">
        <span className="flex items-center justify-center text-[0.86rem] font-semibold">
          Back
        </span>
        <span className="flex items-center justify-center text-[0.86rem] font-semibold">
          Back
        </span>
      </div>
      <div className="grid grid-cols-2 items-start gap-x-[40px] gap-y-[10px] bg-bbb-field px-[22px] py-[10px] sm:gap-x-12 sm:px-6">
        {runners.map((r, index) => (
          <Plate key={r.selectionId} r={r} index={index} />
        ))}
      </div>

      <div className="border-y border-casino-market-divider bg-secondary px-5 py-2 text-center text-[0.74rem] font-medium leading-[0.9rem] text-secondary-foreground">
        {news ?? "Results are based on stream only. Score board may be different or updated later"}
      </div>

      {recent && recent.length ? (
        <div className="flex h-[34px] items-center gap-1 overflow-hidden bg-background px-2">
          <p className="shrink-0 text-[0.56rem] font-bold">Recent Result</p>
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {recent.slice(0, 14).map((w, i) => (
              <span
                key={`${w}-${i}`}
                className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-[0.62rem] font-extrabold text-white"
                style={{ background: resultTone(w) }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {rulesOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-6"
          onClick={() => setRulesOpen(false)}
        >
          <div
            className="max-h-full w-full max-w-[370px] overflow-y-auto rounded-[12px] bg-bbb-field p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[1.02rem] font-bold text-casino-market-text">
              Ball by Ball Market Rules
            </p>
            <p className="mt-1.5 text-[0.76rem] font-semibold leading-[1.05rem] text-casino-market-text">
              These rules apply to each individual delivery and define how every available option
              will be settled.
            </p>
            <p className="mt-3 text-[0.86rem] font-bold text-casino-market-text">
              Available Options Rules
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {BBB_RULES.map((rule) => (
                <div key={rule.tag} className="rounded-[8px] bg-background p-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-[24px] min-w-[24px] place-items-center rounded-[5px] px-1 text-[0.74rem] font-extrabold ${
                        rule.tag === "EX"
                          ? "bg-casino-market-header text-board-header-foreground"
                          : `text-casino-market-text ${plateTone(rule.tone)}`
                      }`}
                    >
                      {rule.tag}
                    </span>
                    <span className="text-[0.82rem] font-bold text-foreground">{rule.title}</span>
                  </div>
                  <p className="mt-2 text-[0.76rem] font-medium leading-[1.02rem] text-foreground">
                    {rule.text}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-[8px] border-l-[5px] border-casino-market-header bg-background p-2.5">
              <p className="text-[0.84rem] font-bold text-foreground">
                Video &amp; Scoreboard Disclaimer
              </p>
              <p className="mt-2 text-[0.76rem] font-semibold leading-[1.02rem] text-foreground">
                Videos may be sourced from different broadcasters, which can result in delays or
                discrepancies in the scoreboard.
              </p>
              <p className="mt-2 text-[0.76rem] font-semibold leading-[1.02rem] text-foreground">
                In such cases, all bets will be settled strictly as per our platform rules and based
                on the video displayed on our system.
              </p>
              <p className="mt-2 text-[0.76rem] font-semibold leading-[1.02rem] text-foreground">
                Any delay or mismatch in external scoreboards will not affect the final result.
              </p>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="rounded-[6px] bg-casino-market-header px-12 py-2.5 text-[0.9rem] font-bold text-board-header-foreground"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

const BBB_RULES: { tag: string; tone: string; title: string; text: string }[] = [
  {
    tag: "0",
    tone: "0",
    title: "0 Runs",
    text: "Wins if exactly 0 runs are scored on the ball. No extras and no wicket should occur.",
  },
  { tag: "1", tone: "1", title: "1 Run", text: "Wins if exactly 1 run is scored off the bat." },
  { tag: "2", tone: "2", title: "2 Runs", text: "Wins if exactly 2 runs are scored off the bat." },
  { tag: "3", tone: "3", title: "3 Runs", text: "Wins if exactly 3 runs are scored off the bat." },
  { tag: "4", tone: "4", title: "4 Runs", text: "Wins only if a boundary four is scored." },
  { tag: "6", tone: "6", title: "6 Runs", text: "Wins only if a six is scored." },

  {
    tag: "W",
    tone: "WICKET",
    title: "Wicket",
    text: "Wins if any wicket falls on the ball. Wicket overrides all other outcomes.",
  },
  {
    tag: "EX",
    tone: "EXTRA",
    title: "Extra Runs",
    text: "Wins if the delivery results in any extras, including Wide, No Ball, Bye, or Leg Bye. This also applies when runs are scored along with extras, such as No Ball + 4, Wide + runs, or Bye + runs.",
  },
];

