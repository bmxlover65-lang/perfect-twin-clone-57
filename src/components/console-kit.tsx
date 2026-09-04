import { useState } from "react";
import { Panel, dashGhost as ghost } from "@/components/dash";
import { GAMES } from "@/data/games";

const BASE = "https://universeapi.store";

function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className={`${ghost} absolute right-2 top-2 z-10`}
        onClick={() => {
          void navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[0.72rem] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Block({ title, note, code }: { title: string; note?: string | undefined; code: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-foreground">{title}</p>
      {note ? <p className="text-[0.75rem] text-muted-foreground">{note}</p> : null}
      <Code code={code} />
    </div>
  );
}

/* ------------------------------- snippets -------------------------------- */

const NODE_CASINO = `// Node.js (18+) — casino: list games, read live state, place a bet
const BASE = "${BASE}";
const API_KEY = process.env.UNIVERSE_API_KEY;

async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,          // or: Authorization: "Bearer " + API_KEY
      ...(init.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || ("HTTP " + res.status));
  return body;
}

// 1. game list
const games = await api("/api/public/v1/games");

// 2. live state of one table (poll every 1s, or use the websocket below)
const state = await api("/api/public/v1/state?eventId=99.0010");

// 3. place a bet for one of your players
const bet = await api("/api/public/v1/bet", {
  method: "POST",
  body: JSON.stringify({
    userId: "player-1042",       // your own user id
    gameId: "99.0010",
    roundId: state.roundId,
    selection: "PLAYER A",
    odds: 1.98,
    stake: 100,
    reference: "txn-" + Date.now(),
  }),
});

console.log(bet.status);          // accepted | rejected`;

const NODE_WS = `// Node.js — websocket push instead of polling
import WebSocket from "ws";

const ws = new WebSocket(
  "wss://universeapi.store/ws?eventId=99.0010&apiKey=" + process.env.UNIVERSE_API_KEY,
);

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "subscribed") console.log("live on", msg.eventId);
  if (msg.type === "state") render(msg.data);   // markets, cards, timer, results
});

ws.on("close", (code) => {
  if (code === 1008) console.error("key / IP not allowed");
  else setTimeout(connectAgain, 2000);
});`;

const NODE_SPORTS = `// Node.js — sports: events + odds
const events = await api("/api/public/v1/sports/events?sportId=1");   // 1 soccer, 2 tennis, 4 cricket

const odds = await api(
  "/api/public/v1/sports/1/" + events[0].exEventId + "/odds",
);

// TV + scoreboard are served through the same proxy, so your key stays private:
const tvUrl = BASE + "/api/public/v1/sports/tv?eventId=" + events[0].exEventId;
const sbUrl = BASE + "/api/public/v1/sports/scoreboard?eventId=" + events[0].exEventId;`;

const NODE_WALLET = `// Node.js / Express — YOUR wallet endpoint (we call this)
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ verify: (req, _res, buf) => (req.rawBody = buf) }));

const SECRET = process.env.UNIVERSE_CALLBACK_SECRET;

function verify(req) {
  const sig = req.get("x-signature") || "";
  const expected = crypto.createHmac("sha256", SECRET).update(req.rawBody).digest("hex");
  return sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

app.post("/api/wallet", async (req, res) => {
  if (!verify(req)) return res.status(401).json({ ok: false, message: "bad signature" });

  const { action, userId, amount, reference } = req.body;
  // action: balance | debit | credit | rollback
  // IMPORTANT: make debit/credit idempotent on "reference"

  switch (action) {
    case "balance":  return res.json({ ok: true, balance: await getBalance(userId) });
    case "debit":    return res.json({ ok: true, balance: await debit(userId, amount, reference) });
    case "credit":   return res.json({ ok: true, balance: await credit(userId, amount, reference) });
    case "rollback": return res.json({ ok: true, balance: await rollback(userId, reference) });
    default:         return res.status(400).json({ ok: false, message: "unknown action" });
  }
});

app.listen(3000);`;

const PHP_CASINO = `<?php
// Plain PHP — casino calls
define('BASE', '${BASE}');
define('API_KEY', getenv('UNIVERSE_API_KEY'));

function uapi(string $path, ?array $body = null) {
    $ch = curl_init(BASE . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . API_KEY],
        CURLOPT_POST => $body !== null,
        CURLOPT_POSTFIELDS => $body !== null ? json_encode($body) : null,
        CURLOPT_TIMEOUT => 10,
    ]);
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($raw, true);
    if ($code >= 400) throw new RuntimeException($json['message'] ?? "HTTP $code");
    return $json;
}

$games = uapi('/api/public/v1/games');
$state = uapi('/api/public/v1/state?eventId=99.0010');

$bet = uapi('/api/public/v1/bet', [
    'userId'    => 'player-1042',
    'gameId'    => '99.0010',
    'roundId'   => $state['roundId'],
    'selection' => 'PLAYER A',
    'odds'      => 1.98,
    'stake'     => 100,
    'reference' => 'txn-' . time(),
]);`;

const PHP_WALLET = `<?php
// Plain PHP — YOUR wallet endpoint (we call this)
$secret = getenv('UNIVERSE_CALLBACK_SECRET');
$raw    = file_get_contents('php://input');
$sig    = $_SERVER['HTTP_X_SIGNATURE'] ?? '';

if (!hash_equals(hash_hmac('sha256', $raw, $secret), $sig)) {
    http_response_code(401);
    exit(json_encode(['ok' => false, 'message' => 'bad signature']));
}

$p = json_decode($raw, true);
header('Content-Type: application/json');

switch ($p['action']) {
    case 'balance':
        echo json_encode(['ok' => true, 'balance' => get_balance($p['userId'])]); break;
    case 'debit':
        // reject when funds are short — we then mark the bet rejected
        if (get_balance($p['userId']) < $p['amount']) {
            http_response_code(402);
            echo json_encode(['ok' => false, 'message' => 'insufficient funds']); break;
        }
        echo json_encode(['ok' => true, 'balance' => debit($p['userId'], $p['amount'], $p['reference'])]); break;
    case 'credit':
        echo json_encode(['ok' => true, 'balance' => credit($p['userId'], $p['amount'], $p['reference'])]); break;
    case 'rollback':
        echo json_encode(['ok' => true, 'balance' => rollback($p['userId'], $p['reference'])]); break;
    default:
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'unknown action']);
}`;

const LARAVEL_CLIENT = `<?php
// app/Services/UniverseApi.php
namespace App\\Services;

use Illuminate\\Support\\Facades\\Http;

class UniverseApi
{
    protected function client()
    {
        return Http::withHeaders(['x-api-key' => config('services.universe.key')])
            ->baseUrl(config('services.universe.base'))   // ${BASE}
            ->timeout(10)
            ->acceptJson();
    }

    public function games()                { return $this->client()->get('/api/public/v1/games')->throw()->json(); }
    public function state(string $eventId) { return $this->client()->get('/api/public/v1/state', ['eventId' => $eventId])->throw()->json(); }
    public function sportsOdds($sportId, $exEventId) {
        return $this->client()->get("/api/public/v1/sports/{$sportId}/{$exEventId}/odds")->throw()->json();
    }

    public function bet(array $payload)
    {
        return $this->client()->post('/api/public/v1/bet', $payload)->throw()->json();
    }
}

// config/services.php
'universe' => [
    'base'   => env('UNIVERSE_BASE', '${BASE}'),
    'key'    => env('UNIVERSE_API_KEY'),
    'secret' => env('UNIVERSE_CALLBACK_SECRET'),
],`;

const LARAVEL_WALLET = `<?php
// routes/api.php
Route::post('/wallet', [WalletController::class, 'handle'])
    ->middleware(VerifyUniverseSignature::class);

// app/Http/Middleware/VerifyUniverseSignature.php
public function handle($request, Closure $next)
{
    $expected = hash_hmac('sha256', $request->getContent(), config('services.universe.secret'));
    abort_unless(hash_equals($expected, (string) $request->header('x-signature')), 401, 'bad signature');
    return $next($request);
}

// app/Http/Controllers/WalletController.php
public function handle(Request $request)
{
    $data = $request->validate([
        'action'    => 'required|in:balance,debit,credit,rollback',
        'userId'    => 'required|string',
        'amount'    => 'nullable|numeric|min:0',
        'reference' => 'nullable|string',
    ]);

    return DB::transaction(function () use ($data) {
        $wallet = Wallet::where('user_id', $data['userId'])->lockForUpdate()->firstOrFail();

        // idempotency: same reference must never be applied twice
        if (!empty($data['reference']) &&
            WalletTxn::where('reference', $data['reference'])->exists()) {
            return ['ok' => true, 'balance' => $wallet->balance];
        }

        match ($data['action']) {
            'balance'  => null,
            'debit'    => $wallet->decrement('balance', $data['amount']),
            'credit'   => $wallet->increment('balance', $data['amount']),
            'rollback' => $wallet->increment('balance', $data['amount'] ?? 0),
        };

        if ($data['action'] !== 'balance') {
            WalletTxn::create([
                'user_id'   => $data['userId'],
                'kind'      => $data['action'],
                'amount'    => $data['amount'] ?? 0,
                'reference' => $data['reference'],
            ]);
        }

        return ['ok' => true, 'balance' => $wallet->fresh()->balance];
    });
}`;

const IFRAME = `<!-- Launch ONE game (embed=1 => sirf game, koi site header/nav nahi) -->
<iframe
  src="${BASE}/games/99.0010?embed=1&apiKey=YOUR_KEY&userId=player-1042"
  allow="autoplay; fullscreen"
  style="width:100%;aspect-ratio:16/10;border:0;border-radius:12px"
></iframe>

<!-- Mobile webview: same URL, layout khud mobile ban jaata hai -->
<!-- Sports event (sirf tab jab key me sports allowed ho) -->
<iframe src="${BASE}/sports/1/10020269215118469?embed=1" ...></iframe>`;

const LANGS = [
  {
    id: "node",
    label: "Node.js",
    blocks: [
      { title: "Casino — REST", note: "Key header par jaata hai, kabhi bhi browser me expose mat karo.", code: NODE_CASINO },
      { title: "Casino — WebSocket", note: "Polling se behtar: 1s state push.", code: NODE_WS },
      { title: "Sports", note: "TV aur scoreboard bhi isi proxy se aate hain.", code: NODE_SPORTS },
      { title: "Callback wallet (aapka endpoint)", note: "Ye URL Manage tab me daalein — hum yahin debit/credit karte hain.", code: NODE_WALLET },
    ],
  },
  {
    id: "php",
    label: "PHP",
    blocks: [
      { title: "Casino + bet", code: PHP_CASINO },
      { title: "Callback wallet (aapka endpoint)", code: PHP_WALLET },
    ],
  },
  {
    id: "laravel",
    label: "Laravel",
    blocks: [
      { title: "API service class", code: LARAVEL_CLIENT },
      { title: "Callback wallet route + controller", note: "Idempotency reference par lagti hai.", code: LARAVEL_WALLET },
    ],
  },
  {
    id: "embed",
    label: "Embed / iframe",
    blocks: [{ title: "Game launch", note: "Sabse tez integration — sirf iframe.", code: IFRAME }],
  },
] as const;

const FLOW: { t: string; b: string }[] = [
  { t: "1 · Key milegi", b: "Console → Operators me operator banate hi API key + callback secret ek baar dikhte hain. Unhe apne server env me rakhein." },
  { t: "2 · Whitelist", b: "API keys & access tab me us key ke IP aur domain add karein. List khali = koi restriction nahi; kuch bhi add kiya to sirf wahi allowed." },
  { t: "3 · Callback wallet", b: "Manage tab me callback URL save karein. Har bet par hum aapke wallet ko signed debit bhejte hain, win par credit, fail par rollback." },
  { t: "4 · Games dikhao", b: "REST/WS se live state lo ya seedha iframe embed karo. Round id har bet ke saath bhejna zaroori hai." },
  { t: "5 · Settlement", b: "Result aate hi bet won/lost hoti hai aur win amount aapke wallet par credit callback se jaata hai — reference par idempotent rakhein." },
];

const OP_FLOW: { t: string; b: string }[] = [
  { t: "1 · Aapki key", b: "API key & whitelist tab me aapki key ka prefix aur validity dikhti hai. Poori key sirf ek baar milti hai — server env me rakhein, browser me kabhi nahi." },
  { t: "2 · Whitelist", b: "Usi tab me apna server IP aur site domain add karein. List khali = koi restriction nahi; ek bhi entry add ki to sirf wahi allowed." },
  { t: "3 · Callback wallet", b: "Callback URL tab me apna wallet endpoint save karein. Har bet par signed debit, win par credit, fail par rollback aata hai." },
  { t: "4 · Games dikhao", b: "REST/WS se live state lein ya seedha iframe embed karein. Round id har bet ke saath bhejna zaroori hai." },
  { t: "5 · Test karein", b: "Callback URL tab me balance / debit / credit / rollback test bhej kar apna endpoint verify karein — response Callback logs me dikhega." },
];

const ENDPOINTS: [string, string][] = [
  ["GET /api/public/v1/me", "Is key ko casino / sports me se kya allowed hai"],
  ["GET /api/public/v1/games", "Casino table list + ids"],
  ["GET /api/public/v1/state?eventId=", "Live markets, cards, timer, results"],
  ["WS  /ws?eventId=&apiKey=", "Same state, pushed (recommended)"],
  ["POST /api/public/v1/bet", "Place a bet (debits your wallet)"],
  ["GET /api/public/v1/bets?userId=", "Bet history for one player"],
  ["GET /api/public/v1/balance?userId=", "Balance as your wallet reports it"],
  ["GET /api/public/v1/sports/events?sportId=", "In-play + pre-match events"],
  ["GET /api/public/v1/sports/{sportId}/{exEventId}/odds", "Full odds ladder"],
  ["WS  /ws/sports?sportId=&exEventId=&apiKey=", "Odds push"],
];

const GAME_JSON = JSON.stringify(
  {
    status: "ok",
    count: GAMES.length,
    games: GAMES.map((g) => ({
      gameId: g.id,
      name: g.name,
      type: g.kind,
      product: "casino",
      markets: g.markets.map((m) => ({
        market: m.name,
        selections: m.selections.map((sel) => ({ selection: sel.name, odds: sel.odds })),
      })),
      launchUrl: `${BASE}/games/${g.id}?embed=1&apiKey=YOUR_KEY&userId=PLAYER_ID`,
      image: g.image ?? null,
    })),
  },
  null,
  2,
);

const GAME_FETCH = `// Live list — same shape as below, always current
const res = await fetch("${BASE}/api/public/v1/games", {
  headers: { "x-api-key": process.env.UNIVERSE_API_KEY },
});
const { games } = await res.json();
// games[i].gameId ko /state, /bet aur launch URL me use karein`;

export function AdminKit({ role = "admin" }: { role?: "admin" | "operator" } = {}) {
  const [lang, setLang] = useState<string>("node");
  const active = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  return (
    <>
      <Panel title="Integration flow — start to finish">
        <ol className="grid gap-2 sm:grid-cols-2">
          {(role === "operator" ? OP_FLOW : FLOW).map((f) => (
            <li key={f.t} className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-foreground">{f.t}</p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">{f.b}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Endpoints">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {ENDPOINTS.map(([e, d]) => (
                <tr key={e} className="border-t border-border">
                  <td className="whitespace-nowrap p-2 font-mono text-foreground">{e}</td>
                  <td className="p-2 text-muted-foreground">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[0.75rem] text-muted-foreground">
          Full reference:{" "}
          <a className="font-semibold text-primary underline" href="/casino-docs">
            Casino docs
          </a>{" "}
          ·{" "}
          <a className="font-semibold text-primary underline" href="/sports-docs">
            Sports docs
          </a>
        </p>
      </Panel>

      <Panel title="Casino game list (JSON)">
        <div className="space-y-4">
          <Block
            title="Fetch the live list"
            note="Yahi list API se aati hai — apne lobby me isi ko render karein."
            code={GAME_FETCH}
          />
          <Block
            title="All casino games — full JSON"
            note={`${GAMES.length} games: gameId, markets, selections, odds aur ready launch URL.`}
            code={GAME_JSON}
          />
        </div>
      </Panel>

      <Panel
        title="Code kit"
        action={
          <div className="flex flex-wrap gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLang(l.id)}
                className={`rounded-md px-2.5 py-1 text-[0.7rem] font-bold transition-colors ${
                  lang === l.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-4">
          {active!.blocks.map((b) => (
            <Block key={b.title} title={b.title} note={"note" in b ? b.note : undefined} code={b.code} />
          ))}
        </div>
      </Panel>
    </>
  );
}
