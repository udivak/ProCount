import { useRef, useState } from "react";
import { Trash, X } from "./lib/icons.jsx";
import { MEAL_TYPES, proteinPer100g } from "./lib/nutrition.js";
import { withSubmissionLock } from "./lib/submission.js";

// Read-only detail view for a logged entry (clicked from the Today screen). Bottom sheet
// matching FoodEditor / AddSheet. Shows name, grams eaten, protein-per-100g (derived),
// total protein, and calories. Grams is optional — legacy and quick-add entries have none,
// so amount and per-100g fall back to "—".
const round = (n) => Math.round(Number(n) || 0);
const label = { fontSize: 13, fontWeight: 600, color: "#8a8a93" };
const dash = "—";
const MEAL_LABELS = { breakfast: "בוקר", lunch: "צהריים", dinner: "ערב", snack: "נשנוש" };

export default function ItemDetailModal({ entry, busy = false, onClose, onDelete, onMove }) {
  const [saving, setSaving] = useState(false);
  const [moveError, setMoveError] = useState("");
  const moveLock = useRef(false);
  const per100 = proteinPer100g(entry.proteinRaw, entry.grams);
  const currentMeal = MEAL_TYPES.includes(entry.meal_type) ? entry.meal_type : "snack";
  const isBusy = busy || saving;
  const close = () => { if (!isBusy && !moveLock.current) onClose(); };
  const move = (mealType) => withSubmissionLock(moveLock, async () => {
    if (isBusy || mealType === currentMeal) return;
    setSaving(true);
    setMoveError("");
    try {
      const result = await onMove(entry.id, mealType);
      if (result?.error || !result?.data) setMoveError("לא ניתן להעביר את הרישום כרגע. נסה שוב.");
    } catch {
      setMoveError("לא ניתן להעביר את הרישום כרגע. נסה שוב.");
    } finally {
      setSaving(false);
    }
  });
  const requestDelete = () => { if (!isBusy && !moveLock.current) onDelete(entry.id); };
  const rows = [
    { k: "כמות שנאכלה", v: entry.grams != null ? `${round(entry.grams)} גרם` : dash },
    { k: "חלבון ל-100 גרם", v: per100 != null ? `${round(per100)} גרם` : dash, color: "#39e6b2" },
    { k: "סך חלבון שנאכל", v: `${round(entry.proteinRaw)} גרם`, color: "#39e6b2" },
    { k: "קלוריות", v: `${entry.calories} קל'`, color: "#fb923c" },
    { k: "מקור", v: entry.sub },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 56, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease", cursor: isBusy ? "wait" : "pointer" }} />
      <div aria-busy={isBusy} style={{ position: "relative", background: "#0b1112", borderTop: "1px solid #26302f", borderRadius: "26px 26px 0 0", maxHeight: "90%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ flex: "none", padding: "14px 20px 8px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "#33333a", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>פרטי רישום</div>
            <button disabled={isBusy} onClick={close} aria-label="סגור" style={{ width: 34, height: 34, border: "none", borderRadius: 10, background: "#1e1e23", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? .45 : 1 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: entry.iconBg, color: entry.iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{entry.tag}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f4f5", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map((r) => (
              <div key={r.k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "#101516", border: "1px solid #1f1f24", borderRadius: 14 }}>
                <span style={label}>{r.k}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: r.color || "#f4f4f5" }}>{r.v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingTop: 4 }}>
            <div style={label}>העבר לארוחה</div>
            <div role="group" aria-label="העברת הרישום לארוחה" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MEAL_TYPES.map((mealType) => {
                const selected = mealType === currentMeal;
                return <button key={mealType} type="button" aria-pressed={selected} disabled={isBusy || selected} onClick={() => move(mealType)} style={{ border: "1px solid", borderColor: selected ? "#39e6b2" : "#26302f", borderRadius: 12, fontFamily: "inherit", background: selected ? "rgba(57,230,178,.12)" : "#101516", color: selected ? "#39e6b2" : "#d4d4d8", fontSize: 14, fontWeight: 700, padding: "11px 8px", cursor: isBusy || selected ? "not-allowed" : "pointer", opacity: isBusy || selected ? .65 : 1 }}>
                  {MEAL_LABELS[mealType]}
                </button>;
              })}
            </div>
            {saving && <div role="status" style={{ color: "#8a8a93", fontSize: 13, fontWeight: 700 }}>מעביר רישום...</div>}
            {moveError && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700 }}>{moveError}</div>}
          </div>
          <button disabled={isBusy} onClick={requestDelete} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", fontFamily: "inherit", background: "none", color: "#fb7185", fontSize: 14, fontWeight: 700, padding: "10px 8px", cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? .45 : 1 }}>
            <Trash size={16} /> מחק רישום
          </button>
        </div>
      </div>
    </div>
  );
}
