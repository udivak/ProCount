import { useId, useState } from "react";

export default function WorkoutMuscleGroups({ groups, renderExercise, summary }) {
  const [openGroup, setOpenGroup] = useState(null);
  const id = useId();

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {groups.map((group, index) => {
      const open = openGroup === group.name;
      const panelId = `${id}-${index}`;
      return <section key={group.name} style={{ border: `1px solid ${open ? "#315747" : "#27302c"}`, borderRadius: 18, background: "#111512" }}>
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenGroup(open ? null : group.name)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", minHeight: 56, padding: "12px 16px", border: 0, borderRadius: 18, background: "transparent", color: open ? "#8ff0ce" : "#f4f7f6", font: "700 16px Heebo, sans-serif", textAlign: "right", cursor: "pointer" }}>
          <span><strong>{group.name}</strong><span style={{ display: "block", color: "#8a9994", fontSize: 12, fontWeight: 400 }}>{group.items.length === 1 ? "תרגיל אחד" : `${group.items.length} תרגילים`}{summary ? ` · ${summary(group.items)}` : ""}</span></span>
          <span aria-hidden="true" style={{ flexShrink: 0 }}>{open ? "▾" : "◂"}</span>
        </button>
        {/* Keep hidden content mounted so folding preserves drafts and pending saves. */}
        <div id={panelId} hidden={!open}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 12px 12px" }}>{group.items.map(renderExercise)}</div>
        </div>
      </section>;
    })}
  </div>;
}
