import { Plus, Pencil } from "../lib/icons.jsx";

// My Foods — saved templates. New food opens the Add sheet (manual); pencil edits/deletes.
export default function MyFoods({ foods, onNew, onEdit }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 4px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6f6f78" }}>{foods.length} מאכלים שמורים</div>
        <button className="h-newfood" onClick={onNew} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #21302a", background: "#16201b", color: "#34d399", fontSize: 13, fontWeight: 700, fontFamily: "inherit", padding: "8px 14px", borderRadius: 12, cursor: "pointer" }}>
          <Plus size={15} sw={2.5} /> מאכל חדש
        </button>
      </div>

      {foods.length === 0 ? (
        <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "24px 0" }}>אין מאכלים שמורים עדיין</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {foods.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "#161619", border: "1px solid #1f1f24", borderRadius: 18, padding: "14px 16px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{f.name}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#6f6f78", marginTop: 2 }}>{f.unit}</div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flex: "none" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#34d399" }}>{f.protein}</div>
                  <div style={{ fontSize: 10, color: "#5f5f68", fontWeight: 600 }}>חלבון</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{f.calories}</div>
                  <div style={{ fontSize: 10, color: "#5f5f68", fontWeight: 600 }}>קל'</div>
                </div>
              </div>
              <button className="h-pencil" aria-label="ערוך מאכל" onClick={() => onEdit(f)} style={{ width: 40, height: 40, border: "none", borderRadius: 11, background: "transparent", color: "#4f4f57", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
                <Pencil size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
