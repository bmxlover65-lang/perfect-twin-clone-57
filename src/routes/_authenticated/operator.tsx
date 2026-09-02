import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listWhitelist, operatorLedger } from "@/lib/operator-admin.functions";
import { listCallbackLogs, listRounds, testWalletCall, whoAmI } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/operator")({
  component: OperatorPage,
  head: () => ({
    meta: [
      { title: "Operator panel | Universal API" },
      {
        name: "description",
        content:
          "Operator panel: check your callback wallet balance, review rounds, bets, settlements and callback logs for your Universal API integration.",
      },
      { property: "og:title", content: "Operator panel | Universal API" },
      {
        property: "og:description",
        content: "Wallet checks, round history and bet ledger for Universal API operators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

import {
  DashShell,
  Panel,
  Stat,
  dashBtn as btn,
  dashGhost as ghost,
  dashInput as input,
} from "@/components/dash";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "wallet", label: "Callback wallet" },
  { id: "bets", label: "My bet history" },
  { id: "rounds", label: "Rounds" },
  { id: "keys", label: "Keys & whitelist" },
  { id: "logs", label: "Callback logs" },
];


function OperatorPage() {
  const navigate = useNavigate();
  const me = useServerFn(whoAmI);
  const wl = useServerFn(listWhitelist);
  const ledger = useServerFn(operatorLedger);
  const logs = useServerFn(listCallbackLogs);
  const rounds = useServerFn(listRounds);
  const walletTest = useServerFn(testWalletCall);

  const [ops, setOps] = useState<any[]>([]);
  const [sel, setSel] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [cbLogs, setCbLogs] = useState<any[]>([]);
  const [roundRows, setRoundRows] = useState<any[]>([]);
  const [balance, setBalance] = useState<string>("—");
  const [userId, setUserId] = useState("demo-user");
  const [err, setErr] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const load = useCallback(
    async (id: string) => {
      setDetail(await wl({ data: { operatorId: id } }));
      setBets(await ledger({ data: { operatorId: id, limit: 60 } }));
      setCbLogs(await logs({ data: { operatorId: id, limit: 20 } }));
      setRoundRows(await rounds({ data: { limit: 20 } }));
    },
    [wl, ledger, logs, rounds],
  );

  useEffect(() => {
    void run(async () => {
      const r = await me();
      setOps(r.operators);
      if (r.operators.length) setSel(r.operators[0]!.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sel) void run(() => load(sel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const op = ops.find((o) => o.id === sel);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const staked = bets.reduce((s, b) => s + Number(b.stake), 0);
  const paid = bets.reduce((s, b) => s + Number(b.payout), 0);

  return (
    <DashShell
      title="Operator"
      subtitle={
        op
          ? `${op.name} · ${op.status} · plan till ${op.plan_expires_at ? new Date(op.plan_expires_at).toLocaleDateString() : "—"}`
          : "No operator linked to this login yet."
      }
      accent="#0F7A5A"
      tabs={TABS}
      active={tab}
      onSelect={setTab}
      actions={
        <>
          {ops.length > 1 ? (
            <select className={input} value={sel} onChange={(e) => setSel(e.target.value)}>
              {ops.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
          <button className={ghost} onClick={() => sel && run(() => load(sel))}>
            Refresh
          </button>
          <button className={ghost} onClick={signOut}>
            Sign out
          </button>
        </>
      }
    >
      {err ? <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{err}</p> : null}

      {sel ? (
        <>
          {tab === "overview" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Staked" value={`₹${staked.toLocaleString("en-IN")}`} />
              <Stat label="Paid out" value={`₹${paid.toLocaleString("en-IN")}`} />
              <Stat label="Net P/L" value={`₹${(staked - paid).toLocaleString("en-IN")}`} />
            </div>
          ) : null}

          {tab === "wallet" ? (
          <Panel title="Callback wallet">

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="your user id"
                className={`${input} max-w-[220px]`}
              />
              <button
                className={btn}
                onClick={() =>
                  run(async () => {
                    const r = await walletTest({
                      data: { operatorId: sel, action: "balance", userId, amount: 0 },
                    });
                    setBalance(r.ok ? String(r.balance ?? "—") : `error: ${r.message}`);
                    await load(sel);
                  })
                }
              >
                Fetch balance
              </button>
              <span className="text-sm font-bold text-foreground">Balance: {balance}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Callback URL: {op?.callback_url ?? "not configured"} · every call is HMAC-signed with your
              callback secret and logged below.
            </p>
          </Panel>
          ) : null}

          {tab === "rounds" ? (
          <Panel title="Rounds">
            <ul className="space-y-1 text-xs text-muted-foreground">
              {roundRows.map((r) => (
                <li key={r.id}>
                  {r.game_id} · {r.round_id} · {r.status} · {r.manual ? "manual" : "live"} ·{" "}
                  {JSON.stringify(r.result)}
                </li>
              ))}
              {!roundRows.length ? <li>No rounds settled yet.</li> : null}
            </ul>
          </Panel>
          ) : null}

          {tab === "bets" ? (


          <Panel title="Bets">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Game</th>
                    <th className="p-2 text-left">Round</th>
                    <th className="p-2 text-left">Selection</th>
                    <th className="p-2 text-right">Odds</th>
                    <th className="p-2 text-right">Stake</th>
                    <th className="p-2 text-right">Payout</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-2">{b.operator_user_id}</td>
                      <td className="p-2">{b.game_id}</td>
                      <td className="p-2">{b.round_id}</td>
                      <td className="p-2">{b.selection}</td>
                      <td className="p-2 text-right">{Number(b.odds).toFixed(2)}</td>
                      <td className="p-2 text-right">{Number(b.stake).toLocaleString("en-IN")}</td>
                      <td className="p-2 text-right">{Number(b.payout).toLocaleString("en-IN")}</td>
                      <td className="p-2">{b.status}</td>
                    </tr>
                  ))}
                  {!bets.length ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={8}>
                        No bets yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Whitelists & keys">
            <p className="text-xs text-muted-foreground">
              IPs: {(detail?.ips ?? []).map((i: any) => i.ip).join(", ") || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Domains: {(detail?.domains ?? []).map((d: any) => d.domain).join(", ") || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Keys: {(detail?.keys ?? []).map((k: any) => `${k.key_prefix}…${k.active ? "" : " (revoked)"}`).join(", ") || "—"}
            </p>
          </Panel>

          <Panel title="Callback logs">
            <ul className="space-y-1 text-xs">
              {cbLogs.map((l) => (
                <li key={l.id} className="border-t border-border py-1.5">
                  <span className={l.ok ? "text-live-win" : "text-destructive"}>{l.ok ? "OK" : "FAIL"}</span>{" "}
                  {l.endpoint} · {l.status_code} · {new Date(l.created_at).toLocaleTimeString()}
                </li>
              ))}
              {!cbLogs.length ? <li className="text-muted-foreground">No callbacks yet.</li> : null}
            </ul>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
