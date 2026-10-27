import type { ActionResult } from "@/lib/action-result";

/** The result of a form action; a needed confirmation is the Warndialog's, not shown here. */
export function FormMessage({ result }: { result: ActionResult }) {
  if (!result) return null;
  if (!result.ok) {
    if ("confirm" in result) return null;
    return (
      <p role="alert" className="text-sm text-destructive">
        {result.error}
      </p>
    );
  }
  if (!result.message) return null;
  return (
    <output className="block text-sm text-green-700 dark:text-green-400">
      {result.message}
    </output>
  );
}

/** The Warndialog text if the action needs a confirmation first. */
export function confirmationOf(result: ActionResult): string | null {
  return result && !result.ok && "confirm" in result ? result.confirm : null;
}
