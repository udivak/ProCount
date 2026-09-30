import { useEffect, useRef, useState } from "react";
import { todayLocal } from "../lib/date.js";
import { bestAtLoad, progressPoints, progressSince } from "../lib/workout.js";
import WorkoutSession from "./WorkoutSession.jsx";

const card = { border: "1px solid #27302c", borderRadius: 18, background: "#111512", padding: 16 };
const input = { width: "100%", minHeight: 44, border: "1px solid #354039", borderRadius: 11, background: "#171b18", color: "#f4f7f6", font: "700 15px Heebo, sans-serif", padding: "8px 11px" };
const button = { minHeight: 44, border: "1px solid #39e6b2", borderRadius: 12, background: "#39e6b2", color: "#03120d", font: "800 14px Heebo, sans-serif", padding: "8px 13px", cursor: "pointer" };
const quiet = { ...button, background: "#17231e", color: "#8ff0ce", borderColor: "#315747" };
const muted = { color: "#8a9994", fontSize: 13 };
const blankExercise = () => ({ id: crypto.randomUUID(), name: "", muscle_group: "", equipment: "", load_mode: "external", weight_basis: "total", reps_basis: "total", notes: "" });
const blankTemplate = (position) => ({ id: crypto.randomUUID(), name: "", position, preferred_day: null, items: [] });
const defaultTargets = () => [{ load_kg: null, reps_min: 8, reps_max: 12 }];

