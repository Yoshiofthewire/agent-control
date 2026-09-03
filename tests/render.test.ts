import { test } from "node:test";
import assert from "node:assert/strict";

import { KEYS } from "../src/core/catalog.ts";
import { dataUri, keySvg, linkSvg, threadSvg, wrapTitle } from "../src/render/hud.ts";

/** Cheap well-formedness: every opened element is closed, no stray text markers. */
function assertSvg(svg: string): void {
  assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>"), "svg wrapper");
  assert.ok(!/undefined|NaN|\[object/.test(svg), "no leaked values");
  const opens = (svg.match(/<(?:svg|g|text|defs|linearGradient)\b/g) ?? []).length;
  const closes = (svg.match(/<\/(?:svg|g|text|defs|linearGradient)>/g) ?? []).length;
  assert.equal(opens, closes, "balanced container tags");
  const attrs = svg.match(/<[a-z]+\s[^>]*>/g) ?? [];
  for (const tag of attrs) {
    const names = [...tag.matchAll(/\s([a-z-]+)=/g)].map((m) => m[1]);
    assert.equal(new Set(names).size, names.length, `duplicate attribute in ${tag}`);
  }
}

test("every catalog key renders in every state", () => {
  for (const def of KEYS) {
    for (const offline of [false, true]) {
      for (const count of [0, 3, 120]) {
        const svg = keySvg({ label: def.label, glyph: def.glyph, accent: def.accent, offline, count, accentOverride: "#fbbf24" });
        assertSvg(svg);
        assert.ok(svg.includes(def.label.toUpperCase()), `label ${def.label}`);
      }
    }
  }
});

test("thread and link keys render, and titles are escaped", () => {
  const svg = threadSvg({ title: 'Fix <a> & "b" in the very long thread title here', status: "waiting", accent: "#fbbf24", position: "2/9" });
  assertSvg(svg);
  assert.ok(svg.includes("&lt;a&gt;") && !svg.includes("<a>"));
  assertSvg(threadSvg({ title: "", status: "none", accent: "#000", offline: true }));
  assertSvg(linkSvg(true, 2));
  assertSvg(linkSvg(false, 0));
  assert.ok(dataUri(svg).startsWith("data:image/svg+xml;base64,"));
});

test("wrapTitle keeps to the box", () => {
  assert.deepEqual(wrapTitle("Handoff for blocked device enrollment task"), ["Handoff for", "blocked", "device…"]);
  assert.deepEqual(wrapTitle("short"), ["short"]);
  assert.deepEqual(wrapTitle("supercalifragilisticexpialidocious"), ["supercalifra…"]);
});
