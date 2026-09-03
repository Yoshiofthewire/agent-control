/**
 * Key glyphs as line art on a 24×24 grid. Each takes its colour as an argument:
 * `currentColor` is what a minimal SVG rasteriser is most likely to skip.
 */

export type Glyph = (c: string) => string;

const S = (c: string, width = 1.8): string =>
  `fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

const dot = (c: string, x: number, y: number, r = 2): string => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;

export const GLYPHS = {
  /** Signal strength — the link to T3 Code. */
  link: (c) =>
    `<path ${S(c)} d="M3.5 10a12 12 0 0 1 17 0M6.8 13.2a7.4 7.4 0 0 1 10.4 0"/>${dot(c, 12, 17.5, 2.2)}`,
  /** A conversation. */
  thread: (c) =>
    `<path ${S(c)} d="M4 5h16v11H9l-5 4z"/>${dot(c, 9, 10.5, 1.3)}${dot(c, 12.5, 10.5, 1.3)}${dot(c, 16, 10.5, 1.3)}`,
  next: (c) => `<path ${S(c, 2.2)} d="M9 4l8 8-8 8"/>`,
  prev: (c) => `<path ${S(c, 2.2)} d="M15 4l-8 8 8 8"/>`,
  /** A stop square. */
  stop: (c) => `<rect x="5.5" y="5.5" width="13" height="13" rx="2" ${S(c, 2.2)}/>`,
  /** A check in a circle — done. */
  settle: (c) => `<path ${S(c)} d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18"/><path ${S(c, 2.2)} d="M8 12.5l2.7 2.7L16.5 9"/>`,
  /** A send arrow. */
  prompt: (c) => `<path ${S(c)} d="M3.5 11.5 20.5 4l-4 16-4.5-6.5zM12 13.5l8.5-9.5"/>`,
  approve: (c) => `<path ${S(c, 2.4)} d="M4 12.5 9.5 18 20 6"/>`,
  deny: (c) => `<path ${S(c, 2.4)} d="M6 6l12 12M18 6 6 18"/>`,
  /** A shield — supervised. */
  shield: (c) => `<path ${S(c)} d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z"/>`,
  /** A pencil — auto-accept edits. */
  edit: (c) => `<path ${S(c)} d="M4 20l4.2-1 10.6-10.6a1.8 1.8 0 0 0 0-2.6l-.6-.6a1.8 1.8 0 0 0-2.6 0L5 15.8zM14.5 6.5l3 3"/>`,
  /** A bolt — auto. */
  bolt: (c) => `<path ${S(c)} d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>`,
  /** A bell — something wants you. */
  bell: (c) => `<path ${S(c)} d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>`,
  /** A commit: a node on a line. */
  commit: (c) => `<path ${S(c)} d="M2.5 12h5.5M16 12h5.5"/><path ${S(c, 2)} d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8"/>`,
  /** Push: an arrow up out of a tray. */
  push: (c) => `<path ${S(c, 2)} d="M12 16V4M7 9l5-5 5 5"/><path ${S(c)} d="M4 15v4h16v-4"/>`,
  /** A pull request: a source line arcing into a target line. */
  pr: (c) =>
    `<path ${S(c)} d="M6 7v10M18 12v5M18 8.5V7a3 3 0 0 0-3-3h-3l2-2m-2 2 2 2"/>${dot(c, 6, 5, 2)}${dot(c, 6, 19, 2)}${dot(c, 18, 19, 2)}`,
  /** An open padlock — full access. */
  unlock: (c) => `<path ${S(c)} d="M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 7.6-1.7"/>${dot(c, 12, 16, 1.6)}`,
} satisfies Record<string, Glyph>;

export type GlyphId = keyof typeof GLYPHS;
