import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "../lib/icons.jsx";

export default function Settings({ goal, waterGoal, name, email, onBack, onName, onDec, onInc, onWaterDec, onWaterInc, onSignOut }) {
  const [nameInput, setNameInput] = useState(name || "");
  const backRef = useRef(null);

  useEffect(() => { backRef.current?.focus(); }, []);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape") onBack(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onBack]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="settings-title" style={{ position: "absolute", inset: 0, zIndex: 60, background: "#070a09", animation: "fadeIn .2s ease", display: "flex", flexDirection: "column" }}>
      <header style={{ flex: "none", padding: "calc(14px + env(safe-area-inset-top)) 20px 12px", display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 10 }}>
        <button ref={backRef} onClick={onBack} aria-label="חזרה" style={{ width: 44, height: 44, border: "1px solid #2b342f", borderRadius: 14, background: "#111512", color: "#b7c1bd", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={21} /></button>
        <div id="settings-title" style={{ textAlign: "center", fontSize: 24, fontWeight: 900, letterSpacing: "-.025em" }}>הגדרות</div>
        <span />
      </header>

      <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px max(30px, env(safe-area-inset-bottom))" }}>
        <SectionTitle>יעדים יומיים</SectionTitle>
        <section style={groupStyle}>
          <SettingStepper label="חלבון" value={goal} unit="גרם" color="#39e6b2" onDec={onDec} onInc={onInc} decLabel="הפחת יעד חלבון" incLabel="הגדל יעד חלבון" />
          <SettingStepper label="מים" value={formatLiters(waterGoal)} unit="ליטר" color="#60a5fa" onDec={onWaterDec} onInc={onWaterInc} decLabel="הפחת יעד מים" incLabel="הגדל יעד מים" />
        </section>

        <SectionTitle>פרופיל</SectionTitle>
        <section style={groupStyle}>
          <label style={rowStyle}><span style={rowLabel}>שם</span><input value={nameInput} onChange={(event) => setNameInput(event.target.value)} onBlur={() => onName(nameInput.trim())} placeholder="השם שלך" maxLength={24} aria-label="שם" style={{ minWidth: 0, width: "60%", minHeight: 44, background: "none", border: "none", textAlign: "left", color: "#f4f7f6", fontSize: 15, fontFamily: "inherit", outline: "none" }} /></label>
          <div style={rowStyle}><span style={rowLabel}>חשבון</span><span style={{ minWidth: 0, overflow: "hidden", color: "#8a9994", fontSize: 14, textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="ltr">{email}</span></div>
        </section>

        <SectionTitle>חשבון</SectionTitle>
        <section style={groupStyle}><button onClick={onSignOut} style={{ width: "100%", minHeight: 58, textAlign: "right", background: "transparent", border: "none", padding: "0 18px", fontSize: 16, fontWeight: 800, color: "#fb5d67", cursor: "pointer", fontFamily: "inherit" }}>התנתקות</button></section>

        <div style={{ textAlign: "center", marginTop: 34, fontSize: 12, color: "#59635f" }}>ProCount · גרסה 1.0</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) { return <div style={{ margin: "22px 5px 9px", color: "#8a9994", fontSize: 14, fontWeight: 800 }}>{children}</div>; }

function SettingStepper({ label, value, unit, color, onDec, onInc, decLabel, incLabel }) {
  return <div style={{ minHeight: 88, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 16px", borderBottom: "1px solid #2b342f" }}>
    <div><strong style={{ display: "block", color, fontSize: 18 }}>{label}</strong><span style={{ display: "block", marginTop: 3, color: "#8a9994", fontSize: 14 }}><bdi>{value} {unit}</bdi></span></div>
    <div style={{ display: "flex", overflow: "hidden", border: "1px solid #39433e", borderRadius: 13 }}>
      <button onClick={onDec} aria-label={decLabel} style={{ width: 52, height: 48, border: 0, borderInlineEnd: "1px solid #39433e", background: "#171b18", color, fontSize: 24, fontFamily: "inherit", cursor: "pointer" }}>−</button>
      <button onClick={onInc} aria-label={incLabel} style={{ width: 52, height: 48, border: 0, background: "#171b18", color, fontSize: 24, fontFamily: "inherit", cursor: "pointer" }}>+</button>
    </div>
  </div>;
}

const groupStyle = { overflow: "hidden", border: "1px solid #2b342f", borderRadius: 20, background: "#111512" };
const rowStyle = { minHeight: 62, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 18px", borderBottom: "1px solid #2b342f" };
const rowLabel = { flex: "none", fontSize: 15, fontWeight: 700 };

function formatLiters(ml) {
  return (Number(ml || 0) / 1000).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}
