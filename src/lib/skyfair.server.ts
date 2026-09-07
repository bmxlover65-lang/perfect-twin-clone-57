// Backup live sports feed.
//
// The primary provider's sports ingest worker goes down from time to time. This
// module talks to a second exchange front-end that exposes the same Betfair
// prices, so events and odds keep updating during a primary outage.

const BASE = "https://skyfairinr.com";
const USER = "Fairdemo02";
const PASS = "Abcd1234";

const SPORT_ENDPOINT: Record<string, string> = {
  "4": "queryEventsWithMarketC", // Cricket
  "1": "queryEventsWithMarketF", // Soccer
  "2": "queryEventsWithMarketT", // Tennis
};

type SfEvent = {
  EventCode: string;
  BetfairId: string;
  Runnername: string;
  is_live?: string;
  match_time?: string;
  LiveTv?: string;
  is_fancy?: string;
};

type SfOddsRow = {
  Runnername: string;
  back1?: string;
  back11?: string;
  back22?: string;
  lay1?: string;
  lay11?: string;
  lay22?: string;
  back1size?: string;
  back2size?: string;
  back3size?: string;
  lay1size?: string;
  lay2size?: string;
  lay3size?: string;
  totalMatched?: string;
  status?: string;
  match_status?: string;
};

let cookie = "";
let cookieAt = 0;

function collectCookies(res: Response, previous: string) {
  const raw =
    // Cloudflare Workers exposes multiple Set-Cookie values through getSetCookie
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : []);
  const jar = new Map<string, string>();
  for (const part of previous.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k && v.length) jar.set(k, v.join("="));
  }
  for (const line of raw) {
    const first = line.split(";")[0] ?? "";
    const [k, ...v] = first.trim().split("=");
    if (k && v.length) jar.set(k, v.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(): Promise<string> {
  const page = await fetch(`${BASE}/home/login`, {
    headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
  });
  const html = await page.text();
  let jar = collectCookies(page, "");
  const token = /id="login_page_token"\s+value="([A-Za-z0-9]+)"/.exec(html)?.[1] ?? "";
  const body = new URLSearchParams({
    username: USER,
    password: PASS,
    mcode: `code_${Math.random().toString(36).slice(2, 12)}`,
    loginPageToken: token,
  });
  const res = await fetch(`${BASE}/ClientV/LoginHandler`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      "user-agent": "Mozilla/5.0",
      cookie: jar,
    },
    body: body.toString(),
  });
  jar = collectCookies(res, jar);
  await res.text().catch(() => "");
  cookie = jar;
  cookieAt = Date.now();
  return jar;
}

async function session(force = false): Promise<string> {
  if (!force && cookie && Date.now() - cookieAt < 15 * 60_000) return cookie;
  return login();
}

async function sfFetch(path: string, body?: string): Promise<string> {
  const call = async (jar: string) =>
    fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "x-requested-with": "XMLHttpRequest",
        "user-agent": "Mozilla/5.0",
        cookie: jar,
        ...(body === undefined ? {} : { "content-type": "application/x-www-form-urlencoded" }),
      },
      ...(body === undefined ? {} : { body }),
    });

  let res = await call(await session());
  let text = await res.text();
  if (!res.ok || text.trim() === "" || text.trim() === "[]") {
    res = await call(await session(true));
    text = await res.text();
  }
  return text;
}

function parse<T>(text: string): T[] {
  try {
    const json = JSON.parse(text) as unknown;
    return Array.isArray(json) ? (json as T[]) : [];
  } catch {
    return [];
  }
}

export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+v(s)?\s+/g, " v ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function events(sportId: string): Promise<SfEvent[]> {
  const endpoint = SPORT_ENDPOINT[sportId];
  if (!endpoint) return [];
  const text = await sfFetch(`/FunctionData/${endpoint}?cric_ids=in_play&extra_ie=skyfairinr`);
  return parse<SfEvent>(text);
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Events list in the shape the app already renders. */
export async function backupEvents(sportId: string) {
  const list = await events(sportId);
  return list.map((e) => ({
    sportId,
    exEventId: `sf:${e.EventCode}:${e.BetfairId}`,
    eventName: e.Runnername,
    marketName: "Match Odds",
    inPlay: e.is_live === "on",
    status: "OPEN",
    tv: e.LiveTv === "flex",
    isFancy: e.is_fancy === "flex",
    eventTime: e.match_time,
    runners: [],
  }));
}

/** Match odds for one event, keyed either by our backup id or by event name. */
export async function backupOdds(sportId: string, exEventId: string, eventName?: string) {
  let eventCode = "";
  let betfairId = "";
  let name = eventName ?? "";

  if (exEventId.startsWith("sf:")) {
    const [, code, bf] = exEventId.split(":");
    eventCode = code ?? "";
    betfairId = bf ?? "";
  } else {
    if (!name) return null;
    const target = normalizeName(name);
    const list = await events(sportId);
    const hit =
      list.find((e) => normalizeName(e.Runnername) === target) ??
      list.find((e) => {
        const a = normalizeName(e.Runnername).split(" v ");
        const b = target.split(" v ");
        return a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
      });
    if (!hit) return null;
    eventCode = hit.EventCode;
    betfairId = hit.BetfairId;
    name = hit.Runnername;
  }
  if (!eventCode || !betfairId) return null;

  const text = await sfFetch(
    "/ApiNew/Mod",
    new URLSearchParams({ bfair_id: betfairId, event_code: eventCode }).toString(),
  );
  const rows = parse<SfOddsRow>(text);
  if (!rows.length) return null;

  const runnersData: Record<string, string> = {};
  const runners = rows.map((r, i) => {
    const id = `${eventCode}-${i}`;
    runnersData[id] = r.Runnername;
    const back = [
      { price: num(r.back1), size: num(r.back1size) },
      { price: num(r.back11), size: num(r.back2size) },
      { price: num(r.back22), size: num(r.back3size) },
    ];
    const lay = [
      { price: num(r.lay1), size: num(r.lay1size) },
      { price: num(r.lay11), size: num(r.lay2size) },
      { price: num(r.lay22), size: num(r.lay3size) },
    ];
    return {
      selectionId: id,
      status: (r.status ?? "ACTIVE").toUpperCase(),
      handicap: 0,
      price: { back, lay },
    };
  });

  return {
    exEventId,
    eventName: name || rows[0]?.Runnername || "",
    sportId,
    inPlay: true,
    source: "backup",
    updatedAt: new Date().toISOString(),
    totalMatched: num(rows[0]?.totalMatched),
    matchOdds: [
      {
        marketId: `sf-${betfairId}`,
        marketName: "Match Odds",
        marketType: "MATCH_ODDS",
        runnersData,
        oddsData: {
          status: (rows[0]?.match_status ?? "OPEN").toUpperCase(),
          inPlay: true,
          betDelay: 0,
          totalMatched: num(rows[0]?.totalMatched),
          runners,
        },
      },
    ],
    bookmakers: [],
    fancy: [],
    sportsbook: [],
  };
}
