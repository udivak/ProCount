import { z } from "npm:zod@4.3.6";

const uuid = z.string().uuid();
const revision = z.number().int().positive();
const notes = z.string().max(1000).nullable().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const request = { request_id: uuid.describe("Generate once; reuse the same ID and payload for retries.") };
const actualSet = {
  reps: z.number().int().min(1).max(10000), load_kg: z.number().min(0).max(10000).nullable().optional(),
  kind: z.enum(["work", "warmup"]), note: notes,
};
export const workoutImport = {
  source_system: z.string().trim().min(1).max(80).optional(),
  source_workout_id: z.string().trim().min(1).max(200).optional(),
  expected_template_revision: revision.optional(),
  allow_same_day_session: z.boolean().optional().describe("Only true after verifying this is a distinct second workout on the same day."),
};
export const schemas = {
  save_exercise: z.strictObject({ ...request, id: uuid, expected_revision: z.number().int().min(0),
    name: z.string().trim().min(1).max(120), muscle_group: z.string().trim().min(1).max(80),
    equipment: z.string().max(200).nullable().optional(), notes,
    load_mode: z.enum(["external", "bodyweight", "assisted"]), weight_basis: z.enum(["total", "per_hand"]), reps_basis: z.enum(["total", "per_side"]),
  }),
  save_workout_template: z.strictObject({ ...request, id: uuid, expected_revision: z.number().int().min(0),
    name: z.string().trim().min(1).max(80), position: z.number().int().min(0).max(1000), preferred_day: z.number().int().min(0).max(6).nullable(),
    items: z.array(z.strictObject({ exercise_id: uuid, position: z.number().int().min(0).max(1000), rest_seconds: z.number().int().min(0).max(3600), notes,
      target_sets: z.array(z.strictObject({ reps_min: z.number().int().min(1).max(10000), reps_max: z.number().int().min(1).max(10000), load_kg: z.number().min(0).max(10000).nullable().optional() }).refine(s => s.reps_min <= s.reps_max)).min(1).max(20),
    })).min(1).max(50),
  }),
  update_workout_session: z.strictObject({ ...request, session_id: uuid, expected_revision: revision, date: date.optional(), notes,
    allow_same_day_session: z.boolean().optional(),
    exercises: z.array(z.strictObject({ id: uuid, expected_revision: revision, status: z.enum(["completed", "skipped"]) })).min(1).max(50).optional(),
    sets: z.array(z.strictObject({ id: uuid, expected_revision: z.number().int().min(0), session_exercise_id: uuid, expected_exercise_revision: revision,
      position: z.number().int().min(0).max(1000).optional(), remove: z.boolean().optional(),
      reps: actualSet.reps.optional(), load_kg: actualSet.load_kg, kind: actualSet.kind.optional(), note: notes,
    }).refine(s => s.remove ? s.expected_revision > 0 && !["position", "reps", "load_kg", "kind", "note"].some(k => k in s)
      : s.expected_revision > 0 || (s.position !== undefined && s.reps !== undefined && s.kind !== undefined), "New sets require position, reps and kind; removals cannot include edits")).min(1).max(250).optional(),
  }).refine(p => p.date !== undefined || p.notes !== undefined || p.exercises !== undefined || p.sets !== undefined, "No changes supplied"),
  set_workout_session_status: z.strictObject({ ...request, session_id: uuid, expected_revision: revision, status: z.enum(["completed", "cancelled"]), allow_same_day_session: z.boolean().optional() }),
};

export function registerManagementTools(tool: any, supabase: any, one: any, writeHints: any) {
  const read = (action: string, payload: any = {}) => one(supabase.rpc("connector_read", { p_action: action, p_payload: payload }));
  tool("get_connector_capabilities", "Current MCP version, limits, supported actions and effective permissions for THIS OAuth client. Cannot change permissions.", z.strictObject({}), () => read("capabilities"));
  tool("get_workout_session", "Read one owned workout with exact saved sets, occurrence IDs, row revisions and import source. Call before correcting a workout and after saving to verify.", z.strictObject({ session_id: uuid }), (args: any) => read("session", args));
  tool("get_write_result", "Recover a write result after a timeout using its original request_id. Only this user's current client requests are visible, and current permission is required. Not found means retry the SAME ID and payload.", z.strictObject({ request_id: uuid }), (args: any) => read("result", args));
  const descriptions = {
    save_exercise: "Create (expected_revision=0) or explicitly update an owned exercise. Use list_exercises first; never merge by similar name. Specify actual unit semantics. Requires workout_catalog permission.",
    save_workout_template: "Create (expected_revision=0) or update a workout template atomically from existing owned exercise IDs. Fetch get_workout_plan first. Changes affect future sessions only. Requires workout_catalog permission.",
    update_workout_session: "Correct a completed workout atomically. First read get_workout_session; supply session and affected row revisions. Omitted values are preserved. New sets need stable IDs, expected_revision=0, position, kind and reps. remove=true removes one set with its previous data retained in the result for recovery. Requires workout_edit permission. Never silently overwrite a revision conflict.",
    set_workout_session_status: "Cancel or restore a completed workout without permanent deletion. Requires workout_edit permission, explicit user intent and the latest session revision. A restored workout counts toward progress again.",
  };
  for (const [name, schema] of Object.entries(schemas)) {
    tool(name, descriptions[name as keyof typeof descriptions], schema, (args: any) => {
      const { request_id, ...payload } = args;
      return one(supabase.rpc("connector_write", { p_request_id: request_id, p_action: name, p_payload: payload }));
    }, { ...writeHints, destructiveHint: true });
  }
}
