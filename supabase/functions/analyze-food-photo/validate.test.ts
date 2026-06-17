// Self-check for the AI-response parsing/validation (design §9).
// Run: deno test supabase/functions/analyze-food-photo/validate.test.ts
import { assertEquals } from "jsr:@std/assert";
import { coerce, parseEstimate } from "./validate.ts";

Deno.test("parses a well-formed Claude response", () => {
  const msg = {
    content: [{
      type: "text",
      text: JSON.stringify({
        name: "ביצה קשה",
        calories: 78,
        protein_g: 6,
        confidence: "high",
        note: "הנחתי ביצה גדולה",
      }),
    }],
  };
  assertEquals(parseEstimate(msg)?.protein_g, 6);
});

Deno.test("clamps negatives and defaults a blank name", () => {
  const e = coerce({ name: "  ", calories: -5, protein_g: 10, confidence: "low", note: "" });
  assertEquals(e, { name: "מנה", calories: 0, protein_g: 10, confidence: "low", note: "" });
});

Deno.test("rejects bad confidence and non-numbers", () => {
  assertEquals(coerce({ name: "x", calories: 1, protein_g: 1, confidence: "maybe", note: "" }), null);
  assertEquals(coerce({ name: "x", calories: "NaN", protein_g: 1, confidence: "low", note: "" }), null);
});

Deno.test("returns null on non-JSON / empty content", () => {
  assertEquals(parseEstimate({ content: [{ type: "text", text: "סליחה, לא הצלחתי" }] }), null);
  assertEquals(parseEstimate({ content: [] }), null);
});

Deno.test("rejects a missing required field and a non-text content block", () => {
  assertEquals(coerce({ name: "x", protein_g: 1, confidence: "low", note: "" }), null); // no calories
  assertEquals(parseEstimate({ content: [{ type: "tool_use" }] }), null);
});
