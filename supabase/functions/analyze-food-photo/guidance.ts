export const MAX_GUIDANCE_LENGTH = 1000;

export function buildGuidanceContent(value: unknown) {
  const guidance = typeof value === "string" ? value.trim() : "";
  if (guidance.length > MAX_GUIDANCE_LENGTH) return null;
  return guidance ? [{ type: "text", text: `מידע נוסף מהמשתמש על המנה:\n${guidance}` }] : [];
}
