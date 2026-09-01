import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout, type DocSection } from "@/components/DocsLayout";

export const Route = createFileRoute("/casino-docs")({
  head: () => ({
    meta: [
      { title: "Casino API Docs — Universal API" },
      {
        name: "description",
        content:
          "Endpoints for the Universe Live casino feed: game list, live table state, odds markets and round results.",
      },
      { property: "og:title", content: "Casino API Docs — Universal API" },
      {
        property: "og:description",
        content: "Game list, table state, odds and results endpoints for Universe Live.",
      },
    ],
  }),
  component: CasinoDocs,
});

const SECTIONS: DocSection[] = [
  {
    id: "games",
    title: "List games",
    description: "Returns every live table available in the Universe Live lobby.",
    method: "GET",
    path: "/api/casino/games",
    sample: `{
  "provider": "universe-live",
  "count": 20,
  "games": [
    { "id": "99.0010", "name": "20-20 TEENPATTI", "kind": "teenpatti", "status": "live" },
    { "id": "99.0019", "name": "20-20 DRAGON TIGER", "kind": "dragontiger", "status": "live" }
  ]
}`,
  },
  {
    id: "table",
    title: "Table state",
    description: "Current round id, phase, dealt cards and countdown for a single table.",
    method: "GET",
    path: "/api/casino/games/{gameId}/state",
    sample: `{
  "gameId": "99.0010",
  "rid": "9100109135558",
  "phase": "suspended",
  "secondsLeft": 4,
  "cards": {
    "playerA": ["S7", "H4", null],
    "playerB": ["H5", null, null]
  }
}`,
  },
  {
    id: "odds",
    title: "Odds markets",
    description: "All markets for a table with min/max stake, price and matched volume.",
    method: "GET",
    path: "/api/casino/games/{gameId}/odds",
    sample: `{
  "gameId": "99.0010",
  "markets": [
    {
      "title": "WINNER",
      "min": 100, "max": 500000, "status": "SUSPENDED",
      "runners": [
        { "name": "PLAYER A", "price": 1.98, "volume": 2283528 },
        { "name": "PLAYER B", "price": 1.98, "volume": 2258566 }
      ]
    }
  ]
}`,
  },
  {
    id: "results",
    title: "Round results",
    description: "Last completed rounds with winner and settlement payload.",
    method: "GET",
    path: "/api/casino/games/{gameId}/results",
    sample: `{
  "gameId": "99.0010",
  "results": [
    { "rid": "9100109135558", "winner": "PLAYER A", "settledAt": "2026-09-01T13:22:08Z" },
    { "rid": "9100109135557", "winner": "PLAYER B", "settledAt": "2026-09-01T13:21:36Z" }
  ]
}`,
  },
  {
    id: "bet",
    title: "Place bet",
    description: "Submits a stake against an open market. Rejected while a market is suspended.",
    method: "POST",
    path: "/api/casino/bets",
    sample: `POST /api/casino/bets
{
  "gameId": "99.0010",
  "rid": "9100109135558",
  "market": "WINNER",
  "runner": "PLAYER A",
  "stake": 500
}

200 OK
{ "accepted": true, "betId": "b_7f21a", "price": 1.98 }`,
  },
];

function CasinoDocs() {
  return (
    <DocsLayout
      title="Casino API"
      intro="REST endpoints for the Universe Live casino feed. Every response is JSON; authenticate with your operator key in the Authorization header."
      sections={SECTIONS}
    >
      <pre className="mt-4 overflow-x-auto rounded-md bg-code-surface p-4 text-[0.8rem] text-code-foreground">
        <code>{`curl https://api.universal.example/api/casino/games \\
  -H "Authorization: Bearer <operator-key>"`}</code>
      </pre>
    </DocsLayout>
  );
}
