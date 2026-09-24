import { useEffect, useState } from "react";

const BASE = "https://bbb.exchange24x7.live";

/** Plays the latest Ball by Ball ball video (same feed Dukex uses); falls back to the banner. */
export function BallByBallVideo({ fallback }: { fallback: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${BASE}/api/ballbyball/results`, { cache: "no-store" });
        const j = await r.json();
        const url: string | undefined = j?.data?.[0]?.videoUrl;
        if (alive && url) setSrc(`${BASE}${url}`);
      } catch {
        /* keep previous */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
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
      poster={fallback}
      className="block h-full w-full bg-foreground object-cover"
    />
  );
}
