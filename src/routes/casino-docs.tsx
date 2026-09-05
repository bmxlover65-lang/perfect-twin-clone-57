import { createFileRoute, Link } from "@tanstack/react-router";
import { Block, Code, Endpoint, H2, H3, Note, P, Step, Table } from "@/components/docs-kit";
import { LiveApiDemo } from "@/components/LiveApiDemo";
import { GAMES } from "@/data/games";
import { ODDS_CSS, ODDS_HTML, MODAL_CSS, MODAL_HTML } from "@/data/docs-snippets";


export const Route = createFileRoute("/casino-docs")({
  head: () => ({
    meta: [
      { title: "Universal API — Casino Integration Guide" },
      {
        name: "description",
        content:
          "Server-side API for live casino data, TV overlays and iframe video embeds on your partner platform.",
      },
      { property: "og:title", content: "Universal API — Casino Integration Guide" },
      {
        property: "og:description",
        content: "Endpoints, authentication, iframe embeds and game UI reference for Universal API.",
      },
    ],
  }),
  component: CasinoDocs,
});

const TOC = [
  ["getting-started", "Getting started"],
  ["authentication", "Authentication"],
  ["endpoints", "Endpoints"],
  ["game-catalog", "Game catalog"],
  ["live-game-state", "Live game state"],
  ["live-demo", "Live demo"],
  ["historical-results", "Historical results"],
  ["tv-video", "TV & video"],
  ["iframe-embed", "Iframe embed"],
  ["betting-wallet", "Betting & wallet"],
  ["balance-maintain", "Balance maintain"],
  ["response-fields", "Response fields"],


  ["errors", "Errors"],
  ["integration-guide", "Integration guide"],
  ["game-ui", "Game UI (HTML/CSS)"],
  ["supported-games", "Supported games"],
] as const;

const UI_GAMES = [
  "99.0010",
  "99.0013",
  "99.0016",
  "99.0014",
  "99.0018",
  "99.0019",
  "99.0021",
  "99.0030",
  "99.0005",
  "99.0046",
  "99.0001",
  "99.0025",
  "99.0022",
  "99.0007",
  "99.0041",
];

