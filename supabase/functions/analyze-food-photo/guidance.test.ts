import { assertEquals } from "jsr:@std/assert";
import { buildGuidanceContent, MAX_GUIDANCE_LENGTH } from "./guidance.ts";

const image = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "photo" } };
const guidancePrefix = "מידע נוסף מהמשתמש על המנה:\n";

Deno.test("keeps the image before trimmed guidance", () => {
  assertEquals([
    image,
    ...buildGuidanceContent("  150 גרם בשר  ")!,
  ], [
    image,
    { type: "text", text: `${guidancePrefix}150 גרם בשר` },
  ]);
});

Deno.test("omits empty and whitespace guidance", () => {
  assertEquals(buildGuidanceContent(""), []);
  assertEquals(buildGuidanceContent(" \n\t "), []);
});

Deno.test("accepts exactly 1000 trimmed guidance characters", () => {
  const guidance = "x".repeat(MAX_GUIDANCE_LENGTH);
  assertEquals(buildGuidanceContent(`  ${guidance}  `), [{ type: "text", text: `${guidancePrefix}${guidance}` }]);
});

Deno.test("rejects more than 1000 trimmed guidance characters", () => {
  assertEquals(buildGuidanceContent("x".repeat(MAX_GUIDANCE_LENGTH + 1)), null);
});
