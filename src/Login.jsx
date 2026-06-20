import { useState } from "react";
import { supabase } from "./lib/supabase.js";

// Email + password. No SMTP: "Confirm email" is OFF in the Supabase dashboard,
// so signUp returns a session immediately and no email is ever sent.
// ponytail: no password reset (needs SMTP) — reset from the dashboard if needed.
export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError("");
    const creds = { email: email.trim(), password };
    const { error } = mode === "login"
      ? await supabase.auth.signInWithPassword(creds)
      : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) setError(translate(error.message));
    // success → Root's onAuthStateChange renders <App/>; nothing to do here.
  };

  const inputStyle = { textAlign: "center", background: "#18181c", border: "1px solid #2a2a30", borderRadius: 14, padding: 15, color: "#f4f4f5", fontSize: 16, fontFamily: "inherit", outline: "none" };

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

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="כתובת מייל" dir="ltr" autoComplete="email" style={inputStyle} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה" dir="ltr"
          autoComplete={mode === "login" ? "current-password" : "new-password"} style={inputStyle} />

        {error && <div style={{ textAlign: "center", fontSize: 13, color: "#fb7185" }}>{error}</div>}

        <button type="submit" disabled={busy}
          style={{ border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#34d399,#1f9d6f)", color: "#06120c", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "…" : mode === "login" ? "התחברות" : "הרשמה"}
        </button>

        <button type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          style={{ background: "none", border: "none", fontFamily: "inherit", textAlign: "center", fontSize: 13, color: "#6f6f78", cursor: "pointer", marginTop: 4 }}>
          {mode === "login" ? "אין לך חשבון? הרשמה" : "יש לך חשבון? התחברות"}
        </button>
      </form>
    </div>
  );
}

// Map the common Supabase auth errors to Hebrew; fall back to the raw message.
const translate = (m) =>
  /invalid login credentials/i.test(m) ? "מייל או סיסמה שגויים"
  : /already registered/i.test(m) ? "המשתמש כבר רשום"
  : /at least 6/i.test(m) ? "הסיסמה חייבת לכלול לפחות 6 תווים"
  : m;
