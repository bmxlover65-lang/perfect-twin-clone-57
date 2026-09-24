/**
 * Server-side sports settlement — runs on a schedule, so bets settle even
 * when nobody has the match page open. Uses the same sources as the page:
 * feed WINNER/LOSER frames, cricket scoreboard result line, soccer/tennis
 * final score, and the race WIN-market last prices (~1.01 = winner).
 */
import { settleOperatorBet, splitSide } from "./operator-settle.server";

const FS_URL =
  "https://firestore.googleapis.com/v1/projects/universe-score/databases/(default)/documents:runQuery?key=AIzaSyBjh-y7heT8kshYPCpKu403q9UzaCKf26U";

type FsVal = { stringValue?: string; integerValue?: string; arrayValue?: { values?: FsVal[] }; mapValue?: { fields?: Record<string, FsVal> } };
const plain = (v: FsVal | undefined): unknown => {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(plain);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]));
  return undefined;
};

type ScoreDoc = {
  statusCommentry?: string;
  scoreItems?: { teamName: string; scoreData: { iconName: string; value: string }[] }[];
};

async function scoreDoc(coll: string, eventId: string): Promise<ScoreDoc | null> {
  const res = await fetch(FS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: coll }],
        where: { fieldFilter: { field: { fieldPath: "eventId" }, op: "EQUAL", value: { stringValue: eventId } } },
      },
    }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => [])) as { document?: { fields?: Record<string, FsVal> } }[];
  const doc = rows.find((r) => r.document)?.document;
  if (!doc) return null;
  const f = plain({ mapValue: { fields: doc.fields ?? {} } }) as { slider?: { slider: number; score?: ScoreDoc }[] };
  return f.slider?.find((s) => Number(s.slider) === 1)?.score ?? null;
}

const clean = (s: string) => s.replace(/[{}]/g, "").replace(/\s*\((W|U19|A)\)\s*/i, " $1").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const same = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x));
};

/** Event ids start with the sport id followed by "002026…". */
function sportOf(eventId: string): string | null {
  for (const s of ["4339", "7", "4", "2", "1"]) if (eventId.startsWith(`${s}00`)) return s;
  return null;
}

type Result = { label: string; won: boolean };
type State = { prices?: Record<string, number>; sides?: { name: string; v: number }[]; results?: Result[]; voidAll?: boolean };

type OddsMarket = {
  marketName?: string;
  runnersData?: Record<string, string> | null;
  oddsData?: { status?: string; runners?: { selectionId: string | number; status?: string; price?: { back?: { price: number }[] } }[] };
};
type Odds = { matchOdds?: OddsMarket[]; bookmakers?: OddsMarket[]; fancy?: OddsMarket[]; sportsbook?: OddsMarket[]; error?: string };

