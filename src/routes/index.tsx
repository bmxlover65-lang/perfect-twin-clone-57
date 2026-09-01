import { createFileRoute } from "@tanstack/react-router";
import { GAMES } from "@/data/games";
import { GameCard } from "@/components/GameCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Universe Live Lobby — Universal API" },
      {
        name: "description",
        content:
          "Browse 20 live casino table games — Teen Patti, Dragon Tiger, Andar Bahar, Baccarat and more — streamed through the Universal API.",
      },
      { property: "og:title", content: "Universe Live Lobby — Universal API" },
      {
        property: "og:description",
        content: "20 live casino table games via the Universal API.",
      },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <div className="rounded-2xl border border-border/60 bg-lobby p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Universal API
            </p>
            <h1 className="text-3xl font-bold text-foreground">Universe Live</h1>
            <p className="mt-1 max-w-[640px] text-muted-foreground">
              Live casino table games via the Universal API.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
              {GAMES.length} games
            </span>
            <span className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
              Universe Live
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
}
