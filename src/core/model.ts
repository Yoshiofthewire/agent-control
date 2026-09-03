/** Vocabulary shared by the keys and the command planner. SDK-free, so it is unit-testable. */

/** T3 Code's per-thread permission modes, in the order the app lists them. */
export const MODES = ["approval-required", "auto-accept-edits", "auto", "full-access"] as const;
export type RuntimeMode = (typeof MODES)[number];

export type Action =
  | { kind: "interrupt" }
  | { kind: "settle" }
  | { kind: "mode"; mode: RuntimeMode }
  | { kind: "prompt"; text: string }
  | { kind: "approve" }
  | { kind: "deny" };

export const isMode = (v: unknown): v is RuntimeMode =>
  typeof v === "string" && (MODES as readonly string[]).includes(v);
