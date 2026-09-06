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

/** Feed sometimes spells the plane game "VIMAN" — always show "VIMAAN". */
function fixName(name: string) {
  return name.replace(/\bVIMAN\b/gi, "VIMAAN");
}

function toDef(g: CasinoGame): GameDef {
  const local = GAMES.find((x) => x.id === g.eventId);
  if (local) return { ...local, name: fixName(g.eventName) };
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
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const BBB = "4.3544687543453";
  const VIMAAN = "88.0030";
  const fromApi = games.length ? games.map(toDef) : GAMES;
  const extras = GAMES.filter((g) => !fromApi.some((x) => x.id === g.id));
  const raw = [...fromApi, ...extras];
  // Keep the two instant games together at the top of the lobby.
  const rank = (id: string) => (id === VIMAAN ? -2 : id === BBB ? -1 : 0);
  const list = [...raw].sort((a, b) => rank(a.id) - rank(b.id));


  return (
    <div className="relative mx-auto max-w-[1200px] px-4 py-5">
      <div className="relative">
        <div className="mb-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Universal API
          </p>
          <h1 className="mt-1.5 text-[2rem] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-[2.4rem]">
            Universe Live — Live Casino Games Lobby
          </h1>

          <p className="mt-2 max-w-[640px] text-[0.95rem] leading-relaxed text-muted-foreground">
            Live casino table games via the Universal API.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <span className="rounded-full bg-card/80 px-3.5 py-1.5 text-[0.82rem] font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border/70 backdrop-blur">
              {list.length} games
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3.5 py-1.5 text-[0.82rem] font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border/70 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live-badge opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live-badge" />
              </span>
              Universe Live
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {list.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
}
