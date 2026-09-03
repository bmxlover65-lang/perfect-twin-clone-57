import { Link } from "@tanstack/react-router";
import type { GameDef } from "@/data/games";

export function GameCard({ game }: { game: GameDef }) {
  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="group block overflow-hidden rounded-xl bg-card shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-[16/23] overflow-hidden bg-table-felt">
        {game.image ? (
          <img
            src={game.image}
            alt={game.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
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
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 70% at 50% 0%, oklch(1 0 0 / 0.18), transparent 60%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/80 via-black/15 to-transparent p-3">
          <span className="text-sm font-bold leading-tight text-white">{game.name}</span>
          <span className="self-start rounded-md bg-live-badge px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-live-badge-foreground">
            Live
          </span>
        </div>
      </div>
    </Link>
  );
}
