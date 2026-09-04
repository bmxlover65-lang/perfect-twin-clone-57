import { useEffect, useState } from "react";
import { embedUrl, fetchSessionToken } from "@/lib/uapi";

type Props = {
  sportId: string;
  eventId: string;
  className?: string;
};

/**
 * Live TV player.
 *
 * Primary mode: iframe straight at the source site's own player page. Because the
 * iframe document lives on their origin, every media request inside it carries their
 * own Referer, which satisfies the stream CDN's Referer ACL.
 *
 * Fallback: our proxied player path, used when no session token can be minted.
 */
export function LiveTv({ sportId, eventId, className }: Props) {
  const [reload, setReload] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setToken(null);
    setFailed(false);
    fetchSessionToken()
      .then((r) => {
        if (alive) setToken(r.sessionToken || null);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [sportId, eventId, reload]);

  const direct = token ? embedUrl("player", sportId, eventId, token) : null;
  const src =
    direct ??
    (failed
      ? `/api/public/uapi/tv/sports/player?sportId=${sportId}&exEventId=${eventId}&tv=true&r=${reload}`
      : null);

  return (
    <div className={className}>
      <header className="flex items-center justify-between bg-ex-header px-4 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ex-text">
        Live TV
        <button
          type="button"
          onClick={() => setReload((k) => k + 1)}
          className="rounded bg-white/15 px-2 py-1 text-[0.65rem] font-bold tracking-normal hover:bg-white/25"
        >
          Reload
        </button>
      </header>
      {src ? (
        <iframe
          key={`${reload}-${src}`}
          title="Live TV"
          src={src}
          referrerPolicy="no-referrer"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          className="aspect-video h-[340px] max-h-[340px] w-full border-0 bg-black"
        />
      ) : (
        <div className="flex aspect-video h-[340px] max-h-[340px] w-full items-center justify-center bg-black text-xs text-white/60">
          Connecting live TV…
        </div>
      )}
    </div>
  );
}
