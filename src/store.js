import { useCallback, useEffect, useState } from "react";
import { supabase, FUNCTIONS_URL } from "./lib/supabase.js";
import { todayLocal, lastNDates } from "./lib/date.js";
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
      body: JSON.stringify({ image, mediaType: "image/jpeg", guidance: guidance.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || "error", status: res.status };
    return { estimate: body };
  }, [session]);

  const estimateFoodNutrition = useCallback(async (foodName, unit) => {
    const res = await fetch(`${FUNCTIONS_URL}/analyze-food-photo`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ mode: "text", foodName: String(foodName ?? "").trim(), unit: String(unit ?? "").trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || "error", status: res.status };
    return { estimate: body };
  }, [session]);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return {
    loading, entries, foods, goal, waterGoal, name, today, email: session.user.email,
    addQuick, addWater, addManual, addAi, deleteEntry, updateEntryMeal, saveFood, deleteFood, setGoal, setWaterGoal, setName, analyzePhoto, estimateFoodNutrition, signOut,
  };
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
