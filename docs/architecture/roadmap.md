# Aspis — Roadmap

Ziel: ein kleiner Runtime-Kern, dessen Lifecycle, Manifeste und Composition **beweisbar** funktionieren. Reihenfolge:

**Static-ESM (lima-city / php -S) → Architektur-Härtung → Public API / DX → Lifecycle-Tests ganz am Ende**

Meilenstein: ein Controller wird aus einem Manifest deterministisch erzeugt, aktualisiert und zerstört — unabhängig davon, wie oft sich der DOM ändert.

Einstieg der Loop: `ScanManager.scan`. Ablauf in `src/aspis.js` (`runCycle`):

```text
DOM
 ↓
Scan
 ↓
Plan
 ↓
Compare
 ↓
Observer
 ↓
Compose
 ↓
Controller
 ↓
Splice / Tailor
 ↓
Factory
```

## Namen

Keine Umbenennung.

- **Manager** — Routing-Knoten und schrittweiser Dirigent eines Pipeline-Kapitels. Zustandslos, nur `static`. Weitere Steps kommen hier hinzu (neues Verb / neue Phase in `runCycle`).
- **Extension** — dasselbe Muster, bezogen auf einen vorhandenen Host oder ein vorhandenes Kapitel. Auftrag: erweitern (`prepare` / `apply` / `graft` / `expand`), nicht die Loop dirigieren. Beispiel: `StoreExtension` baut den Store aus.
- **Host** — geplante Instanz in der Registry (`Store`, `Scanner`, `Tailor`, …).
- **Hydrator** — eine Klasse pro Manifest-Typ: Index, Teil-Manifeste, Normalisieren, stabile Form. Laden über `ManifestLoaderService.load(path, Hydrator?)`. `BaseHydrator.hydrate` prüft Rohdaten und ruft `transform`. Sub-Hydratoren überschreiben und ergänzen, bleiben flexibel. Helfer in `src/hydrators/helpers/` sind keine Hydratoren.

## Baseline (Phase 0)

Demo ist natives Browser-ESM: `index.html` → `src/entry.js`. Lokal `php -S localhost:8080`. lima-city: `index.html`, `src/`, `.htaccess`. Kein npm-Paket, kein Vite, kein Node.

Typen: JSDoc (`@typedef` in `src/types/`). `jsconfig.json` ist IDE-Hilfe, kein Laufzwang.

Runtime: `BootManager.boot()` einmal (Debug/Error → Cache → Registry+Store → Importer → Manifeste). Danach `runCycle(registry)`, in der Registry als `cycle` für den MutationWatcher.

Pfade: `AssetPath` (`src/core/AssetPath.js`), Root = Ordner `src/`.

Compare: `add` / `keep` / `update` / `remove` (`CompareDifference`). `update` = gleicher DOM-Knoten, andere Pflicht. Factory: `destroy` dann neu `start()`. Am Knoten: `data-aspis-origin`, `data-aspis-controller`.

Registry: Map + WeakMap; `FinalizationRegistry` existiert, garantierte Semantik bleibt `destroy()`. Watcher-Hosts liegen in der Registry, sobald der Plan `watcher` braucht.

Automatisierte Tests erst **am Ende**. Tag `baseline` setzt die entwickelnde Person selbst, z. B. `git tag baseline`.

---

## Phase 1 — Vanilla-ESM (P0)

Runtime ist ESM-JavaScript im Browser. Importer: `import(href)` derselben Origin. Keine `.ts`-Quellen.

Öffentlich: `start` / `stop` / `runCycle` in `src/aspis.js`. Konsum über relatives `./src/aspis.js` derselben Origin.

Erfolg: Demo über PHP-Server, Upload-fähig.

---

## Phase 2 — Architekturregeln mit dem Code (P0)

Kein Umbau der Namen.

- `RuntimeEnv` (`src/core/RuntimeEnv.js`, Katalog `core.RuntimeEnv`): Origin, Viewport, `body`, `documentElement`, fremdes `DOMPurify` **lesen**. Kein Schreiben auf `window`. `createElement` / Listener bleiben am Dokument. Default-Parameter an `document.body` in `ScannerDOM` bleibt DOM-API.
- Eine Frage pro Pipeline-Stufe in `architecture.mdc` und den Phasen-Rules; Manager plus Extension beantworten sie.
- Registry: `destroy()` ist die Semantik. `BaseController.destroy` ist idempotent (`_destroyed`). `delete`: Finalizer abmelden, dann `destroy`, dann WeakMap. Der Finalizer ruft `destroy` nur, wenn die Instanz noch nicht zerstört ist.

