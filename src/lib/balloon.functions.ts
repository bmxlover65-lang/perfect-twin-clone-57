import { createServerFn } from "@tanstack/react-start";

const EVENT_ID = "88.0023";
const MIRROR_RESULTS =
  "https://vimaan.ludoexchange.com/casinoapp/users/casino/casinoEventResults";

export type BalloonRound = {
  roundId: string;
  crash: number | null;
  crashedAt: string | null;
};

/**
 * Pulls the official Balloon results feed and stores every round + crash value
 * in the database, so history survives page refreshes.
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
      const rows = (json.data ?? [])
        .filter((r) => r?.roundId)
        .map((r) => ({
          round_id: String(r.roundId),
          event_id: EVENT_ID,
          crash: r.winner != null && r.winner !== "" ? Number(r.winner) : null,
          crashed_at: new Date().toISOString(),
        }))
        .filter((r) => r.crash == null || Number.isFinite(r.crash));

      if (rows.length) {
        await supabaseAdmin
          .from("balloon_rounds")
          .upsert(rows, { onConflict: "round_id", ignoreDuplicates: true });
      }
    } catch {
      // upstream hiccup — fall through and serve whatever is stored
    }

    const { data } = await supabaseAdmin
      .from("balloon_rounds")
      .select("round_id, crash, crashed_at")
      .order("created_at", { ascending: false })
      .limit(60);

    return (data ?? []).map((r) => ({
      roundId: r.round_id,
      crash: r.crash == null ? null : Number(r.crash),
      crashedAt: r.crashed_at,
    }));
  },
);

/** Read-only history for the Balloon panel. */
export const listBalloonRounds = createServerFn({ method: "GET" }).handler(
  async (): Promise<BalloonRound[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("balloon_rounds")
      .select("round_id, crash, crashed_at")
      .order("created_at", { ascending: false })
      .limit(60);
    return (data ?? []).map((r) => ({
      roundId: r.round_id,
      crash: r.crash == null ? null : Number(r.crash),
      crashedAt: r.crashed_at,
    }));
  },
);
