/**
 * Where the long-lived T3 session lives: a 0600 file under the user's config
 * dir, like T3's own token files — never in OpenDeck's plain-text settings.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_ORIGIN, originFromRuntimeFile } from "./core/pairing.ts";

export type Session = { origin: string; accessToken: string; expiresAt: string };

const configDir = (): string =>
  join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "t3code-streamdeck");

export const sessionPath = (): string => join(configDir(), "session.json");

export function loadSession(): Session | null {
  try {
    const v = JSON.parse(readFileSync(sessionPath(), "utf8")) as Partial<Session>;
    if (typeof v.origin !== "string" || typeof v.accessToken !== "string") return null;
    return { origin: v.origin, accessToken: v.accessToken, expiresAt: String(v.expiresAt ?? "") };
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(sessionPath(), JSON.stringify(s) + "\n", { mode: 0o600 });
  chmodSync(sessionPath(), 0o600);
}

export function clearSession(): void {
  rmSync(sessionPath(), { force: true });
}

/** The origin the running desktop app persisted, or loopback:3773. */
export function discoverOrigin(): string {
  const home = process.env.T3CODE_HOME || join(homedir(), ".t3");
  const file = join(home, "userdata", "server-runtime.json");
  const json = existsSync(file) ? readFileSync(file, "utf8") : null;
  return originFromRuntimeFile(json) ?? DEFAULT_ORIGIN;
}
