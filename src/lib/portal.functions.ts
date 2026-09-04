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
    return {
      userId: context.userId,
      email: (context.claims as { email?: string } | null)?.email ?? "",
      isAdmin: Boolean(isAdmin),
      operators: operators ?? [],
    };
  });

/** First signed-in user can claim the admin role once; afterwards it is closed. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Admin already exists");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
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
