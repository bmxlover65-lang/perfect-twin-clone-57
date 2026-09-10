import { createFileRoute } from "@tanstack/react-router";
import { authenticateOperator, jsonError } from "@/lib/operator-auth.server";

/** Tells the caller which products (casino / sports) this API key may use. */
export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      __tmp: async ({ request }: { request: Request }) => {
        const auth = await authenticateOperator(request);
        if (!auth.ok) return jsonError(auth);
        return Response.json({
          status: "ok",
          operator: auth.operator.name,
          currency: auth.operator.currency,
          products: auth.products,
          casino: auth.products.includes("casino"),
          sports: auth.products.includes("sports"),
          validTill: auth.operator.plan_expires_at,
        });
      },
    },
  },
});
