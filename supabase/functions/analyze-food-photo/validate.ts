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
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  return coerce(raw);
}

// output_config.format guarantees the shape, but the AI estimate is still a guess:
// clamp negatives, drop non-numbers, and never trust a missing/blank name.
export function coerce(raw: Record<string, unknown>): Estimate | null {
  const calories = num(raw.calories);
  const protein_g = num(raw.protein_g);
  const confidence = raw.confidence;
  if (calories === null || protein_g === null) return null;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") return null;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  return {
    name: name || "מנה",
    calories: Math.max(0, calories),
    protein_g: Math.max(0, protein_g),
    confidence,
    note: typeof raw.note === "string" ? raw.note : "",
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
