/**
 * Shared round countdown badge used by every live/original game.
 * Thin conic ring (green, red under 5s) with the seconds in the middle.
 * Hides itself once the round is closed or the timer reaches zero.
 */
export function RoundTimer({
  leftSec,
  suspended,
  total = 30,
  className = "absolute right-2 top-2 z-20",
  size = "h-11 w-11 sm:h-12 sm:w-12",
  variant = "default",
}: {
  leftSec?: number | null | undefined;
  suspended?: boolean | undefined;
  total?: number | undefined;
  className?: string | undefined;
  size?: string | undefined;
  variant?: "default" | "bbb" | undefined;
}) {
  const secs = Math.max(0, Math.round(leftSec ?? 0));
  if (suspended || leftSec == null || secs <= 0) return null;
  const pct = Math.max(0, Math.min(1, secs / Math.max(total, secs)));
  const ring = variant === "bbb" ? "#2E7D32" : secs <= 5 ? "#EF4444" : "#22C55E";
  const track = variant === "bbb" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)";
  return (
    <span
      className={`pointer-events-none grid place-items-center rounded-full ${size} ${className}`}
      style={{
        background: `conic-gradient(${ring} ${pct * 360}deg, ${track} 0deg)`,
      }}
    >
      <span
        className={
          variant === "bbb"
            ? "grid h-[86%] w-[86%] place-items-center rounded-full text-[1.1rem] font-extrabold text-white"
            : "grid h-[82%] w-[82%] place-items-center rounded-full bg-black/85 text-[0.95rem] font-black sm:text-base"
        }
        style={
          variant === "bbb"
            ? { background: "rgba(150,150,150,0.78)", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }
            : { color: ring }
        }
      >
        {secs}
      </span>
    </span>
  );
}
