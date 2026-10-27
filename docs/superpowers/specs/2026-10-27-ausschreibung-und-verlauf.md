# Festschreiben, Ausschreibung, Benachrichtigungen, Verlauf

Datum: 2026-10-27
Status: Entwurf, wartet auf Review

Baut auf [`2026-10-27-qualifikationen.md`](2026-10-27-qualifikationen.md) auf (Rolle je Eintragung, Besetzung pro Termin, Backups rücken nach) und auf [`2026-10-27-ui-redesign.md`](2026-10-27-ui-redesign.md). Ändert in [`2026-10-26-kurseinteilung-design.md`](2026-10-26-kurseinteilung-design.md) die Abschnitte *Emails* und *Testing*. Alles andere bleibt.

## Ziel

- Fällt bei einem fest geplanten Termin jemand aus, ist der Platz schnell wieder besetzt, ohne dass die Praxisanleiterkoordinator:in herumtelefonieren muss: Die Backups bekommen den Platz angeboten, wer zuerst zugreift, hat ihn.
- Die Praxisanleiterkoordinator:innen erfahren jede Änderung an der Besetzung sofort per Mail.
- Für jeden Termin, jeden Kurs und jede Person lässt sich nachvollziehen, wer wann was geändert hat.

## Begriffe

- **Praxisanleiterkoordinator:in**: bisher „Admin“ (`profiles.is_admin` oder in `ADMIN_EMAILS`). Kurz hier: Koordinator:in.
- **Festgeschrieben**: Ein Termin, dessen Einteilung verbindlich ist. Austragen löst dort eine Ausschreibung aus.
- **Ausgeschriebener Platz**: ein fixer Platz, der frei bleibt, obwohl es Backups gibt, bis ihn jemand ausdrücklich übernimmt.

## 1. Umbenennung

Überall, wo Nutzer:innen etwas lesen (Oberfläche, Fehlermeldungen, Mails), heißt die Rolle **Praxisanleiterkoordinator:in**, Plural **Praxisanleiterkoordinator:innen**. Beispiele:

- Personen: Schalter „Praxisanleiterkoordinator:in“, Zähler „2 Praxisanleiterkoordinator:innen“.
- „Melde dich bei einer Praxisanleiterkoordinator:in.“
- „Die Praxisanleiterkoordinator:innen bekommen eine E-Mail.“
- „Sehen nur Praxisanleiterkoordinator:innen, falls kurzfristig etwas ist.“
- „Die letzte Praxisanleiterkoordinator:in kann nicht entfernt oder herabgestuft werden.“

Im Code bleibt es bei `isAdmin`, `requireAdmin`, `ADMIN_EMAILS` und den `admin-*`-Dateinamen.

## 2. Festschreiben

### Regel

Ein Termin ist festgeschrieben, wenn

- `termine.festgeschrieben = true` (manuell gesetzt), **oder**
- sein Datum höchstens 3 Kalendermonate nach heute (Wiener Datum) liegt. Beispiel: Am 27.10.2026 sind alle Termine bis einschließlich 27.01.2027 festgeschrieben. Gibt es den Tag im Zielmonat nicht, zählt der letzte Tag des Monats (30.11. → 28.02.).

Bei vergangenen Terminen gibt es keine Ausschreibung und keine Mails (wie bisher); ihre Zähler bleiben, wie sie waren, damit die Besetzung im Nachhinein stimmt.

### Manuell festschreiben und aufheben

- Unter `/termine` gibt es für Koordinator:innen den Modus **„Auswählen“**: eine Checkbox je kommendem Termin, „Alle auswählen“ (bezieht sich auf den aktuellen Filter, also z. B. alle Termine eines Kurses), eine Leiste unten mit „n ausgewählt · **Festschreiben** · **Aufheben**“.
- Aufheben setzt das Flag zurück. Bei Terminen innerhalb der 3 Monate bleibt der Termin trotzdem festgeschrieben.
- Festschreiben und Aufheben lösen nie eine Ausschreibung aus. Festschreiben verschickt keine Mails; Aufheben nur, wenn dadurch jemand nachrückt (siehe unten). Beides steht im Verlauf.

### Wenn ein Termin nicht mehr festgeschrieben ist

Etwa nach dem Aufheben oder weil das Datum nach hinten verschoben wurde: Die Zähler der ausgeschriebenen Plätze gehen auf 0, Backups rücken wie gewohnt nach, die Betroffenen bekommen die bekannte Mail „Neue Rolle“.

