# Cursor-Ordner

Hier liegt die Arbeitsanweisung für den Agenten. Das alte Monolith-Zielbild ist in Regeln zerlegt.

| Pfad | Rolle |
| --- | --- |
| `rules/` | Kurze, thematische `.mdc`-Dateien. `alwaysApply` = jeder Chat. |
| `../src/types/` | Geteilte JSDoc-`@typedef`s. |
| `docs/architecture/zielbild.md` | Nur noch Index, kein zweites Gesetzbuch. |
| `docs/architecture/templates.md` | Templates anlegen (Katalog, JSON, HTML). |
| `docs/architecture/roadmap.md` | Vanilla-ESM, lima-city / php -S, kein npm. |

Neue Architektur-Idee: eigene Rule, nicht die bestehende aufblähen. Die Roadmap nicht in eine Rule kopieren.
