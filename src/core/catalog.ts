/**
 * Every key the plugin offers, in one table. The manifest (scripts/make-manifest.mjs),
 * the action-list icons (scripts/make-icons.mjs) and the runtime (actions/keys.ts)
 * are all built from it, so nothing can drift.
 *
 * One action per command rather than a key with a dropdown: on a deck you drag
 * the thing you want, and the inspector is only for what genuinely varies.
 */

import type { Action } from "./model.ts";
import type { GlyphId } from "../render/glyphs.ts";
import type { GitAction } from "../rpc.ts";
import type { AccentId } from "../render/theme.ts";

export const PLUGIN_UUID = "com.t3code.controller";

export type KeyBehaviour =
  /** Fires `action`; dimmed when there is no selected thread. */
  | "command"
  /** Fires `action`; amber with a count when approvals are waiting. */
  | "approve"
  /** Fires `action`; dimmed when nothing is waiting. */
  | "deny"
  | "gate-next"
  | "gate-prev"
  | "thread-next"
  | "thread-prev"
  /** Draws the selected thread. Press = refresh. */
  | "thread-show"
  /** Fires `action`; dimmed unless the selected thread is running. */
  | "interrupt"
  /** Fires `action`; lit when it is the selected thread's current mode. */
  | "mode"
  /** Fires `action` with the key's own `text` setting. */
  | "prompt"
  /** Draws link state. Press = refresh. */
  | "link"
  /** Draws whatever is waiting on a person; press selects it. */
  | "attention"
  /** Runs a git action in the selected thread's worktree; dims while one runs. */
  | "git";

export type KeyDef = {
  id: string;
  name: string;
  label: string;
  glyph: GlyphId;
  accent: AccentId;
  tooltip: string;
  behaviour: KeyBehaviour;
  action?: Action;
  git?: GitAction;
};

export const uuidOf = (id: string): string => `${PLUGIN_UUID}.${id}`;

export const KEYS: readonly KeyDef[] = [
  { id: "link", name: "Link", label: "link", glyph: "link", accent: "link", behaviour: "link",
    tooltip: "Is T3 Code reachable, and how many approvals are waiting. Press to refresh." },
  { id: "attention", name: "Attention", label: "all clear", glyph: "bell", accent: "alert", behaviour: "attention",
    tooltip: "Shows the thread waiting on you. Press to select it, so Approve / Deny and the thread keys point at it." },

  { id: "git.commit", name: "Git · Commit", label: "commit", glyph: "commit", accent: "git", behaviour: "git", git: "commit",
    tooltip: "Commit the selected thread's working tree; T3 Code writes the message." },
  { id: "git.push", name: "Git · Publish", label: "publish", glyph: "push", accent: "git", behaviour: "git", git: "push",
    tooltip: "Push the selected thread's branch, setting upstream if needed." },
  { id: "git.pr", name: "Git · Pull request", label: "pull req", glyph: "pr", accent: "git", behaviour: "git", git: "create_pr",
    tooltip: "Open a pull request for the selected thread's branch (or open the existing one)." },

  { id: "thread.show", name: "Thread · Current", label: "thread", glyph: "thread", accent: "thread", behaviour: "thread-show",
    tooltip: "The selected thread: title and status. Press to refresh." },
  { id: "thread.prev", name: "Thread · Previous", label: "prev", glyph: "prev", accent: "thread", behaviour: "thread-prev",
    tooltip: "Select the previous active thread." },
  { id: "thread.next", name: "Thread · Next", label: "next", glyph: "next", accent: "thread", behaviour: "thread-next",
    tooltip: "Select the next active thread." },
  { id: "thread.stop", name: "Thread · Interrupt", label: "interrupt", glyph: "stop", accent: "stop", behaviour: "interrupt",
    tooltip: "Interrupt the selected thread's running turn.", action: { kind: "interrupt" } },
  { id: "thread.settle", name: "Thread · Settle", label: "settle", glyph: "settle", accent: "go", behaviour: "command",
    tooltip: "Mark the selected thread done.", action: { kind: "settle" } },
  { id: "thread.say", name: "Thread · Prompt", label: "prompt", glyph: "prompt", accent: "thread", behaviour: "prompt",
    tooltip: "Send this key's text to the selected thread (set it in the inspector; default \"Continue.\").",
    action: { kind: "prompt", text: "Continue." } },

  { id: "gate.approve", name: "Gate · Approve", label: "approve", glyph: "approve", accent: "go", behaviour: "approve",
    tooltip: "Approve the selected pending tool call.", action: { kind: "approve" } },
  { id: "gate.deny", name: "Gate · Deny", label: "deny", glyph: "deny", accent: "stop", behaviour: "deny",
    tooltip: "Decline the selected pending tool call.", action: { kind: "deny" } },
  { id: "gate.prev", name: "Gate · Previous", label: "prev gate", glyph: "prev", accent: "alert", behaviour: "gate-prev",
    tooltip: "Select the previous pending approval." },
  { id: "gate.next", name: "Gate · Next", label: "next gate", glyph: "next", accent: "alert", behaviour: "gate-next",
    tooltip: "Select the next pending approval." },

  { id: "mode.supervised", name: "Mode · Supervised", label: "supervised", glyph: "shield", accent: "mode", behaviour: "mode",
    tooltip: "Ask before commands and file changes.", action: { kind: "mode", mode: "approval-required" } },
  { id: "mode.autoedits", name: "Mode · Auto-accept edits", label: "auto edits", glyph: "edit", accent: "mode", behaviour: "mode",
    tooltip: "Auto-approve edits, ask before other actions.", action: { kind: "mode", mode: "auto-accept-edits" } },
  { id: "mode.auto", name: "Mode · Auto", label: "auto", glyph: "bolt", accent: "mode", behaviour: "mode",
    tooltip: "Routine actions proceed; risky ones still ask.", action: { kind: "mode", mode: "auto" } },
  { id: "mode.full", name: "Mode · Full access", label: "full access", glyph: "unlock", accent: "mode", behaviour: "mode",
    tooltip: "No prompts. Use in a worktree you can throw away.", action: { kind: "mode", mode: "full-access" } },
];

const ids = new Set<string>();
for (const k of KEYS) {
  if (ids.has(k.id)) throw new Error(`duplicate key id ${k.id}`);
  ids.add(k.id);
}
