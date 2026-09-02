import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBalloonRounds, syncBalloonRounds } from "@/lib/balloon.functions";
import { fetchCasinoState } from "@/lib/uapi";

const EVENT_ID = "88.0023";

function crashTone(v: number | null) {
  if (v == null) return "bg-muted text-muted-foreground";
  if (v >= 10) return "bg-[#7C2BD9] text-white";
  if (v >= 2) return "bg-[#1F6B33] text-white";
  return "bg-[#8A3B1F] text-white";
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Live crash-game telemetry: current round, crash value, crash time and stored
 * history. Balloon and Aviator run on the same upstream round series.
 */
export function BalloonPanel({ heading = "Balloon" }: { heading?: string }) {
  const sync = useServerFn(syncBalloonRounds);
  const list = useServerFn(listBalloonRounds);
  const live = useQuery({
    queryKey: ["balloon-live", EVENT_ID],
    queryFn: () => fetchCasinoState(EVENT_ID),
    refetchInterval: 3000,
  });

  const rounds = useQuery({
    queryKey: ["balloon-rounds"],
    queryFn: async () => {
      try {
        return await sync({});
      } catch {
        return await list({});
      }
    },
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const data = rounds.data ?? [];
  const liveRound = live.data?.data?.roundId ? String(live.data.data.roundId) : undefined;
  const latest = data[0];
  const current = data.find((r) => r.roundId === liveRound);
  const settled = data.filter((r) => r.crash != null);
  const avg =
    settled.length > 0
      ? settled.reduce((s, r) => s + (r.crash ?? 0), 0) / settled.length
      : 0;

  return (
    <div className="space-y-3">
      <p className="text-[0.8rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {heading} · live feed sync
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Live round
          </p>
          <p className="mt-1 text-[1.05rem] font-extrabold text-foreground">
            {liveRound ?? latest?.roundId ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Crash multiplier
          </p>
          <p className="mt-1 text-[1.3rem] font-extrabold text-foreground">
            {current?.crash != null
              ? `${current.crash.toFixed(2)}x`
              : latest?.crash != null
                ? `${latest.crash.toFixed(2)}x`
                : "in flight"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Crash time
          </p>
          <p className="mt-1 text-[1.05rem] font-extrabold text-foreground">
            {fmtTime(current?.crashedAt ?? latest?.crashedAt ?? null)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Avg (stored)
          </p>
          <p className="mt-1 text-[1.05rem] font-extrabold text-foreground">
            {avg ? `${avg.toFixed(2)}x` : "—"} · {data.length} rounds
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-[0.85rem] font-bold text-foreground">Recent crashes</p>
        <div className="flex flex-wrap gap-1.5">
          {settled.slice(0, 30).map((r) => (
            <span
              key={r.roundId}
              title={`Round ${r.roundId} · ${fmtTime(r.crashedAt)}`}
              className={`rounded-full px-2 py-1 text-[0.72rem] font-extrabold ${crashTone(r.crash)}`}
            >
              {r.crash?.toFixed(2)}x
            </span>
          ))}
          {settled.length === 0 ? (
            <p className="text-[0.78rem] text-muted-foreground">No stored rounds yet.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-[0.85rem] font-bold text-foreground">Round history (stored)</p>
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-left text-[0.78rem]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1">Round ID</th>
                <th className="py-1">Crash</th>
                <th className="py-1">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.roundId} className="border-t border-border/60">
                  <td className="py-1 font-mono text-foreground">{r.roundId}</td>
                  <td className="py-1 font-bold text-foreground">
                    {r.crash != null ? `${r.crash.toFixed(2)}x` : "—"}
                  </td>
                  <td className="py-1 text-muted-foreground">{fmtTime(r.crashedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 ? (
            <p className="text-[0.78rem] text-muted-foreground">Waiting for the feed…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