### Anzeige

- Festgeschriebene Termine zeigen für alle in Liste und Panel ein Schloss mit „Festgeschrieben“. Koordinator:innen sehen im Panel zusätzlich „automatisch (weniger als 3 Monate)“ oder „manuell“.
- Wer auf einem festgeschriebenen Termin eingetragen ist, sieht im Panel: „Der Termin ist festgeschrieben. Wenn du dich austrägst, wird dein Platz ausgeschrieben.“
- Eintragen funktioniert bei festgeschriebenen Terminen unverändert (freie Plätze und als Backup), ohne Dialog.

## 3. Ausschreibung

### Auslöser

Bei einem festgeschriebenen, nicht vergangenen Termin fehlen nach einer Änderung bei einer Rolle **mehr fixe Plätze als vorher**. Das passiert durch:

- selbst austragen,
- eine Koordinator:in trägt jemanden aus,
- eine Person wird entfernt (pro betroffenem Termin),
- eine Koordinator:in erhöht die Zahl einer Rolle.

Zahlen senken, ↑/↓, Löschen des Termins oder Kurses und Eintragen lösen nie etwas aus.

### Mit Backups dieser Rolle

Niemand rückt automatisch nach. Der Platz wird ausgeschrieben (Zähler `termine.instruktoren_ausgeschrieben` bzw. `praxisanleiter_ausgeschrieben` +1). Alle Backups dieser Rolle bekommen die Mail **„Platz frei“** (siehe 4).

### Ohne Backups dieser Rolle

Es bleibt eine normale Lücke, der Zähler ändert sich nicht. Alle Personen mit der passenden Qualifikation, die nicht auf dem Termin stehen (egal in welcher Rolle), bekommen die Mail **„Du wirst gebraucht“**.

In beiden Fällen bekommt die Person, die die Aktion ausgelöst hat, keine dieser Mails.

### Rollen bei ausgeschriebenen Plätzen

Innerhalb einer Rolle mit N gebrauchten Plätzen und A ausgeschriebenen sind die ersten **N − A** in der Reihenfolge fix, alle weiteren Backups. Als „fehlt“ zählt weiter `N − Anzahl Fixe`, ausgeschriebene Plätze fehlen also.

### Platz besetzen

Jeweils sinkt der Zähler um 1, und die Person wird an die erste Backup-Stelle ihrer Rolle gesetzt (vor alle anderen Backups; danach werden die Positionen des Termins neu durchnummeriert). Damit ist sie fix.

- **Platz übernehmen**: Ein Backup dieser Rolle tippt im Panel auf „Platz übernehmen“. Der Link in der Mail führt zu `/termine?termin=<id>`, Login wie gewohnt. Ist kein Platz mehr ausgeschrieben, kommt „Der Platz ist schon vergeben.“
  Ein Link, der ohne Login sofort übernimmt, wird bewusst nicht gebaut: Mail-Scanner (z. B. Outlook Safe Links) öffnen Links automatisch und würden Plätze vergeben.
- **Neu eintragen**: Wer sich für die Rolle neu einträgt (selbst oder durch eine Koordinator:in), bekommt den Platz direkt. Wer zuerst kommt, bekommt ihn.
- **Platz geben**: Eine Koordinator:in tippt in der Zeile eines Backups dieser Rolle auf „Platz geben“.

Nach dem Übernehmen bekommen die anderen Backups keine Mail. In der App ist der Platz einfach vergeben.

### Randfälle

- **Zahl gesenkt**: Zuerst sinkt der Zähler (um höchstens die Differenz), erst dann wird jemand Backup. Beispiel: N = 3, A = 1, zwei Fixe → N = 2 ergibt A = 0, beide bleiben fix.
- **Nicht mehr festgeschrieben**: Zähler 0 (siehe 2).
- **Letztes Backup trägt sich aus, während ein Platz ausgeschrieben ist**: Es fehlen nicht mehr Plätze als vorher, also keine neue Mail an Qualifizierte. Der Platz bleibt offen und kann wie jede Lücke durch Eintragen besetzt werden. Die Koordinator:innen bekommen die Änderungs-Mail.
- **↑/↓** über die Grenze fix/Backup tauscht wie bisher zwei Personen; die Zähler ändern sich nicht.

### Warndialog

Vor jeder Aktion, die eine Ausschreibung auslöst, kommt ein Dialog mit dem, was passieren wird, zum Beispiel:

> Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch wird 1 Instruktor-Platz ausgeschrieben. 2 Backups bekommen eine E-Mail.

oder „… Es gibt kein Backup: 14 Qualifizierte bekommen eine E-Mail.“ Betrifft die Aktion mehrere Termine (Person entfernen), steht je Termin eine Zeile da. Buttons: „Abbrechen“ und „Trotzdem austragen“ / „Trotzdem entfernen“ / „Trotzdem speichern“.

Ablauf: Die Aktion läuft zunächst unbestätigt. Würde sie eine Ausschreibung auslösen, bricht der Server die Transaktion ab (keine Änderung, keine Mail) und gibt den Dialogtext zurück. Bestätigt die Person, läuft die Aktion mit `bestaetigt=1` erneut. So stimmt der Dialog auch, wenn sich der Stand inzwischen geändert hat.

Beim Selbst-Austragen gibt es heute schon einen Bestätigungsdialog. Weiß die Oberfläche schon, dass der Termin festgeschrieben und der eigene Platz fix ist, zeigt sie den Warntext gleich darin und schickt `bestaetigt=1` mit. Meldet der Server trotzdem eine nötige Bestätigung, erscheint der Dialog mit dem Text vom Server.

### Anzeige

- **Koordinator:innen**: Ausgeschriebene Plätze zählen in den Kennzahlen als „fehlt“. Im Panel erscheint der freie Platz als gestrichelte Zeile „Ausgeschrieben“. Backup-Zeilen dieser Rolle haben den Button „Platz geben“.
- **Backups dieser Rolle**: sehen den Termin unter *Wo du gebraucht wirst*. Im Panel ist „Platz übernehmen“ der Hauptbutton, mit dem Hinweis „Ein Instruktor-Platz ist frei geworden. Wer zuerst übernimmt, bekommt ihn.“; „Austragen“ bleibt als zweite Aktion. In `/meine` zeigt der Eintrag „Platz frei – übernehmen“ (öffnet das Panel).
- **Austragen-Dialog** bei nicht festgeschriebenen Terminen: „Wer nach dir eingetragen ist, rückt nach. Die Praxisanleiterkoordinator:innen bekommen eine E-Mail.“

## 4. Mails

Ersetzt die Tabelle *Emails* der Grund-Spec. Login- und Einladungs-Mails bleiben unverändert. Weiterhin gilt: keine Mails für vergangene Termine, keine an Personen, deren Account gerade entfernt wurde, keine an die Person, die die Aktion ausgelöst hat. Mails werden aus den Verlauf-Einträgen der Aktion gebaut (siehe 6), Mail und Verlauf erzählen also dasselbe.

| Auslöser | Empfänger | Inhalt |
|---|---|---|
| Ausschreibung | Backups der Rolle | Betreff „Platz frei: <Kurs>, <Tag>“. „Bei „<Kurs> – <Thema>“ am <Datum, Zeit> ist ein <Rolle>-Platz frei geworden. Du bist dort Backup. Wer zuerst übernimmt, bekommt den Platz.“ + Link zum Termin |
| Lücke ohne Backup | Qualifizierte, nicht auf dem Termin | Betreff „Du wirst gebraucht: <Kurs>, <Tag>“. „Bei … fehlt ein <Rolle>. Wenn du Zeit hast, trag dich ein.“ + Link |
| Jemand anderes ändert die eigene Rolle | betroffene Person | wie bisher: „Eingetragen“, „Ausgetragen“, „Neue Rolle: alt → neu“ |
| Jede Aktion, die die Besetzung ändert | alle Koordinator:innen | eine Mail pro Aktion, siehe unten |

### Mail an die Koordinator:innen

Gilt für: eintragen, austragen, Platz übernehmen, Platz geben, Person hinzufügen, ↑/↓, Zahlen geändert, Termin/Kurs gelöscht (mit Eintragungen), Person entfernt (mit Eintragungen), Festschreibung aufgehoben (wenn dadurch jemand nachrückt), egal wer die Aktion auslöst. Keine Mail für Änderungen ohne Folgen für die Besetzung (Titel, Uhrzeit, Ort, Festschreiben): die stehen nur im Verlauf.

Eine Mail pro Aktion und Koordinator:in. Sie beschreibt die Aktion und alle Folgen, gruppiert nach Termin, mit dem Stand danach:

