import { test } from "node:test";
import assert from "node:assert/strict";

import { planCommand } from "../src/core/dispatch.ts";
import { type ThreadShell, emptyState, setGates, setThreads } from "../src/core/state.ts";

const ids = { uuid: () => "u", now: () => "now" };
const t: ThreadShell = {
  id: "t1",
  projectId: "p",
  worktreePath: null,
  title: "x",
  runtimeMode: "auto",
  interactionMode: "plan",
  updatedAt: "1",
  archivedAt: null,
  settledAt: null,
  hasPendingApprovals: true,
  hasPendingUserInput: false,
  session: { status: "running", activeTurnId: "turn" },
  latestTurn: { state: "running" },
};
const withThread = setThreads(emptyState(), [t]);
const withGate = setGates(withThread, [{ threadId: "t1", requestId: "r1", summary: "s" }]);

test("approve / deny respond to the selected gate", () => {
  assert.deepEqual(planCommand({ kind: "approve" }, withGate, ids), {
    type: "thread.approval.respond", commandId: "u", createdAt: "now", threadId: "t1", requestId: "r1", decision: "accept",
  });
  assert.equal(planCommand({ kind: "deny" }, withGate, ids)?.decision, "decline");
  assert.equal(planCommand({ kind: "approve" }, withThread, ids), null);
});

test("interrupt, settle and mode target the selected thread", () => {
  assert.deepEqual(planCommand({ kind: "interrupt" }, withThread, ids), {
    type: "thread.turn.interrupt", commandId: "u", createdAt: "now", threadId: "t1",
  });
  assert.deepEqual(planCommand({ kind: "settle" }, withThread, ids), { type: "thread.settle", commandId: "u", threadId: "t1" });
  assert.deepEqual(planCommand({ kind: "mode", mode: "approval-required" }, withThread, ids), {
    type: "thread.runtime-mode.set", commandId: "u", createdAt: "now", threadId: "t1", runtimeMode: "approval-required",
  });
  assert.equal(planCommand({ kind: "interrupt" }, emptyState(), ids), null);
});

test("prompt starts a turn carrying the thread's own modes", () => {
  assert.deepEqual(planCommand({ kind: "prompt", text: "  Continue.  " }, withThread, ids), {
    type: "thread.turn.start",
    commandId: "u",
    createdAt: "now",
    threadId: "t1",
    message: { messageId: "u", role: "user", text: "Continue.", attachments: [] },
    runtimeMode: "auto",
    interactionMode: "plan",
  });
  assert.equal(planCommand({ kind: "prompt", text: "   " }, withThread, ids), null);
});
