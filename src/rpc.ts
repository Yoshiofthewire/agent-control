/**
 * The one thing the deck needs from T3's WebSocket RPC: `git.runStackedAction`
 * (commit / push / create PR), which has no HTTP form. Effect RPC over JSON:
 * we send a Request, the server streams Chunk frames (each needs an Ack) and
 * finishes with an Exit. Auth is a one-shot ticket minted from the bearer session.
 *
 * ponytail: uses the global WebSocket (Node ≥ 22). On an Elgato host pinned to
 * Node 20 the git keys report "needs Node 22+" and everything else still works.
 */

import type { Session } from "./session.ts";

export const GIT_ACTIONS = ["commit", "push", "create_pr"] as const;
export type GitAction = (typeof GIT_ACTIONS)[number];

export type GitOutcome = { ok: boolean; message: string };

type Frame =
  | { _tag: "Chunk"; requestId: string; values: unknown[] }
  | { _tag: "Exit"; requestId: string; exit: { _tag: "Success"; value: unknown } | { _tag: "Failure"; cause: Array<{ _tag: string; error?: unknown; defect?: unknown }> } }
  | { _tag: "Defect"; defect: unknown }
  | { _tag: string };

const TIMEOUT_MS = 120_000;

/** Reduce the progress stream to one line for the key: sha, PR URL, or the failure. */
export function summarizeGitEvents(events: unknown[]): GitOutcome {
  let out: GitOutcome = { ok: false, message: "no result" };
  for (const e of events as Array<Record<string, any>>) {
    if (e.kind === "action_failed") return { ok: false, message: String(e.message ?? "failed") };
    if (e.kind === "action_finished") {
      const r = e.result ?? {};
      const parts = [
        r.commit?.commitSha ? `commit ${String(r.commit.commitSha).slice(0, 7)}` : r.commit?.status === "skipped_no_changes" ? "no changes" : null,
        r.push?.status === "pushed" ? `pushed ${r.push.branch ?? ""}`.trim() : null,
        r.pr?.url ? String(r.pr.url) : null,
      ].filter(Boolean);
      out = { ok: true, message: parts.join(" · ") || String(r.toast?.message ?? "done") };
    }
  }
  return out;
}

export async function runGitAction(
  session: Session,
  input: { cwd: string; action: GitAction; actionId: string },
): Promise<GitOutcome> {
  if (typeof WebSocket === "undefined") return { ok: false, message: "git keys need Node 22+" };
  let ticket: string;
  try {
    const res = await fetch(session.origin + "/api/auth/websocket-ticket", {
      method: "POST",
      headers: { authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, message: `ticket HTTP ${res.status}` };
    ticket = String(((await res.json()) as { ticket?: unknown }).ticket ?? "");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  const url = session.origin.replace(/^http/, "ws") + "/ws?wsTicket=" + encodeURIComponent(ticket);
  return new Promise<GitOutcome>((resolve) => {
    const events: unknown[] = [];
    let settled = false;
    const done = (o: GitOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* already gone */
      }
      resolve(o);
    };
    const timer = setTimeout(() => done({ ok: false, message: "timed out" }), TIMEOUT_MS);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      return done({ ok: false, message: e instanceof Error ? e.message : String(e) });
    }
    ws.onopen = () =>
      ws.send(JSON.stringify({ _tag: "Request", id: "1", tag: "git.runStackedAction", payload: input, headers: [] }));
    ws.onmessage = (ev) => {
      let frames: Frame[];
      try {
        const parsed = JSON.parse(String(ev.data));
        frames = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return;
      }
      for (const f of frames) {
        if (f._tag === "Chunk") {
          events.push(...(f as { values: unknown[] }).values);
          ws.send(JSON.stringify({ _tag: "Ack", requestId: "1" }));
        } else if (f._tag === "Exit") {
          const exit = (f as Extract<Frame, { _tag: "Exit" }>).exit;
          if (exit._tag === "Success") done(summarizeGitEvents(events));
          else {
            const c = exit.cause[0] as { error?: { message?: unknown; detail?: unknown; _tag?: unknown }; defect?: unknown } | undefined;
            done({ ok: false, message: String(c?.error?.detail ?? c?.error?.message ?? c?.error?._tag ?? c?.defect ?? "failed") });
          }
        } else if (f._tag === "Defect") {
          done({ ok: false, message: String((f as { defect: unknown }).defect) });
        }
      }
    };
    ws.onerror = () => done({ ok: false, message: "socket error" });
    ws.onclose = () => done({ ok: false, message: "socket closed" });
  });
}
