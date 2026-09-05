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

  const inputStyle = { width: "100%", minHeight: 54, textAlign: "right", background: "#171b18", border: "1px solid #2a342f", borderRadius: 14, padding: "15px 16px", color: "#f4f7f6", fontSize: 16, fontFamily: "inherit", outline: "none" };

  return (
    <div className="app" style={{ justifyContent: "center", padding: "max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom))", background: "radial-gradient(circle at 50% 35%,#101714 0,#070a09 48%)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <div style={{ width: 82, height: 82, borderRadius: "50%", border: "8px solid #232b28", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 0 38px rgba(57,230,178,.1)" }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 15.5c1.2-3.7 2.5-7.8 5-9.3 1.5-.9 3.8-.4 3.8 1.5 0 1.8-1.7 2.3-3.2 1.7-.1 2.8 1.7 4.2 4.1 4.2H19v5H6v-3.1Z" stroke="#39e6b2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: "clamp(2rem,10vw,2.75rem)", lineHeight: 1, fontWeight: 900, letterSpacing: "-.035em" }}>ProCount</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#8a9994", marginTop: 10 }}>מעקב חלבון, קלוריות ומים</div>
      </div>

      <form onSubmit={submit} aria-busy={busy} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18, background: "rgba(17,21,18,.82)", border: "1px solid #29312e", borderRadius: 24, boxShadow: "0 20px 50px rgba(0,0,0,.25)", WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)" }}>
        <label style={{ display: "grid", gap: 7, color: "#aab5b1", fontSize: 13, fontWeight: 700 }}>
          כתובת מייל
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com" dir="ltr" autoComplete="email" disabled={busy} style={{ ...inputStyle, textAlign: "left" }} />
        </label>
        <label style={{ display: "grid", gap: 7, color: "#aab5b1", fontSize: 13, fontWeight: 700 }}>
          סיסמה
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים" dir="ltr" disabled={busy}
            autoComplete={mode === "login" ? "current-password" : "new-password"} style={{ ...inputStyle, textAlign: "left" }} />
        </label>

        {error && <div role="alert" style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "#fb7185" }}>{error}</div>}

        <button type="submit" disabled={busy}
          style={{ minHeight: 52, marginTop: 4, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#39e6b2,#23bd91)", color: "#03120d", fontSize: 17, fontWeight: 900, padding: 14, borderRadius: 14, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, boxShadow: "0 8px 24px rgba(57,230,178,.14)" }}>
          {busy ? "מתבצע…" : mode === "login" ? "התחברות" : "הרשמה"}
        </button>

        <button type="button"
          disabled={busy}
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          style={{ minHeight: 44, background: "none", border: "none", fontFamily: "inherit", textAlign: "center", fontSize: 14, color: "#9ca7a3", cursor: busy ? "not-allowed" : "pointer", marginTop: 2 }}>
          {mode === "login" ? "אין לך חשבון? הרשמה" : "יש לך חשבון? התחברות"}
        </button>
      </form>
      <div style={{ marginTop: 24, textAlign: "center", color: "#66716d", fontSize: 12, fontWeight: 600 }}>הנתונים שלך נשארים בחשבון האישי</div>
    </div>
  );
}

// Map the common Supabase auth errors to Hebrew; fall back to the raw message.
const translate = (m) =>
  /invalid login credentials/i.test(m) ? "מייל או סיסמה שגויים"
  : /already registered/i.test(m) ? "המשתמש כבר רשום"
  : /at least 6/i.test(m) ? "הסיסמה חייבת לכלול לפחות 6 תווים"
  : m;
