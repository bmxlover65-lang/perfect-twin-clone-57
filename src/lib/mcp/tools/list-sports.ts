import { defineTool } from "@lovable.dev/mcp-js";
import { feedGet } from "../feed";

export default defineTool({
  name: "list_sports",
  title: "List sports",
  description: "List the sports available on Universe Api with their sport IDs.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (_args, ctx) => {
    const data = await feedGet("sports", ctx.signal);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});
