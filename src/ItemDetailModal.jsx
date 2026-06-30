import { X } from "./lib/icons.jsx";
import { proteinPer100g } from "./lib/nutrition.js";

// Read-only detail view for a logged entry (clicked from the Today screen). Bottom sheet
// matching FoodEditor / AddSheet. Shows name, grams eaten, protein-per-100g (derived),
// total protein, and calories. Grams is optional — legacy and quick-add entries have none,
// so amount and per-100g fall back to "—".
const round = (n) => Math.round(Number(n) || 0);
const label = { fontSize: 13, fontWeight: 600, color: "#8a8a93" };
const dash = "—";

export default function ItemDetailModal({ entry, onClose }) {
  const per100 = proteinPer100g(entry.proteinRaw, entry.grams);
  const rows = [
    { k: "כמות שנאכלה", v: entry.grams != null ? `${round(entry.grams)} גרם` : dash },
    { k: "חלבון ל-100 גרם", v: per100 != null ? `${round(per100)} גרם` : dash, color: "#34d399" },
    { k: "סך חלבון שנאכל", v: `${round(entry.proteinRaw)} גרם`, color: "#34d399" },
    { k: "קלוריות", v: `${entry.calories} קל'`, color: "#fbbf24" },
    { k: "מקור", v: entry.sub },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 56, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{ position: "relative", background: "#121215", borderTop: "1px solid #2a2a30", borderRadius: "26px 26px 0 0", maxHeight: "90%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ flex: "none", padding: "14px 20px 8px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "#33333a", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>פרטי רישום</div>
            <button onClick={onClose} aria-label="סגור" style={{ width: 34, height: 34, border: "none", borderRadius: 10, background: "#1e1e23", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
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
              <div key={r.k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "#161619", border: "1px solid #1f1f24", borderRadius: 14 }}>
                <span style={label}>{r.k}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: r.color || "#f4f4f5" }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
