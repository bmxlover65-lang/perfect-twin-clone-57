import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const listOperators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("operators")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(80),
        contactEmail: z.string().email().optional(),
        callbackUrl: z.string().url().optional(),
        planAmount: z.number().min(0).default(0),
        planDays: z.number().min(1).max(3650).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const callbackSecret = crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(Date.now() + data.planDays * 864e5).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("operators")
      .insert({
        name: data.name,
        contact_email: data.contactEmail ?? null,
        callback_url: data.callbackUrl ?? null,
        callback_secret: callbackSecret,
        plan_amount: data.planAmount,
        plan_expires_at: expires,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { operator: row, callbackSecret };
  });

export const updateOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        callbackUrl: z.string().url().nullable().optional(),
        status: z.enum(["active", "suspended"]).optional(),
        planDays: z.number().min(0).max(3650).optional(),
        planAmount: z.number().min(0).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.callbackUrl !== undefined) patch['callback_url'] = data.callbackUrl;
    if (data.status) patch['status'] = data.status;
    if (data.planAmount !== undefined) patch['plan_amount'] = data.planAmount;
    if (data.planDays) patch['plan_expires_at'] = new Date(Date.now() + data.planDays * 864e5).toISOString();
    const { error } = await supabaseAdmin.from("operators").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Issues a key; the plaintext is returned exactly once. */
export const issueApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ operatorId: z.string().uuid(), label: z.string().max(40).default("default") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashKey } = await import("@/lib/operator-auth.server");
    const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const prefix = `ua_${secret.slice(0, 6)}`;
    const key = `${prefix}_${secret.slice(6)}`;
    const { error } = await supabaseAdmin.from("api_keys").insert({
      operator_id: data.operatorId,
      label: data.label,
      key_prefix: prefix,
      key_hash: hashKey(key),
    });
    if (error) throw new Error(error.message);
    return { apiKey: key, prefix };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("api_keys").update({ active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addWhitelist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        operatorId: z.string().uuid(),
        kind: z.enum(["ip", "domain"]),
        value: z.string().min(3).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "ip" ? "ip_whitelist" : "domain_whitelist";
    const payload =
      data.kind === "ip"
        ? { operator_id: data.operatorId, ip: data.value.trim() }
        : { operator_id: data.operatorId, domain: data.value.trim().toLowerCase().replace(/^www\./, "") };
    const { error } = await context.supabase.from(table).insert(payload as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWhitelist = createServerFn({ method: "POST" })
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

export const listWhitelist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [ips, domains, keys] = await Promise.all([
      context.supabase.from("ip_whitelist").select("*").eq("operator_id", data.operatorId),
      context.supabase.from("domain_whitelist").select("*").eq("operator_id", data.operatorId),
      context.supabase.from("api_keys").select("id, label, key_prefix, active, last_used_at, created_at").eq("operator_id", data.operatorId),
    ]);
    return { ips: ips.data ?? [], domains: domains.data ?? [], keys: keys.data ?? [] };
  });

/** Admin manual result for self-generated games + settlement of open bets. */
export const declareResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        gameId: z.string().min(1),
        roundId: z.string().min(1),
        winners: z.array(z.string()).min(1),
        manual: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { walletCall } = await import("@/lib/callback-wallet.server");

    await supabaseAdmin.from("rounds").upsert(
      {
        game_id: data.gameId,
        round_id: data.roundId,
        status: "settled",
        result: { winners: data.winners },
        manual: data.manual,
        settled_at: new Date().toISOString(),
      },
      { onConflict: "game_id,round_id" },
    );

    const { data: bets } = await supabaseAdmin
      .from("bets")
      .select("id, operator_id, operator_user_id, selection, odds, stake, reference")
      .eq("game_id", data.gameId)
      .eq("round_id", data.roundId)
      .eq("status", "open");

    let settled = 0;
    for (const bet of bets ?? []) {
      const won = data.winners.some((w) => w.toLowerCase() === bet.selection.toLowerCase());
      const payout = won ? Number(bet.stake) * Number(bet.odds) : 0;

      await supabaseAdmin
        .from("bets")
        .update({
          status: won ? "won" : "lost",
          payout,
          settled_at: new Date().toISOString(),
        })
        .eq("id", bet.id);

      if (won) {
        const { data: op } = await supabaseAdmin
          .from("operators")
          .select("id, name, currency, callback_url, callback_secret, status, plan_expires_at")
          .eq("id", bet.operator_id)
          .single();
        if (op) {
          const res = await walletCall(op as never, "credit", {
            userId: bet.operator_user_id,
            amount: payout,
            reference: `${bet.reference ?? bet.id}-win`,
            gameId: data.gameId,
            roundId: data.roundId,
            betId: bet.id,
          });
          await supabaseAdmin.from("transactions").insert({
            operator_id: bet.operator_id,
            bet_id: bet.id,
            operator_user_id: bet.operator_user_id,
            kind: "credit",
            amount: payout,
            balance_after: res.ok ? res.balance : null,
            status: res.ok ? "done" : "failed",
            reference: `${bet.reference ?? bet.id}-win`,
          });
        }
      }
      settled++;
    }

    return { ok: true, settled };
  });

export const operatorLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ operatorId: z.string().uuid().optional(), limit: z.number().max(200).default(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let bets = context.supabase
      .from("bets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.operatorId) bets = bets.eq("operator_id", data.operatorId);
    const { data: rows, error } = await bets;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
