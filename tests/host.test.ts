/**
 * End-to-end against the built bundle: a fake OpenDeck host (WebSocket) and a
 * fake T3 server (HTTP). Proves pairing, the settings round-trip, key paint,
 * and that Approve dispatches the right command for the pending request.
 * Needs `npm run build` first; skips (loudly) when the bundle is missing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WebSocketServer, type WebSocket } from "ws";

const PLUGIN_DIR = join(process.cwd(), "com.t3code.controller.sdPlugin");
const BUNDLE = join(PLUGIN_DIR, "bin", "plugin.js");

const thread = {
  id: "thread-1",
  projectId: "p",
  worktreePath: null,
  title: "Deck test thread",
  runtimeMode: "full-access",
  interactionMode: "default",
  updatedAt: "2026-09-03T12:00:00Z",
  archivedAt: null,
  settledAt: null,
  hasPendingApprovals: true,
  hasPendingUserInput: false,
  session: { status: "running", activeTurnId: "turn-1" },
  latestTurn: { state: "running" },
};

test("bundle pairs, paints, and approves through the fake host", { timeout: 30_000, skip: !existsSync(BUNDLE) && "run `npm run build` first" }, async () => {
  const dispatched: Record<string, unknown>[] = [];
  const t3 = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = (o: unknown, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(o));
      };
      const auth = req.headers.authorization;
      if (req.url === "/oauth/token" && req.method === "POST") {
        const form = new URLSearchParams(body);
        if (form.get("subject_token") !== "PAIRTOKEN1") return json({ code: "auth_invalid", reason: "invalid_credential" }, 401);
        assert.equal(form.get("scope"), "orchestration:read orchestration:operate");
        return json({ access_token: "SESSION1", issued_token_type: "x", token_type: "Bearer", expires_in: 3600, scope: form.get("scope") });
      }
      if (auth !== "Bearer SESSION1") return json({ code: "auth_invalid", reason: "missing_credential" }, 401);
      if (req.url === "/api/orchestration/shell") return json({ snapshotSequence: 1, projects: [{ id: "p", workspaceRoot: "/repo" }], threads: [thread], updatedAt: "" });
      if (req.url?.startsWith("/api/orchestration/threads/thread-1")) {
        return json({
          snapshotSequence: 1,
          thread: {
            ...thread,
            activities: [
              { kind: "approval.requested", summary: "Command approval requested", payload: { requestId: "req-1" }, createdAt: "2026-09-03T12:00:01Z" },
            ],
          },
        });
      }
      if (req.url === "/api/orchestration/dispatch" && req.method === "POST") {
        dispatched.push(JSON.parse(body));
        return json({ sequence: dispatched.length });
      }
      json({ code: "not_found" }, 404);
    });
  });
  await new Promise<void>((r) => t3.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(t3.address() as AddressInfo).port}`;

  const host = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((r) => host.once("listening", r));
  const hostPort = (host.address() as AddressInfo).port;
  let global: Record<string, unknown> = { pair: `${origin}/pair#token=PAIRTOKEN1` };
  const images = new Map<string, string>();
  const waiters: Array<() => void> = [];
  const changed = () => waiters.splice(0).forEach((w) => w());
  // Re-checked on every host message and on a timer: a dispatch that changes no
  // key image sends nothing over the socket.
  const until = (pred: () => boolean, what: string, ms = 10_000) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        clearInterval(tick);
        reject(new Error(`timed out waiting for ${what}`));
      }, ms);
      const check = () => {
        if (pred()) {
          clearTimeout(t);
          clearInterval(tick);
          resolve();
        } else waiters.push(check);
      };
      const tick = setInterval(check, 50);
      check();
    });

  let sock: WebSocket | null = null;
  host.on("connection", (ws) => {
    sock = ws;
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as { event: string; context?: string; payload?: Record<string, unknown> };
      if (msg.event === "getGlobalSettings") {
        ws.send(JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: global } }));
      } else if (msg.event === "setGlobalSettings") {
        global = msg.payload ?? {};
        // The host echoes the new value back, as the real one does.
        ws.send(JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: global } }));
      } else if (msg.event === "setImage" && msg.context) {
        images.set(msg.context, String(msg.payload?.image ?? ""));
      }
      changed();
    });
  });

  const cfg = mkdtempSync(join(tmpdir(), "t3deck-"));
  const info = {
    application: { font: "", language: "en", platform: "linux", platformVersion: "", version: "2.14.0" },
    colors: {},
    devicePixelRatio: 1,
    devices: [{ id: "dev-1", name: "Fake deck", size: { columns: 5, rows: 3 }, type: 0 }],
    plugin: { uuid: "com.t3code.controller", version: "0.1.0" },
  };
  const child = spawn(
    process.execPath,
    [BUNDLE, "-port", String(hostPort), "-pluginUUID", "com.t3code.controller", "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)],
    { cwd: PLUGIN_DIR, env: { ...process.env, XDG_CONFIG_HOME: cfg, T3DECK_POLL_MS: "300" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c));
  child.stdout.on("data", (c) => (stderr += c));

  try {
    await until(() => sock !== null, "plugin to connect");
    // Pairing: the token is spent and blanked, the session is on disk (0600).
    await until(() => global.pair === "" && String(global.status).startsWith("Linked to"), `pairing (status=${String(global.status)})`);
    const session = JSON.parse(readFileSync(join(cfg, "t3code-streamdeck", "session.json"), "utf8"));
    assert.equal(session.accessToken, "SESSION1");
    assert.equal(session.origin, origin);

    const appear = (action: string, context: string) =>
      sock!.send(
        JSON.stringify({
          event: "willAppear",
          action,
          context,
          device: "dev-1",
          payload: { settings: {}, coordinates: { column: 0, row: 0 }, controller: "Keypad", isInMultiAction: false },
        }),
      );
    appear("com.t3code.controller.gate.approve", "ctx-approve");
    appear("com.t3code.controller.thread.show", "ctx-thread");
    // The approve key goes amber with a count once the poll finds the request.
    const amber = Buffer.from("#fbbf24").toString("base64").slice(0, 6);
    await until(() => (images.get("ctx-approve") ?? "").length > 0 && Buffer.from(images.get("ctx-approve")!.split(",")[1]!, "base64").toString().includes("#fbbf24"), `approve key to light (${amber})`);
    const threadSvg = Buffer.from((images.get("ctx-thread") ?? ",").split(",")[1]!, "base64").toString();
    assert.ok(threadSvg.includes("Deck test") && threadSvg.includes("WAITING"), "thread key shows title and status");

    sock!.send(
      JSON.stringify({
        event: "keyDown",
        action: "com.t3code.controller.gate.approve",
        context: "ctx-approve",
        device: "dev-1",
        payload: { settings: {}, coordinates: { column: 0, row: 0 }, isInMultiAction: false },
      }),
    );
    await until(() => dispatched.length > 0, "dispatch");
    const cmd = dispatched[0]!;
    assert.equal(cmd.type, "thread.approval.respond");
    assert.equal(cmd.threadId, "thread-1");
    assert.equal(cmd.requestId, "req-1");
    assert.equal(cmd.decision, "accept");
    assert.match(String(cmd.commandId), /^[0-9a-f-]{36}$/);
  } catch (e) {
    throw new Error(`${(e as Error).message}\nplugin output:\n${stderr}`);
  } finally {
    child.kill();
    host.close();
    t3.close();
    rmSync(cfg, { recursive: true, force: true });
  }
});
