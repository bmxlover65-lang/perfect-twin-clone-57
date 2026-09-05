/**
 * Player session for integrated (embedded) launches.
 *
 * When an operator opens a game with `?apiKey=…&userId=…`, every bet is
 * placed against THEIR wallet through the public API — the local demo
 * balance is never used or shown.
 */

export type PlayerSession = { apiKey: string; userId: string };

export function playerSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const apiKey = (q.get("apiKey") ?? q.get("api_key") ?? "").trim();
  const userId = (q.get("userId") ?? q.get("user_id") ?? "").trim();
  return apiKey && userId ? { apiKey, userId } : null;
}

async function post<T>(path: string, session: PlayerSession, body: Record<string, unknown>) {
  const res = await fetch(`/api/public/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": session.apiKey },
    body: JSON.stringify({ userId: session.userId, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { status?: string; message?: string };
  return { ok: res.ok && json.status !== "error", json };
}

export async function remoteBalance(session: PlayerSession): Promise<number | null> {
  try {
    const { ok, json } = await post<{ balance?: number }>("balance", session, {});
    return ok && typeof json.balance === "number" ? json.balance : null;
  } catch {
    return null;
  }
}

export async function remoteBet(
  session: PlayerSession,
  bet: {
    gameId: string;
    roundId: string;
    market?: string | undefined;
    selection: string;
    odds: number;
    stake: number;
    reference: string;
  },
): Promise<{ ok: boolean; message?: string; balance?: number | null }> {
  try {
    const { ok, json } = await post<{ balance?: number }>("bet", session, bet);
    if (!ok) return { ok: false, message: json.message ?? "Bet was declined by your wallet." };
    return { ok: true, balance: json.balance ?? null };
  } catch {
    return { ok: false, message: "Wallet unreachable, bet not placed." };
  }
}

export async function remoteCashout(
  session: PlayerSession,
  reference: string,
  multiplier: number,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { ok, json } = await post<Record<string, unknown>>("cashout", session, {
      reference,
      multiplier,
    });
    return ok ? { ok: true } : { ok: false, message: json.message ?? "Cash out failed." };
  } catch {
    return { ok: false, message: "Wallet unreachable." };
  }
}

/** Settle a table bet on the operator wallet (win credits, void refunds). */
export async function remoteSettle(
  session: PlayerSession,
  reference: string,
  outcome: "won" | "lost" | "void",
  multiplier?: number,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { ok, json } = await post<Record<string, unknown>>("settle", session, {
      reference,
      outcome,
      ...(multiplier ? { multiplier } : {}),
    });
    return ok ? { ok: true } : { ok: false, message: json.message ?? "Settlement failed." };
  } catch {
    return { ok: false, message: "Wallet unreachable." };
  }
}

