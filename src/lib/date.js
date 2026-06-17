// Local calendar date as YYYY-MM-DD — built from local Y/M/D, not UTC, so the
// "today" boundary follows the device timezone (design §4).
export function todayLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "יום רביעי, 18 ביוני"
export function headerDate(d = new Date()) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

// Last n local dates (YYYY-MM-DD), oldest first, ending today.
export function lastNDates(n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from);
    d.setDate(from.getDate() - i);
    out.push(todayLocal(d));
  }
  return out;
}

// Hebrew single-letter weekday for a YYYY-MM-DD; "היום" when it's today.
export function weekdayLabel(dateStr, todayStr = todayLocal()) {
  if (dateStr === todayStr) return "היום";
  const letters = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]; // Sun..Sat
  return letters[new Date(dateStr + "T00:00:00").getDay()];
}
