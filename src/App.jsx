import { useMemo, useState } from "react";
import { useData } from "./store.js";
import { headerDate, lastNDates, weekdayLabel } from "./lib/date.js";
import { dailyTotals, remainingProtein, pct, streak, proteinByDay, weekSeries, avgCaloriesPerActiveDay, average } from "./lib/nutrition.js";
import { Gear, Home, Chart, ListIcon, Plus } from "./lib/icons.jsx";
import Today from "./screens/Today.jsx";
import Trends from "./screens/Trends.jsx";
import MyFoods from "./screens/MyFoods.jsx";
import AddSheet from "./screens/AddSheet.jsx";
import Settings from "./screens/Settings.jsx";
import FoodEditor from "./FoodEditor.jsx";

const SCALE = 200, CHART_H = 132;
const SOURCE = {
  saved: { tag: "מהיר", iconBg: "rgba(52,211,153,.12)", iconColor: "#34d399", sub: "מהיר" },
  manual: { tag: "ידני", iconBg: "rgba(96,165,250,.12)", iconColor: "#60a5fa", sub: "הזנה ידנית" },
  ai: { tag: "AI", iconBg: "rgba(167,139,250,.14)", iconColor: "#a78bfa", sub: "מצילום · AI" },
};
const round = (n) => Math.round(Number(n) || 0);
const blankForm = () => ({ name: "", protein: "", calories: "", save: false });

