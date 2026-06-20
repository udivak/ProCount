import { useCallback, useEffect, useState } from "react";
import { supabase, FUNCTIONS_URL } from "./lib/supabase.js";
import { todayLocal, lastNDates } from "./lib/date.js";

const RANGE_DAYS = 35; // enough for the 7-day chart + streak look-back

// Central data layer: loads entries/foods/goal for the signed-in user and exposes
// mutations. Writes are local-optimistic (update state, then persist) so the UI
// stays instant — RLS guarantees every row belongs to this user.
export function useData(session) {
  const [entries, setEntries] = useState([]); // last RANGE_DAYS, newest first
  const [foods, setFoods] = useState([]);
  const [goal, setGoalState] = useState(160);
  const [loading, setLoading] = useState(true);
  const today = todayLocal();

  useEffect(() => {
    let alive = true;
    const since = lastNDates(RANGE_DAYS)[0];
    (async () => {
      const [e, f, p] = await Promise.all([
        supabase.from("entries").select("*").gte("eaten_on", since).order("created_at", { ascending: false }),
        supabase.from("foods").select("*").order("created_at", { ascending: false }),
        supabase.from("profile").select("protein_goal_g").maybeSingle(),
      ]);
      if (!alive) return;
      setEntries(e.data || []);
      setFoods(f.data || []);
      if (p.data?.protein_goal_g > 0) setGoalState(Number(p.data.protein_goal_g));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const addEntry = useCallback(async (row) => {
    const { data, error } = await supabase
      .from("entries").insert({ ...row, eaten_on: today }).select().single();
    if (!error && data) setEntries((cur) => [data, ...cur]);
    return { data, error };
  }, [today]);

  const addQuick = useCallback((food, qty = 1) => {
    const n = Number(qty) || 1; // servings; foods store per-1-serving macros
    return addEntry({
      name: food.name,
      protein_g: (Number(food.protein_g) || 0) * n,
      calories: (Number(food.calories) || 0) * n,
      source: "saved",
      food_id: food.id,
    });
  }, [addEntry]);

  const addManual = useCallback(async ({ name, protein, calories, save }) => {
    const p = parseFloat(protein) || 0;
    const c = parseFloat(calories) || 0;
    const nm = (name || "").trim() || "רישום ללא שם";
    await addEntry({ name: nm, protein_g: p, calories: c, source: "manual" });
    if (save) {
      const { data } = await supabase
        .from("foods").insert({ name: nm, unit: "מותאם", protein_g: p, calories: c }).select().single();
      if (data) setFoods((cur) => [data, ...cur]);
    }
  }, [addEntry]);

  const addAi = useCallback(({ name, protein, calories }) =>
    addEntry({
      name: (name || "").trim() || "רישום ללא שם",
      protein_g: parseFloat(protein) || 0,
      calories: parseFloat(calories) || 0,
      source: "ai",
    }), [addEntry]);

  const deleteEntry = useCallback(async (id) => {
    setEntries((cur) => cur.filter((e) => e.id !== id));
    await supabase.from("entries").delete().eq("id", id);
  }, []);

  const saveFood = useCallback(async ({ id, name, unit, protein, calories }) => {
    const row = {
      name: (name || "").trim() || "מאכל",
      unit: (unit || "").trim() || null,
      protein_g: parseFloat(protein) || 0,
      calories: parseFloat(calories) || 0,
    };
    if (id) {
      const { data } = await supabase.from("foods").update(row).eq("id", id).select().single();
      if (data) setFoods((cur) => cur.map((f) => (f.id === id ? data : f)));
    } else {
      const { data } = await supabase.from("foods").insert(row).select().single();
      if (data) setFoods((cur) => [data, ...cur]);
    }
  }, []);

  const deleteFood = useCallback(async (id) => {
    setFoods((cur) => cur.filter((f) => f.id !== id));
    await supabase.from("foods").delete().eq("id", id);
  }, []);

  const setGoal = useCallback(async (g) => {
    setGoalState(g);
    await supabase.from("profile").upsert({ protein_goal_g: g }, { onConflict: "user_id" });
  }, []);

  // Compress client-side then POST to the edge function. Returns { estimate } or { error }.
  const analyzePhoto = useCallback(async (file) => {
    const image = await compressToBase64(file);
    const res = await fetch(`${FUNCTIONS_URL}/analyze-food-photo`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ image, mediaType: "image/jpeg" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || "error", status: res.status };
    return { estimate: body };
  }, [session]);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return {
    loading, entries, foods, goal, today, email: session.user.email,
    addQuick, addManual, addAi, deleteEntry, saveFood, deleteFood, setGoal, analyzePhoto, signOut,
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
