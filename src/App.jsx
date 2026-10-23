import { useEffect, useMemo, useRef, useState } from "react";
import { useData, useWorkouts, RANGE_DAYS } from "./store.js";
import { headerDate, lastNDates, lastNWeeks, weekdayLabel, weekRangeLabel, shiftDate, dayLabel, greeting } from "./lib/date.js";
import { CALORIE_GOAL, calorieBalance, dailyTotals, dailyWaterTotal, remainingProtein, pct, dailyPace, streak, proteinByDay, weekSeries, weeklyAverageSeries, avgCaloriesPerActiveDay, average, entriesByMeal, proteinSuggestion } from "./lib/nutrition.js";
import { acquireRequestLock, captureFoodEstimateRequest, capturePhotoRequest, captureRequestRevision, clearRequestLock, releaseRequestLock } from "./lib/request.js";
import { withSubmissionLock } from "./lib/submission.js";
import { foodUndoTarget } from "./lib/delete.js";
import { defaultMealType, isLearnedSnack, learnedSnackFoods, resolveAddedMeal } from "./lib/meal.js";
import { Gear, Home, Chart, ListIcon, Plus, Utensils, Dumbbell } from "./lib/icons.jsx";
import Today from "./screens/Today.jsx";
import Trends from "./screens/Trends.jsx";
import MyFoods from "./screens/MyFoods.jsx";
import NutritionChat from "./screens/NutritionChat.jsx";
import { todayLocal } from "./lib/date.js";
import { prepareChatRows, validateChatItems, isChatRequestCurrent } from "./lib/chat.js";
import AddSheet from "./screens/AddSheet.jsx";
import Settings from "./screens/Settings.jsx";
import MealPlan from "./screens/MealPlan.jsx";
import Workouts from "./screens/Workouts.jsx";
import FoodEditor from "./FoodEditor.jsx";
import ItemDetailModal from "./ItemDetailModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

const SCALE = 200, CHART_H = 210;
const SOURCE = {
  saved: { tag: "מהיר", iconBg: "rgba(52,211,153,.12)", iconColor: "#39e6b2", sub: "מהיר" },
  manual: { tag: "ידני", iconBg: "rgba(96,165,250,.12)", iconColor: "#60a5fa", sub: "הזנה ידנית" },
  ai: { tag: "AI", iconBg: "rgba(167,139,250,.14)", iconColor: "#a78bfa", sub: "הערכת AI" },
};
const round = (n) => Math.round(Number(n) || 0);
const blankForm = () => ({ name: "", protein: "", calories: "", grams: "", quantity: "1", unit: "מנה", save: false, entryId: crypto.randomUUID(), foodId: crypto.randomUUID(), entrySaved: false });
const isNonNegative = (value) => String(value ?? "").trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

const newChatState = (selectedDate) => {
  const today=todayLocal();
  return {today,oldest:shiftDate(today,-34),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,selectedDate,messages:[],items:[],images:[],compose:'',status:'idle',needsClarification:true,contextRows:[],contextFrom:shiftDate(today,-34),contextTo:today,dirtyKeys:[],attempt:null,error:'',errorText:'',notice:'',contextReview:null};
};
const chatError = code => ({daily_limit:'הגעת למכסה של 30 בקשות AI ליום. אפשר להוסיף ידנית.',context_changed:'הרישומים ביום הזה השתנו — בדוק את ההצעה שוב. לפני ניסיון נוסף בדוק את המצב העדכני למעלה.',context_unavailable:'לא ניתן לקרוא את הרישומים. השמירה נעצרה; נסה שוב לאחר חידוש החיבור.',context_too_large:'חלון ההקשר גדול מדי. בחר טווח תאריכים מצומצם ושלח שוב.',body_too_large:'הבקשה גדולה מדי. הסר תמונה או פתח שיחה חדשה לאחר טיפול בטיוטה.',invalid_chat_context:'הקשר השיחה אינו תקין. בדוק תאריכים, רענן את הקשר התאריך ושלח שוב.',ai_refused:'לא התקבלה הערכה. נסה תיאור אחר או הוסף ידנית.',ai_unparseable:'התשובה לא הושלמה או אינה תקינה. הטיוטה נשמרה; אפשר לשלוח שוב.'}[code] || 'הפעולה לא הושלמה. בדוק את החיבור ונסה שוב. הטיוטה נשמרה.');

