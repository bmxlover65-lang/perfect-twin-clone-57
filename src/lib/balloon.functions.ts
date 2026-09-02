import { createServerFn } from "@tanstack/react-start";

const EVENT_ID = "88.0023";
const MIRROR_RESULTS =
  "https://vimaan.ludoexchange.com/casinoapp/users/casino/casinoEventResults";

export type BalloonRound = {
  roundId: string;
  crash: number | null;
  crashedAt: string | null;
};

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function readHistory(supabaseAdmin: AdminClient): Promise<BalloonRound[]> {
  const { data } = await supabaseAdmin
    .from("balloon_rounds")
    .select("round_id, crash, crashed_at")
    .eq("event_id", EVENT_ID)
    .order("round_id", { ascending: false })
    .limit(60);

  return (data ?? []).map((r) => ({
    roundId: r.round_id,
    crash: r.crash == null ? null : Number(r.crash),
    crashedAt: r.crashed_at,
  }));
}

/**
 * Pulls the official Balloon results feed and stores every round + crash value
 * in the database, so history survives page refreshes.
 * New rounds are inserted; rounds that were still in flight get their crash
 * value and crash time filled in once the official winner arrives.
 */
export const syncBalloonRounds = createServerFn({ method: "POST" }).handler(
  async (): Promise<BalloonRound[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const res = await fetch(MIRROR_RESULTS, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ eventId: EVENT_ID }),
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { roundId?: string; winner?: string }[];
      };

      const feed = (json.data ?? [])
        .filter((r) => r?.roundId)
        .map((r) => {
          const raw = r.winner == null || r.winner === "" ? null : Number(r.winner);
          return {
            round_id: String(r.roundId),
            crash: raw != null && Number.isFinite(raw) ? raw : null,
          };
        });

      if (feed.length) {
        const now = new Date().toISOString();
        const { data: existingRows } = await supabaseAdmin
          .from("balloon_rounds")
          .select("round_id, crash, crashed_at")
          .in(
            "round_id",
            feed.map((r) => r.round_id),
          );
        const existing = new Map(
          (existingRows ?? []).map((r) => [r.round_id, r] as const),
        );

        const inserts = feed
          .filter((r) => !existing.has(r.round_id))
          .map((r) => ({
            round_id: r.round_id,
            event_id: EVENT_ID,
            crash: r.crash,
            crashed_at: r.crash == null ? null : now,
          }));

        if (inserts.length) {
          await supabaseAdmin
            .from("balloon_rounds")
            .upsert(inserts, { onConflict: "round_id", ignoreDuplicates: true });
        }

        // Fill in crash value/time for rounds that were still in flight.
        const updates = feed.filter((r) => {
          const prev = existing.get(r.round_id);
          return r.crash != null && prev != null && prev.crash == null;
        });
        for (const u of updates) {
          await supabaseAdmin
            .from("balloon_rounds")
            .update({ crash: u.crash, crashed_at: now })
            .eq("round_id", u.round_id);
        }
      }
    } catch {
      // upstream hiccup — fall through and serve whatever is stored
    }

    return readHistory(supabaseAdmin);
  },
);

/** Read-only history for the Balloon panel. */
export const listBalloonRounds = createServerFn({ method: "GET" }).handler(
  async (): Promise<BalloonRound[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return readHistory(supabaseAdmin);
  },
);
