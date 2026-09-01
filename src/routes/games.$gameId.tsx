import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getGame } from "@/data/games";
import { useLiveGame } from "@/lib/live-engine";
import { CardHand } from "@/components/CardHand";
import { OddsBoard } from "@/components/OddsBoard";
import { RecentResults } from "@/components/RecentResults";

export const Route = createFileRoute("/games/$gameId")({
  loader: ({ params }) => {
    const game = getGame(params.gameId);
    if (!game) throw notFound();
    return { name: game.name, id: game.id };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Table unavailable — Universal API" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name} — Live Table | Universal API`;
    const description = `Live odds, cards and results for ${loaderData.name} streamed through the Universal API.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">Table not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm text-muted-foreground underline">
        ← Back to lobby
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div role="alert" className="mx-auto max-w-3xl px-4 py-16 text-center text-foreground">
      {error.message}
    </div>
  ),
  component: GamePage,
});

function GamePage() {
  const { gameId } = Route.useParams();
  const game = getGame(gameId)!;
  const live = useLiveGame(game);

  return (
    <div className="mx-auto max-w-[860px] px-4 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to lobby
          </Link>
          <p className="mt-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Live · Universe Live
          </p>
          <h1 className="text-3xl font-bold text-foreground">{game.name}</h1>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-live-pill px-3 py-1 text-sm font-semibold text-live-pill-foreground">
          <span className="h-2 w-2 rounded-full bg-current" /> Live
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-md">
        <div className="relative min-h-[380px] bg-table-felt p-2">
          <div className="flex items-start justify-between">
            <span className="text-[0.7rem] font-semibold text-white/85">RID: {live.rid}</span>
            <span className="rounded bg-black/50 px-2 py-0.5 text-[0.7rem] font-semibold text-white/85">
              {live.phase === "open" ? `Betting ${live.secondsLeft}s` : live.phase.toUpperCase()}
            </span>
          </div>
          <div className="mt-2 space-y-3">
            <CardHand title="Player A" cards={live.playerA} />
            <CardHand title="Player B" cards={live.playerB} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-40 items-end justify-center pb-3">
            <span className="text-[0.7rem] uppercase tracking-[0.2em] text-white/35">
              Live stream
            </span>
          </div>
        </div>

        {live.markets.map((m) => (
          <OddsBoard key={m.title} market={m} />
        ))}
      </div>

      <RecentResults results={live.recent} winner={live.lastWinner} />
    </div>
  );
}