export default function App({ session }) {
  const data = useData(session);
  const { entries, foods, goal, today } = data;

  const [screen, setScreen] = useState("today");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState("quick");
  const [form, setForm] = useState(blankForm());
  const [photo, setPhoto] = useState({ state: "idle", note: "", error: null });
  const [editFood, setEditFood] = useState(null); // null | {} (new) | foodRow (edit)

  // ---- view model (mirrors the prototype's renderVals, from real data) ----
  const vm = useMemo(() => {
    const todays = entries.filter((e) => e.eaten_on === today);
    const t = dailyTotals(entries, today);
    const pctVal = pct(t.protein, goal);

    const todayEntries = todays.map((e) => {
      const s = SOURCE[e.source] || SOURCE.manual;
      return { id: e.id, name: e.name || "רישום ללא שם", sub: s.sub, tag: s.tag, iconBg: s.iconBg, iconColor: s.iconColor, protein: round(e.protein_g), calories: round(e.calories) };
    });

    const dates = lastNDates(7);
    const series = weekSeries(entries, dates);
    const bars = series.map((d) => {
      const isToday = d.date === today;
      const met = d.protein >= goal;
      return {
        label: weekdayLabel(d.date, today),
        h: Math.max(2, Math.round((Math.min(d.protein, SCALE) / SCALE) * CHART_H)),
        color: isToday ? "linear-gradient(180deg,#6ee7b7,#34d399)" : met ? "#2a9d6f" : "#2b2b31",
        glow: isToday ? "0 0 12px rgba(52,211,153,.5)" : "none",
        labelColor: isToday ? "#34d399" : "#6f6f78",
      };
    });

    const foodVm = foods.map((f) => ({ id: f.id, name: f.name, unit: f.unit || "מותאם", protein: round(f.protein_g), calories: round(f.calories), raw: f }));

    return {
      totals: { protein: round(t.protein), calories: Math.round(t.calories).toLocaleString(), count: todays.length, pctLabel: Math.round(pctVal * 100) + "%" },
      remaining: round(remainingProtein(t.protein, goal)),
      ringOffset: Math.round(490 * (1 - pctVal)),
      todayEntries,
      bars,
      goalY: Math.round((Math.min(goal, SCALE) / SCALE) * CHART_H),
      avg: average(series.map((d) => d.protein)),
      streak: streak(proteinByDay(entries), goal),
      calAvg: avgCaloriesPerActiveDay(entries, dates).toLocaleString(),
      foodVm,
      aiQuota: Math.max(0, 6 - todays.filter((e) => e.source === "ai").length),
    };
  }, [entries, foods, goal, today]);

  const header = { today: { sub: headerDate(), title: "ProCount" }, trends: { sub: "מעקב לאורך זמן", title: "מגמות" }, foods: { sub: "התבניות שלי", title: "מאכלים שלי" } }[screen];

  // ---- actions ----
  const openAdd = () => { setForm(blankForm()); setPhoto({ state: "idle", note: "", error: null }); setAddTab("quick"); setAddOpen(true); };
  const openAddManual = () => { setForm(blankForm()); setAddTab("manual"); setAddOpen(true); };
  const onTab = (tab) => { setAddTab(tab); setPhoto({ state: "idle", note: "", error: null }); };

  const quickAdd = (foodRow, qty) => { data.addQuick(foodRow.raw || foodRow, qty); setAddOpen(false); };

  const submitAdd = async () => {
    if (addTab === "photo") await data.addAi(form);
    else await data.addManual(form);
    setForm(blankForm());
    setAddOpen(false);
  };

  const pickPhoto = async (file) => {
    if (!file) return;
    setPhoto({ state: "loading", note: "", error: null });
    const r = await data.analyzePhoto(file);
    if (r.estimate) {
      setForm({ name: r.estimate.name || "", protein: String(round(r.estimate.protein_g)), calories: String(round(r.estimate.calories)), save: false });
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
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.01em" }}>{header.title}</div>
        </div>
        <button className="h-gear" aria-label="הגדרות" onClick={() => setSettingsOpen(true)} style={{ width: 42, height: 42, border: "none", borderRadius: 14, background: "#161619", color: "#8a8a93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Gear size={20} />
        </button>
      </div>

      <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 20px calc(110px + env(safe-area-inset-bottom))" }}>
        {screen === "today" && <Today totals={vm.totals} goal={goal} ringOffset={vm.ringOffset} remaining={vm.remaining} entries={vm.todayEntries} onDelete={data.deleteEntry} />}
        {screen === "trends" && <Trends goal={goal} streak={vm.streak} avg={vm.avg} bars={vm.bars} goalY={vm.goalY} calAvg={vm.calAvg} />}
        {screen === "foods" && <MyFoods foods={vm.foodVm} onNew={openAddManual} onEdit={(f) => setEditFood(f.raw)} />}
      </div>

      {!addOpen && !settingsOpen && !editFood && (
        <button className="h-fab" onClick={openAdd} style={{ position: "absolute", bottom: "calc(90px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", zIndex: 30, display: "flex", alignItems: "center", gap: 8, border: "none", fontFamily: "inherit", background: "linear-gradient(180deg,#34d399,#1f9d6f)", color: "#06120c", fontSize: 16, fontWeight: 800, padding: "15px 28px", borderRadius: 999, cursor: "pointer", boxShadow: "0 8px 28px rgba(52,211,153,.45),0 2px 8px rgba(0,0,0,.4)" }}>
          <Plus size={20} sw={3} /> הוסף
        </button>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "calc(80px + env(safe-area-inset-bottom))", background: "rgba(10,10,12,.92)", backdropFilter: "blur(16px)", borderTop: "1px solid #1c1c20", display: "flex", alignItems: "stretch", padding: "8px 16px calc(22px + env(safe-area-inset-bottom))", zIndex: 20 }}>
        <NavBtn color={screen === "today" ? "#34d399" : "#6f6f78"} label="היום" onClick={() => goTo("today")}><Home size={24} /></NavBtn>
        <NavBtn color={screen === "trends" ? "#34d399" : "#6f6f78"} label="מגמות" onClick={() => goTo("trends")}><Chart size={24} /></NavBtn>
        <NavBtn color={screen === "foods" ? "#34d399" : "#6f6f78"} label="מאכלים" onClick={() => goTo("foods")}><ListIcon size={24} /></NavBtn>
      </div>

      {addOpen && (
        <AddSheet tab={addTab} onTab={onTab} onClose={() => setAddOpen(false)} foods={vm.foodVm} form={form}
          onField={(k, v) => setForm((f) => ({ ...f, [k]: v }))} onToggleSave={() => setForm((f) => ({ ...f, save: !f.save }))}
          onSubmit={submitAdd} onQuickAdd={quickAdd} photo={{ ...photo, quota: vm.aiQuota }} onPickPhoto={pickPhoto} />
      )}

      {settingsOpen && (
        <Settings goal={goal} email={data.email} onBack={() => setSettingsOpen(false)}
          onDec={() => data.setGoal(Math.max(80, goal - 5))} onInc={() => data.setGoal(Math.min(260, goal + 5))} onSignOut={data.signOut} />
      )}

      {editFood && <FoodEditor food={editFood} onSave={async (v) => { await data.saveFood(v); setEditFood(null); }} onDelete={async (id) => { await data.deleteFood(id); setEditFood(null); }} onClose={() => setEditFood(null)} />}
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
