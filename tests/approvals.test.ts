import { test } from "node:test";
import assert from "node:assert/strict";

import { pendingApprovals } from "../src/core/approvals.ts";

const act = (kind: string, requestId: string | null, createdAt: string, summary = kind) => ({
  kind,
  summary,
  payload: requestId === null ? { detail: "x" } : { requestId },
  createdAt,
});

test("a requested approval with no resolution is pending", () => {
  const gates = pendingApprovals("t1", [
    act("tool.started", null, "1"),
    act("approval.requested", "r1", "2", "Command approval requested"),
  ]);
  assert.deepEqual(gates, [{ threadId: "t1", requestId: "r1", summary: "Command approval requested" }]);
});

test("resolution closes it, even when the log arrives out of order", () => {
  const gates = pendingApprovals("t1", [
    act("approval.resolved", "r1", "3"),
    act("approval.requested", "r1", "2"),
    act("approval.requested", "r2", "4"),
  ]);
  assert.deepEqual(gates.map((g) => g.requestId), ["r2"]);
});

test("user-input questions and payloads without requestId are ignored", () => {
  assert.deepEqual(pendingApprovals("t", [act("user-input.requested", "q1", "1"), act("approval.requested", null, "2")]), []);
});
