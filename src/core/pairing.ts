/**
 * What the user pastes into the inspector: a pairing URL from `npx t3 pair` or
 * the app's Create Link (`http://host:3773/pair#token=XXXX`), or the bare token.
 */

export type Pairing = { origin: string | null; token: string };

const TOKEN = /^[A-Za-z0-9_-]{6,128}$/;

export function parsePairing(input: string): Pairing | null {
  const s = input.trim();
  if (s.length === 0) return null;
  if (TOKEN.test(s)) return { origin: null, token: s };
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const token =
    new URLSearchParams(url.hash.replace(/^#/, "")).get("token") ?? url.searchParams.get("token");
  if (!token || !TOKEN.test(token)) return null;
  // Hosted pairing links (https://app.t3.codes/pair?...) carry the backend URL
  // as a parameter; a direct link's origin is the backend itself.
  const backend = url.searchParams.get("server") ?? url.searchParams.get("url");
  return { origin: backend ?? url.origin, token };
}

/** Origin a live desktop app persisted, if the runtime file is readable. */
export function originFromRuntimeFile(json: string | null): string | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as { origin?: unknown };
    return typeof v.origin === "string" && /^https?:\/\//.test(v.origin) ? v.origin : null;
  } catch {
    return null;
  }
}

export const DEFAULT_ORIGIN = "http://127.0.0.1:3773";