export default function Workouts({ data, onConfirm }) {
  const [view, setView] = useState("plan");
  const [templateId, setTemplateId] = useState("");
  const [exerciseEditor, setExerciseEditor] = useState(null);
  const [templateEditor, setTemplateEditor] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [page, setPage] = useState(0);
  const [progressExercise, setProgressExercise] = useState("");
  const [progressTemplate, setProgressTemplate] = useState("");
  const [range, setRange] = useState("quarter");
  const [progressLoad, setProgressLoad] = useState("auto");
  const [weeklyDraft, setWeeklyDraft] = useState(3);
  const [last, setLast] = useState({});
  const lock = useRef(false);
  const pendingSessionId = useRef(null);

  useEffect(() => { if (!templateId && data.templates[0]) setTemplateId(data.templates[0].id); }, [data.templates, templateId]);
  useEffect(() => { if (!progressExercise && data.exercises[0]) setProgressExercise(data.exercises[0].id); }, [data.exercises, progressExercise]);
  useEffect(() => setWeeklyDraft(data.weeklyGoal), [data.weeklyGoal]);
  useEffect(() => { if (view === "history") { setPage(0); data.loadHistory(0); } }, [view]);
  useEffect(() => {
    if (view === "progress" && progressExercise) data.loadProgress(progressExercise, progressSince(range), todayLocal(), progressTemplate || null)
      .then((result) => { if (result.error) setMessage("טעינת ההתקדמות נכשלה. נסה שוב."); });
  }, [view, progressExercise, progressTemplate, range]);
  useEffect(() => { if (view === "progress") data.loadConsistency(); }, [view]);

  const run = async (operation, success = "נשמר") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await operation();
      if (result?.error) setMessage(result.error.message === "stale" ? "המידע השתנה במקום אחר. רענן ונסה שוב." : "השמירה נכשלה. נסה שוב.");
      else setMessage(success);
      return result;
    } catch {
      setMessage("השמירה נכשלה. נסה שוב.");
      return { error: true };
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const selected = data.templates.find((item) => item.id === templateId) || data.templates[0];
  const selectedItems = data.items.filter((item) => item.template_id === selected?.id).sort((a, b) => a.position - b.position);
  useEffect(() => {
    let alive = true;
    if (view === "plan" && selectedItems.length) Promise.all(selectedItems.map(async (item) => [item.id, await data.loadPrevious(item.exercise_id, todayLocal())]))
      .then((results) => { if (alive) setLast(Object.fromEntries(results.map(([id, result]) => [id, result.data || []]))); });
    return () => { alive = false; };
  }, [view, selected?.id, data.items]);
  const start = async () => {
    if (!selected) return;
    if (!date || date > todayLocal()) { setMessage("בחר תאריך תקין שאינו בעתיד."); return; }
    if (data.open) { const result = await data.loadSession(data.open.id); if (!result.error) setView("session"); return; }
    const id = pendingSessionId.current || crypto.randomUUID();
    pendingSessionId.current = id;
    const result = await run(() => data.startSession(selected.id, id, date, date !== todayLocal()), "האימון נפתח");
    if (!result?.error) { pendingSessionId.current = null; setView("session"); }
  };
  const openSession = async (id) => { const result = await run(() => data.loadSession(id), ""); if (!result?.error) setView("session"); };
  const editTemplate = (template) => setTemplateEditor(template ? {
    ...template, items: data.items.filter((item) => item.template_id === template.id).sort((a, b) => a.position - b.position)
      .map((item) => ({ exercise_id: item.exercise_id, target_sets: item.target_sets, rest_seconds: item.rest_seconds, notes: item.notes || "" })),
    current: template,
  } : blankTemplate(data.templates.length));
  const saveTemplate = async () => {
    if (!templateEditor?.name.trim()) { setMessage("צריך לתת שם לאימון."); return; }
    const values = { ...templateEditor, items: templateEditor.items.map((item, index) => ({ ...item, position: index })) };
    const result = await run(() => data.saveTemplate(values, templateEditor.current), "התכנית נשמרה");
    if (!result?.error) { setTemplateId(values.id); setTemplateEditor(null); }
  };
  const saveExercise = async () => {
    if (!exerciseEditor?.name.trim() || !exerciseEditor?.muscle_group.trim()) { setMessage("צריך שם תרגיל וקבוצת שרירים."); return; }
    const result = await run(() => data.saveExercise(exerciseEditor, exerciseEditor.current), "התרגיל נשמר");
    if (!result?.error) setExerciseEditor(null);
  };
  const updateItem = (index, change) => setTemplateEditor((old) => ({ ...old,
    items: old.items.map((item, i) => i === index ? { ...item, ...change } : item) }));
  const updateTarget = (index, targetIndex, change) => updateItem(index, { target_sets: templateEditor.items[index].target_sets.map((target, i) => i === targetIndex ? { ...target, ...change } : target) });
  const points = progressPoints(data.progress);
  const maxVolume = Math.max(1, ...points.map((point) => point.volume || 0));
  const loads = [...new Set(points.flatMap((point) => point.sets.filter((set) => set.kind === "work").map((set) => set.load_kg == null ? "bodyweight" : String(set.load_kg))))].sort((a, b) => Number(b) - Number(a));
  const chosenLoad = progressLoad === "auto" || !loads.includes(progressLoad) ? loads[0] : progressLoad;
  const bestReps = bestAtLoad(points, chosenLoad === "bodyweight" ? null : chosenLoad);
  const peak = points.map((point) => point.heaviest).filter((set) => set?.load_kg != null).sort((a, b) => Number(b.load_kg) - Number(a.load_kg))[0];

  return <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
    <div role="tablist" aria-label="אימונים" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, ...card, padding: 5 }}>
      {[["plan", "תכנית"], ["history", "היסטוריה"], ["progress", "התקדמות"]].map(([key, label]) =>
        <button key={key} role="tab" aria-selected={view === key || (key === "plan" && view === "session")} onClick={() => { setView(key); setMessage(""); }}
          style={{ ...quiet, border: 0, background: view === key || (key === "plan" && view === "session") ? "#1a332b" : "transparent", color: view === key || (key === "plan" && view === "session") ? "#39e6b2" : "#8a9994", paddingInline: 4 }}>{label}</button>)}
    </div>
    {message && <div role="status" style={{ color: message.includes("נכשל") || message.includes("צריך") || message.includes("השתנה") ? "#fb8b91" : "#8ff0ce", fontSize: 13, fontWeight: 700 }}>{message}</div>}
    {data.error && <div role="alert" style={{ ...card, color: "#fb8b91" }}>נתוני האימונים לא נטענו. בדוק את החיבור ואת מיגרציית האימונים. <button style={quiet} onClick={data.loadCatalog}>נסה שוב</button></div>}
    {data.loading && <div role="status" style={muted}>טוען אימונים…</div>}

    {view === "plan" && !data.error && <>
      {data.open && <button style={button} onClick={() => openSession(data.open.id)}>המשך אימון פתוח: {data.open.template_name}</button>}
      <div style={{ display: "flex", gap: 7, overflowX: "auto" }}>
        {data.templates.map((template) => <button key={template.id} onClick={() => setTemplateId(template.id)} aria-pressed={selected?.id === template.id}
          style={selected?.id === template.id ? button : quiet}>{template.name}</button>)}
        <button style={quiet} onClick={() => editTemplate(null)}>+ אימון</button>
      </div>
      {selected ? <>
        <div style={{ ...card, borderColor: "#315747" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><div><strong style={{ fontSize: 20 }}>{selected.name}</strong><div style={muted}>{selectedItems.length} תרגילים · צפייה אינה מתחילה אימון</div></div><button style={quiet} onClick={() => editTemplate(selected)}>ערוך</button></div>
          <label style={{ ...muted, display: "block", marginTop: 16 }}>תאריך האימון<input type="date" value={date} onChange={(event) => setDate(event.target.value)} max={todayLocal()} style={{ ...input, marginTop: 5 }} /></label>
          <button style={{ ...button, width: "100%", marginTop: 10 }} disabled={busy || !date || !selectedItems.length} onClick={start}>התחל אימון</button>
        </div>
        {selectedItems.map((item) => {
          const exercise = data.exercises.find((entry) => entry.id === item.exercise_id);
          const prior = last[item.id];
          return <div key={item.id} style={card}><strong>{exercise?.name || "תרגיל בארכיון"}</strong><div style={muted}>{exercise?.muscle_group || ""} · {item.target_sets.length} סטים · מנוחה {item.rest_seconds} שניות</div><div style={muted}>יעד: {item.target_sets.map((target) => `${target.load_kg ?? "—"} ק״ג × ${target.reps_min}–${target.reps_max}`).join(" · ")}</div><div style={muted}>פעם קודמת: {prior?.length ? `${prior[0].performed_on} · ${prior.map((set) => `${set.load_kg ?? "משקל גוף"} × ${set.reps}`).join(" · ")}` : "אין תיעוד"}</div></div>;
        })}
      </> : <div style={{ ...card, color: "#8a9994" }}>אין תכנית עדיין. צור אימון ראשון והוסף תרגילים.</div>}
      <button style={quiet} onClick={() => setExerciseEditor(blankExercise())}>+ תרגיל אישי</button>
      {data.exercises.filter((exercise) => !exercise.archived_at).map((exercise) => <button key={exercise.id} style={{ ...quiet, textAlign: "right" }} onClick={() => setExerciseEditor({ ...exercise, equipment: exercise.equipment || "", notes: exercise.notes || "", current: exercise })}>ערוך תרגיל: {exercise.name}</button>)}
    </>}

    {view === "session" && data.detail && <WorkoutSession data={data} busy={busy} run={run} onBack={() => setView(data.detail.session.status === "completed" ? "history" : "plan")}
      onFinish={async (partial) => { const result = await run(() => data.finishSession(data.detail.session, partial), "האימון נשמר"); if (!result?.error) { localStorage.removeItem(`workout-timer:${data.userId}:${data.detail.session.id}`); await data.loadHistory(0); setView("history"); } }} />}

    {view === "history" && <>
      <button style={quiet} onClick={() => setView("plan")}>+ אימון בתאריך קודם</button>
      {data.history.length === 0 && <div style={{ ...card, color: "#8a9994" }}>אין אימונים שהושלמו עדיין.</div>}
      {data.history.map((session) => <button key={session.id} style={{ ...card, color: "#f4f7f6", textAlign: "right", minHeight: 66, font: "700 15px Heebo, sans-serif", cursor: "pointer" }} onClick={() => openSession(session.id)}>
        {session.template_name} <span style={muted}>· {session.performed_on} {session.partial ? "· אימון חלקי" : ""}</span>
      </button>)}
      {data.hasMore && <button style={quiet} onClick={async () => { await data.loadHistory(page + 1); setPage(page + 1); }}>טען אימונים נוספים</button>}
    </>}

    {view === "progress" && <>
      <div style={card}>
        <strong>עקביות השבוע</strong>
        <div dir="ltr" style={{ fontSize: 24, fontWeight: 900, color: "#39e6b2", textAlign: "right" }}>{data.consistency.total} / {data.weeklyGoal}</div>
        <div style={muted}>{data.consistency.partial} אימונים חלקיים · צפייה בתכנית אינה נספרת</div>
        <label style={{ ...muted, display: "block", marginTop: 10 }}>יעד אימונים שבועי<input style={{ ...input, maxWidth: 110 }} type="number" inputMode="numeric" min="1" max="14" value={weeklyDraft} onChange={(event) => setWeeklyDraft(event.target.value)} /></label>
        <button style={{ ...quiet, marginTop: 7 }} onClick={() => { const goal = Number(weeklyDraft); if (Number.isInteger(goal) && goal >= 1 && goal <= 14) run(() => data.setWeeklyGoal(goal), "היעד נשמר"); else setMessage("בחר יעד בין 1 ל־14."); }}>שמור יעד</button>
      </div>
      <div style={card}>
        <label style={muted}>תרגיל<select value={progressExercise} onChange={(event) => setProgressExercise(event.target.value)} style={input}>{data.exercises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label style={{ ...muted, display: "block", marginTop: 10 }}>אימון<select value={progressTemplate} onChange={(event) => setProgressTemplate(event.target.value)} style={input}><option value="">כל האימונים</option>{data.templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>{[["month", "חודש"], ["quarter", "3 חודשים"], ["year", "שנה"]].map(([key, label]) => <button key={key} style={range === key ? button : quiet} aria-pressed={range === key} onClick={() => setRange(key)}>{label}</button>)}</div>
      </div>
      <div style={card}>
        <strong>ביצועים בתקופה שנבחרה</strong>
        {points.length === 0 ? <p style={muted}>אין סטים מתועדים בטווח הזה.</p> : <>
          <div style={{ marginTop: 8, ...muted }}>{points.length} ביצועים · עומס וחזרות מוצגים יחד</div>
          {peak && <div style={{ marginTop: 9 }}>עומס מרבי בתקופה שנבחרה: <strong>{peak.load_kg} ק״ג × {peak.reps}</strong></div>}
          {loads.length > 0 && <label style={{ ...muted, display: "block", marginTop: 9 }}>חזרות מרביות באותו עומס<select style={input} value={chosenLoad} onChange={(event) => setProgressLoad(event.target.value)}>{loads.map((load) => <option key={load} value={load}>{load === "bodyweight" ? "משקל גוף" : `${load} ק״ג`}</option>)}</select><strong style={{ color: "#f4f7f6" }}>{bestReps?.reps || "—"} חזרות בתקופה שנבחרה</strong></label>}
          {points.some((point) => point.volume != null) && <svg viewBox={`0 0 ${Math.max(280, points.length * 44)} 130`} role="img" aria-label="גרף נפח אימון חיצוני לפי תאריך" style={{ width: "100%", height: 130, marginTop: 14 }}>
            {points.map((point, index) => point.volume == null ? null : <g key={`${point.sessionId}-${index}`}><rect x={index * 44 + 8} y={112 - 100 * point.volume / maxVolume} width="25" height={100 * point.volume / maxVolume} rx="4" fill="#39e6b2" /><text x={index * 44 + 20} y="125" textAnchor="middle" fill="#8a9994" fontSize="9">{point.date.slice(5)}</text></g>)}
          </svg>}
          <div aria-label="נתוני ביצועים" style={{ marginTop: 10 }}>{points.map((point, index) => <button key={`${point.sessionId}-${index}`} onClick={() => openSession(point.sessionId)} style={{ ...quiet, display: "block", textAlign: "right", width: "100%", marginTop: 6 }}>
            {point.date} · {point.template} · {point.heaviest ? `${point.heaviest.load_kg == null ? "משקל גוף" : `${point.heaviest.load_kg} ק״ג`} × ${point.heaviest.reps}` : "ללא סט עבודה"}{point.volume != null ? ` · נפח ${point.volume}` : ""}
          </button>)}</div>
        </>}
      </div>
    </>}

    {exerciseEditor && <div role="dialog" aria-modal="true" aria-label="עריכת תרגיל" style={{ ...card, position: "fixed", inset: "8% max(12px, calc((100vw - 456px)/2)) 8%", zIndex: 50, overflowY: "auto", boxShadow: "0 0 0 100vmax rgba(0,0,0,.7)" }}>
      <h2 style={{ marginTop: 0 }}>{exerciseEditor.current ? "עריכת תרגיל" : "תרגיל חדש"}</h2>
      {message && <div role="status" style={{ color: "#fb8b91" }}>{message}</div>}
      {[["name", "שם התרגיל"], ["muscle_group", "קבוצת שרירים"], ["equipment", "ציוד"], ["notes", "דגשים"]].map(([key, label]) => <label key={key} style={{ ...muted, display: "block", marginBottom: 11 }}>{label}<input style={input} value={exerciseEditor[key] || ""} onChange={(event) => setExerciseEditor((old) => ({ ...old, [key]: event.target.value }))} /></label>)}
      <label style={{ ...muted, display: "block", marginBottom: 11 }}>סוג עומס<select style={input} value={exerciseEditor.load_mode} onChange={(event) => setExerciseEditor((old) => ({ ...old, load_mode: event.target.value }))}><option value="external">משקל חיצוני</option><option value="bodyweight">משקל גוף</option><option value="assisted">סיוע</option></select></label>
      <label style={{ ...muted, display: "block", marginBottom: 11 }}>המשקל נרשם<select style={input} value={exerciseEditor.weight_basis} onChange={(event) => setExerciseEditor((old) => ({ ...old, weight_basis: event.target.value }))}><option value="total">בסך הכול</option><option value="per_hand">לכל יד</option></select></label>
      <label style={{ ...muted, display: "block", marginBottom: 11 }}>החזרות נרשמות<select style={input} value={exerciseEditor.reps_basis} onChange={(event) => setExerciseEditor((old) => ({ ...old, reps_basis: event.target.value }))}><option value="total">בסך הכול</option><option value="per_side">לכל צד</option></select></label>
      <div style={{ display: "flex", gap: 8 }}><button style={button} disabled={busy} onClick={saveExercise}>שמור</button><button style={quiet} onClick={() => setExerciseEditor(null)}>סגור</button></div>
      {exerciseEditor.current && <button style={{ ...quiet, color: "#fb8b91", marginTop: 16 }} onClick={() => onConfirm({ title: "העברת תרגיל לארכיון", body: "התיעוד הקודם יישאר זמין בהיסטוריה.", confirmLabel: "העבר לארכיון", onConfirm: async () => { const result = await data.archiveExercise(exerciseEditor.current); if (!result.error) setExerciseEditor(null); return result.error ? "הפעולה נכשלה" : ""; } })}>העבר לארכיון</button>}
    </div>}

    {templateEditor && <div role="dialog" aria-modal="true" aria-label="עריכת אימון" style={{ ...card, position: "fixed", inset: "5% max(12px, calc((100vw - 456px)/2)) 5%", zIndex: 50, overflowY: "auto", boxShadow: "0 0 0 100vmax rgba(0,0,0,.7)" }}>
      <h2 style={{ marginTop: 0 }}>{templateEditor.current ? "עריכת אימון" : "אימון חדש"}</h2>
      {message && <div role="status" style={{ color: "#fb8b91" }}>{message}</div>}
      <label style={muted}>שם האימון<input style={input} value={templateEditor.name} onChange={(event) => setTemplateEditor((old) => ({ ...old, name: event.target.value }))} placeholder="למשל A — פלג גוף עליון" /></label>
      <label style={{ ...muted, display: "block", marginTop: 10 }}>יום מועדף<select style={input} value={templateEditor.preferred_day ?? ""} onChange={(event) => setTemplateEditor((old) => ({ ...old, preferred_day: event.target.value === "" ? null : Number(event.target.value) }))}><option value="">ללא יום קבוע</option>{["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
      {templateEditor.items.map((item, index) => <div key={`${item.exercise_id}-${index}`} style={{ ...card, marginTop: 10, padding: 12 }}>
        <strong>{data.exercises.find((exercise) => exercise.id === item.exercise_id)?.name || "תרגיל בארכיון"}</strong>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}><button style={quiet} disabled={index === 0} onClick={() => setTemplateEditor((old) => { const items = [...old.items]; [items[index - 1], items[index]] = [items[index], items[index - 1]]; return { ...old, items }; })}>↑</button><button style={quiet} disabled={index === templateEditor.items.length - 1} onClick={() => setTemplateEditor((old) => { const items = [...old.items]; [items[index + 1], items[index]] = [items[index], items[index + 1]]; return { ...old, items }; })}>↓</button><button style={quiet} onClick={() => setTemplateEditor((old) => ({ ...old, items: old.items.filter((_, i) => i !== index) }))}>הסר</button></div>
        {item.target_sets.map((target, targetIndex) => <div key={targetIndex} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 5, marginTop: 7, alignItems: "end" }}>
          <label style={muted}>ק״ג<input style={input} type="number" inputMode="decimal" min="0" step="any" value={target.load_kg ?? ""} onChange={(event) => updateTarget(index, targetIndex, { load_kg: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          <label style={muted}>מ־<input style={input} type="number" inputMode="numeric" min="1" value={target.reps_min ?? ""} onChange={(event) => updateTarget(index, targetIndex, { reps_min: Number(event.target.value) })} /></label>
          <label style={muted}>עד<input style={input} type="number" inputMode="numeric" min="1" value={target.reps_max ?? ""} onChange={(event) => updateTarget(index, targetIndex, { reps_max: Number(event.target.value) })} /></label>
          <button style={quiet} aria-label={`הסר יעד סט ${targetIndex + 1}`} onClick={() => updateItem(index, { target_sets: item.target_sets.filter((_, i) => i !== targetIndex) })}>×</button>
        </div>)}
        <button style={{ ...quiet, marginTop: 7 }} onClick={() => updateItem(index, { target_sets: [...item.target_sets, { load_kg: null, reps_min: 8, reps_max: 12 }] })}>+ סט יעד</button>
        <label style={{ ...muted, display: "block", marginTop: 7 }}>מנוחה בשניות<input style={input} type="number" inputMode="numeric" min="0" max="3600" value={item.rest_seconds} onChange={(event) => updateItem(index, { rest_seconds: Number(event.target.value) })} /></label>
      </div>)}
      <label style={{ ...muted, display: "block", marginTop: 12 }}>הוסף תרגיל קיים<select style={input} value="" onChange={(event) => { if (event.target.value) setTemplateEditor((old) => ({ ...old, items: [...old.items, { exercise_id: event.target.value, target_sets: defaultTargets(), rest_seconds: 60, notes: "" }] })); }}><option value="">בחר תרגיל</option>{data.exercises.filter((exercise) => !exercise.archived_at).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button style={button} disabled={busy} onClick={saveTemplate}>שמור אימון</button><button style={quiet} onClick={() => setTemplateEditor(null)}>סגור</button></div>
      {templateEditor.current && <button style={{ ...quiet, color: "#fb8b91", marginTop: 16 }} onClick={() => onConfirm({ title: "העברת אימון לארכיון", body: "האימונים שבוצעו יישארו בהיסטוריה.", confirmLabel: "העבר לארכיון", onConfirm: async () => { const result = await data.archiveTemplate(templateEditor.current); if (!result.error) { setTemplateEditor(null); setTemplateId(""); } return result.error ? "הפעולה נכשלה" : ""; } })}>העבר לארכיון</button>}
    </div>}
  </div>;
}
