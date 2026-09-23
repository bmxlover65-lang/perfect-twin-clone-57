import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { GAMES } from "@/data/games";

export default defineTool({
  name: "list_casino_games",
  title: "List casino games",
  description: "List the casino tables offered by Universe Api, optionally filtered by name.",
  inputSchema: { search: z.string().trim().max(60).optional().describe("Part of a game name to filter by.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ search }) => {
    const q = search?.toLowerCase();
    const games = GAMES.filter((g) => !q || g.name.toLowerCase().includes(q)).map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      markets: g.markets.map((m) => m.title),
    }));
    return {
      content: [{ type: "text", text: games.map((g) => `${g.id} — ${g.name}`).join("\n") || "No games found." }],
      structuredContent: { games },
    };
  },
});
