import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type ThreadShell,
  activeThreads,
  emptyState,
  selectGate,
  selectThread,
  selectedGate,
  selectedThread,
  setGates,
  setThreads,
  threadStatus,
} from "../src/core/state.ts";

const thread = (id: string, over: Partial<ThreadShell> = {}): ThreadShell => ({
  id,
  projectId: "p",
  worktreePath: null,
  title: id,
  runtimeMode: "full-access",
  interactionMode: "default",
  updatedAt: "2026-09-03T10:00:00Z",
  archivedAt: null,
  settledAt: null,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  session: null,
  latestTurn: null,
  ...over,
});

test("active threads drop settled/archived and sort newest first", () => {
  const all = [
    thread("old", { updatedAt: "2026-09-01T00:00:00Z" }),
    thread("settled", { settledAt: "2026-09-02T00:00:00Z" }),
    thread("archived", { archivedAt: "2026-09-02T00:00:00Z" }),
    thread("new", { updatedAt: "2026-09-03T00:00:00Z" }),
  ];
  assert.deepEqual(activeThreads(all).map((t) => t.id), ["new", "old"]);
});

test("thread selection defaults to newest and follows the id across polls", () => {
  let s = setThreads(emptyState(), [thread("a", { updatedAt: "2" }), thread("b", { updatedAt: "1" })]);
  assert.equal(selectedThread(s)?.id, "a");
  s = selectThread(s, 1);
  assert.equal(selectedThread(s)?.id, "b");
  // b jumps to the top; the selection stays on b, not on index 1.
  s = setThreads(s, [thread("a", { updatedAt: "2" }), thread("b", { updatedAt: "3" })]);
  assert.equal(selectedThread(s)?.id, "b");
  // b disappears; fall back to the first.
  s = setThreads(s, [thread("a", { updatedAt: "2" })]);
  assert.equal(selectedThread(s)?.id, "a");
  s = setThreads(s, []);
  assert.equal(selectedThread(s), null);
  assert.equal(selectThread(s, 1).selectedThread, null);
});

test("selection wraps in both directions", () => {
  let s = setThreads(emptyState(), [thread("a", { updatedAt: "3" }), thread("b", { updatedAt: "2" }), thread("c", { updatedAt: "1" })]);
  s = selectThread(s, -1);
  assert.equal(s.selectedThread, "c");
  s = selectThread(s, 1);
  assert.equal(s.selectedThread, "a");
});

test("gate selection follows requestId", () => {
  const g = (r: string) => ({ threadId: "t", requestId: r, summary: r });
  let s = setGates(emptyState(), [g("x"), g("y")]);
  s = selectGate(s, 1);
  assert.equal(selectedGate(s)?.requestId, "y");
  s = setGates(s, [g("y"), g("z")]);
  assert.equal(selectedGate(s)?.requestId, "y");
  s = setGates(s, [g("z")]);
  assert.equal(selectedGate(s)?.requestId, "z");
  s = setGates(s, []);
  assert.equal(selectedGate(s), null);
});

test("thread status precedence: waiting > running > error > ready", () => {
  assert.equal(threadStatus(thread("a", { hasPendingApprovals: true, session: { status: "running", activeTurnId: "t" } })), "waiting");
  assert.equal(threadStatus(thread("a", { session: { status: "running", activeTurnId: "t" } })), "running");
  assert.equal(threadStatus(thread("a", { latestTurn: { state: "running" } })), "running");
  assert.equal(threadStatus(thread("a", { session: { status: "error", activeTurnId: null } })), "error");
  assert.equal(threadStatus(thread("a", { session: { status: "stopped", activeTurnId: null }, latestTurn: { state: "completed" } })), "ready");
});

test("threadCwd prefers the worktree, then the project root", async () => {
  const { attend, threadCwd, waitingThreads } = await import("../src/core/state.ts");
  let s = setThreads(emptyState(), [thread("a", { updatedAt: "3" }), thread("w", { updatedAt: "2", hasPendingApprovals: true }), thread("x", { updatedAt: "1", hasPendingUserInput: true, worktreePath: "/wt" })], [{ id: "p", workspaceRoot: "/root" }]);
  assert.equal(threadCwd(s, s.threads[0]!), "/root");
  assert.equal(threadCwd(s, s.threads[2]!), "/wt");
  assert.deepEqual(waitingThreads(s).map((t) => t.id), ["w", "x"]);
  s = setGates(s, [{ threadId: "x", requestId: "rx", summary: "" }, { threadId: "w", requestId: "rw", summary: "" }]);
  s = attend(s);
  assert.equal(s.selectedThread, "w");
  assert.equal(s.selectedGate, "rw");
  assert.equal(attend(setThreads(emptyState(), [])).selectedThread, null);
});
