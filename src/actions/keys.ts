/**
 * One class, every key, parameterised by its catalog row. Every key paints from
 * live state so a dead server shows as a cold deck rather than keys that do
 * nothing when pressed.
 */

import streamDeck, { SingletonAction, type KeyDownEvent, type WillAppearEvent } from "@elgato/streamdeck";

import { type KeyDef, uuidOf } from "../core/catalog.ts";
import { gatePosition, isRunning, selectedThread, threadPosition, threadStatus, waitingThreads } from "../core/state.ts";
import { keyImage, linkImage, threadImage } from "../render/hud.ts";
import { ACCENTS } from "../render/theme.ts";
import { service } from "../service.ts";

type PromptSettings = { text?: string };

export class CatalogKeyAction extends SingletonAction<PromptSettings> {
  /** Last image sent per placement, so a poll that changed nothing sends nothing. */
  private readonly painted = new Map<string, string>();

  constructor(private readonly def: KeyDef) {
    super();
    (this as { manifestId: string | undefined }).manifestId = uuidOf(def.id);
    service.subscribe(() => void this.paint());
  }

  override async onWillAppear(ev: WillAppearEvent<PromptSettings>): Promise<void> {
    if ("setTitle" in ev.action) await ev.action.setTitle("");
    await this.paint();
  }

  override async onKeyDown(ev: KeyDownEvent<PromptSettings>): Promise<void> {
    switch (this.def.behaviour) {
      case "gate-next":
        return service.selectGate(1);
      case "gate-prev":
        return service.selectGate(-1);
      case "thread-next":
        return service.selectThread(1);
      case "thread-prev":
        return service.selectThread(-1);
      case "link":
      case "thread-show":
        await service.refresh();
        return;
      case "attention":
        return service.attend();
      case "git": {
        if (!this.def.git) return;
        const r = await service.runGit(this.def.git);
        streamDeck.logger.info(`git ${this.def.git}: ${r.ok ? "ok" : "FAILED"} — ${r.message}`);
        if ("showOk" in ev.action) await (r.ok ? ev.action.showOk() : ev.action.showAlert());
        await service.refresh();
        return;
      }
      case "prompt": {
        const text = (ev.payload.settings.text ?? "").trim() || (this.def.action?.kind === "prompt" ? this.def.action.text : "");
        await service.run({ kind: "prompt", text });
        return;
      }
      default:
        if (this.def.action) await service.run(this.def.action);
    }
  }

  private image(): string {
    const s = service.state();
    const offline = !service.isConnected();
    const t = selectedThread(s);
    const waiting = s.gates.length;
    const base = { label: this.def.label, glyph: this.def.glyph, accent: this.def.accent };

    switch (this.def.behaviour) {
      case "link":
        return linkImage(!offline, waiting);
      case "thread-show": {
        const status = t ? threadStatus(t) : "none";
        const accent =
          status === "waiting" ? ACCENTS.alert : status === "running" ? ACCENTS.thread : status === "error" ? ACCENTS.stop : ACCENTS.go;
        return threadImage({
          title: t ? t.title : offline ? "T3 Code offline" : "no active thread",
          status,
          accent,
          offline: offline || !t,
          position: t ? `${threadPosition(s)}/${s.threads.length}` : undefined,
        });
      }
      case "thread-next":
      case "thread-prev":
        return keyImage({ ...base, offline: offline || s.threads.length < 2 });
      case "attention": {
        const w = waitingThreads(s);
        if (offline || w.length === 0) return keyImage({ ...base, offline });
        return threadImage({ title: w[0]!.title, status: w.length > 1 ? `${w.length} waiting` : "waiting", accent: ACCENTS.alert, position: `${w.length}` });
      }
      case "git": {
        const busy = service.gitBusy;
        return keyImage({ ...base, label: busy === this.def.git ? "working" : this.def.label, offline: offline || !t || (busy !== null && busy !== this.def.git) });
      }
      case "interrupt":
        return keyImage({ ...base, offline: offline || !t || !isRunning(t) });
      case "approve":
        return keyImage({ ...base, offline, count: waiting, accentOverride: waiting > 0 ? ACCENTS.alert : undefined });
      case "deny":
        return keyImage({ ...base, offline: offline || waiting === 0 });
      case "gate-next":
      case "gate-prev":
        return keyImage({ ...base, offline: offline || waiting === 0, count: waiting > 1 ? gatePosition(s) : 0 });
      case "mode": {
        const active = t && this.def.action?.kind === "mode" && t.runtimeMode === this.def.action.mode;
        return keyImage({ ...base, offline: offline || !t, accentOverride: active ? ACCENTS.go : undefined });
      }
      default:
        return keyImage({ ...base, offline: offline || !t });
    }
  }

  private async paint(): Promise<void> {
    const img = this.image();
    for (const a of this.actions) {
      if (this.painted.get(a.id) === img) continue;
      try {
        if (!("setImage" in a)) continue;
        await a.setImage(img);
        this.painted.set(a.id, img);
      } catch {
        this.painted.delete(a.id);
      }
    }
  }
}
