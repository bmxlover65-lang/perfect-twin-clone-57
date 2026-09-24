/**
 * Fancy / session results from the live cricket scoreboard.
 *
 * The exchange feed closes a fancy market without naming a result, so we
 * track the real score ball by ball (same scoreboard source the match page
 * shows) and work out the final number for each line:
 *   - "<TEAM> 20 Over Runs"        → team total at the end of over 20
 *   - "<TEAM> Only 20th Over Runs" → runs scored in over 20 alone
 *   - "Fall Of 3rd Wicket <TEAM>"  → team total when the 3rd wicket fell
 *   - "<Player> Runs"              → player's runs when out / innings over
 * Yes wins when result >= line, No wins when result < line.
 */

const FS_URL =
  "https://firestore.googleapis.com/v1/projects/universe-score/databases/(default)/documents:runQuery?key=AIzaSyBjh-y7heT8kshYPCpKu403q9UzaCKf26U";

type TeamTrack = {
  name: string;
  abbr: string;
  runs: number;
  wkts: number;
  balls: number;
  maxBalls: number;
  batting: boolean;
  done: boolean;
  overs: Record<string, number>; // over N -> total after N overs
  falls: Record<string, number>; // wicket k -> total when it fell
  players: Record<string, { runs: number; out: boolean }>;
};

export type ScoreTrack = { teams: Record<string, TeamTrack>; at: number; status?: string };

const key = (eventId: string) => `uapi_fancy_track_${eventId}`;

export function readTrack(eventId: string): ScoreTrack {
  try {
    const raw = localStorage.getItem(key(eventId));
    if (raw) return JSON.parse(raw) as ScoreTrack;
  } catch {
    /* fresh */
  }
  return { teams: {}, at: 0 };
}

function saveTrack(eventId: string, t: ScoreTrack) {
  try {
    localStorage.setItem(key(eventId), JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

const toBalls = (ov: string) => {
  const [o, b] = ov.split("/")[0]!.split(".");
  return Number(o || 0) * 6 + Number(b || 0);
};

type FsVal = { stringValue?: string; integerValue?: string; arrayValue?: { values?: FsVal[] }; mapValue?: { fields?: Record<string, FsVal> } };
const plain = (v: FsVal | undefined): unknown => {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(plain);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]));
  return undefined;
};

/** Pull the current score and fold it into the stored ball-by-ball track. */
export async function pullScore(eventId: string): Promise<ScoreTrack | null> {
  const res = await fetch(FS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "cricketScore" }],
        where: { fieldFilter: { field: { fieldPath: "eventId" }, op: "EQUAL", value: { stringValue: eventId } } },
      },
    }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json()) as { document?: { fields?: Record<string, FsVal> } }[];
  const doc = rows.find((r) => r.document)?.document;
  if (!doc) return null;
  const f = plain({ mapValue: { fields: doc.fields ?? {} } }) as {
    slider?: { slider: number; score?: { statusCommentry?: string; teamInfo?: Record<string, string>; scoreItems?: { teamName: string; scoreData: { iconName: string; value: string }[] }[] } }[];
  };
  const score = f.slider?.find((s) => s.slider === 1)?.score;
  const items = score?.scoreItems ?? [];
  if (!items.length) return null;
  const info = score?.teamInfo ?? {};

  const track = readTrack(eventId);
  for (const it of items) {
    const get = (icon: string) => it.scoreData.find((d) => d.iconName === icon)?.value ?? "";
    const sc = get("score");
    const ov = get("overs");
    if (!/^\d+/.test(sc) || !ov) continue;
    const [runs, wkts] = sc.split("/").map((x) => Number(x) || 0) as [number, number];
    const balls = toBalls(ov);
    const maxBalls = ov.includes("/") ? Number(ov.split("/")[1]) * 6 : 0;
    const batting = get("bat-ball") === "bat";
    const abbr = info["team1Name"] === it.teamName ? info["team1Abbreviation"] ?? "" : info["team2Abbreviation"] ?? "";
    const fresh = !track.teams[it.teamName];
    // First sighting: take the current score as the baseline — wickets that
    // fell before we started watching have no known fall score.
    const t: TeamTrack =
      track.teams[it.teamName] ??
      { name: it.teamName, abbr, runs, wkts, balls, maxBalls, batting, done: false, overs: {}, falls: {}, players: {} };
    if (fresh && (wkts >= 10 || (maxBalls > 0 && balls >= maxBalls) || (!batting && balls > 0))) t.done = true;

    // Over boundary: exact end of an over -> total after that over.
    if (balls > 0 && balls % 6 === 0 && t.overs[String(balls / 6)] === undefined) t.overs[String(balls / 6)] = runs;
    // Wickets fell since last frame -> total at the fall.
    for (let k = t.wkts + 1; k <= wkts; k++) if (t.falls[String(k)] === undefined) t.falls[String(k)] = runs;

    // Batsmen "Name 27*, Other 19": anyone who drops off the list is out.
    if (batting) {
      const now = new Map<string, number>();
      for (const part of get("currentBatsman").split(",")) {
        const m = part.trim().match(/^(.+?)\s+(\d+)\*?$/);
        if (m) now.set(m[1]!.trim(), Number(m[2]));
      }
      for (const [n, r] of now) t.players[n] = { runs: r, out: false };
      for (const [n, p] of Object.entries(t.players)) if (!now.has(n) && !p.out && now.size) p.out = true;
    }

    const allOut = wkts >= 10;
    const oversUp = maxBalls > 0 && balls >= maxBalls;
    const wasBatting = t.batting || t.balls > 0;
    if (allOut || oversUp || (wasBatting && !batting && balls > 0)) t.done = true;
    if (t.done) for (const p of Object.values(t.players)) p.out = true;

    Object.assign(t, { runs, wkts, balls, maxBalls, batting, abbr });
    track.teams[it.teamName] = t;
  }
  if (score?.statusCommentry) track.status = score.statusCommentry;
  track.at = Date.now();
  saveTrack(eventId, track);
  return track;
}

