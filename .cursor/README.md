# Cursor-Ordner (aspis-js)

Arbeitsanweisung für den Agenten. Kurze Rules — eine Concern pro Datei. **Zuerst Rules**, nicht den ganzen `src/`-Tree greppen (`agent-lookup.mdc`).

## Always-on

| Rule | Rolle |
| --- | --- |
| `architecture.mdc` | Phasen, Registry, Boot/Cycle |
| `host-dom-contract.mdc` | `data-controller` Accordion/Form/Modal |
| `accordion-lazy.mdc` | `data-item-url` + JSON `{ ok, html }` |
| `known-templates.mdc` | Template-Namen für Hosts |
| `agent-lookup.mdc` | Suchreihenfolge |
| `ssot-types.mdc` / `jsdoc.mdc` / `no-globals.mdc` / `class-fields.mdc` | Typen & Hygiene |
| `importer-performance.mdc` / `manifest-sync.mdc` | Import & Katalog |
| `agent-wiring.mdc` / `agents.mdc` | Logging |
| `git.mdc` / `privacy.mdc` | Prozess |

## Bei Datei-Globs (Auszug)

| Rule | Thema |
| --- | --- |
| `boot.mdc`, `scan.mdc`, `plan.mdc`, `compare.mdc`, `factory.mdc`, `channel.mdc` | Phasen / Channel |
| `managers.mdc`, `extensions.mdc`, `store.mdc`, `watchers.mdc` | Struktur |
| `manifests.mdc`, `templates.mdc` | Kataloge |
| `queue.mdc` | Cycle-Überlappung |

Docs: `docs/architecture/roadmap.md`, `templates.md`. Parent-Repo konsumiert aspis nur mit Freigabe für Edits (Parent-Rule `aspis.mdc`).

Neue Idee: **eigene Rule**, bestehende nicht aufblähen.
