import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { feedGet } from "../feed";

export default defineTool({
  name: "get_match_odds",
  title: "Get match odds",
  description: "Get live markets and back/lay odds (match odds, bookmaker, fancy) for one match.",
  inputSchema: {
    sportId: z.string().trim().regex(/^[\w.-]{1,20}$/).describe("Sport ID from list_sports."),
    eventId: z.string().trim().regex(/^[\w.:-]{1,60}$/).describe("Match event ID from list_matches."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ sportId, eventId }, ctx) => {
    const data = await feedGet(`sports/${encodeURIComponent(sportId)}/${encodeURIComponent(eventId)}/odds`, ctx.signal);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});
