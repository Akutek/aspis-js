---
status: completed
---

# Aspis: Boot agiler — Channel, EventBus, Worker, Lifecycle

**Status: fertig** (Phasen 0–7).

Ziel: Die **phasen-sequentielle** Pipeline (Scan → … → Factory) bleibt.
Agilität kommt durch Parallelität **innerhalb** der Phasen, einen ausbaubaren
**Channel**, den zentralen **EventDispatcher** und **wenige** Worker — gesteuert über
bestehendes Lifecycle-Management (`start` / `stop` / `runCycle` / Controller-destroy).

Kein Bundle, kein npm. Vanilla-ESM, gleicher Origin. Registry bleibt Landkarte
der Hosts; Worker sind **kein** DOM-Host.

Klassennamen wie der bestehende Katalog: Hosts ohne `-Host`-Suffix (`Store`,
`Scanner`, `Tailor`, `Splicer`). Der neue Host heißt **`Channel`**, nicht
`ChannelHost`.

## Ist (Anker)

- [`src/aspis.js`](../../src/aspis.js): `runCycle` loggt schon Phasen-ms (`[runCycle]`,
  Area `cycle`); `inflight` / `queued`; `start()` ruft zuerst `stop()` wenn `active`.
  `stop()` heute: `cycle` lösen → Watcher `stop` → Inflight abwarten → Live/DOM
  `destroy` → `dispatcher.destroy()`. Channel/Worker kommen **vor** Dispatcher-destroy.
- [`BootManager.boot()`](../../src/managers/BootManager.js): heute **seriell**
  (app-config → registry-manifest → debug/error → state/Store → schemas →
  templates → events → Services). Phase 3 = Promise-Gruppen auf Main, nicht Worker.
- [`EventDispatcher`](../../src/services/EventDispatcher.js): Registry-Key
  `dispatcher`; `on` / `emit` / `destroy`. Phase 1 erweitert Event-**Namen**, ersetzt
  die Klasse nicht. Index: `manifests/events/events-index-manifest.json` →
  `event-manifest.json`.
- [`FactoryManagerExtension.#mountBand`](../../src/extensions/factory/FactoryManagerExtension.js):
  serial `await` je Task; Bänder `queue.view` → `near` → `history`.
- [`ImporterExtension`](../../src/extensions/importer/ImporterExtension.js):
  `pending` / `modules` — Dedup bleibt.
- Roadmap [`docs/architecture/roadmap.md`](../../docs/architecture/roadmap.md):
  bestehende Phasen 7–9 (Mutation / DX / Bench) **nicht** umnummerieren; neuen
  Abschnitt „Channel / Worker / Boot“ in Plan-Phase 7 ergänzen.

## Leitplanken

- Phasen**reihenfolge** in `runCycle` nicht auflösen; Inflight+Queue behalten.
- DOM, Registry-Bind, `instance.start()` / `destroy()` nur Main-Thread.
- EventDispatcher = primärer Koordinationspunkt; Channel transportiert Bus-Events
  + Worker-Kommandos, nicht „nur Hydrator-JSON“.
- Worker: **so wenige wie möglich**, genug für messbaren Boot-Gewinn
  (Ziel: 1 Pipeline-Worker, optional 1–2 Parse-Helfer — kein Pool pro Specifier).
- Lifecycle: Channel/Worker/Bus-Subscriptions an `start`/`stop` und
  Controller-`destroy` koppeln; keine orphaned Ports/Worker nach `stop()`.
- Importer-Regel bleibt: Klasse erst bei Bedarf; parallel laden ≠ alles vorladen.

## Klassennamen

Wie `Store`, `Scanner`, `Tailor`, `Splicer`, `EventDispatcher`, `BootManager`,
`StoreExtension`:

- Host: **`Channel`** (`src/core/Channel.js`), Specifier `core.Channel`, Registry-Key
  `channel` — analog `store` / `dispatcher`. Kein `ChannelHost`.
- Ausbau: **`ChannelExtension`** unter `src/extensions/channel/`, falls
  Bind/Loopback/Transport wächst (wie `StoreExtension`).
- Kein `ChannelManager`, solange es eine Instanz mit Zustand ist.
- Worker-Datei: `src/workers/pipeline.worker.js` (Modul, kein Registry-Host).
  Keine Worker-Klasse auf Main.
- Events: bestehende `EventDispatcher`-API; neue Namen, keine zweite Bus-Klasse.
- Felder am `Channel` erlaubt (`class-fields.mdc`, geplante Instanz). Manager
  bleiben zustandslos / nur `static`.

## Architektur-Skizze

```text
Main Thread                         Worker (1, später max 2–3)
───────────                         ──────────────────────────
BootManager / runCycle
    │
    ├─ EventDispatcher  ←── primär
    │      │ emit / on
    │      ▼
    ├─ Channel ───────────────────── MessageChannel / postMessage
    │      │ cmd / res / evt
    │      ▼
    └─ Registry, Store, DOM, Factory     pure: hydrate, plan-prep,
                                         compare-prep, sort, prefetch-hints
```

