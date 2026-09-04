// Parse + validate the structured estimate out of a Claude Messages response.
// Kept separate from index.ts so it can be unit-tested without the network.

export type Estimate = {
  name: string;
  calories: number;
  protein_g: number;
  confidence: "low" | "medium" | "high";
  note: string;
};

// Returns null if anything is off — the caller falls back to manual entry.
export function parseEstimate(msg: unknown): Estimate | null {
  const text = firstText(msg);
  if (!text) return null;

  const parsed = tryParseJson(text);
  if (!parsed) return null;

  return coerce(parsed);
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

// output_config.format guarantees the shape, but the AI estimate is still a guess:
// clamp negatives, drop non-numbers, and never trust a missing/blank name.
export function coerce(rawInput: Record<string, unknown>): Estimate | null {
  const calories = num(rawInput.calories ?? rawInput.calorie);
  const protein_g = num(rawInput.protein_g ?? rawInput.protein);
  const confidence = rawInput.confidence;
  if (calories === null || protein_g === null) return null;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") return null;

  const name = typeof rawInput.name === "string" ? rawInput.name.trim() : "";
  return {
    name: name || "מנה",
    calories: Math.max(0, calories),
    protein_g: Math.max(0, protein_g),
    confidence,
    note: typeof rawInput.note === "string" ? rawInput.note : "",
  };
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function firstText(msg: unknown): string | null {
  const content = (msg as { content?: Array<{ type: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return null;
  const block = content.find((b) => b.type === "text" && typeof b.text === "string");
  return block?.text ?? null;
}
