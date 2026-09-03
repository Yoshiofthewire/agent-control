import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { WebSocketServer } from "ws";

import { runGitAction, summarizeGitEvents } from "../src/rpc.ts";

test("summarize: finished result → one line; failed → its message", () => {
  assert.deepEqual(
    summarizeGitEvents([
      { kind: "action_started" },
      { kind: "action_finished", result: { commit: { status: "committed", commitSha: "abcdef1234" }, push: { status: "pushed", branch: "feat" }, pr: { status: "created", url: "https://x/pr/1" } } },
    ]),
    { ok: true, message: "commit abcdef1 · pushed feat · https://x/pr/1" },
  );
  assert.deepEqual(summarizeGitEvents([{ kind: "action_finished", result: { commit: { status: "skipped_no_changes" }, push: {}, pr: {} } }]), { ok: true, message: "no changes" });
  assert.deepEqual(summarizeGitEvents([{ kind: "action_failed", message: "nothing to push" }]), { ok: false, message: "nothing to push" });
  assert.equal(summarizeGitEvents([]).ok, false);
});

test("runGitAction: ticket, request, ack each chunk, exit", { timeout: 10_000 }, async () => {
  const http = createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer TOK");
    assert.equal(req.url, "/api/auth/websocket-ticket");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ticket: "TICKET", expiresAt: "" }));
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (http.address() as AddressInfo).port;
  const received: unknown[] = [];
  const wss = new WebSocketServer({ server: http, path: "/ws" });
  wss.on("connection", (ws, req) => {
    assert.equal(new URL(req.url!, "http://x").searchParams.get("wsTicket"), "TICKET");
    ws.on("message", (raw) => {
      const m = JSON.parse(String(raw));
      received.push(m);
      if (m._tag === "Request") {
        assert.equal(m.tag, "git.runStackedAction");
        ws.send(JSON.stringify({ _tag: "Chunk", requestId: m.id, values: [{ kind: "action_started", phases: ["commit"] }] }));
      } else if (m._tag === "Ack" && received.filter((x: any) => x._tag === "Ack").length === 1) {
        ws.send(JSON.stringify([{ _tag: "Chunk", requestId: "1", values: [{ kind: "action_finished", result: { commit: { status: "committed", commitSha: "1234567890" }, push: {}, pr: {} } }] }]));
      } else if (m._tag === "Ack") {
        ws.send(JSON.stringify({ _tag: "Exit", requestId: "1", exit: { _tag: "Success", value: undefined } }));
      }
    });
  });
  try {
    const out = await runGitAction({ origin: `http://127.0.0.1:${port}`, accessToken: "TOK", expiresAt: "" }, { cwd: "/repo", action: "commit", actionId: "a1" });
    assert.deepEqual(out, { ok: true, message: "commit 1234567" });
    assert.deepEqual((received[0] as any).payload, { cwd: "/repo", action: "commit", actionId: "a1" });
    assert.equal(received.filter((x: any) => x._tag === "Ack").length, 2);
  } finally {
    wss.close();
    http.close();
  }
});

test("runGitAction: failure exit carries the error detail", { timeout: 10_000 }, async () => {
  const http = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ticket: "T" }));
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (http.address() as AddressInfo).port;
  const wss = new WebSocketServer({ server: http, path: "/ws" });
  wss.on("connection", (ws) =>
    ws.on("message", () =>
      ws.send(JSON.stringify({ _tag: "Exit", requestId: "1", exit: { _tag: "Failure", cause: [{ _tag: "Fail", error: { _tag: "GitManagerServiceError", detail: "not a git repo" } }] } })),
    ),
  );
  try {
    const out = await runGitAction({ origin: `http://127.0.0.1:${port}`, accessToken: "T", expiresAt: "" }, { cwd: "/x", action: "push", actionId: "a" });
    assert.deepEqual(out, { ok: false, message: "not a git repo" });
  } finally {
    wss.close();
    http.close();
  }
});
