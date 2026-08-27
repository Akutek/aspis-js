# Aspis — Zielbild

Das geplante System, nicht der Altstand. Der ausführliche Text liegt in **Cursor-Regeln**, nicht hier. Phasen und Baseline: [`roadmap.md`](roadmap.md).

Einstieg: `.cursor/README.md` und `.cursor/rules/`.

| Thema | Rule |
| --- | --- |
| Stabilitäts-Roadmap, Baseline | [`roadmap.md`](roadmap.md) |
| Kern, Instanzen, Altstand | `architecture.mdc` |
| Boot + Registry | `boot.mdc` |
| Phasen-Manager, BaseManager | `managers.mdc` |
| Store | `store.mdc` |
| Extensions | `extensions.mdc` |
| Channel, Worker, Boot-Events | `channel.mdc` |
| Klassen-Imports | `imports.mdc` |
| Importer sparsam, faul laden | `importer-performance.mdc` |
| Manifeste, Hydratoren, Pipelines | `manifests.mdc` |
| Manifeste bei Klassen-Änderung mitführen | `manifest-sync.mdc` |
| Git | `git.mdc` |
| Typen in JSDoc (`@typedef`, `@param`) | `ssot-types.mdc` |
| Keine Personenangaben (Ausnahme Lizenz) | `privacy.mdc` |
| Keine Klassenvariablen außer Hosts | `class-fields.mdc` |
| Zentrale Debug-/Error-Agenten | `agents.mdc` |
| Diagnose an jeder Klasse, Manifest-Areas | `agent-wiring.mdc` |
| Keine Globals (`window` / `globalThis`) | `no-globals.mdc` |
| Scan-Phase, Loop-Einstieg, `scanResults` | `scan.mdc` |
| Plan-Phase, Manifest-Trigger, Specifier | `plan.mdc` |
| Compare-Phase, Plan-Items, Differenz | `compare.mdc` |
| Priority-Queue, Muster, kein Host | `queue.mdc` |
| Factory-Phase, Frankenstein-Dirigent | `factory.mdc` |
| Watcher-Hosts statt Observer-API | `watchers.mdc` |
| Templates anlegen (Katalog, JSON, HTML) | `templates.mdc`, [`templates.md`](templates.md) |

Neue Architekturentscheidung: neue Rule, dieses Index nicht wieder zum Monolithen machen.
