import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  authenticateOperator,
  jsonError,
  productDenied,
  productOf,
} from "@/lib/operator-auth.server";
import { walletCall } from "@/lib/callback-wallet.server";

const schema = z.object({
  userId: z.string().min(1).max(120),
  gameId: z.string().min(1).max(60),
  roundId: z.string().min(1).max(80),
  market: z.string().max(80).optional(),
  selection: z.string().min(1).max(120),
  odds: z.number().min(1).max(1000),
  stake: z.number().min(1).max(10_000_000),
  reference: z.string().max(120).optional(),
});

async function logReject(row: Record<string, unknown>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bet_rejections").insert(row as never);
  } catch {
    /* logging must never break the bet flow */
  }
}

export const Route = createFileRoute("/api/public/v1/bet")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { status: "error", code: "method_not_allowed", message: "Use POST with a JSON body" },
          { status: 405 },
        ),
      POST: async ({ request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) {
          await logReject({ code: auth.code, message: auth.error });
          return jsonError(auth);
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          await logReject({
            operator_id: auth.operator.id,
            code: "bad_request",
            message: parsed.error.issues[0]?.message ?? "Invalid body",
            ip: auth.ip,
          });
          return Response.json(
            {
              status: "error",
              code: "bad_request",
              message: parsed.error.issues[0]?.message ?? "Invalid body",
            },
            { status: 400 },
          );
        }
        const b = parsed.data;

        // Casino vs sports scope of this API key.
        const denied = productDenied(auth, productOf(b.gameId));
        if (denied) {
          await logReject({
            operator_id: auth.operator.id,
            operator_user_id: b.userId,
            game_id: b.gameId,
            round_id: b.roundId,
            code: denied.code,
            message: denied.error,
            ip: auth.ip,
          });
          return jsonError(denied);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Round must still be open for bets.
        const { data: round } = await supabaseAdmin
          .from("rounds")
          .select("status")
          .eq("game_id", b.gameId)
          .eq("round_id", b.roundId)
          .maybeSingle();
        if (round && round.status !== "open") {
          await logReject({
            operator_id: auth.operator.id,
            operator_user_id: b.userId,
            game_id: b.gameId,
            round_id: b.roundId,
            market: b.market ?? null,
            selection: b.selection,
            odds: b.odds,
            stake: b.stake,
            code: "round_closed",
            message: "Betting is closed for this round",
            ip: auth.ip,
          });
          return Response.json(
            { status: "error", code: "round_closed", message: "Betting is closed for this round" },
            { status: 409 },
          );
        }

        // Casino: the live table must be open for this exact round. Once the
        // card is out (suspended / timer over / new round) the bet is refused.
        if (/^\d+\.\d/.test(b.gameId)) {
          const { ucasState } = await import("@/lib/ucas.server");
          const live = (await ucasState(b.gameId).catch(() => null)) as
            | { freshnessMs: number; data: { roundId?: string; status?: string; leftSec?: number } }
            | null;
          const d = live?.data;
          const closed =
            !d || (live?.freshnessMs ?? Infinity) > 5000 ||
            (
            ((d.roundId && String(d.roundId) !== b.roundId) ||
              /SUSPEND|CLOSE|RESULT/i.test(String(d.status ?? "")) ||
              (typeof d.leftSec === "number" && d.leftSec <= 0)));
          // Odds may never exceed the best rate currently on the live table.
          const prices: number[] = [];
          const walk = (v: unknown, k = "") => {
            if (Array.isArray(v)) v.forEach((x) => walk(x, k));
            else if (v && typeof v === "object")
              for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
            else if (/^(price|rate|odds|b|b1|back)$/i.test(k)) {
              const n = Number(v);
              if (Number.isFinite(n) && n > 1 && n < 10_000) prices.push(n);
            }
          };
          walk(d);
          const maxRate = prices.length ? Math.max(...prices) : null;
          if (!closed && maxRate !== null && b.odds > maxRate * 1.0001) {
            await logReject({
              operator_id: auth.operator.id,
              operator_user_id: b.userId,
              game_id: b.gameId,
              round_id: b.roundId,
              selection: b.selection,
              odds: b.odds,
              stake: b.stake,
              code: "odds_changed",
              message: "Odds are higher than the live table rate",
              ip: auth.ip,
            });
            return Response.json(
              { status: "error", code: "odds_changed", message: "Odds are higher than the live table rate" },
              { status: 409 },
            );
          }
          if (closed) {
            await logReject({
              operator_id: auth.operator.id,
              operator_user_id: b.userId,
              game_id: b.gameId,
              round_id: b.roundId,
              market: b.market ?? null,
              selection: b.selection,
              odds: b.odds,
              stake: b.stake,
              code: "round_closed",
              message: "Betting is closed for this round",
              ip: auth.ip,
            });
            return Response.json(
              { status: "error", code: "round_closed", message: "Betting is closed for this round" },
              { status: 409 },
            );
          }
        }

        const reference = b.reference ?? crypto.randomUUID();

        // Idempotency: same operator + reference returns the existing bet.
        const { data: existing } = await supabaseAdmin
          .from("bets")
          .select("id, status, stake, odds")
          .eq("operator_id", auth.operator.id)
          .eq("reference", reference)
          .maybeSingle();
        if (existing) {
          return Response.json({ status: "ok", betId: existing.id, duplicate: true });
        }

        const debit = await walletCall(auth.operator, "debit", {
          userId: b.userId,
          amount: b.stake,
          reference,
          gameId: b.gameId,
          roundId: b.roundId,
        });
        if (!debit.ok) {
          await logReject({
            operator_id: auth.operator.id,
            operator_user_id: b.userId,
            game_id: b.gameId,
            round_id: b.roundId,
            market: b.market ?? null,
            selection: b.selection,
            odds: b.odds,
            stake: b.stake,
            code: debit.code ?? "wallet_declined",
            message: debit.message ?? "Wallet declined the debit",
            ip: auth.ip,
          });
          return Response.json(
            { status: "error", code: debit.code, message: debit.message },
            { status: debit.status },
          );
        }

        const { data: bet, error } = await supabaseAdmin
          .from("bets")
          .insert({
            operator_id: auth.operator.id,
            operator_user_id: b.userId,
            game_id: b.gameId,
            round_id: b.roundId,
            market: b.market ?? null,
            selection: b.selection,
            odds: b.odds,
            stake: b.stake,
            reference,
          })
          .select("id")
          .single();

        if (error || !bet) {
          // Money already left the operator wallet — put it back.
          await walletCall(auth.operator, "rollback", {
            userId: b.userId,
            amount: b.stake,
            reference,
            gameId: b.gameId,
            roundId: b.roundId,
          });
          return Response.json(
            {
              status: "error",
              code: "bet_failed",
              message: "Could not record bet, stake refunded",
            },
            { status: 500 },
          );
        }

        await supabaseAdmin.from("transactions").insert({
          operator_id: auth.operator.id,
          bet_id: bet.id,
          operator_user_id: b.userId,
          kind: "debit",
          amount: b.stake,
          balance_after: debit.balance,
          status: "done",
          reference,
        });

        return Response.json({
          status: "ok",
          betId: bet.id,
          reference,
          balance: debit.balance,
          currency: auth.operator.currency,
        });
      },
    },
  },
});
