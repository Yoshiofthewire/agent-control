# T3 Code ⇄ Stream Deck (OpenDeck) plugin — design

Date: 2026-09-03. Status: built without a human design review (autonomous session);
the choices below are assumptions Yoshi can overturn.

## Goal

Drive T3 Code from a Stream Deck on Linux: see which agent thread is running or
waiting, approve or deny a held tool call, interrupt a turn, change the thread's
permission mode, mark a thread done, and fire a canned prompt — without touching
the keyboard.

## What T3 Code exposes (verified against t3code 0.0.38, server on 127.0.0.1:3773)

- **Pairing.** `npx t3 pair` (or Settings → Connections → Create Link) mints a
  one-time pairing token (5 min TTL) as `http://host:3773/pair#token=XXXX`.
- **Token exchange.** `POST /oauth/token` (form-encoded, RFC 8693 shape) turns the
  pairing token into a 30-day bearer session. Scopes are chosen at exchange time
  and cannot exceed the link's grant.
- **Read.** `GET /api/orchestration/shell` — every project and thread with
  `session.status`, `latestTurn.state`, `hasPendingApprovals`, `settledAt`,
  `archivedAt`, `runtimeMode`. `GET /api/orchestration/threads/:id?turnLimit=N`
  — thread detail including `activities`, where `approval.requested` /
  `approval.resolved` carry `payload.requestId`.
- **Write.** `POST /api/orchestration/dispatch` with a `ClientOrchestrationCommand`:
  `thread.turn.interrupt`, `thread.approval.respond`, `thread.settle`,
  `thread.runtime-mode.set`, `thread.turn.start`.
- **Not exposed.** UI commands (sidebar toggle, thread jump, palette) live in the
  renderer only. The deck cannot move the app's focus.

## Architecture

OpenDeck plugin (`com.t3code.controller.sdPlugin`), TypeScript, bundled with
rollup into one Node ESM file, same skeleton as `agentglass-streamdeck`.

```
plugin.ts ── registers one CatalogKeyAction per catalog row
   │            └─ paints from service state, dispatches Action on key down
service.ts ── polls /shell every 3 s, fetches detail for threads with pending
   │           approvals, holds DeckState, notifies keys
client.ts ─── fetch + bearer, 5 s timeouts, null on failure
core/        pure, unit-tested: state (selection), approvals (pending set),
             dispatch (Action → command body), pairing (URL/token parse)
render/      SVG key art as data URIs (no external fonts, no CSS)
```

### Keys (all in the OpenDeck action list, no dropdowns)

| Key | Does |
| --- | --- |
| Link | Reachability + waiting count. Press = refresh. |
| Thread · Current | Title and status of the selected thread. |
| Thread · Prev / Next | Scrub the active (unsettled, unarchived) threads, newest first. |
| Thread · Interrupt | `thread.turn.interrupt` on the selected thread. |
| Thread · Settle | `thread.settle` (mark done). |
| Thread · Prompt | `thread.turn.start` with the key's own text (default "Continue."). |
| Gate · Approve / Deny | `thread.approval.respond` accept / decline on the selected pending approval, across all threads. |
| Gate · Prev / Next | Scrub the pending approvals. |
| Mode · Supervised / Auto-edits / Auto / Full | `thread.runtime-mode.set`; the active mode is lit. |

### Selection

Selected thread follows its id across polls; default is the most recently
updated active thread. Selected gate likewise follows its `requestId`.

### Pairing UX

One property-inspector field: paste the pairing URL (or bare token). The plugin
exchanges it for a session scoped to `orchestration:read orchestration:operate`,
writes the session to `$XDG_CONFIG_HOME/t3code-streamdeck/session.json` (0600),
and blanks the pairing token out of OpenDeck's settings. Server origin comes from
the URL, else the `server` override field, else `~/.t3/userdata/server-runtime.json`,
else `http://127.0.0.1:3773`.

## Security

- Least privilege: only the two orchestration scopes; never `terminal:operate`
  or `access:*`.
- The pairing token is consumed once and removed from OpenDeck's plain-text
  settings. The long-lived session lives in a 0600 file, like T3's own tokens.
- Every request has a timeout; a dead server greys the deck, never throws.
- Nothing is executed via a shell; no network beyond the configured origin.

## Testing

- `node --test` over the pure core and the renderer (valid SVG per key state).
- `tests/host.test.ts` boots the built bundle against a fake OpenDeck WebSocket
  host and a fake T3 HTTP server: pairing exchange, key paint, approve → dispatch
  body.
- Live: pairing exchange, shell read, and a `thread.runtime-mode.set` dispatch
  against the running desktop app.

## Deliberately skipped

Dials, user-input questions (need typed answers), WebSocket subscriptions
(polling a 400 KB snapshot on loopback is fine; upgrade to
`orchestration.subscribeShell` if it ever matters), UI navigation (no API).
