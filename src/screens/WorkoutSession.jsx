import { useEffect, useRef, useState } from "react";
import { parseSet, groupExercisesByMuscle, targetSetProgress, targetReps, workoutLoadLabel } from "../lib/workout.js";
import { todayLocal } from "../lib/date.js";
import WorkoutMuscleGroups from "./WorkoutMuscleGroups.jsx";

const card = { border: "1px solid #27302c", borderRadius: 18, background: "#111512", padding: 16 };
const input = { width: "100%", minWidth: 0, minHeight: 44, border: "1px solid #354039", borderRadius: 11, background: "#171b18", color: "#f4f7f6", font: "700 15px Heebo, sans-serif", padding: "8px 10px" };
const button = { minHeight: 44, border: "1px solid #39e6b2", borderRadius: 12, background: "#39e6b2", color: "#03120d", font: "800 14px Heebo, sans-serif", padding: "8px 12px", cursor: "pointer" };
const quiet = { ...button, background: "#17231e", color: "#8ff0ce", borderColor: "#315747" };
const muted = { color: "#8a9994", fontSize: 12 };

function SetRow({ item, position, target, previous, saved, userId, sessionId, historical, onSave, onRest }) {
  const key = `workout-draft:${userId}:${sessionId}:${item.id}:${position}`;
  const stored = (() => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } })();
  const compatible = stored && stored.baseRevision === (saved?.revision || 0);
  const [draft, setDraft] = useState(compatible ? stored : {
    id: saved?.id || crypto.randomUUID(), load: saved?.load_kg ?? "", reps: saved?.reps ?? "",
    kind: saved?.kind || "work", note: saved?.note || "", baseRevision: saved?.revision || 0,
  });
  const [status, setStatus] = useState(compatible ? "טיוטה מקומית" : saved ? "נשמר" : "לא נשמר");
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => { if (compatible) return; if (stored) localStorage.removeItem(key); }, [key]);

  const change = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    localStorage.setItem(key, JSON.stringify(next));
    setStatus("טיוטה מקומית");
    setError("");
  };
  const copy = () => { if (previous) change({ load: previous.load_kg ?? "", reps: previous.reps, kind: previous.kind }); };
  const save = async () => {
    if (lock.current) return;
    const parsed = parseSet(draft.load, draft.reps, item.load_mode);
    if (!parsed) { setError("הזן חזרות חיוביות ומשקל תקין."); return; }
    lock.current = true;
    setStatus("שומר…");
    let result;
    try {
      result = await onSave({ id: draft.id, session_exercise_id: item.id, position,
        kind: draft.kind, note: draft.note, ...parsed }, saved);
    } catch (error) { result = { error }; }
    lock.current = false;
    if (result.error) { setStatus("לא נשמר"); setError("השמירה נכשלה. הערכים נשארו בטיוטה; נסה שוב."); }
    else { localStorage.removeItem(key); setStatus("נשמר"); setError(""); if (!historical) onRest(item.rest_seconds); }
  };

  return <fieldset style={{ border: "1px solid #27302c", borderRadius: 12, padding: 10, margin: "12px 0 0", minWidth: 0 }}>
    <legend style={{ color: "#8ff0ce", fontWeight: 700 }}>סט {position + 1}</legend>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
      <label style={muted}>ק״ג{item.load_mode === "assisted" ? " סיוע" : ""}{item.weight_basis === "per_hand" ? " לכל יד" : ""}<input aria-label={`ק״ג שבוצעו בסט ${position + 1}`} dir="ltr" type="number" inputMode="decimal" min="0" step="any" placeholder={target?.load_kg == null ? "" : String(target.load_kg)} value={draft.load} onChange={(event) => change({ load: event.target.value })} style={input} /><span style={{ display: "block", marginTop: 4 }}>מתוכנן: <bdi>{target ? workoutLoadLabel(target.load_kg, item.load_mode) : "—"}</bdi></span></label>
      <label style={muted}>חזרות{item.reps_basis === "per_side" ? " לכל צד" : ""}<input aria-label={`חזרות שבוצעו בסט ${position + 1}`} dir="ltr" type="number" inputMode="numeric" min="1" step="1" placeholder={targetReps(target)} value={draft.reps} onChange={(event) => change({ reps: event.target.value })} style={input} /><span style={{ display: "block", marginTop: 4 }}>מתוכנן: <bdi dir="ltr">{targetReps(target)}</bdi></span></label>
    </div>
    {item.load_mode === "bodyweight" && <div style={{ ...muted, marginTop: 6 }}>משקל גוף · אפשר להשאיר את המשקל ריק</div>}
    <div style={{ ...muted, marginTop: 8 }}>פעם קודמת: {previous ? `${previous.load_kg == null ? "משקל גוף" : `${previous.load_kg} ק״ג`} × ${previous.reps}` : "אין תיעוד"}</div>
    {previous && <button style={{ ...quiet, marginTop: 6, fontSize: 12 }} onClick={copy}>העתק כהצעה</button>}
    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "end" }}><label style={{ ...muted, flex: 1 }}>סוג סט<select style={input} value={draft.kind} onChange={(event) => change({ kind: event.target.value })}><option value="work">עבודה</option><option value="warmup">חימום</option></select></label><button style={button} disabled={status === "שומר…"} onClick={save}>{saved ? "עדכן סט" : "בוצע"}</button></div>
    <span role="status" style={{ ...muted, display: "block", marginTop: 6, color: status === "נשמר" ? "#8ff0ce" : status === "לא נשמר" ? "#fb8b91" : "#e6c56f" }}>{status}</span>
    <label style={{ ...muted, display: "block", marginTop: 8 }}>הערה לסט<input style={input} value={draft.note} onChange={(event) => change({ note: event.target.value })} /></label>
    {error && <div role="alert" style={{ color: "#fb8b91", fontSize: 12, marginTop: 6 }}>{error}</div>}
  </fieldset>;
}

