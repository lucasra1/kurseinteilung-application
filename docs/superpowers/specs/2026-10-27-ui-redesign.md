# UI-Redesign: eine Zeitleiste für alle

Ergänzt [`2026-10-26-kurseinteilung-design.md`](2026-10-26-kurseinteilung-design.md). Datenmodell, Regeln (Rolle aus Reihenfolge, E-Mails, Magic Link) und DAL-Grenzen bleiben gleich. Freigegebene Mockups: Claude-Design-Canvas „Kurseinteilung Redesign“ (7 Screens).

## Ziel

Trainer (meist am Handy) und Admins (meist am Desktop) gleichermaßen: schnell sehen, wo jemand gebraucht wird, mit einem Tipp eintragen, Lücken dort beheben, wo man sie sieht.

## Struktur

| Route | Wer | Inhalt |
|---|---|---|
| `/termine` | alle | Zeitleiste aller kommenden Termine nach Monat. Trainer: Filter *Wo du gebraucht wirst* (Standard) / *Alle*. Admins: Kennzahlen (Trainer fehlt / Backup fehlt / Voll besetzt, zugleich Filter), Filter *Alle* / *Braucht Leute*, Kurs-Auswahl, vergangene Termine auf Wunsch. |
| `?termin=<id>` | alle | Öffnet das Termin-Panel: am Handy als Sheet von unten, ab `lg` als Spalte rechts neben der Liste. Escape oder Hintergrund schließt. |
| `/meine` | alle | Nächster Termin groß (Rolle, „in X Tagen“, Team, Austragen), danach die späteren; kurze Erklärung der Nachrück-Regel. Unterstützt ebenfalls `?termin=`. |
| `/kurse` | Admin | Kurs-Karten mit Besetzung pro Termin, kommenden Terminen und offenen Lücken. |
| `/kurse/neu` | Admin | Kurs **und** beliebig viele Termine in einem Formular. „Weiterer Tag“ übernimmt Uhrzeit und Ort, Datum +1 Tag. Mindestens ein Termin. |
| `/kurse/[id]` | Admin | Kurs bearbeiten/löschen; jeder Termin als bearbeitbare Zeile (Speichern/Löschen je Zeile), „Weiterer Tag“ zum Ergänzen. |
| `/personen` | Admin | Einladungslink (kopieren, neu erzeugen) oben, darunter Personen mit Suche, Admin-Schalter und Entfernen. Ersetzt `/admin/einstellungen`. |
| `/profil` | alle | Name, Telefon, Abmelden. |

Navigation: Desktop (ab `md`) Tabs im Header (Termine, Meine, Kurse, Personen) plus Name → Profil. Handy: Tab-Leiste unten (Termine, Meine, [Kurse, Personen], Profil). Alte `/admin/*`-URLs leiten weiter (auch Links in bereits verschickten Mails).

## Termin-Panel

- **Trainer:** Kurs · „Tag X von N“, Thema, Datum/Zeit/Ort, Beschreibung, Besetzung (Trainer n von N, Backup n von N, ggf. Überzählig) mit freien Plätzen. Der Button nennt die Rolle, die man bekäme („Als Trainer eintragen“ / „Als Backup eintragen“) samt Hinweis; ausgebucht oder vorbei → deaktiviert. Austragen mit Bestätigung.
- **Admin:** zusätzlich Kontaktdaten, Reihenfolge ändern (↑/↓), Austragen, „Person hinzufügen“ mit Suche (zeigt, auf welchen Platz und in welche Rolle die Person kommt), Termin bearbeiten (→ Kurs-Seite) und löschen.

## Look

- Flächen weiß auf hellem Grau (`#F4F4F5`), Text `#18181B`, gedämpft `#52525B`.
- Eine Akzentfarbe für Aktionen: Rot `#C8102E` (Text auf hellem Rot: `#A50E25`). Kein Rotkreuz-Emblem, kein Name „Rotes Kreuz“.
- Status immer mit Text: „1 Trainer fehlt“ (rot getönt), „1 Backup fehlt“ (amber), „Voll besetzt“ (grün).
- Freie Plätze als Punkte (●●○ Trainer · ○○ Backup) in Listen, als gestrichelte Zeilen im Panel.
- Schrift Geist, Radien 12–16 px, Bedienelemente mindestens 44 px hoch.
