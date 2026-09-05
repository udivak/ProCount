import { useEffect, useRef, useState } from "react";
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
  const closeRef = useRef(null);
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

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape" && !isBusy && !moveLock.current) onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [isBusy, onClose]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 56, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)", animation: "fadeIn .2s ease", cursor: isBusy ? "wait" : "pointer" }} />
      <div className="pc-sheet" role="dialog" aria-modal="true" aria-labelledby="entry-detail-title" aria-busy={isBusy} style={{ position: "relative", background: "rgba(15,19,17,.97)", WebkitBackdropFilter: "blur(24px)", backdropFilter: "blur(24px)", borderTop: "1px solid #34403b", borderRadius: "28px 28px 0 0", maxHeight: "92%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)", boxShadow: "0 -18px 50px rgba(0,0,0,.35)" }}>
        <div style={{ flex: "none", padding: "18px 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div id="entry-detail-title" style={{ fontSize: 22, fontWeight: 900 }}>פרטי רישום</div>
            <button ref={closeRef} disabled={isBusy} onClick={close} aria-label="סגור" style={{ width: 44, height: 44, border: "1px solid #333c38", borderRadius: 14, background: "#202521", color: "#aab5b1", display: "flex", alignItems: "center", justifyContent: "center", cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? .45 : 1 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 20px max(28px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 14 }}>
          <section style={{ overflow: "hidden", border: "1px solid #2b342f", borderRadius: 20, background: "#111512" }}>
            <div style={{ minHeight: 68, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #2b342f" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f4f7f6", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
              <div style={{ padding: "7px 10px", borderRadius: 9, background: entry.iconBg, color: entry.iconColor, fontSize: 11, fontWeight: 800, flex: "none" }}>{entry.tag}</div>
            </div>
            {rows.map((r) => (
              <div key={r.k} style={{ minHeight: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #2b342f" }}>
                <span style={label}>{r.k}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: r.color || "#f4f7f6" }}><bdi>{r.v}</bdi></span>
              </div>
            ))}
          </section>
          <section style={{ display: "flex", flexDirection: "column", gap: 9, padding: 15, border: "1px solid #2b342f", borderRadius: 18, background: "#111512" }}>
            <div style={label}>העבר לארוחה</div>
            <div role="group" aria-label="העברת הרישום לארוחה" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
              {MEAL_TYPES.map((mealType) => {
                const selected = mealType === currentMeal;
                return <button key={mealType} type="button" aria-pressed={selected} disabled={isBusy || selected} onClick={() => move(mealType)} style={{ minHeight: 44, border: "1px solid", borderColor: selected ? "#39e6b2" : "#303a35", borderRadius: 12, fontFamily: "inherit", background: selected ? "#1a332b" : "#171b18", color: selected ? "#39e6b2" : "#b8c2be", fontSize: 12, fontWeight: 800, padding: "10px 4px", cursor: isBusy || selected ? "not-allowed" : "pointer", opacity: isBusy || selected ? .65 : 1 }}>
                  {MEAL_LABELS[mealType]}
                </button>;
              })}
            </div>
            {saving && <div role="status" style={{ color: "#8a8a93", fontSize: 13, fontWeight: 700 }}>מעביר רישום...</div>}
            {moveError && <div role="alert" style={{ color: "#fb7185", fontSize: 13, fontWeight: 700 }}>{moveError}</div>}
          </section>
          <button disabled={isBusy} onClick={requestDelete} style={{ minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #7b3038", borderRadius: 16, fontFamily: "inherit", background: "#201416", color: "#fb7185", fontSize: 14, fontWeight: 800, padding: "10px 8px", cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? .45 : 1 }}>
            <Trash size={16} /> מחק רישום
          </button>
        </div>
      </div>
    </div>
  );
}
