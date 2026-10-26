import { registerManagementTools, schemas } from "./management.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.3.1";
const id = "11111111-1111-4111-8111-111111111111";
const assert = (value: boolean) => { if (!value) throw new Error("assertion failed"); };
Deno.test("patches require revisions and reject unknown fields and empty mutations", () => {
  assert(!schemas.update_workout_session.safeParse({ request_id: id, session_id: id, expected_revision: 1 }).success);
  assert(!schemas.update_workout_session.safeParse({ request_id: id, session_id: id, notes: "fix" }).success);
  assert(!schemas.update_workout_session.safeParse({ request_id: id, session_id: id, expected_revision: 1, user_id: id, notes: "fix" }).success);
  assert(schemas.update_workout_session.safeParse({ request_id: id, session_id: id, expected_revision: 1, notes: null }).success);
});
Deno.test("set edits need occurrence IDs and revisions, inserts need explicit stable IDs", () => {
  const base = { request_id: id, session_id: id, expected_revision: 2 };
  assert(!schemas.update_workout_session.safeParse({ ...base, sets: [{ id, reps: 8 }] }).success);
  assert(schemas.update_workout_session.safeParse({ ...base, sets: [{ id, expected_revision: 0, session_exercise_id: id, expected_exercise_revision: 2, position: 0, reps: 8, kind: "work", load_kg: 20 }] }).success);
  assert(!schemas.update_workout_session.safeParse({ ...base, sets: [{ id, expected_revision: 1, session_exercise_id: id, expected_exercise_revision: 2, reps: -1 }] }).success);
  assert(!schemas.update_workout_session.safeParse({ ...base, sets: [{ id, expected_revision: 0, session_exercise_id: id, expected_exercise_revision: 2, reps: 8 }] }).success);
  assert(!schemas.update_workout_session.safeParse({ ...base, sets: [{ id, expected_revision: 1, session_exercise_id: id, expected_exercise_revision: 2, remove: true, reps: 8 }] }).success);
});
Deno.test("catalog definitions require complete unit semantics and reject ownership input", () => {
  const exercise = { request_id: id, id, expected_revision: 0, name: "מתח", muscle_group: "גב", load_mode: "bodyweight", weight_basis: "total", reps_basis: "total" };
  assert(schemas.save_exercise.safeParse(exercise).success);
  assert(!schemas.save_exercise.safeParse({ ...exercise, load_mode: "guessed" }).success);
  assert(!schemas.save_exercise.safeParse({ ...exercise, user_id: id }).success);
});

Deno.test("MCP transport advertises all management tools and dispatches bounded RPC arguments", async () => {
  const calls: unknown[] = [];
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "test", version: "1.2.0" });
    const tool = (name: string, description: string, inputSchema: any, run: any, annotations?: any) =>
      server.registerTool(name, { description, inputSchema, annotations }, async (args: any) => ({ content: [{ type: "text" as const, text: JSON.stringify(await run(args)) }] }));
    registerManagementTools(tool, { rpc: (name: string, args: unknown) => { calls.push({ name, args }); return { data: { saved: true } }; } }, async (r: any) => r.data, { readOnlyHint: false, idempotentHint: true });
    return server;
  });
  const request = async (method: string, params: unknown) => {
    const response = await handler.fetch(new Request("https://example.invalid/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
    const body = await response.text();
    const json = body.startsWith("event:") ? JSON.parse(body.split("\n").find(line => line.startsWith("data: "))!.slice(6)) : JSON.parse(body);
    if (json.error) throw new Error(JSON.stringify(json.error));
    return json.result;
  };
  try {
    const list = await request("tools/list", {});
    assert(list.tools.length === 7);
    assert(list.tools.find((t: any) => t.name === "update_workout_session").annotations.destructiveHint === true);
    await request("tools/call", { name: "get_connector_capabilities", arguments: {} });
    assert(JSON.stringify(calls[0]) === JSON.stringify({ name: "connector_read", args: { p_action: "capabilities", p_payload: {} } }));
    await request("tools/call", { name: "set_workout_session_status", arguments: { request_id: id, session_id: id, expected_revision: 3, status: "cancelled" } });
    assert(JSON.stringify(calls[1]) === JSON.stringify({ name: "connector_write", args: { p_request_id: id, p_action: "set_workout_session_status", p_payload: { session_id: id, expected_revision: 3, status: "cancelled" } } }));
  } finally { await handler.close(); }
});
