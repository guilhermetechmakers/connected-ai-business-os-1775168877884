import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  listRuntimeToolDefinitions,
  runtimePolicyTestHooks,
} from "./integrations-runtime.ts";

Deno.test("runtime tool catalog includes expanded parity tools", () => {
  const ids = new Set(listRuntimeToolDefinitions().map((t) => t.id));
  const required = [
    "gmail.get_message",
    "google_drive.fetch_file_content",
    "google_calendar.delete_event",
    "zoom.list_meetings",
    "slack.update_message",
    "hubspot.create_deal",
    "quickbooks.create_invoice",
    "notion.pages.search",
    "clickup.create_task",
    "monday.list_boards",
    "trello.create_card",
  ];
  for (const id of required) assert(ids.has(id), `Missing tool ${id}`);
});

Deno.test("google_calendar.create_event tool supports attendees and invite flags", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "google_calendar.create_event");
  if (!tool) throw new Error("tool missing");
  assert("attendees" in tool.argsShape);
  assert("sendCalendarInvites" in tool.argsShape);
});

Deno.test("runtime tool catalog emits risk and role metadata", () => {
  const defs = listRuntimeToolDefinitions();
  assert(defs.length > 0);
  for (const tool of defs) {
    assert(["low", "medium", "high", "critical"].includes(String(tool.riskTier)));
    assert(tool.roleGroup !== undefined);
  }
});

Deno.test("constrainToolArgs clamps query limits and page sizes", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "gmail.search_messages");
  if (!tool) throw new Error("tool missing");
  const constrained = runtimePolicyTestHooks.constrainToolArgs(tool, {
    maxResults: 9999,
    limit: 9999,
    pageSize: 9999,
  });
  assertEquals(constrained.maxResults, 50);
  assertEquals(constrained.limit, 100);
  assertEquals(constrained.pageSize, 100);
});

Deno.test("validateToolArgs enforces required fields", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "slack.send_message");
  if (!tool) throw new Error("tool missing");
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { channel: "C123" }),
    Error,
    "Missing required argument",
  );
});

Deno.test("zoom.create_meeting validates duration bounds", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "zoom.create_meeting");
  if (!tool) throw new Error("tool missing");
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { topic: "Exec sync", durationMinutes: 0 }),
    Error,
    "durationMinutes must be between 1 and 600",
  );
});

Deno.test("role group guard enforces finance admin tools", () => {
  const allowed = runtimePolicyTestHooks.canExecuteRoleGroup(["finance_admin"], "finance_admin_plus");
  const denied = runtimePolicyTestHooks.canExecuteRoleGroup(["sales_ops"], "finance_admin_plus");
  assertEquals(allowed, true);
  assertEquals(denied, false);
});
Deno.test("notion.pages.update requires at least one mutating field", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "notion.pages.update");
  if (!tool) throw new Error("tool missing");
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { pageId: "abc123" }),
    Error,
    "requires title or appendContent",
  );
});

Deno.test("constrainToolArgs clamps notion search pageSize", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "notion.pages.search");
  if (!tool) throw new Error("tool missing");
  const constrained = runtimePolicyTestHooks.constrainToolArgs(tool, { pageSize: 9999 });
  assertEquals(constrained.pageSize, 100);
});

Deno.test("clickup task creation validates required fields and assignment shape", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "clickup.create_task");
  if (!tool) throw new Error("tool missing");
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { listId: "123" }),
    Error,
    "Missing required argument: name",
  );
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { listId: "123", name: "Task", assignees: "bad-shape" }),
    Error,
    "assignees must be an array of user ids",
  );
});

Deno.test("validateToolArgs rejects invalid monday.com column values json", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "monday.change_item_column_values");
  if (!tool) throw new Error("tool missing");
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { boardId: "123", itemId: "456", columnValues: "{bad" }),
    Error,
    "columnValues must be valid JSON string",
  );
});

Deno.test("constrainToolArgs clamps trello listing limits", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "trello.list_cards");
  if (!tool) throw new Error("tool missing");
  const constrained = runtimePolicyTestHooks.constrainToolArgs(tool, { boardId: "abc123", limit: 9999 });
  assertEquals(constrained.limit, 100);
});

Deno.test("validateToolArgs enforces trello card bounds", () => {
  const tool = listRuntimeToolDefinitions().find((t) => t.id === "trello.create_card");
  if (!tool) throw new Error("tool missing");
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { listId: "l1", name: "" }),
    Error,
    "Missing required argument: name",
  );
  assertThrows(
    () => runtimePolicyTestHooks.validateToolArgs(tool, { listId: "l1", name: "n", desc: "x".repeat(16385) }),
    Error,
    "desc exceeds maximum length",
  );
});
