import { useEffect, useRef, useState } from "react";
import { X, Trash } from "./lib/icons.jsx";
import { acquireRequestLock, captureFoodEstimateRequest, captureRequestRevision, clearRequestLock, releaseRequestLock } from "./lib/request.js";
import { withSubmissionLock } from "./lib/submission.js";

// Add / edit / delete a saved food (design §4 "מאכלים שלי" management). Bottom sheet
// matching the Add sheet. New food = empty object; edit = an existing food row.
const inputStyle = { width: "100%", minHeight: 52, background: "#171b18", border: "1px solid #2b342f", borderRadius: 13, padding: 14, color: "#f4f7f6", fontSize: 16, fontFamily: "inherit", outline: "none" };
const label = { fontSize: 13, fontWeight: 700, color: "#8a9994", display: "block", marginBottom: 7 };
const section = { padding: 15, border: "1px solid #2b342f", borderRadius: 18, background: "#111512" };
const MEASURES = ["יחידה", "כף", "כפית", "כוס", "פרוסה", "סקופ", "קופסה", "מנה", "100 גרם"];

export default function FoodEditor({ food, onSave, onEstimateNutrition, onDelete, onClose }) {
  const isEdit = !!food.id;
  const [draftId] = useState(() => food.id || crypto.randomUUID());
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const saveLock = useRef(false);
  const estimateRevision = useRef(0);
  const estimateLock = useRef(null);
  const closeRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState({ state: "idle", note: "", error: "", unit: "" });
  const [name, setName] = useState(food.name || "");
  const initialUnit = food.unit || "מנה";
  const [selectedUnit, setSelectedUnit] = useState(MEASURES.includes(initialUnit) ? initialUnit : "אחר");
  const [customUnit, setCustomUnit] = useState(MEASURES.includes(initialUnit) ? "" : initialUnit);
  const [protein, setProtein] = useState(food.protein_g != null ? String(food.protein_g) : "");
  const [calories, setCalories] = useState(food.calories != null ? String(food.calories) : "");
  const unit = selectedUnit === "אחר" ? customUnit.trim() : selectedUnit;
  const canSave = selectedUnit !== "אחר" || !!unit;
  const canEstimate = !isEdit && !!name.trim() && canSave && !!unit;
  const estimating = estimate.state === "loading";
  const estimatePending = !!estimateLock.current;
  const invalidateEstimate = (clearLock = false) => {
    if (clearLock) clearRequestLock(estimateLock);
    captureRequestRevision(estimateRevision);
    setEstimate({ state: "idle", note: "", error: "", unit: "" });
  };
  const change = (setValue) => (event) => {
    setSaveError("");
    setSaveNotice("");
    invalidateEstimate();
    setValue(event.target.value);
  };
  const save = () => {
    if (estimateLock.current) return;
    return withSubmissionLock(saveLock, async () => {
    setSaving(true);
    setSaveError("");
    setSaveNotice("");
    try {
      const result = await onSave({ id: draftId, isEdit, name, unit, protein, calories });
      if (result.error) setSaveError(result.conflict ? "כבר קיים מאכל זהה במאגר. לא בוצע שינוי." : "לא ניתן לשמור את המאכל כרגע. נסה שוב.");
      else if (result.reused) setSaveNotice("המאכל כבר קיים במאגר — לא נוצר מאכל נוסף.");
    } finally {
      setSaving(false);
    }
    });
  };
  const estimateNutrition = async () => {
    if (!canEstimate || saving || saveLock.current) return;
    const lockToken = acquireRequestLock(estimateLock);
    if (!lockToken) return;
    const request = captureFoodEstimateRequest(estimateRevision, name, unit);
    setEstimate({ state: "loading", note: "", error: "", unit: request.unit });
    try {
      const result = await onEstimateNutrition(request.foodName, request.unit);
      if (!request.isCurrent()) return;
      if (result?.estimate) {
        setProtein(String(Math.round(Number(result.estimate.protein_g) || 0)));
        setCalories(String(Math.round(Number(result.estimate.calories) || 0)));
        setEstimate({ state: "done", note: result.estimate.note || "אפשר לתקן את הערכים לפני השמירה.", error: "", unit: request.unit });
      } else {
        const error = result?.error === "daily_limit"
          ? "נגמרו ההשלמות עם AI להיום — אפשר להמשיך למלא ידנית."
          : "לא ניתן להשלים ערכים עם AI כרגע — אפשר להמשיך למלא ידנית.";
        setEstimate({ state: "idle", note: "", error, unit: "" });
      }
    } catch {
      if (request.isCurrent()) setEstimate({ state: "idle", note: "", error: "לא ניתן להשלים ערכים עם AI כרגע — אפשר להמשיך למלא ידנית.", unit: "" });
    } finally {
      if (estimateLock.current === lockToken) {
        releaseRequestLock(estimateLock, lockToken);
        setEstimate((current) => current.state === "loading"
          ? { state: "idle", note: "", error: "", unit: "" }
          : { ...current });
      }
    }
  };
  const close = () => {
    if (saveLock.current || saving) return;
    invalidateEstimate(true);
    onClose();
  };

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape" && !saveLock.current && !saving) { invalidateEstimate(true); onClose(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [saving, onClose]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 55, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)", animation: "fadeIn .2s ease", cursor: saving ? "wait" : "pointer" }} />
      <div role="dialog" aria-modal="true" aria-labelledby="food-editor-title" aria-busy={saving} style={{ position: "relative", background: "rgba(15,19,17,.97)", WebkitBackdropFilter: "blur(24px)", backdropFilter: "blur(24px)", borderTop: "1px solid #34403b", borderRadius: "28px 28px 0 0", maxHeight: "92%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)", boxShadow: "0 -18px 50px rgba(0,0,0,.35)" }}>
        <div style={{ flex: "none", padding: "18px 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div id="food-editor-title" style={{ fontSize: 22, fontWeight: 900 }}>{isEdit ? "עריכת מאכל" : "מאכל חדש"}</div>
            <button ref={closeRef} disabled={saving} onClick={close} aria-label="סגור" style={{ width: 44, height: 44, border: "1px solid #333c38", borderRadius: 14, background: "#202521", color: "#aab5b1", display: "flex", alignItems: "center", justifyContent: "center", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .45 : 1 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 20px max(28px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12 }}>
          <section style={section}>
            <label style={label}>שם</label>
            <input disabled={saving} value={name} onChange={change(setName)} placeholder="למשל: חזה עוף" aria-label="שם" style={inputStyle} />
            {!isEdit && <div style={{ marginTop: 6, color: "#8a8a93", fontSize: 12, lineHeight: 1.4 }}>אפשר לדייק בשם עם מותג או מצב הכנה, למשל מבושל או נא.</div>}
          </section>
          <section style={section}>
            <label style={label}>מידה יומית</label>
            <select disabled={saving} value={selectedUnit} onChange={change(setSelectedUnit)} aria-label="מידה יומית" style={inputStyle}>
              {MEASURES.map((measure) => <option key={measure} value={measure}>{measure}</option>)}
              <option value="אחר">אחר</option>
            </select>
            {selectedUnit === "אחר" && <input disabled={saving} value={customUnit} onChange={change(setCustomUnit)} placeholder="למשל: חצי כוס" aria-label="מידה מותאמת" style={{ ...inputStyle, marginTop: 10 }} />}
          </section>
          <section style={{ ...section, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={label}>חלבון (גרם)</label>
              <input disabled={saving} value={protein} onChange={change(setProtein)} inputMode="decimal" aria-label="חלבון בגרמים" placeholder="0" style={{ ...inputStyle, color: "#39e6b2", fontSize: 18, fontWeight: 800 }} />
            </div>
            <div>
              <label style={label}>קלוריות</label>
              <input disabled={saving} value={calories} onChange={change(setCalories)} inputMode="decimal" aria-label="קלוריות" placeholder="0" style={{ ...inputStyle, color: "#fb923c", fontSize: 18, fontWeight: 800 }} />
            </div>
          </section>

          {!isEdit && <div style={{ color: "#8a8a93", fontSize: 12, lineHeight: 1.4 }}>השלמת הערכים משתמשת בקריאת AI מהמכסה היומית.</div>}
          {!isEdit && canEstimate && <button disabled={estimatePending || saving} onClick={estimateNutrition} style={{ border: "1px solid #42675b", fontFamily: "inherit", background: "#15231e", color: "#9ef2d2", fontSize: 15, fontWeight: 800, padding: 13, borderRadius: 14, cursor: estimatePending || saving ? "not-allowed" : "pointer", opacity: estimatePending || saving ? .55 : 1 }}>
            {estimating || estimatePending ? "AI משלים..." : "השלם ערכים עם AI"}
          </button>}
          {estimate.state === "done" && <div role="status" style={{ color: "#9ef2d2", fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}><strong>הערכת AI עבור <bdi>{estimate.unit}</bdi>:</strong> {estimate.note}</div>}
          {estimate.error && <div role="alert" style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>{estimate.error}</div>}

          {saveError && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{saveError}</div>}
          {saveNotice && <div role="status" style={{ color: "#39e6b2", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{saveNotice}</div>}
          <button disabled={!canSave || saving || estimatePending} onClick={save} style={{ minHeight: 52, marginTop: 4, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#39e6b2,#24bd91)", color: "#03120d", fontSize: 16, fontWeight: 900, padding: 15, borderRadius: 16, cursor: canSave && !saving && !estimatePending ? "pointer" : "not-allowed", opacity: canSave && !saving && !estimatePending ? 1 : .45 }}>
            {saving ? "שומר..." : isEdit ? "שמור שינויים" : "הוסף מאכל"}
          </button>

          {isEdit && (
            <button disabled={saving} onClick={() => onDelete(food.id)} style={{ minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #7b3038", borderRadius: 16, fontFamily: "inherit", background: "#201416", color: "#fb7185", fontSize: 14, fontWeight: 800, padding: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .45 : 1 }}>
              <Trash size={16} /> מחק מאכל
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
