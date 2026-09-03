/**
 * Key art rendered as SVG data URIs. Labels are drawn into the image because the
 * deck's own title overlay is an unstyled system font. Pure: `(state) => URI`,
 * so a broken SVG is caught by a test rather than showing up as a blank key.
 *
 * Plain on purpose for the rasteriser: solid fills, gradients, opacity,
 * `font-family="sans-serif"`. No CSS, no currentColor, no external fonts.
 */

import { GLYPHS, type GlyphId } from "./glyphs.ts";
import { ACCENTS, BG, BG2, BG3, TEXT, TEXT_DIM, type AccentId } from "./theme.ts";

/** Keys are 72px; drawn at 2× for a crisp raster. */
const SIZE = 144;

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const dataUri = (svg: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

const svgDoc = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${inner}</svg>`;

/** Average advance per character in ems for bold upper-case sans (measured). */
const EM_ADVANCE = 0.68;

/** Widest font size that keeps `text` inside `max` px. Only ever shrinks. */
export function fitFontSize(text: string, max: number, ideal: number, min: number, tracking = 1.4): number {
  const n = text.length;
  if (n === 0) return ideal;
  const gaps = Math.max(0, n - 1) * tracking;
  if (n * ideal * EM_ADVANCE + gaps <= max) return ideal;
  return Math.max(min, Math.floor((max - gaps) / (n * EM_ADVANCE)));
}

function plate(accent: string, dim: boolean): string {
  const grid: string[] = [];
  for (let i = 18; i < SIZE; i += 18) grid.push(`<path d="M${i} 0v${SIZE}M0 ${i}h${SIZE}"/>`);
  return (
    `<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${BG2}"/><stop offset="1" stop-color="${BG}"/>` +
    `</linearGradient></defs>` +
    `<rect width="${SIZE}" height="${SIZE}" rx="16" fill="url(#p)"/>` +
    `<g stroke="${BG3}" stroke-width="1" opacity="${dim ? 0.25 : 0.45}">${grid.join("")}</g>` +
    `<rect width="${SIZE}" height="56" rx="16" fill="${accent}" opacity="${dim ? 0.04 : 0.09}"/>` +
    `<rect x="1" y="1" width="${SIZE - 2}" height="${SIZE - 2}" rx="15" fill="none" stroke="${accent}" stroke-width="1.5" opacity="${dim ? 0.2 : 0.4}"/>`
  );
}

function brackets(accent: string, dim: boolean): string {
  const i = 9;
  const a = 15;
  const o = SIZE - i;
  return (
    `<g fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="${dim ? 0.3 : 0.75}">` +
    `<path d="M${i} ${i + a}V${i}h${a}"/>` +
    `<path d="M${o - a} ${i}h${a}v${a}"/>` +
    `<path d="M${o} ${o - a}V${o}h-${a}"/>` +
    `<path d="M${i + a} ${o}H${i}v-${a}"/>` +
    `</g>`
  );
}

function caption(text: string, accent: string, dim: boolean): string {
  const label = text.toUpperCase();
  const size = fitFontSize(label, 100, 15, 9);
  return (
    `<path d="M22 108h100" stroke="${accent}" stroke-width="1" opacity="${dim ? 0.25 : 0.5}"/>` +
    `<text x="72" y="129" text-anchor="middle" font-family="sans-serif" font-size="${size}"` +
    ` font-weight="bold" letter-spacing="1.4" fill="${dim ? TEXT_DIM : TEXT}"` +
    `${dim ? ' opacity="0.6"' : ""}>${esc(label)}</text>`
  );
}

function badge(count: number, accent: string): string {
  const text = count > 99 ? "99+" : String(count);
  const w = Math.max(26, 13 + text.length * 11);
  return (
    `<rect x="${SIZE - 10 - w}" y="8" width="${w}" height="26" rx="13" fill="${accent}"/>` +
    `<text x="${SIZE - 10 - w / 2}" y="27" text-anchor="middle" font-family="sans-serif"` +
    ` font-size="17" font-weight="bold" fill="${BG}">${esc(text)}</text>`
  );
}

export type KeyArt = {
  label: string;
  glyph: GlyphId;
  accent: AccentId;
  /** Nothing is reaching T3 Code, or the key has nothing to act on. */
  offline?: boolean;
  /** Shown top-right when > 0. */
  count?: number;
  /** e.g. the approve key going amber when work lands, the active mode going green. */
  accentOverride?: string;
};

export function keySvg(art: KeyArt): string {
  const dim = art.offline === true;
  const accent = dim ? ACCENTS.dead : (art.accentOverride ?? ACCENTS[art.accent]);
  const k = 2.1;
  const off = (24 * k) / 2;
  return svgDoc(
    plate(accent, dim) +
      brackets(accent, dim) +
      `<g transform="translate(${72 - off} ${58 - off}) scale(${k})"${dim ? ' opacity="0.55"' : ""}>${GLYPHS[art.glyph](accent)}</g>` +
      caption(art.label, accent, dim) +
      (art.count && art.count > 0 ? badge(art.count, accent) : ""),
  );
}

/** Break a title into at most `lines` lines of about `width` characters. */
export function wrapTitle(title: string, width = 13, lines = 3): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of title.split(/\s+/).filter(Boolean)) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else {
      out.push(line);
      line = word;
    }
    if (out.length === lines) break;
  }
  if (out.length < lines && line) out.push(line);
  if (out.length === lines && title.length > out.join(" ").length) {
    out[lines - 1] = out[lines - 1]!.slice(0, width - 1) + "…";
  }
  return out.map((l) => (l.length > width ? l.slice(0, width - 1) + "…" : l));
}

export type ThreadArt = {
  title: string;
  status: string;
  accent: string;
  offline?: boolean;
  /** "2/5" — where the selection sits in the active list. */
  position?: string;
};

/** The current-thread key: the title over its status, position top-right. */
export function threadSvg(art: ThreadArt): string {
  const dim = art.offline === true;
  const accent = dim ? ACCENTS.dead : art.accent;
  const lines = wrapTitle(art.title);
  const text = lines
    .map(
      (l, i) =>
        `<text x="16" y="${44 + i * 20}" font-family="sans-serif" font-size="16" font-weight="bold"` +
        ` fill="${dim ? TEXT_DIM : TEXT}">${esc(l)}</text>`,
    )
    .join("");
  const pos = art.position
    ? `<text x="130" y="21" text-anchor="end" font-family="sans-serif" font-size="11" fill="${TEXT_DIM}" opacity="0.8">${esc(art.position)}</text>`
    : "";
  return svgDoc(plate(accent, dim) + brackets(accent, dim) + pos + text + caption(art.status, accent, dim));
}

/** The link key: reachable or not, and how many approvals are waiting. */
export function linkSvg(connected: boolean, waiting: number): string {
  const accent = !connected ? ACCENTS.dead : waiting > 0 ? ACCENTS.alert : ACCENTS.go;
  return svgDoc(
    plate(accent, !connected) +
      brackets(accent, !connected) +
      `<g transform="translate(47 33) scale(2.1)"${!connected ? ' opacity="0.55"' : ""}>${GLYPHS.link(accent)}</g>` +
      caption(connected ? (waiting > 0 ? "waiting" : "linked") : "offline", accent, !connected) +
      (waiting > 0 && connected ? badge(waiting, accent) : ""),
  );
}

export const keyImage = (art: KeyArt): string => dataUri(keySvg(art));
export const threadImage = (art: ThreadArt): string => dataUri(threadSvg(art));
export const linkImage = (connected: boolean, waiting: number): string => dataUri(linkSvg(connected, waiting));
