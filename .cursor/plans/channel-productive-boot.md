---
status: completed
---

# Channel produktiv — Boot, Härte, Host-Rest

**Status: fertig.** Vorgänger [`boot-channel-workers.md`](boot-channel-workers.md) bleibt `completed` und wird nicht wieder geöffnet.

Scope: Channel vom Idle-Host zum genutzten Transport (Boot-Hydrate), Timeouts/Pending, Accordion-`itemUrl`, Dropdown-Isolation, Preload, Factory-Config. Keine Pipeline-Umordnung, kein zweiter Worker, keine Controller im Worker, kein npm.

## Leitplanken (unverändert)

- DOM, Registry-Bind, `instance.start` / `destroy` nur Main.
- Ein Pipeline-Worker.
- `EventDispatcher` = Bus; Channel = cmd/res/evt-Transport.
- Host **`Channel`**, Key `channel`. `inflight` / `queued` / `holdPipeline` bleiben.
- `stop()`: Channel destroy vor Dispatcher destroy.

## Erledigt

- [x] Phase 0 — Ist: kein `request` außerhalb Channel (vor der Arbeit); Boot hing Channel ans Service-Ende; `guild-accordion_item` ohne `itemUrl`; ein Dropdown-Slice.
- [x] Phase 1 — Channel nach Cardinals, lazy Worker, `ManifestLoader` Text → `cmd:hydrate` → Hydrator Main. `comparePrep` als No-Op dokumentiert.
- [x] Phase 2 — Request-Timeout, Pending bei Worker-Fehler/`destroy`, Fanout: Subs immer, Dispatcher nur `evt:*`.
- [x] Phase 3 — `modulepreload` Demo + `Renderer::aspis`; `preload as="fetch"` für Cardinals. Kein Index-Bundle.
- [x] Phase 4 — `guild-accordion_item.html` `data-item-url`; Zeilen-Dropdowns Instanz-State (`this._view`), Slice `features.dropdownCadre` plus Isolation nach `data-id` / Row-Action.
- [x] Phase 5 — `settings.factory` in `app-config.json`; Channel-ms unter Area `channel`.
- [x] Phase 6 — `channel.mdc`, Roadmap-Absatz; Phasen 7–9 unangetastet.

Concurrency per config (offen im Vorgänger-Plan) ist hier erledigt.
