import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UiAuditInput = {
  gameLabel: string;
  currentImage: string;
  referenceImage: string;
  notes?: string;
};

const MAX_IMAGE_CHARS = 8_000_000; // ~6MB of base64 per image

function assertImage(value: string, field: string) {
  if (!value.startsWith("data:image/")) {
    throw new Error(`${field} must be an image`);
  }
  if (value.length > MAX_IMAGE_CHARS) {
    throw new Error(`${field} is too large, please upload a smaller screenshot`);
  }
  return value;
}

const SYSTEM_PROMPT = `You audit the UI of an online casino game board against a reference screenshot.
The first image is OUR CURRENT build, the second image is the REFERENCE we must match pixel-for-pixel on a 393px wide mobile screen.

Report findings in this exact markdown shape and nothing else:

## Verdict
One line: MATCH, MINOR DIFFERENCES or BROKEN.

## Blocking issues
Numbered list. Only things that make our build look wrong or unusable: text overlapping other text, suspended/locked overlays covering odds or labels, content cut off at the screen edge, missing markets or missing rows.

## Visual mismatches
Numbered list of layout, colour, spacing, font-size, ordering and label differences. Name the exact element and both values (ours vs reference) whenever you can read them.

## Suspend state check
Say whether the suspended/locked treatment in our build matches the reference: same coverage area, readable odds underneath, no giant overlapping text.

## Fix list
Short, concrete, ordered engineering steps.

Be specific and terse. Never invent an issue you cannot see. If a section has nothing to report, write "None".`;

/**
 * Compare a current game screenshot with a reference screenshot and report UI
 * mismatches, wrong suspend states and overlap issues using Lovable AI.
 */
export const auditGameUi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UiAuditInput) => ({
    gameLabel: String(input.gameLabel ?? "").slice(0, 120),
    currentImage: assertImage(String(input.currentImage ?? ""), "Current screenshot"),
    referenceImage: assertImage(String(input.referenceImage ?? ""), "Reference screenshot"),
    notes: String(input.notes ?? "").slice(0, 2000),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        store: false,
        instructions: SYSTEM_PROMPT,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  `Game: ${data.gameLabel || "unknown"}\n` +
                  `Image 1 = our current build. Image 2 = the reference.\n` +
                  (data.notes ? `Operator notes: ${data.notes}` : "No extra notes."),
              },
              { type: "input_image", image_url: data.currentImage },
              { type: "input_image", image_url: data.referenceImage },
            ],
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      if (res.status === 402) {
        throw new Error("AI credits are exhausted for this workspace. Add credits and try again.");
      }
      if (res.status === 429) {
        throw new Error("AI is rate limited right now. Please retry in a moment.");
      }
      throw new Error(`AI request failed (${res.status}). ${detail.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let reasoning = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (
            evt.type === "response.reasoning_summary_text.delta" &&
            typeof evt.delta === "string"
          ) {
            reasoning += evt.delta;
          }
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }

    return {
      report: text.trim() || reasoning.trim() || "The model returned no findings.",
      usedReasoningOnly: !text.trim() && Boolean(reasoning.trim()),
    };
  });