function CasinoDocs() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-10 lg:px-8">
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
                <li>
                  <Link
                    to="/sports-docs"
                    className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Sports API docs →
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </aside>


        <main className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Client integration
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
            Universal API — Casino Integration Guide
          </h1>
          <p className="mt-3 max-w-4xl text-[1.05rem] leading-relaxed text-muted-foreground">
            Integration guide — server-side API for live data, TV overlays, and iframe video embeds
            on your partner platform.
          </p>

          <div className="mt-6 rounded-md border-l-4 border-live-win bg-muted px-4 py-3 text-sm text-foreground">
            <strong>Base URL:</strong> <Code>https://universeapi.store</Code>
          </div>

          {/* Getting started */}
          <H2 id="getting-started">Getting started</H2>
          <P>Before calling the API, Universal API will provision your partner account with:</P>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[0.95rem] text-muted-foreground">
            <li>
              <strong className="text-foreground">API key</strong> — send on every server-side
              request (keep it secret; never expose in browser or mobile bundles).
            </li>
            <li>
              <strong className="text-foreground">Allowed domains</strong> — partner website domains
              that may embed the TV iframe (e.g. <Code>partner.com</Code>,{" "}
              <Code>app.partner.com</Code>).
            </li>
            <li>
              <strong className="text-foreground">Subscription period</strong> — your key is valid
              between the start and end dates on your account.
            </li>
          </ul>
          <p className="mt-4 text-[0.95rem] text-foreground">
            <strong>API base URL:</strong> <Code>https://universeapi.store/api</Code>
          </p>
          <P>
            All endpoints live under <Code>/api</Code>. JSON responses use{" "}
            <Code>application/json</Code> unless noted otherwise. Contact your account manager for
            key rotation, new domains, or subscription changes.
          </P>
          <div className="mt-4 flex flex-wrap gap-2">
            {["15 live games", "Real-time snapshots", "Server-to-server JSON", "TV iframe embed"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ),
            )}
          </div>

          {/* Authentication */}
          <H2 id="authentication">Authentication</H2>
          <P>
            Include your API key on every server-side request using one of the following headers:
          </P>
          <Block
            label="Headers"
            code={`X-API-Key: your-api-key
# or
Authorization: Bearer your-api-key`}
          />
          <H3>Access control</H3>
          <P>Different routes use different checks:</P>
          <Table
            head={["Route", "Who calls it", "Auth"]}
            rows={[
              [
                <Code key="a">/api/* (games, state, results, embed mint)</Code>,
                "Your backend",
                "API key + active subscription + Allowed IPs (if configured)",
              ],
              [
                <Code key="w">/ws?eventId=&apiKey=</Code>,
                "Your backend",
                "API key query + subscription + Allowed IPs (same as REST)",
              ],
              [
                <Code key="b">/api/tv/player</Code>,
                "End-user browser (iframe)",
                "Embed token + tv=true + parent page domain in your allowed domains",
              ],
            ]}
          />
          <P>Server API requests are rejected if any of the following apply:</P>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-[0.95rem] text-muted-foreground">
            <li>API key is missing or invalid</li>
            <li>Your account is inactive or outside the subscription window</li>
            <li>
              Caller IP is not on your Admin <strong className="text-foreground">Allowed IPs</strong>{" "}
              list (when that list is non-empty). Leave Allowed IPs empty to allow any source IP.
            </li>
          </ul>
          <Note>
            Proxy API and WebSocket calls through your backend and keep the key secret. Casino live
            push uses <Code>wss://universeapi.store/ws?eventId=…&apiKey=…</Code> (same IP rules as
            REST).
          </Note>
          <H3>TV embed requests</H3>
          <P>
            To mint iframe embed tokens (<Code>POST /tv/games/:eventId/embed</Code>), also send:
          </P>
          <Block label="TV header" code={`X-TV-Client: true`} />
          <P>
            The browser iframe player validates the embedding site via Referer / Origin against your
            account&apos;s allowed domains. Register every production domain where users will load
            the iframe (including <Code>www</Code> variants if used).
          </P>

          {/* Endpoints */}
          <H2 id="endpoints">Endpoints</H2>
          <P>
            All paths below are relative to <Code>https://universeapi.store/api</Code>.
          </P>
          <Table
            head={["Method", "Path", "Purpose"]}
            rows={[
              ["GET", <Code key="1">/health</Code>, "Gateway health check"],
              ["GET", <Code key="2">/games</Code>, "Game catalog"],
              [
                "GET",
                <Code key="3">/games/:eventId/state</Code>,
                "Live snapshot (poll from backend)",
              ],
              [
                "WS",
                <Code key="8">/ws?eventId=&apiKey=</Code>,
                "Live state push (prefer over polling)",
              ],
              [
                "GET / POST",
                <Code key="4">/games/:eventId/results, /results</Code>,
                "Historical round results",
              ],
              [
                "GET",
                <Code key="5">/tv/games/:eventId/state</Code>,
                "Alias of /games/:eventId/state",
              ],
              [
                "POST",
                <Code key="6">/tv/games/:eventId/embed</Code>,
                "Mint short-lived iframe token (backend only)",
              ],
              [
                "GET",
                <Code key="7">/tv/player</Code>,
                "Browser iframe player (embed token + domain)",
              ],
            ]}
          />

          {/* Game catalog */}
          <H2 id="game-catalog">Game catalog</H2>
          <Endpoint method="GET" path="/games" auth="API key" />
          <P>Returns every game available on your subscription.</P>
          <Block
            label="Example"
            code={`GET https://universeapi.store/api/games
X-API-Key: your-api-key`}
          />
          <Block
            label="Response 200"
            code={`{
  "games": [
    { "eventId": "99.0010", "eventName": "20-20 TEENPATTI" },
    { "eventId": "99.0018", "eventName": "DRAGON TIGER" }
  ]
}`}
          />

          {/* Live game state */}
          <H2 id="live-game-state">Live game state</H2>
          <Endpoint method="GET" path="/games/:eventId/state" auth="API key" />
          <P>
            Returns the current live snapshot for one game — round timer, markets, cards, and result
            data when available.
          </P>
          <Block
            label="Example"
            code={`GET https://universeapi.store/api/games/99.0010/state
X-API-Key: your-api-key`}
          />
          <Block
            label="Response 200"
            code={`{
  "client": "Your Company Name",
  "clientIp": "203.0.113.10",
  "eventId": "99.0010",
  "stale": false,
  "freshnessMs": 280,
  "data": {
    "roundId": "123456789",
    "status": "OPEN",
    "roundStatus": "OPEN",
    "leftSec": 12,
    "marketArr": [ … ],
    "cardsArr": { … },
    "resultsArr": [ … ],
    "updatedAt": "2026-05-24T11:00:00.000Z"
  }
}`}
          />
          <P>
            Prefer WebSocket push for live screens:{" "}
            <Code>wss://universeapi.store/ws?eventId=99.0010&apiKey=YOUR_KEY</Code> (frames use{" "}
            <Code>type: "subscribed"</Code> then <Code>type: "state"</Code>). Poll this HTTP endpoint
            as a reconnect fallback (e.g. every 1–2 seconds). A <Code>503</Code> response means live
            data is temporarily unavailable or stale — retry after a short delay.
          </P>
          <Note>
            <Code>GET /tv/games/:eventId/state</Code> is an alias — same request and response.
          </Note>

          {/* Historical results */}
          {/* Live demo */}
          <H2 id="live-demo">Live demo</H2>
          <P>
            Real responses from the live casino feed, fetched through this site&rsquo;s backend proxy
            (<Code>/api/public/uapi/*</Code>). The lobby and game pages on this site render exactly
            this data.
          </P>
          <LiveApiDemo
            title="Casino API — live responses"
            paths={[
              { label: "GET /games", path: "games" },
              { label: "Teenpatti state", path: "games/99.0010/state" },
              { label: "Teenpatti results", path: "games/99.0010/results" },
              { label: "Lucky 7 state", path: "games/99.0030/state" },
            ]}
          />

          <H2 id="historical-results">Historical results</H2>
          <P>
            Fetch recent completed rounds for a game — winners, cards, and market outcomes. Use this
            to populate the &quot;Recent results&quot; panel in your live UI.
          </P>
          <Endpoint method="GET" path="/games/:eventId/results" auth="API key" />
          <P>Returns recent completed rounds for the game in the path.</P>
          <Block
            label="Example"
            code={`GET https://universeapi.store/api/games/99.0010/results
X-API-Key: your-api-key`}
          />
          <P>
            Same response from <Code>POST /results</Code> with body{" "}
            <Code>{`{ "eventId": "99.0010" }`}</Code> or <Code>GET /results?eventId=99.0010</Code>.
          </P>
          <Block
            label="Response 200"
            code={`{
  "data": [
    {
      "roundId": "987654321",
      "winner": "A",
      "cards": { "A": ["H7", "D9"], "B": ["C3", "S5"] },
      "results": [
        {
          "marketName": "Main",
          "runners": [
            { "selectionId": "1", "result": "WIN" },
            { "selectionId": "2", "result": "LOSE" }
          ]
        }
      ]
    }
  ],
  "meta": { "status": true, "message": "Success" }
}`}
          />
          <P>
            Poll when the user opens a game or after each round ends — every 10–30 seconds is usually
            enough. Returns <Code>503</Code> if historical results are temporarily unavailable.
          </P>

          {/* TV & video */}
          <H2 id="tv-video">TV &amp; video</H2>
          <P>
            Embed the live video stream in an iframe on your site. Your backend mints a short-lived
            token; the browser loads the player URL — no API key in the iframe.
          </P>
          <Table
            head={["Need", "Endpoint", "Used in"]}
            rows={[
              [
                "First-party streaming config",
                <Code key="1">POST /public/tv/streaming</Code>,
                "Public casino UI — returns iframeUrl (direct WebRTC player)",
              ],
              [
                "Video iframe URL",
                <Code key="2">POST /api/tv/games/:eventId/embed</Code>,
                "Your backend (returns embed path)",
              ],
              [
                "Video player page",
                <Code key="3">GET /api/tv/player?embedToken=&amp;tv=true</Code>,
                "Browser iframe src (redirects to upstream WebRTC player)",
              ],
            ]}
          />
          <Note>
            For timer, odds, and cards overlays, use <strong>Live game state</strong> — not the TV
            endpoints below.
          </Note>
          <Endpoint method="POST" path="/public/tv/streaming" auth="Session + first-party Origin" />
          <P>
            Returns upstream WebRTC player config for the public casino UI at{" "}
            <Code>https://universeapi.store</Code>. Use <Code>iframeUrl</Code> as the iframe src — do
            not wrap it in another player page (nested iframes block WebRTC video).
          </P>
          <Block
            label="Example"
            code={`POST https://universeapi.store/public/tv/streaming
Origin: https://universeapi.store
X-Session-Token: <from POST /public/session>
X-TV-Client: true
Content-Type: application/json

{ "eventId": "99.0010" }`}
          />
          <Block
            label="Response 200"
            code={`{
  "data": {
    "eventId": "99.0010",
    "appName": "live",
    "url": "livecdnplatin.com",
    "streamingName": "GAME10",
    "token": "…"
  },
  "iframeUrl": "https://player.universestudio.games/index.html?appName=live&streamingName=GAME10&url=livecdnplatin.com&token=…",
  "playerUrl": "/public/tv/player?eventId=99.0010"
}`}
          />
          <P>
            Prefer <Code>iframeUrl</Code> for embedding. <Code>playerUrl</Code> is a legacy gateway
            redirect to the same upstream player.
          </P>

          {/* Iframe embed */}
          <H2 id="iframe-embed">Iframe video embed</H2>
          <P>
            Browsers cannot send <Code>X-API-Key</Code> on an iframe src. Use a two-step flow: your
            backend mints a short-lived embed token, then your frontend loads the player iframe with
            that token.
          </P>
          <H3>How iframe integration works</H3>
          <Block
            code={`Browser on partner.com (live page)
    ↓  POST /your-backend/casino/tv/:eventId/embed
Your backend
    ↓  POST https://universeapi.store/api/tv/games/:eventId/embed  +  X-API-Key  +  X-TV-Client: true
Universal API
    ↓  { iframePath, expiresIn }
Your backend
    ↓  { iframeUrl: "https://universeapi.store/api/tv/player?..." }
Browser on partner.com
    ↓  <iframe src="iframeUrl">  (embedToken + Referer: partner.com)
Universal API player page → upstream video stream`}
          />
          <Step n={1} title="Backend requests embed token">
            <Code>POST /api/tv/games/:eventId/embed</Code> with API key + <Code>X-TV-Client: true</Code>
          </Step>
          <Step n={2} title="Return iframe URL to frontend">
            Response includes <Code>iframePath</Code> — prefix with{" "}
            <Code>https://universeapi.store</Code> for the full URL.
          </Step>
          <Step n={3} title="Browser loads iframe">
            Set iframe src to the URL. Token expires after <Code>expiresIn</Code> seconds — refresh
            before expiry.
          </Step>

          <Endpoint method="POST" path="/tv/games/:eventId/embed" auth="API key + X-TV-Client" />
          <P>
            Creates a short-lived embed token for one game. Call from your server only — never expose
            the API key in browser code.
          </P>
          <Block
            label="Request"
            code={`POST https://universeapi.store/api/tv/games/99.0010/embed
Content-Type: application/json
X-API-Key: your-api-key
X-TV-Client: true`}
          />
          <Block
            label="Response 200"
            code={`{
  "eventId": "99.0010",
  "embedToken": "YkpY2RozaknDuLWGPR8cSbx0_SSnMnsMtK55fCo2ojw",
  "expiresIn": 3600,
  "iframePath": "/api/tv/player?eventId=99.0010&embedToken=YkpY2Roz...&tv=true"
}`}
          />
          <Endpoint
            method="GET"
            path="/tv/player?eventId=&embedToken=&tv=true"
            auth="Embed token + tv=true + domain allowlist"
          />
          <P>
            Provider-hosted HTML player page. Use as iframe src on your whitelisted partner domain.
            The browser must send a <Code>Referer</Code> or <Code>Origin</Code> header matching one
            of your allowed domains (subdomains of a registered domain are accepted).
          </P>
          <Note>
            Do not set <Code>referrerpolicy=&quot;no-referrer&quot;</Code> on the iframe — that
            blocks domain validation.
          </Note>
          <Table
            head={["Query param", "Required", "Description"]}
            rows={[
              [<Code key="1">eventId</Code>, "Yes", "Game id (must match the token)"],
              [
                <Code key="2">embedToken</Code>,
                "Yes",
                "Token from POST /api/tv/games/:eventId/embed",
              ],
              [<Code key="3">tv</Code>, "Yes", "Must be true"],
            ]}
          />
          <H3>Token refresh</H3>
          <P>
            Embed tokens expire after <Code>expiresIn</Code> seconds (default 3600). Refresh from
            your backend a few minutes before expiry — do not put the API key in browser code to call
            our embed endpoint directly.
          </P>
          <Block
            label="Refresh before expiry"
            code={`let refreshTimer;

async function loadVideo(eventId) {
  const res = await fetch(
    \`/your-backend/casino/tv/\${encodeURIComponent(eventId)}/embed\`,
    { method: "POST" }
  );
  const body = await res.json();
  if (!res.ok || !body.iframeUrl) throw new Error(body.error ?? "Video unavailable");

  document.getElementById("video-frame").src = body.iframeUrl;

  clearTimeout(refreshTimer);
  const refreshMs = Math.max((body.expiresIn - 300) * 1000, 60_000);
  refreshTimer = setTimeout(() => loadVideo(eventId), refreshMs);
}`}
          />
          <H3>HTML — live page with video iframe</H3>
          <Block
            label="HTML"
            code={`<div class="uc-live-video">
  <iframe
    id="video-frame"
    title="Live casino stream"
    allow="autoplay; fullscreen"
    referrerpolicy="strict-origin-when-cross-origin"
    style="width:100%;aspect-ratio:16/9;border:0;border-radius:10px;background:#000"
  ></iframe>
  <p id="video-error" class="uc-error" hidden></p>
</div>

<script>
  async function loadVideo(eventId) {
    const res = await fetch(
      \`/your-backend/casino/tv/\${encodeURIComponent(eventId)}/embed\`,
      { method: "POST" }
    );
    const body = await res.json();
    if (!res.ok || !body.iframeUrl) {
      document.getElementById("video-error").hidden = false;
      document.getElementById("video-error").textContent =
        body.error ?? "Video unavailable";
      return;
    }
    document.getElementById("video-frame").src = body.iframeUrl;
  }

  loadVideo(new URLSearchParams(location.search).get("eventId"));
</script>`}
          />
          <H3>Backend proxy — mint embed URL</H3>
          <Block
            label="your-backend/routes/casino.js"
            code={`router.post("/tv/:eventId/embed", async (req, res) => {
  const { eventId } = req.params;
  const r = await fetch(\`https://universeapi.store/api/tv/games/\${eventId}/embed\`, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.UC_API_KEY,
      "X-TV-Client": "true",
    },
  });
  const body = await r.json();
  if (!r.ok) {
    res.status(r.status).json(body);
    return;
  }
  // Prefix iframePath with provider base URL
  const providerBaseUrl = process.env.UC_PROVIDER_BASE_URL ?? "https://universeapi.store";
  res.json({
    iframeUrl: \`\${providerBaseUrl}\${body.iframePath}\`,
    expiresIn: body.expiresIn,
  });
});`}
          />
          <H3>Iframe troubleshooting</H3>
          <Table
            head={["Symptom", "Likely cause", "Fix"]}
            rows={[
              [
                "Universe Casino logo stuck (no live video)",
                "Double-nested iframe blocked WebRTC encrypted-media",
                "Use iframeUrl from POST /public/tv/streaming directly, or GET /api/tv/player (redirects upstream). Add allow=\"autoplay; fullscreen; encrypted-media\" on the iframe.",
              ],
              [
                "Blank iframe / error page",
                "Expired or invalid embedToken",
                "Call your backend embed proxy again and set a new iframe src",
              ],
              [
                '"Domain not whitelisted" in iframe',
                "Parent page domain not in your allowed domains, or Referer blocked",
                "Ask your account manager to add the embedding domain (e.g. partner.com). Remove no-referrer from the iframe.",
              ],
              [
                "403 on embed POST",
                "Subscription expired or account disabled",
                "Contact support to renew or reactivate your account",
              ],
              [
                "503 on embed POST",
                "No stream configured for that game",
                "Verify game is live; retry when streaming is available",
              ],
              [
                "401 on embed POST",
                "Missing X-TV-Client: true",
                "Add header on server-side embed request",
              ],
            ]}
          />
          <Note>
            <strong>Important:</strong> the TV player URL serves video only. Overlays come from Live
            game state.
          </Note>

          {/* Response fields */}
          <H2 id="response-fields">Response fields</H2>
          <Table
            head={["Field", "Description"]}
            rows={[
              [<Code key="1">eventId</Code>, "Game identifier (e.g. 99.0010)"],
              [
                <Code key="2">stale</Code>,
                "true when the snapshot is outdated — treat as degraded data",
              ],
              [<Code key="3">freshnessMs</Code>, "Milliseconds since the snapshot was last updated"],
              [<Code key="4">data.roundId</Code>, "Current round identifier"],
              [
                <Code key="5">data.status / data.roundStatus</Code>,
                "Round phase (e.g. OPEN, CLOSED)",
              ],
              [<Code key="6">data.leftSec</Code>, "Seconds remaining in the current betting window"],
              [<Code key="7">data.marketArr</Code>, "Markets and runner prices for the round"],
              [<Code key="8">data.cardsArr</Code>, "Dealt cards keyed by market/runner"],
              [
                <Code key="9">data.resultsArr</Code>,
                "Recent result entries when present in live snapshot",
              ],
              [
                <Code key="10">data[].roundId</Code>,
                "Round id from GET /api/games/:eventId/results",
              ],
              [<Code key="11">data[].winner</Code>, "Winning runner code for the round"],
              [<Code key="12">data[].cards</Code>, "Card codes dealt in that round"],
              [<Code key="13">data[].results</Code>, "Per-market runner outcomes (WIN / LOSE)"],
            ]}
          />

          {/* Betting & wallet */}
          <H2 id="betting-wallet">Betting &amp; wallet (seat API)</H2>
          <P>
            These endpoints let your platform place real bets on Universal API rounds. Player money
            always stays in <strong>your</strong> wallet: we call your callback URL to debit stake
            and credit winnings. All three endpoints use the same{" "}
            <Code>x-api-key</Code> header and respect your IP / domain whitelist.
          </P>

          <H3>Place a bet</H3>
          <Endpoint method="POST" path="/api/public/v1/bet" auth="API key" />
          <Block
            label="Request"
            code={`POST /api/public/v1/bet
x-api-key: <your key>
content-type: application/json

{
  "userId": "player-1042",
  "gameId": "99.0010",
  "roundId": "1725312001",
  "market": "Lucky 7",
  "selection": "LOW",
  "odds": 1.98,
  "stake": 500,
  "reference": "your-unique-txn-id"
}`}
          />
          <Block
            label="Response"
            code={`{ "status": "ok", "betId": "…", "reference": "your-unique-txn-id", "balance": 9500, "currency": "INR" }`}
          />
          <Note>
            <strong>Idempotent:</strong> resending the same <Code>reference</Code> returns the
            original bet with <Code>duplicate: true</Code> — never double-debits.
          </Note>

          <H3>Player balance</H3>
          <Endpoint method="POST" path="/api/public/v1/balance" auth="API key" />
          <Block label="Request" code={`{ "userId": "player-1042" }`} />
          <Block label="Response" code={`{ "status": "ok", "currency": "INR", "balance": 9500 }`} />

          <H3>Bet history</H3>
          <Endpoint method="GET" path="/api/public/v1/bets?userId=&gameId=&limit=50" auth="API key" />
          <Block
            label="Response"
            code={`{ "status": "ok", "count": 2, "bets": [
  { "operator_user_id": "player-1042", "game_id": "99.0010", "round_id": "1725312001",
    "selection": "LOW", "odds": 1.98, "stake": 500, "payout": 990,
    "status": "won", "reference": "your-unique-txn-id", "settled_at": "…" }
] }`}
          />

          <H3>Your wallet callback</H3>
          <P>
            Set your callback base URL in the operator panel. We POST to{" "}
            <Code>{"<callback>/balance"}</Code>, <Code>{"<callback>/debit"}</Code>,{" "}
            <Code>{"<callback>/credit"}</Code> and <Code>{"<callback>/rollback"}</Code>.
          </P>
          <Block
            label="Body we send"
            code={`{
  "action": "debit",
  "operatorId": "…",
  "currency": "INR",
  "userId": "player-1042",
  "amount": 500,
  "reference": "your-unique-txn-id",
  "gameId": "99.0010",
  "roundId": "1725312001",
  "betId": "…",
  "timestamp": "2026-09-02T23:10:00.000Z"
}`}
          />
          <P>
            Headers: <Code>x-universal-operator</Code> (your operator id) and{" "}
            <Code>x-universal-signature</Code> = HMAC-SHA256 of the <em>raw</em> body using your
            callback secret (hex). Verify it before touching balances.
          </P>
          <Block
            label="Verify (Node.js)"
            code={`const expected = crypto.createHmac("sha256", CALLBACK_SECRET)
  .update(rawBody).digest("hex");
if (expected !== req.headers["x-universal-signature"]) return res.status(401).end();`}
          />
          <Block
            label="Your reply"
            code={`{ "status": "ok", "balance": 9500, "reference": "your-unique-txn-id" }`}
          />
          <Note>
            Reply non-2xx or <Code>{'{ "status": "failed" }'}</Code> to reject a debit (e.g.
            insufficient funds) — the bet is then rejected and logged in your panel. Settlement
            credits are sent automatically when the round result arrives; failed inserts trigger a{" "}
            <Code>rollback</Code>.
          </Note>

          {/* Balance maintain */}

          <H2 id="balance-maintain">Balance maintain</H2>
          <P>
            Player funds always live in <strong>your</strong> wallet. We never hold or display a
            balance of our own — every stake, payout and refund is a call to your callback URL, so
            your ledger stays the single source of truth.
          </P>

          <H3>Money flow of one round</H3>
          <Step n={1} title="Bet placed">
            We POST <Code>{"<callback>/debit"}</Code> with the stake and a unique{" "}
            <Code>reference</Code>. Deduct it and reply with the new balance.
          </Step>
          <Step n={2} title="Round result">
            On a win we POST <Code>{"<callback>/credit"}</Code> with the payout and the same{" "}
            <Code>reference</Code> plus <Code>settlementRef</Code>. On a loss no call is made — the
            stake already left the wallet.
          </Step>
          <Step n={3} title="Anything fails">
            If the bet cannot be stored or the round is voided we POST{" "}
            <Code>{"<callback>/rollback"}</Code> with the original <Code>reference</Code>. Return
            the stake exactly once.
          </Step>
          <Step n={4} title="Sync check">
            Our seat API reports the balance you last returned. Poll{" "}
            <Code>POST /api/public/v1/balance</Code> or read your own ledger to confirm both sides
            agree.
          </Step>

          <H3>Rules to keep balances correct</H3>
          <Block
            label="Idempotency (Node.js)"
            code={`// store every reference you have already processed
const seen = await db.tx.findOne({ reference: body.reference, action: body.action });
if (seen) return res.json({ status: "ok", balance: seen.balanceAfter, reference: body.reference });

const balance = await wallet.apply(body.userId, body.action === "debit" ? -body.amount : body.amount);
await db.tx.insert({ reference: body.reference, action: body.action, balanceAfter: balance });
res.json({ status: "ok", balance, reference: body.reference });`}
          />
          <Note>
            <strong>Never</strong> apply the same <Code>reference</Code> + <Code>action</Code>{" "}
            twice. Retries are normal (network timeouts) and must return the stored result, not a
            second debit or credit.
          </Note>
          <List
            items={[
              <>
                Verify <Code>x-universal-signature</Code> before changing any balance.
              </>,
              <>
                Reply within <strong>5 seconds</strong>; a timeout is treated as{" "}
                <Code>callback_failed</Code> and the bet is rejected.
              </>,
              <>
                Always return the <em>post-transaction</em> balance in the same currency you
                registered.
              </>,
              <>
                Reject with <Code>{'{ "status": "failed", "error": "insufficient_funds" }'}</Code>{" "}
                instead of returning a negative balance.
              </>,
              <>
                Reconcile daily with <Code>GET /api/public/v1/bets</Code> — stake and payout per{" "}
                <Code>reference</Code> should match your ledger row for row.
              </>,
            ]}
          />
          <Block
            label="Daily reconciliation"
            code={`GET /api/public/v1/bets?limit=500
// for each bet: ledger.debit(reference) === bet.stake
//               bet.status === "won" ? ledger.credit(reference) === bet.payout : no credit row`}
          />


          {/* Errors */}

          <H2 id="errors">Errors</H2>
          <P>
            Data endpoints reply with <Code>{'{ "error": "message" }'}</Code>. Betting / wallet
            endpoints reply with <Code>{'{ "status": "error", "code": "…", "message": "…" }'}</Code>.
          </P>
          <Table
            head={["Status", "Code", "Meaning"]}
            rows={[
              ["401", <Code key="a">missing_key</Code>, "No x-api-key / Authorization header sent"],
              ["401", <Code key="b">invalid_key</Code>, "Key unknown or deactivated"],
              ["403", <Code key="c">operator_disabled</Code>, "Account disabled — contact support"],
              ["403", <Code key="d">ip_not_allowed</Code>, "Calling IP is not whitelisted for this key"],
              ["403", <Code key="e">domain_not_allowed</Code>, "Origin domain not whitelisted for this key"],
              ["402", <Code key="f">plan_expired</Code>, "Monthly subscription has ended — renew to resume"],
              ["400", <Code key="g">bad_request</Code>, "Invalid or missing body fields"],
              ["409", <Code key="h">round_closed</Code>, "Betting is closed for that round"],
              ["424", <Code key="i">no_callback_url</Code>, "Set your wallet callback URL in the operator panel"],
              ["502", <Code key="j">callback_failed</Code>, "Your wallet endpoint was unreachable or errored"],
              ["402", <Code key="k">wallet_rejected</Code>, "Your wallet declined the debit (e.g. low balance)"],
              ["404", "—", "Unknown eventId — check the supported games list"],
              ["503", "—", "Live data missing or stale — retry with backoff"],
            ]}
          />


          {/* Integration guide */}
          <H2 id="integration-guide">Integration guide</H2>
          <P>Recommended setup for a production integration.</P>
          <Step n={1} title="Store credentials securely">
            Keep your API key in server-side environment variables. Never expose it in browser code
            or mobile app bundles.
          </Step>
          <Step n={2} title="Register embedding domains">
            Provide every production domain where end users will load the TV iframe (e.g.
            partner.com, www.partner.com). Subdomains of a registered domain are accepted
            automatically.
          </Step>
          <Step n={3} title="Fetch the game list">
            Call <Code>GET /api/games</Code> once at startup (or cache with a long TTL) to build your
            game menu.
          </Step>
          <Step n={4} title="Poll live state per game">
            When a user opens a game, poll <Code>GET /api/games/:eventId/state</Code> every 1–2
            seconds from your backend and forward normalized data to your frontend.
          </Step>
          <Step n={5} title="Handle degraded responses">
            On <Code>503</Code> or <Code>stale: true</Code>, show a &quot;live data temporarily
            unavailable&quot; state and retry with exponential backoff.
          </Step>
          <Step n={6} title="Load recent results">
            Call <Code>GET /api/games/:eventId/results</Code> when the live page opens and refresh
            every 10–30 seconds for the results sidebar.
          </Step>
          <Step n={7} title="Embed live video (optional)">
            On the live page, call your backend embed proxy, set iframe src to the returned URL, and
            refresh the token before <Code>expiresIn</Code>. See Iframe embed.
          </Step>
          <Note>
            <strong>Best practice:</strong> proxy all API calls through your own backend so the API
            key never reaches the browser. Only the short-lived embed token is passed to the iframe
            URL.
          </Note>

          {/* Game UI */}
          <H2 id="game-ui">Game UI reference (HTML &amp; CSS)</H2>
          <P>
            Copy the markup and styles below into your partner site. Bind odds from{" "}
            <Code>data.marketArr</Code> on live state and populate result modals from{" "}
            <Code>GET /api/games/:eventId/results</Code>. Download image assets from this site and
            host them on your server under the same <Code>/assets/</Code> paths.
          </P>
          <Note>
            <strong>Assets:</strong> All files are served from this domain only (e.g.{" "}
            <Code>/assets/cards/H7_.png</Code>). Use Download to save files — no third-party links.
            After download, upload to your CDN keeping the path structure.
          </Note>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {UI_GAMES.map((id) => {
              const g = GAMES.find((x) => x.id === id);
              return (
                <div key={id} className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="font-mono text-[0.7rem] text-muted-foreground">{id}</p>
                  <p className="mt-0.5 text-xs font-semibold text-foreground">{g?.name ?? id}</p>
                </div>
              );
            })}
          </div>

          <H3>20-20 TEENPATTI 99.0010</H3>
          <P>Runner tiles per market + dual-column result modal (Player A vs Player B).</P>
          <P>
            Bind prices from <Code>data.marketArr</Code>. Map card codes from <Code>cardsArr</Code>{" "}
            to <Code>cardImageUrl(code)</Code>.
          </P>
          <p className="mt-5 text-sm font-semibold text-foreground">
            Assets (download from this site)
          </p>
          <Table
            head={["Asset", "Path on your server", "Download"]}
            rows={[
              ["Playing card", <Code key="1">/assets/cards/{"{code}"}_.png</Code>, "—"],
              ["Hidden / back card", <Code key="2">/assets/cards/null.png</Code>, "Download"],
              [
                "Result modal trophy styles",
                <Code key="3">/assets/docs/trophy-icons.css</Code>,
                "Download",
              ],
            ]}
          />
          <H3>HTML — asset links &amp; img tags</H3>
          <Block
            label="HTML"
            code={`<link rel="stylesheet" href="/assets/docs/trophy-icons.css" />

<!-- Bind src from API card codes; paths are on your server after you download assets -->
<img src="/assets/cards/H7_.png" alt="Player A card" width="62" />
<img src="/assets/cards/S5_.png" alt="Player B card" width="62" />`}
          />
          <H3>JavaScript — build image URLs from API codes</H3>
          <Block
            label="JS"
            code={`const ASSET_BASE = "https://your-domain.com";

function cardImageUrl(code) {
  if (!code || code === "0") return \`\${ASSET_BASE}/assets/cards/null.png\`;
  return \`\${ASSET_BASE}/assets/cards/\${code}_.png\`;
}

// After download: host files under /assets/ on your server`}
          />
          <H3>Live odds / markets UI</H3>
          <Block label="HTML" code={ODDS_HTML} />
          <H3>CSS — odds panel</H3>
          <Block label="CSS" code={ODDS_CSS} />
          <H3>Result modal UI</H3>
          <Block label="HTML — result modal body" code={MODAL_HTML} />
          <H3>CSS — result modal</H3>
          <Block label="CSS" code={MODAL_CSS} />


          {/* Supported games */}
          <H2 id="supported-games">Supported games</H2>
          <Table
            head={["eventId", "Game name"]}
            rows={GAMES.filter((g) => g.id.startsWith("99.") || g.id.startsWith("88.")).map((g) => [
              <Code key={g.id}>{g.id}</Code>,
              <span key={`${g.id}n`} className="text-foreground">
                {g.name}
              </span>,
            ])}
          />

          <div className="mt-12 border-t border-border pt-6">
            <Link to="/sports-docs" className="text-sm font-semibold text-foreground hover:underline">
              Sports API docs →
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