---

## Phase 3 — Lifecycle testen (am Ende)

Lifecycle im Browser (Demo), **nach** Static-ESM und Architektur. Kein Node-Testharnisch.

Compare-Pfad `update` ist im Typ und in der Loop: gleicher DOM-Knoten, andere Pflicht → `destroy` dann neu `start()`. `keep` bleibt ohne neue Instanz.

---

## Phase 4 — Manifest-Contract (P1)

Vertrag in den **Hydratoren**, keine zweite Validate-Schicht.

- `BaseHydrator.hydrate`: Objektpflicht, Manifest-Major 1 (`assertManifestVersion`; fehlende `version` = 1).
- `RegistryManifestHydrator`: `classRouting` / `manifestRouting` Pflicht, Routen über `RouteIndexHydrator`. Kein stilles `version: "1.0.0"`.
- `AppConfigHydrator`: Cardinal `registry-manifest` mit `directory` + `file`.
- `PlanManifestHydrator`: Index-Routen vollständig; Portion ohne `specifiers` wirft. `needs` nur `store` / `watcher` / `observer` (`PLAN_NEEDS`).
- `SchemaManifestHydrator`: Schema braucht `id`/`kind`, sonst Index wie `RouteIndexHydrator`.
- Klassenindizes lädt der Importer mit `RouteIndexHydrator`. JSON-Parse-Fehler am Loader mit URL.
- Importer: `ErrorAgent.throw` bei ungültigem Specifier, fehlender Gruppe/Index-Zeile, Modul-/Export-Fehler, Import-Zyklus (`runtime.loading`). Unbekanntes Mixin: `ControllerService` / `SplicerExtension`.

Root-JSON: `version: "1"` in `registry-manifest.json` und `app-config.json`. State und Events über `manifestRouting` plus Index (`states-index`, `events-index`), nicht über hart kodierte Pfade.

---

## Phase 5 — Große Services (P1)

Kein Umbau der Namen Manager/Extension.

- `TemplateService` bleibt Host (Cache + Compile). Katalog, URL-Auflösung und Laden von JSON/HTML: `TemplateCatalog`. Template-JSON über `TemplateManifestHydrator`. Typen: `src/types/templates.js`. Index über `RouteIndexHydrator`.
- `SchemaCatalog.load` im Boot (`manifestRouting.schemas`): Index plus Portionen über `SchemaManifestHydrator`. `SchemaService` bleibt Normalizer. `ValidationService` / `FormFieldService` unverändert.

---

## Phase 6 — Öffentliche API (P1)

Einstieg `src/aspis.js`: `start()`, `stop(registry?)`, `runCycle(registry)`. Kein Barrel für Manager, Extension, Agent, Watcher, Tailor, Splicer. `stop()`: `cycle` lösen, Watcher-Hosts `stop()`, Live-Set und DOM-Baum `destroy`, EventDispatcher `destroy`. Konsum: relatives `./src/aspis.js` derselben Origin. Kein npm-Paket.

---

## Phase 7 — Mutation Pressure (P2)

`runCycle` loggt Phasendauern und Compare-Zähler (`[runCycle]`, Area `cycle`). Optionaler Scan-Root: MutationWatcher gibt den betroffenen DOM, `ScanManagerExtension.mergeOutside` hält Treffer außerhalb. Suite: Phase 9.

---

## Phase 8 — Developer Experience (P2)

Pipeline-Log in `runCycle` und Compare. Controller-Knoten: `data-aspis-origin`, `data-aspis-controller`. Kein Starter-CLI.

---

## Phase 9 — Benchmarks (P3)

Optional später im Browser: 10 / 100 / 1 000 Controller. Startup, Keep-Cycle, scoped Add, Churn (add/remove), Heap. Kein npm-Bench.

---

## Reihenfolge der Arbeit

1. Static-ESM (PHP-Server, lima-city, Importer nur Browser)
2. Hydrator-Vertrag, Public API, lokale Mutation, DX
3. Lifecycle im Browser prüfen — **zuletzt**

Priorität: Lauffähig im Browser > Correctness > API > Performance > Tests.
