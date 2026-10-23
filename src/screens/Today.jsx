import { useState } from "react";
import { Droplet, Flame, Plus, Trash } from "../lib/icons.jsx";

const MEAL_LABELS = { breakfast: "בוקר", lunch: "צהריים", dinner: "ערב", snack: "נשנוש" };
const PACE_LABELS = { excellent: "בקצב מצוין", good: "בקצב טוב", behind: "קצת מאחור" };
const format = (value) => Number(value || 0).toLocaleString("he-IL");

export default function Today({ totals, goal, progress, remaining, pace, calorieProgress, calorieIntake, calorieGoal, calorieBalance, waterMl, waterEntries, waterLogKey, waterGoal, onAddWater, waterAdding, waterUndo, onUndoWater, waterError, mealGroups, suggestion, onAdd, onDelete, onSelect, dayLabel, isToday, onToday, onPrev, onNext, canPrev, canNext }) {
  return <div className="today-neon">
    <div className="today-daybar">
      <DayArrow chevron="›" label="יום קודם" disabled={!canPrev} onClick={onPrev} />
      <div className="today-daycenter"><div className="today-daylabel">{dayLabel}</div>{!isToday && <button className="back-today" onClick={onToday}>חזרה להיום</button>}</div>
      <DayArrow chevron="‹" label="יום הבא" disabled={!canNext} onClick={onNext} />
    </div>

    <section className="hero-neon" aria-label={`חלבון: ${totals.protein} מתוך ${goal} גרם`}>
      <div className="hero-copy">
        <div className="hero-kicker">יעד חלבון</div>
        <div className="hero-number"><strong>{totals.protein}</strong><span> גרם</span></div>
        <div className="hero-goal">מתוך {goal}</div>
        <div className="hero-rule" />
        <div className="hero-remaining">{remaining > 0 ? `נשארו ${remaining} גרם` : "היעד הושג"}</div>
        <div className={`pace-label ${pace?.status === "behind" ? "is-behind" : ""}`}>{pace ? PACE_LABELS[pace.status] : totals.pctLabel + " מהיעד"}</div>
      </div>
      <div className="protein-ring" style={{ "--progress": `${Math.round(progress * 360)}deg` }}><div><strong>{totals.pctLabel}</strong><span>מהיעד</span></div></div>
    </section>

    <div className="today-secondary-grid">
      <section className="calorie-card">
        <div className="mini-card-head"><strong>קלוריות</strong><span className="mini-icon calories"><Flame size={18} /></span></div>
        <div className="mini-value"><b>{format(calorieIntake)}</b><span> / {format(calorieGoal)}</span></div>
        <div className="mini-sub">{calorieBalance >= 0 ? `נותרו ${format(calorieBalance)} קל׳` : `חריגה של ${format(Math.abs(calorieBalance))} קל׳`}</div>
        <div className="metric-bar"><i style={{ width: `${calorieProgress * 100}%`, background: "#fb923c" }} /></div>
      </section>
      <WaterCard total={waterMl} goal={waterGoal} onAdd={onAddWater} adding={waterAdding} undo={waterUndo} onUndo={onUndoWater} error={waterError} />
    </div>

    {suggestion && <section className="suggestion-card">
      <div><strong>הצעד הבא</strong><span>{suggestion.foods.map((food) => `${food.name} · ${Math.round(Number(food.protein_g) || 0)} גרם`).join(" + ")}</span></div>
      <button onClick={onAdd}>הוסף</button>
    </section>}

    <section className="entries-card">
      <div className="entries-head"><strong>ארוחות היום</strong><span>{totals.count} פריטים</span></div>
      {mealGroups.length === 0 ? <div className="empty-neon">עדיין לא הוספת ארוחות היום</div> : <div className="meal-list">{mealGroups.map((group) => <section key={group.type} className="meal-group"><div className="meal-group-head"><strong>{MEAL_LABELS[group.type]}</strong><span>{Math.round(group.protein)} גרם חלבון</span></div>{group.entries.map((entry) => <div key={entry.id} className="meal-row" onClick={() => onSelect(entry)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(entry); } }} role="button" tabIndex={0} aria-label={`פרטי ${entry.name}`}><div className="meal-copy"><strong>{entry.name}</strong><span>{entry.sub}</span></div><div className="meal-macros"><b><em>{entry.protein}</em> גרם חלבון</b><small><em>{entry.calories}</em> קל׳</small></div><button className="h-del meal-delete" aria-label={`מחק ${entry.name}`} onClick={(event) => { event.stopPropagation(); onDelete(entry.id); }}><Trash size={17} /></button></div>)}</section>)}</div>}
      <button className="entries-add" onClick={onAdd}><Plus size={20} sw={2.5} />הוסף מזון</button>
    </section>

    <WaterLog key={waterLogKey} entries={waterEntries} onDelete={onDelete} />
  </div>;
}

