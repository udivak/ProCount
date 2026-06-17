import { Flame } from "../lib/icons.jsx";

// Trends — streak + weekly average, protein bar chart with goal line, calories secondary.
export default function Trends({ goal, streak, avg, bars, goalY, calAvg }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "linear-gradient(150deg,#241a12,#161619)", border: "1px solid #34291a", borderRadius: 20, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ color: "#fb923c", display: "flex" }}><Flame size={18} /></span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6f6f78" }}>רצף ימים</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-.02em" }}>{streak}</div>
          <div style={{ fontSize: 12, color: "#6f6f78", marginTop: 2 }}>ימים ברצף ביעד</div>
        </div>
        <div style={{ background: "#161619", border: "1px solid #232328", borderRadius: 20, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(52,211,153,.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399", fontSize: 11, fontWeight: 800 }}>Ø</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6f6f78" }}>ממוצע שבועי</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-.02em", color: "#34d399" }}>{avg}<span style={{ fontSize: 18, color: "#5f5f68", fontWeight: 700 }}>g</span></div>
          <div style={{ fontSize: 12, color: "#6f6f78", marginTop: 2 }}>חלבון ליום</div>
        </div>
      </div>

      <div style={{ background: "#161619", border: "1px solid #232328", borderRadius: 22, padding: "20px 18px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>חלבון · 7 ימים</div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0a0a0c", background: "#34d399", padding: "5px 12px", borderRadius: 999 }}>שבוע</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#8a8a93", background: "#1e1e23", padding: "5px 12px", borderRadius: 999 }}>חודש</span>
          </div>
        </div>
        <div style={{ position: "relative", height: 148, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: goalY, height: 0, borderTop: "1.5px dashed #34d399", opacity: 0.55 }} />
          <div style={{ position: "absolute", left: 0, bottom: goalY, transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, color: "#34d399", background: "#161619", padding: "0 4px" }}>יעד {goal}</div>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ width: "100%", maxWidth: 26, height: b.h, borderRadius: "7px 7px 4px 4px", background: b.color, boxShadow: b.glow }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: b.labelColor }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#161619", border: "1px solid #232328", borderRadius: 22, padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6f6f78", marginBottom: 6 }}>קלוריות · ממוצע שבועי</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fbbf24", letterSpacing: "-.02em" }}>{calAvg}</div>
        </div>
        <svg width="120" height="48" viewBox="0 0 120 48" fill="none">
          <polyline points="0,34 20,28 40,32 60,18 80,24 100,14 120,20" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="120" cy="20" r="3.5" fill="#fbbf24" />
        </svg>
      </div>
    </div>
  );
}
