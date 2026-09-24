import { useEffect, useState } from "react";

const BASE = "https://bbb.exchange24x7.live";
const WS = "wss://bbb.exchange24x7.live/socket.io/?EIO=4&transport=websocket";

/**
 * Plays each round's own Ball by Ball video (same live feed Dukex uses).
 * The feed announces the round's video the moment betting closes.
 */
export function BallByBallVideo({ fallback }: { fallback: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const use = (url?: string | null) => {
      if (alive && url) setSrc(`${BASE}${url}`);
    };

    // Show the last ball's video until the next round closes.
    fetch(`${BASE}/api/ballbyball/results`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => use(j?.data?.[0]?.videoUrl))
      .catch(() => {});

    const connect = () => {
      if (!alive) return;
      ws = new WebSocket(WS);
      ws.onmessage = (e) => {
        const m = String(e.data);
        if (m === "2") return ws?.send("3");
        if (m.startsWith("0")) return ws?.send("40");
        if (m.startsWith("40")) {
          return ws?.send('42["join_market",{"marketId":"ballbyball-001"}]');
        }
        if (!m.startsWith("42")) return;
        try {
          const [ev, data] = JSON.parse(m.slice(2));
          if (ev === "market_suspended" || ev === "market_update") use(data?.videoUrl);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (alive) retry = setTimeout(connect, 3000);
      };
    };
    connect();

    return () => {
      alive = false;
      clearTimeout(retry);
      ws?.close();
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
