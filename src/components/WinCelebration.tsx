import { useEffect, useRef, useState } from "react";

export const WIN_EVT = "uapi-win";
export const WIN_END_EVT = "uapi-win-end";

/** Fire a full-screen confetti celebration (win only). */
export function celebrateWin(amount = 0) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WIN_EVT, { detail: { amount } }));
}

/** Stop the celebration — called when the next round starts. */
export function endWinCelebration() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WIN_END_EVT));
}

const COLORS = [
  "#ff3b6b",
  "#ffd400",
  "#22c55e",
  "#38bdf8",
  "#a855f7",
  "#fb923c",
  "#f472b6",
  "#4ade80",
];

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
  drift: number;
  round: boolean;
}

function build(seed: number): Piece[] {
  return Array.from({ length: 120 }, (_, i) => ({
    id: seed * 1000 + i,
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    duration: 2.6 + Math.random() * 2.2,
    size: 7 + Math.random() * 9,
    color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
    rotate: Math.random() * 360,
    drift: (Math.random() - 0.5) * 120,
    round: Math.random() > 0.65,
  }));
}

/** Confetti overlay — shows only when a bet wins, never on a loss. */
export default function WinCelebration() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seed = useRef(0);

  useEffect(() => {
    const stop = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setPieces([]);
    };
    const onWin = () => {
      seed.current += 1;
      setPieces(build(seed.current));
      if (timer.current) clearTimeout(timer.current);
      // safety cap — celebration never hangs if no new round arrives
      timer.current = setTimeout(stop, 60000);
    };
    window.addEventListener(WIN_EVT, onWin as EventListener);
    window.addEventListener(WIN_END_EVT, stop as EventListener);
    return () => {
      window.removeEventListener(WIN_EVT, onWin as EventListener);
      window.removeEventListener(WIN_END_EVT, stop as EventListener);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!pieces.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-[-12%] block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--confetti-rotate" as string]: `${p.rotate}deg`,
            ["--confetti-drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
