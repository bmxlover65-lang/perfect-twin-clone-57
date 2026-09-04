import { createFileRoute, Link } from "@tanstack/react-router";
import { Block, Code, Endpoint, H2, H3, Note, P, Step, Table } from "@/components/docs-kit";
import { ApiKeySetup } from "@/components/ApiKeySetup";
import { LiveApiDemo } from "@/components/LiveApiDemo";

export const Route = createFileRoute("/sports-docs")({
  head: () => ({
    meta: [
      { title: "Universal API — Sports Integration Guide" },
      {
        name: "description",
        content:
          "Server-side API for soccer, cricket, tennis, horse and greyhound match lists, live odds, TV and scoreboard embeds.",
      },
      { property: "og:title", content: "Universal API — Sports Integration Guide" },
      {
        property: "og:description",
        content:
          "Sport IDs, event fields, endpoints, TV & scoreboard embeds, polling guide and errors for the Universal Sports API.",
      },
    ],
  }),
  component: SportsDocs,
});

const TOC = [
  ["overview", "Overview"],
  ["product-access", "Product access"],
  ["authentication", "Authentication"],
  ["api-key-setup", "API key & endpoint setup"],
  ["sport-ids", "Sport IDs"],
  ["event-fields", "Event fields"],
  ["endpoints", "Endpoints"],
  ["websocket-odds", "WebSocket odds"],
  ["tv-scoreboard", "TV & scoreboard"],
  ["live-demo", "Live demo"],
  ["polling-guide", "Polling guide"],
  ["errors", "Errors"],
  ["examples", "Examples"],
] as const;