export async function autoSettleSports(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: bets } = await supabaseAdmin
    .from("bets")
    .select("id, operator_id, game_id, selection, odds, created_at")
    .like("game_id", "sports-%")
    .eq("status", "open")
    .limit(2000);
  const byEvent = new Map<string, NonNullable<typeof bets>>();
  for (const b of bets ?? []) {
    const ev = b.game_id.slice(7);
    byEvent.set(ev, [...(byEvent.get(ev) ?? []), b]);
  }

  const summary: { eventId: string; settled: number; closed: boolean }[] = [];
  for (const [eventId, list] of byEvent) {
    const sportId = sportOf(eventId);
    if (!sportId) continue;
    const { data: row } = await supabaseAdmin.from("sports_watch").select("*").eq("event_id", eventId).maybeSingle();
    const state: State = (row?.state as State) ?? {};

    // 1) Live feed
    const odds = (await fetch(`${origin}/api/public/uapi/sports/${sportId}/${eventId}/odds`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch(() => null)) as Odds | null;
    const markets = [...(odds?.matchOdds ?? []), ...(odds?.bookmakers ?? []), ...(odds?.fancy ?? []), ...(odds?.sportsbook ?? [])];
    const feedResults: Result[] = [];
    for (const m of markets) {
      const names = m.runnersData ?? {};
      for (const r of m.oddsData?.runners ?? []) {
        const st = String(r.status ?? "").toUpperCase();
        if (st === "WINNER" || st === "LOSER") feedResults.push({ label: names[String(r.selectionId)] ?? String(r.selectionId), won: st === "WINNER" });
      }
    }
    const main = odds?.matchOdds?.[0];
    const mainOpen = !!main && !/CLOSE|SETTLE|REMOVED/i.test(String(main.oddsData?.status ?? ""));
    if ((sportId === "7" || sportId === "4339") && mainOpen) {
      const names = main!.runnersData ?? {};
      const prices: Record<string, number> = {};
      for (const r of main!.oddsData?.runners ?? []) {
        const p = Number(r.price?.back?.[0]?.price ?? 0);
        if (p > 0) prices[names[String(r.selectionId)] ?? String(r.selectionId)] = p;
      }
      if (Object.keys(prices).length) state.prices = prices;
    }

    // 2) Scoreboard
    if (sportId === "4") {
      const sc = await scoreDoc("cricketScore", eventId);
      const st = (sc?.statusCommentry ?? "").trim();
      const teams = (sc?.scoreItems ?? []).map((i) => i.teamName);
      if (/\b(tied|no result|abandoned|called off)\b/i.test(st)) state.voidAll = true;
      const m = st.match(/^(.+?)\s+(?:won|win|beat)\b/i);
      if (m && teams.length) {
        const win = teams.find((t) => same(t, m[1]!) || same(clean(t), m[1]!));
        if (win) state.results = teams.map((t) => ({ label: clean(t), won: t === win }));
      }
    } else if (sportId === "1" || sportId === "2") {
      const sc = await scoreDoc(sportId === "1" ? "soccerScore" : "tennisScore", eventId);
      const icon = sportId === "1" ? "goal" : "sets";
      const sides = (sc?.scoreItems ?? []).map((it) => ({
        name: clean(it.teamName),
        v: Number(it.scoreData.find((d) => d.iconName === icon)?.value ?? NaN),
      }));
      if (sides.length === 2 && sides.every((s) => Number.isFinite(s.v))) state.sides = sides;
    }

    const closed = !mainOpen;
    const goneSince = closed ? (row?.gone_since ? new Date(row.gone_since).getTime() : Date.now()) : null;
    const goneFor = goneSince ? Date.now() - goneSince : 0;

    // 3) Final results
    const results: Result[] = [...feedResults, ...(state.results ?? [])];
    if (closed && goneFor > 120_000) {
      if (state.sides && state.sides.length === 2) {
        const [a, b] = state.sides as [{ name: string; v: number }, { name: string; v: number }];
        const ok = sportId === "1" || (a.v !== b.v && Math.max(a.v, b.v) >= 2);
        if (ok) {
          results.push({ label: a.name, won: a.v > b.v }, { label: b.name, won: b.v > a.v });
          if (sportId === "1") results.push({ label: "The Draw", won: a.v === b.v });
        }
      }
      if (state.prices) {
        const low = Object.entries(state.prices).filter(([, p]) => p <= 1.1);
        if (low.length === 1) for (const n of Object.keys(state.prices)) results.push({ label: n, won: n === low[0]![0] });
      }
    }

    let settled = 0;
    for (const bet of list) {
      const isFancy = /\s@[\d.]+\s(yes|no)$/i.test(bet.selection);
      let outcome: "won" | "lost" | "void" | null = null;
      if (state.voidAll) outcome = "void";
      else if (!isFancy) {
        const { runner, side } = splitSide(bet.selection);
        const hit = results.find((r) => same(r.label, runner));
        if (hit) outcome = (side === "lay" ? !hit.won : hit.won) ? "won" : "lost";
      }
      // Nothing named a result long after close → refund, same as the page.
      const voidAfter = isFancy ? 5 * 60_000 : sportId === "4" ? 20 * 60_000 : 15 * 60_000;
      if (!outcome && closed && goneFor > voidAfter) outcome = "void";
      if (!outcome && isFancy && state.results) outcome = "void";
      if (!outcome) continue;
      try {
        await settleOperatorBet({ operatorId: bet.operator_id, betId: bet.id, outcome, multiplier: Number(bet.odds) });
        settled++;
      } catch { /* retry next run */ }
    }

    await supabaseAdmin.from("sports_watch").upsert({
      event_id: eventId,
      sport_id: sportId,
      state: state as never,
      gone_since: goneSince ? new Date(goneSince).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    summary.push({ eventId, settled, closed });
  }
  return { events: summary.length, summary };
}
