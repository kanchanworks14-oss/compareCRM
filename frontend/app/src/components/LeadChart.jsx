// app/src/components/LeadChart.jsx — daily new leads per category (CSS bars).
import { dateLabel } from "../lib/format.js";

const BARS = [
  ["customer", "customer-bar", "Customer"],
  ["developer", "developer-bar", "Developer"],
  ["agent", "agent-bar", "Agent"],
  ["owner", "owner-bar", "Owner"],
];

export default function LeadChart({ rows, days }) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toLocaleDateString("en-CA")); // YYYY-MM-DD
  }
  const byDay = Object.fromEntries(keys.map((k) => [k, Object.fromEntries(BARS.map(([type]) => [type, 0]))]));
  for (const r of rows) {
    if (!byDay[r.day] || !(r.type in byDay[r.day])) continue; // unknown types would make the scale NaN
    byDay[r.day][r.type] += r.count;
  }
  const max = Math.max(4, ...keys.flatMap((k) => Object.values(byDay[k])));
  const top = Math.ceil(max / 4) * 4;
  const labelEvery = days <= 7 ? 1 : days <= 14 ? 2 : 5;

  return (
    <div className="chart-area">
      <div className="y-labels">{[4, 3, 2, 1, 0].map((i) => <span key={i}>{(top * i) / 4}</span>)}</div>
      <div className="chart-main">
        <div className="grid-lines"><i></i><i></i><i></i><i></i><i></i></div>
        <div className="chart-bars">
          {keys.map((k, i) => {
            const d = new Date(`${k}T00:00:00`);
            const label = days <= 7 ? d.toLocaleDateString("en-IN", { weekday: "short" }) : `${d.getDate()}/${d.getMonth() + 1}`;
            return (
              <div key={k} className="chart-group">
                {BARS.map(([type, cls, name]) => (
                  <i key={type} className={`bar ${cls}`} style={{ height: `${(100 * byDay[k][type]) / top}%` }} title={`${name}: ${byDay[k][type]} on ${dateLabel(k)}`} />
                ))}
                <small>{(keys.length - 1 - i) % labelEvery === 0 ? label : ""}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
