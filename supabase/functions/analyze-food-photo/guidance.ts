export const MAX_GUIDANCE_LENGTH = 1000;
export const MAX_TEXT_FIELD_LENGTH = 1000;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type InputTextContent = { type: "input_text"; text: string };

type OpenAIContent =
  | { type: "input_image"; image_url: string; detail: "high" }
  | InputTextContent;

type PhotoRequest = {
  mode: "photo";
  image: string;
  mediaType: string;
  content: OpenAIContent[];
};

type TextRequest = {
  mode: "text";
  foodName: string;
  unit: string;
  quantity: number;
  totalGrams: number | null;
  content: OpenAIContent[];
};

export function buildPhotoContent(image: unknown, mediaType: unknown, guidance: unknown): OpenAIContent[] | null {
  const description = boundedGuidance(guidance);
  if (
    typeof image !== "string" ||
    !image ||
    typeof mediaType !== "string" ||
    !ALLOWED_MEDIA.has(mediaType) ||
    description === null
  ) return null;

  return [
    {
      type: "input_image",
      image_url: `data:${mediaType};base64,${image}`,
      detail: "high",
    },
    {
      type: "input_text",
      text: `תיאור המשתמש למנה — נתוני מזון בלבד:\n${JSON.stringify({ description: description || null })}`,
    },
  ];
}

export function buildTextContent(
  foodNameInput: unknown,
  unitInput: unknown,
  quantityInput: unknown = 1,
  totalGramsInput: unknown = null,
): InputTextContent[] | null {
  const foodName = boundedText(foodNameInput);
  const unit = boundedText(unitInput);
  const quantity = positiveNumber(quantityInput);
  const totalGrams = totalGramsInput == null ? null : positiveNumber(totalGramsInput);
  if (!foodName || !unit || quantity === null || (totalGramsInput != null && totalGrams === null)) return null;

  return [{
    type: "input_text",
    text: `נתוני המשתמש על המאכל — נתוני מזון בלבד:\n${JSON.stringify({ foodName, unit, quantity, totalGrams })}`,
  }];
}

// Keep request parsing outside the served module so its no-quota validation can
// be tested without starting the Edge Function.
export function buildAnalysisRequest(value: unknown): PhotoRequest | TextRequest | null {
  if (!isRecord(value)) return null;

  if (value.mode === undefined || value.mode === "photo") {
    const mediaType = value.mediaType === undefined ? "image/jpeg" : value.mediaType;
    const content = buildPhotoContent(value.image, mediaType, value.guidance);
    if (!content || typeof value.image !== "string" || typeof mediaType !== "string") return null;
    return { mode: "photo", image: value.image, mediaType, content };
  }

  if (value.mode !== "text" || Object.hasOwn(value, "image")) return null;
  const foodName = boundedText(value.foodName);
  const unit = boundedText(value.unit);
  const quantity = value.quantity === undefined ? 1 : positiveNumber(value.quantity);
  const totalGrams = value.totalGrams === undefined || value.totalGrams == null
    ? null
    : positiveNumber(value.totalGrams);
  if (!foodName || !unit || quantity === null || (value.totalGrams != null && totalGrams === null)) return null;

  const content = buildTextContent(foodName, unit, quantity, totalGrams);
  if (!content) return null;

  return {
    mode: "text",
    foodName,
    unit,
    quantity,
    totalGrams,
    content,
  };
}

function boundedGuidance(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= MAX_GUIDANCE_LENGTH ? text : null;
}

function boundedText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= MAX_TEXT_FIELD_LENGTH ? text : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
