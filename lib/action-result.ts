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
    if (error instanceof DomainError) {
      refresh();
      return { ok: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }
    console.error(error);
    return {
      ok: false,
      error: "Etwas ist schiefgelaufen. Bitte versuch es nochmal.",
    };
  }
}