export default function App({ session }) {
  const data = useData(session);
  const { entries, foods, goal, waterGoal, today } = data;

  const [screen, setScreen] = useState("today");
  const workouts = useWorkouts(session, screen === "workouts");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState("quick");
  const [isGeneralFood, setIsGeneralFood] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [photo, setPhoto] = useState({ state: "idle", note: "", error: null });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoGuidance, setPhotoGuidance] = useState("");
  const [manualEstimate, setManualEstimate] = useState(null);
  const [editFood, setEditFood] = useState(null); // null | {} (new) | foodRow (edit)
  const [selectedEntry, setSelectedEntry] = useState(null); // null | a todayEntries vm item (detail modal)
  const [detailBusy, setDetailBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // null | { title, body, confirmLabel, onConfirm } — delete guard
  const [chartRange, setChartRange] = useState("week"); // "week" | "month" — Trends bar chart range
  const [selectedDay, setSelectedDay] = useState(today); // which day the Today screen shows
  const [addDate, setAddDate] = useState(today); // which day the add sheet logs onto
  const [mealType, setMealType] = useState("snack");
  const [waterUndo, setWaterUndo] = useState(null);
  const [foodUndo, setFoodUndo] = useState(null);
  const [waterError, setWaterError] = useState("");
  const [addError, setAddError] = useState("");
  const [addNotice, setAddNotice] = useState("");
  const waterUndoTimer = useRef(null);
  const waterUndoRevision = useRef(0);
  const waterUndoLock = useRef(false);
  const waterAddLock = useRef(false);
  const [waterAdding, setWaterAdding] = useState(null);
  const foodUndoTimer = useRef(null);
  const foodUndoRef = useRef(null);
  const foodUndoPendingTimer = useRef(false);
  const addSaveLock = useRef(false);
  const photoRequestRevision = useRef(0);
  const photoAnalysisLock = useRef(null);
  const manualEstimateRevision = useRef(0);
  const manualEstimateLock = useRef(null);
  const detailOperationLock = useRef(false);
  const addReturnFocus = useRef(null);
  const appScrollRef = useRef(null);
  const [addSaving, setAddSaving] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState(() => newChatState(selectedDay));
  const chatRef = useRef(chat); chatRef.current = chat;
  const chatReturnFocus = useRef(null);
  useEffect(() => { if (!chatOpen && chatReturnFocus.current) { chatReturnFocus.current.focus?.(); chatReturnFocus.current=null; } }, [chatOpen]);
  const chatRevision = useRef(0), chatAbort = useRef(null), chatSaveLock = useRef(false), chatImageLock = useRef(false);
  useEffect(() => () => { chatRevision.current++; chatAbort.current?.abort(); }, []);
  const invalidateChat = () => { chatRevision.current++; chatAbort.current?.abort(); chatAbort.current=null; };
  const changeChat = (patch) => {
    if (chatSaveLock.current || chatRef.current.attempt) return;
    invalidateChat();
    setChat(c => ({...c, status:c.needsClarification?'clarifying':'draft', error:'', ...patch}));
  };
  const closeChatRef = useRef(null);
  closeChatRef.current = () => {
    invalidateChat(); setChatOpen(false);
    setChat(c => c.status==='analyzing' || c.status==='preparing' ? {...c,status:c.needsClarification?'clarifying':'draft'} : c);
  };
  const closeChat = useMemo(() => () => closeChatRef.current(), []);
  const openChat = () => {
    chatReturnFocus.current=addReturnFocus.current;
    addReturnFocus.current=null;
    discardAdd();
    if (!chat.messages.length && !chat.items.length && !chat.compose && !chat.images.length && !chat.attempt) setChat(newChatState(addDate));
    setChatOpen(true);
  };
  const newChat = () => {
    if (chatSaveLock.current || chatRef.current.attempt) return;
    const reset = () => { invalidateChat(); setChat(newChatState(selectedDay)); };
    if (chatRef.current.items.length || chatRef.current.compose || chatRef.current.images.length) setConfirm({title:'השלכת הטיוטה?',body:'ההצעות שטרם נשמרו והשיחה יימחקו.',confirmLabel:'שיחה חדשה',onConfirm:reset});
    else reset();
  };
  const pickChatImage = async file => {
    if (chatSaveLock.current || chatRef.current.attempt || chatImageLock.current) return;
    const c=chatRef.current;
    if (c.images.length + c.messages.reduce((n,m)=>n+(m.images?.length||0),0)>=4) {setChat(s=>({...s,error:'images',errorText:'אפשר לצרף עד ארבע תמונות בשיחה. לאחר טיפול בטיוטה פתח שיחה חדשה.'}));return;}
    invalidateChat(); const current=captureRequestRevision(chatRevision);
    chatImageLock.current=true; setChat(s=>({...s,status:'preparing',error:''}));
    try {
      const image=await data.compressChatImage(file);
      if(current())setChat(s=>({...s,images:[...s.images,image],status:s.needsClarification?'clarifying':'draft'}));
    }catch{if(current())setChat(s=>({...s,error:'image',errorText:'לא ניתן לקרוא את התמונה.',status:'draft'}));}
    finally{chatImageLock.current=false;}
  };
  const sendChat = async () => {
    const c=chatRef.current;
    if(chatSaveLock.current || chatAbort.current || c.attempt || ['analyzing','preparing'].includes(c.status) || (!c.compose.trim()&&!c.images.length))return;
    if(c.today!==todayLocal()){setChat(s=>({...s,error:'date',errorText:'היום התחלף. רענן את הקשר התאריך ובדוק את התאריכים לפני שליחה.',needsClarification:true}));return;}
    const messages=[...c.messages,{role:'user',text:c.compose,images:c.images}];
    if(messages.length>20 || messages.reduce((n,m)=>n+m.text.length,0)>20000){setChat(s=>({...s,error:'full',errorText:'השיחה מלאה. טפל בטיוטה ופתח שיחה חדשה.'}));return;}
    const current=captureRequestRevision(chatRevision); const controller=new AbortController();chatAbort.current=controller;
    setChat(s=>({...s,status:'analyzing',error:'',notice:''}));
    try {
      const result=await data.sendNutritionChat({today:c.today,timezone:c.timezone,selectedDate:c.selectedDate,messages,items:c.items,contextFrom:c.contextFrom,contextTo:c.contextTo},controller.signal);
      if(!isChatRequestCurrent(current,c.today,todayLocal())){
        if(current())setChat(s=>({...s,status:'clarifying',needsClarification:true,error:'date',errorText:'היום התחלף במהלך הניתוח. רענן את הקשר התאריך ושלח שוב.'}));
        return;
      }
      if(result.error)throw Error(result.error);
      const r=result.data;
      if(!validateChatItems(r.items,{oldest:c.oldest,today:c.today}) || typeof r.needsClarification!=='boolean' || typeof r.message!=='string' || !Array.isArray(r.contextRows))throw Error('ai_unparseable');
      setChat(s=>({...s,messages:[...messages,{role:'assistant',text:r.message}],items:r.items,needsClarification:r.needsClarification,contextRows:r.contextRows,contextFrom:r.contextFrom,contextTo:r.contextTo,status:r.needsClarification?'clarifying':'draft',compose:'',images:[],dirtyKeys:[],contextReview:null}));
    }catch(error){if(current())setChat(s=>({...s,status:s.needsClarification?'clarifying':'draft',error:error.message,errorText:chatError(error.message)}));}
    finally{if(chatAbort.current===controller)chatAbort.current=null;}
  };
  const editChatItem = (key,field,value) => {
    const c=chatRef.current;
    changeChat({items:c.items.map(i=>i.draftKey===key?{...i,[field]:value}:i),dirtyKeys:['name','quantityText','grams'].includes(field)?[...new Set([...c.dirtyKeys,key])]:c.dirtyKeys});
  };
  const finishChatSave = (c,attempt,result,editing=false) => {
    const savedIds=new Set([...attempt.savedIds,...result.saved.map(r=>r.id)]);
    const savedKeys=attempt.rows.flatMap((r,i)=>savedIds.has(r.id)?[attempt.keys[i]]:[]);
    const pending=attempt.rows.filter(r=>!savedIds.has(r.id));
    const complete=!pending.length;
    const notice=`נשמרו ${savedIds.size} מתוך ${attempt.rows.length}`;
    const remaining=c.items.filter(i=>!savedKeys.includes(i.draftKey));
    const canEdit=editing && !result.uncertain.length;
    const saveReport={role:'assistant',text:`תוצאת שמירה מאומתת מהאפליקציה: ${notice}. נשמרו: ${attempt.rows.filter(r=>savedIds.has(r.id)).map(r=>r.eaten_on+' '+r.name).join('; ')}. השורות שנשמרו אינן חלק מהטיוטה. לפני הצעה נוספת יש להשתמש ברישומים העדכניים מהשרת.`};
    setChat(s=>({...s,items:remaining,attempt:complete || canEdit?null:{...attempt,savedIds:[...savedIds],savedKeys},status:complete?'saved':canEdit?'draft':'partial',notice,error:result.uncertain.length?'uncertain':'',errorText:result.uncertain.length?'תוצאת חלק מהרישומים אינה ידועה. בדיקה או ניסיון חוזר ישתמשו באותם מזהים.':'',needsClarification:complete?true:c.needsClarification,messages:complete || canEdit?[...c.messages,saveReport]:c.messages,dirtyKeys:[],contextReview:null}));
  };
  const approveChat = (retry=false) => withSubmissionLock(chatSaveLock, async () => {
    const c=chatRef.current;
    if(!retry && (c.needsClarification || c.attempt || !c.items.length || ['analyzing','preparing'].includes(c.status)))return;
    if(c.today!==todayLocal()){setChat(s=>({...s,error:'date',errorText:'היום התחלף. בדוק מה נשמר ביומן, רענן את הקשר התאריך ובדוק את התאריכים.',needsClarification:true}));return;}
    let attempt=c.attempt;
    if(!attempt){
      try {attempt={rows:prepareChatRows(c.items,{oldest:c.oldest,today:c.today},()=>crypto.randomUUID()),keys:c.items.map(i=>i.draftKey),savedIds:[],savedKeys:[]};}
      catch{setChat(s=>({...s,error:'draft',errorText:'בדוק תאריכים וערכים: שם חובה, תזונה לא שלילית ומים/משקל חיוביים.'}));return;}
    }
    invalidateChat();setChat(s=>({...s,status:'saving',attempt,error:'',notice:''}));
    try{
      const dates=[...new Set(attempt.rows.map(r=>r.eaten_on))];
      if(!retry && dates.some(d=>d<c.contextFrom || d>c.contextTo)){
        const fresh=await data.readChatDays(dates);if(fresh.error)throw Error(fresh.error);
        setChat(s=>({...s,attempt:null,status:'draft',contextRows:[...c.contextRows.filter(r=>!dates.includes(r.eaten_on)),...fresh.data],contextFrom:dates.reduce((a,b)=>a<b?a:b,c.contextFrom),contextTo:dates.reduce((a,b)=>a>b?a:b,c.contextTo),contextReview:fresh.data,error:'review',errorText:'נטענו הרישומים לתאריך שנערך. בדוק אותם ואשר שוב.'}));return;
      }
      const result=await data.addChatEntries(attempt.rows.filter(r=>!attempt.savedIds.includes(r.id)),c.contextRows,attempt.rows);
      if(result.error){
        setChat(s=>({...s,status:'partial',attempt,contextRows:result.contextRows?[...c.contextRows.filter(r=>!dates.includes(r.eaten_on)),...result.contextRows]:c.contextRows,contextReview:result.contextRows||null,error:result.error,errorText:chatError(result.error)}));return;
      }
      finishChatSave(c,attempt,result);
    }catch(error){setChat(s=>({...s,status:'partial',attempt,error:'uncertain',errorText:chatError(error.message)}));}
  });
  const resolveChat = () => withSubmissionLock(chatSaveLock,async()=>{
    const c=chatRef.current;if(!c.attempt)return;
    setChat(s=>({...s,status:'saving',error:''}));
    try{const pending=c.attempt.rows.filter(r=>!c.attempt.savedIds.includes(r.id));const result=await data.inspectChatRows(pending);finishChatSave(c,c.attempt,result,true);}
    catch{setChat(s=>({...s,status:'partial',error:'uncertain',errorText:chatError('context_unavailable')}));}
  });

  useEffect(() => () => {
    clearTimeout(waterUndoTimer.current);
    clearTimeout(foodUndoTimer.current);
  }, []);

  useEffect(() => {
    if (!addOpen && addReturnFocus.current) {
      addReturnFocus.current.focus?.();
      addReturnFocus.current = null;
    }
  }, [addOpen]);

  useEffect(() => { if (appScrollRef.current) appScrollRef.current.scrollTop = 0; }, [screen]);

  // ponytail: nav clamped to the loaded window; fetch older entries on demand if you ever need >35 days back.
  const oldest = lastNDates(RANGE_DAYS)[0];
  const canPrev = selectedDay > oldest;       // YYYY-MM-DD string compare is chronological
  const canNext = selectedDay < today;
  const prevDay = () => { if (canPrev) setSelectedDay(shiftDate(selectedDay, -1)); };
  const nextDay = () => { if (canNext) setSelectedDay(shiftDate(selectedDay, 1)); };
  const learnedSnacks = useMemo(() => learnedSnackFoods(entries, today), [entries, today]);

  // ---- view model (mirrors the prototype's renderVals, from real data) ----
  const vm = useMemo(() => {
    const todays = entries.filter((e) => e.eaten_on === selectedDay);
    const t = dailyTotals(entries, selectedDay);
    const pctVal = pct(t.protein, goal);
    const calorieIntake = Math.round(t.calories);

    const todayEntries = todays.filter((e) => e.entry_kind !== "water").map((e) => {
      const s = SOURCE[e.source] || SOURCE.manual;
      return { ...e, id: e.id, name: e.name || "רישום ללא שם", sub: s.sub, tag: s.tag, iconBg: s.iconBg, iconColor: s.iconColor, protein: round(e.protein_g), calories: round(e.calories), grams: e.grams == null ? null : Number(e.grams), proteinRaw: Number(e.protein_g) || 0 };
    });

    const dates = lastNDates(7);
    const series = weekSeries(entries, dates);
    // Bar height/color share one formula across ranges so the daily goal line stays comparable.
    const bar = (protein, current, met, label) => ({
      label,
      value: round(protein),
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
      totals: { protein: round(t.protein), calories: calorieIntake.toLocaleString(), count: t.count, pctLabel: Math.round(pctVal * 100) + "%" },
      waterMl: dailyWaterTotal(entries, selectedDay),
      waterEntries: todays.filter((entry) => entry.entry_kind === "water"),
      remaining: round(remainingProtein(t.protein, goal)),
      proteinProgress: pctVal,
      calorieProgress: pct(t.calories, CALORIE_GOAL),
      calorieIntake,
      calorieBalance: calorieBalance(t.calories),
      pace: selectedDay === today ? dailyPace(t.protein, goal) : null,
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
      // Local estimate only; the server enforces the UTC daily analysis limit.
      aiQuota: 30,
    };
  }, [entries, foods, goal, today, selectedDay, chartRange]);

  const header = { today: { sub: headerDate(), title: "ProCount", greet: greeting(data.name || data.email.split("@")[0]) }, trends: { sub: "מעקב לאורך זמן", title: "מגמות" }, foods: { sub: "התבניות שלי", title: "מאכלים שלי" }, mealPlan: { sub: "התזונה שלך", title: "תפריט" }, workouts: { sub: "תכנית ומעקב", title: "אימונים" } }[screen];

  const clearFoodUndo = () => {
    clearTimeout(foodUndoTimer.current);
    foodUndoTimer.current = null;
    foodUndoRef.current = null;
    foodUndoPendingTimer.current = false;
    setFoodUndo(null);
  };
  const rememberFoodUndo = (target) => {
    if (!target) return;
    clearTimeout(foodUndoTimer.current);
    foodUndoTimer.current = null;
    foodUndoRef.current = target;
    foodUndoPendingTimer.current = true;
    setFoodUndo(target);
  };
  const armFoodUndoTimer = () => {
    const target = foodUndoRef.current;
    if (!target || !foodUndoPendingTimer.current) return;
    foodUndoPendingTimer.current = false;
    clearTimeout(foodUndoTimer.current);
    foodUndoTimer.current = setTimeout(() => {
      if (foodUndoRef.current?.id === target.id) {
        foodUndoRef.current = null;
        setFoodUndo(null);
      }
    }, 6000);
  };
  const startWaterUndoTimer = (revision) => {
    clearTimeout(waterUndoTimer.current);
    waterUndoTimer.current = setTimeout(() => {
      if (waterUndoRevision.current === revision) setWaterUndo(null);
    }, 6000);
  };
  const rememberWaterUndo = (undo) => {
    const revision = waterUndoRevision.current + 1;
    waterUndoRevision.current = revision;
    setWaterUndo(undo);
    startWaterUndoTimer(revision);
  };
  const runDetailOperation = (operation) => {
    if (detailOperationLock.current) return Promise.resolve({ data: null, error: new Error("busy") });
    return withSubmissionLock(detailOperationLock, async () => {
      setDetailBusy(true);
      try {
        return await operation();
      } catch (error) {
        return { data: null, error };
      } finally {
        setDetailBusy(false);
      }
    });
  };

  // ---- actions ----
  const invalidatePhotoRequest = () => {
    clearRequestLock(photoAnalysisLock);
    return captureRequestRevision(photoRequestRevision);
  };
  const invalidateManualEstimate = (clearLock = false) => {
    if (clearLock) clearRequestLock(manualEstimateLock);
    captureRequestRevision(manualEstimateRevision);
    setManualEstimate(null);
  };
  const openAdd = () => {
    if (addSaveLock.current) return;
    addReturnFocus.current = document.activeElement;
    invalidatePhotoRequest();
    invalidateManualEstimate(true);
    setForm(blankForm());
    setAddError("");
    setAddNotice("");
    setMealType(defaultMealType());
    setAddDate(selectedDay);
    setPhoto({ state: "idle", note: "", error: null });
    setPhotoFile(null);
    setPhotoGuidance("");
    setAddTab("quick");
    setIsGeneralFood(false);
    setAddOpen(true);
  };
  const openGeneralFood = () => { if (!form.entrySaved) { invalidateManualEstimate(); setAddError(""); setAddTab("manual"); setIsGeneralFood(true); } };
  const backFromGeneralFood = () => { if (!form.entrySaved) { invalidateManualEstimate(); setAddError(""); setAddTab("quick"); setIsGeneralFood(false); } };
  const onTab = (tab) => {
    if (form.entrySaved || tab === addTab) return;
    invalidatePhotoRequest();
    invalidateManualEstimate(true);
    setAddError("");
    setAddTab(tab);
    setIsGeneralFood(false);
    setPhoto({ state: "idle", note: "", error: null });
    setPhotoFile(null);
  };
  const onField = (key, value) => { if (!form.entrySaved) { invalidateManualEstimate(); setAddError(""); setForm((current) => ({ ...current, [key]: value })); } };
  const onToggleSave = () => { if (!form.entrySaved) { invalidateManualEstimate(); setAddError(""); setForm((current) => ({ ...current, save: !current.save })); } };
  const onDate = (date) => { if (!form.entrySaved) { invalidateManualEstimate(); setAddDate(date); } };
  const onMealType = (type) => { if (!form.entrySaved) { invalidateManualEstimate(); setMealType(type); } };

  const finishAdd = () => {
    invalidatePhotoRequest();
    invalidateManualEstimate(true);
    setForm(blankForm());
    setAddError("");
    setPhoto({ state: "idle", note: "", error: null });
    setPhotoFile(null);
    setPhotoGuidance("");
    setAddOpen(false);
    armFoodUndoTimer();
  };
  const discardAdd = () => { if (!addSaveLock.current) finishAdd(); };
  const runAddSave = (operation) => withSubmissionLock(addSaveLock, async () => {
    setAddSaving(true);
    try {
      return await operation();
    } finally {
      setAddSaving(false);
    }
  });
  const quickAdd = (foodRow, qty, entryId) => runAddSave(async () => {
    const food = foodRow.raw || foodRow;
    const result = await data.addQuick(food, qty, addDate, resolveAddedMeal(mealType, food, learnedSnacks), entryId);
    if (result.error) return setAddError("לא ניתן לשמור את הרישום כרגע. נסה שוב.");
    rememberFoodUndo(foodUndoTarget(result));
    setSelectedDay(addDate);
    finishAdd();
  });

  const submitAdd = () => {
    if (manualEstimateLock.current) return;
    if (isGeneralFood && (!(form.name || "").trim() || !isNonNegative(form.protein) || !isNonNegative(form.calories))) return;
    return runAddSave(async () => {
      const finalMealType = resolveAddedMeal(mealType, { name: form.name }, learnedSnacks);
      const submitted = { form, tab: addTab, isGeneralFood, date: addDate, mealType: finalMealType, photoGuidance };
      const result = addTab === "photo" ? await data.addAi(form, addDate, finalMealType) : await data.addManual(form, addDate, finalMealType);
      rememberFoodUndo(foodUndoTarget(result));
      const partial = !!result.food?.error && (!!result.entry?.data || form.entrySaved);
      if (partial) {
        setForm({ ...submitted.form, entrySaved: true });
        setAddTab(submitted.tab);
        setIsGeneralFood(submitted.isGeneralFood);
        setAddDate(submitted.date);
        setMealType(submitted.mealType);
        setPhotoGuidance(submitted.photoGuidance);
      }
      if (result.error) return setAddError(partial ? "הרישום נשמר, אך המאכל לא נשמר. נסה שוב." : "לא ניתן לשמור את הרישום כרגע. נסה שוב.");
      setAddNotice(result.food?.reused ? "הרישום נוסף. המאכל כבר קיים במאגר, ולכן לא נוצר מאכל נוסף." : "");
      setIsGeneralFood(false);
      setSelectedDay(addDate); // jump the view to the day we just logged onto
      finishAdd();
    });
  };

  const analyzeManualFood = async () => {
    if (form.entrySaved || addSaving) return;
    const foodName = form.name.trim();
    const unit = form.unit.trim();
    const quantity = Number(form.quantity);
    const totalGrams = form.grams.trim() === "" ? null : Number(form.grams);
    const valid = foodName.length > 0 &&
      unit.length > 0 &&
      Number.isFinite(quantity) && quantity > 0 &&
      (totalGrams == null || (Number.isFinite(totalGrams) && totalGrams > 0));
    if (!valid) return;

    const lockToken = acquireRequestLock(manualEstimateLock);
    if (!lockToken) return;
    const request = captureFoodEstimateRequest(manualEstimateRevision, foodName, unit, quantity, totalGrams);
    setManualEstimate({ state: "loading", note: "", error: "", unit: request.unit, confidence: "" });
    try {
      const result = await data.estimateFoodNutrition(request.foodName, request.unit, request.quantity, request.totalGrams);
      if (!request.isCurrent()) return;
      if (result?.estimate) {
        setForm((current) => ({
          ...current,
          protein: String(round(result.estimate.protein_g)),
          calories: String(round(result.estimate.calories)),
        }));
        setManualEstimate({
          state: "done",
          note: result.estimate.note || "",
          error: "",
          unit: request.unit,
          confidence: result.estimate.confidence || "",
        });
      } else {
        setManualEstimate({
          state: "error",
          note: "",
          error: result?.error === "daily_limit" ? "daily_limit" : "error",
          unit: request.unit,
          confidence: "",
        });
      }
    } catch {
      if (request.isCurrent()) setManualEstimate({ state: "error", note: "", error: "error", unit: request.unit, confidence: "" });
    } finally {
      releaseRequestLock(manualEstimateLock, lockToken);
    }
  };

  const pickPhoto = (file) => {
    if (!file || form.entrySaved) return;
    invalidatePhotoRequest();
    setPhotoFile(file);
    setPhoto({ state: "idle", note: "", error: null });
  };

  const changePhotoGuidance = (guidance) => {
    if (form.entrySaved || guidance === photoGuidance) return;
    invalidatePhotoRequest();
    setPhotoGuidance(guidance);
    setPhoto((current) => {
      if (current.state === "loading") return { state: "idle", note: "", error: null };
      if (current.state === "done") return { ...current, stale: true };
      return current;
    });
  };

  const backFromPhotoResult = () => {
    if (form.entrySaved) return;
    invalidatePhotoRequest();
    setAddError("");
    setPhoto({ state: "idle", note: "", error: null });
  };

  const analyzeSelectedPhoto = async () => {
    if (!photoFile || form.entrySaved) return;
    const lockToken = acquireRequestLock(photoAnalysisLock);
    if (!lockToken) return;
    const guidance = photoGuidance;
    const request = capturePhotoRequest(photoRequestRevision, photoFile, photoGuidance);
    setPhoto({ state: "loading", note: "", error: null });
    try {
      const r = await data.analyzePhoto(request.file, guidance);
      if (!request.isCurrent()) return;
      if (r?.estimate) {
        setForm((current) => ({ ...current, name: r.estimate.name || "", protein: String(round(r.estimate.protein_g)), calories: String(round(r.estimate.calories)), grams: "", quantity: "1", unit: "מנה", save: false }));
        setPhoto({ state: "done", note: r.estimate.note || "", confidence: r.estimate.confidence, error: null, stale: false });
      } else {
        // fall back to manual entry (design §6.5)
        const msg = r?.error === "daily_limit" ? "נגמרו הניתוחים להיום — עבור להזנה ידנית" : "הניתוח נכשל — נסה שוב או הזן ידנית";
        setPhoto({ state: "idle", note: "", error: msg });
      }
    } catch {
      if (request.isCurrent()) setPhoto({ state: "idle", note: "", error: "הניתוח נכשל — נסה שוב או הזן ידנית" });
    } finally {
      releaseRequestLock(photoAnalysisLock, lockToken);
    }
  };

  const addWater = (amount) => withSubmissionLock(waterAddLock, async () => {
    setWaterAdding(amount);
    try {
      const result = await data.addWater(amount, selectedDay);
      if (!result.data) throw new Error("water_save_failed");
      setWaterError("");
      rememberWaterUndo({ id: result.data.id, amount: result.data.water_ml, date: selectedDay });
    } catch {
      setWaterError("לא ניתן לשמור את המים כרגע. נסה שוב.");
    } finally {
      setWaterAdding(null);
    }
  });

  const undoWater = () => {
    const undo = waterUndo;
    if (!undo) return;
    return withSubmissionLock(waterUndoLock, async () => {
      const revision = waterUndoRevision.current + 1;
      waterUndoRevision.current = revision;
      clearTimeout(waterUndoTimer.current);
      setWaterUndo(null);
      try {
        const result = await data.deleteEntry(undo.id);
        if (result?.error) throw result.error;
        if (waterUndoRevision.current === revision) setWaterError("");
      } catch {
        if (waterUndoRevision.current === revision) {
          setWaterError("לא ניתן לבטל את הוספת המים כרגע. נסה שוב.");
          setWaterUndo(undo);
          startWaterUndoTimer(revision);
        }
      }
    });
  };

  const deleteFoodEntry = async (id, closeDetail = false) => {
    const remove = () => data.deleteEntry(id);
    const result = closeDetail ? await runDetailOperation(remove) : await remove().catch((error) => ({ data: null, error }));
    if (result?.error || !result?.data) return "לא ניתן למחוק את הרישום כרגע. נסה שוב.";
    if (foodUndoRef.current?.id === id) clearFoodUndo();
    if (waterUndo?.id === id) {
      clearTimeout(waterUndoTimer.current);
      waterUndoRevision.current += 1;
      setWaterUndo(null);
    }
    if (closeDetail) setSelectedEntry(null);
    return "";
  };
  const requestEntryDelete = (id, closeDetail = false) => {
    if (!id || (closeDetail && detailOperationLock.current)) return;
    setConfirm({
      title: "מחיקת רישום",
      body: "הרישום יימחק מהיום.",
      confirmLabel: "מחק",
      onConfirm: () => deleteFoodEntry(id, closeDetail),
    });
  };
  const moveSelectedEntry = async (id, mealType) => {
    const result = await runDetailOperation(() => data.updateEntryMeal(id, mealType));
    if (!result?.error && result?.data) setSelectedEntry(null);
    return result;
  };
  const openEntryDetail = (entry) => {
    if (detailOperationLock.current) return;
    setDetailBusy(false);
    setSelectedEntry(entry);
  };
  const closeEntryDetail = () => {
    if (!detailOperationLock.current) setSelectedEntry(null);
  };

  const goTo = (s) => { setScreen(s); setSettingsOpen(false); };

  return (
    <div className="app">
      <header style={{ flex: "none", minHeight: 74, padding: "calc(14px + env(safe-area-inset-top)) 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8a9994" }}>{header.sub}</div>
          <div style={{ fontSize: 25, lineHeight: 1.05, fontWeight: 900, letterSpacing: "-.025em" }}>{header.title}</div>
          {/* ponytail: greeting recomputes on render via new Date(); no live ticking — refreshes on next re-render, good enough. */}
          {header.greet && <div style={{ fontSize: 13, fontWeight: 700, color: "#8a9994" }}>{header.greet}</div>}
        </div>
        <button className="h-gear" aria-label="הגדרות" onClick={() => { data.loadConnectorPermissions(); setSettingsOpen(true); }} style={{ width: 44, height: 44, border: "1px solid #27302c", borderRadius: 14, background: "#111512", color: "#a8b2ae", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Gear size={20} />
        </button>
      </header>

      <div ref={appScrollRef} className="pc-scroll app-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {screen === "today" && <Today totals={vm.totals} goal={goal} progress={vm.proteinProgress} remaining={vm.remaining} pace={vm.pace} calorieProgress={vm.calorieProgress} calorieIntake={vm.calorieIntake} calorieGoal={CALORIE_GOAL} calorieBalance={vm.calorieBalance} waterMl={vm.waterMl} waterEntries={vm.waterEntries} waterLogKey={selectedDay} waterGoal={waterGoal} onAddWater={addWater} waterAdding={waterAdding} waterUndo={waterUndo?.date === selectedDay ? waterUndo : null} onUndoWater={undoWater} waterError={waterError} mealGroups={vm.mealGroups} suggestion={vm.suggestion} onAdd={openAdd} onDelete={requestEntryDelete} onSelect={openEntryDetail} dayLabel={dayLabel(selectedDay, today)} isToday={selectedDay === today} onToday={() => setSelectedDay(today)} onPrev={prevDay} onNext={nextDay} canPrev={canPrev} canNext={canNext} />}
        {screen === "trends" && <Trends goal={goal} streak={vm.streak} avg={vm.avg} bars={vm.bars} goalY={vm.goalY} calAvg={vm.calAvg} heading={vm.heading} range={chartRange} onRange={setChartRange} />}
        {screen === "foods" && <MyFoods foods={vm.foodVm} onNew={() => setEditFood({})} onEdit={(f) => setEditFood(f.raw)} />}
        {screen === "mealPlan" && <MealPlan />}
        {screen === "workouts" && <Workouts data={workouts} onConfirm={setConfirm} />}
      </div>

      {!addOpen && !settingsOpen && !editFood && !selectedEntry && !confirm && screen !== "mealPlan" && screen !== "today" && screen !== "workouts" && (
        <button disabled={addSaving} className="h-fab" onClick={openAdd} aria-label="הוסף מזון" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 30, minWidth: 136, height: 48, padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #74f0c8", fontFamily: "inherit", fontSize: 15, fontWeight: 900, background: "#39e6b2", color: "#03120d", borderRadius: 24, cursor: addSaving ? "not-allowed" : "pointer", opacity: addSaving ? .45 : 1, boxShadow: "0 8px 28px rgba(57,230,178,.28)" }}>
          <Plus size={20} sw={3} /> הוסף
        </button>
      )}

      <div className="bottom-nav">
        <NavBtn color={screen === "today" ? "#39e6b2" : "#6f6f78"} label="היום" onClick={() => goTo("today")}><Home size={24} /></NavBtn>
        <NavBtn color={screen === "mealPlan" ? "#39e6b2" : "#6f6f78"} label="תפריט" onClick={() => goTo("mealPlan")}><Utensils size={24} /></NavBtn>
        <NavBtn color={screen === "trends" ? "#39e6b2" : "#6f6f78"} label="מגמות" onClick={() => goTo("trends")}><Chart size={24} /></NavBtn>
        <NavBtn color={screen === "foods" ? "#39e6b2" : "#6f6f78"} label="מאכלים" onClick={() => goTo("foods")}><ListIcon size={24} /></NavBtn>
        <NavBtn color={screen === "workouts" ? "#39e6b2" : "#6f6f78"} label="אימונים" onClick={() => goTo("workouts")}><Dumbbell size={24} /></NavBtn>
      </div>

      {addOpen && (
        <AddSheet onOpenChat={openChat} tab={addTab} onTab={onTab} onClose={discardAdd} foods={vm.foodVm} form={form} isGeneralFood={isGeneralFood} onOpenGeneral={openGeneralFood} onBackGeneral={backFromGeneralFood} onBackPhoto={backFromPhotoResult} error={addError} saving={addSaving}
          onField={onField} onToggleSave={onToggleSave} locked={form.entrySaved} onBeginQuick={() => setAddError("")} isLearnedSnack={(food) => isLearnedSnack(food, learnedSnacks)}
          onSubmit={submitAdd} onQuickAdd={quickAdd} photo={{ ...photo, quota: vm.aiQuota }} photoFile={photoFile} onPickPhoto={pickPhoto} onAnalyzePhoto={analyzeSelectedPhoto} photoGuidance={photoGuidance} onPhotoGuidance={changePhotoGuidance}
          manualEstimate={manualEstimate} manualEstimatePending={!!manualEstimateLock.current} onEstimateManual={analyzeManualFood}
          date={addDate} onDate={onDate} minDate={oldest} maxDate={today} mealType={mealType} onMealType={onMealType} />
      )}

      {chatOpen && <NutritionChat chat={chat} onClose={closeChat} onNewChat={newChat} onSend={sendChat} onEditItem={editChatItem}
        onRemoveItem={key=>changeChat({items:chat.items.filter(i=>i.draftKey!==key)})} onApprove={()=>approveChat()} onRetry={()=>approveChat(true)} onResolve={resolveChat}
        onCompose={compose=>changeChat({compose})} onPickImage={pickChatImage} onRemoveImage={index=>changeChat({images:chat.images.filter((_,i)=>i!==index)})}
        onDate={selectedDate=>changeChat({selectedDate})} onContextRange={(key,value)=>changeChat({[key]:value,error:"context_too_large",errorText:chatError("context_too_large")})}
        onRefreshContext={()=>{const fresh=todayLocal();changeChat({today:fresh,oldest:shiftDate(fresh,-34),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,contextFrom:shiftDate(fresh,-34),contextTo:fresh,needsClarification:true,notice:'הקשר התאריך רוענן. בדוק את תאריכי הטיוטה ושלח הודעה לעדכון ההצעה.'});}} />}

      {settingsOpen && (
        <Settings connectorPermissions={data.connectorPermissions} onConnectorPermission={data.saveConnectorPermission} goal={goal} waterGoal={waterGoal} name={data.name} email={data.email} onName={data.setName} onBack={() => setSettingsOpen(false)}
          onDec={() => data.setGoal(Math.max(80, goal - 5))} onInc={() => data.setGoal(Math.min(260, goal + 5))}
          onWaterDec={() => data.setWaterGoal(Math.max(250, waterGoal - 250))} onWaterInc={() => data.setWaterGoal(Math.min(10000, waterGoal + 250))} onSignOut={data.signOut} />
      )}

      {(addNotice || foodUndo) && !addOpen && <div role="status" style={{ position: "absolute", insetInline: 20, bottom: "calc(var(--bottom-nav-height) + 18px)", zIndex: 25, border: "1px solid #1f3831", borderRadius: 14, background: "#101918", color: "#9ef2d2", padding: "10px 14px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span>{addNotice || "הרישום נוסף."}</span>
        {foodUndo && <button onClick={() => requestEntryDelete(foodUndo.id)} style={{ border: "none", borderRadius: 9, background: "#39e6b2", color: "#03120d", fontFamily: "inherit", fontSize: 13, fontWeight: 800, padding: "7px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>בטל הוספה</button>}
      </div>}

      {editFood && <FoodEditor food={editFood} onSave={async (v) => { const result = await data.saveFood(v); if (!result.error && !result.reused) setEditFood(null); return result; }} onEstimateNutrition={data.estimateFoodNutrition} onDelete={(id) => setConfirm({ title: "מחיקת מאכל", body: "המאכל יימחק מהרשימה שלך.", confirmLabel: "מחק", onConfirm: async () => { await data.deleteFood(id); setEditFood(null); } })} onClose={() => setEditFood(null)} />}

      {selectedEntry && <ItemDetailModal entry={selectedEntry} busy={detailBusy} onClose={closeEntryDetail} onDelete={(id) => requestEntryDelete(id, true)} onMove={moveSelectedEntry} />}

      {confirm && <ConfirmDialog title={confirm.title} body={confirm.body} confirmLabel={confirm.confirmLabel}
        onConfirm={async () => {
          const error = await confirm.onConfirm();
          if (error) return error;
          setConfirm(null);
          return "";
        }}
        onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function NavBtn({ color, label, onClick, children }) {
  return (
    <button onClick={onClick} aria-current={color === "#39e6b2" ? "page" : undefined} style={{ minHeight: 44, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color }}>
      {children}
      <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
    </button>
  );
}
