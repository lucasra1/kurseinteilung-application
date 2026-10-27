const MESSAGES = {
  "nicht-qualifiziert": "Dafür fehlt die passende Qualifikation.",
  "rolle-nicht-gebraucht":
    "Diese Rolle wird bei diesem Termin nicht gebraucht.",
  "bereits-eingetragen": "Diese Person ist für den Termin bereits eingetragen.",
  "nicht-eingetragen": "Diese Person ist für den Termin nicht eingetragen.",
  "termin-vorbei": "Dieser Termin liegt in der Vergangenheit.",
  "nicht-gefunden": "Eintrag nicht gefunden.",
  "einladung-ungueltig":
    "Dieser Einladungslink ist ungültig – bitte beim Admin melden.",
  "letzter-admin":
    "Der letzte Admin kann nicht entfernt oder herabgestuft werden.",
  "admin-aus-env":
    "Dieser Admin ist fix eingetragen und kann hier nicht geändert werden.",
  "selbst-entfernen": "Du kannst dich nicht selbst entfernen.",
  "zu-viele-anfragen":
    "Bitte warte einen Moment, bevor du einen neuen Login-Link anforderst.",
} as const;

export type DomainErrorCode = keyof typeof MESSAGES;

/** An expected business-rule violation whose message is shown to the user as is. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode) {
    super(MESSAGES[code]);
    this.name = "DomainError";
    this.code = code;
  }
}