> Betreff: Abmeldung: Erste Hilfe Grundkurs, Sa., 07.11.2026
>
> Anna Huber hat sich von „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00 ausgetragen.
>
> – Der Termin ist festgeschrieben: 1 Instruktor-Platz ist ausgeschrieben. Angeschrieben: Ben Maier, Clara Ott (Backups).
>
> Aktueller Stand: Instruktoren 1/2, Praxisanleiter 1/1, 2 Backups.
>
> <APP_URL>/termine?termin=…

Weitere Folgen-Zeilen: „– Ben Maier rückt als Instruktor nach.“, „– Kein Backup: 14 Qualifizierte angeschrieben.“. Betreff je Aktion, z. B. „Eintragung: …“, „Platz übernommen: …“, „Ausgetragen: …“, „Besetzung geändert: …“, „Person entfernt: Anna Huber“, „Kurs gelöscht: …“. Die bisherige Abmelde-Mail an die Admins geht darin auf.

### Kontingent

Resend Free: 100 Mails pro Tag, 3.000 pro Monat. An Tagen mit vielen Eintragungen kann das knapp werden (30 Eintragungen × 2 Koordinator:innen = 60 Mails). Deshalb gehen pro Aktion zuerst die Mails „Platz frei“ und „Du wirst gebraucht“ raus, dann die an Betroffene, zuletzt die an die Koordinator:innen. Fehler werden geloggt und lassen die Aktion nicht scheitern. Wer angeschrieben werden sollte, steht im Verlauf. Wird es im Alltag knapp: Tagesbericht statt Sofort-Mails oder Resend Pro (nicht Teil dieser Spec).

## 5. Verlauf

### Was protokolliert wird

- **Besetzung**: eingetragen und ausgetragen (selbst oder durch jemanden), Rolle geändert (rückt nach, wird Backup), Platz übernommen, Platz gegeben, ↑/↓, Platz ausgeschrieben (mit den Namen der Angeschriebenen), Aufruf an Qualifizierte (mit Anzahl).
- **Termin**: angelegt, geändert (je Feld alt → neu, auch die Zahlen), gelöscht, festgeschrieben, Festschreibung aufgehoben.
- **Kurs**: angelegt, geändert (alt → neu), gelöscht.
- **Person**: registriert (Einladung oder `ADMIN_EMAILS`), Name geändert (alt → neu), Telefon geändert (nur *dass*, keine Nummer), Qualifikation geändert, Praxisanleiterkoordinator:in ja/nein, entfernt.

Kontaktdaten (E-Mail, Telefon) stehen nie im Verlauf. Namen entfernter Personen bleiben stehen. Aufbewahrung unbegrenzt (einige tausend Zeilen pro Jahr). Für schon bestehende Daten wird kein Verlauf nachgetragen.

### Wo man ihn sieht

Nur Koordinator:innen, jeweils Neuestes oben, 50 Einträge, dann „Mehr anzeigen“:

- **Termin-Panel**: zugeklappter Abschnitt „Verlauf“ unten.
- **Kurs-Seite** (`/kurse/[id]`): Abschnitt „Verlauf“ mit allem zum Kurs und seinen Terminen, auch gelöschten.
- **Personen**: Tippen auf eine Person öffnet ein Sheet mit ihrem Verlauf: was mit ihr passiert ist und was sie selbst getan hat.

Darstellung als Sätze; Folgen derselben Aktion stehen eingerückt darunter:

> **Sa., 31.10., 14:05** · Lea Berger hat Anna Huber ausgetragen (Instruktor)
>   → 1 Instruktor-Platz ausgeschrieben, angeschrieben: Ben Maier, Clara Ott
>
> **Sa., 31.10., 16:40** · Ben Maier hat den Platz übernommen (Backup → Instruktor)

Es gibt keine Seite mit dem gesamten Verlauf. Der Verlauf eines gelöschten Kurses ist daher nur noch in der Datenbank.

## 6. Umsetzung

### Datenmodell (Migration `0002`)

