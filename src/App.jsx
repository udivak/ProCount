import { useMemo, useState } from "react";
import { useData, RANGE_DAYS } from "./store.js";
import { headerDate, lastNDates, lastNWeeks, weekdayLabel, weekRangeLabel, shiftDate, dayLabel, greeting } from "./lib/date.js";
import { dailyTotals, remainingProtein, pct, dailyPace, streak, proteinByDay, weekSeries, weeklyAverageSeries, avgCaloriesPerActiveDay, average, entriesByMeal, proteinSuggestion } from "./lib/nutrition.js";
import { Gear, Home, Chart, ListIcon, Plus, Utensils } from "./lib/icons.jsx";
import Today from "./screens/Today.jsx";
import Trends from "./screens/Trends.jsx";
import MyFoods from "./screens/MyFoods.jsx";
import AddSheet from "./screens/AddSheet.jsx";
import Settings from "./screens/Settings.jsx";
import MealPlan from "./screens/MealPlan.jsx";
import FoodEditor from "./FoodEditor.jsx";
import ItemDetailModal from "./ItemDetailModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

const SCALE = 200, CHART_H = 132;
const SOURCE = {
  saved: { tag: "מהיר", iconBg: "rgba(52,211,153,.12)", iconColor: "#39e6b2", sub: "מהיר" },
  manual: { tag: "ידני", iconBg: "rgba(96,165,250,.12)", iconColor: "#60a5fa", sub: "הזנה ידנית" },
  ai: { tag: "AI", iconBg: "rgba(167,139,250,.14)", iconColor: "#a78bfa", sub: "מצילום · AI" },
};
const round = (n) => Math.round(Number(n) || 0);
const blankForm = () => ({ name: "", protein: "", calories: "", grams: "", unit: "מנה", save: false });
const isNonNegative = (value) => String(value ?? "").trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

