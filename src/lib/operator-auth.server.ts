import { createHash } from "crypto";

export type Operator = {
  id: string;
  name: string;
  currency: string;
  callback_url: string | null;
  callback_secret: string | null;
  status: string;
  plan_expires_at: string | null;
};

export type AuthFailure = { ok: false; status: number; error: string; code: string };
export type Product = "casino" | "sports";
export type AuthSuccess = {
  ok: true;
  operator: Operator;
  apiKeyId: string;
  ip: string;
  /** Products this API key is allowed to use (casino and/or sports). */
  products: Product[];
};
export type AuthResult = AuthFailure | AuthSuccess;

export function hashKey(key: string) {
  return createHash("sha256").update(key.trim()).digest("hex");
}

export function clientIp(request: Request): string {
  const xff = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return (xff ?? "").split(",")[0]?.trim() || "0.0.0.0";
}

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^www\./, "") || null;
  }
}

/**
 * Verifies the operator API key, IP whitelist, domain whitelist and the
 * monthly subscription window. Every /api/public/v1/* handler starts here.
 */
export async function authenticateOperator(request: Request): Promise<AuthResult> {
  const raw =
    request.headers.get("x-api-key") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!raw) return { ok: false, status: 401, code: "missing_key", error: "Missing API key" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: keyRow } = await supabaseAdmin
    .from("api_keys")
    .select("id, operator_id, active, products")
    .eq("key_hash", hashKey(raw))
    .maybeSingle();

  if (!keyRow || !keyRow.active) {
    return { ok: false, status: 401, code: "invalid_key", error: "Invalid API key" };
  }

  const { data: operator } = await supabaseAdmin
    .from("operators")
    .select("id, name, currency, callback_url, callback_secret, status, plan_expires_at, products")
    .eq("id", keyRow.operator_id)
    .maybeSingle();

  if (!operator || operator.status !== "active") {
    return { ok: false, status: 403, code: "operator_disabled", error: "Operator is disabled" };
  }

  if (operator.plan_expires_at && new Date(operator.plan_expires_at).getTime() < Date.now()) {
    return { ok: false, status: 402, code: "plan_expired", error: "Subscription expired" };
  }

  const ip = clientIp(request);

  // Player-browser calls (game launched in an iframe/webview on our own
  // domain) come from the player's home IP, which an operator can never
  // whitelist. IP rules only apply to server-to-server calls.
  const selfHost = hostOf(request.url);
  const callerHost = hostOf(request.headers.get("origin") ?? request.headers.get("referer"));
  const playerCall = !!callerHost && !!selfHost && callerHost === selfHost;

  if (!playerCall) {
    const { data: ips } = await supabaseAdmin
      .from("ip_whitelist")
      .select("ip")
      .eq("operator_id", operator.id)
      .or(`api_key_id.eq.${keyRow.id},api_key_id.is.null`);
    if (ips && ips.length > 0 && !ips.some((r) => r.ip === ip)) {
      return { ok: false, status: 403, code: "ip_not_allowed", error: `IP ${ip} not whitelisted` };
    }
  }


  const { data: domains } = await supabaseAdmin
    .from("domain_whitelist")
    .select("domain")
    .eq("operator_id", operator.id)
    .or(`api_key_id.eq.${keyRow.id},api_key_id.is.null`);
  if (domains && domains.length > 0) {
    const origin = hostOf(request.headers.get("origin") ?? request.headers.get("referer"));
    const allowed = domains.map((d) => d.domain.toLowerCase().replace(/^www\./, ""));
    if (!origin || !allowed.some((d) => origin === d || origin.endsWith(`.${d}`))) {
      return {
        ok: false,
        status: 403,
        code: "domain_not_allowed",
        error: `Domain ${origin ?? "unknown"} not whitelisted`,
      };
    }
  }

  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  const opProducts = ((operator as { products?: string[] }).products ?? ["casino", "sports"]) as Product[];
  const keyProducts = ((keyRow as { products?: string[] }).products ?? ["casino", "sports"]) as Product[];
  const products = keyProducts.filter((p) => opProducts.includes(p));

  return { ok: true, operator: operator as Operator, apiKeyId: keyRow.id, ip, products };
}

/**
 * Casino event ids are dotted (88.0023, 99.0010, 4.35446…); sports events are
 * plain numeric exchange ids. Used to scope a request to casino or sports.
 */
export function productOf(gameId: string): Product {
  return /^\d+\.\d/.test(gameId.trim()) ? "casino" : "sports";
}

export function productDenied(auth: AuthSuccess, product: Product): AuthFailure | null {
  if (auth.products.includes(product)) return null;
  return {
    ok: false,
    status: 403,
    code: "product_not_allowed",
    error: `This API key is not allowed to use the ${product} API`,
  };
}

export function jsonError(res: AuthFailure) {
  return Response.json({ status: "error", code: res.code, message: res.error }, { status: res.status });
}
