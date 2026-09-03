/**
 * Pending approvals from a thread's activity log.
 *
 * Mirrors the server's own rule (derivePendingApprovalCount in the t3 server
 * bundle): walk activities in creation order, `approval.requested` opens a
 * requestId, `approval.resolved` closes it. User-input questions are left out
 * on purpose — they need typed answers a key cannot give.
 *
 * ponytail: the server also closes a request on
 * `provider.approval.respond.failed` with a stale-request detail; skipped, a
 * stale gate merely fails to dispatch and disappears on the next poll.
 */

import type { Gate } from "./state.ts";

export type Activity = {
  kind: string;
  summary?: string;
  payload?: unknown;
  createdAt: string;
};

export function pendingApprovals(threadId: string, activities: Activity[]): Gate[] {
  const open = new Map<string, Gate>();
  const ordered = [...activities].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  for (const a of ordered) {
    const p = a.payload as { requestId?: unknown } | null | undefined;
    const requestId = typeof p?.requestId === "string" ? p.requestId : null;
    if (requestId === null) continue;
    if (a.kind === "approval.requested") {
      open.set(requestId, { threadId, requestId, summary: a.summary ?? "Approval requested" });
    } else if (a.kind === "approval.resolved") {
      open.delete(requestId);
    }
  }
  return [...open.values()];
}
