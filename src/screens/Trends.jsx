import { Flame } from "../lib/icons.jsx";

export default function Trends({ goal, streak, avg, bars, goalY, calAvg, heading, range, onRange }) {
  return (
    <div className="trends-neon">
      <div className="trend-range" role="group" aria-label="טווח המגמה">
        <button type="button" aria-pressed={range === "week"} onClick={() => onRange("week")}>שבוע</button>
        <button type="button" aria-pressed={range === "month"} onClick={() => onRange("month")}>חודש</button>
      </div>

      <section className="trend-chart" aria-label={`${heading}. ממוצע שבועי ${avg} גרם חלבון ליום`}>
        <div className="trend-chart-head">
          <div><span>ממוצע שבועי</span><strong>{avg}<small> גרם</small></strong></div>
          <div><span>{heading}</span><small>יעד יומי: {goal} גרם</small></div>
        </div>
        <div className="trend-bars">
          <div className="trend-goal" style={{ bottom: goalY }}><span>יעד {goal}</span></div>
          {bars.map((bar, index) => (
            <div key={index} className="trend-bar" aria-label={`${bar.label}: ${bar.value} גרם`}>
              <strong>{bar.value}</strong>
              <div style={{ height: bar.h, background: bar.color, boxShadow: bar.glow }} />
              <span style={{ color: bar.labelColor }}>{bar.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="trend-summary-grid">
        <section className="trend-stat trend-stat-hot">
          <span className="trend-stat-icon protein"><Flame size={20} /></span>
          <div><span>רצף</span><strong>{streak}</strong><small>ימים ביעד</small></div>
        </section>
        <section className="trend-stat">
          <span className="trend-stat-icon calories"><Flame size={20} /></span>
          <div><span>קלוריות</span><strong>{calAvg}</strong><small>ממוצע שבועי</small></div>
        </section>
      </div>
    </div>
  );
}