Eine zentrale Bridge in der Registry (`channel`). Später gleiche API, Transport =
MessageChannel zum Worker; optional Bus-Split **hinter** dem Channel, ohne
Aufrufer umzubauen.

## Phasen

### Phase 0 — Baseline messen (P0)

- [x] `[runCycle]`-Phasenlog um **Boot-Teilschritte** ergänzen (app-config,
      registry-manifest, debug/error, state, schemas, templates, events)
- [x] Einmal Cold-Start + Warm-Cycle in der Demo notieren (ms pro Schritt)
- [x] Engpass benennen: Boot-JSON-Kette vs. Controller-Import vs. Factory-Mount

Abhaken erst mit sichtbaren Timings im Debug-Log (Area `cycle` / `boot`).

Demo `libs/aspis-js/index.html` (php -S :8765), einmal durchgeklickt:

- Cold: Navigation ~223 ms; ~119 JSON- + ~124 JS-Requests. Worker `pipeline.worker.js` lädt. 5 Controller (accordion/dropdown/form keep, table add, modal keep). Table-Daten da. Kein Console-`error`.
- `[runCycle] boot` (sichtbar, Area `cycle`): app-config 9 ms, registry-manifest 9 ms, debug/error 16 ms, state 28 ms, schemas 34 ms, templates 18 ms, events 28 ms, **total 63 ms**.
- Warm `[runCycle]`: typisch 8–16 ms total, davon Factory 7–15 ms; Scan/Plan/Compare/Compose/Controller ~0 ms. Ein Cycle 41 ms (Factory 38 ms) beim Modal. Accordion single-open und Modal-Overlay ok. Nach `stop`/`start`: erster Cycle 144 ms (plan 41 ms, controller 42 ms, factory 42 ms).
- Engpass auf dieser Demo: **Boot-JSON/ESM-Kette** (viele kleine Fetches über php -S; Schemas 34 ms der teuerste Boot-Schritt). Factory-Mount ist im Warm-Cycle der langsamste Phasen-Schritt, absolut klein.

### Phase 1 — EventDispatcher als Zentrum erweitern (P0)

Bestehenden `EventDispatcher` nicht ersetzen — **erweitern**.

- [x] Lifecycle-Events definieren und emittieren (Main):
  - `boot:phase` `{ name, status, ms? }`
  - `boot:done` `{ totalMs }`
  - `cycle:phase` `{ name, status, ms? }`
  - `cycle:done` `{ totalMs, compared }`
  - `factory:band` `{ band, mounted }`
  - `channel:ready` / `channel:error` (sobald Phase 2)
- [x] Manifest / `eventManifest` um diese Namen ergänzen, wo der Vertrag das verlangt
- [x] Keine Controller-Logik an Worker binden — nur Bus hören/senden

Dispatcher bleibt der Vertrag für UI und spätere Channel-Spiegelung.

### Phase 2 — Channel (ausbaubar) (P0)

Neue, schlanke Instanz — **noch ohne** Worker-Pflicht (Loopback zuerst).

- [x] `Channel`: Registry-Key `channel`, Specifier `core.Channel`
- [x] API grob: `post(type, payload)`, `request(type, payload) → Promise`,
      `subscribe(type, cb)` / Unsubscribe
- [x] Intern: zuerst **In-Process** (Bus spiegeln oder direkt an Dispatcher),
      damit Boot/Cycle schon über Channel-Typen sprechen können
- [x] Message-Shapes (Version field `v: 1`):
  - `cmd:hydrate` / `res:hydrate`
  - `cmd:plan-prep` / `res:plan-prep` (optional, später)
  - `cmd:compare-prep` / `res:compare-prep` (optional)
  - `evt:progress` `{ phase, done, total }`
  - `evt:prefetch` `{ specifiers: string[] }`
- [x] Lifecycle: `Channel` nach Boot-Kern anlegen und in der Registry halten,
      `destroy()` in `stop()` — Ports schließen, Listener runter
- [x] `ChannelExtension` nur wenn Bind/Transport den Host sprengen würde

Späterer Ausbau: gleiche API, Transport = MessageChannel zum Worker.

### Phase 3 — Boot parallelisieren (Main, hoher ROI) (P0)

Ohne Worker, nur Promise-Gruppen — messbarer Effekt.

- [x] Abhängigkeitskette explizit:
  1. `app-config` → `registry-manifest`
  2. parallel: debug, error, state-index, schema-index, template-index, events-index
  3. parallel: volle Manifeste, soweit unabhängig
  4. seriell: Store.apply, Registry-Register, Services binden
