import { useState } from "react";
import { X, Trash } from "./lib/icons.jsx";

// Add / edit / delete a saved food (design §4 "מאכלים שלי" management). Bottom sheet
// matching the Add sheet. New food = empty object; edit = an existing food row.
const inputStyle = { width: "100%", background: "#18181c", border: "1px solid #2a2a30", borderRadius: 14, padding: 14, color: "#f4f4f5", fontSize: 16, fontFamily: "inherit", outline: "none" };
const label = { fontSize: 13, fontWeight: 600, color: "#8a8a93", display: "block", marginBottom: 7 };

export default function FoodEditor({ food, onSave, onDelete, onClose }) {
  const isEdit = !!food.id;
  const [name, setName] = useState(food.name || "");
  const [unit, setUnit] = useState(food.unit || "");
  const [protein, setProtein] = useState(food.protein_g != null ? String(food.protein_g) : "");
  const [calories, setCalories] = useState(food.calories != null ? String(food.calories) : "");

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 55, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{ position: "relative", background: "#121215", borderTop: "1px solid #2a2a30", borderRadius: "26px 26px 0 0", maxHeight: "90%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ flex: "none", padding: "14px 20px 8px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "#33333a", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{isEdit ? "עריכת מאכל" : "מאכל חדש"}</div>
            <button onClick={onClose} aria-label="סגור" style={{ width: 34, height: 34, border: "none", borderRadius: 10, background: "#1e1e23", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>שם</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: חזה עוף" aria-label="שם" style={inputStyle} />
          </div>
          <div>
            <label style={label}>מנה / יחידה</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="למשל: ל-100 גרם" aria-label="מנה או יחידה" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>חלבון (גרם)</label>
              <input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" aria-label="חלבון בגרמים" placeholder="0" style={{ ...inputStyle, color: "#34d399", fontSize: 18, fontWeight: 800 }} />
            </div>
            <div>
              <label style={label}>קלוריות</label>
              <input value={calories} onChange={(e) => setCalories(e.target.value)} inputMode="decimal" aria-label="קלוריות" placeholder="0" style={{ ...inputStyle, color: "#fbbf24", fontSize: 18, fontWeight: 800 }} />
            </div>
          </div>

          <button onClick={() => onSave({ id: food.id, name, unit, protein, calories })} style={{ marginTop: 4, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#34d399,#1f9d6f)", color: "#06120c", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 15, cursor: "pointer" }}>
            {isEdit ? "שמור שינויים" : "הוסף מאכל"}
          </button>

          {isEdit && (
            <button onClick={() => onDelete(food.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", fontFamily: "inherit", background: "none", color: "#fb7185", fontSize: 14, fontWeight: 700, padding: 8, cursor: "pointer" }}>
              <Trash size={16} /> מחק מאכל
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
