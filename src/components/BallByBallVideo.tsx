import { useEffect, useRef, useState } from "react";

const BASE = "https://bbb.exchange24x7.live";

/**
 * Plays each round's own Ball by Ball video (the same feed Dukex uses).
 * The results list carries every round's own video path. Only play a video
 * when its result belongs to the live market round, then return to the
 * animated fallback as soon as that clip finishes.
 */
export function BallByBallVideo({ fallback }: { fallback: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const lastRound = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const [marketResponse, resultsResponse] = await Promise.all([
          fetch(`${BASE}/api/ballbyball/market`, { cache: "no-store" }),
          fetch(`${BASE}/api/ballbyball/results`, { cache: "no-store" }),
        ]);
        const [marketJson, resultsJson] = await Promise.all([
          marketResponse.json(),
          resultsResponse.json(),
        ]);
        const currentRound = String(marketJson?.data?.roundId ?? "");
        const latest = resultsJson?.data?.[0];
        const resultRound = String(latest?.roundId ?? "");
        if (!alive || !currentRound || !resultRound || !latest?.videoUrl) return;

        // Ignore the previous round during the next betting window. Dukex
        // starts a clip only after the current round's result is declared.
        if (resultRound === currentRound && resultRound !== lastRound.current) {
          lastRound.current = resultRound;
          setSrc(`${BASE}${latest.videoUrl}`);
        }
      } catch {
        /* ignore, retry next tick */
      }
    };

    void tick();
    const id = setInterval(tick, 1000);
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
      preload="auto"
      onEnded={() => setSrc(null)}
      onError={() => setSrc(null)}
      className="block h-full w-full bg-foreground object-cover"
    />
  );
}
