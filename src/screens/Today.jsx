import { useState } from "react";
import { Droplet, Flame, Trash } from "../lib/icons.jsx";

// Today — neon coach layout: progress arc, compact metrics, insight, and meal timeline.
const MEAL_LABELS = { breakfast: "בוקר", lunch: "צהריים", dinner: "ערב", snack: "נשנוש" };
const PACE_LABELS = { excellent: "בקצב מצוין", good: "בקצב טוב", behind: "קצת מאחור" };

export default function Today({ totals, goal, remaining, pace, calorieProgress, waterMl, waterGoal, onAddWater, waterUndo, onUndoWater, waterError, mealGroups, suggestion, onDelete, onSelect, dayLabel, isToday, onToday, onPrev, onNext, canPrev, canNext }) {
  const pct = Math.min(1, Math.max(0, Number(totals.protein) / Math.max(1, Number(goal))));
  const dash = Math.round(410 * (1 - pct));
  return <div className="today-neon">
    <div className="today-daybar"><DayArrow chevron="›" label="יום קודם" disabled={!canPrev} onClick={onPrev} /><div className="today-daycenter"><div className="today-daylabel">{dayLabel}</div>{!isToday && <button className="back-today" onClick={onToday}>היום</button>}</div><DayArrow chevron="‹" label="יום הבא" disabled={!canNext} onClick={onNext} /></div>
    <section className="hero-neon"><div className="hero-glow" /><div className="hero-kicker">יעד חלבון יומי</div><div className="arc-wrap"><svg viewBox="0 0 220 140" aria-hidden="true"><path d="M24 120 A86 86 0 0 1 196 120" fill="none" stroke="#143a30" strokeWidth="15" strokeLinecap="round" /><path d="M24 120 A86 86 0 0 1 196 120" fill="none" stroke="#39e6b2" strokeWidth="15" strokeLinecap="round" strokeDasharray="410" strokeDashoffset={dash} style={{ filter: "drop-shadow(0 0 8px rgba(57,230,178,.5))", transition: "stroke-dashoffset .5s ease" }} /></svg><div className="arc-value"><strong>{totals.protein}</strong><span>/ {goal} גרם</span></div></div><div className="hero-remaining">{remaining > 0 ? `נשארו ${remaining} גרם` : "היעד הושג"} · {totals.pctLabel} מהיעד</div></section>
    <section className="metric-row"><div className="metric">{pace ? <><div className="metric-value pace-percentage">{pace.progressPct}%</div><div className="metric-label">קצב יומי</div><div className="metric-sub" style={{ color: pace.status === "behind" ? "#fbbf24" : "#39e6b2" }}>{PACE_LABELS[pace.status]}</div><div className="metric-sub">מול {pace.elapsedPct}% מהיום שעבר</div><div className="metric-bar"><i style={{ width: `${pace.progressPct}%`, background: pace.status === "behind" ? "#fbbf24" : "#39e6b2" }} /></div></> : <><div className="metric-value protein">{totals.pctLabel}</div><div className="metric-label">סיכום יום</div><div className="metric-sub">{remaining > 0 ? `חסרו ${remaining} גרם` : "היעד הושג"}</div><div className="metric-bar"><i style={{ width: `${pct * 100}%`, background: "#39e6b2" }} /></div></>}</div><div className="metric-divider" /><div className="metric"><div className="metric-value calories">{totals.calories}</div><div className="metric-label"><Flame size={14} /> קלוריות</div><div className="metric-sub">מספר רץ</div><div className="metric-bar"><i style={{ width: `${calorieProgress * 100}%`, background: "#fb923c" }} /></div></div></section>
    <WaterCard total={waterMl} goal={waterGoal} onAdd={onAddWater} undo={waterUndo} onUndo={onUndoWater} error={waterError} />
    <section className="insight-neon"><div className="insight-icon">✦</div><div><strong>{totals.protein ? "אתה בדרך הנכונה." : "מתחילים בקטן."}</strong><span>כל בחירה קטנה היום מקרבת אותך ליעד.</span></div></section>
    {suggestion && <section style={{ marginTop: 14, padding: "14px 15px", background: "#101918", border: "1px solid #1f3831", borderRadius: 16 }}><div style={{ color: "#39e6b2", fontSize: 14, fontWeight: 800 }}>חסרים {remaining} גרם חלבון</div><div style={{ color: "#d4d4d8", fontSize: 14, marginTop: 5 }}>נסה: {suggestion.foods.map((food) => `${food.name} (${Math.round(Number(food.protein_g) || 0)}g)`).join(" + ")}</div></section>}
    <div className="entries-head"><strong>מה אכלת</strong><span>{totals.count} פריטים</span></div>
    {mealGroups.length === 0 ? <div className="empty-neon">עדיין לא הוספת ארוחות היום</div> : <div className="meal-list">{mealGroups.map((group) => <section key={group.type} style={{ marginBottom: 18 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><strong style={{ fontSize: 15 }}>{MEAL_LABELS[group.type]}</strong><span style={{ color: "#39e6b2", fontSize: 13, fontWeight: 800 }}>{Math.round(group.protein)}g חלבון</span></div>{group.entries.map((e, i) => <div key={e.id} className="meal-row" onClick={() => onSelect(e)} role="button" tabIndex={0} aria-label={`פרטי ${e.name}`}><div className="meal-dot" style={{ background: i % 2 ? "#fb923c" : "#39e6b2" }} /><div className="meal-copy"><strong>{e.name}</strong><span>{e.sub}</span></div><div className="meal-macros"><b><em>{e.protein}g</em> חלבון</b><small><em>{e.calories}</em> קל׳</small></div><button className="h-del meal-delete" aria-label="מחק רישום" onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}><Trash size={15} /></button></div>)}</section>)}</div>}
  </div>;
}

function WaterCard({ total, goal, onAdd, undo, onUndo, error }) {
  const [custom, setCustom] = useState("");
  const progress = Math.min(100, Math.round((Number(total) / Math.max(1, Number(goal))) * 100));
  const addCustom = async () => {
    const amount = Math.round(Number(custom));
    if (!(amount > 0)) return;
    await onAdd(amount);
    setCustom("");
  };
  return <section className="water-card">
    <div className="water-head">
      <div className="water-title"><span className="water-icon"><Droplet size={18} /></span><strong>מים</strong></div>
      <div className="water-total"><b>{Number(total).toLocaleString("he-IL")}</b> / {Number(goal).toLocaleString("he-IL")} מ״ל</div>
    </div>
    <div className="water-track" aria-label={`שתית ${total} מתוך ${goal} מיליליטר`}><i style={{ width: `${progress}%` }} /></div>
    <div className="water-actions">
      {[250, 500, 700].map((amount) => <button key={amount} onClick={() => onAdd(amount)}>+{amount} מ״ל</button>)}
    </div>
    <div className="water-custom">
      <input value={custom} onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" dir="ltr" placeholder="כמות אחרת במ״ל" aria-label="כמות מים אחרת במיליליטר" />
      <button onClick={addCustom} disabled={!(Number(custom) > 0)}>הוסף</button>
    </div>
    {undo && <button className="water-undo" onClick={onUndo}>בטל +{undo.amount} מ״ל</button>}
    {error && <div className="water-error" role="alert">{error}</div>}
  </section>;
}

function DayArrow({ chevron, label, disabled, onClick }) { return <button className="day-arrow-neon" onClick={onClick} disabled={disabled} aria-label={label}>{chevron}</button>; }
