import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout, type DocSection } from "@/components/DocsLayout";

export const Route = createFileRoute("/sports-docs")({
  head: () => ({
    meta: [
      { title: "Sports API Docs — Universal API" },
      {
        name: "description",
        content:
          "Endpoints for the Universal API sports exchange: competitions, in-play events, back/lay odds and settlement.",
      },
      { property: "og:title", content: "Sports API Docs — Universal API" },
      {
        property: "og:description",
        content: "Competitions, in-play events, odds and settlement endpoints.",
      },
    ],
  }),
  component: SportsDocs,
});

const SECTIONS: DocSection[] = [
  {
    id: "sports",
    title: "List sports",
    description: "Top-level sports with their active event counts.",
    method: "GET",
    path: "/api/sports",
    sample: `{
  "sports": [
    { "id": 4, "name": "Cricket", "events": 38 },
    { "id": 1, "name": "Football", "events": 126 },
    { "id": 2, "name": "Tennis", "events": 54 }
  ]
}`,
  },
  {
    id: "events",
    title: "In-play events",
    description: "Events currently in-play for a sport, with market ids.",
    method: "GET",
    path: "/api/sports/{sportId}/events?inplay=true",
    sample: `{
  "sportId": 4,
  "events": [
    {
      "eventId": "31284551",
      "name": "Mumbai Warriors v Chennai Kings",
      "openDate": "2026-09-01T13:00:00Z",
      "markets": ["1.2445", "bookmaker", "fancy"]
    }
  ]
}`,
  },
  {
    id: "odds",
    title: "Market odds",
    description: "Back and lay ladders with available sizes for a market.",
    method: "GET",
    path: "/api/sports/markets/{marketId}/odds",
    sample: `{
  "marketId": "1.2445",
  "status": "OPEN",
  "runners": [
    { "name": "Mumbai Warriors", "back": [{ "price": 1.86, "size": 41250 }], "lay": [{ "price": 1.88, "size": 38400 }] },
    { "name": "Chennai Kings", "back": [{ "price": 2.14, "size": 22800 }], "lay": [{ "price": 2.18, "size": 19650 }] }
  ]
}`,
  },
  {
    id: "fancy",
    title: "Fancy / session markets",
    description: "Session lines such as over runs, batsman runs and wickets.",
    method: "GET",
    path: "/api/sports/events/{eventId}/fancy",
    sample: `{
  "eventId": "31284551",
  "fancy": [
    { "name": "15 OVER RUNS", "yes": { "run": 128, "price": 100 }, "no": { "run": 127, "price": 100 }, "status": "OPEN" }
  ]
}`,
  },
  {
    id: "settlement",
    title: "Settlement webhook",
    description: "Signed callback fired when a market is settled or voided.",
    method: "POST",
    path: "/api/public/sports/settlement",
    sample: `POST /api/public/sports/settlement
X-UA-Signature: sha256=<hmac>
{
  "marketId": "1.2445",
  "status": "SETTLED",
  "winner": "Mumbai Warriors",
  "settledAt": "2026-09-01T16:41:11Z"
}`,
  },
];

function SportsDocs() {
  return (
    <DocsLayout
      title="Sports API"
      intro="REST endpoints for the Universal API sports exchange. Poll odds at 1s intervals or subscribe to the push feed for lower latency."
      sections={SECTIONS}
    >
      <pre className="mt-4 overflow-x-auto rounded-md bg-code-surface p-4 text-[0.8rem] text-code-foreground">
        <code>{`curl "https://api.universal.example/api/sports/4/events?inplay=true" \\
  -H "Authorization: Bearer <operator-key>"`}</code>
      </pre>
    </DocsLayout>
  );
}
