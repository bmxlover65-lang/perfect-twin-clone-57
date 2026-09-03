import { Link } from "@tanstack/react-router";
import type { GameDef } from "@/data/games";

export function GameCard({ game }: { game: GameDef }) {
  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="group relative block rounded-[14px] p-px transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1.5"
      style={{
        background:
          "linear-gradient(150deg, color-mix(in oklab, var(--primary) 55%, transparent), transparent 42%, color-mix(in oklab, var(--brand-accent) 32%, transparent))",
      }}
    >
      <div className="relative aspect-[16/23] overflow-hidden rounded-[13px] bg-table-felt shadow-[0_10px_26px_-14px_rgba(0,0,0,0.85)] transition-shadow duration-300 group-hover:shadow-[0_20px_44px_-16px_rgba(0,0,0,0.95)]">
        {game.image ? (
          <img
            src={game.image}
            alt={game.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-[1.02] object-cover transition-transform duration-500 ease-out group-hover:scale-[1.09]"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(160deg, oklch(0.38 0.14 ${game.hues[0]}), oklch(0.18 0.08 ${game.hues[1]}))`,
            }}
          >
            <span className="text-5xl opacity-80 drop-shadow-lg">{game.glyph}</span>
          </div>
        )}

        {/* top light + depth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 70% at 50% -10%, oklch(1 0 0 / 0.22), transparent 58%)",
          }}
        />
        {/* cinematic vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(115% 90% at 50% 45%, transparent 45%, rgba(0,0,0,0.45) 100%)",
          }}
        />
        {/* glossy sweep on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent_35%,rgba(255,255,255,0.28)_50%,transparent_65%)] transition-transform duration-700 ease-out group-hover:translate-x-full" />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3">
          <span className="text-[0.82rem] font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {game.name}
          </span>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/12 px-2 py-[3px] text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md ring-1 ring-inset ring-white/25">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live-badge opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live-badge" />
            </span>
            Live
          </span>
        </div>

        {/* inner hairline */}
        <div className="pointer-events-none absolute inset-0 rounded-[13px] ring-1 ring-inset ring-white/10" />
      </div>
    </Link>
  );
}
