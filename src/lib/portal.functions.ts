import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Who is signed in, is he admin, and which operators does he own. */
export const whoAmI = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: operators } = await context.supabase
      .from("operators")
      .select("*")
      .order("created_at", { ascending: false });

    // Only relevant before the very first admin exists (one-time bootstrap).
    let canClaimAdmin = false;
    if (!isAdmin) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      canClaimAdmin = (count ?? 0) === 0;
    }

    return {
      userId: context.userId,
      email: (context.claims as { email?: string } | null)?.email ?? "",
      isAdmin: Boolean(isAdmin),
      canClaimAdmin,
      operators: operators ?? [],
    };
  });

/** First signed-in user can claim the admin role once; afterwards it is closed. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Self-service admin claim is disabled; admins are granted by existing admins only.
    void context;
    throw new Error("Admin already exists");
  });

/** Attach an operator row to a login so that owner can use the operator panel. */
export const assignOperatorOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ operatorId: z.string().uuid(), email: z.string().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error: le } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (le) throw new Error(le.message);
    const user = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
    if (!user) throw new Error("No login found with that email");
    await supabaseAdmin.from("operators").update({ owner_id: user.id }).eq("id", data.operatorId);
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "operator" }, { onConflict: "user_id,role" });
    return { ok: true };
  });

/** Recent callback round-trips (admin sees all, operator sees its own via RLS). */
export const listCallbackLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ operatorId: z.string().uuid().optional(), limit: z.number().max(100).default(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("callback_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.operatorId) q = q.eq("operator_id", data.operatorId);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const listRounds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ gameId: z.string().optional(), limit: z.number().max(100).default(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("rounds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.gameId) q = q.eq("game_id", data.gameId);
    const { data: rows } = await q;
    return rows ?? [];
  });

/** Fire a signed balance/debit/credit/rollback call at the operator's own site. */
export const testWalletCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        operatorId: z.string().uuid(),
        action: z.enum(["balance", "debit", "credit", "rollback"]),
        userId: z.string().min(1).max(64),
        amount: z.number().min(0).max(1e7).default(0),
        reference: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS: only the owner (or an admin) can read this operator row.
    const { data: op, error } = await context.supabase
      .from("operators")
      .select("id, name, currency, callback_url, callback_secret, status, plan_expires_at")
      .eq("id", data.operatorId)
      .single();
    if (error || !op) throw new Error("Operator not found");

    const { walletCall } = await import("@/lib/callback-wallet.server");
    const res = await walletCall(op as never, data.action, {
      userId: data.userId,
      amount: data.amount,
      ...(data.reference ? { reference: data.reference } : {}),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("transactions").insert({
      operator_id: data.operatorId,
      operator_user_id: data.userId,
      kind: data.action,
      amount: data.amount,
      balance_after: res.ok ? res.balance : null,
      status: res.ok ? "done" : "failed",
      reference: data.reference ?? null,
    });

    return res;
  });

/** Operator self-service: set the callback URL / rotate the callback secret. */
export const updateMyCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        operatorId: z.string().uuid(),
        callbackUrl: z.string().url().max(300).nullable().optional(),
        rotateSecret: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS: only the owner or an admin can see / update this row.
    const { data: op, error } = await context.supabase
      .from("operators")
      .select("id")
      .eq("id", data.operatorId)
      .single();
    if (error || !op) throw new Error("Operator not found");

    const patch: Record<string, unknown> = {};
    if (data.callbackUrl !== undefined) patch["callback_url"] = data.callbackUrl;
    let secret: string | null = null;
    if (data.rotateSecret) {
      secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      patch["callback_secret"] = secret;
    }
    if (Object.keys(patch).length === 0) return { ok: true, callbackSecret: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: ue } = await supabaseAdmin
      .from("operators")
      .update(patch as never)
      .eq("id", data.operatorId);
    if (ue) throw new Error(ue.message);
    return { ok: true, callbackSecret: secret };
  });

