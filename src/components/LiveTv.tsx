import { useState } from "react";

type Props = {
  sportId: string;
  eventId: string;
  className?: string;
};

/**
 * Live TV player.
 *
 * The live feed's own TV service is the public dtv player, addressed by the
 * exchange event id + sport id. It is served from the provider's own origin, so
 * the stream CDN's Referer ACL is satisfied inside the iframe document.
 */
export function LiveTv({ sportId, eventId, className }: Props) {
  const [reload, setReload] = useState(0);

  const src = `https://dpmatka.in/dtv.php?id=${encodeURIComponent(eventId)}&sportid=${encodeURIComponent(
    sportId,
  )}&muted&r=${reload}`;

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
      <iframe
        key={src}
        title="Live TV"
        src={src}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="block aspect-video h-auto w-full border-0 bg-black"
      />
    </div>
  );
}