function findTeam(track: ScoreTrack, token: string): TeamTrack | null {
  const tk = token.trim().split(/\s+/)[0]!.toLowerCase();
  if (!tk) return null;
  for (const t of Object.values(track.teams)) {
    const a = t.abbr.toLowerCase();
    const n = t.name.toLowerCase();
    if ((a && (a.startsWith(tk) || tk.startsWith(a))) || n.startsWith(tk)) return t;
  }
  return null;
}

const surname = (s: string) => s.trim().split(/[\s.]+/).pop()!.toLowerCase();

/** Final number for a fancy market, or null while it is still undecided. */
export function fancyResult(track: ScoreTrack, market: string): number | null {
  const name = market.trim();
  let m = name.match(/^(.+?)\s+Only\s+(\d+)(?:st|nd|rd|th)\s+Over\s+Runs?/i);
  if (m) {
    const t = findTeam(track, m[1]!);
    const n = Number(m[2]);
    if (!t) return null;
    const end = t.overs[String(n)];
    const start = n === 1 ? 0 : t.overs[String(n - 1)];
    if (end !== undefined && start !== undefined) return end - start;
    if (t.done && start !== undefined && t.balls < n * 6) return t.runs - start;
    return null;
  }
  m = name.match(/^(.+?)\s+(\d+)\s+Over\s+Runs?/i);
  if (m) {
    const t = findTeam(track, m[1]!);
    const n = Number(m[2]);
    if (!t) return null;
    if (t.overs[String(n)] !== undefined) return t.overs[String(n)]!;
    if (t.done && t.balls < n * 6) return t.runs;
    return null;
  }
  m = name.match(/^Fall\s+Of\s+(\d+)(?:st|nd|rd|th)\s+Wicket\s+(.+)$/i);
  if (m) {
    const t = findTeam(track, m[2]!);
    if (!t) return null;
    const k = Number(m[1]);
    const v = t.falls[String(k)];
    if (v !== undefined) return v;
    return t.done && k > t.wkts ? t.runs : null;
  }
  m = name.match(/^(.+?)\s+Runs(?:\s+Open\s+Valid)?$/i);
  if (m) {
    const sn = surname(m[1]!);
    for (const t of Object.values(track.teams))
      for (const [pn, p] of Object.entries(t.players)) if (surname(pn) === sn && p.out) return p.runs;
    return null;
  }
  return null;
}

/** Fancy bet labels carry the line: "<market> @152 Yes". */
export function parseFancyLabel(label: string) {
  const m = label.match(/^(.*)\s@([\d.]+)\s(Yes|No)$/i);
  if (!m) return null;
  return { market: m[1]!.trim(), line: Number(m[2]), yes: m[3]!.toLowerCase() === "yes" };
}

const exch = (n: string) => n.replace(/\s*\((W|U19|A)\)\s*/i, " $1").trim();

/**
 * Final match result from the scoreboard line ("West Indies (W) won by 50 runs",
 * "Match tied", "No result"). Team names come back in exchange form
 * ("West Indies W") so they line up with the Match Odds / Bookmaker bets.
 */
export function matchOutcome(track: ScoreTrack): { results: { label: string; won: boolean }[]; void: boolean } | null {
  const st = (track.status ?? "").trim();
  if (!st) return null;
  const names = Object.keys(track.teams);
  if (/\b(tied|no result|abandoned|called off)\b/i.test(st)) return { results: [], void: true };
  const m = st.match(/^(.+?)\s+(?:won|win|beat)\b/i);
  if (!m) return null;
  const w = m[1]!.toLowerCase();
  const win = names.find((n) => {
    const t = track.teams[n]!;
    return n.toLowerCase().startsWith(w) || w.startsWith(n.toLowerCase()) || (t.abbr && w === t.abbr.toLowerCase());
  });
  if (!win) return null;
  return { results: names.map((n) => ({ label: exch(n), won: n === win })), void: false };
}
