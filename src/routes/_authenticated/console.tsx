import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  addWhitelist,
  createOperator,
  issueApiKey,
  listWhitelist,
  operatorLedger,
  removeWhitelist,
  revokeApiKey,
  updateOperator,
} from "@/lib/operator-admin.functions";
import {
  assignOperatorOwner,
  bootstrapAdmin,
  listCallbackLogs,
  listRounds,
  operatorSummary,
  testWalletCall,
  whoAmI,
} from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/console")({
  component: ConsolePage,
  head: () => ({
    meta: [
      { title: "Admin console | Universal API" },
      {
        name: "description",
        content:
          "Create operators, issue API keys, and set per-key IP and domain whitelists for the Universal API.",
      },
      { property: "og:title", content: "Admin console | Universal API" },
      {
        property: "og:description",
        content: "Operator, API key, whitelist, result and ledger management for Universal API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Operator = {
  id: string;
  name: string;
  status: string;
  currency: string;
  callback_url: string | null;
  plan_amount: number;
  plan_expires_at: string | null;
  owner_id: string | null;
};

import {
  DashShell,
  Panel,
  Stat,
  dashBtn as btn,
  dashGhost as ghost,
  dashInput as input,
} from "@/components/dash";

import { AdminGuide } from "@/components/dash-guide";
import { GameControl } from "@/components/game-control";
import { BalloonPanel } from "@/components/BalloonPanel";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "operators", label: "Operators" },
  { id: "keys", label: "API keys & access" },
  { id: "gamecontrol", label: "Game control" },
  { id: "balloon", label: "Balloon rounds" },
  { id: "aviator", label: "Aviator rounds" },
  { id: "wallet", label: "Callback wallet" },
  { id: "bets", label: "Bet history" },
  { id: "users", label: "Users & GGR" },
  { id: "rejected", label: "Rejected bets" },
  { id: "guide", label: "Guide / Kit" },
];


function ConsolePage() {
  const navigate = useNavigate();
  const me = useServerFn(whoAmI);
  const claim = useServerFn(bootstrapAdmin);
  const create = useServerFn(createOperator);
  const update = useServerFn(updateOperator);
  const issue = useServerFn(issueApiKey);
  const revoke = useServerFn(revokeApiKey);
  const addWl = useServerFn(addWhitelist);
  const rmWl = useServerFn(removeWhitelist);
  const wl = useServerFn(listWhitelist);
  const ledger = useServerFn(operatorLedger);
  const logs = useServerFn(listCallbackLogs);
  const rounds = useServerFn(listRounds);
  const walletTest = useServerFn(testWalletCall);
  const assign = useServerFn(assignOperatorOwner);
  const summaryFn = useServerFn(operatorSummary);

  const [info, setInfo] = useState<{ isAdmin: boolean; email: string } | null>(null);
  const [ops, setOps] = useState<Operator[]>([]);
  const [sel, setSel] = useState<string>("");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof listWhitelist>> | null>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [cbLogs, setCbLogs] = useState<any[]>([]);
  const [roundRows, setRoundRows] = useState<any[]>([]);
  const [note, setNote] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [tab, setTab] = useState<string>("overview");
  const [sum, setSum] = useState<Awaited<ReturnType<typeof operatorSummary>> | null>(null);


  const run = async (fn: () => Promise<void>) => {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const refresh = useCallback(async () => {
    const r = await me();
    setInfo({ isAdmin: r.isAdmin, email: r.email });
    setOps(r.operators as Operator[]);
    if (!sel && r.operators.length) setSel(r.operators[0]!.id);
  }, [me, sel]);

  useEffect(() => {
    void run(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!id) return;
      setDetail(await wl({ data: { operatorId: id } }));
      setBets(await ledger({ data: { operatorId: id, limit: 60 } }));
      setCbLogs(await logs({ data: { operatorId: id, limit: 25 } }));
      setRoundRows(await rounds({ data: { limit: 25 } }));
      setSum(await summaryFn({ data: { operatorId: id, limit: 200 } }));
    },
    [wl, ledger, logs, rounds, summaryFn],
  );

  useEffect(() => {
    if (sel) void run(() => loadDetail(sel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const staked = bets.reduce((s, b) => s + Number(b.stake), 0);
  const paid = bets.reduce((s, b) => s + Number(b.payout), 0);
  const openBets = bets.filter((b) => b.status === "open").length;

  return (
    <DashShell
      title="Admin"
      subtitle={`${info?.email ?? ""} · ${info?.isAdmin ? "administrator" : "no admin role"}`}
      accent="#123A73"
      tabs={TABS}
      active={tab}
      onSelect={setTab}
      actions={
        <>
          {info && !info.isAdmin ? (
            <button
              className={ghost}
              onClick={() => run(async () => { await claim(); setNote("Admin role granted."); await refresh(); })}
            >
              Claim admin
            </button>
          ) : null}
          <button className={ghost} onClick={() => run(refresh)}>
            Refresh
          </button>
          <button className={ghost} onClick={signOut}>
            Sign out
          </button>
        </>
      }
    >
      {err ? <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{err}</p> : null}
      {note ? <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground break-words">{note}</p> : null}

      {ops.length ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Operator</span>
          <select className={`${input} max-w-[260px]`} value={sel} onChange={(e) => setSel(e.target.value)}>
            {ops.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {tab === "overview" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Operators" value={String(ops.length)} />
            <Stat label="Staked" value={`₹${staked.toLocaleString("en-IN")}`} />
            <Stat label="Paid out" value={`₹${paid.toLocaleString("en-IN")}`} />
            <Stat label="Open bets" value={String(openBets)} />
            <Stat label="GGR (stake − payout)" value={`₹${(staked - paid).toLocaleString("en-IN")}`} />
            <Stat label="Rejected bets" value={String(sum?.totals.rejected ?? 0)} />
            <Stat
              label="Plan expiring"
              value={
                ops.filter(
                  (o) =>
                    o.plan_expires_at &&
                    new Date(o.plan_expires_at).getTime() - Date.now() < 7 * 864e5,
                ).length + " in 7d"
              }
            />
          </div>
          <Panel title="Latest rounds">
            <ul className="space-y-1 text-xs text-muted-foreground">
              {roundRows.slice(0, 10).map((r) => (
                <li key={r.id}>
                  {r.game_id} · {r.round_id} · {r.status} · {r.manual ? "manual" : "live"}
                </li>
              ))}
              {!roundRows.length ? <li>No rounds yet.</li> : null}
            </ul>
          </Panel>
        </>
      ) : null}


      {sel && tab === "users" ? (
        <Panel title="Users & GGR (selected operator)">
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
                {(sum?.users ?? []).map((u) => (
                  <tr key={u.userId} className="border-t border-border">
                    <td className="p-2 font-mono">{u.userId}</td>
                    <td className="p-2 text-right">{u.bets}</td>
                    <td className="p-2 text-right">{u.open}</td>
                    <td className="p-2 text-right">{u.rejected}</td>
                    <td className="p-2 text-right">{Math.round(u.staked).toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right">{Math.round(u.payout).toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right">
                      {Math.round(u.staked - u.payout).toLocaleString("en-IN")}
                    </td>
                    <td className="p-2">{u.last ? new Date(u.last).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {!(sum?.users ?? []).length ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={8}>
                      No user activity yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {sel && tab === "rejected" ? (
        <Panel title="Bets that did not go through">
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
                {(sum?.rejected ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2 font-mono">{r.operator_user_id ?? "—"}</td>
                    <td className="p-2">{r.game_id ?? "—"}</td>
                    <td className="p-2">{r.selection ?? "—"}</td>
                    <td className="p-2 text-right">
                      {r.stake ? Number(r.stake).toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="p-2 text-destructive">
                      {r.code}
                      {r.message ? ` · ${r.message}` : ""}
                    </td>
                  </tr>
                ))}
                {!(sum?.rejected ?? []).length ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={6}>
                      No rejected bets.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {tab === "operators" ? (
      <Panel title="Operators">

        <form
          className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const f = new FormData(form);
            void run(async () => {
              const res = await provision({
                data: {
                  name: String(f.get("name")),
                  email: String(f.get("email")).trim(),
                  password: String(f.get("password")),
                  callbackUrl: String(f.get("cb") || "") || undefined,
                  days: 30,
                },
              });
              form.reset();
              setCred(res);
              setNote("");
              await refresh();
              setSel(res.operator.id);
            });
          }}
        >
          <div className="sm:col-span-2 text-xs font-semibold text-muted-foreground">
            New operator — login, 30-day validity aur API key ek saath ban jayenge.
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Operator name
            <input name="name" required placeholder="Acme Gaming" className={input} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Login email
            <input name="email" type="email" required placeholder="operator@site.com" className={input} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Password (min 6)
            <div className="flex gap-2">
              <input
                name="password"
                required
                minLength={6}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Password"
                className={input}
              />
              <button
                type="button"
                className={ghost}
                onClick={() => setPwd(Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase())}
              >
                Generate
              </button>
            </div>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Callback URL (optional)
            <input name="cb" placeholder="https://site.com/api/wallet" className={input} />
          </label>
          <div className="sm:col-span-2">
            <button className={btn}>Create operator + API key</button>
          </div>
        </form>

        {cred ? (
          <div className="mt-3 space-y-1 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
            <p className="text-sm font-bold text-foreground">
              {cred.operator.name} ready — ye details ek hi baar dikhengi
            </p>
            <p>
              <span className="text-muted-foreground">Login:</span>{" "}
              <span className="font-mono">{cred.email}</span> /{" "}
              <span className="font-mono">{cred.password}</span>
            </p>
            <p className="break-all">
              <span className="text-muted-foreground">API key:</span>{" "}
              <span className="font-mono">{cred.apiKey}</span>
            </p>
            <p className="break-all">
              <span className="text-muted-foreground">Callback secret:</span>{" "}
              <span className="font-mono">{cred.callbackSecret}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Valid till:</span>{" "}
              {new Date(cred.expiresAt).toLocaleDateString()}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className={ghost}
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `Operator: ${cred.operator.name}\nLogin: ${cred.email}\nPassword: ${cred.password}\nAPI key: ${cred.apiKey}\nCallback secret: ${cred.callbackSecret}`,
                  )
                }
              >
                Copy all
              </button>
              <button type="button" className={ghost} onClick={() => setCred(null)}>
                Hide
              </button>
            </div>
          </div>
        ) : null}


        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Plan</th>
                <th className="p-2 text-left">Expires</th>
                <th className="p-2 text-left">Callback</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {ops.map((o) => (
                <tr
                  key={o.id}
                  className={`border-t border-border ${sel === o.id ? "bg-muted/50" : ""}`}
                >
                  <td className="p-2 font-semibold text-foreground">{o.name}</td>
                  <td className="p-2">{o.status}</td>
                  <td className="p-2">₹{Number(o.plan_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2">
                    {o.plan_expires_at ? new Date(o.plan_expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="max-w-[220px] truncate p-2">{o.callback_url ?? "—"}</td>
                  <td className="space-x-1 p-2 text-right">
                    <button className={ghost} onClick={() => setSel(o.id)}>
                      Manage
                    </button>
                    <button
                      className={ghost}
                      onClick={() =>
                        run(async () => {
                          await update({
                            data: {
                              id: o.id,
                              status: o.status === "active" ? "suspended" : "active",
                            },
                          });
                          await refresh();
                        })
                      }
                    >
                      {o.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <button
                      className={ghost}
                      onClick={() =>
                        run(async () => {
                          await update({ data: { id: o.id, planDays: 30 } });
                          setNote("Plan extended by 30 days.");
                          await refresh();
                        })
                      }
                    >
                      +30d
                    </button>
                  </td>
                </tr>
              ))}
              {!ops.length ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={6}>
                    No operators yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
      ) : null}

      {sel ? (
        <>
          {tab === "keys" ? (
          <Panel title="API keys & access">
            <p className="text-xs text-muted-foreground">
              Har operator ko key issue karo. IP aur domain whitelist us key ke andar hi set hoti hai —
              key ke saath sirf wahi IP / domain kaam karenge. Whitelist khali chhodo to us key par koi
              restriction nahi.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget as HTMLFormElement);
                  (e.currentTarget as HTMLFormElement).reset();
                  void run(async () => {
                    const r = await issue({
                      data: { operatorId: sel, label: String(f.get("lb") || "") || "default" },
                    });
                    setNote(`New API key (shown once): ${r.apiKey}`);
                    await loadDetail(sel);
                  });
                }}
              >
                <input name="lb" placeholder="key label e.g. production" className={input} />
                <button className={btn}>Issue key</button>
              </form>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget as HTMLFormElement);
                  void run(async () => {
                    await assign({ data: { operatorId: sel, email: String(f.get("oe")) } });
                    setNote("Owner login linked.");
                    await refresh();
                  });
                }}
              >
                <input name="oe" type="email" placeholder="owner login email" className={input} />
                <button className={ghost}>Link owner</button>
              </form>
            </div>

            <div className="mt-4 space-y-3">
              {(detail?.keys ?? []).map((k: any) => {
                const ips = (detail?.ips ?? []).filter((r: any) => r.api_key_id === k.id);
                const domains = (detail?.domains ?? []).filter((r: any) => r.api_key_id === k.id);
                return (
                  <div key={k.id} className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {k.key_prefix}…{" "}
                        <span className="font-sans font-normal text-muted-foreground">
                          {k.label} · {k.active ? "active" : "revoked"} ·{" "}
                          {k.last_used_at ? `used ${new Date(k.last_used_at).toLocaleString()}` : "never used"}
                        </span>
                      </span>
                      {k.active ? (
                        <button
                          className={ghost}
                          onClick={() =>
                            run(async () => {
                              await revoke({ data: { id: k.id } });
                              await loadDetail(sel);
                            })
                          }
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(["ip", "domain"] as const).map((kind) => (
                        <div key={kind}>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            {kind === "ip" ? "IP whitelist" : "Domain whitelist"}
                          </p>
                          <form
                            className="mt-1 flex gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget as HTMLFormElement);
                              (e.currentTarget as HTMLFormElement).reset();
                              void run(async () => {
                                await addWl({
                                  data: {
                                    operatorId: sel,
                                    apiKeyId: k.id,
                                    kind,
                                    value: String(f.get("v")),
                                  },
                                });
                                await loadDetail(sel);
                              });
                            }}
                          >
                            <input
                              name="v"
                              required
                              placeholder={kind === "ip" ? "1.2.3.4" : "site.com"}
                              className={input}
                            />
                            <button className={btn}>Add</button>
                          </form>
                          <ul className="mt-1 space-y-1 text-xs">
                            {(kind === "ip" ? ips : domains).map((row: any) => (
                              <li
                                key={row.id}
                                className="flex items-center justify-between border-t border-border py-1.5"
                              >
                                <span className="text-foreground">{row.ip ?? row.domain}</span>
                                <button
                                  className={ghost}
                                  onClick={() =>
                                    run(async () => {
                                      await rmWl({ data: { id: row.id, kind } });
                                      await loadDetail(sel);
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                            {!(kind === "ip" ? ips : domains).length ? (
                              <li className="py-1.5 text-muted-foreground">
                                No restriction — sab {kind === "ip" ? "IPs" : "domains"} allowed.
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!(detail?.keys ?? []).length ? (
                <p className="text-xs text-muted-foreground">Is operator ke liye abhi koi key nahi hai.</p>
              ) : null}
            </div>
          </Panel>
          ) : null}

          {tab === "wallet" ? (
          <Panel title="Callback wallet test">

            <form
              className="grid gap-2 sm:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget as HTMLFormElement);
                void run(async () => {
                  const r = await walletTest({
                    data: {
                      operatorId: sel,
                      action: f.get("a") as "balance",
                      userId: String(f.get("u")),
                      amount: Number(f.get("amt") || 0),
                      reference: String(f.get("ref") || "") || undefined,
                    },
                  });
                  setNote(JSON.stringify(r));
                  await loadDetail(sel);
                });
              }}
            >
              <select name="a" className={input}>
                <option value="balance">balance</option>
                <option value="debit">debit</option>
                <option value="credit">credit</option>
                <option value="rollback">rollback</option>
              </select>
              <input name="u" required placeholder="operator user id" className={input} />
              <input name="amt" type="number" placeholder="amount" className={input} />
              <input name="ref" placeholder="reference" className={input} />
              <button className={btn}>Send signed call</button>
            </form>
            <ul className="mt-3 space-y-1 text-xs">
              {cbLogs.map((l) => (
                <li key={l.id} className="border-t border-border py-1.5">
                  <span className={l.ok ? "text-live-win" : "text-destructive"}>
                    {l.ok ? "OK" : "FAIL"}
                  </span>{" "}
                  {l.endpoint} · {l.status_code} · {new Date(l.created_at).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          </Panel>
          ) : null}

          {tab === "gamecontrol" ? <GameControl /> : null}

          {tab === "balloon" ? <BalloonPanel /> : null}

          {tab === "aviator" ? <BalloonPanel heading="Aviator" /> : null}

          {tab === "guide" ? <AdminGuide /> : null}

          {tab === "bets" ? (

          <Panel title="Bet ledger">

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
                        No bets through the API yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
          ) : null}
        </>
      ) : null}
    </DashShell>

  );
}
