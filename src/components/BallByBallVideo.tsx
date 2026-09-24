import { useEffect, useRef, useState } from "react";

const BASE = "https://bbb.exchange24x7.live";

/**
 * Plays each round's own Ball by Ball video (the same feed Dukex uses).
 * The results list carries every round's own video path. On first load the
 * latest entry is already the previous result, so remember it without
 * replaying it. Play only entries declared after the player mounted, then
 * return to the animated fallback as soon as the clip finishes.
 */
export function BallByBallVideo({ fallback }: { fallback: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const lastRound = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const resultsResponse = await fetch(`${BASE}/api/ballbyball/results`, { cache: "no-store" });
        const resultsJson = await resultsResponse.json();
        const latest = resultsJson?.data?.[0];
        const resultRound = String(latest?.roundId ?? "");
        if (!alive || !resultRound || !latest?.videoUrl) return;

        // Do not replay the already-completed previous round on page load.
        if (lastRound.current === null) {
          lastRound.current = resultRound;
          return;
        }
        if (resultRound === lastRound.current) return;

        lastRound.current = resultRound;
        setSrc(`${BASE}${latest.videoUrl}`);
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