function WaterLog({ entries, onDelete }) {
  return <details className="entries-card">
    <summary style={{ cursor: "pointer", minHeight: 44, alignContent: "center", fontSize: 17, fontWeight: 700 }}>
      רישומי מים <span style={{ color: "var(--pc-muted)", fontSize: 12, fontWeight: 700 }}>· {entries.length} רישומים</span>
    </summary>
    {entries.length === 0 ? <div className="empty-neon">אין רישומי מים ביום הזה</div> : <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {entries.map((entry) => <li key={entry.id} style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 62, borderTop: "1px solid #26302d" }}>
        <span style={{ color: "var(--pc-water)", display: "flex" }}><Droplet size={18} /></span>
        <div className="meal-copy">
          <strong>{format(entry.water_ml)} מ״ל</strong>
          {entry.created_at && <span>{new Date(entry.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        <button className="h-del meal-delete" aria-label={`מחק רישום מים של ${format(entry.water_ml)} מיליליטר`} onClick={() => onDelete(entry.id)}><Trash size={17} /></button>
      </li>)}
    </ul>}
  </details>;
}

function WaterCard({ total, goal, onAdd, adding, undo, onUndo, error }) {
  const [custom, setCustom] = useState("");
  const [showMore, setShowMore] = useState(false);
  const pending = adding != null;
  const pendingStyle = pending ? { opacity: .45, cursor: "wait" } : undefined;
  const progress = Math.min(100, Math.round((Number(total) / Math.max(1, Number(goal))) * 100));
  const addCustom = async () => {
    const amount = Math.round(Number(custom));
    if (!(amount > 0)) return;
    await onAdd(amount);
    setCustom("");
  };
  return <section className="water-card" aria-busy={pending}>
    <div className="mini-card-head"><strong>מים</strong><span className="mini-icon water"><Droplet size={18} /></span></div>
    <div className="mini-value"><b>{format(total / 1000)}</b><span> / {format(goal / 1000)} ל׳</span></div>
    <div className="water-track" aria-label={`שתית ${total} מתוך ${goal} מיליליטר`}><i style={{ width: `${progress}%` }} /></div>
    <div className="water-actions">
      {[275, 700].map((amount) => <button key={amount} disabled={pending} style={pendingStyle} onClick={() => onAdd(amount)}>{adding === amount ? "מוסיף…" : `+${amount}`}</button>)}
      <button disabled={pending} style={pendingStyle} aria-expanded={showMore} onClick={() => setShowMore((value) => !value)}>אחר</button>
    </div>
    {showMore && <div className="water-more">
      <button disabled={pending} style={pendingStyle} onClick={() => onAdd(500)}>{adding === 500 ? "מוסיף…" : "+500 מ״ל"}</button>
      <div className="water-custom"><input disabled={pending} value={custom} onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" dir="ltr" placeholder="מ״ל" aria-label="כמות מים אחרת במיליליטר" /><button onClick={addCustom} style={pendingStyle} disabled={pending || !(Number(custom) > 0)}>{pending && adding === Number(custom) ? "מוסיף…" : "הוסף"}</button></div>
    </div>}
    {pending && <div role="status" style={{ fontSize: 12, marginTop: 6 }}>מוסיף מים…</div>}
    {undo && <button disabled={pending} style={pendingStyle} className="water-undo" onClick={onUndo}>בטל +{undo.amount} מ״ל</button>}
    {error && <div className="water-error" role="alert">{error}</div>}
  </section>;
}

function DayArrow({ chevron, label, disabled, onClick }) { return <button className="day-arrow-neon" onClick={onClick} disabled={disabled} aria-label={label}>{chevron}</button>; }
