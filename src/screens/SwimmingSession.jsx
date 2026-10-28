import { useRef, useState } from "react";
import { todayLocal, shiftDate } from "../lib/date.js";
import { parseSwim, swimPace, SWIM_STROKES } from "../lib/swimming.js";

const card = { border: "1px solid #27302c", borderRadius: 18, background: "#111512", padding: 16 };
const input = { width: "100%", minWidth: 0, minHeight: 44, border: "1px solid #354039", borderRadius: 11, background: "#171b18", color: "#f4f7f6", font: "700 16px Heebo, sans-serif", padding: "8px 11px" };
const button = { minHeight: 44, border: "1px solid #39e6b2", borderRadius: 12, background: "#39e6b2", color: "#03120d", font: "800 14px Heebo, sans-serif", padding: "8px 13px", cursor: "pointer" };
const quiet = { ...button, background: "#17231e", color: "#8ff0ce", borderColor: "#315747" };
const muted = { color: "#8a9994", fontSize: 13 };

export default function SwimmingSession({ detail, userId, onSave, onBack, onOpenExisting, onFindExisting, onReload, onConfirm, onSaved }) {
  const current = detail?.session;
  const key = `swim-draft:${userId}:${current?.id || "new"}`;
  const [initial] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      return stored?.attempt || stored?.baseRevision === (current?.revision || 0) ? stored : null;
    } catch { return null; }
  });
  const [draft, setDraft] = useState(initial?.draft || {
    date: current?.performed_on || todayLocal(), minutes: detail?.swim ? String(Math.floor(detail.swim.duration_seconds / 60)) : "",
    seconds: detail?.swim ? String(detail.swim.duration_seconds % 60) : "0", distanceMode: detail?.swim?.length_count ? "lengths" : "manual",
    distance: detail?.swim?.distance_m ?? "", poolLength: detail?.swim?.pool_length_m ?? "25", lengths: detail?.swim?.length_count ?? "",
    stroke: detail?.swim?.stroke || "", notes: current?.notes || "",
  });
  const [attempt, setAttempt] = useState(initial?.attempt || null);
  const attemptRef = useRef(initial?.attempt || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicateId, setDuplicateId] = useState(null);
  const [stale, setStale] = useState(false);
  const lock = useRef(false);
  const parsed = parseSwim(draft);
  const pace = swimPace(parsed);
  const cancelled = current?.status === "cancelled";
  const frozen = busy || !!attempt || cancelled || stale;
  const persist = (nextDraft, nextAttempt) => { try { localStorage.setItem(key, JSON.stringify({ draft: nextDraft, attempt: nextAttempt, baseRevision: current?.revision || 0 })); } catch { /* In-memory retry IDs still protect this open form. */ } };
  const change = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next); persist(next, null); setError(""); setDuplicateId(null);
  };
  const discard = () => { localStorage.removeItem(key); onBack(); };
  const save = async (status = null) => {
    if (lock.current) return { error: true };
    if (!attemptRef.current && !status && (!parsed || !draft.date || shiftDate(draft.date, 0) !== draft.date || draft.date > todayLocal())) {
      setError("הזן תאריך תקין, משך חיובי ומרחק תקין אם בחרת לתעד אותו. השניות הן בין 0 ל־59."); return { error: true };
    }
    const next = attemptRef.current || { requestId: crypto.randomUUID(), sessionId: current?.id || crypto.randomUUID(), expectedRevision: current?.revision || 0,
      ...(status ? { status } : { date: draft.date, swim: parsed, notes: draft.notes.trim() || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) };
    lock.current = true; setBusy(true); setError(""); attemptRef.current = next; setAttempt(next); persist(draft, next);
    try {
      const result = await onSave(next);
      if (result.error) {
        const message = result.error.message || "";
        // Server SQL errors roll back; transport errors may have committed and must retry unchanged.
        if (result.error.code && !["PGRST000", "PGRST001", "PGRST002"].includes(result.error.code)) {
          attemptRef.current = null; setAttempt(null); persist(draft, null);
          if (message === "possible_duplicate_workout") {
            const existing = await onFindExisting(next.date || current.performed_on);
            if (existing.error) { setError("כבר קיים אימון בתאריך הזה. טעינת האימון הקיים נכשלה; נסה שוב."); return result; }
            setDuplicateId(existing.data?.id || null);
            setError("כבר תועדה שחייה בתאריך הזה. אפשר לפתוח אותה ולערוך את הסיכום.");
          } else if (["session_conflict", "workout_not_editable", "request_id_conflict", "invalid_status_transition"].includes(message)) {
            setStale(true); setError("האימון השתנה. טען את הגרסה המעודכנת לפני עריכה נוספת.");
          } else setError("השמירה נכשלה. הנתונים נשארו בטופס; בדוק אותם ונסה שוב.");
        } else setError("לא התקבל אישור שמירה. הנתונים נעולים כדי למנוע כפילות; לחץ על ניסיון חוזר לבדיקת אותה שמירה.");
        return result;
      }
      if (!result.data?.session || !result.data?.swim) { setError("לא התקבל אישור מלא. נסה שוב את אותה שמירה."); return { error: true }; }
      localStorage.removeItem(key); attemptRef.current = null; setAttempt(null); onSaved(result.data); return result;
    } catch {
      setError("החיבור נקטע. נסה שוב את אותה שמירה; הנתונים נשארו בטופס."); return { error: true };
    } finally { lock.current = false; setBusy(false); }
  };
  const changeStatus = () => onConfirm({ title: cancelled ? "שחזור אימון שחייה" : "ביטול אימון שחייה",
    body: cancelled ? "האימון יחזור להיסטוריה ולספירת האימונים." : "האימון יוסר מספירת האימונים. הסיכום יישמר ואפשר יהיה לשחזר אותו.",
    confirmLabel: cancelled ? "שחזר אימון" : "בטל אימון", onConfirm: async () => (await save(cancelled ? "completed" : "cancelled")).error ? "העדכון לא הושלם. סגור חלון זה ופעל לפי ההודעה בטופס." : "" });

  return <section style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-label="סיכום אימון שחייה">
    <button style={{ ...quiet, alignSelf: "start" }} disabled={busy} onClick={onBack}>חזרה</button>
    <div style={{ ...card, borderColor: "#315747" }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 24 }}>שחייה בבריכה</h2>
      <div style={muted}>{cancelled ? "אימון מבוטל · הסיכום נשמר" : current ? "סיכום האימון · אפשר לעדכן את הביצוע" : "סיכום אחרי האימון · מתעדים רק מה שבוצע"}</div>
    </div>
    <fieldset disabled={frozen} style={{ ...card, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      <legend style={{ color: "#8ff0ce", fontWeight: 700 }}>פרטי השחייה</legend>
      <label style={muted}>תאריך האימון<input aria-label="תאריך השחייה" style={input} type="date" max={todayLocal()} value={draft.date} onChange={(e) => change({ date: e.target.value })} /></label>
      <div><div style={{ ...muted, marginBottom: 7 }}>משך כולל מנוחות</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={muted}>דקות<input style={input} dir="ltr" type="number" inputMode="numeric" min="0" max="1440" step="1" value={draft.minutes} onChange={(e) => change({ minutes: e.target.value })} /></label>
        <label style={muted}>שניות<input style={input} dir="ltr" type="number" inputMode="numeric" min="0" max="59" step="1" value={draft.seconds} onChange={(e) => change({ seconds: e.target.value })} /></label>
      </div></div>
      <label style={muted}>איך לתעד מרחק?<select style={input} value={draft.distanceMode} onChange={(e) => change({ distanceMode: e.target.value })}>
        <option value="manual">מרחק במטרים / ללא מרחק</option><option value="lengths">חישוב לפי אורכי בריכה</option>
      </select></label>
      {draft.distanceMode === "manual" ? <label style={muted}>מרחק במטרים · רשות<input style={input} dir="ltr" type="number" inputMode="decimal" min="0.01" step="any" max="100000" placeholder="אפשר להשאיר ריק" value={draft.distance} onChange={(e) => change({ distance: e.target.value })} /></label> : <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={muted}>אורך הבריכה במטרים<input style={input} dir="ltr" type="number" inputMode="decimal" min="0.01" max="200" step="any" value={draft.poolLength} onChange={(e) => change({ poolLength: e.target.value })} /></label>
          <label style={muted}>מספר אורכים<input style={input} dir="ltr" type="number" inputMode="numeric" min="1" step="1" value={draft.lengths} onChange={(e) => change({ lengths: e.target.value })} /></label>
        </div>
        <div style={muted}>אורך = מעבר בכיוון אחד. הלוך־חזור = שני אורכים.</div>
      </>}
      <label style={muted}>סגנון · רשות<select style={input} value={draft.stroke} onChange={(e) => change({ stroke: e.target.value })}><option value="">ללא סגנון</option>{Object.entries(SWIM_STROKES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label style={muted}>הערה · רשות<textarea style={{ ...input, minHeight: 78, resize: "vertical" }} maxLength={1000} value={draft.notes} onChange={(e) => change({ notes: e.target.value })} /></label>
    </fieldset>
    {parsed && <div style={card} aria-live="polite">
      <strong style={{ color: "#39e6b2", fontSize: 22 }}>{parsed.distance_m == null ? "מרחק לא תועד" : `${parsed.distance_m.toLocaleString("he-IL")} מטר`}</strong>
      {pace && <div style={{ marginTop: 6 }}>קצב ממוצע כולל מנוחות ל־100 מ׳: <bdi dir="ltr" style={{ fontWeight: 800 }}>{pace}</bdi></div>}
    </div>}
    {error && <div role="alert" style={{ color: "#fb8b91", fontSize: 14 }}>{error}</div>}
    {duplicateId && <button style={quiet} disabled={busy} onClick={() => { localStorage.removeItem(key); onOpenExisting(duplicateId); }}>פתח את אימון השחייה הקיים</button>}
    {stale && current && <button style={quiet} onClick={() => { localStorage.removeItem(key); onReload(current.id); }}>טען את האימון המעודכן</button>}
    {(!cancelled || attempt) && !stale && <button style={{ ...button, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => save()}>{busy ? "שומר…" : attempt ? "ניסיון חוזר של אותה שמירה" : current ? "שמור שינויים" : "שמור אימון שחייה"}</button>}
    {current && !attempt && !stale && <button style={{ ...quiet, color: cancelled ? "#8ff0ce" : "#fb8b91" }} disabled={busy} onClick={changeStatus}>{cancelled ? "שחזר אימון" : "בטל אימון"}</button>}
    {!current && !attempt && <button style={quiet} disabled={busy} onClick={discard}>נקה טיוטה וחזור</button>}
    {attempt && <div style={muted}>השמירה ממתינה לאימות. אפשר לחזור מאוחר יותר; ניסיון חוזר ישתמש באותו מזהה.</div>}
  </section>;
}
