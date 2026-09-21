// Parse + independently validate structured output from the Responses API.
// Kept separate from index.ts so it can be unit-tested without the network.

export type Estimate = {
  name: string;
  calories: number;
  protein_g: number;
  confidence: "low" | "medium" | "high";
  note: string;
};

export type ParseResult =
  | { type: "estimate"; estimate: Estimate }
  | { type: "refusal" }
  | { type: "incomplete" }
  | { type: "invalid" };

export function parseOpenAIResponse(response: unknown): ParseResult {
  if (!isRecord(response)) return { type: "invalid" };
  if (response.status === "incomplete") return { type: "incomplete" };
  if (!Array.isArray(response.output)) return { type: "invalid" };

  for (const item of response.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (content.type === "refusal") return { type: "refusal" };
      if (content.type !== "output_text" || typeof content.text !== "string") continue;

      const parsed = tryParseJson(content.text);
      const estimate = parsed && coerce(parsed);
      if (estimate) return { type: "estimate", estimate };
    }
  }

  return { type: "invalid" };
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const direct = maybeJson(text);
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\n([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = maybeJson(fenced[1]);
    if (fromFence) return fromFence;
  }

  const wrapped = text.match(/\{[\s\S]*\}/);
  if (wrapped) return maybeJson(wrapped[0]);

  return null;
}

function maybeJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Structured output enforces the provider schema, but this remains the trust
// boundary for values returned to the client.
export function coerce(rawInput: Record<string, unknown>): Estimate | null {
  const calories = nonNegativeNumber(rawInput.calories);
  const protein_g = nonNegativeNumber(rawInput.protein_g);
  const confidence = rawInput.confidence;
  const name = typeof rawInput.name === "string" ? rawInput.name.trim() : null;
  const note = rawInput.note;

  if (
    calories === null ||
    protein_g === null ||
    name === null ||
    typeof note !== "string" ||
    (confidence !== "low" && confidence !== "medium" && confidence !== "high")
  ) return null;

  return {
    name: name || "מנה",
    calories,
    protein_g,
    confidence,
    note,
  };
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