```
termine
  + festgeschrieben                boolean NOT NULL DEFAULT false
  + instruktoren_ausgeschrieben    integer NOT NULL DEFAULT 0 CHECK (>= 0)
  + praxisanleiter_ausgeschrieben  integer NOT NULL DEFAULT 0 CHECK (>= 0)

audit_events
  id          uuid PK
  created_at  timestamptz NOT NULL DEFAULT now()
  action_id   uuid NOT NULL          -- alle Einträge einer Aktion
  actor_id    uuid NULL              -- kein FK
  actor_name  text NOT NULL          -- Name zum Zeitpunkt der Aktion
  type        text NOT NULL          -- z. B. 'signup.removed', 'termin.updated'
  termin_id   uuid NULL              -- kein FK
  kurs_id     uuid NULL              -- kein FK
  profile_id  uuid NULL              -- betroffene Person, kein FK
  data        jsonb NOT NULL DEFAULT '{}'
  INDEX (termin_id, created_at), (kurs_id, created_at),
        (profile_id, created_at), (actor_id, created_at)
```

Die Zähler sind nur bei festgeschriebenen Terminen > 0. `data` enthält eine Momentaufnahme dessen, was zum Lesen nötig ist (Kurs-Titel, Thema, Datum, Zeit, Name der Person), dazu typabhängig Rolle alt/neu, geänderte Felder `{ feld: [alt, neu] }`, Angeschriebene. Besetzungs-Einträge haben auch `kurs_id`, damit sie im Kurs-Verlauf erscheinen.

Event-Typen: `signup.created`, `signup.removed`, `signup.role_changed`, `signup.claimed`, `signup.place_given`, `signup.moved`, `place.ausgeschrieben`, `place.aufruf`, `termin.created`, `termin.updated`, `termin.deleted`, `termin.festgeschrieben`, `termin.aufgehoben`, `kurs.created`, `kurs.updated`, `kurs.deleted`, `person.registered`, `person.updated`, `person.qualification_changed`, `person.koordination_changed`, `person.removed`. Die Rollenänderung der Person, auf die eine Aktion zielt, steckt im Haupteintrag (z. B. `signup.claimed` mit alt → neu). Folgen für andere sind eigene `signup.role_changed`-Einträge mit derselben `action_id`.

### Reine Logik: `lib/staffing.ts`

- `Staffing` bekommt `instruktorenAusgeschrieben` und `praxisanleiterAusgeschrieben`. `rankSignups` vergibt fixe Plätze an die ersten `needed − ausgeschrieben` je Rolle. `missingPlaces` rechnet weiter gegen `needed`. `nextRole` liefert einen fixen Platz, solange einer ausgeschrieben ist.
- `isFestgeschrieben(termin, today)`: Flag oder 3-Monats-Grenze (siehe 2).
- `planAusschreibung(...)`: bekommt je Termin Zahlen und Zähler vorher und nachher, die Eintragungen vorher und nachher, ob der Termin festgeschrieben ist, und die Personen, die die Aktion ausdrücklich auf einen fixen Platz gesetzt hat (übernehmen, Platz geben). Liefert je Rolle den neuen Zähler und, falls ausgelöst, die Ausschreibung (Backups oder Aufruf an Qualifizierte). Rechenweg je Rolle:
  1. Zahl gesenkt um d: Zähler = max(0, Zähler − d).
  2. Termin vorbei: fertig, keine Ausschreibung.
  3. Termin nicht festgeschrieben: Zähler 0, fertig.
  4. Wer vorher Backup war, mit diesem Zähler jetzt fix wäre und nicht ausdrücklich gesetzt wurde, wird gezählt; der Zähler steigt um diese Anzahl. Das wiederholt sich, bis niemand mehr, der vorher Backup war und nicht ausdrücklich gesetzt wurde, fix wäre. Beispiel: N 2 → 4 mit zwei Fixen und einem Backup ergibt A = 2, das Backup bleibt Backup.
  5. Fehlen mit dem neuen Zähler mehr fixe Plätze als vorher: Ausschreibung, wenn es Backups dieser Rolle gibt, sonst Aufruf.

### Transaktion: `mutateStaffing` (`lib/dal/staffing-tx.ts`)

Neue Optionen `action` (Typ, Handelnde:r, Ziel; für Verlauf und Mails) und `bestaetigt`. Ablauf:

1. Termine sperren, Stand vorher lesen (inkl. Zähler, Flag).
2. `run` ausführen.
3. Stand nachher lesen, `planAusschreibung` anwenden, Zähler schreiben.
4. Löst die Aktion eine Ausschreibung aus und ist `bestaetigt` nicht gesetzt: `ConfirmationRequired` mit dem Dialogtext werfen. Die Transaktion wird zurückgerollt.
5. Empfänger ermitteln (Backups der Rolle bzw. Qualifizierte ohne Eintragung auf dem Termin, jeweils ohne die handelnde Person).
6. Verlauf-Einträge schreiben (Haupteintrag aus `action`, Folgen aus dem Rollen-Diff und der Ausschreibung).
7. Commit, dann Mails in der Reihenfolge aus 4 verschicken.

