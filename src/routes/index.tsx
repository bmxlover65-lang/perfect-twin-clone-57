import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { GAMES, type GameDef } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { fetchCasinoGames, type CasinoGame } from "@/lib/uapi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Universe Live Lobby — Universal API" },
      {
        name: "description",
        content:
          "Live casino table games — Teen Patti, Dragon Tiger, Andar Bahar, Baccarat and more — streamed live through the Universal API.",
      },
      { property: "og:title", content: "Universe Live Lobby — Universal API" },
      {
        property: "og:description",
        content: "Real live casino table games via the Universal API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lobby,
});

function hue(id: string, offset: number) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (h + offset) % 360;
}

function toDef(g: CasinoGame): GameDef {
  const local = GAMES.find((x) => x.id === g.eventId);
  if (local) return { ...local, name: g.eventName };
  const words = g.eventName.split(/\s+/).filter(Boolean);
  const glyph = words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return {
    id: g.eventId,
    name: g.eventName,
    kind: "teenpatti",
    hues: [hue(g.eventId, 0), hue(g.eventId, 40)],
    glyph: glyph || "UA",
    markets: [],
    results: [],
  };
}

function Lobby() {
  const [games, setGames] = useState<CasinoGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetchCasinoGames();
      setGames(res.games ?? []);
      setError(null);
      setRefreshedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  const list = games.length ? games.map(toDef) : GAMES;

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
              Real live casino table games. Data source:{" "}
              <span className="font-semibold text-foreground">
                Universal API (universeapi.shop/public)
              </span>{" "}
              via server proxy <code className="font-mono">/api/public/uapi/games</code>.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading live game list…"
                : error
                  ? `API error — showing cached catalog (${error})`
                  : `Catalog refreshed ${refreshedAt}`}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
              {list.length} live games
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
}
