import { useState } from "react";
import { Droplet, Flame, Plus, Trash } from "../lib/icons.jsx";

const MEAL_LABELS = { breakfast: "בוקר", lunch: "צהריים", dinner: "ערב", snack: "נשנוש" };
const PACE_LABELS = { excellent: "בקצב מצוין", good: "בקצב טוב", behind: "קצת מאחור" };
const format = (value) => Number(value || 0).toLocaleString("he-IL");

export default function Today({ totals, goal, progress, remaining, pace, calorieProgress, calorieIntake, calorieGoal, calorieBalance, waterMl, waterGoal, onAddWater, waterUndo, onUndoWater, waterError, mealGroups, suggestion, onAdd, onDelete, onSelect, dayLabel, isToday, onToday, onPrev, onNext, canPrev, canNext }) {
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
      <WaterCard total={waterMl} goal={waterGoal} onAdd={onAddWater} undo={waterUndo} onUndo={onUndoWater} error={waterError} />
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
  </div>;
}

function WaterCard({ total, goal, onAdd, undo, onUndo, error }) {
  const [custom, setCustom] = useState("");
  const [showMore, setShowMore] = useState(false);
  const progress = Math.min(100, Math.round((Number(total) / Math.max(1, Number(goal))) * 100));
  const addCustom = async () => {
    const amount = Math.round(Number(custom));
    if (!(amount > 0)) return;
    await onAdd(amount);
    setCustom("");
  };
  return <section className="water-card">
    <div className="mini-card-head"><strong>מים</strong><span className="mini-icon water"><Droplet size={18} /></span></div>
    <div className="mini-value"><b>{format(total / 1000)}</b><span> / {format(goal / 1000)} ל׳</span></div>
    <div className="water-track" aria-label={`שתית ${total} מתוך ${goal} מיליליטר`}><i style={{ width: `${progress}%` }} /></div>
    <div className="water-actions">
      {[250, 500].map((amount) => <button key={amount} onClick={() => onAdd(amount)}>+{amount}</button>)}
      <button aria-expanded={showMore} onClick={() => setShowMore((value) => !value)}>אחר</button>
    </div>
    {showMore && <div className="water-more">
      <button onClick={() => onAdd(700)}>+700 מ״ל</button>
      <div className="water-custom"><input value={custom} onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" dir="ltr" placeholder="מ״ל" aria-label="כמות מים אחרת במיליליטר" /><button onClick={addCustom} disabled={!(Number(custom) > 0)}>הוסף</button></div>
    </div>}
    {undo && <button className="water-undo" onClick={onUndo}>בטל +{undo.amount} מ״ל</button>}
    {error && <div className="water-error" role="alert">{error}</div>}
  </section>;
}

function DayArrow({ chevron, label, disabled, onClick }) { return <button className="day-arrow-neon" onClick={onClick} disabled={disabled} aria-label={label}>{chevron}</button>; }
