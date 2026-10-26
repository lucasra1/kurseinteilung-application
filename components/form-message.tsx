import type { ActionResult } from "@/lib/action-result";

export function FormMessage({ result }: { result: ActionResult }) {
  if (!result) return null;
  if (!result.ok) {
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
