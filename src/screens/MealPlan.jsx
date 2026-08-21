import { Utensils } from "../lib/icons.jsx";

const meals = [
  {
    time: "בוקר",
    note: "מטרה: 30–35 ג׳ חלבון ושובע טוב לתחילת היום",
    main: "מעדן חלבון + 60 ג׳ שיבולת שועל + פרי + 10 ג׳ אגוזים",
    protein: "30–35 ג׳ חלבון",
    alternatives: [
      "סקיר או יוגורט עשיר בחלבון + גרנולה + פרי",
      "2 ביצים + קוטג׳ + 2 פרוסות לחם מלא + ירקות",
    ],
  },
  {
    time: "צהריים",
    note: "מטרה: הארוחה המרכזית והמשביעה של היום",
    main: "180–200 ג׳ עוף / הודו / דג / בשר רזה + אורז, בורגול או תפוחי אדמה + סלט גדול + כף טחינה",
    protein: "45–55 ג׳ חלבון",
    alternatives: [
      "קערה: טונה, אורז, ירקות וטחינה",
      "מוקפץ חזה עוף עם ירקות ואטריות אורז",
      "כריך חזה עוף או רוסטביף בלחם מלא, לצד סלט",
    ],
  },
  {
    time: "לפני אימון",
    note: "60–120 דקות לפני אימון ערב — קל לעיכול, עם פחמימה",
    main: "בננה + סקיר או יוגורט חלבון",
    protein: "15–25 ג׳ חלבון",
    alternatives: [
      "כריך מלחם מלא עם קוטג׳",
      "שייק חלבון + פרי",
    ],
  },
  {
    time: "ערב / אחרי אימון",
    note: "מטרה: להשלים חלבון ולסיים שבע, בלי לוותר על פחמימה",
    main: "חביתה מ־3 ביצים + קוטג׳, טונה או חזה עוף + סלט + 2 פרוסות לחם מלא או פיתה",
    protein: "45–55 ג׳ חלבון",
    alternatives: [
      "סרדינים או טונה + תפוחי אדמה + סלט",
      "סלט גדול עם עוף / טונה, לחם מלא וטחינה",
      "יוגורט עשיר בחלבון, פרי ושיבולת שועל כשאין זמן לבשל",
    ],
  },
];

const targets = [
  ["קלוריות", "2,250"],
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
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #28282d" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6f6f78", marginBottom: 7 }}>חלופות אפשריות</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {meal.alternatives.map((alternative) => <div key={alternative} style={{ fontSize: 13, color: "#c4c4c9", lineHeight: 1.4 }}>• {alternative}</div>)}
        </div>
      </div>
    </section>
  );
}
