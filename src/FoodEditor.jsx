import { useRef, useState } from "react";
import { X, Trash } from "./lib/icons.jsx";
import { withSubmissionLock } from "./lib/submission.js";

// Add / edit / delete a saved food (design §4 "מאכלים שלי" management). Bottom sheet
// matching the Add sheet. New food = empty object; edit = an existing food row.
const inputStyle = { width: "100%", background: "#111718", border: "1px solid #26302f", borderRadius: 14, padding: 14, color: "#f4f4f5", fontSize: 16, fontFamily: "inherit", outline: "none" };
const label = { fontSize: 13, fontWeight: 600, color: "#8a8a93", display: "block", marginBottom: 7 };
const MEASURES = ["יחידה", "כף", "כפית", "כוס", "פרוסה", "סקופ", "קופסה", "מנה", "100 גרם"];

export default function FoodEditor({ food, onSave, onDelete, onClose }) {
  const isEdit = !!food.id;
  const [draftId] = useState(() => food.id || crypto.randomUUID());
  const [saveError, setSaveError] = useState("");
  const saveLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(food.name || "");
  const initialUnit = food.unit || "מנה";
  const [selectedUnit, setSelectedUnit] = useState(MEASURES.includes(initialUnit) ? initialUnit : "אחר");
  const [customUnit, setCustomUnit] = useState(MEASURES.includes(initialUnit) ? "" : initialUnit);
  const [protein, setProtein] = useState(food.protein_g != null ? String(food.protein_g) : "");
  const [calories, setCalories] = useState(food.calories != null ? String(food.calories) : "");
  const unit = selectedUnit === "אחר" ? customUnit.trim() : selectedUnit;
  const canSave = selectedUnit !== "אחר" || !!unit;
  const save = () => withSubmissionLock(saveLock, async () => {
    setSaving(true);
    setSaveError("");
    try {
      const result = await onSave({ id: draftId, isEdit, name, unit, protein, calories });
      if (result.error) setSaveError("לא ניתן לשמור את המאכל כרגע. נסה שוב.");
    } finally {
      setSaving(false);
    }
  });
  const close = () => { if (!saveLock.current && !saving) onClose(); };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 55, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{ position: "relative", background: "#0b1112", borderTop: "1px solid #26302f", borderRadius: "26px 26px 0 0", maxHeight: "90%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ flex: "none", padding: "14px 20px 8px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "#33333a", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{isEdit ? "עריכת מאכל" : "מאכל חדש"}</div>
            <button disabled={saving} onClick={close} aria-label="סגור" style={{ width: 34, height: 34, border: "none", borderRadius: 10, background: "#1e1e23", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .45 : 1 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>שם</label>
            <input disabled={saving} value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: חזה עוף" aria-label="שם" style={inputStyle} />
          </div>
          <div>
            <label style={label}>מידה יומית</label>
            <select disabled={saving} value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} aria-label="מידה יומית" style={inputStyle}>
              {MEASURES.map((measure) => <option key={measure} value={measure}>{measure}</option>)}
              <option value="אחר">אחר</option>
            </select>
            {selectedUnit === "אחר" && <input disabled={saving} value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="למשל: חצי כוס" aria-label="מידה מותאמת" style={{ ...inputStyle, marginTop: 10 }} />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>חלבון (גרם)</label>
              <input disabled={saving} value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" aria-label="חלבון בגרמים" placeholder="0" style={{ ...inputStyle, color: "#39e6b2", fontSize: 18, fontWeight: 800 }} />
            </div>
            <div>
              <label style={label}>קלוריות</label>
              <input disabled={saving} value={calories} onChange={(e) => setCalories(e.target.value)} inputMode="decimal" aria-label="קלוריות" placeholder="0" style={{ ...inputStyle, color: "#fb923c", fontSize: 18, fontWeight: 800 }} />
            </div>
          </div>

          <button disabled={!canSave || saving} onClick={save} style={{ marginTop: 4, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#39e6b2,#16a985)", color: "#03120d", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 15, cursor: canSave && !saving ? "pointer" : "not-allowed", opacity: canSave && !saving ? 1 : .45 }}>
            {saving ? "שומר..." : isEdit ? "שמור שינויים" : "הוסף מאכל"}
          </button>
          {saveError && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{saveError}</div>}

          {isEdit && (
            <button disabled={saving} onClick={() => onDelete(food.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", fontFamily: "inherit", background: "none", color: "#fb7185", fontSize: 14, fontWeight: 700, padding: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .45 : 1 }}>
              <Trash size={16} /> מחק מאכל
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
