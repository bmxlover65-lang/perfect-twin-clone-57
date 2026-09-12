import { createFileRoute } from "@tanstack/react-router";
import { authenticateOperator, jsonError, productDenied } from "@/lib/operator-auth.server";
import { proxy } from "@/routes/api/public/uapi.$";

/** B2B sports list: GET|POST /api/public/v1/sports */
const handler = async ({ request }: { request: Request }) => {
  const auth = await authenticateOperator(request);
  if (!auth.ok) return jsonError(auth);
  const denied = productDenied(auth, "sports");
  if (denied) return jsonError(denied);

  const res = await proxy("sports", "", undefined, "");
  const json = (await res.json().catch(() => ({}))) as { sports?: unknown[]; error?: string };
  if (json.error) {
    return Response.json({ status: "error", code: "upstream", message: json.error }, { status: 502 });
  }
  const sports = json.sports ?? [];
  return Response.json(
    { status: "ok", product: "sports", count: sports.length, sports },
    { headers: { "cache-control": "no-store" } },
  );
};

export const Route = createFileRoute("/api/public/v1/sports")({
  server: { handlers: { GET: handler, POST: handler } },
});
