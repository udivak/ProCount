import { Utensils } from "../lib/icons.jsx";
import { CALORIE_GOAL } from "../lib/nutrition.js";

const meals = [
  {
    time: "בוקר",
    note: "ארוחה קלה עד הצהריים",
    main: "מעדן או יוגורט חלבון אחד (כ־200 ג׳ / גביע אחד)",
    protein: "20–25 ג׳ חלבון",
    alternatives: [],
  },
  {
    time: "צהריים",
    note: "מטרה: הארוחה המרכזית והמשביעה של היום",
    main: "180–200 ג׳ עוף / הודו / דג / בשר רזה + 200 ג׳ אורז או בורגול מבושל (כ־10 כפות גדושות), או 250 ג׳ תפוחי אדמה מבושלים או אפויים (תפוח אדמה בינוני ועוד קטן) + סלט גדול, כ־250 ג׳ (קערה גדולה) + 15 ג׳ טחינה (כף אחת)",
    protein: "45–55 ג׳ חלבון",
    alternatives: [
      "קערה: קופסת טונה מסוננת (כ־120 ג׳) + 200 ג׳ אורז מבושל (כ־10 כפות גדושות) + 250 ג׳ ירקות (קערה גדולה) + 15 ג׳ טחינה (כף)",
      "מוקפץ: 180 ג׳ חזה עוף + 250 ג׳ ירקות (קערה גדולה) + 180 ג׳ אטריות אורז מבושלות (קערה בינונית)",
      "כריך: 120 ג׳ חזה עוף או רוסטביף + 3 פרוסות לחם מלא (כ־90 ג׳) + סלט גדול בצד (כ־250 ג׳)",
    ],
  },
  {
    time: "לפני אימון",
    note: "בדרך לאימון, כשצריך חיזוק חלבון",
    main: "חטיף חלבון אחד",
    protein: "15–25 ג׳ חלבון",
    alternatives: [],
  },
  {
    time: "ערב / אחרי אימון",
    note: "מטרה: להשלים חלבון ולסיים שבע, בלי לוותר על פחמימה",
    main: "חביתה מ־3 ביצים + 150 ג׳ קוטג׳, או קופסת טונה מסוננת, או 150 ג׳ חזה עוף + סלט גדול (כ־250 ג׳) + 2 פרוסות לחם מלא (כ־60 ג׳) או פיתה קטנה אחת (כ־80 ג׳)",
    protein: "45–55 ג׳ חלבון",
    alternatives: [
      "קופסת סרדינים או טונה מסוננת (כ־120 ג׳) + 300 ג׳ תפוחי אדמה מבושלים או אפויים (2 קטנים או אחד בינוני וקטן) + סלט גדול (כ־250 ג׳)",
      "סלט גדול: 150 ג׳ עוף או טונה + ירקות בכמות של כ־300 ג׳ (קערה גדולה מאוד) + 3 פרוסות לחם מלא (כ־90 ג׳) + 15 ג׳ טחינה (כף)",
      "כשאין זמן לבשל: יוגורט חלבון אחד + פרי בינוני אחד + 40 ג׳ שיבולת שועל (כ־4 כפות גדושות)",
    ],
  },
];

const targets = [
  ["קלוריות", CALORIE_GOAL.toLocaleString("he-IL")],
  ["חלבון", "160 ג׳"],
  ["שומן", "65–70 ג׳"],
  ["פחמימות", "240–255 ג׳"],
];

export default function MealPlan() {
  return (
    <div>
      <section style={{ background: "linear-gradient(150deg,#16251e,#121214)", border: "1px solid #244331", borderRadius: 24, padding: "20px 18px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 150, height: 150, top: -80, left: -45, background: "radial-gradient(circle,rgba(52,211,153,.18),transparent 70%)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(52,211,153,.14)", color: "#34d399" }}><Utensils size={19} /></span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>תפריט החיטוב שלך</div>
            <div style={{ fontSize: 12, color: "#8a8a93", marginTop: 1 }}>נקודת פתיחה ליום עם אימון או בלעדיו</div>
          </div>
        </div>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
          {targets.map(([label, value]) => (
            <div key={label} style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(10,10,12,.48)", border: "1px solid rgba(82,126,99,.3)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8a93" }}>{label}</div>
              <div style={{ marginTop: 2, fontSize: 17, fontWeight: 800, color: label === "חלבון" ? "#6ee7b7" : "#f4f4f5" }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ fontSize: 16, fontWeight: 800, margin: "0 4px 12px" }}>הארוחות שלך</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {meals.map((meal, index) => <MealCard key={meal.time} meal={meal} index={index} />)}
      </div>

      <section style={{ marginTop: 20, marginBottom: 34, background: "#161619", border: "1px solid #232328", borderRadius: 20, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>כללי היום</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.45, color: "#b4b4bc" }}>
          <div><strong style={{ color: "#34d399" }}>תנועה:</strong> כוון ל־8,000 צעדים ביום בממוצע.</div>
          <div><strong style={{ color: "#34d399" }}>מעקב:</strong> שקילה ב־3–4 בקרים בשבוע; בוחנים ממוצע שבועי בלבד.</div>
          <div><strong style={{ color: "#34d399" }}>שינה:</strong> התקדמות הדרגתית מ־6 לכיוון 7 שעות בלילה.</div>
        </div>
      </section>
    </div>
  );
}

function MealCard({ meal, index }) {
  return (
    <section style={{ background: "#161619", border: "1px solid #232328", borderRadius: 20, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(52,211,153,.12)", color: "#34d399", fontSize: 13, fontWeight: 800 }}>{index + 1}</span>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{meal.time}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6ee7b7", whiteSpace: "nowrap" }}>{meal.protein}</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.4, color: "#8a8a93", margin: "9px 0 13px" }}>{meal.note}</div>
      <div style={{ borderRight: "3px solid #34d399", paddingRight: 10, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>{meal.main}</div>
      {meal.alternatives.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #28282d" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6f6f78", marginBottom: 7 }}>חלופות אפשריות</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {meal.alternatives.map((alternative) => <div key={alternative} style={{ fontSize: 13, color: "#c4c4c9", lineHeight: 1.4 }}>• {alternative}</div>)}
          </div>
        </div>
      )}
    </section>
  );
}
