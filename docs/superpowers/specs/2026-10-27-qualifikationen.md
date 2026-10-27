# Qualifikationen und Besetzung pro Termin

Ersetzt in [`2026-10-26-kurseinteilung-design.md`](2026-10-26-kurseinteilung-design.md) das Rollenmodell „Trainer/Backup/Überzählig aus der Reihenfolge, Besetzung pro Kurs“. Alles andere (E-Mails, Magic Link, DAL ohne RLS, UI aus [`2026-10-27-ui-redesign.md`](2026-10-27-ui-redesign.md)) bleibt.

## Regeln

- **Qualifikationen:** Jede Person ist Instruktor, Praxisanleiter oder beides (`profiles.is_instruktor`, `profiles.is_praxisanleiter`). Beim Einladungslink kreuzt man mindestens eine an. Admins schalten sie unter **Personen** um; im Profil werden sie nur angezeigt. Admins aus `ADMIN_EMAILS` starten ohne Qualifikation.
- **Besetzung pro Termin:** `termine.instruktoren_needed` und `termine.praxisanleiter_needed` (je ≥ 0, zusammen ≥ 1). Der Kurs hat keine Besetzung mehr. „Weiterer Tag“ übernimmt beide Zahlen.
- **Eintragen für eine Rolle:** Jede Eintragung hat eine Rolle (`signups.kind`: `instruktor` | `praxisanleiter`). Nur wer die Qualifikation hat, kann sich (oder vom Admin) dafür eintragen (lassen), und nur für Rollen, die der Termin braucht. Eine Person pro Termin höchstens einmal.
- **Fix oder Backup:** Innerhalb einer Rolle entscheidet die Reihenfolge (`position`): die ersten N sind fix, alle weiteren Backup dieser Rolle. Backups sind unbegrenzt. Fällt jemand Fixes aus oder wird die Zahl erhöht, rückt das erste Backup derselben Rolle nach (E-Mail wie bisher). Wird die Zahl gesenkt, werden die Letzten zu Backups. „Überzählig“ und „ausgebucht“ gibt es nicht mehr.
- **Status eines Termins:** fehlende fixe Plätze je Rolle („2 Instruktoren fehlen“, „1 Praxisanleiter fehlt“, „1 Instruktor, 1 Praxisanleiter fehlen“) oder „Voll besetzt“.

## Oberfläche

- **Trainer-Sicht:** *Wo du gebraucht wirst* = kommende Termine mit freiem fixem Platz in einer eigenen Qualifikation, für die man noch nicht eingetragen ist. Im Panel je gebrauchter Rolle: Fixe, freie Plätze, Backups. Buttons je passender Rolle: „Als Instruktor eintragen“ bzw. „Als Backup eintragen“ (Rolle voll); wer beides kann, sieht beide. Ohne passende Qualifikation: Hinweis statt Button.
- **Admin:** Kennzahlen *Instruktor fehlt* / *Praxisanleiter fehlt* / *Voll besetzt*. Panel je Rolle mit Reihenfolge (↑/↓ innerhalb der Rolle), Austragen, „Person hinzufügen“ mit Rollenwahl und Suche nur unter passend Qualifizierten.
- **Kurs anlegen/bearbeiten:** Kurs = Titel und Beschreibung; jede Termin-Zeile hat zusätzlich *Instruktoren* und *Praxisanleiter* (Standard für die erste Zeile: 1 / 0). Zahlen ändern geht durch die Besetzungslogik (E-Mails an Betroffene).
- „Trainer“ verschwindet aus der Oberfläche.

## Migration bestehender Daten

Bestehende Personen werden Instruktoren, bestehende Eintragungen Rolle `instruktor`, jeder Termin übernimmt `trainers_needed` seines Kurses als `instruktoren_needed` (Praxisanleiter 0). Danach entfallen `kurse.trainers_needed` und `kurse.backups_needed`.
