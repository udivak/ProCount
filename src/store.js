import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, FUNCTIONS_URL } from "./lib/supabase.js";
import { todayLocal, lastNDates, shiftDate } from "./lib/date.js";
import { gramsPerServing } from "./lib/nutrition.js";
import { findExactFood, insertOrFind, nonNegativeNumber, saveLoggedFood } from "./lib/write.js";
import { reconcileDeletedRow } from "./lib/delete.js";
import { applyReturnedEntry, isValidEntryMealUpdate } from "./lib/meal.js";

export const RANGE_DAYS = 35; // enough for the 7-day chart + streak look-back; also the day-nav look-back

// Central data layer: loads entries/foods/goal for the signed-in user and exposes
// mutations. Entry and food inserts return their explicit database outcome.
export function useData(session) {
  const [entries, setEntries] = useState([]); // last RANGE_DAYS, newest first
  const [foods, setFoods] = useState([]);
  const [goal, setGoalState] = useState(160);
  const [waterGoal, setWaterGoalState] = useState(3000);
  const [name, setNameState] = useState("");
  const [loading, setLoading] = useState(true);
  const today = todayLocal();

  useEffect(() => {
    let alive = true;
    const since = lastNDates(RANGE_DAYS)[0];
    (async () => {
      const [e, f, p] = await Promise.all([
        supabase.from("entries").select("*").gte("eaten_on", since).order("created_at", { ascending: false }),
        supabase.from("foods").select("*").order("created_at", { ascending: false }),
        supabase.from("profile").select("protein_goal_g, water_goal_ml, name").maybeSingle(),
      ]);
      if (!alive) return;
      setEntries(e.data || []);
      setFoods(f.data || []);
      if (p.data?.protein_goal_g > 0) setGoalState(Number(p.data.protein_goal_g));
      if (p.data?.water_goal_ml > 0) setWaterGoalState(Number(p.data.water_goal_ml));
      if (p.data?.name) setNameState(p.data.name);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // date is the YYYY-MM-DD to log onto; defaults to today (retro entries pass a past day).
  const addEntry = useCallback(async (row, date) => {
    const result = await insertOrFind({
      row: { ...row, eaten_on: date || today },
      findById: (id) => supabase.from("entries").select().eq("id", id).maybeSingle(),
      insert: (entry) => supabase.from("entries").insert(entry).select().single(),
    });
    if (result.data) setEntries((cur) => cur.some((entry) => entry.id === result.data.id) ? cur : [result.data, ...cur]);
    return result;
  }, [today]);

  const addQuick = useCallback((food, qty = 1, date, mealType = "snack", entryId) => {
    const n = Number(qty); // servings; foods store per-1-serving macros
    const protein = nonNegativeNumber(food.protein_g);
    const calories = nonNegativeNumber(food.calories);
    if (!Number.isFinite(n) || n <= 0 || protein == null || calories == null || !entryId) return Promise.resolve(failedWrite());
    const perServingG = gramsPerServing(food.unit); // grams if the unit is gram-denominated, else null
    return addEntry({
      id: entryId,
      name: food.name,
      protein_g: protein * n,
      calories: calories * n,
      grams: perServingG != null ? perServingG * n : null,
      source: "saved",
      food_id: food.id,
      meal_type: mealType,
    }, date);
  }, [addEntry]);

  const addWater = useCallback((amount, date) => {
    const waterMl = Math.round(Number(amount));
    if (!(waterMl > 0)) return Promise.resolve({ data: null, error: new Error("invalid_water_amount") });
    return addEntry({
      id: crypto.randomUUID(),
      name: "מים",
      protein_g: 0,
      calories: 0,
      source: "manual",
      entry_kind: "water",
      water_ml: waterMl,
      meal_type: "snack",
    }, date);
  }, [addEntry]);

  const saveFood = useCallback(async ({ id, name, unit, protein, calories, isEdit = false }) => {
    const proteinG = nonNegativeNumber(protein);
    const calorieCount = nonNegativeNumber(calories);
    if (proteinG == null || calorieCount == null || !id) return failedWrite();
    const row = {
      id,
      name: (name || "").trim() || "מאכל",
      unit: (unit || "").trim() || null,
      protein_g: proteinG,
      calories: calorieCount,
    };
    const matchResult = (food) => isEdit
      ? { data: null, error: new Error("duplicate_food"), reused: false, conflict: true }
      : { data: food, error: null, reused: true };
    const matchingFood = findExactFood(foods, row, isEdit ? id : undefined);
    if (matchingFood) return matchResult(matchingFood);

    let freshCandidates;
    try {
      freshCandidates = await supabase.from("foods").select().eq("protein_g", proteinG).eq("calories", calorieCount);
    } catch (error) {
      return { data: null, error, reused: false };
    }
    if (freshCandidates.error) return { data: null, error: freshCandidates.error, reused: false };
    const freshMatch = findExactFood(freshCandidates.data || [], row, isEdit ? id : undefined);
    if (freshMatch) {
      if (!isEdit) setFoods((cur) => cur.some((food) => food.id === freshMatch.id) ? cur : [freshMatch, ...cur]);
      return matchResult(freshMatch);
    }
    const updated = isEdit ? await supabase.from("foods").update(row).eq("id", id).select().single() : null;
    const result = isEdit
      ? updated.data || updated.error ? updated : failedWrite()
      : await insertOrFind({
        row,
        findById: (foodId) => supabase.from("foods").select().eq("id", foodId).maybeSingle(),
        insert: (food) => supabase.from("foods").insert(food).select().single(),
      });
    if (result.data) setFoods((cur) => isEdit ? cur.map((food) => food.id === result.data.id ? result.data : food) : cur.some((food) => food.id === result.data.id) ? cur : [result.data, ...cur]);
    return result;
  }, [foods]);

  const addLogged = useCallback((values, date, mealType, source) => saveLoggedFood({ values, date, mealType, source, addEntry, saveFood }), [addEntry, saveFood]);

  const addManual = useCallback((values, date, mealType = "snack") => addLogged(values, date, mealType, "manual"), [addLogged]);
  const addAi = useCallback((values, date, mealType = "snack") => addLogged(values, date, mealType, "ai"), [addLogged]);

  const deleteEntry = useCallback(async (id) => {
    const index = entries.findIndex((entry) => entry.id === id);
    const snapshot = entries[index];
    if (!snapshot) return { data: null, error: new Error("missing_entry") };

    return reconcileDeletedRow({
      snapshot,
      remove: (entryId) => setEntries((current) => current.filter((entry) => entry.id !== entryId)),
      restore: (entry) => setEntries((current) => {
        if (current.some((existing) => existing.id === entry.id)) return current;
        const restoreAt = Math.min(index, current.length);
        return [...current.slice(0, restoreAt), entry, ...current.slice(restoreAt)];
      }),
      deleteRemote: (entryId) => supabase.from("entries").delete().eq("id", entryId).select().maybeSingle(),
      findById: (entryId) => supabase.from("entries").select().eq("id", entryId).maybeSingle(),
    });
  }, [entries]);

  const updateEntryMeal = useCallback(async (id, mealType) => {
    if (!isValidEntryMealUpdate(id, mealType)) return { data: null, error: new Error("invalid_write") };
    let result;
    try {
      result = await supabase.from("entries").update({ meal_type: mealType }).eq("id", id).select().single();
    } catch (error) {
      return { data: null, error };
    }
    if (result?.error || !result?.data) return { data: null, error: result?.error || new Error("update_failed") };
    setEntries((current) => applyReturnedEntry(current, result));
    return { data: result.data, error: null };
  }, []);

  const deleteFood = useCallback(async (id) => {
    setFoods((cur) => cur.filter((f) => f.id !== id));
    await supabase.from("foods").delete().eq("id", id);
  }, []);

  const setGoal = useCallback(async (g) => {
    setGoalState(g);
    await supabase.from("profile").upsert({ protein_goal_g: g }, { onConflict: "user_id" });
  }, []);

  const setWaterGoal = useCallback(async (ml) => {
    const value = Math.round(Number(ml));
    if (!(value > 0)) return;
    setWaterGoalState(value);
    await supabase.from("profile").upsert({ water_goal_ml: value }, { onConflict: "user_id" });
  }, []);

  const setName = useCallback(async (n) => {
    const v = (n || "").trim();
    setNameState(v);
    await supabase.from("profile").upsert({ name: v || null }, { onConflict: "user_id" });
  }, []);

  // Compress client-side then POST to the edge function. Returns { estimate } or { error }.
  const analyzePhoto = useCallback(async (file, guidance = "") => {
    const image = await compressToBase64(file);
    const res = await fetch(`${FUNCTIONS_URL}/analyze-food-photo`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ image, mediaType: "image/jpeg", guidance }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || "error", status: res.status };
    return { estimate: body };
  }, [session]);

  const estimateFoodNutrition = useCallback(async (foodName, unit, quantity = 1, totalGrams = null) => {
    const res = await fetch(`${FUNCTIONS_URL}/analyze-food-photo`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        mode: "text",
        foodName: String(foodName ?? "").trim(),
        unit: String(unit ?? "").trim(),
        quantity,
        totalGrams,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || "error", status: res.status };
    return { estimate: body };
  }, [session]);

  const signOut = useCallback(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith(`workout-draft:${session.user.id}:`)) localStorage.removeItem(key);
    return supabase.auth.signOut();
  }, [session.user.id]);

  return {
    loading, entries, foods, goal, waterGoal, name, today, email: session.user.email,
    addQuick, addWater, addManual, addAi, deleteEntry, updateEntryMeal, saveFood, deleteFood, setGoal, setWaterGoal, setName, analyzePhoto, estimateFoodNutrition, signOut,
  };
}

// Workout data is loaded only after the workout tab opens. History and progress are separate queries.
export function useWorkouts(session, enabled) {
  const [catalog, setCatalog] = useState({ exercises: [], templates: [], items: [], open: null, weeklyGoal: 3 });
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [progress, setProgress] = useState([]);
  const [consistency, setConsistency] = useState({ total: 0, partial: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const progressRequest = useRef(0);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const [exercises, templates, items, open, profile] = await Promise.all([
      supabase.from("training_exercises").select("*").order("name"),
      supabase.from("workout_templates").select("*").is("archived_at", null).order("position"),
      supabase.from("workout_template_exercises").select("*").order("position"),
      supabase.from("workout_sessions").select("*").eq("status", "in_progress").order("created_at", { ascending: false }).limit(1),
      supabase.from("profile").select("workout_goal_weekly").maybeSingle(),
    ]);
    const failure = [exercises, templates, items, open, profile].find((result) => result.error)?.error;
    if (failure) setError(failure.message);
    else {
      setError("");
      setCatalog({ exercises: exercises.data || [], templates: templates.data || [], items: items.data || [], open: open.data?.[0] || null, weeklyGoal: profile.data?.workout_goal_weekly || 3 });
    }
    setLoading(false);
    return { error: failure || null };
  }, []);

  useEffect(() => { if (enabled) loadCatalog(); }, [enabled, loadCatalog]);

  const saveExercise = async (values, current = null) => {
    const row = {
      name: values.name.trim(), muscle_group: values.muscle_group.trim(), equipment: values.equipment.trim() || null,
      load_mode: values.load_mode, weight_basis: values.weight_basis, reps_basis: values.reps_basis,
      notes: values.notes.trim() || null,
    };
    const query = current
      ? supabase.from("training_exercises").update({ ...row, revision: current.revision + 1 }).eq("id", current.id).eq("revision", current.revision)
      : supabase.from("training_exercises").insert({ id: values.id, ...row });
    const result = await query.select().maybeSingle();
    if (result.data) await loadCatalog();
    return { data: result.data, error: result.error || (!result.data ? new Error("stale") : null) };
  };

  const archiveExercise = async (exercise) => {
    const result = await supabase.from("training_exercises")
      .update({ archived_at: new Date().toISOString(), revision: exercise.revision + 1 })
      .eq("id", exercise.id).eq("revision", exercise.revision).select().maybeSingle();
    if (result.data) await loadCatalog();
    return { data: result.data, error: result.error || (!result.data ? new Error("stale") : null) };
  };

  const saveTemplate = async (values, current = null) => {
    const result = await supabase.rpc("save_workout_template", {
      p_id: values.id, p_name: values.name.trim(), p_position: values.position,
      p_preferred_day: values.preferred_day, p_items: values.items,
      p_expected_revision: current?.revision || 0,
    });
    if (result.data) await loadCatalog();
    return result;
  };

  const archiveTemplate = async (template) => {
    const result = await supabase.from("workout_templates")
      .update({ archived_at: new Date().toISOString(), revision: template.revision + 1 })
      .eq("id", template.id).eq("revision", template.revision).select().maybeSingle();
    if (result.data) await loadCatalog();
    return { data: result.data, error: result.error || (!result.data ? new Error("stale") : null) };
  };

  const loadSession = async (id) => {
    const [sessionResult, exercisesResult] = await Promise.all([
      supabase.from("workout_sessions").select("*").eq("id", id).maybeSingle(),
      supabase.from("workout_session_exercises").select("*").eq("session_id", id).order("position"),
    ]);
    const failure = sessionResult.error || exercisesResult.error;
    if (failure || !sessionResult.data) return { error: failure || new Error("missing_session") };
    const exercises = exercisesResult.data || [];
    const setsResult = exercises.length
      ? await supabase.from("workout_sets").select("*").in("session_exercise_id", exercises.map((item) => item.id)).order("position")
      : { data: [], error: null };
    if (setsResult.error) return { error: setsResult.error };
    const next = { session: sessionResult.data, exercises, sets: setsResult.data || [] };
    setDetail(next);
    return { data: next, error: null };
  };

  const startSession = async (templateId, id, date, retroactive) => {
    const result = await supabase.rpc("start_workout", {
      p_template_id: templateId, p_session_id: id, p_performed_on: date, p_retroactive: retroactive,
    });
    if (result.data) {
      setCatalog((current) => ({ ...current, open: result.data }));
      const detailResult = await loadSession(result.data.id);
      if (detailResult.error) return detailResult;
    }
    return result;
  };

  const saveSet = async (values, current = null) => {
    const result = await supabase.rpc("save_workout_set", {
      p_id: values.id, p_session_exercise_id: values.session_exercise_id,
      p_position: values.position, p_kind: values.kind, p_load_kg: values.load_kg,
      p_reps: values.reps, p_note: values.note || null, p_expected_revision: current?.revision || 0,
    });
    if (result.data) setDetail((old) => old && ({ ...old, sets: [...old.sets.filter((set) => set.id !== result.data.id), result.data].sort((a, b) => a.position - b.position) }));
    return result;
  };

  const setExerciseStatus = async (item, status) => {
    const result = await supabase.from("workout_session_exercises")
      .update({ status, revision: item.revision + 1 }).eq("id", item.id).eq("revision", item.revision).select().maybeSingle();
    if (result.data) setDetail((old) => old && ({ ...old, exercises: old.exercises.map((value) => value.id === item.id ? result.data : value) }));
    return { data: result.data, error: result.error || (!result.data ? new Error("stale") : null) };
  };

  const finishSession = async (sessionRow, partial) => {
    const result = await supabase.from("workout_sessions")
      .update({ status: "completed", partial, completed_at: sessionRow.started_at ? new Date().toISOString() : null,
        revision: sessionRow.revision + 1 })
      .eq("id", sessionRow.id).eq("revision", sessionRow.revision).eq("status", "in_progress").select().maybeSingle();
    if (result.data) {
      setDetail((old) => old && ({ ...old, session: result.data }));
      setCatalog((old) => ({ ...old, open: old.open?.id === result.data.id ? null : old.open }));
    }
    return { data: result.data, error: result.error || (!result.data ? new Error("stale") : null) };
  };

  const loadHistory = async (page = 0) => {
    const result = await supabase.from("workout_sessions").select("*").eq("status", "completed")
      .order("performed_on", { ascending: false }).order("created_at", { ascending: false }).range(page * 20, page * 20 + 20);
    if (!result.error) {
      setHistory((old) => page ? [...old, ...(result.data || []).slice(0, 20)] : (result.data || []).slice(0, 20));
      setHasMore((result.data || []).length > 20);
    }
    return result;
  };

  const loadProgress = async (exerciseId, since, until, templateId = null) => {
    const revision = ++progressRequest.current;
    const rows = [];
    for (let page = 0; ; page++) {
      const result = await supabase.rpc("workout_progress", {
        p_exercise_id: exerciseId, p_since: since, p_until: until, p_template_id: templateId,
      }).range(page * 1000, page * 1000 + 999);
      if (result.error) return result;
      if (revision !== progressRequest.current) return { data: null, error: null };
      rows.push(...(result.data || []));
      if ((result.data || []).length < 1000) break;
    }
    if (revision === progressRequest.current) setProgress(rows);
    return { data: rows, error: null };
  };

  const loadPrevious = (exerciseId, date, excludeSessionId = null) => supabase.rpc("workout_previous", {
    p_exercise_id: exerciseId, p_before: date, p_exclude_session_id: excludeSessionId,
  });

  const loadConsistency = async () => {
    const today = todayLocal();
    const start = shiftDate(today, -new Date(`${today}T00:00:00`).getDay());
    const base = () => supabase.from("workout_sessions").select("id", { count: "exact", head: true })
      .eq("status", "completed").gte("performed_on", start).lte("performed_on", today);
    const [all, partial] = await Promise.all([base(), base().eq("partial", true)]);
    if (!all.error && !partial.error) setConsistency({ total: all.count || 0, partial: partial.count || 0 });
    return { error: all.error || partial.error };
  };

  const setWeeklyGoal = async (goal) => {
    const result = await supabase.from("profile").upsert({ workout_goal_weekly: goal }, { onConflict: "user_id" })
      .select("workout_goal_weekly").single();
    if (result.data) setCatalog((old) => ({ ...old, weeklyGoal: result.data.workout_goal_weekly }));
    return result;
  };

  const changeSessionDate = async (sessionRow, date) => {
    const result = await supabase.from("workout_sessions")
      .update({ performed_on: date, revision: sessionRow.revision + 1 })
      .eq("id", sessionRow.id).eq("revision", sessionRow.revision).select().maybeSingle();
    if (result.data) setDetail((old) => old && ({ ...old, session: result.data }));
    return { data: result.data, error: result.error || (!result.data ? new Error("stale") : null) };
  };

  return { ...catalog, detail, history, hasMore, progress, consistency, loading, error, userId: session.user.id,
    loadCatalog, saveExercise, archiveExercise, saveTemplate, archiveTemplate,
    loadSession, startSession, saveSet, setExerciseStatus, finishSession, loadHistory, loadProgress, loadPrevious, changeSessionDate, loadConsistency, setWeeklyGoal };
}

function compressToBase64(file, max = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(src);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.onerror = (e) => { URL.revokeObjectURL(src); reject(e); };
    img.src = src;
  });
}

function failedWrite() {
  return { data: null, error: new Error("invalid_write"), reused: false };
}
