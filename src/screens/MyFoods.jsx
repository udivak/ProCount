import { useState } from "react";
import { Plus, Pencil } from "../lib/icons.jsx";
import { normalizeFoodText, searchFoods } from "../lib/write.js";

// My Foods — saved templates. New food opens the catalog editor; pencil edits/deletes.
export default function MyFoods({ foods, onNew, onEdit }) {
  const [query, setQuery] = useState("");
  const shownFoods = searchFoods(foods, query);
  const isSearching = Boolean(normalizeFoodText(query));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#8a9994" }}>{isSearching ? `${shownFoods.length} מתוך ${foods.length} מאכלים` : `${foods.length} מאכלים שמורים`}</div>
        <button className="h-newfood" onClick={onNew} style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 7, border: "1px solid #39e6b2", background: "transparent", color: "#39e6b2", fontSize: 14, fontWeight: 800, fontFamily: "inherit", padding: "8px 14px", borderRadius: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
          <Plus size={17} sw={2.5} /> מאכל חדש
        </button>
      </div>

      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חפש מאכל קיים" aria-label="חיפוש מאכלים" autoComplete="off" disabled={foods.length === 0} style={{ width: "100%", minHeight: 52, boxSizing: "border-box", background: "#171b18", border: "1px solid #2a342f", borderRadius: 16, padding: "13px 16px", color: "#f4f7f6", fontSize: 15, fontFamily: "inherit", outline: "none", opacity: foods.length === 0 ? .55 : 1 }} />
      {foods.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8a9994", fontSize: 14, padding: "34px 18px", border: "1px solid #27302c", borderRadius: 20, background: "#111512" }}>אין מאכלים שמורים עדיין</div>
      ) : shownFoods.length === 0 ? <div style={{ textAlign: "center", color: "#8a9994", fontSize: 14, padding: "34px 18px", border: "1px solid #27302c", borderRadius: 20, background: "#111512" }}>לא נמצאו מאכלים תואמים</div> : <div style={{ overflow: "hidden", border: "1px solid #27302c", borderRadius: 22, background: "#111512" }}>
          {shownFoods.map((f) => (
            <button key={f.id} className="my-food-card" onClick={() => onEdit(f)} aria-label={`ערוך ${f.name}`} style={{ width: "100%", minHeight: 82, display: "flex", alignItems: "center", gap: 14, background: "transparent", color: "#f4f7f6", border: 0, borderBottom: "1px solid #27302c", fontFamily: "inherit", textAlign: "right", padding: "14px 16px", cursor: "pointer" }}>
              <div className="my-food-copy" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{f.name}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8a9994", marginTop: 2 }}>{f.unit}</div>
              </div>
              <div className="my-food-macros" style={{ display: "flex", gap: 14, alignItems: "center", flex: "none" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#39e6b2" }}>{f.protein}</div>
                  <div style={{ fontSize: 10, color: "#8a9994", fontWeight: 600 }}>גרם חלבון</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fb923c" }}>{f.calories}</div>
                  <div style={{ fontSize: 10, color: "#8a9994", fontWeight: 600 }}>קל׳</div>
                </div>
              </div>
              <span className="h-pencil" aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, color: "#8a9994", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Pencil size={16} />
              </span>
            </button>
          ))}
          </div>}
    </div>
  );
}
