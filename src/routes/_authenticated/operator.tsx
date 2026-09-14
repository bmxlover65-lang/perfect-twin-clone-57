import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listCallbackLogs,
  myOpenRounds,
  mySettleBet,
  mySettleRound,
  myWhitelistAdd,
  myWhitelistRemove,
  operatorSummary,
  testWalletCall,
  updateMyCallback,
  whoAmI,
} from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/operator")({
  component: OperatorPage,
  head: () => ({
    meta: [
      { title: "Operator panel | Universal API" },
      {
        name: "description",
        content:
          "Operator panel: your API keys, IP and domain whitelist, validity, per-user bet history, rejected bets and callback URL settings.",
      },
      { property: "og:title", content: "Operator panel | Universal API" },
      {
        property: "og:description",
        content: "API key, whitelist, validity, bet ledger and callback settings for Universal API operators.",
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

import { OperatorGuide } from "@/components/dash-guide";
import { AdminKit } from "@/components/console-kit";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "access", label: "API key & whitelist" },
  { id: "users", label: "Users" },
  { id: "bets", label: "Bet history" },
  { id: "rejected", label: "Rejected bets" },
  { id: "results", label: "Declare result" },
  { id: "callback", label: "Callback URL" },
  { id: "guide", label: "Guide / Kit" },
];

type Summary = Awaited<ReturnType<typeof operatorSummary>>;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function OperatorPage() {
  const navigate = useNavigate();
  const me = useServerFn(whoAmI);
  const summaryFn = useServerFn(operatorSummary);
  const logsFn = useServerFn(listCallbackLogs);
  const walletTest = useServerFn(testWalletCall);
  const saveCallback = useServerFn(updateMyCallback);
  const wlAdd = useServerFn(myWhitelistAdd);
  const wlRemove = useServerFn(myWhitelistRemove);


  const [ops, setOps] = useState<Array<{ id: string; name: string }>>([]);
  const [sel, setSel] = useState("");
  const [sum, setSum] = useState<Summary | null>(null);
  const [cbLogs, setCbLogs] = useState<any[]>([]);
  const [balance, setBalance] = useState("—");
  const [userId, setUserId] = useState("demo-user");
  const [cbUrl, setCbUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");
  const [filterUser, setFilterUser] = useState("");
  const [newIp, setNewIp] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [testAction, setTestAction] = useState<"balance" | "debit" | "credit" | "rollback">("balance");
  const [testAmount, setTestAmount] = useState("10");


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
      const s = await summaryFn({ data: { operatorId: id, limit: 200 } });
      setSum(s);
      setCbUrl(s.operator?.callback_url ?? "");
      setCbLogs(await logsFn({ data: { operatorId: id, limit: 25 } }));
    },
    [summaryFn, logsFn],
  );

  useEffect(() => {
    void run(async () => {
      const r = await me();
      setOps(r.operators as Array<{ id: string; name: string }>);
      if (r.operators.length) setSel((r.operators[0] as { id: string }).id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sel) void run(() => load(sel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const op = sum?.operator;
  const totals = sum?.totals;
  const daysLeft = op?.plan_expires_at
    ? Math.ceil((new Date(op.plan_expires_at).getTime() - Date.now()) / 864e5)
    : null;
  const bets = (sum?.bets ?? []).filter((b: any) =>
    filterUser ? String(b.operator_user_id).toLowerCase().includes(filterUser.toLowerCase()) : true,
  );

  return (
    <DashShell
      title="Operator"
      subtitle={
        op
          ? `${op.name} · ${op.status} · valid till ${
              op.plan_expires_at ? new Date(op.plan_expires_at).toLocaleDateString() : "—"
            }${daysLeft !== null ? ` (${daysLeft} days left)` : ""}`
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
      {err ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{err}</p>
      ) : null}
      {note ? <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">{note}</p> : null}

      {!sel ? (
        <Panel title="No operator">
          <p className="text-sm text-muted-foreground">
            Aapka login abhi kisi operator se linked nahi hai. Admin se apna operator link karwa lein.
          </p>
        </Panel>
      ) : null}

      {sel && sum ? (
        <>
          {tab === "overview" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total bets" value={String(totals?.count ?? 0)} />
                <Stat label="Staked" value={inr(totals?.staked ?? 0)} />
                <Stat label="Paid out" value={inr(totals?.payout ?? 0)} />
                <Stat label="GGR (stake − payout)" value={inr(totals?.ggr ?? 0)} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Stat label="Open bets" value={String(totals?.open ?? 0)} />
                <Stat label="Rejected bets" value={String(totals?.rejected ?? 0)} />
                <Stat
                  label="Validity"
                  value={daysLeft === null ? "—" : `${daysLeft} days left`}
                />
              </div>
              <Panel title="Account">
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>Operator: {op?.name}</li>
                  <li>Status: {op?.status}</li>
                  <li>Currency: {op?.currency}</li>
                  <li>
                    Access valid till:{" "}
                    {op?.plan_expires_at ? new Date(op.plan_expires_at).toLocaleString() : "—"}
                  </li>
                  <li>Callback URL: {op?.callback_url ?? "not configured"}</li>
                </ul>
              </Panel>
            </>
          ) : null}

          {tab === "access" ? (
            <>
              <Panel title="Your API keys">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Label</th>
                        <th className="p-2 text-left">Key prefix</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Last used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sum.keys.map((k: any) => (
                        <tr key={k.id} className="border-t border-border">
                          <td className="p-2">{k.label}</td>
                          <td className="p-2 font-mono">{k.key_prefix}…</td>
                          <td className="p-2">{k.active ? "active" : "revoked"}</td>
                          <td className="p-2">
                            {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                          </td>
                        </tr>
                      ))}
                      {!sum.keys.length ? (
                        <tr>
                          <td className="p-3 text-muted-foreground" colSpan={4}>
                            Abhi koi key issue nahi hui. Admin se key maangein.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Full key sirf issue karte waqt ek baar dikhti hai — usko apne server ke env me rakhein.
                </p>
              </Panel>

              <Panel title="Whitelisted IPs">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="203.0.113.10 (your server IP)"
                    className={`${input} max-w-[260px]`}
                  />
                  <button
                    className={btn}
                    onClick={() =>
                      run(async () => {
                        if (!newIp.trim()) return;
                        await wlAdd({ data: { operatorId: sel, kind: "ip", value: newIp.trim() } });
                        setNewIp("");
                        setNote("IP whitelist updated.");
                        await load(sel);
                      })
                    }
                  >
                    Add IP
                  </button>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {sum.ips.map((i: any) => (
                    <li key={i.id} className="flex items-center gap-2 font-mono">
                      {i.ip}
                      <button
                        className="text-destructive"
                        onClick={() =>
                          run(async () => {
                            await wlRemove({ data: { id: i.id, kind: "ip" } });
                            await load(sel);
                          })
                        }
                      >
                        remove
                      </button>
                    </li>
                  ))}
                  {!sum.ips.length ? <li>Koi IP whitelist nahi — sabhi IP allowed hain.</li> : null}
                </ul>
              </Panel>

              <Panel title="Whitelisted domains">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="yoursite.com"
                    className={`${input} max-w-[260px]`}
                  />
                  <button
                    className={btn}
                    onClick={() =>
                      run(async () => {
                        if (!newDomain.trim()) return;
                        await wlAdd({ data: { operatorId: sel, kind: "domain", value: newDomain.trim() } });
                        setNewDomain("");
                        setNote("Domain whitelist updated.");
                        await load(sel);
                      })
                    }
                  >
                    Add domain
                  </button>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {sum.domains.map((d: any) => (
                    <li key={d.id} className="flex items-center gap-2 font-mono">
                      {d.domain}
                      <button
                        className="text-destructive"
                        onClick={() =>
                          run(async () => {
                            await wlRemove({ data: { id: d.id, kind: "domain" } });
                            await load(sel);
                          })
                        }
                      >
                        remove
                      </button>
                    </li>
                  ))}
                  {!sum.domains.length ? (
                    <li>Koi domain whitelist nahi — sabhi domains allowed hain.</li>
                  ) : null}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  List khali hai to sab allowed hain. Ek bhi entry add ki to sirf wahi IP / domain kaam karenge.
                </p>
              </Panel>
            </>
          ) : null}

          {tab === "users" ? (
            <Panel title="Per-user activity">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">User ID</th>
                      <th className="p-2 text-right">Bets</th>
                      <th className="p-2 text-right">Open</th>
                      <th className="p-2 text-right">Rejected</th>
                      <th className="p-2 text-right">Staked</th>
                      <th className="p-2 text-right">Payout</th>
                      <th className="p-2 text-right">GGR</th>
                      <th className="p-2 text-left">Last bet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sum.users.map((u) => (
                      <tr key={u.userId} className="border-t border-border">
                        <td className="p-2 font-mono">{u.userId}</td>
                        <td className="p-2 text-right">{u.bets}</td>
                        <td className="p-2 text-right">{u.open}</td>
                        <td className="p-2 text-right">{u.rejected}</td>
                        <td className="p-2 text-right">{inr(u.staked)}</td>
                        <td className="p-2 text-right">{inr(u.payout)}</td>
                        <td className="p-2 text-right">{inr(u.staked - u.payout)}</td>
                        <td className="p-2">{u.last ? new Date(u.last).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                    {!sum.users.length ? (
                      <tr>
                        <td className="p-3 text-muted-foreground" colSpan={8}>
                          Abhi koi user activity nahi.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {tab === "bets" ? (
            <Panel title="Bets placed">
              <input
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="filter by user id"
                className={`${input} mb-3 max-w-[240px]`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Time</th>
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
                    {bets.map((b: any) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="p-2">{new Date(b.created_at).toLocaleString()}</td>
                        <td className="p-2 font-mono">{b.operator_user_id}</td>
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
                        <td className="p-3 text-muted-foreground" colSpan={9}>
                          No bets yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {tab === "rejected" ? (
            <Panel title="Bets that did NOT go through">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">User</th>
                      <th className="p-2 text-left">Game</th>
                      <th className="p-2 text-left">Selection</th>
                      <th className="p-2 text-right">Stake</th>
                      <th className="p-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sum.rejected.map((r: any) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-2 font-mono">{r.operator_user_id ?? "—"}</td>
                        <td className="p-2">{r.game_id ?? "—"}</td>
                        <td className="p-2">{r.selection ?? "—"}</td>
                        <td className="p-2 text-right">{r.stake ? Number(r.stake).toLocaleString("en-IN") : "—"}</td>
                        <td className="p-2 text-destructive">
                          {r.code}
                          {r.message ? ` · ${r.message}` : ""}
                        </td>
                      </tr>
                    ))}
                    {!sum.rejected.length ? (
                      <tr>
                        <td className="p-3 text-muted-foreground" colSpan={6}>
                          Koi rejected bet nahi — sab bets pass hui hain.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {tab === "callback" ? (
            <>
              <Panel title="Callback URL (your wallet endpoint)">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={cbUrl}
                    onChange={(e) => setCbUrl(e.target.value)}
                    placeholder="https://yoursite.com/api/uapi-wallet"
                    className={`${input} min-w-[300px] flex-1`}
                  />
                  <button
                    className={btn}
                    onClick={() =>
                      run(async () => {
                        await saveCallback({
                          data: { operatorId: sel, callbackUrl: cbUrl.trim() || null },
                        });
                        setNote("Callback URL saved.");
                        await load(sel);
                      })
                    }
                  >
                    Save
                  </button>
                  <button
                    className={ghost}
                    onClick={() =>
                      run(async () => {
                        const r = await saveCallback({ data: { operatorId: sel, rotateSecret: true } });
                        setNewSecret(r.callbackSecret);
                        setNote("New callback secret generated — copy it now, it is shown once.");
                      })
                    }
                  >
                    Rotate secret
                  </button>
                </div>
                {newSecret ? (
                  <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
                    {newSecret}
                  </pre>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Har call `x-universal-signature` header me HMAC-SHA256 (secret se) sign hoti hai — apne server pe verify
                  karein. Actions: balance, debit, credit, rollback.
                </p>
              </Panel>

              <Panel title="Test your callback (wallet)">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="your user id"
                    className={`${input} max-w-[220px]`}
                  />
                  <select
                    className={input}
                    value={testAction}
                    onChange={(e) => setTestAction(e.target.value as typeof testAction)}
                  >
                    <option value="balance">balance</option>
                    <option value="debit">debit</option>
                    <option value="credit">credit</option>
                    <option value="rollback">rollback</option>
                  </select>
                  <input
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    placeholder="amount"
                    className={`${input} max-w-[120px]`}
                  />
                  <button
                    className={btn}
                    onClick={() =>
                      run(async () => {
                        const r = await walletTest({
                          data: {
                            operatorId: sel,
                            action: testAction,
                            userId,
                            amount: testAction === "balance" ? 0 : Number(testAmount) || 0,
                          },
                        });
                        setBalance(
                          r.ok ? `OK · balance ${r.balance ?? "—"}` : `error: ${r.message}`,
                        );
                        await load(sel);
                      })
                    }
                  >
                    Send test call
                  </button>
                  <span className="text-sm font-bold text-foreground">Result: {balance}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Yeh aapke callback URL pe signed request bhejta hai — response niche "Callback logs" me dikhega.
                </p>
              </Panel>

              <Panel title="Callback logs">
                <ul className="space-y-1 text-xs">
                  {cbLogs.map((l) => (
                    <li key={l.id} className="border-t border-border py-1.5">
                      <span className={l.ok ? "text-live-win" : "text-destructive"}>
                        {l.ok ? "OK" : "FAIL"}
                      </span>{" "}
                      {l.endpoint} · {l.status_code} · {new Date(l.created_at).toLocaleTimeString()}
                    </li>
                  ))}
                  {!cbLogs.length ? <li className="text-muted-foreground">No callbacks yet.</li> : null}
                </ul>
              </Panel>
            </>
          ) : null}

          {tab === "guide" ? (
            <>
              <OperatorGuide />
              <AdminKit role="operator" />
            </>
          ) : null}
        </>
      ) : null}
    </DashShell>
  );
}
