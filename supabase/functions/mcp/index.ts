// OAuth reads use RLS; writes use bounded transactional RPCs with per-client grants.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.3.1";
import { pipeline } from "npm:@supabase/middleware@1.0.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1.9.2";
import { z } from "npm:zod@4.3.6";
import {
  dateRange, shapeFood, shapeNutrition, shapePlan, shapeProfile, shapeProgress, shapeSessions, todayIn,
} from "./shape.js";

import { registerManagementTools, workoutImport } from "./management.ts";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const date = z.string().describe("Local date YYYY-MM-DD (Israel time)");

// PostgREST caps responses at 1000 rows; page until a short page.
async function readAll(build: () => any) {
  const rows = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build().range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function one(query: any) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

const loadProfile = async (supabase: any) => shapeProfile(
  await one(supabase.from("profile").select("name, protein_goal_g, water_goal_ml, workout_goal_weekly").maybeSingle()),
  todayIn(),
);

function buildServer(supabase: any) {
  const server = new McpServer({ name: "procount", version: "1.2.0" });
  const tool = (name: string, description: string, inputSchema: any, run: (args: any) => Promise<unknown>, annotations = READ_ONLY) =>
    server.registerTool(name, { description, inputSchema, annotations }, async (args: any) => {
      try {
        return { content: [{ type: "text" as const, text: JSON.stringify(await run(args)) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] };
      }
    });

  tool("get_profile",
    "ProCount user's goals (protein g/day, water ml/day, calories kcal/day, workouts/week), name, and today's date in the user's timezone. Call first to resolve relative dates like 'this week'.",
    z.object({}),
    () => loadProfile(supabase));

  tool("get_nutrition",
    "Daily protein (g), calories (kcal) and water (ml) for a date range, with a summary (averages, days the protein goal was met, protein streak ending at `to`). Goal comparisons use the CURRENT goal; past goals are not stored. include_entries adds per-meal food entries (max 31 days).",
    z.object({
      from: date, to: date,
      include_entries: z.boolean().default(false).describe("Include each day's food entries grouped by meal"),
    }),
    async ({ from, to, include_entries }) => {
      const dates = dateRange(from, to, include_entries ? 31 : 92);
      const [profile, entries] = await Promise.all([
        loadProfile(supabase),
        readAll(() => supabase.from("entries")
          .select("id, eaten_on, name, protein_g, calories, grams, source, meal_type, entry_kind, water_ml, created_at")
          .gte("eaten_on", from).lte("eaten_on", to).order("eaten_on").order("created_at")),
      ]);
      return shapeNutrition(entries, profile, dates, include_entries);
    });

  tool("list_foods",
    "The saved food catalog: per-serving protein (g) and calories (kcal), serving unit text (Hebrew), and protein per 100g when the unit is in grams.",
    z.object({ query: z.string().max(100).optional().describe("Case-insensitive name substring (Hebrew names)") }),
    async ({ query }) => {
      const pattern = query && `%${query.replace(/[\\%_]/g, (c: string) => `\\${c}`)}%`;
      const foods = await readAll(() => {
        const q = supabase.from("foods").select("id, name, unit, protein_g, calories, default_qty").order("name");
        return pattern ? q.ilike("name", pattern) : q;
      });
      return foods.map(shapeFood);
    });

  tool("list_exercises",
    "The exercise library (id, name, muscle group, equipment, load mode). Use the id with get_exercise_progress.",
    z.object({ include_archived: z.boolean().default(false) }),
    async ({ include_archived }) => readAll(() => {
      const q = supabase.from("training_exercises")
        .select("id, revision, name, muscle_group, equipment, load_mode, weight_basis, reps_basis, notes, archived_at").order("name");
      return include_archived ? q : q.is("archived_at", null);
    }));

  tool("get_workout_plan",
    "The active workout plan: kind strength/swimming, preferred weekday (0=Sunday). Strength templates include ordered exercises, target sets (reps_min/reps_max/load_kg), and rest seconds. Swimming templates have no strength sets and cannot be logged or edited by connector tools.",
    z.object({}),
    async () => shapePlan(await one(supabase.from("workout_templates")
      .select("id, revision, name, kind, position, preferred_day, workout_template_exercises(exercise_id, position, target_sets, rest_seconds, notes, training_exercises(name, muscle_group, load_mode, weight_basis, reps_basis, notes))")
      .is("archived_at", null).order("position"))));

  tool("list_workout_sessions",
    "Performed workouts in a date range (max 92 days). Strength: every exercise/set and volume kg. Swimming: duration_seconds (includes rests), optional distance_m, pool length/count and stroke; pace is total time per 100m including rests. Swimming writes are not supported by the connector.",
    z.object({
      from: date, to: date,
      status: z.enum(["completed", "in_progress", "cancelled", "all"]).default("completed"),
    }),
    async ({ from, to, status }) => {
      dateRange(from, to, 92);
      const sessions = await readAll(() => {
        const q = supabase.from("workout_sessions")
          .select("id, revision, template_id, performed_on, template_name, kind, status, partial, notes, created_at, workout_swim_details(duration_seconds, distance_m, pool_length_m, length_count, stroke), workout_session_exercises(id, revision, exercise_id, position, exercise_name, muscle_group, load_mode, weight_basis, reps_basis, status, target_sets, workout_sets(id, revision, position, kind, load_kg, reps, note))")
          .gte("performed_on", from).lte("performed_on", to).order("performed_on").order("created_at");
        return status === "all" ? q : q.eq("status", status);
      });
      return shapeSessions(sessions);
    });

  tool("get_exercise_progress",
    "Completed-session history for one exercise over a date range (max 366 days): per session the sets, heaviest work set, and volume. Get exercise_id from list_exercises or get_workout_plan.",
    z.object({
      exercise_id: z.string().uuid(), from: date, to: date,
      template_id: z.string().uuid().optional().describe("Limit to one workout of the plan"),
    }),
    async ({ exercise_id, from, to, template_id }) => {
      dateRange(from, to, 366);
      // GET sends args as query params; omit the optional one rather than send "null".
      const args = { p_exercise_id: exercise_id, p_since: from, p_until: to, ...(template_id && { p_template_id: template_id }) };
      const rows = await readAll(() => supabase.rpc("workout_progress", args, { get: true }));
      return shapeProgress(rows);
    });

  const writeHints = { ...READ_ONLY, readOnlyHint: false };
  const common = { request_id: z.string().uuid().describe("Generate once per user action; reuse on every retry. Never retry with a new ID."), date };
  const write = (action: string, args: any) => {
    const { request_id, ...payload } = args;
    dateRange(payload.date, payload.date, 1);
    return one(supabase.rpc("connector_write", { p_request_id: request_id, p_action: action, p_payload: payload }));
  };
  tool("log_water", "Record water the user explicitly reports drinking. Resolve date with get_profile. Amount is milliliters, not liters. Requires water write permission in ProCount Settings.",
    z.object({ ...common, water_ml: z.number().int().positive().max(10000) }), args => write("water", args), writeHints);
  const grams = z.number().positive().max(100000).optional();
  const savedFood = z.object({ food_id: z.string().uuid(), quantity: z.number().positive().max(100) });
  const manualFood = z.object({ name: z.string().trim().min(1).max(200), protein_g: z.number().min(0).max(10000), calories: z.number().min(0).max(100000), grams, source: z.enum(["manual", "ai"]).default("manual") });
  tool("log_meal", "Record foods actually eaten, atomically. Use list_foods IDs and serving quantities where possible. Manual protein/calories/grams are TOTAL per item, not per serving. Never invent missing values or copy estimates without the user's approval; mark approved estimates source=ai. Specify meal_type explicitly. Requires meals write permission.",
    z.object({ ...common, meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]), items: z.array(z.union([savedFood, manualFood])).min(1).max(50) }), args => write("meals", args), writeHints);
  tool("log_workout", "Record a completed strength workout from an existing strength template, atomically. Swimming writes are not supported. Fetch get_workout_plan first. Include ONLY performed exercises and actual sets; never assume planned sets were performed. Unreported exercises are skipped and workout is partial. Preserve per-hand/per-side and load_mode meanings; bodyweight may omit load_kg. Requires workouts write permission. Does not edit existing sessions or templates.",
    z.object({ ...common, ...workoutImport, template_id: z.string().uuid(), notes: z.string().max(1000).optional(), exercises: z.array(z.object({ exercise_id: z.string().uuid(), sets: z.array(z.object({ reps: z.number().int().min(1).max(10000), load_kg: z.number().min(0).max(10000).optional(), kind: z.enum(["work", "warmup"]).default("work"), note: z.string().max(1000).optional() })).min(1).max(50) })).min(1).max(50) }), args => write("workouts", args), writeHints);

  registerManagementTools(tool, supabase, one, writeHints);

  return server;
}

Deno.serve(pipeline(
  [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
  (req, { supabase }) => createMcpHandler(() => buildServer(supabase), {
    onerror: (error) => console.error("MCP request failed", error),
  }).fetch(req),
));
