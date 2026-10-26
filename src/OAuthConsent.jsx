import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { withSubmissionLock } from "./lib/submission.js";

// Consent screen for the Supabase OAuth 2.1 server (the MCP connector in
// Claude/ChatGPT). Root renders it at /oauth/consent once the user is signed in;
// approve/deny redirect the browser back to the AI client.
export default function OAuthConsent() {
  const id = new URLSearchParams(location.search).get("authorization_id");
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(id ? "" : "בקשת ההרשאה חסרה או פגה");
  const [busy, setBusy] = useState(false);
  const [permissions, setPermissions] = useState({ water: false, meals: false, workouts: false, workout_catalog: false, workout_edit: false });
  const lock = useRef(false);

  useEffect(() => {
    if (!id) return;
    supabase.auth.oauth.getAuthorizationDetails(id).then(({ data, error }) => {
      if (error) return setError("בקשת ההרשאה לא נמצאה או שפג תוקפה");
      if ("authorization_id" in data) setDetails(data);
      else location.href = data.redirect_url; // already approved earlier
    });
  }, [id]);

  const decide = (approve) => withSubmissionLock(lock, async () => {
    setBusy(true);
    if (approve) {
      const { error } = await supabase.from("connector_permissions").upsert({ client_id: details.client.id, ...permissions }, { onConflict: "user_id,client_id" });
      if (error) { setBusy(false); setError("שמירת ההרשאות נכשלה. נסה שוב."); return; }
    }
    const { error } = approve
      ? await supabase.auth.oauth.approveAuthorization(id)
      : await supabase.auth.oauth.denyAuthorization(id);
    // success → supabase-js redirects to the client; stay busy until the page unloads
    if (error) { setBusy(false); setError("השמירה נכשלה. נסה שוב."); }
  });

  const card = { display: "flex", flexDirection: "column", gap: 14, padding: 20, background: "rgba(17,21,18,.82)", border: "1px solid #29312e", borderRadius: 24, boxShadow: "0 20px 50px rgba(0,0,0,.25)" };
  const button = { minHeight: 52, border: "none", fontFamily: "inherit", fontSize: 17, fontWeight: 900, padding: 14, borderRadius: 14, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 };
  const host = details && safeHost(details.redirect_uri);

  return (
    <div className="app" style={{ justifyContent: "center", padding: "max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom))", background: "radial-gradient(circle at 50% 35%,#101714 0,#070a09 48%)" }}>
      <div style={{ textAlign: "center", fontSize: "clamp(1.75rem,8vw,2.25rem)", fontWeight: 900, letterSpacing: "-.035em", marginBottom: 22 }}>ProCount</div>
      <div style={card}>
        {error ? (
          <>
            <div role="alert" style={{ textAlign: "center", fontSize: 15, fontWeight: 700, color: "#fb7185" }}>{error}</div>
            <a href="/" style={{ ...button, textAlign: "center", textDecoration: "none", background: "#232b28", color: "#f4f7f6" }}>חזרה לאפליקציה</a>
          </>
        ) : !details ? (
          <div aria-busy="true" style={{ textAlign: "center", color: "#8a9994", fontSize: 15, fontWeight: 600 }}>טוען…</div>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.35 }}>
              <bdi>{details.client.name || "אפליקציה חיצונית"}</bdi> מבקשת גישה לחשבון שלך
            </div>
            {host && <div dir="ltr" style={{ textAlign: "right", color: "#8a9994", fontSize: 13 }}>{host}</div>}
            <div style={{ color: "#c8d1ce", fontSize: 15, lineHeight: 1.5 }}>
              גישה לקריאת נתוני התזונה, המים, היעדים והאימונים שלך. אפשר לאשר בנפרד הוספת רישומים, ניהול תוכנית אימונים ותיקון אימונים; ניתן לבטל בהגדרות בכל עת.
            </div>
            {[["water", "הוספת מים"], ["meals", "הוספת ארוחות"], ["workouts", "הוספת אימונים שבוצעו"], ["workout_catalog", "ניהול תרגילים ותבניות אימון"], ["workout_edit", "תיקון, ביטול ושחזור אימונים"]].map(([key, label]) => <label key={key} style={{ display: "flex", alignItems: "center", minHeight: 44, gap: 10 }}>
              <input type="checkbox" disabled={busy} checked={permissions[key]} onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })} />{label}
            </label>)}
            <div dir="ltr" style={{ textAlign: "right", color: "#66716d", fontSize: 12 }}>{details.user.email}</div>
            <button type="button" disabled={busy} onClick={() => decide(true)}
              style={{ ...button, marginTop: 4, background: "linear-gradient(180deg,#39e6b2,#23bd91)", color: "#03120d" }}>
              {busy ? "מתבצע…" : "אישור"}
            </button>
            <button type="button" disabled={busy} onClick={() => decide(false)}
              style={{ ...button, background: "#232b28", color: "#f4f7f6" }}>
              דחייה
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const safeHost = (uri) => { try { return new URL(uri).host; } catch { return ""; } };
