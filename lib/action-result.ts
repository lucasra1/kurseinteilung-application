import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ConfirmationRequired, DomainError } from "@/lib/errors";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  /** Nothing happened yet: show `confirm` in the Warndialog, then resend with `bestaetigt=1`. */
  | { ok: false; confirm: string }
  | null;

/** What a reading Server Action returns: its data, or the message of an expected error. */
export type DataResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** The German message for a failed action; unexpected errors are logged. */
function errorMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Ungültige Eingabe.";
  }
  console.error(error);
  return "Etwas ist schiefgelaufen. Bitte versuch es nochmal.";
}

/**
 * Runs a Server Action body: on success refreshes the current page and returns the
 * message `fn` returned; expected errors become a German message for the form. A
 * DomainError usually means the data changed meanwhile (e.g. "ausgebucht"), so the page
 * is refreshed then too. A needed confirmation changed nothing, so it doesn't refresh.
 */
export async function runAction(
  fn: () => Promise<unknown>,
): Promise<ActionResult> {
  try {
    const message = await fn();
    refresh();
    return {
      ok: true,
      message: typeof message === "string" ? message : undefined,
    };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ConfirmationRequired) {
      return { ok: false, confirm: error.message };
    }
    if (error instanceof DomainError) refresh();
    return { ok: false, error: errorMessage(error) };
  }
}

/** Runs a Server Action that only reads: `fn`'s data, or the message of an expected error. */
export async function runQuery<T>(
  fn: () => Promise<T>,
): Promise<DataResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}
