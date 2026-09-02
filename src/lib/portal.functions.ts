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
