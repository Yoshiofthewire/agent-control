// Icons for OpenDeck's action list, from the same catalog and glyphs the keys
// use. SVG is the real artwork (OpenDeck prefers it); the PNG pair is the
// Elgato fallback, rasterised by hand: plate plus corner brackets only.

import { deflateSync } from "node:zlib";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { KEYS } from "../src/core/catalog.ts";
import { GLYPHS } from "../src/render/glyphs.ts";
import { ACCENTS, BG, BG2, BG3 } from "../src/render/theme.ts";

const OUT = "com.t3code.controller.sdPlugin/imgs";

function svgIcon(glyph, accent, size = 144) {
  const grid = [];
  for (let i = 18; i < size; i += 18) grid.push(`<path d="M${i} 0v${size}M0 ${i}h${size}"/>`);
  const i = 9;
  const a = 15;
  const o = size - i;
  const k = 3.4;
  const off = (24 * k) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BG2}"/><stop offset="1" stop-color="${BG}"/></linearGradient></defs>` +
    `<rect width="${size}" height="${size}" rx="16" fill="url(#p)"/>` +
    `<g stroke="${BG3}" stroke-width="1" opacity="0.45">${grid.join("")}</g>` +
    `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="15" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.4"/>` +
    `<g fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.75">` +
    `<path d="M${i} ${i + a}V${i}h${a}"/><path d="M${o - a} ${i}h${a}v${a}"/>` +
    `<path d="M${o} ${o - a}V${o}h-${a}"/><path d="M${i + a} ${o}H${i}v-${a}"/></g>` +
    `<g transform="translate(${size / 2 - off} ${size / 2 - off}) scale(${k})">${glyph(accent)}</g>` +
    `</svg>`
  );
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function png(size, accentHex) {
  const [ar, ag, ab] = hex(accentHex);
  const [br, bg, bb] = hex(BG);
  const [b2r, b2g, b2b] = hex(BG2);
  const radius = Math.floor(size * 0.11);
  const inset = Math.round(size * 0.0625);
  const arm = Math.round(size * 0.104);
  const thick = Math.max(1, Math.round(size / 72));

  const inside = (x, y) => {
    const cx = Math.min(x, size - 1 - x);
    const cy = Math.min(y, size - 1 - y);
    if (cx >= radius || cy >= radius) return true;
    const dx = radius - cx;
    const dy = radius - cy;
    return dx * dx + dy * dy <= radius * radius;
  };
  const onBracket = (x, y) => {
    const near = (v, edge) => Math.abs(v - edge) < thick;
    const lo = inset;
    const hi = size - 1 - inset;
    const inX = (x >= lo && x <= lo + arm) || (x >= hi - arm && x <= hi);
    const inY = (y >= lo && y <= lo + arm) || (y >= hi - arm && y <= hi);
    return ((near(y, lo) || near(y, hi)) && inX && inY) || ((near(x, lo) || near(x, hi)) && inY && inX);
  };

  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    const t = y / (size - 1);
    const gr = Math.round(b2r + (br - b2r) * t);
    const gg = Math.round(b2g + (bg - b2g) * t);
    const gb = Math.round(b2b + (bb - b2b) * t);
    for (let x = 0; x < size; x++) {
      const on = onBracket(x, y);
      raw[p++] = on ? ar : gr;
      raw[p++] = on ? ag : gg;
      raw[p++] = on ? ab : gb;
      raw[p++] = inside(x, y) ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(path, glyph, accent) {
  const file = (suffix) => join(OUT, `${path}${suffix}`);
  mkdirSync(dirname(file("")), { recursive: true });
  writeFileSync(file(".svg"), svgIcon(glyph, accent));
  writeFileSync(file(".png"), png(72, accent));
  writeFileSync(file("@2x.png"), png(144, accent));
}

rmSync(join(OUT, "actions"), { recursive: true, force: true });
for (const def of KEYS) write(`actions/${def.id}/icon`, GLYPHS[def.glyph], ACCENTS[def.accent]);
write("plugin/icon", GLYPHS.link, ACCENTS.thread);
write("plugin/category", GLYPHS.link, ACCENTS.thread);
console.log(`icons written to ${OUT} — ${KEYS.length} actions, svg + png`);
