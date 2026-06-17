import { useState } from "react";
import { supabase } from "./lib/supabase.js";

// Passwordless magic-link sign-in (design §7).
export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    setSent(true);
  };

  return (
    <div className="app" style={{ justifyContent: "center", padding: "0 28px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(52,211,153,.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#1c2a24" strokeWidth="2.5" />
            <path d="M12 3a9 9 0 0 1 7 14.7" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.02em" }}>ProCount</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#6f6f78", marginTop: 6 }}>מעקב חלבון וקלוריות</div>
      </div>

      {sent ? (
        <div style={{ textAlign: "center", background: "#161619", border: "1px solid #232328", borderRadius: 20, padding: "22px 20px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399", marginBottom: 6 }}>בדוק את המייל ✉️</div>
          <div style={{ fontSize: 14, color: "#8a8a93", lineHeight: 1.5 }}>שלחנו קישור התחברות אל<br />{email.trim()}</div>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="כתובת מייל"
            dir="ltr"
            style={{ textAlign: "center", background: "#18181c", border: "1px solid #2a2a30", borderRadius: 14, padding: 15, color: "#f4f4f5", fontSize: 16, fontFamily: "inherit", outline: "none" }}
          />
          <button
            type="submit"
            disabled={busy}
            style={{ border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#34d399,#1f9d6f)", color: "#06120c", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "שולח…" : "שלח קישור התחברות"}
          </button>
          <div style={{ textAlign: "center", fontSize: 12, color: "#5f5f68", marginTop: 4 }}>ללא סיסמה · קישור חד-פעמי למייל</div>
        </form>
      )}
    </div>
  );
}
