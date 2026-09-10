import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateOperator, jsonError } from "@/lib/operator-auth.server";
import { walletCall } from "@/lib/callback-wallet.server";

const schema = z.object({ userId: z.string().min(1).max(120) });

export const Route = createFileRoute("/api/public/v1/balance")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { status: "error", code: "method_not_allowed", message: "Use POST with a JSON body" },
          { status: 405 },
        ),
      POST: async ({ request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { status: "error", code: "bad_request", message: "userId is required" },
            { status: 400 },
          );
        }

        const res = await walletCall(auth.operator, "balance", { userId: parsed.data.userId });
        if (!res.ok) {
          return Response.json(
            { status: "error", code: res.code, message: res.message },
            { status: res.status },
          );
        }
        return Response.json({
          status: "ok",
          currency: auth.operator.currency,
          balance: res.balance,
        });
      },
    },
  },
});
