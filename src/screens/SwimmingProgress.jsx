import { SWIM_STROKES, swimPace, swimSummary, swimLabel } from "../lib/swimming.js";

const card = { border: "1px solid #27302c", borderRadius: 18, background: "#111512", padding: 16 };

export default function SwimmingProgress({ sessions, onOpen }) {
  const totals = swimSummary(sessions);
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={card}>
      <strong>שחייה בתקופה שנבחרה</strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14 }}>
        {[[totals.count, "אימונים"], [totals.distance_m.toLocaleString("he-IL"), "מטר מתועדים"], [Math.round(totals.duration_seconds / 60), "דקות כולל מנוחות"]].map(([value, label]) => <div key={label}><div style={{ color: "#39e6b2", fontSize: 23, fontWeight: 900 }}>{value}</div><div style={{ color: "#8a9994", fontSize: 12 }}>{label}</div></div>)}
      </div>
      <p style={{ color: "#8a9994", fontSize: 13, marginBottom: 0 }}>מרחק תועד ב־{totals.withDistance} מתוך {totals.count} אימונים. הקצב כולל מנוחות.</p>
    </div>
    {!sessions.length && <div style={card}>אין אימוני שחייה בתקופה הזאת.</div>}
    {sessions.map((session) => <button key={session.id} onClick={() => onOpen(session.id)} style={{ ...card, color: "#f4f7f6", font: "700 15px Heebo, sans-serif", textAlign: "right", cursor: "pointer", minHeight: 70 }}>
      <div>{session.performed_on} · {swimLabel(session.swim)}</div>
      <div style={{ color: "#8a9994", fontSize: 13, marginTop: 5 }}>{SWIM_STROKES[session.swim?.stroke] || "ללא סגנון"}{swimPace(session.swim) ? ` · ${swimPace(session.swim)} ל־100 מ׳ כולל מנוחות` : ""}</div>
    </button>)}
  </div>;
}
