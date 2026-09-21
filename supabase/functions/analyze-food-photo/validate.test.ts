// Self-check for the AI-response parsing/validation (design §9).
// Run: deno test supabase/functions/analyze-food-photo/validate.test.ts
import { assertEquals } from "jsr:@std/assert";
import { coerce, parseOpenAIResponse } from "./validate.ts";

Deno.test("parseOpenAIResponse finds structured output after a reasoning item", () => {
  const result = parseOpenAIResponse({
    status: "completed",
    output: [
      { type: "reasoning", id: "reasoning_1", summary: [] },
      {
        type: "message",
        role: "assistant",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            name: "חזה עוף",
            calories: 330,
            protein_g: 62,
            confidence: "high",
            note: "הערכה לפי 200 גרם",
          }),
        }],
      },
    ],
  });

  assertEquals(result.type, "estimate");
  if (result.type === "estimate") assertEquals(result.estimate.protein_g, 62);
});

Deno.test("parseOpenAIResponse reports refusal", () => {
  const result = parseOpenAIResponse({
    status: "completed",
    output: [{
      type: "message",
      role: "assistant",
      content: [{ type: "refusal", refusal: "Cannot comply" }],
    }],
  });
  assertEquals(result, { type: "refusal" });
});

Deno.test("parseOpenAIResponse reports incomplete responses", () => {
  assertEquals(parseOpenAIResponse({ status: "incomplete", output: [] }), {
    type: "incomplete",
  });
});

Deno.test("parseOpenAIResponse rejects malformed or negative estimates", () => {
  const result = parseOpenAIResponse({
    status: "completed",
    output: [{
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: '{"calories":-1}' }],
    }],
  });
  assertEquals(result, { type: "invalid" });
});

Deno.test("defaults a blank name while retaining valid estimate fields", () => {
  const e = coerce({ name: "  ", calories: 5, protein_g: 10, confidence: "low", note: "" });
  assertEquals(e, { name: "מנה", calories: 5, protein_g: 10, confidence: "low", note: "" });
});

Deno.test("rejects bad confidence and non-numbers", () => {
  assertEquals(coerce({ name: "x", calories: 1, protein_g: 1, confidence: "maybe", note: "" }), null);
  assertEquals(coerce({ name: "x", calories: "NaN", protein_g: 1, confidence: "low", note: "" }), null);
  assertEquals(coerce({ name: "x", calories: -1, protein_g: 1, confidence: "low", note: "" }), null);
});

Deno.test("rejects a missing required field and non-message output", () => {
  assertEquals(coerce({ name: "x", protein_g: 1, confidence: "low", note: "" }), null); // no calories
  assertEquals(parseOpenAIResponse({ status: "completed", output: [{ type: "reasoning" }] }), { type: "invalid" });
});