export default function App({ session }) {
  const data = useData(session);
  const { entries, foods, goal, today } = data;

  const [screen, setScreen] = useState("today");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState("quick");
  const [isGeneralFood, setIsGeneralFood] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [photo, setPhoto] = useState({ state: "idle", note: "", error: null });
  const [photoGuidance, setPhotoGuidance] = useState("");
  const [editFood, setEditFood] = useState(null); // null | {} (new) | foodRow (edit)
  const [selectedEntry, setSelectedEntry] = useState(null); // null | a todayEntries vm item (detail modal)
  const [confirm, setConfirm] = useState(null); // null | { title, body, confirmLabel, onConfirm } — delete guard
  const [chartRange, setChartRange] = useState("week"); // "week" | "month" — Trends bar chart range
  const [selectedDay, setSelectedDay] = useState(today); // which day the Today screen shows
  const [addDate, setAddDate] = useState(today); // which day the add sheet logs onto
  const [mealType, setMealType] = useState("snack");

  // ponytail: nav clamped to the loaded window; fetch older entries on demand if you ever need >35 days back.
  const oldest = lastNDates(RANGE_DAYS)[0];
  const canPrev = selectedDay > oldest;       // YYYY-MM-DD string compare is chronological
  const canNext = selectedDay < today;
  const prevDay = () => { if (canPrev) setSelectedDay(shiftDate(selectedDay, -1)); };
  const nextDay = () => { if (canNext) setSelectedDay(shiftDate(selectedDay, 1)); };

  // ---- view model (mirrors the prototype's renderVals, from real data) ----
  const vm = useMemo(() => {
    const todays = entries.filter((e) => e.eaten_on === selectedDay);
    const t = dailyTotals(entries, selectedDay);
    const pctVal = pct(t.protein, goal);

    const todayEntries = todays.map((e) => {
      const s = SOURCE[e.source] || SOURCE.manual;
      return { ...e, id: e.id, name: e.name || "רישום ללא שם", sub: s.sub, tag: s.tag, iconBg: s.iconBg, iconColor: s.iconColor, protein: round(e.protein_g), calories: round(e.calories), grams: e.grams == null ? null : Number(e.grams), proteinRaw: Number(e.protein_g) || 0 };
    });

    const dates = lastNDates(7);
    const series = weekSeries(entries, dates);
    // Bar height/color share one formula across ranges so the daily goal line stays comparable.
    const bar = (protein, current, met, label) => ({
      label,
      h: Math.max(2, Math.round((Math.min(protein, SCALE) / SCALE) * CHART_H)),
      color: current ? "linear-gradient(180deg,#6ee7b7,#39e6b2)" : met ? "#2a9d6f" : "#2b2b31",
      glow: current ? "0 0 12px rgba(52,211,153,.5)" : "none",
      labelColor: current ? "#39e6b2" : "#6f6f78",
    });
    let bars, heading;
    if (chartRange === "month") {
      const weeks = weeklyAverageSeries(entries, lastNWeeks(4));
      bars = weeks.map((w, i) => bar(w.protein, i === weeks.length - 1, w.protein >= goal, weekRangeLabel(w.dates)));
      heading = "חלבון · 4 שבועות";
    } else {
      bars = series.map((d) => bar(d.protein, d.date === today, d.protein >= goal, weekdayLabel(d.date, today)));
      heading = "חלבון · 7 ימים";
    }

    const foodVm = foods.map((f) => ({ id: f.id, name: f.name, unit: f.unit || "מותאם", protein: round(f.protein_g), calories: round(f.calories), raw: f }));

    return {
      totals: { protein: round(t.protein), calories: Math.round(t.calories).toLocaleString(), count: todays.length, pctLabel: Math.round(pctVal * 100) + "%" },
      remaining: round(remainingProtein(t.protein, goal)),
      pace: selectedDay === today ? dailyPace(t.protein, goal) : null,
      ringOffset: Math.round(490 * (1 - pctVal)),
      todayEntries,
      mealGroups: entriesByMeal(todayEntries),
      suggestion: proteinSuggestion(foods, remainingProtein(t.protein, goal)),
      bars,
      heading,
      goalY: Math.round((Math.min(goal, SCALE) / SCALE) * CHART_H),
      avg: average(series.map((d) => d.protein)),
      streak: streak(proteinByDay(entries), goal),
      calAvg: avgCaloriesPerActiveDay(entries, dates).toLocaleString(),
      foodVm,
      // quota is per real today (the server enforces the daily AI limit on the real calendar day)
      aiQuota: Math.max(0, 6 - entries.filter((e) => e.eaten_on === today && e.source === "ai").length),
    };
  }, [entries, foods, goal, today, selectedDay, chartRange]);

  const header = { today: { sub: headerDate(), title: "ProCount", greet: greeting(data.name || data.email.split("@")[0]) }, trends: { sub: "מעקב לאורך זמן", title: "מגמות" }, foods: { sub: "התבניות שלי", title: "מאכלים שלי" }, mealPlan: { sub: "התזונה שלך", title: "תפריט" } }[screen];

  // ---- actions ----
  const openAdd = () => { setForm(blankForm()); setMealType("snack"); setAddDate(selectedDay); setPhoto({ state: "idle", note: "", error: null }); setPhotoGuidance(""); setAddTab("quick"); setIsGeneralFood(false); setAddOpen(true); };
  const openAddManual = () => { setForm(blankForm()); setMealType("snack"); setAddDate(selectedDay); setAddTab("manual"); setIsGeneralFood(false); setAddOpen(true); };
  const openGeneralFood = () => { setForm(blankForm()); setAddTab("manual"); setIsGeneralFood(true); };
  const onTab = (tab) => { setAddTab(tab); setIsGeneralFood(false); setPhoto({ state: "idle", note: "", error: null }); };

  const discardAdd = () => { setForm(blankForm()); setPhoto({ state: "idle", note: "", error: null }); setPhotoGuidance(""); setAddOpen(false); };
  const quickAdd = (foodRow, qty) => { data.addQuick(foodRow.raw || foodRow, qty, addDate, mealType); setSelectedDay(addDate); discardAdd(); };

  const submitAdd = async () => {
    if (isGeneralFood && (!(form.name || "").trim() || !isNonNegative(form.protein) || !isNonNegative(form.calories))) return;
    if (addTab === "photo") await data.addAi(form, addDate, mealType);
    else await data.addManual(form, addDate, mealType);
    setForm(blankForm());
    setPhotoGuidance("");
    setIsGeneralFood(false);
    setSelectedDay(addDate); // jump the view to the day we just logged onto
    setAddOpen(false);
  };

  const pickPhoto = async (file) => {
    if (!file) return;
    setPhoto({ state: "loading", note: "", error: null });
    const r = await data.analyzePhoto(file, photoGuidance);
    if (r.estimate) {
      setForm({ name: r.estimate.name || "", protein: String(round(r.estimate.protein_g)), calories: String(round(r.estimate.calories)), grams: "", unit: "מנה", save: false });
      setPhoto({ state: "done", note: r.estimate.note || "", confidence: r.estimate.confidence, error: null });
    } else {
      // fall back to manual entry (design §6.5)
      const msg = r.error === "daily_limit" ? "נגמרו הניתוחים להיום — עבור להזנה ידנית" : "הניתוח נכשל — נסה שוב או הזן ידנית";
      setPhoto({ state: "idle", note: "", error: msg });
    }
  };

  const goTo = (s) => { setScreen(s); setSettingsOpen(false); };

  return (
    <div className="app">
      <div style={{ flex: "none", padding: "calc(18px + env(safe-area-inset-top)) 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6f6f78", letterSpacing: ".02em" }}>{header.sub}</div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: ".02em" }}>{header.title}</div>
          {/* ponytail: greeting recomputes on render via new Date(); no live ticking — refreshes on next re-render, good enough. */}
          {header.greet && <div style={{ fontSize: 13, fontWeight: 600, color: "#39e6b2", letterSpacing: ".01em" }}>{header.greet}</div>}
        </div>
        <button className="h-gear" aria-label="הגדרות" onClick={() => setSettingsOpen(true)} style={{ width: 42, height: 42, border: "none", borderRadius: 14, background: "#101516", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Gear size={20} />
        </button>
      </div>

      <div className="pc-scroll app-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {screen === "today" && <Today totals={vm.totals} goal={goal} ringOffset={vm.ringOffset} remaining={vm.remaining} pace={vm.pace} mealGroups={vm.mealGroups} suggestion={vm.suggestion} onDelete={(id) => setConfirm({ title: "מחיקת רישום", body: "הרישום יימחק מהיום.", confirmLabel: "מחק", onConfirm: () => data.deleteEntry(id) })} onSelect={setSelectedEntry} dayLabel={dayLabel(selectedDay, today)} isToday={selectedDay === today} onToday={() => setSelectedDay(today)} onPrev={prevDay} onNext={nextDay} canPrev={canPrev} canNext={canNext} />}
        {screen === "trends" && <Trends goal={goal} streak={vm.streak} avg={vm.avg} bars={vm.bars} goalY={vm.goalY} calAvg={vm.calAvg} heading={vm.heading} range={chartRange} onRange={setChartRange} />}
        {screen === "foods" && <MyFoods foods={vm.foodVm} onNew={openAddManual} onEdit={(f) => setEditFood(f.raw)} />}
        {screen === "mealPlan" && <MealPlan />}
      </div>

      {!addOpen && !settingsOpen && !editFood && !selectedEntry && !confirm && screen !== "mealPlan" && (
        <button className="h-fab" onClick={openAdd} aria-label="הוסף מזון" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 30, width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #071a14", fontFamily: "inherit", background: "#39e6b2", color: "#03120d", borderRadius: "50%", cursor: "pointer", boxShadow: "0 0 0 6px rgba(57,230,178,.12), 0 8px 30px rgba(57,230,178,.48)" }}>
          <Plus size={30} sw={3} />
        </button>
      )}

      <div className="bottom-nav">
        <NavBtn color={screen === "today" ? "#39e6b2" : "#6f6f78"} label="היום" onClick={() => goTo("today")}><Home size={24} /></NavBtn>
        <NavBtn color={screen === "mealPlan" ? "#39e6b2" : "#6f6f78"} label="תפריט" onClick={() => goTo("mealPlan")}><Utensils size={24} /></NavBtn>
        <NavBtn color={screen === "trends" ? "#39e6b2" : "#6f6f78"} label="מגמות" onClick={() => goTo("trends")}><Chart size={24} /></NavBtn>
        <NavBtn color={screen === "foods" ? "#39e6b2" : "#6f6f78"} label="מאכלים" onClick={() => goTo("foods")}><ListIcon size={24} /></NavBtn>
      </div>

      {addOpen && (
        <AddSheet tab={addTab} onTab={onTab} onClose={discardAdd} foods={vm.foodVm} form={form} isGeneralFood={isGeneralFood} onOpenGeneral={openGeneralFood}
          onField={(k, v) => setForm((f) => ({ ...f, [k]: v }))} onToggleSave={() => setForm((f) => ({ ...f, save: !f.save }))}
          onSubmit={submitAdd} onQuickAdd={quickAdd} photo={{ ...photo, quota: vm.aiQuota }} onPickPhoto={pickPhoto} photoGuidance={photoGuidance} onPhotoGuidance={setPhotoGuidance}
          date={addDate} onDate={setAddDate} minDate={oldest} maxDate={today} mealType={mealType} onMealType={setMealType} />
      )}

      {settingsOpen && (
        <Settings goal={goal} name={data.name} email={data.email} onName={data.setName} onBack={() => setSettingsOpen(false)}
          onDec={() => data.setGoal(Math.max(80, goal - 5))} onInc={() => data.setGoal(Math.min(260, goal + 5))} onSignOut={data.signOut} />
      )}

      {editFood && <FoodEditor food={editFood} onSave={async (v) => { await data.saveFood(v); setEditFood(null); }} onDelete={(id) => setConfirm({ title: "מחיקת מאכל", body: "המאכל יימחק מהרשימה שלך.", confirmLabel: "מחק", onConfirm: async () => { await data.deleteFood(id); setEditFood(null); } })} onClose={() => setEditFood(null)} />}

      {selectedEntry && <ItemDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}

      {confirm && <ConfirmDialog title={confirm.title} body={confirm.body} confirmLabel={confirm.confirmLabel}
        onConfirm={async () => { await confirm.onConfirm(); setConfirm(null); }}
        onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function NavBtn({ color, label, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color }}>
      {children}
      <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
    </button>
  );
}
