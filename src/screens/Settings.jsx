import { ChevronLeft } from "../lib/icons.jsx";

// Settings — full-screen overlay from the header gear. Protein goal + account.
export default function Settings({ goal, email, onBack, onDec, onInc, onSignOut }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, background: "#0a0a0c", animation: "fadeIn .2s ease", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: "none", padding: "18px 20px 14px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onBack} aria-label="חזרה" style={{ width: 40, height: 40, border: "none", borderRadius: 12, background: "#161619", color: "#c4c4c9", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>הגדרות</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 30px" }}>
        <div style={{ background: "#161619", border: "1px solid #232328", borderRadius: 20, padding: 20, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6f6f78", marginBottom: 14 }}>יעד חלבון יומי</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={onDec} aria-label="הפחת יעד" style={{ width: 46, height: 46, border: "1px solid #2a2a30", background: "#1e1e23", color: "#f4f4f5", borderRadius: 14, fontSize: 22, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>−</button>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-.02em" }}>{goal}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#6f6f78" }}>גרם</span>
            </div>
            <button onClick={onInc} aria-label="הגדל יעד" style={{ width: 46, height: 46, border: "1px solid #21302a", background: "#16201b", color: "#34d399", borderRadius: 14, fontSize: 22, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+</button>
          </div>
        </div>

        <div style={{ background: "#161619", border: "1px solid #232328", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 18px", borderBottom: "1px solid #202024" }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>חשבון</span>
            <span style={{ fontSize: 14, color: "#6f6f78" }} dir="ltr">{email}</span>
          </div>
          <button onClick={onSignOut} style={{ width: "100%", textAlign: "right", background: "none", border: "none", padding: "17px 18px", fontSize: 15, fontWeight: 700, color: "#fb7185", cursor: "pointer", fontFamily: "inherit" }}>התנתקות</button>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#3f3f47" }}>ProCount · גרסה 1.0</div>
      </div>
    </div>
  );
}
