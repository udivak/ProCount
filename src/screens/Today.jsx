import { Flame, Trash } from "../lib/icons.jsx";

// Home screen — "ring" variation (design default). Protein ring + calories strip + the day's entries.
export default function Today({ totals, goal, ringOffset, remaining, entries, onDelete, dayLabel, onPrev, onNext, canPrev, canNext }) {
  return (
    <div>
      {/* day navigator — dir=rtl: prev (older) sits right with ›, next (newer) left with ‹ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <DayArrow chevron="›" label="יום קודם" disabled={!canPrev} onClick={onPrev} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#f4f4f5" }}>{dayLabel}</div>
        <DayArrow chevron="‹" label="יום הבא" disabled={!canNext} onClick={onNext} />
      </div>

      {/* hero ring card */}
      <div style={{ background: "linear-gradient(160deg,#16201b,#121214)", border: "1px solid #21302a", borderRadius: 28, padding: "26px 20px 22px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 180, height: 180, background: "radial-gradient(circle,rgba(52,211,153,.16),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#7bd6ad", marginBottom: 14 }}>חלבון</div>
        <div style={{ position: "relative", width: 208, height: 208, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="208" height="208" viewBox="0 0 208 208" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
            <circle cx="104" cy="104" r="78" fill="none" stroke="#1c2a24" strokeWidth="16" />
            <circle cx="104" cy="104" r="78" fill="none" stroke="#34d399" strokeWidth="16" strokeLinecap="round" strokeDasharray="490" strokeDashoffset={ringOffset} style={{ animation: "ringDraw 1s ease-out", filter: "drop-shadow(0 0 8px rgba(52,211,153,.5))" }} />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-.03em" }}>{totals.protein}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#6f6f78", marginTop: 6 }}>מתוך {goal} גרם</div>
          </div>
        </div>
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, background: "#0f1714", border: "1px solid #1f2e27", padding: "8px 16px", borderRadius: 999 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#34d399" }}>נשאר {remaining} גרם</span>
          <span style={{ fontSize: 13, color: "#5f5f68" }}>·</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#8a8a93" }}>{totals.pctLabel} מהיעד</span>
        </div>
      </div>

      {/* calories strip */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161619", border: "1px solid #232328", borderRadius: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(251,191,36,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
            <Flame size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6f6f78" }}>קלוריות</div>
            <div style={{ fontSize: 13, color: "#5f5f68" }}>ללא יעד · מספר רץ</div>
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fbbf24", letterSpacing: "-.02em" }}>{totals.calories}</div>
      </div>

      {/* today entries */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 4px 12px" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>מה אכלת</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6f6f78" }}>{totals.count} פריטים</div>
      </div>

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", color: "#5f5f68", fontSize: 14, padding: "24px 0" }}>לא רשמת ביום הזה — לחץ ＋ כדי להוסיף</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161619", border: "1px solid #1f1f24", borderRadius: 18, padding: "14px 16px" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: e.iconBg, color: e.iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{e.tag}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#6f6f78", marginTop: 1 }}>{e.sub}</div>
              </div>
              <div style={{ textAlign: "left", flex: "none" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#34d399" }}>{e.protein}g</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#7a7a82" }}>{e.calories} קל'</div>
              </div>
              <button className="h-del" aria-label="מחק רישום" onClick={() => onDelete(e.id)} style={{ width: 40, height: 40, border: "none", borderRadius: 11, background: "transparent", color: "#4f4f57", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayArrow({ chevron, label, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label}
      style={{ width: 40, height: 40, border: "1px solid #232328", borderRadius: 12, background: "#161619", color: disabled ? "#3a3a42" : "#c4c4c9", fontSize: 22, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {chevron}
    </button>
  );
}
