import { useState } from "react";
import { Plus, Pencil } from "../lib/icons.jsx";
import { normalizeFoodText, searchFoods } from "../lib/write.js";

// My Foods — saved templates. New food opens the catalog editor; pencil edits/deletes.
export default function MyFoods({ foods, onNew, onEdit }) {
  const [query, setQuery] = useState("");
  const shownFoods = searchFoods(foods, query);
  const isSearching = Boolean(normalizeFoodText(query));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 4px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6f6f78" }}>{isSearching ? `${shownFoods.length} מתוך ${foods.length} מאכלים` : `${foods.length} מאכלים שמורים`}</div>
        <button className="h-newfood" onClick={onNew} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #1f3831", background: "#101918", color: "#39e6b2", fontSize: 13, fontWeight: 700, fontFamily: "inherit", padding: "8px 14px", borderRadius: 12, cursor: "pointer" }}>
          <Plus size={15} sw={2.5} /> מאכל חדש
        </button>
      </div>

      {foods.length === 0 ? (
        <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "24px 0" }}>אין מאכלים שמורים עדיין</div>
      ) : (
        <>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חפש מאכל קיים" aria-label="חיפוש מאכלים" autoComplete="off" style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, background: "#101516", border: "1px solid #26302f", borderRadius: 13, padding: "12px 14px", color: "#f4f4f5", fontSize: 15, fontFamily: "inherit", outline: "none" }} />
          {shownFoods.length === 0 ? <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "24px 0" }}>לא נמצאו מאכלים תואמים</div> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shownFoods.map((f) => (
            <div key={f.id} className="my-food-card" style={{ display: "flex", alignItems: "center", gap: 14, background: "#101516", border: "1px solid #1f1f24", borderRadius: 18, padding: "14px 16px" }}>
              <div className="my-food-copy" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{f.name}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#6f6f78", marginTop: 2 }}>{f.unit}</div>
              </div>
              <div className="my-food-macros" style={{ display: "flex", gap: 14, alignItems: "center", flex: "none" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#39e6b2" }}>{f.protein}</div>
                  <div style={{ fontSize: 10, color: "#5f5f68", fontWeight: 600 }}>חלבון</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fb923c" }}>{f.calories}</div>
                  <div style={{ fontSize: 10, color: "#5f5f68", fontWeight: 600 }}>קל'</div>
                </div>
              </div>
              <button className="h-pencil" aria-label="ערוך מאכל" onClick={() => onEdit(f)} style={{ width: 40, height: 40, border: "none", borderRadius: 11, background: "transparent", color: "#4f4f57", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
                <Pencil size={16} />
              </button>
            </div>
          ))}
          </div>}
        </>
      )}
    </div>
  );
}