- [x] `boot:phase`-Events pro Gruppe
- [x] Fehler: eine Gruppe failt → Boot wie heute `null` / capture, kein halber Store

### Phase 4 — Wenige Worker an Channel anbinden (P1)

- [x] **Ein** Pipeline-Worker (`src/workers/pipeline.worker.js`, gleicher Origin, ESM)
- [x] Channel-Transport umschalten: In-Process → `postMessage` + Transferables wo sinnvoll
- [x] Worker darf nur **pure** Arbeit: JSON parsen, Hydrator-`transform`-Äquivalent,
      Listen sortieren, Prefetch-Hints — **kein** DOM, keine Registry
- [x] Main: Apply der Ergebnisse in Registry/Cache (unverändert Hydrator-Vertrag)
- [x] Worker-Lifecycle an `start`/`stop`: spawn bei Boot, `terminate` bei `stop`
- [x] Optional später: max. **ein** zweiter Worker nur wenn Phase-0-Messung
      Parse-CPU zeigt (nicht spekulativ)

Regel: lieber 1 Worker voll auslasten als N Worker mit Idle-Overhead.

### Phase 5 — Controller-Load & Factory-Concurrency (P1)

Sequenz der Bänder bleibt: `view` → `near` → `history`.

- [x] Controller-Specifier: `Promise.all` / begrenzter Pool über Importer
      (Dedup `pending` bleibt)
- [x] `#mountBand`: statt streng serial → begrenzte Concurrency (z. B. view: 2–4)
- [x] Barrier: `view`-Band fertig bevor `near` startet
- [x] `history` / heavy: `requestIdleCallback` oder nach `cycle:done`-Idle
- [x] `factory:band`-Events für Fortschritt

### Phase 6 — Lifecycle-Vertrag festziehen (P1)

- [x] `stop()`: Channel destroy → Worker terminate → Dispatcher destroy
      (Reihenfolge dokumentieren)
- [x] Kein zweiter `start()` ohne vorheriges `stop` (bereits teilweise so)
- [x] Cycle-Queue: Channel-Requests während `inflight` nicht parallel
      zweite Pipeline starten — an `queued`-Semantik anbinden
- [x] Kurze Rule: `channel.mdc` (eine Concern: Host, Message-Shapes, Worker-Grenze)

### Phase 7 — Docs & Roadmap (P2)

- [x] `docs/architecture/roadmap.md`: Abschnitt „Channel / Worker / Boot“ ergänzen
      (bestehende Phasen 7–9 nicht umnummerieren)
- [x] Docs-Index / Zielbild: Link auf `channel.mdc`, falls vorhanden
- [x] Kein npm-Bench; optional Browser-Timings wie Roadmap Phase 9
      (siehe Phase-0-Notiz: Cold ~223 ms Nav, Warm-Cycle ~8–16 ms)

## Nicht-Ziele (explizit)

- runCycle-Phasen parallel mischen oder weglassen
- Controller in Workern instanziieren
- Alle classRouting-Gruppen beim Boot vorladen
- Großer Worker-Pool „auf Vorrat“
- aspis-API für Parent-PHP brechen (`start`/`stop`/`runCycle` bleiben)
- Accordion-Slice-Cross-Talk (Host-Views / Slice-Keys) — separates Thema

## Reihenfolge der Arbeit

1. Messen (Phase 0)
2. EventDispatcher-Events (Phase 1)
3. Channel Loopback (Phase 2)
4. Boot-Parallelgruppen Main (Phase 3)
5. Ein Worker + Channel-Transport (Phase 4)
6. Load/Mount-Concurrency (Phase 5)
7. Lifecycle-Härtung + Rule (Phase 6)
8. Docs (Phase 7)

Priorität: Lauffähig im Browser > Correctness der Pipeline > Boot-ms > Worker-Ausbau.

## Erfolgskriterien

- Cold-Boot spürbar/messbar kürzer (Phase-0-Baseline vs. danach)
- Erste interaktive Hosts (view-Band) früher nutzbar als heute
- `stop()` hinterlässt keine Worker/Ports
- Ein Cycle bleibt deterministisch (Compare-Buckets, keep ohne Remount)
- Channel-API stabil genug, dass Worker-Transport und späterer Bus-Umbau
  hinter dem Host bleiben

## Offene Entscheidungen

- Registry-Key: `channel` (Klasse `Channel`)
- Worker-Datei: `src/workers/pipeline.worker.js`
- Zweiter EventDispatcher: erst wenn Channel + ein Bus an Grenzen stoßen
- Concurrency view-Band: 2–4, per app-config oder State später

## Bezug Accordion/Kader (Rand)

Shared `features.accordionFeature` und Factory-Re-Render bleiben **separates**
Thema (Host-Views / Slice-Keys). Dieser Plan ändert daran nichts absichtlich;
schnellere Cycles können bestehende Slice-Cross-Talk-Bugs nur früher sichtbar machen.