`appendSignup` setzt Neue an die erste Backup-Stelle und senkt den Zähler, solange ein Platz der Rolle ausgeschrieben ist; sonst wie bisher ans Ende.

### DAL

- `lib/dal/signups.ts`: neu `claimPlace(terminId)` (nur für Backups einer Rolle mit ausgeschriebenem Platz, Termin nicht vorbei) und `adminGivePlace(terminId, profileId)`. Beide: Zähler = 0 → `platz-vergeben`; Person kein Backup → `kein-backup`. `withdrawSelf` und `adminRemoveSignup` reichen `bestaetigt` durch.
- `lib/dal/kurse.ts`: neu `setFestgeschrieben(terminIds, value)` über `mutateStaffing` (Aufheben kann Nachrücken auslösen). `updateTermin` reicht `bestaetigt` durch.
- `lib/dal/profiles.ts`: `removePerson` reicht `bestaetigt` durch.
- Alle Änderungen außerhalb der Besetzung (Kurs anlegen/ändern, Termin anlegen, Profil, Qualifikation, Koordination, Registrierung) laufen in einer Transaktion mit `logEvents`.
- `lib/dal/audit.ts`: `logEvents(tx, …)`; lesen mit `requireAdmin`: `terminHistory(id)`, `kursHistory(id)`, `personHistory(id)` (Einträge mit `profile_id` oder `actor_id` = Person), je 50 Einträge mit Cursor auf `created_at`.
- `lib/dal/read-model.ts`: `TerminView` bekommt `festgeschrieben`, `festgeschriebenManuell` und `ausgeschrieben` je Rolle. *Wo du gebraucht wirst* enthält zusätzlich Termine, auf denen die Person Backup einer Rolle mit ausgeschriebenem Platz ist.

### Texte

- `lib/audit-text.ts` (rein): macht aus einem Eintrag den deutschen Satz für Verlauf und Mails.
- `lib/notifications.ts`: baut alle Besetzungs-Mails aus den Verlauf-Einträgen einer Aktion.

### Oberfläche und Fehler

- `ActionResult` bekommt die Variante `{ ok: false; confirm: string }`; `runAction` macht aus einem `ConfirmationRequired` diese Variante (ohne `refresh()`). Eine gemeinsame Client-Komponente zeigt dann den AlertDialog und schickt das Formular mit `bestaetigt=1` erneut. Eingesetzt bei: selbst austragen, jemanden austragen, Person entfernen, Termin speichern.
- Neue Domain-Fehler: `platz-vergeben` („Der Platz ist schon vergeben.“), `kein-backup` („Diese Person ist hier kein Backup.“).

## 7. Tests

Abweichend von der Grund-Spec gibt es jetzt automatische Tests, aber nur für reine Funktionen: Vitest (`pnpm test`), Dateien neben dem Code (`lib/*.test.ts`). Abgedeckt werden `rankSignups` mit Zähler, `planAusschreibung` (alle Auslöser und Randfälle aus 3), `isFestgeschrieben` (inkl. Monatsende) und `audit-text`. Kein DB-Setup, keine UI-Tests. Alles andere wird wie bisher von Hand geprüft: lokal gegen Supabase, Mails in der Konsole bzw. Mailpit. `pnpm test` kommt in die Befehlsliste in `AGENTS.md`.

## Nicht in diesem Umfang

- **Excel-Import von Kursen und Terminen**: eigene Spec, sobald die Beispieldatei vorliegt (eine Zeile = ein Termin, Spalte mit dem Kursnamen). Dort zu klären: Kursname existiert schon, dieselbe Datei zweimal hochgeladen, Vorschau vor dem Speichern. Der Import schreibt in den Verlauf.
- Tagesbericht für Koordinator:innen, Resend Pro.
- Seite mit dem gesamten Verlauf, Verlauf für Einladungslink und Logins.
- Platz übernehmen ohne Login per Link.
- Mail an die übrigen Backups, wenn der Platz übernommen wurde.
- Fristen oder Erinnerungen für ausgeschriebene Plätze.
- Einstellbare Grenze für das automatische Festschreiben (fix 3 Monate).
