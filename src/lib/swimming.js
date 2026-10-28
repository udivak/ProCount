export const SWIM_STROKES = { freestyle: "חתירה", breaststroke: "חזה", backstroke: "גב", butterfly: "פרפר", mixed: "מעורב" };

export function parseSwim(draft) {
  const minutes = Number(draft.minutes || 0), seconds = Number(draft.seconds || 0);
  const duration_seconds = minutes * 60 + seconds;
  if (!Number.isInteger(minutes) || minutes < 0 || !Number.isInteger(seconds) || seconds < 0 || seconds > 59
    || duration_seconds <= 0 || duration_seconds > 86400 || !["manual", "lengths"].includes(draft.distanceMode)
    || (draft.stroke && !Object.hasOwn(SWIM_STROKES, draft.stroke))) return null;
  let distance_m = null, pool_length_m = null, length_count = null;
  if (draft.distanceMode === "lengths") {
    pool_length_m = Number(draft.poolLength);
    length_count = Number(draft.lengths);
    if (!Number.isFinite(pool_length_m) || pool_length_m <= 0 || pool_length_m > 200 || !Number.isInteger(length_count) || length_count <= 0) return null;
    distance_m = Math.round(pool_length_m * length_count * 100) / 100;
  } else if (String(draft.distance ?? "").trim()) distance_m = Number(draft.distance);
  if (distance_m !== null && (!Number.isFinite(distance_m) || distance_m <= 0 || distance_m > 100000)) return null;
  return { duration_seconds, distance_m, pool_length_m, length_count, stroke: draft.stroke || null };
}

export function swimPace(details) {
  if (!(details?.distance_m > 0) || !(details?.duration_seconds > 0)) return null;
  const seconds = Math.round(details.duration_seconds * 100 / details.distance_m);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function swimLabel(details) {
  if (!details) return "שחייה";
  const duration = `${Math.floor(details.duration_seconds / 60)}:${String(details.duration_seconds % 60).padStart(2, "0")}`;
  return `${details.distance_m == null ? "מרחק לא תועד" : `${Number(details.distance_m).toLocaleString("he-IL")} מ׳`} · ${duration} דק׳`;
}

export function swimSummary(sessions) {
  return sessions.filter((s) => s.kind === "swimming" && s.status === "completed").reduce((summary, s) => ({
    count: summary.count + 1,
    duration_seconds: summary.duration_seconds + Number(s.swim?.duration_seconds || 0),
    distance_m: summary.distance_m + Number(s.swim?.distance_m || 0),
    withDistance: summary.withDistance + (s.swim?.distance_m > 0 ? 1 : 0),
  }), { count: 0, duration_seconds: 0, distance_m: 0, withDistance: 0 });
}
