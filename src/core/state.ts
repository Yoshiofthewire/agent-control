/**
 * What the deck knows: the active threads, the pending approvals, and which of
 * each is selected. Pure reducers; the service owns the instance.
 *
 * Selection follows identity, not index: when a poll re-reads the lists and an
 * earlier entry has gone, the selection stays on the thing it was on rather
 * than sliding onto its neighbour — approve must never land on the wrong call.
 */

import type { RuntimeMode } from "./model.ts";

/** The subset of T3's OrchestrationThreadShell the deck reads. */
export type ThreadShell = {
  id: string;
  projectId: string;
  title: string;
  runtimeMode: RuntimeMode;
  interactionMode: "default" | "plan";
  worktreePath: string | null;
  updatedAt: string;
  archivedAt: string | null;
  settledAt: string | null;
  hasPendingApprovals: boolean;
  hasPendingUserInput: boolean;
  session: { status: string; activeTurnId: string | null } | null;
  latestTurn: { state: string } | null;
};

export type Gate = {
  threadId: string;
  requestId: string;
  summary: string;
};

export type ProjectShell = { id: string; workspaceRoot: string };

export type DeckState = {
  projects: ProjectShell[];
  threads: ThreadShell[];
  selectedThread: string | null;
  gates: Gate[];
  selectedGate: string | null;
};

export const emptyState = (): DeckState => ({
  projects: [],
  threads: [],
  selectedThread: null,
  gates: [],
  selectedGate: null,
});

/** Where git runs for a thread: its worktree, else the project root. */
export function threadCwd(s: DeckState, t: ThreadShell): string | null {
  return t.worktreePath ?? s.projects.find((p) => p.id === t.projectId)?.workspaceRoot ?? null;
}

/** Threads waiting on a person, in list order. */
export const waitingThreads = (s: DeckState): ThreadShell[] =>
  s.threads.filter((t) => t.hasPendingApprovals || t.hasPendingUserInput);

/** Jump the selection to the first waiting thread and its first gate. */
export function attend(s: DeckState): DeckState {
  const t = waitingThreads(s)[0];
  if (!t) return s;
  const g = s.gates.find((g) => g.threadId === t.id);
  return { ...s, selectedThread: t.id, selectedGate: g ? g.requestId : s.selectedGate };
}

/** Unsettled, unarchived threads, newest activity first — the sidebar's inbox. */
export function activeThreads(all: ThreadShell[]): ThreadShell[] {
  return all
    .filter((t) => t.archivedAt === null && t.settledAt === null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export type ThreadStatus = "waiting" | "running" | "error" | "ready";

export function threadStatus(t: ThreadShell): ThreadStatus {
  if (t.hasPendingApprovals || t.hasPendingUserInput) return "waiting";
  if (t.session?.status === "running" || t.latestTurn?.state === "running") return "running";
  if (t.session?.status === "error" || t.latestTurn?.state === "error") return "error";
  return "ready";
}

export const isRunning = (t: ThreadShell): boolean => threadStatus(t) === "running";

export function selectedThread(s: DeckState): ThreadShell | null {
  return s.threads.find((t) => t.id === s.selectedThread) ?? null;
}

export function selectedGate(s: DeckState): Gate | null {
  return s.gates.find((g) => g.requestId === s.selectedGate) ?? null;
}

export function setThreads(s: DeckState, all: ThreadShell[], projects: ProjectShell[] = s.projects): DeckState {
  const threads = activeThreads(all);
  const keep = threads.some((t) => t.id === s.selectedThread);
  return { ...s, projects, threads, selectedThread: keep ? s.selectedThread : (threads[0]?.id ?? null) };
}

export function setGates(s: DeckState, gates: Gate[]): DeckState {
  const keep = gates.some((g) => g.requestId === s.selectedGate);
  return { ...s, gates, selectedGate: keep ? s.selectedGate : (gates[0]?.requestId ?? null) };
}

const step = <T>(items: T[], current: number, delta: number): number => {
  const n = items.length;
  if (n === 0) return -1;
  const from = current < 0 ? 0 : current;
  return (((from + delta) % n) + n) % n;
};

export function selectThread(s: DeckState, delta: number): DeckState {
  const i = step(s.threads, s.threads.findIndex((t) => t.id === s.selectedThread), delta);
  return { ...s, selectedThread: i < 0 ? null : s.threads[i]!.id };
}

export function selectGate(s: DeckState, delta: number): DeckState {
  const i = step(s.gates, s.gates.findIndex((g) => g.requestId === s.selectedGate), delta);
  return { ...s, selectedGate: i < 0 ? null : s.gates[i]!.requestId };
}

/** 1-based position of the selection, for the badge; 0 when nothing is selected. */
export const threadPosition = (s: DeckState): number =>
  s.threads.findIndex((t) => t.id === s.selectedThread) + 1;
export const gatePosition = (s: DeckState): number =>
  s.gates.findIndex((g) => g.requestId === s.selectedGate) + 1;
