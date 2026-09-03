/**
 * Graphite ground, T3-pink primary. Fixed rather than following the app's
 * theme: a deck sits in peripheral vision and should not restyle itself.
 */

export const BG = "#0b0b0f";
export const BG2 = "#16161d";
export const BG3 = "#26262f";
export const TEXT = "#f5f3ff";
export const TEXT_DIM = "#a1a1aa";
export const PRIMARY = "#f472b6";

/** Per-group accents: the hue carries the group, the label the specifics. */
export const ACCENTS = {
  /** Thread navigation and control. */
  thread: PRIMARY,
  /** Permission modes. */
  mode: "#60a5fa",
  /** Yes. */
  go: "#34d399",
  /** No / stop. */
  stop: "#fb7185",
  /** Something is waiting on you. */
  alert: "#fbbf24",
  /** The link key. */
  link: "#a78bfa",
  /** Git actions. */
  git: "#f97316",
  /** Nothing is reaching the server. */
  dead: "#52525b",
} as const;

export type AccentId = keyof typeof ACCENTS;
