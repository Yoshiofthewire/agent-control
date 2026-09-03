// Build the .sdPlugin manifest's `Actions` from src/core/catalog.ts, so the
// manifest can never drift from the keys the plugin registers. Node ≥ 22.18
// strips types on import, which is what lets this read the catalog directly.

import { writeFileSync } from "node:fs";

import { KEYS, PLUGIN_UUID, uuidOf } from "../src/core/catalog.ts";

const OUT = "com.t3code.controller.sdPlugin/manifest.json";

const header = {
  $schema: "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
  Name: "T3 Code",
  UUID: PLUGIN_UUID,
  Version: "0.1.0",
  Author: "Yoshiofthewire",
  Description:
    "Drive T3 Code from a Stream Deck — approve or deny tool calls, interrupt a turn, switch the permission mode, settle a thread, fire a prompt.",
  Category: "T3 Code",
  CategoryIcon: "imgs/plugin/category",
  Icon: "imgs/plugin/icon",
  URL: "https://github.com/Yoshiofthewire/t3code-streamdeck",
  SDKVersion: 2,
  CodePath: "bin/plugin.js",
  Nodejs: { Version: "20" },
  Software: { MinimumVersion: "6.5" },
  OS: [
    { Platform: "linux", MinimumVersion: "1.0" },
    { Platform: "mac", MinimumVersion: "12" },
    { Platform: "windows", MinimumVersion: "10" },
  ],
};

const keyAction = (def) => ({
  Name: def.name,
  UUID: uuidOf(def.id),
  Icon: `imgs/actions/${def.id}/icon`,
  Tooltip: def.tooltip,
  Controllers: ["Keypad"],
  PropertyInspectorPath: "ui/settings.html",
  // Labels are drawn into the key image; the deck's own title starts empty.
  States: [{ Image: `imgs/actions/${def.id}/icon`, TitleAlignment: "middle", Title: "" }],
});

writeFileSync(OUT, JSON.stringify({ ...header, Actions: KEYS.map(keyAction) }, null, 2) + "\n");
console.log(`manifest written to ${OUT} — ${KEYS.length} keys`);
