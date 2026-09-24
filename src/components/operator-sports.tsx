import { useCallback, useEffect, useMemo, useState } from "react";

import { Panel, dashBtn as btn, dashGhost as ghost, dashInput as input } from "@/components/dash";
import { fetchEvents, fetchSports, type Sport, type UEvent } from "@/lib/uapi";
import { AppLoader } from "@/components/AppLoader";
import { useServerFn } from "@tanstack/react-start";
import { mySportsReport } from "@/lib/portal.functions";

/** "India Back" → { runner: "India", side: "Back" } (exchange bet labels). */
const splitSide = (sel: string) => {
  const m = String(sel).trim().match(/^(.*?)\s+(back|lay|yes|no)$/i);
  return m ? { runner: m[1]!.trim(), side: m[2]! } : { runner: String(sel).trim(), side: "Back" };
};
const isLaySide = (side: string) => /^(lay|no)$/i.test(side);

const FALLBACK_SPORTS: Sport[] = [
  { sportId: "4", sportName: "Cricket" },
  { sportId: "1", sportName: "Soccer" },
  { sportId: "2", sportName: "Tennis" },
  { sportId: "7", sportName: "Horse Racing" },
  { sportId: "4339", sportName: "Greyhound Racing" },
];

const SITE = "https://universalapi.store";
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Casino ids look like 88.0023 — everything else is a sports market. */
export const isSportsGameId = (gameId: string) => !/^\d+\.\d/.test(String(gameId).trim());

type Props = {
  operatorId: string;
  rounds: any[];
  bets: any[];
  onSettleRound: (args: {
    gameId: string;
    roundId: string;
    winners: string[];
    voidRound: boolean;
  }) => Promise<void> | void;
  onSettleBet: (betId: string, outcome: "won" | "lost" | "void") => Promise<void> | void;
};

