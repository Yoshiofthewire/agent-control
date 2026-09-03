// Boot the built bundle against a throwaway fake host and the REAL T3 Code
// server (whatever session is saved), then print what the Link and Thread keys
// would show. Re-run after any change to prove the deck side end to end:
//   node scripts/live-check.mjs

import { spawn } from "node:child_process";
import { join } from "node:path";

import { WebSocketServer } from "ws";

const PLUGIN_DIR = join(process.cwd(), "com.t3code.controller.sdPlugin");
const host = new WebSocketServer({ host: "127.0.0.1", port: 0 });
await new Promise((r) => host.once("listening", r));
const info = {
  application: { font: "", language: "en", platform: "linux", platformVersion: "", version: "2.14.0" },
  colors: {},
  devicePixelRatio: 1,
  devices: [{ id: "dev-1", name: "Fake deck", size: { columns: 5, rows: 3 }, type: 0 }],
  plugin: { uuid: "com.t3code.controller", version: "0.1.0" },
};
const child = spawn(
  process.execPath,
  [join(PLUGIN_DIR, "bin/plugin.js"), "-port", String(host.address().port), "-pluginUUID", "com.t3code.controller", "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)],
  { cwd: PLUGIN_DIR, env: { ...process.env, T3DECK_POLL_MS: "1000" }, stdio: ["ignore", "inherit", "inherit"] },
);

const images = new Map();
let settings = {};
host.on("connection", (ws) => {
  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.event === "getGlobalSettings") ws.send(JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings } }));
    if (msg.event === "setGlobalSettings") settings = msg.payload;
    if (msg.event === "setImage") images.set(msg.context, msg.payload.image);
  });
  for (const [action, context] of [["link", "link"], ["thread.show", "thread"], ["gate.approve", "approve"], ["mode.full", "mode"], ["attention", "attn"], ["git.commit", "commit"]]) {
    ws.send(JSON.stringify({ event: "willAppear", action: `com.t3code.controller.${action}`, context, device: "dev-1", payload: { settings: {}, coordinates: { column: 0, row: 0 }, controller: "Keypad", isInMultiAction: false } }));
  }
});

await new Promise((r) => setTimeout(r, 4000));
const text = (ctx) => {
  const img = images.get(ctx);
  if (!img) return "(no image)";
  const svg = Buffer.from(img.split(",")[1], "base64").toString();
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(" | ");
};
console.log("status :", settings.status ?? "(unchanged)");
for (const ctx of ["link", "thread", "approve", "mode", "attn", "commit"]) console.log(`${ctx.padEnd(7)}:`, text(ctx));
child.kill();
host.close();
