import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { feedGet } from "../feed";

export default defineTool({
  name: "list_matches",
  title: "List matches",
  description: "List current and upcoming matches for a sport (e.g. sport ID 4 for cricket).",
  inputSchema: {
    sportId: z.string().trim().regex(/^[\w.-]{1,20}$/).describe("Sport ID from list_sports."),
    inPlayOnly: z.boolean().optional().describe("Only return matches that are live now."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ sportId, inPlayOnly }, ctx) => {
    const q = inPlayOnly ? "?inPlay=1" : "";
    const data = await feedGet(`sports/${encodeURIComponent(sportId)}/events${q}`, ctx.signal);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});
