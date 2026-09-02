import { createHmac } from "crypto";
import type { Operator } from "./operator-auth.server";

export type WalletAction = "balance" | "debit" | "credit" | "rollback";

export type WalletResult =
  | { ok: true; balance: number | null; reference?: string }
  | { ok: false; status: number; code: string; message: string };

/**
 * Callback wallet: the operator's own site holds the player balance.
 * We POST signed debit/credit/balance calls to their callback URL and log
 * every round-trip in callback_logs.
 */
export async function walletCall(
  operator: Operator,
  action: WalletAction,
  payload: {
    userId: string;
    amount?: number;
    reference?: string;
    gameId?: string;
    roundId?: string;
    betId?: string;
  },
): Promise<WalletResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!operator.callback_url) {
    return { ok: false, status: 424, code: "no_callback_url", message: "Callback URL not configured" };
  }

  const body = JSON.stringify({
    action,
    operatorId: operator.id,
    currency: operator.currency,
    userId: payload.userId,
    amount: payload.amount ?? 0,
    reference: payload.reference ?? crypto.randomUUID(),
    gameId: payload.gameId ?? null,
    roundId: payload.roundId ?? null,
    betId: payload.betId ?? null,
    timestamp: new Date().toISOString(),
  });

  const signature = operator.callback_secret
    ? createHmac("sha256", operator.callback_secret).update(body).digest("hex")
    : "";

  let statusCode = 0;
  let parsed: unknown = null;
  let ok = false;

  try {
    const res = await fetch(`${operator.callback_url.replace(/\/$/, "")}/${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-universal-signature": signature,
        "x-universal-operator": operator.id,
      },
      body,
    });
    statusCode = res.status;
    const text = await res.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text.slice(0, 500) };
    }
    ok = res.ok;
  } catch (e) {
    parsed = { error: e instanceof Error ? e.message : "network error" };
  }

  await supabaseAdmin.from("callback_logs").insert({
    operator_id: operator.id,
    endpoint: `${operator.callback_url}/${action}`,
    request: JSON.parse(body),
    response: parsed as never,
    status_code: statusCode || null,
    ok,
  });

  if (!ok) {
    return {
      ok: false,
      status: 502,
      code: "callback_failed",
      message: `Operator wallet callback failed (${statusCode || "network"})`,
    };
  }

  const data = (parsed ?? {}) as { balance?: number; reference?: string; status?: string };
  if (data.status && data.status !== "ok" && data.status !== "success") {
    return { ok: false, status: 402, code: "wallet_rejected", message: "Operator wallet rejected the request" };
  }

  return { ok: true, balance: typeof data.balance === "number" ? data.balance : null, reference: data.reference };
}
