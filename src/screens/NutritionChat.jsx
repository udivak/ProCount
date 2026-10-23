import { useEffect, useRef } from "react";
import { chatTotals } from "../lib/chat.js";
const button = {
  minHeight: 44,
  border: "1px solid #34433b",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#1b2620",
  color: "#cce7dc",
  fontFamily: "inherit",
  fontSize: 14,
  cursor: "pointer",
};
const input = {
  width: "100%",
  minHeight: 44,
  padding: 10,
  border: "1px solid #34433b",
  borderRadius: 10,
  background: "#171f1a",
  color: "#f4f7f6",
  fontFamily: "inherit",
  fontSize: 16,
  colorScheme: "dark",
};
const meals = {
  breakfast: "בוקר",
  lunch: "צהריים",
  dinner: "ערב",
  snack: "נשנוש",
};
const confidence = { low: "נמוכה", medium: "בינונית", high: "גבוהה" };
export default function NutritionChat(
  {
    chat,
    onSend,
    onEditItem,
    onRemoveItem,
    onApprove,
    onRetry,
    onResolve,
    onNewChat,
    onClose,
    onCompose,
    onPickImage,
    onRemoveImage,
    onDate,
    onContextRange,
    onRefreshContext,
  },
) {
  const panel = useRef(null),
    close = useRef(null),
    gallery = useRef(null),
    camera = useRef(null),
    scroll = useRef(null);
  const locked = chat.status === "saving" || !!chat.attempt;
  const busy = ["analyzing", "preparing", "saving"].includes(chat.status);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    const key = (e) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const nodes = [
          ...panel.current.querySelectorAll(
            "button:not(:disabled),input:not(:disabled):not([hidden]),textarea:not(:disabled),select:not(:disabled)",
          ),
        ];
        const first = nodes[0], last = nodes.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !panel.current.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !panel.current.contains(document.activeElement))
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, [onClose]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [chat.messages.length, chat.status]);
  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPickImage(file);
  };
  const field = (item, key, title, type = "text") => (
    <label style={{ display: "block", fontSize: 13, marginTop: 8 }}>
      {title}
      <input
        aria-label={title + " — " + item.name}
        disabled={locked}
        type={type}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : type === "date" ? chat.oldest : undefined}
        max={type === "date" ? chat.today : undefined}
        dir={type === "number" ? "ltr" : undefined}
        value={item[key] ?? ""}
        onChange={(e) =>
          onEditItem(
            item.draftKey,
            key,
            type === "number"
              ? (e.target.value === "" ? null : Number(e.target.value))
              : e.target.value,
          )}
        style={input}
      />
    </label>
  );
  const totals = chatTotals(chat.items);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 55,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.65)",
        }}
      />
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutrition-chat-title"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          height: "92%",
          maxHeight: "92dvh",
          background: "#0e1510",
          border: "1px solid #34433b",
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid #29392e",
          }}
        >
          <h2
            id="nutrition-chat-title"
            style={{ fontSize: 19, flex: 1, margin: 0 }}
          >
            הוספה בשיחה
          </h2>
          <button
            disabled={busy || !!chat.attempt}
            style={button}
            onClick={onNewChat}
          >
            שיחה חדשה
          </button>
          <button
            ref={close}
            style={button}
            onClick={onClose}
            aria-label="סגירת השיחה"
          >
            סגור
          </button>
        </header>
        <div
          ref={scroll}
          className="pc-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            padding: "12px 18px",
          }}
        >
          <p style={{ fontSize: 12, color: "#98aea0", marginTop: 0 }}>
            הצעות AI הן אומדנים. רק אישור הטיוטה מוסיף ליומן. השיחה נשמרת עד
            רענון או יציאה מהחשבון; לאחר רענון בזמן שמירה יש לבדוק ביומן מה
            נשמר.
          </p>
          <label>
            תאריך ברירת מחדל<input
              aria-label="תאריך ברירת מחדל לשיחה"
              disabled={locked}
              type="date"
              value={chat.selectedDate}
              min={chat.oldest}
              max={chat.today}
              onChange={(e) => onDate(e.target.value)}
              style={input}
            />
          </label>
          <div style={{ fontSize: 12, color: "#98aea0", marginTop: 5 }}>
            היום בהקשר השיחה: {chat.today} · ״אתמול״ מחושב ביחס אליו
          </div>
          <button
            disabled={busy || locked}
            style={{ ...button, marginTop: 8 }}
            onClick={onRefreshContext}
          >
            רענון הקשר התאריך
          </button>
          {chat.error === "context_too_large" && (
            <fieldset
              disabled={busy || locked}
              style={{
                marginTop: 10,
                border: "1px solid #34433b",
                borderRadius: 12,
              }}
            >
              <legend>צמצום מפורש של חלון ההקשר</legend>
              {[["contextFrom", "מתאריך"], ["contextTo", "עד תאריך"]].map((
                [key, title],
              ) => (
                <label key={key}>
                  {title}
                  <input
                    aria-label={title + " להקשר"}
                    type="date"
                    min={chat.oldest}
                    max={chat.today}
                    value={chat[key] || ""}
                    style={input}
                    onChange={(e) => onContextRange(key, e.target.value)}
                  />
                </label>
              ))}
              <p>
                לאחר הבחירה שלח שוב את ההודעה. אם קטלוג המזונות עצמו גדול מדי,
                נדרש לצמצמו בנפרד.
              </p>
            </fieldset>
          )}
          <div role="log" aria-label="הודעות השיחה" aria-live="polite">
            {chat.messages.map((m, i) => (
              <div
                key={i}
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: m.role === "user" ? "#1c3025" : "#172019",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                <div
                  style={{ fontSize: 11, color: "#98aea0", marginBottom: 5 }}
                >
                  {m.role === "user" ? "אתה" : "עוזר התזונה"}
                </div>
                {m.text}
                {(m.images || []).map((image, j) => (
                  <img
                    key={j}
                    src={"data:image/jpeg;base64," + image}
                    alt={"תמונת מנה " + (j + 1)}
                    style={{
                      width: 100,
                      height: 90,
                      objectFit: "cover",
                      borderRadius: 10,
                      margin: 4,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          {chat.contextReview && (
            <div
              role="status"
              style={{
                border: "1px solid #f5ba63",
                padding: 12,
                borderRadius: 12,
                marginTop: 12,
              }}
            >
              <strong>הרישומים העדכניים — יש לבדוק לפני אישור נוסף</strong>
              {chat.contextReview.length
                ? chat.contextReview.map((r) => (
                  <p key={r.id} style={{ fontSize: 13 }}>
                    {r.eaten_on} · {r.name} · {Number(r.calories)} קל׳ ·{" "}
                    {Number(r.protein_g)}{" "}
                    גרם חלבון{r.water_ml ? " · " + r.water_ml + " מ״ל" : ""}
                  </p>
                ))
                : <p>אין רישומים בימים שנבדקו.</p>}
            </div>
          )}
          {chat.items.map((item) => (
            <article
              key={item.draftKey}
              style={{
                padding: 14,
                marginTop: 14,
                border: "1px solid #34433b",
                borderRadius: 16,
                opacity: chat.attempt?.savedKeys.includes(item.draftKey)
                  ? .6
                  : 1,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <strong style={{ flex: 1 }}>
                  {item.kind === "water" ? "מים" : "הצעת אוכל"}
                </strong>
                <button
                  disabled={locked}
                  style={button}
                  onClick={() => onRemoveItem(item.draftKey)}
                >
                  הסר
                </button>
              </div>
              {field(item, "date", "תאריך", "date")}
              {item.kind === "food" && (
                <label style={{ display: "block", marginTop: 8 }}>
                  ארוחה<select
                    aria-label={"ארוחה — " + item.name}
                    disabled={locked}
                    value={item.mealType}
                    style={input}
                    onChange={(e) =>
                      onEditItem(item.draftKey, "mealType", e.target.value)}
                  >
                    {Object.entries(meals).map(([key, title]) => (
                      <option key={key} value={key}>{title}</option>
                    ))}
                  </select>
                </label>
              )}
              {field(item, "name", "שם")}
              {field(item, "quantityText", "כמות תיאורית")}
              {item.kind === "water"
                ? field(item, "water_ml", "מים במ״ל", "number")
                : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {field(item, "protein_g", "חלבון בגרם", "number")}
                    {field(item, "calories", "קלוריות", "number")}
                    {field(
                      item,
                      "grams",
                      "משקל כל הפריט בגרם (אם ידוע)",
                      "number",
                    )}
                  </div>
                )}
              <p style={{ fontSize: 12, color: "#b9ccbf", marginBottom: 0 }}>
                ביטחון: {confidence[item.confidence]}
                {item.assumptions.length
                  ? " · " + item.assumptions.join(" · ")
                  : ""}
              </p>
              {chat.dirtyKeys.includes(item.draftKey) && (
                <p role="status" style={{ fontSize: 12, color: "#f5ba63" }}>
                  הערכים לא חושבו מחדש. לעדכון האומדן בקש תיקון בשיחה.
                </p>
              )}
            </article>
          ))}
          {Object.entries(totals).map(([date, groups]) => (
            <div
              key={date}
              style={{ padding: 12, color: "#82e6b4", fontSize: 13 }}
            >
              <strong>{date}</strong>
              {Object.entries(groups).map(([meal, t]) => (
                <div key={meal}>
                  {meal === "total" ? "סך היום המוצע" : meals[meal]}:{" "}
                  {Math.round(t.protein)} גרם חלבון · {Math.round(t.calories)}
                  {" "}
                  קל׳ · {t.water} מ״ל
                </div>
              ))}
            </div>
          ))}
        </div>
        <footer
          style={{
            padding: "10px 18px max(16px, env(safe-area-inset-bottom))",
            borderTop: "1px solid #29392e",
            background: "#111a14",
            maxHeight: "45%",
            overflowY: "auto",
          }}
        >
          <div
            aria-live="polite"
            role="status"
            style={{ fontSize: 13, marginBottom: 8 }}
          >
            {chat.notice || (chat.status === "analyzing"
              ? "מכין הצעה…"
              : chat.status === "saving"
              ? "שומר…"
              : chat.needsClarification && chat.messages.length
              ? "נדרש בירור בשיחה לפני האישור"
              : "")}
          </div>
          {chat.error && (
            <div
              role="alert"
              style={{ fontSize: 13, color: "#fda4af", marginBottom: 8 }}
            >
              {chat.errorText}
            </div>
          )}
          {!chat.attempt && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {chat.images.map((image, i) => (
                  <div key={i}>
                    <img
                      src={"data:image/jpeg;base64," + image}
                      alt={"תמונה מצורפת " + (i + 1)}
                      style={{
                        width: 56,
                        height: 48,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                    <button
                      disabled={locked}
                      style={button}
                      onClick={() => onRemoveImage(i)}
                      aria-label={"הסרת תמונה " + (i + 1)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <label style={{ fontSize: 13 }} htmlFor="chat-message">
                מה אכלת או שתית?
              </label>
              <textarea
                id="chat-message"
                disabled={locked}
                rows={2}
                maxLength={4000}
                value={chat.compose}
                onChange={(e) => onCompose(e.target.value)}
                placeholder="למשל: אתמול אכלתי כריך, והיום שתיתי ליטר נוסף"
                style={{ ...input, resize: "vertical" }}
              />
              <input
                ref={gallery}
                hidden
                type="file"
                accept="image/*"
                onChange={pick}
              />
              <input
                ref={camera}
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                onChange={pick}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  disabled={busy}
                  style={button}
                  onClick={() => gallery.current.click()}
                >
                  תמונה
                </button>
                <button
                  disabled={busy}
                  style={button}
                  onClick={() => camera.current.click()}
                >
                  מצלמה
                </button>
                <button
                  disabled={busy || !chat.compose.trim() && !chat.images.length}
                  style={{ ...button, flex: 1 }}
                  onClick={onSend}
                >
                  שלח
                </button>
              </div>
              <button
                disabled={busy || chat.needsClarification || !chat.items.length}
                style={{
                  ...button,
                  width: "100%",
                  marginTop: 8,
                  background: "#39e6b2",
                  color: "#03120d",
                  fontWeight: 800,
                }}
                onClick={onApprove}
              >
                אישור והוספה
              </button>
            </>
          )}
          {chat.attempt && chat.status !== "saving" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...button, flex: 1 }} onClick={onRetry}>
                {chat.error === "context_changed"
                  ? "בדקתי — אישור והוספת הנותרים"
                  : "נסה שוב עם אותם רישומים"}
              </button>
              <button style={{ ...button, flex: 1 }} onClick={onResolve}>
                בדוק מה נשמר וחזור לעריכה
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}