export default function WorkoutSession({ data, busy, run, onBack, onFinish }) {
  const { session, exercises, sets } = data.detail;
  const [previous, setPrevious] = useState({});
  const [extra, setExtra] = useState({});
  const [date, setDate] = useState(session.performed_on);
  const [restUntil, setRestUntil] = useState(() => Number(localStorage.getItem(`workout-timer:${data.userId}:${session.id}`)) || 0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const timerKey = `workout-timer:${data.userId}:${session.id}`;

  useEffect(() => {
    let alive = true;
    Promise.all(exercises.map(async (item) => [item.id, await data.loadPrevious(item.exercise_id, session.performed_on, session.id)]))
      .then((results) => { if (alive) setPrevious(Object.fromEntries(results.map(([id, result]) => [id, result.data || []]))); });
    return () => { alive = false; };
  }, [session.id, session.performed_on]);
  useEffect(() => {
    if (restUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [restUntil]);
  const startRest = (seconds) => {
    if (!seconds) return;
    const until = Date.now() + seconds * 1000;
    localStorage.setItem(timerKey, String(until));
    setRestUntil(until);
    setNow(Date.now());
  };
  const remaining = Math.max(0, Math.ceil((restUntil - now) / 1000));
  const progress = targetSetProgress(exercises, sets);
  const complete = progress.saved === progress.total && progress.skipped === 0;
  const saveDate = async () => {
    if (!date || date > todayLocal()) { setError("בחר תאריך תקין שאינו בעתיד."); return; }
    const result = await run(() => data.changeSessionDate(session, date), "התאריך עודכן");
    if (result?.error) setError("לא ניתן לשמור את התאריך.");
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <button style={{ ...quiet, alignSelf: "start" }} onClick={onBack}>חזרה</button>
    <div style={{ ...card, borderColor: "#315747" }}>
      <strong style={{ fontSize: 22 }}>{session.template_name}</strong>
      <div style={muted}>{session.status === "completed" ? "אימון שהושלם" : "אימון פתוח"}{session.partial ? " · חלקי" : ""}</div>
      <label style={{ ...muted, display: "block", marginTop: 12 }}>תאריך האימון<input type="date" value={date} max={todayLocal()} onChange={(event) => setDate(event.target.value)} style={input} /></label>
      {date !== session.performed_on && <button style={{ ...quiet, marginTop: 8 }} onClick={saveDate}>שמור תאריך</button>}
      {session.status === "in_progress" && remaining > 0 && <div role="timer" style={{ color: "#39e6b2", marginTop: 10 }}>מנוחה: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</div>}
    </div>
    <WorkoutMuscleGroups groups={groupExercisesByMuscle(exercises)} summary={(items) => {
      const { saved, total, skipped } = targetSetProgress(items, sets);
      return `${saved}/${total} סטי יעד נשמרו${skipped ? ` · דולגו: ${skipped}` : ""}`;
    }} renderExercise={(item) => {
      const currentSets = sets.filter((set) => set.session_exercise_id === item.id);
      const count = Math.max(item.target_sets.length, ...currentSets.map((set) => set.position + 1), extra[item.id] || 0, 1);
      const previousSets = previous[item.id] || [];
      return <section key={item.id} style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><strong style={{ fontSize: 17 }}>{item.exercise_name}</strong><div style={muted}>{item.muscle_group} · {item.load_mode === "external" ? "משקל חיצוני" : item.load_mode === "assisted" ? "סיוע" : "משקל גוף"}{item.weight_basis === "per_hand" ? " · לכל יד" : ""}{item.reps_basis === "per_side" ? " · חזרות לכל צד" : ""}</div></div><span style={{ ...muted, flexShrink: 0 }}>{item.status === "skipped" ? "דולג" : `${currentSets.length} נשמרו`}</span></div>
        {item.notes && <p style={muted}>{item.notes}</p>}
        {Array.from({ length: count }, (_, position) => {
          const saved = currentSets.find((set) => set.position === position);
          const target = item.target_sets[position];
          const prior = previousSets.find((set) => set.set_position === position);
          return <SetRow key={`${item.id}-${position}-${saved?.revision || 0}`} item={item} position={position} target={target} previous={prior} saved={saved} userId={data.userId} sessionId={session.id} historical={session.status === "completed"} onSave={data.saveSet} onRest={startRest} />;
        })}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}><button style={quiet} onClick={() => setExtra((old) => ({ ...old, [item.id]: count + 1 }))}>+ הוסף סט</button><button style={quiet} onClick={async () => { const result = await run(() => data.setExerciseStatus(item, item.status === "skipped" ? "pending" : "skipped"), "עודכן"); if (result?.error) setError("העדכון נכשל."); }}>{item.status === "skipped" ? "בטל דילוג" : "דלג על התרגיל"}</button></div>
      </section>;
    }} />
    {session.status === "in_progress" && <div style={card}>
      <div style={muted}>{progress.saved} סטי יעד נשמרו מתוך {progress.total}. סטים ריקים לא ייספרו.</div>
      <button style={{ ...button, width: "100%", marginTop: 10 }} disabled={busy} onClick={() => onFinish(!complete)}>{complete ? "סיים אימון" : "סיים אימון חלקי"}</button>
    </div>}
    {error && <div role="alert" style={{ color: "#fb8b91" }}>{error}</div>}
  </div>;
}
