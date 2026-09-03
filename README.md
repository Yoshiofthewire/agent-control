# t3code-streamdeck

An **[OpenDeck](https://github.com/nekename/OpenDeck)** (and Elgato Stream Deck)
plugin that drives **[T3 Code](https://github.com/pingdotgg/t3code)** from a
Stream Deck on Linux: see which agent thread is running or waiting, approve or
deny a held tool call, interrupt a turn, switch the permission mode, settle a
thread, and fire a canned prompt — all on labelled keys.

Every control is its own action: drag **Gate · Approve** onto a key and it *is*
the approve key. The only shared setting is the pairing with T3 Code.

## Keys

| Key | What it does |
| --- | --- |
| **Link** | Green when T3 Code answers, amber with a count when approvals are waiting, grey when unreachable. Press to refresh. |
| **Thread · Current** | Title and status of the selected thread, with its position in the active list. |
| **Thread · Previous / Next** | Scrub the active (unsettled, unarchived) threads, newest first. |
| **Thread · Interrupt** | Interrupt the selected thread's running turn. Dim unless it is running. |
| **Thread · Settle** | Mark the selected thread done. |
| **Thread · Prompt** | Send this key's text (inspector setting, default `Continue.`) to the selected thread as a new user message. |
| **Gate · Approve / Deny** | Accept or decline the selected pending tool call, across every thread. |
| **Gate · Previous / Next** | Scrub the pending approvals. |
| **Mode · Supervised / Auto-accept edits / Auto / Full access** | Set the selected thread's permission mode. The active one is lit green. |
| **Attention** | Shows the thread waiting on you (and how many are). Press to select it so Approve / Deny and the thread keys point at it. "All clear" otherwise. |
| **Git · Commit / Publish / Pull request** | Run T3 Code's own git action in the selected thread's worktree: commit (T3 writes the message), push with upstream, or open the PR. The key flashes ✓ or ✗; the result line is in the plugin log. |

Selection follows identity: if the list reorders between polls, the deck stays
on the thread or request you were on.

## Install

Needs Node ≥ 20 on `PATH` (OpenDeck launches the bundle through its shebang).

```sh
npm install
npm run build
npm run install:opendeck   # symlinks the .sdPlugin into ~/.config/opendeck/plugins
```

Restart OpenDeck (or enable the plugin in its Plugins tab), then drag keys on.

## Pair with T3 Code

With T3 Code running:

```sh
npx t3 pair
```

Copy the printed **Pairing URL** (`http://127.0.0.1:3773/pair#token=…`) into
the **Pair** field of any T3 key's inspector. The plugin exchanges the one-time
token for a 30-day session limited to `orchestration:read orchestration:operate`,
writes it to `~/.config/t3code-streamdeck/session.json` (mode 0600), and blanks
the token out of OpenDeck's settings. The **Status** line confirms the link.

Settings → Connections → **Create Link** in the app works the same way. For a
remote server, paste that server's link; for a bare token, fill **Server** first.
Revoke the deck at any time from Settings → Connections in T3 Code.

## How it talks to T3 Code

Plain HTTP against the environment API, plus one WebSocket RPC for git:

- `GET /api/orchestration/shell` every 3 s — every thread's status and whether
  it has pending approvals.
- `GET /api/orchestration/threads/:id?turnLimit=2` for threads with pending
  approvals — the `approval.requested` / `approval.resolved` activities yield
  the open request ids.
- `POST /api/orchestration/dispatch` with `thread.approval.respond`,
  `thread.turn.interrupt`, `thread.settle`, `thread.runtime-mode.set`,
  `thread.turn.start`.
- `git.runStackedAction` over `/ws` (Effect RPC, JSON frames, one-shot ticket from
  `/api/auth/websocket-ticket`) for the three git keys. Needs Node ≥ 22 for the
  global WebSocket; on Node 20 the git keys report that and the rest still works.

The app's own UI commands (sidebar, palette, thread jump) are renderer-only and
have no server API, so the deck cannot move the app's focus.

## Develop

```sh
npm test          # pure core + renderer, and the fake-host end-to-end test (after a build)
npm run typecheck
npm run watch
```

`tests/host.test.ts` boots the built bundle against a fake OpenDeck WebSocket
host and a fake T3 HTTP server: pairing, the settings round-trip, key paint, and
Approve → the exact dispatch body.

Everything is a table in `src/core/catalog.ts`; the manifest and the icons are
generated from it.
