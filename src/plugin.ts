/**
 * Plugin entry: register every catalog key, connect to OpenDeck / Stream Deck,
 * load the saved T3 session and go live.
 *
 * Pairing happens through the global settings: the inspector writes the pasted
 * pairing URL to `pair`; this exchanges it for a session, saves the session to
 * disk, and blanks `pair` so no secret stays in OpenDeck's settings file.
 */

import streamDeck from "@elgato/streamdeck";

import { CatalogKeyAction } from "./actions/keys.ts";
import { exchangePairing } from "./client.ts";
import { KEYS } from "./core/catalog.ts";
import { parsePairing } from "./core/pairing.ts";
import { DEFAULT_POLL_MS, service } from "./service.ts";
import { discoverOrigin, loadSession, saveSession, type Session } from "./session.ts";

type GlobalSettings = { pair?: string; server?: string; status?: string };

const POLL_MS = Number(process.env.T3DECK_POLL_MS) || DEFAULT_POLL_MS;

const linkedStatus = (s: Session): string =>
  `Linked to ${s.origin}` + (s.expiresAt ? ` until ${s.expiresAt.slice(0, 10)}` : "");

/** The token being exchanged right now: the host echoes settings back, and a one-time token must not be spent twice. */
let consuming: string | null = null;

async function consumePairing(g: GlobalSettings): Promise<void> {
  const input = (g.pair ?? "").trim();
  if (input.length === 0 || consuming === input) return;
  consuming = input;
  try {
    await exchange(g, input);
  } finally {
    consuming = null;
  }
}

async function exchange(g: GlobalSettings, input: string): Promise<void> {
  const pairing = parsePairing(input);
  let status: string;
  if (!pairing) {
    status = "Pairing input not recognised — paste the URL from `npx t3 pair`.";
  } else {
    const origin = pairing.origin ?? (g.server ?? "").trim().replace(/\/+$/, "") ?? "";
    const target = origin || discoverOrigin();
    const r = await exchangePairing(target, pairing.token);
    if (r.ok) {
      saveSession(r.session);
      service.configure(r.session);
      service.start(POLL_MS);
      status = linkedStatus(r.session);
      streamDeck.logger.info(`paired with ${r.session.origin}`);
    } else {
      status = `Pairing failed: ${r.error}`;
      streamDeck.logger.warn(`pairing with ${target} failed: ${r.error}`);
    }
  }
  // Blank the one-time token whether or not it worked; it is spent either way.
  await streamDeck.settings.setGlobalSettings<GlobalSettings>({ ...g, pair: "", status });
}

for (const def of KEYS) streamDeck.actions.registerAction(new CatalogKeyAction(def));

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => void consumePairing(ev.settings));

await streamDeck.connect();

const session = loadSession();
if (session) {
  service.configure(session);
  service.start(POLL_MS);
}
const g = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
if ((g.pair ?? "").trim()) {
  await consumePairing(g);
} else {
  const status = session ? linkedStatus(session) : "Not paired. Run `npx t3 pair` and paste the pairing URL here.";
  if (g.status !== status) await streamDeck.settings.setGlobalSettings<GlobalSettings>({ ...g, status });
}
