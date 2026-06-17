// analyze-food-photo: authenticated proxy to Claude vision.
// Holds ANTHROPIC_API_KEY server-side, enforces a soft per-day cap, and returns a
// structured estimate the client shows in editable fields before saving.
//
// ponytail: raw fetch to the Messages API instead of the SDK — one non-streaming
// call with a fixed schema, zero deps, lighter edge cold-start. Swap to npm:@anthropic-ai/sdk
// only if this grows tools/streaming.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseEstimate } from "./validate.ts";

const MODEL_ID = "claude-sonnet-4-6"; // single knob to change the vision model
const DAILY_AI_LIMIT = 6;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const PROMPT =
  "אמוד את המאכל בתמונה. החזר שם קצר בעברית, קלוריות (kcal) וחלבון (גרם) עבור המנה " +
  "שנראית בתמונה, רמת ביטחון, והערה קצרה בעברית על הנחות שהנחת (למשל גודל מנה). " +
  "אם אינך בטוח, אמוד בכל זאת וציין זאת בהערה.";

// minimum/required-style numeric bounds aren't expressible in structured-output
// schemas; validate.ts enforces non-negativity after parsing.
const ESTIMATE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    calories: { type: "number" },
    protein_g: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string" },
  },
  required: ["name", "calories", "protein_g", "confidence", "note"],
  additionalProperties: false,
};

const cors = {
  "Access-Control-Allow-Origin": "*", // ponytail: open CORS for the PWA; pin to the deployed origin if you care
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  // RLS-scoped client: every query below runs as the calling user.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: { image?: string; mediaType?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const { image, mediaType = "image/jpeg" } = payload;
  if (!image) return json({ error: "bad_request" }, 400);
  if (!ALLOWED_MEDIA.has(mediaType)) return json({ error: "bad_request" }, 400);

  // Daily cost brake — atomically reserve one of the user's N calls server-side
  // (not client-spoofable; every attempt counts, so re-analysis is capped too).
  const { data: allowed, error: capErr } = await supabase.rpc("consume_ai_call", {
    p_limit: DAILY_AI_LIMIT,
  });
  if (capErr) return json({ error: "server_error" }, 500);
  if (!allowed) return json({ error: "daily_limit", limit: DAILY_AI_LIMIT }, 429);

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: PROMPT },
        ],
      }],
      output_config: { format: { type: "json_schema", schema: ESTIMATE_SCHEMA } },
    }),
  });

  if (!claudeRes.ok) {
    console.error("anthropic_error", claudeRes.status, await claudeRes.text());
    return json({ error: "ai_unavailable" }, 502);
  }
  const msg = await claudeRes.json();
  if (msg.stop_reason === "refusal") return json({ error: "ai_refused" }, 422);

  const estimate = parseEstimate(msg);
  if (!estimate) return json({ error: "ai_unparseable" }, 502);
  return json(estimate);
});
