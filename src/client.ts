/**
 * Transport to the T3 Code server: global `fetch`, bearer session, 5 s timeouts.
 * Failure-tolerant — a dead server yields null, never a throw, because the deck
 * must keep painting regardless.
 *
 * Endpoints are the environment HTTP API in pingdotgg/t3code
 * (packages/contracts/src/environmentHttp.ts).
 */

import type { Activity } from "./core/approvals.ts";
import type { Command } from "./core/dispatch.ts";
import type { ProjectShell, ThreadShell } from "./core/state.ts";
import type { Session } from "./session.ts";

const TIMEOUT_MS = 5000;

/** The least the deck needs: read the model, dispatch user operations. */
export const SCOPES = "orchestration:read orchestration:operate";

export class T3Client {
  constructor(private readonly session: Session) {}

  get origin(): string {
    return this.session.origin;
  }

  private async req(method: string, path: string, body?: unknown): Promise<unknown | null> {
    try {
      const res = await fetch(this.session.origin + path, {
        method,
        headers: {
          authorization: `Bearer ${this.session.accessToken}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return null;
    }
  }

  /** Every project and thread, or null when the server could not be reached. */
  async shell(): Promise<{ projects: ProjectShell[]; threads: ThreadShell[] } | null> {
    const data = (await this.req("GET", "/api/orchestration/shell")) as { projects?: unknown; threads?: unknown } | null;
    if (!data || !Array.isArray(data.threads)) return null;
    return {
      projects: Array.isArray(data.projects) ? (data.projects as ProjectShell[]) : [],
      threads: data.threads as ThreadShell[],
    };
  }

  /** Recent activities of one thread — enough turns to hold any open approval. */
  async activities(threadId: string): Promise<Activity[] | null> {
    const data = (await this.req(
      "GET",
      `/api/orchestration/threads/${encodeURIComponent(threadId)}?turnLimit=2`,
    )) as { thread?: { activities?: unknown } } | null;
    const a = data?.thread?.activities;
    return Array.isArray(a) ? (a as Activity[]) : null;
  }

  async dispatch(cmd: Command): Promise<boolean> {
    return (await this.req("POST", "/api/orchestration/dispatch", cmd)) !== null;
  }
}

export type Exchange = { ok: true; session: Session } | { ok: false; error: string };

/** Trade a one-time pairing token for a scoped bearer session (RFC 8693 shape). */
export async function exchangePairing(origin: string, token: string): Promise<Exchange> {
  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: token,
    subject_token_type: "urn:t3:params:oauth:token-type:environment-bootstrap",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: SCOPES,
    client_label: "Stream Deck",
    client_device_type: "desktop",
    client_os: process.platform,
  });
  try {
    const res = await fetch(origin.replace(/\/+$/, "") + "/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: unknown;
      expires_in?: unknown;
      reason?: unknown;
      code?: unknown;
    };
    if (!res.ok || typeof body.access_token !== "string") {
      return { ok: false, error: String(body.reason ?? body.code ?? `HTTP ${res.status}`) };
    }
    const ttl = typeof body.expires_in === "number" ? body.expires_in : 0;
    return {
      ok: true,
      session: {
        origin: origin.replace(/\/+$/, ""),
        accessToken: body.access_token,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
