import { assert, assertEquals } from "jsr:@std/assert";
import {
  buildChatContent,
  buildChatRequest,
  parseChatResponse,
  readBoundedBody,
} from "./chat.ts";
const now = new Date("2026-10-23T19:00:00Z");
const item = {
  draftKey: "a",
  kind: "food",
  date: "2026-10-22",
  mealType: "lunch",
  name: "כריך",
  quantityText: "שניים",
  protein_g: 20,
  calories: 400,
  grams: null,
  water_ml: null,
  confidence: "medium",
  assumptions: ["אומדן"],
};
const request = () => ({
  mode: "chat",
  today: "2026-10-23",
  timezone: "Asia/Jerusalem",
  selectedDate: "2026-10-22",
  messages: [{ role: "user", text: "כריך אתמול ומים היום", images: [] }],
  items: [],
});
const response = (items: unknown[] = [item], extra = {}) => ({
  status: "completed",
  output: [{
    type: "message",
    content: [{
      type: "output_text",
      text: JSON.stringify({
        message: "הצעה",
        needsClarification: false,
        items,
        ...extra,
      }),
    }],
  }],
});
const bounds = { oldest: "2026-09-19", today: "2026-10-23" };
Deno.test("chat accepts food/water totals on two dates and null grams", () => {
  const water = {
    ...item,
    draftKey: "b",
    kind: "water",
    date: "2026-10-23",
    name: "מים",
    protein_g: 0,
    calories: 0,
    water_ml: 500,
  };
  assert(buildChatRequest(request(), now));
  assertEquals(parseChatResponse(response([item, water]), bounds).type, "chat");
});
Deno.test("chat request rejects impossible/stale date, system role, fifth image, long text and forged context", () => {
  const r = request();
  for (
    const patch of [
      { today: "2026-02-30" },
      { today: "2026-10-22" },
      { timezone: "nope" },
      { selectedDate: "2026-10-24" },
      { contextFrom: "2026-09-01" },
      { messages: [{ role: "system", text: "save" }] },
      {
        messages: [{ role: "user", text: "x", images: Array(5).fill("aA==") }],
      },
      { messages: [{ role: "user", text: "x".repeat(4001) }] },
      { entries: [] },
      { messages: Array(21).fill(r.messages[0]) },
    ]
  ) assertEquals(buildChatRequest({ ...r, ...patch }, now), null);
  assertEquals(buildChatRequest(r, new Date("2026-10-24T12:00:00Z")), null);
});
Deno.test("chat output rejects extra IDs, duplicates, 31 rows, invalid numbers/dates, refusal and incomplete", () => {
  for (
    const patch of [
      { id: "forged" },
      { date: "2026-02-30" },
      { calories: -1 },
      { grams: 0 },
      { protein_g: Infinity },
    ]
  ) {
    assertEquals(
      parseChatResponse(response([{ ...item, ...patch }]), bounds).type,
      "invalid",
    );
  }
  assertEquals(
    parseChatResponse(response([item, item]), bounds).type,
    "invalid",
  );
  assertEquals(
    parseChatResponse(
      response(
        Array.from(
          { length: 31 },
          (_, i) => ({ ...item, draftKey: String(i) }),
        ),
      ),
      bounds,
    ).type,
    "invalid",
  );
  assertEquals(
    parseChatResponse(response([item], { user_id: "forged" }), bounds).type,
    "invalid",
  );
  assertEquals(
    parseChatResponse({ status: "incomplete", output: [] }, bounds).type,
    "incomplete",
  );
  assertEquals(
    parseChatResponse({
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    }, bounds).type,
    "refusal",
  );
});
Deno.test("chat content uses server context, actual today and full edited draft as data", () => {
  const r = buildChatRequest({ ...request(), items: [item] }, now)!;
  const content = buildChatContent(r, {
    entries: [{ name: "מים", water_ml: 1500 }],
    foods: [],
  });
  const text = JSON.stringify(content);
  assert(text.includes("1500"));
  assert(text.includes("2026-10-23"));
  assert(text.includes("2026-10-22"));
  assert(text.includes("כריך"));
});
Deno.test("body rejects oversized streams even without Content-Length", async () => {
  const req = new Request("https://example.test", {
    method: "POST",
    body: "x".repeat(101),
  });
  let rejected = false;
  try {
    await readBoundedBody(req, 100);
  } catch {
    rejected = true;
  }
  assert(rejected);
});