/** Everything the operator panel shows: plan, keys, whitelist, per-user bet stats. */
export const operatorSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ operatorId: z.string().uuid(), limit: z.number().max(500).default(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [opRes, keysRes, ipsRes, domainsRes, betsRes, rejRes] = await Promise.all([
      context.supabase
        .from("operators")
        .select("id, name, status, currency, callback_url, plan_amount, plan_expires_at, created_at")
        .eq("id", data.operatorId)
        .single(),
      context.supabase
        .from("api_keys")
        .select("id, label, key_prefix, active, last_used_at, created_at")
        .eq("operator_id", data.operatorId)
        .order("created_at", { ascending: false }),
      context.supabase.from("ip_whitelist").select("*").eq("operator_id", data.operatorId),
      context.supabase.from("domain_whitelist").select("*").eq("operator_id", data.operatorId),
      context.supabase
        .from("bets")
        .select("*")
        .eq("operator_id", data.operatorId)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      context.supabase
        .from("bet_rejections")
        .select("*")
        .eq("operator_id", data.operatorId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const bets = (betsRes.data ?? []) as Array<Record<string, any>>;
    const rejected = (rejRes.data ?? []) as Array<Record<string, any>>;

    const users = new Map<
      string,
      { userId: string; bets: number; staked: number; payout: number; open: number; rejected: number; last: string }
    >();
    const seed = (id: string) =>
      users.get(id) ??
      users.set(id, { userId: id, bets: 0, staked: 0, payout: 0, open: 0, rejected: 0, last: "" }).get(id)!;

    for (const b of bets) {
      const u = seed(String(b['operator_user_id'] ?? "—"));
      u.bets += 1;
      u.staked += Number(b['stake'] ?? 0);
      u.payout += Number(b['payout'] ?? 0);
      if (b['status'] === "open") u.open += 1;
      if (!u.last || String(b['created_at']) > u.last) u.last = String(b['created_at']);
    }
    for (const r of rejected) {
      const u = seed(String(r['operator_user_id'] ?? "—"));
      u.rejected += 1;
    }

    const staked = bets.reduce((s, b) => s + Number(b['stake'] ?? 0), 0);
    const payout = bets.reduce((s, b) => s + Number(b['payout'] ?? 0), 0);

    return {
      operator: opRes.data,
      keys: keysRes.data ?? [],
      ips: ipsRes.data ?? [],
      domains: domainsRes.data ?? [],
      bets,
      rejected,
      users: [...users.values()].sort((a, b) => b.staked - a.staked),
      totals: {
        staked,
        payout,
        ggr: staked - payout,
        count: bets.length,
        open: bets.filter((b) => b['status'] === "open").length,
        rejected: rejected.length,
      },
    };
  });

/** Operator self-service: add own IP / domain to the whitelist. */
export const myWhitelistAdd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        operatorId: z.string().uuid(),
        kind: z.enum(["ip", "domain"]),
        value: z.string().min(3).max(120),
        apiKeyId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "ip" ? "ip_whitelist" : "domain_whitelist";
    const value =
      data.kind === "ip"
        ? data.value.trim()
        : data.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const payload = {
      operator_id: data.operatorId,
      api_key_id: data.apiKeyId ?? null,
      ...(data.kind === "ip" ? { ip: value } : { domain: value }),
    };
    const { error } = await context.supabase.from(table).insert(payload as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Operator self-service: remove one of its own whitelist entries. */
export const myWhitelistRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["ip", "domain"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "ip" ? "ip_whitelist" : "domain_whitelist";
    const { error } = await context.supabase.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Open (unsettled) rounds of this operator, grouped by game + round. */
export const myOpenRounds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ operatorId: z.string().uuid(), limit: z.number().max(500).default(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS: owner (or admin) only.
    const { data: op, error } = await context.supabase
      .from("operators")
      .select("id")
      .eq("id", data.operatorId)
      .single();
    if (error || !op) throw new Error("Operator not found");

    const { data: rows } = await context.supabase
      .from("bets")
      .select("id, game_id, round_id, operator_user_id, selection, odds, stake, created_at, status")
      .eq("operator_id", data.operatorId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    const groups = new Map<
      string,
      {
        gameId: string;
        roundId: string;
        bets: number;
        staked: number;
        users: number;
        selections: string[];
        last: string;
      }
    >();
    const seenUsers = new Map<string, Set<string>>();

    for (const b of (rows ?? []) as Array<Record<string, any>>) {
      const key = `${b['game_id']}|${b['round_id']}`;
      const g =
        groups.get(key) ??
        groups
          .set(key, {
            gameId: String(b['game_id']),
            roundId: String(b['round_id']),
            bets: 0,
            staked: 0,
            users: 0,
            selections: [],
            last: "",
          })
          .get(key)!;
      g.bets += 1;
      g.staked += Number(b['stake'] ?? 0);
      const sel = String(b['selection'] ?? "");
      if (sel && !g.selections.includes(sel)) g.selections.push(sel);
      if (!g.last || String(b['created_at']) > g.last) g.last = String(b['created_at']);
      const us = seenUsers.get(key) ?? new Set<string>();
      us.add(String(b['operator_user_id']));
      seenUsers.set(key, us);
    }
    for (const [key, g] of groups) g.users = seenUsers.get(key)?.size ?? 0;

    return {
      rounds: [...groups.values()].sort((a, b) => (a.last > b.last ? -1 : 1)),
      bets: rows ?? [],
    };
  });

/** Operator declares the result of one of its own open rounds. */
export const mySettleRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        operatorId: z.string().uuid(),
        gameId: z.string().min(1).max(80),
        roundId: z.string().min(1).max(120),
        winners: z.array(z.string().min(1).max(80)).default([]),
        voidRound: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: op, error } = await context.supabase
      .from("operators")
      .select("id")
      .eq("id", data.operatorId)
      .single();
    if (error || !op) throw new Error("Operator not found");
    if (!data.voidRound && data.winners.length === 0) throw new Error("Pick at least one winning selection");

    const { settleOperatorRound } = await import("@/lib/operator-settle.server");
    return settleOperatorRound({
      operatorId: data.operatorId,
      gameId: data.gameId,
      roundId: data.roundId,
      winners: data.winners,
      voidRound: data.voidRound,
    });
  });

/** Operator settles a single open bet (won / lost / void). */
export const mySettleBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        operatorId: z.string().uuid(),
        betId: z.string().uuid(),
        outcome: z.enum(["won", "lost", "void"]),
        multiplier: z.number().min(0).max(10_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: op, error } = await context.supabase
      .from("operators")
      .select("id")
      .eq("id", data.operatorId)
      .single();
    if (error || !op) throw new Error("Operator not found");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) {
      const { data: owned } = await context.supabase
        .from("operators").select("id").eq("id", data.operatorId).eq("owner_id", context.userId).maybeSingle();
      if (!owned) throw new Error("Forbidden");
    }

    const { settleOperatorBet } = await import("@/lib/operator-settle.server");
    return settleOperatorBet({
      operatorId: data.operatorId,
      betId: data.betId,
      outcome: data.outcome,
      ...(data.multiplier !== undefined ? { multiplier: data.multiplier } : {}),
    });
  });

/** Sports bets report for one operator: totals + recent settled/open bets. */
export const mySportsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("bets")
      .select("id, game_id, round_id, operator_user_id, selection, odds, stake, payout, status, created_at, settled_at")
      .eq("operator_id", data.operatorId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const sports = (rows ?? []).filter((b) => !/^\d+\.\d/.test(String(b.game_id).trim()));
    const t = { bets: 0, open: 0, won: 0, lost: 0, void: 0, staked: 0, paid: 0, openStake: 0 };
    for (const b of sports) {
      t.bets++;
      const st = String(b.status) as "open" | "won" | "lost" | "void";
      if (st in t) (t as any)[st]++;
      if (st === "open") t.openStake += Number(b.stake);
      else if (st !== "void") {
        t.staked += Number(b.stake);
        t.paid += Number(b.payout);
      }
    }
    return { totals: { ...t, ggr: t.staked - t.paid }, recent: sports.slice(0, 50) };
  });