export function OperatorSports({ operatorId, rounds, bets, onSettleRound, onSettleBet }: Props) {
  const [sports, setSports] = useState<Sport[]>(FALLBACK_SPORTS);
  const [sportId, setSportId] = useState("4");
  const [events, setEvents] = useState<UEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedErr, setFeedErr] = useState("");
  const [q, setQ] = useState("");
  const [winners, setWinners] = useState<Record<string, string[]>>({});
  const [manual, setManual] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const reportFn = useServerFn(mySportsReport);
  const [report, setReport] = useState<Awaited<ReturnType<typeof mySportsReport>> | null>(null);

  useEffect(() => {
    if (!operatorId) return;
    void reportFn({ data: { operatorId } }).then(setReport).catch(() => setReport(null));
  }, [operatorId, rounds, bets, reportFn]);

  useEffect(() => {
    let alive = true;
    void fetchSports()
      .then((r) => {
        if (alive && r.sports?.length) setSports(r.sports);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const loadEvents = useCallback(async (id: string) => {
    setLoading(true);
    setFeedErr("");
    try {
      const r = await fetchEvents(id);
      setEvents((r.events ?? []) as UEvent[]);
    } catch (e) {
      setEvents([]);
      setFeedErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents(sportId);
  }, [sportId, loadEvents]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t
      ? events.filter((e: any) =>
          `${e.eventName ?? ""} ${e.competitionName ?? ""} ${e.exEventId ?? ""}`.toLowerCase().includes(t),
        )
      : events;
    return list.slice(0, 60);
  }, [events, q]);

  const sportsRounds = useMemo(() => rounds.filter((r: any) => isSportsGameId(r.gameId)), [rounds]);
  const sportsBets = useMemo(() => bets.filter((b: any) => isSportsGameId(b.game_id)), [bets]);

  const copy = (text: string, id: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(""), 1500);
  };

  return (
    <>
      <Panel title="Sports control — live events">
        <p className="mb-3 text-xs text-muted-foreground">
          Apne sports section ka control yahin se. Sport choose karein, event ka launch / embed link copy karke
          apni site par lagayein, aur niche se sports bets ka result khud declare karein.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sportId} onChange={(e) => setSportId(e.target.value)} className={input}>
            {sports.map((s) => (
              <option key={s.sportId} value={s.sportId}>
                {s.sportName}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search event / team"
            className={`${input} min-w-[220px] flex-1`}
          />
          <button className={ghost} onClick={() => void loadEvents(sportId)}>
            Refresh
          </button>
        </div>
        {feedErr ? <p className="mt-2 text-xs text-destructive">{feedErr}</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Event</th>
                <th className="p-2 text-left">Event id</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Links</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e: any) => {
                const eid = String(e.exEventId ?? e.eventId ?? "");
                const open = `${SITE}/sports/${sportId}/${eid}`;
                const embed = `${open}?embed=1`;
                return (
                  <tr key={eid} className="border-t border-border">
                    <td className="p-2">
                      <div className="font-semibold text-foreground">{e.eventName ?? "—"}</div>
                      <div className="text-muted-foreground">{e.competitionName ?? ""}</div>
                    </td>
                    <td className="p-2 font-mono">{eid}</td>
                    <td className="p-2">
                      {e.inPlay ? (
                        <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">LIVE</span>
                      ) : (
                        <span className="text-muted-foreground">Pre-match</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        <a className={ghost} href={open} target="_blank" rel="noreferrer">
                          Open
                        </a>
                        <button className={ghost} onClick={() => copy(embed, `e${eid}`)}>
                          {copied === `e${eid}` ? "Copied" : "Copy embed link"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!shown.length ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={4}>
                    {loading ? <AppLoader compact /> : "Koi event nahi mila."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Sports result — khud declare karein">
        {!sportsRounds.length ? (
          <p className="text-sm text-muted-foreground">Koi unsettled sports round nahi hai.</p>
        ) : null}
        <div className="space-y-3">
          {sportsRounds.map((r: any) => {
            const key = `${r.gameId}|${r.roundId}`;
            const picked = winners[key] ?? [];
            const toggle = (s: string) =>
              setWinners((w) => ({
                ...w,
                [key]: (w[key] ?? []).includes(s)
                  ? (w[key] ?? []).filter((x) => x !== s)
                  : [...(w[key] ?? []), s],
              }));
            const declare = async (voidRound: boolean) => {
              const extra = (manual[key] ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const list = [...new Set([...picked, ...extra])];
              if (!voidRound && !list.length) return;
              await onSettleRound({ gameId: r.gameId, roundId: r.roundId, winners: list, voidRound });
            };
            return (
              <div key={key} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-foreground">
                    {r.gameId} · round {r.roundId}
                  </span>
                  <span className="text-muted-foreground">
                    {r.bets} bets · {r.users} users · staked {inr(r.staked)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([...new Set(r.selections.map((x: string) => splitSide(x).runner))] as string[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => toggle(s)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        picked.includes(s)
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Jeetne wala select karein: uspar Back/Yes bets jeetengi, Lay/No bets haarengi. Baaki sab par
                  Back haarega aur Lay jeetega.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={manual[key] ?? ""}
                    onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))}
                    placeholder="extra winners (comma separated)"
                    className={`${input} max-w-[260px]`}
                  />
                  <button className={btn} onClick={() => void declare(false)}>
                    Declare result
                  </button>
                  <button className={ghost} onClick={() => void declare(true)}>
                    Void round (refund)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Open sports bets — ek-ek settle">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Event / round</th>
                <th className="p-2 text-left">Selection</th>
                <th className="p-2 text-right">Odds</th>
                <th className="p-2 text-right">Stake</th>
                <th className="p-2 text-left">Settle</th>
              </tr>
            </thead>
            <tbody>
              {sportsBets.map((b: any) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="p-2">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono">{b.operator_user_id}</td>
                  <td className="p-2">
                    {b.game_id} / {b.round_id}
                  </td>
                  <td className="p-2">
                    {splitSide(b.selection).runner}{" "}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isLaySide(splitSide(b.selection).side)
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {splitSide(b.selection).side.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 text-right">{Number(b.odds).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(b.stake).toLocaleString("en-IN")}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      {(["won", "lost", "void"] as const).map((o) => (
                        <button key={o} className={ghost} onClick={() => void onSettleBet(b.id, o)}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!sportsBets.length ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={7}>
                    Koi open sports bet nahi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Sports report — bets, jeet-haar, payout">
        {report ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                ["Total bets", String(report.totals.bets)],
                ["Open", `${report.totals.open} · ${inr(report.totals.openStake)}`],
                ["Won / Lost / Void", `${report.totals.won} / ${report.totals.lost} / ${report.totals.void}`],
                ["Settled stake", inr(report.totals.staked)],
                ["Paid to players", inr(report.totals.paid)],
                ["Profit / Loss (GGR)", inr(report.totals.ggr)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border p-2">
                  <div className="text-muted-foreground">{k}</div>
                  <div className="font-bold text-foreground">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Time</th>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Event</th>
                    <th className="p-2 text-left">Selection</th>
                    <th className="p-2 text-right">Stake</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-right">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recent.map((b: any) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-2">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="p-2 font-mono">{b.operator_user_id}</td>
                      <td className="p-2 font-mono">{b.round_id}</td>
                      <td className="p-2">{b.selection}</td>
                      <td className="p-2 text-right">{inr(Number(b.stake))}</td>
                      <td className="p-2 uppercase">{b.status}</td>
                      <td className="p-2 text-right">{inr(Number(b.payout))}</td>
                    </tr>
                  ))}
                  {!report.recent.length ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={7}>
                        Abhi tak koi sports bet nahi.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <AppLoader compact />
        )}
      </Panel>

      <Panel title="Sports API (apne server se)">
        <pre className="overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{`GET  ${SITE}/api/public/v1/sports                        → sports list
GET  ${SITE}/api/public/v1/sports/{sportId}/events       → events
GET  ${SITE}/api/public/v1/sports/{sportId}/{eventId}/odds
GET  ${SITE}/api/public/v1/sports/{sportId}/{eventId}?embed=1  → embed url
POST ${SITE}/api/public/v1/result  { "gameId": "{eventId}", "roundId": "...", "winners": ["Team A"] }
headers: x-api-key: <your key>   (key me Sports product enabled hona chahiye)

operator: ${operatorId || "—"}`}</pre>
      </Panel>
    </>
  );
}
