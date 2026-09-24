import { useEffect, useRef, useState } from "react";

const BASE = "https://bbb.exchange24x7.live";

/**
 * Plays each round's own Ball by Ball video (the same feed Dukex uses).
 * The results list carries every round's own video path; the moment a new
 * round's result is declared, that round's video starts playing.
 */
export function BallByBallVideo({ fallback }: { fallback: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const lastRound = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const r = await fetch(`${BASE}/api/ballbyball/results`, { cache: "no-store" });
        const j = await r.json();
        const latest = j?.data?.[0];
        if (!alive || !latest?.roundId || !latest?.videoUrl) return;
        // New round declared -> play that round's own video.
        if (latest.roundId !== lastRound.current) {
          lastRound.current = latest.roundId;
          setSrc(`${BASE}${latest.videoUrl}`);
        }
      } catch {
        /* ignore, retry next tick */
      }
    };

    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!src) {
    return <img src={fallback} alt="Ball by Ball" loading="eager" className="block h-full w-full object-cover" />;
  }
  return (
    <video
      key={src}
      src={src}
      autoPlay
      muted
      playsInline
      className="block h-full w-full bg-foreground object-cover"
    />
  );
}
