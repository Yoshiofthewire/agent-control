/**
 * Turn an Action into the T3 orchestration command that carries it out, or
 * null when there is nothing to act on. Pure: the whole action → command table
 * is a unit test. Shapes follow packages/contracts/src/orchestration.ts
 * (ClientOrchestrationCommand) in pingdotgg/t3code.
 */

import type { Action } from "./model.ts";
import { type DeckState, selectedGate, selectedThread } from "./state.ts";

export type Command = Record<string, unknown>;

export type Ids = { uuid: () => string; now: () => string };

export function planCommand(action: Action, s: DeckState, ids: Ids): Command | null {
  const t = selectedThread(s);
  const base = () => ({ commandId: ids.uuid(), createdAt: ids.now() });
  switch (action.kind) {
    case "approve":
    case "deny": {
      const g = selectedGate(s);
      if (!g) return null;
      return {
        type: "thread.approval.respond",
        ...base(),
        threadId: g.threadId,
        requestId: g.requestId,
        decision: action.kind === "approve" ? "accept" : "decline",
      };
    }
    case "interrupt":
      return t ? { type: "thread.turn.interrupt", ...base(), threadId: t.id } : null;
    case "settle":
      return t ? { type: "thread.settle", commandId: ids.uuid(), threadId: t.id } : null;
    case "mode":
      return t ? { type: "thread.runtime-mode.set", ...base(), threadId: t.id, runtimeMode: action.mode } : null;
    case "prompt": {
      const text = action.text.trim();
      if (!t || text.length === 0) return null;
      return {
        type: "thread.turn.start",
        ...base(),
        threadId: t.id,
        message: { messageId: ids.uuid(), role: "user", text, attachments: [] },
        runtimeMode: t.runtimeMode,
        interactionMode: t.interactionMode,
      };
    }
  }
}
