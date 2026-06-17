import { useRef } from "react";
import { X, Camera, Info } from "../lib/icons.jsx";

const input = { width: "100%", background: "#18181c", border: "1px solid #2a2a30", borderRadius: 14, padding: 14, color: "#f4f4f5", fontSize: 16, fontFamily: "inherit", outline: "none" };
const label = { fontSize: 13, fontWeight: 600, color: "#8a8a93", display: "block", marginBottom: 7 };
const CONF = { low: "נמוכה", medium: "בינונית", high: "גבוהה" };

// Add sheet — Quick / Manual / Photo. Opens over the active tab (design §2, "must be fast").
export default function AddSheet({ tab, onTab, onClose, foods, form, onField, onToggleSave, onSubmit, onQuickAdd, photo, onPickPhoto }) {
  const fileRef = useRef(null);

  const tabBtn = (key, text) => {
    const active = tab === key;
    return (
      <button onClick={() => onTab(key)} style={{ flex: 1, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: 9, borderRadius: 10, cursor: "pointer", background: active ? "#2c2c33" : "transparent", color: active ? "#f4f4f5" : "#8a8a93" }}>{text}</button>
    );
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{ position: "relative", background: "#121215", borderTop: "1px solid #2a2a30", borderRadius: "26px 26px 0 0", maxHeight: "90%", display: "flex", flexDirection: "column", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ flex: "none", padding: "14px 20px 8px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "#33333a", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>הוספת מזון</div>
            <button onClick={onClose} aria-label="סגור" style={{ width: 34, height: 34, border: "none", borderRadius: 10, background: "#1e1e23", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, background: "#1a1a1e", padding: 5, borderRadius: 14 }}>
            {tabBtn("quick", "מהיר")}
            {tabBtn("manual", "ידני")}
            {tabBtn("photo", "צילום")}
          </div>
        </div>

        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 20px 28px" }}>
          {tab === "quick" && (
            foods.length === 0 ? (
              <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "20px 0" }}>אין מאכלים שמורים — הוסף דרך "ידני" עם סימון "שמור"</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {foods.map((f) => (
                  <button key={f.id} className="h-quick" onClick={() => onQuickAdd(f)} style={{ textAlign: "right", border: "1px solid #232328", background: "#18181c", borderRadius: 16, padding: 14, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#34d399" }}>{f.protein}g</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#7a7a82" }}>{f.calories} קל'</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {tab === "manual" && (
            <ManualForm form={form} onField={onField} onToggleSave={onToggleSave} onSubmit={onSubmit} cta="הוסף לרישום" showSave />
          )}

          {tab === "photo" && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPickPhoto(f); }} />

              {photo.state === "idle" && (
                <div>
                  <button className="h-drop" onClick={() => fileRef.current?.click()} style={{ width: "100%", border: "2px dashed #2e2e36", background: "#141417", borderRadius: 20, padding: "38px 20px", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(52,211,153,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
                      <Camera size={30} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f4f4f5" }}>צלם או בחר תמונה</div>
                      <div style={{ fontSize: 13, color: "#6f6f78", marginTop: 3 }}>Claude יאמוד חלבון וקלוריות</div>
                    </div>
                  </button>
                  {photo.error ? (
                    <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#fb7185" }}>{photo.error}</div>
                  ) : (
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontSize: 12, color: "#5f5f68" }}>
                      <Info size={14} /> נותרו {photo.quota} ניתוחים היום
                    </div>
                  )}
                </div>
              )}

              {photo.state === "loading" && (
                <div style={{ padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                  <div style={{ width: 48, height: 48, border: "4px solid #1e2e26", borderTopColor: "#34d399", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#c4c4c9" }}>מנתח את התמונה...</div>
                </div>
              )}

              {photo.state === "done" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#16201b", border: "1px solid #21302a", borderRadius: 14, padding: "12px 14px" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(52,211,153,.15)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>AI</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>זוהה · ודאות {CONF[photo.confidence] || "בינונית"}</div>
                      {photo.note && <div style={{ fontSize: 12, color: "#8a8a93", marginTop: 1 }}>{photo.note} · ניתן לתקן</div>}
                    </div>
                  </div>
                  <ManualForm form={form} onField={onField} onSubmit={onSubmit} cta="אשר והוסף" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared name/protein/calories form — manual entry and the editable AI result.
function ManualForm({ form, onField, onToggleSave, onSubmit, cta, showSave }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={label}>שם {showSave ? "(אופציונלי)" : ""}</label>
        <input value={form.name} onChange={(e) => onField("name", e.target.value)} placeholder="למשל: חזה עוף" aria-label="שם" style={input} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={label}>חלבון (גרם)</label>
          <input value={form.protein} onChange={(e) => onField("protein", e.target.value)} inputMode="decimal" aria-label="חלבון בגרמים" placeholder="0" style={{ ...input, color: "#34d399", fontSize: 18, fontWeight: 800 }} />
        </div>
        <div>
          <label style={label}>קלוריות</label>
          <input value={form.calories} onChange={(e) => onField("calories", e.target.value)} inputMode="decimal" aria-label="קלוריות" placeholder="0" style={{ ...input, color: "#fbbf24", fontSize: 18, fontWeight: 800 }} />
        </div>
      </div>
      {showSave && (
        <button onClick={onToggleSave} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 2 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${form.save ? "#34d399" : "#3a3a42"}`, background: form.save ? "#34d399" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#06120c" }}>{form.save ? "✓" : ""}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#c4c4c9" }}>שמור למאכלים שלי</span>
        </button>
      )}
      <button onClick={onSubmit} style={{ marginTop: 4, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#34d399,#1f9d6f)", color: "#06120c", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 15, cursor: "pointer" }}>{cta}</button>
    </div>
  );
}
