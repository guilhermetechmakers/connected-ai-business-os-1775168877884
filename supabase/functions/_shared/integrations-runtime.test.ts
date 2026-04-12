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
    "slack.update_message",
    "hubspot.create_deal",
    "quickbooks.create_invoice",
    "notion.pages.search",
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
