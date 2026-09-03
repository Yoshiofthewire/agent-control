/**
 * The shared brain behind every key: one T3 client, one DeckState, one poll.
 * Keys translate presses into Actions or selection nudges and call in here;
 * this holds the live state and notifies them back to repaint.
 */

import { randomUUID } from "node:crypto";

import { T3Client } from "./client.ts";
import { pendingApprovals } from "./core/approvals.ts";
import { planCommand } from "./core/dispatch.ts";
import type { Action } from "./core/model.ts";
import {
  type DeckState,
  type Gate,
  attend,
  emptyState,
  selectGate,
  selectThread,
  selectedThread,
  setGates,
  setThreads,
  threadCwd,
} from "./core/state.ts";
import { type GitAction, type GitOutcome, runGitAction } from "./rpc.ts";
import type { Session } from "./session.ts";

export type Listener = () => void;

/**
 * ponytail: the shell snapshot is ~400 KB with a few hundred threads and is
 * re-read whole every tick; on loopback that is milliseconds. Upgrade path is
 * the `orchestration.subscribeShell` WebSocket stream (Effect RPC framing).
 */
export const DEFAULT_POLL_MS = 3000;

export interface T3Api {
  shell(): ReturnType<T3Client["shell"]>;
  activities(threadId: string): ReturnType<T3Client["activities"]>;
  dispatch(cmd: Record<string, unknown>): Promise<boolean>;
}

export class DeckService {
  private api: T3Api | null = null;
  private deck: DeckState = emptyState();
  private reachable = false;
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;

  private session: Session | null = null;

  configure(session: Session | null): void {
    const live = this.timer !== null;
    const ms = this.pollMs;
    this.stop();
    this.session = session;
    this.api = session ? new T3Client(session) : null;
    if (!session) {
      this.reachable = false;
      this.deck = emptyState();
      this.notify();
    }
    if (live) this.start(ms);
  }

  setApi(api: T3Api): void {
    this.api = api;
  }

  state(): DeckState {
    return this.deck;
  }

  isConnected(): boolean {
    return this.reachable;
  }

  isPaired(): boolean {
    return this.api !== null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* one bad listener must not stop the rest */
      }
    }
  }

  async run(action: Action): Promise<boolean> {
    const cmd = planCommand(action, this.deck, { uuid: randomUUID, now: () => new Date().toISOString() });
    if (!cmd || !this.api) return false;
    const ok = await this.api.dispatch(cmd);
    await this.refresh();
    return ok;
  }

  selectThread(delta: number): void {
    this.deck = selectThread(this.deck, delta);
    this.notify();
  }

  selectGate(delta: number): void {
    this.deck = selectGate(this.deck, delta);
    this.notify();
  }

  /** Point the deck at whatever is waiting on a person. */
  attend(): void {
    this.deck = attend(this.deck);
    this.notify();
  }

  /** Whether a git action is in flight — one at a time, the keys dim meanwhile. */
  gitBusy: GitAction | null = null;

  async runGit(action: GitAction): Promise<GitOutcome> {
    const t = selectedThread(this.deck);
    const cwd = t ? threadCwd(this.deck, t) : null;
    if (!this.session || !cwd) return { ok: false, message: "no thread selected" };
    if (this.gitBusy) return { ok: false, message: `${this.gitBusy} still running` };
    this.gitBusy = action;
    this.notify();
    try {
      return await runGitAction(this.session, { cwd, action, actionId: randomUUID() });
    } finally {
      this.gitBusy = null;
      this.notify();
    }
  }

  /** One poll at a time; a tick that finds one running is dropped, not queued. */
  async refresh(): Promise<void> {
    if (!this.api || this.inFlight) return;
    this.inFlight = true;
    try {
      const snap = await this.api.shell();
      // A failed poll greys the deck but leaves the lists standing: "we lost the
      // server" and "everything was resolved" are different things to say.
      this.reachable = snap !== null;
      if (snap !== null) {
        this.deck = setThreads(this.deck, snap.threads, snap.projects);
        const gates: Gate[] = [];
        for (const t of snap.threads) {
          if (t.archivedAt !== null || !t.hasPendingApprovals) continue;
          const acts = await this.api.activities(t.id);
          if (acts) gates.push(...pendingApprovals(t.id, acts));
        }
        this.deck = setGates(this.deck, gates);
      }
    } finally {
      this.inFlight = false;
      this.notify();
    }
  }

  private pollMs = DEFAULT_POLL_MS;

  start(pollMs: number = DEFAULT_POLL_MS): void {
    if (!this.api || this.timer !== null) return;
    this.pollMs = pollMs;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), pollMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}

export const service = new DeckService();