function SportsDocs() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:block">
              <p className="px-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                On this page
              </p>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:mt-3 lg:block lg:space-y-0.5">
                {TOC.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </aside>


        <main className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            B2B integration

          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
            Universal API — Sports
          </h1>
          <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed text-muted-foreground">
            Server-side API for soccer, cricket, tennis, horse racing, and greyhound racing match
            lists and live odds from the kingexch365 exchange feed.
          </p>

          <div className="mt-6 rounded-md border-l-4 border-live-win bg-muted px-4 py-3 text-sm text-foreground">
            <strong>Base URL:</strong> <Code>https://universeapi.store</Code>
          </div>

          {/* Overview */}
          <H2 id="overview">Overview</H2>
          <P>
            Sports data is separate from the casino live tables product. Your account must have the
            Sports product enabled (see Admin → client products).
          </P>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[0.95rem] text-muted-foreground">
            <li>
              Soccer — <Code>sportId=1</Code>
            </li>
            <li>
              Tennis — <Code>sportId=2</Code>
            </li>
            <li>
              Cricket — <Code>sportId=4</Code>
            </li>
            <li>
              Horse Racing — <Code>sportId=7</Code>
            </li>
            <li>
              Greyhound Racing — <Code>sportId=4339</Code>
            </li>
          </ul>
          <P>
            Product event ID format: <Code>{"{sportId}.{exEventId}"}</Code> (e.g.{" "}
            <Code>1.100202662715511777</Code>).
          </P>

          {/* Product access */}
          <H2 id="product-access">Product access</H2>
          <P>
            Each B2B API key is entitled to one or both products: Casino and Sports. If Sports is
            not enabled, sports endpoints return:
          </P>
          <Block
            label="HTTP 403"
            code={`{
  "error": "Product not enabled: sports",
  "products": { "casino": true, "sports": false }
}`}
          />

          {/* Authentication */}
          <H2 id="authentication">Authentication</H2>
          <P>Send your API key on every request:</P>
          <Block label="Header" code={`X-API-Key: your-partner-api-key`} />
          <P>Or:</P>
          <Block label="Bearer" code={`Authorization: Bearer your-partner-api-key`} />

          <H3>IP allowlist</H3>
          <P>
            Admin → client <strong className="text-foreground">Allowed IPs</strong> applies to all
            B2B sports <strong className="text-foreground">REST</strong> and{" "}
            <strong className="text-foreground">WebSocket</strong> calls from your servers:
          </P>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[0.95rem] text-muted-foreground">
            <li>Leave empty — any source IP may use the API key (default).</li>
            <li>
              Non-empty — only those IPs (your backend egress) are accepted. Others get{" "}
              <Code>403</Code> / WebSocket close <Code>IP not allowlisted</Code>.
            </li>
          </ul>
          <P>
            The gateway reads the first hop of <Code>X-Forwarded-For</Code> when present (set by the
            reverse proxy in front of the API).
          </P>

          {/* Sport IDs */}
          {/* API key & endpoint setup */}
          <H2 id="api-key-setup">API key &amp; endpoint setup</H2>
          <P>
            Every B2B integration needs one real API key and one base URL. Follow these steps end to
            end; the same key powers events, odds, results and TV embeds.
          </P>
          <Step n={1} title="Request a B2B API key">
            <>
              Email the provider with your company name, brand domain(s) and the products you need
              (Sports, Casino or both). You receive a key in the form{" "}
              <Code>uapi_live_xxxxxxxxxxxxxxxx</Code> plus an allowlisted origin list.
            </>
          </Step>
          <Step n={2} title="Store the key server-side">
            <>
              Keep the key in a server environment variable — never in browser code, mobile bundles
              or public repos.
            </>
            <Block
              label=".env (backend only)"
              code={`UAPI_BASE_URL=https://universeapi.store/api
UAPI_KEY=uapi_live_xxxxxxxxxxxxxxxx`}
            />
          </Step>
          <Step n={3} title="Verify the key">
            <>A 200 response with a sports array means the key and entitlements are active.</>
            <Block
              label="curl"
              code={`curl -s "$UAPI_BASE_URL/sports" \\
  -H "X-API-Key: $UAPI_KEY"`}
            />
          </Step>
          <Step n={4} title="Proxy the API from your backend">
            <>
              Expose your own thin routes so the key never reaches the client. This site uses exactly
              that pattern: <Code>/api/public/uapi/*</Code> forwards to the provider and injects the
              credential server-side.
            </>
            <Block
              label="Node / TypeScript proxy"
              code={`export async function uapi(path: string) {
  const res = await fetch(\`\${process.env.UAPI_BASE_URL}/\${path}\`, {
    headers: { "X-API-Key": process.env.UAPI_KEY!, accept: "application/json" },
  });
  if (!res.ok) throw new Error(\`Upstream \${res.status}\`);
  return res.json();
}`}
            />
          </Step>
          <Step n={5} title="Wire the front end">
            <>
              Call your proxy routes only. Poll the event list every 10–15s and odds every 1–2s for
              the event the user is viewing.
            </>
          </Step>
          <ApiKeySetup />
          <Note>
            Rotate keys from the partner portal. A rotated key invalidates old TV embed tokens within
            60 seconds.
          </Note>


          <H2 id="sport-ids">Sport IDs</H2>
          <Table
            head={["sportId", "Sport"]}
            rows={[
              [<Code key="1">1</Code>, "Soccer"],
              [<Code key="2">2</Code>, "Tennis"],
              [<Code key="4">4</Code>, "Cricket"],
              [<Code key="7">7</Code>, "Horse Racing"],
              [<Code key="4339">4339</Code>, "Greyhound Racing"],
            ]}
          />

          {/* Event fields */}
          <H2 id="event-fields">Event fields</H2>
          <P>
            Each object in <Code>events[]</Code> (from <Code>GET /sports/events</Code> or{" "}
            <Code>GET /sports/:sportId/events</Code>) includes kingexch-style capability flags
            alongside match-odds snapshot data.
          </P>
          <Table
            head={["Field", "Type", "Description"]}
            rows={[
              [
                <Code key="a">tournamentId</Code>,
                "string | null",
                "Exchange tournament ID (when published by upstream).",
              ],
              [
                <Code key="b">tournamentName</Code>,
                "string | null",
                "Human-readable tournament or competition name.",
              ],
              [
                <Code key="c">isBookmakers</Code>,
                "boolean",
                "Event has bookmaker markets available.",
              ],
              [
                <Code key="d">isFancy</Code>,
                "boolean",
                "Event has fancy / line markets available.",
              ],
              [
                <Code key="e">isSportsbook</Code>,
                "boolean",
                "Event has sportsbook markets available.",
              ],
              [
                <Code key="f">isStreaming, tv</Code>,
                "boolean",
                "Hint that upstream advertises live TV for this event. tv is an alias of isStreaming. Flags can lag — a true value does not guarantee the CDN is publishing yet, and false does not mean mint will always fail. Prefer POST /sports/:sportId/:exEventId/tv/embed and handle 503.",
              ],
              [
                <Code key="g">isScore</Code>,
                "boolean",
                "Hint that a live score payload may exist (soccer / tennis / cricket). On the event list when odds cache exists; always on GET /odds; merged into summary on GET /state. Still call GET /score or POST /score/embed and handle 503 when unpublished.",
              ],
              [
                <Code key="h">betDelay</Code>,
                "number | null",
                "Bet placement delay in seconds (from upstream match odds).",
              ],
              [
                <Code key="i">preBet, crossMatching, totalMatched</Code>,
                "boolean / number | null",
                "Additional upstream match-odds metadata.",
              ],
              [
                <Code key="j">runnersData</Code>,
                "object | null",
                'Map of selection ID to runner name, e.g. {"235":"Team A"}.',
              ],
              [
                <Code key="k">marketType, popular, quickLink</Code>,
                "string | boolean",
                "Upstream market classification flags.",
              ],
              [
                <Code key="l">isCasinoGame, isVirtual</Code>,
                "boolean",
                "Upstream event type flags.",
              ],
              [<Code key="m">_id</Code>, "string | null", "Upstream document id."],
              [
                <Code key="n">runners[].handicap</Code>,
                "number | null",
                "Runner handicap from upstream.",
              ],
            ]}
          />

          {/* Endpoints */}
          <H2 id="endpoints">Endpoints</H2>
          <P>
            All paths are relative to <Code>https://universeapi.store/api</Code>.
          </P>

          <Endpoint method="GET" path="/sports" auth="X-API-Key + Sports product" />
          <P>Sport catalog (IDs and names).</P>

          <Endpoint method="GET" path="/sports/events" auth="X-API-Key + Sports product" />
          <P>
            All events across every supported sport (soccer, tennis, cricket, horse, greyhound).
            Pass <Code>?inPlay=true</Code> to return only live matches (recommended for lobby UIs).
          </P>

          <Endpoint
            method="GET"
            path="/sports/:sportId/events"
            auth="X-API-Key + Sports product"
          />
          <P>Event list for one sport with match-odds snapshot per event.</P>

          <Endpoint
            method="GET"
            path="/sports/:sportId/:exEventId/odds"
            auth="X-API-Key + Sports product"
          />
          <P>
            Live odds — match odds, fancy, bookmakers, sportsbook, lottery, and binary markets for
            one event. Top-level <Code>betDelay</Code>, <Code>preBet</Code>,{" "}
            <Code>crossMatching</Code>, and <Code>totalMatched</Code> mirror upstream match odds.
          </P>

          <Endpoint
            method="GET"
            path="/sports/:sportId/:exEventId/state"
            auth="X-API-Key + Sports product"
          />
          <P>Combined event summary + odds payload.</P>

          <Endpoint
            method="GET"
            path="/sports/:sportId/:exEventId/score"
            auth="X-API-Key + Sports product + domain whitelist"
          />
          <P>
            Live scoreboard JSON for soccer (1), tennis (2), and cricket (4). Your API key must have
            at least one domain in <Code>allowedDomains</Code> (same whitelist used for embeds).
            Horse / greyhound return 404.
          </P>

          <Endpoint
            method="POST"
            path="/sports/:sportId/:exEventId/tv/embed"
            auth="X-API-Key + X-TV-Client + domain whitelist"
          />
          <P>
            Mint a short-lived embed token for the live TV iframe. Returns <Code>streamingId</Code>{" "}
            (diamondtech gmid when primary, else LTVE channel id), <Code>source</Code>,{" "}
            <Code>iframePath</Code> (preferred), and optional <Code>iframeUrl</Code>. Returns 503
            when no channel is assigned for the event.
          </P>

          <Endpoint
            method="POST"
            path="/sports/:sportId/:exEventId/score/embed"
            auth="X-API-Key + X-TV-Client + domain whitelist"
          />
          <P>
            Mint a short-lived embed token for the scoreboard iframe. Returns{" "}
            <Code>iframePath</Code> and current score snapshot. Returns 503 when score is not
            published yet.
          </P>

          <Endpoint
            method="GET"
            path="/tv/sports/player"
            auth="embedToken + tv=true + Referer/Origin"
          />
          <P>
            Browser iframe HTML for live TV. Query: <Code>sportId</Code>, <Code>exEventId</Code>,{" "}
            <Code>embedToken</Code>, <Code>tv=true</Code>. Load only inside an iframe on an
            allowlisted partner page.
          </P>

          <Endpoint
            method="GET"
            path="/tv/sports/scoreboard"
            auth="embedToken + tv=true + Referer/Origin"
          />
          <P>
            Browser iframe HTML for the live scoreboard (soccer / tennis / cricket). Same query
            params as the TV player. Soft-polls scores about every 5s in-page (no full reload).
          </P>

          {/* WebSocket odds */}
          <H2 id="websocket-odds">WebSocket odds</H2>
          <P>
            Push live odds from your <strong className="text-foreground">backend</strong> instead of
            polling HTTP for every tick. Prefer WebSocket for in-play viewing; keep{" "}
            <Code>GET /sports/:sportId/:exEventId/odds</Code> as a reconnect fallback.
          </P>
          <Block
            label="URL (path is on the site origin, not under /api)"
            code={`wss://universeapi.store/ws/sports?sportId={sportId}&exEventId={exEventId}&apiKey=YOUR_KEY`}
          />
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[0.95rem] text-muted-foreground">
            <li>
              Auth: <Code>apiKey</Code> query param (same key as <Code>X-API-Key</Code>) + Sports
              product + IP allowlist (same rules as REST).
            </li>
            <li>
              On connect you receive{" "}
              <Code>{'{ "type": "subscribed", "sportId", "exEventId", "client" }'}</Code>.
            </li>
            <li>
              Updates are{" "}
              <Code>{'{ "type": "odds", "sportId", "exEventId", "data": { … } }'}</Code> —{" "}
              <Code>data</Code> has the same shape as <Code>GET /odds</Code>.
            </li>
            <li>
              Rejected connections close with code <Code>1008</Code> (e.g. <Code>Unauthorized</Code>,{" "}
              <Code>IP not allowlisted</Code>, <Code>Product not enabled: sports</Code>).
            </li>
          </ul>
          <Block
            label="Node example"
            code={`import WebSocket from "ws";

const sportId = "4";
const exEventId = "40020266291998437";
const apiKey = process.env.UNIVERSAL_API_KEY;
const ws = new WebSocket(
  \`wss://universeapi.store/ws/sports?sportId=\${sportId}&exEventId=\${exEventId}&apiKey=\${apiKey}\`
);
ws.on("message", (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.type === "odds") {
    // msg.data.matchOdds / fancy / …
  }
});`}
          />

          {/* TV & scoreboard */}
          <H2 id="tv-scoreboard">TV &amp; scoreboard embeds</H2>
          <P>
            Browser iframes use the same pattern as casino TV: your backend mints an embed token
            with your API key; the user's browser loads our iframe URL with that token. Domain
            access is enforced via your client's <Code>allowedDomains</Code> list.
          </P>
          <Note>
            <strong className="text-foreground">LIVE TV source (Universal sports):</strong>{" "}
            diamondtech is primary for cricket, soccer, tennis, horse racing, and greyhound racing.
            We resolve the diamondtech event id (gmid) for the match and expose it as{" "}
            <Code>streamingId</Code>. Kingexch LTVE is secondary when no diamondtech channel is
            available. Always embed via <Code>iframePath</Code> on{" "}
            <Code>https://universeapi.store</Code> — do not open diamondtech URLs yourself.
          </Note>
          <P>
            <strong className="text-foreground">What partners embed:</strong> only{" "}
            <Code>https://universeapi.store/api/tv/sports/player?...</Code> (from mint{" "}
            <Code>iframePath</Code>). That page is our HTML wrapper; when diamond is primary it
            nests diamondtech <Code>/play/sportstv/{"{etid}"}/{"{gmid}"}</Code> with the viewer IP.
            Scoreboard uses <Code>/api/tv/sports/scoreboard?...</Code> the same way.
          </P>

          <H3>Capability by sport</H3>
          <Table
            head={["sportId", "Sport", "TV embed", "Score JSON / scoreboard iframe"]}
            rows={[
              [<Code key="1">1</Code>, "Soccer", "Yes (per event)", "Yes"],
              [<Code key="2">2</Code>, "Tennis", "Yes (per event)", "Yes"],
              [<Code key="4">4</Code>, "Cricket", "Yes (per event)", "Yes"],
              [<Code key="7">7</Code>, "Horse Racing", "Yes (per event)", "No — 404"],
              [<Code key="4339">4339</Code>, "Greyhound Racing", "Yes (per event)", "No — 404"],
            ]}
          />
          <P>
            TV and score availability is per event. Flags <Code>isStreaming</Code> / <Code>tv</Code>{" "}
            on the event list (and <Code>isScore</Code> on odds/state) are hints — they can lag
            behind upstream. Prefer trying the mint endpoints for in-play events and treat 503 as
            "not available yet". Resolve <Code>exEventId</Code> from{" "}
            <Code>GET /sports/:sportId/events</Code> before minting embeds.
          </P>
          <P>
            Live first-party demo (provider site only):{" "}
            <Link to="/sports" className="text-nav-active underline underline-offset-2">
              universeapi.store/sports
            </Link>
            .
          </P>

          <H3>Requirements</H3>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[0.95rem] text-muted-foreground">
            <li>Sports product enabled on your API key</li>
            <li>
              At least one domain on your allowlist (Admin → client Domains) — this is your panel
              origin (e.g. <Code>mahabet.club</Code>), required for score JSON, TV mint, and score
              mint. Do not put <Code>universeapi.store</Code> on the partner allowlist for B2B embeds
            </li>
            <li>
              <Code>X-TV-Client: true</Code> on embed mint requests
            </li>
            <li>
              <Code>embedDomain</Code> in the POST body when you have multiple whitelisted domains
              (must be on your allowlist). Subdomains of an allowlisted apex are accepted (e.g.{" "}
              <Code>app.partner.com</Code> if <Code>partner.com</Code> is listed; <Code>www.</Code>{" "}
              is normalized away).
            </li>
            <li>
              Iframe URL must include <Code>tv=true</Code>
            </li>
            <li>
              Iframe must be loaded from a page whose Referer/Origin matches your allowlist —
              opening the iframe URL in a new tab fails with 403
            </li>
            <li>
              Use <Code>referrerpolicy="strict-origin-when-cross-origin"</Code> on your iframe. Do
              not set <Code>referrerpolicy="no-referrer"</Code> — diamondtech sportstv returns{" "}
              <Code>embed_origin_required</Code> without Origin/Referer
            </li>
            <li>
              Do not mix tokens: a TV token only works on <Code>/api/tv/sports/player</Code>; a
              score token only on <Code>/api/tv/sports/scoreboard</Code>
            </li>
            <li>
              Remint before <Code>expiresIn</Code> (typically ~3600s)
            </li>
            <li>
              If your site uses CSP, allow <Code>frame-src</Code> / <Code>child-src</Code> for{" "}
              <Code>https://universeapi.store</Code> (required when using <Code>iframePath</Code>)
            </li>
          </ul>

          <H3>Resolve event ID (any sport)</H3>
          <Block
            label="List events for a sport"
            code={`curl -sS -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/1/events?inPlay=true"
# use events[].exEventId from the response`}
          />

          <H3>TV iframe flow (all sports: 1, 2, 4, 7, 4339)</H3>
          <Block
            label="1. Mint embed token (server-side)"
            code={`curl -sS -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "X-TV-Client: true" \\
  -H "Content-Type: application/json" \\
  -d '{"embedDomain":"your-partner-site.com"}' \\
  "https://universeapi.store/api/sports/{sportId}/{exEventId}/tv/embed"`}
          />
          <Block
            label="Example mint response (diamond / AllPanel primary)"
            code={`{
  "sportId": "4",
  "exEventId": "4002026823127209",
  "productId": "4.4002026823127209",
  "embedToken": "YkpY2Roz...",
  "expiresIn": 3600,
  "streamingId": "807289833",
  "source": "allpanel-sportstv",
  "iframePath": "/api/tv/sports/player?sportId=4&exEventId=...&embedToken=...&tv=true"
}`}
          />
          <P>
            <Code>streamingId</Code> is the diamondtech event id (gmid) when <Code>source</Code> is{" "}
            <Code>allpanel-crickettv</Code> / <Code>allpanel-sportstv</Code>. For LTVE secondary
            feeds it is the LTVE channel id. For diamond/AllPanel, mint omits <Code>iframeUrl</Code>{" "}
            — you must use <Code>iframePath</Code> so we remint playback with the viewer IP.
            LTVE-only responses may include an optional <Code>iframeUrl</Code>; still prefer{" "}
            <Code>iframePath</Code> in production.
          </P>
          <Block
            label="2. Embed in your page (use iframePath on our host)"
            code={`<iframe
  src="https://universeapi.store/api/tv/sports/player?sportId={sportId}&exEventId={exEventId}&embedToken=TOKEN&tv=true"
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
  style="width:100%;aspect-ratio:16/9;border:0"
></iframe>`}
          />
          <Note>
            Prefer <Code>iframePath</Code> on <Code>https://universeapi.store</Code> — that path
            enforces your domain allowlist and token kind, then nests diamondtech (or LTVE) inside
            our player. Do not paste diamondtech <Code>/play/...</Code> URLs into your panel.
          </Note>
          <Note>
            <strong className="text-foreground">Channel vs broadcast:</strong> a successful mint
            means a stream channel was assigned (<Code>streamingId</Code>). The player may still
            show a waiting screen until the feed is publishing. That is expected and is not an API
            error. Mint returns 503 only when no channel is assigned for the event.
          </Note>

          <H3>Per-sport TV examples</H3>
          <Block
            label="Soccer (1)"
            code={`POST https://universeapi.store/api/sports/1/{exEventId}/tv/embed`}
          />
          <Block
            label="Tennis (2)"
            code={`POST https://universeapi.store/api/sports/2/{exEventId}/tv/embed`}
          />
          <Block
            label="Cricket (4)"
            code={`POST https://universeapi.store/api/sports/4/{exEventId}/tv/embed`}
          />
          <Block
            label="Horse (7)"
            code={`POST https://universeapi.store/api/sports/7/{exEventId}/tv/embed`}
          />
          <Block
            label="Greyhound (4339)"
            code={`POST https://universeapi.store/api/sports/4339/{exEventId}/tv/embed`}
          />

          <H3>Score JSON shape (soccer, tennis, cricket)</H3>
          <Block
            label="GET /sports/:sportId/:exEventId/score"
            code={`{
  "client": "your-client-name",
  "sportId": "4",
  "exEventId": "4002026712143720420",
  "productId": "4.4002026712143720420",
  "score": {
    "sportId": "4",
    "exEventId": "4002026712143720420",
    "sportName": "Cricket",
    "commentary": "",
    "slider": [ /* upstream score panels (teamInfo, scoreItems, statusCommentry, …) */ ],
    "updatedAt": "2026-07-13T07:00:00.000Z"
  }
}`}
          />
          <P>
            Parse <Code>score.slider</Code> for sport-specific panels. Cricket / soccer / tennis
            layouts differ; the scoreboard iframe renders a kingexch-style board for you if you do
            not want to parse <Code>slider</Code> yourself.
          </P>

          <H3>Scoreboard iframe flow (soccer, tennis, cricket only)</H3>
          <Block
            label="Mint scoreboard embed"
            code={`curl -sS -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "X-TV-Client: true" \\
  -H "Content-Type: application/json" \\
  -d '{"embedDomain":"your-partner-site.com"}' \\
  "https://universeapi.store/api/sports/{sportId}/{exEventId}/score/embed"`}
          />
          <Block
            label="Example mint response"
            code={`{
  "sportId": "4",
  "exEventId": "4002026712143720420",
  "productId": "4.4002026712143720420",
  "embedToken": "YkpY2Roz...",
  "expiresIn": 3600,
  "score": { "sportId": "4", "exEventId": "...", "slider": [], "updatedAt": "..." },
  "iframePath": "/api/tv/sports/scoreboard?sportId=4&exEventId=...&embedToken=...&tv=true"
}`}
          />
          <Block
            label="Scoreboard iframe"
            code={`<iframe
  src="https://universeapi.store/api/tv/sports/scoreboard?sportId={sportId}&exEventId={exEventId}&embedToken=TOKEN&tv=true"
  referrerpolicy="strict-origin-when-cross-origin"
  style="width:100%;min-height:220px;border:0;background:#000"
></iframe>`}
          />
          <P>
            Score mint response includes <Code>embedToken</Code>, <Code>expiresIn</Code>,{" "}
            <Code>iframePath</Code>, and a score snapshot. The scoreboard soft-polls about every 5s
            in-page (no full reload) so Referer stays valid — you do not need to remint the token
            just to refresh scores.
          </P>

          <H3>Per-sport scoreboard examples</H3>
          <Block
            label="Soccer (1)"
            code={`POST https://universeapi.store/api/sports/1/{exEventId}/score/embed
GET  https://universeapi.store/api/sports/1/{exEventId}/score`}
          />
          <Block
            label="Tennis (2)"
            code={`POST https://universeapi.store/api/sports/2/{exEventId}/score/embed
GET  https://universeapi.store/api/sports/2/{exEventId}/score`}
          />
          <Block
            label="Cricket (4)"
            code={`POST https://universeapi.store/api/sports/4/{exEventId}/score/embed
GET  https://universeapi.store/api/sports/4/{exEventId}/score`}
          />
          <P>
            Horse (7) and greyhound (4339) do not have scoreboard endpoints — <Code>GET /score</Code>{" "}
            and <Code>POST /score/embed</Code> return 404.
          </P>
          <P>
            For server-side polling (no iframe), use{" "}
            <Code>GET /sports/:sportId/:exEventId/score</Code> every 2–5s during in-play events
            (soccer, tennis, cricket only).
          </P>

          {/* Live demo */}
          <H2 id="live-demo">Live demo</H2>
          <P>
            On the provider site you can preview working TV and scoreboard iframes without a B2B API
            key: <Code>/sports</Code> (in-play list) and event detail{" "}
            <Code>/sports/:sportId/:exEventId</Code>.
          </P>
          <P>
            That page uses first-party public routes (<Code>GET /public/sports/events</Code>,{" "}
            <Code>GET /public/tv/sports/player</Code>,{" "}
            <Code>GET /public/tv/sports/scoreboard</Code>) and is not for partner embedding.
            Partners must use the B2B mint + <Code>/api/tv/sports/*</Code> flow above.
          </P>
          <P>
            The widget below issues real requests against this site&rsquo;s backend proxy, which
            forwards to the provider with server-side credentials.
          </P>
          <LiveApiDemo
            title="Sports API — live responses"
            paths={[
              { label: "GET /sports", path: "sports" },
              { label: "Cricket events", path: "sports/4/events" },
              { label: "Soccer events", path: "sports/1/events" },
              { label: "Tennis events", path: "sports/2/events" },
            ]}
          />

          {/* Polling guide */}
          <H2 id="polling-guide">Polling guide</H2>
          <P>
            Poll the endpoints below from your backend — do not call the API from end-user browsers.
          </P>
          <H3>How often you should poll</H3>
          <P>
            Prefer <a href="#websocket-odds" className="underline underline-offset-2">WebSocket odds</a>{" "}
            for live event screens. If you poll HTTP instead, apply these rates per endpoint and
            only for events your users are actively viewing. Do not poll the full event list at odds
            frequency.
          </P>

          <Table
            head={["Endpoint", "When", "Poll interval"]}
            rows={[
              [
                <Code key="a">GET /sports/events or GET /sports/:sportId/events</Code>,
                "Discovery / lobby",
                "30–60s",
              ],
              [
                <Code key="b">GET /sports/:sportId/:exEventId/odds</Code>,
                "Pre-match event on screen",
                "5–10s",
              ],
              [
                <Code key="c">GET /sports/:sportId/:exEventId/odds</Code>,
                "In-play event on screen",
                "500ms–1s",
              ],
              [
                <Code key="d">GET /sports/:sportId/:exEventId/state</Code>,
                "Same as odds for that event",
                "Same as odds row above",
              ],
              [
                <Code key="e">GET /sports/:sportId/:exEventId/score</Code>,
                "In-play event with scoreboard",
                "2–5s",
              ],
            ]}
          />
          <H3>Best practices</H3>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[0.95rem] text-muted-foreground">
            <li>Poll odds only for events on screen — not every event in the list.</li>
            <li>
              Use <Code>updatedAt</Code> in the odds response; skip UI updates when it has not
              changed.
            </li>
            <li>
              Polling faster than the recommended intervals only increases load on your API key.
            </li>
            <li>
              Do not poll <Code>/sports/events</Code> every 1s or 500ms.
            </li>
          </ul>

          {/* Errors */}
          <H2 id="errors">Errors</H2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[0.95rem] text-muted-foreground">
            <li>
              <strong className="text-foreground">401</strong> — missing/invalid API key; missing{" "}
              <Code>X-TV-Client</Code> on mint; missing <Code>tv=true</Code> on iframe URL;
              invalid/expired/wrong-kind embed token
            </li>
            <li>
              <strong className="text-foreground">403</strong> — subscription inactive, sports
              product not enabled, caller IP not on Allowed IPs (when configured), domain not on
              allowlist (also blocks <Code>GET /score</Code> when

              allowlist is empty), missing browser Referer/Origin on iframe, or token bound to a
              different embed domain
            </li>
            <li>
              <strong className="text-foreground">404</strong> — unknown sportId, event excluded, or
              scoreboard not supported (horse/greyhound)
            </li>
            <li>
              <strong className="text-foreground">400</strong> — <Code>embedDomain</Code> not on
              this client's allowlist
            </li>
            <li>
              <strong className="text-foreground">502</strong> — upstream mint failure while
              creating an embed token
            </li>
            <li>
              <strong className="text-foreground">503</strong> — ingest unavailable; no TV channel
              assigned; or score not published yet. A waiting TV player (mint succeeded) is not a
              503 — the CDN feed may still be offline.
            </li>
            <li>
              <strong className="text-foreground">Nested diamond player JSON</strong>{" "}
              <Code>embed_origin_required</Code> — your panel iframe is missing Origin/Referer
              (often <Code>referrerpolicy="no-referrer"</Code>). Use{" "}
              <Code>strict-origin-when-cross-origin</Code> and load the iframe from your allowlisted
              panel page
            </li>
          </ul>

          {/* Examples */}
          <H2 id="examples">Examples</H2>
          <Block
            label="List cricket events"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/4/events?inPlay=true"`}
          />
          <Block
            label="Horse racing events"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/7/events?inPlay=true"`}
          />
          <Block
            label="Greyhound racing odds"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/4339/43390020266291998437/odds"`}
          />
          <Block
            label="Live odds for one event"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/1/100202662715511777/odds"`}
          />
          <Block
            label="Combined state"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/2/200202662832959134/state"`}
          />
          <Block
            label="Soccer score (JSON)"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/1/{exEventId}/score"`}
          />
          <Block
            label="Tennis score (JSON)"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/2/{exEventId}/score"`}
          />
          <Block
            label="Cricket score (JSON)"
            code={`curl -sS \\
  -H "X-API-Key: YOUR_KEY" \\
  "https://universeapi.store/api/sports/4/{exEventId}/score"`}
          />
          <Block
            label="Mint cricket TV embed"
            code={`curl -sS -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "X-TV-Client: true" \\
  -H "Content-Type: application/json" \\
  -d '{"embedDomain":"your-partner-site.com"}' \\
  "https://universeapi.store/api/sports/4/{exEventId}/tv/embed"`}
          />
          <Block
            label="Mint cricket scoreboard embed"
            code={`curl -sS -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "X-TV-Client: true" \\
  -H "Content-Type: application/json" \\
  -d '{"embedDomain":"your-partner-site.com"}' \\
  "https://universeapi.store/api/sports/4/{exEventId}/score/embed"`}
          />

          {/* B2B integration */}
          <H2 id="b2b-integration">B2B integration</H2>
          <P>
            Keep the API key server-side, mint embed tokens from your backend, and serve only the{" "}
            <Code>iframePath</Code> URLs to browsers. Remint before <Code>expiresIn</Code>, respect
            the polling intervals above, and treat 503 responses as "not available yet" rather than
            hard failures.
          </P>
          <P>
            Casino tables are documented separately —{" "}
            <Link to="/casino-docs" className="text-nav-active underline underline-offset-2">
              Casino API docs
            </Link>
            .
          </P>
        </main>
      </div>
    </div>
  );
}
