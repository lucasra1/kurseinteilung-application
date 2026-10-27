"use client";

import { useRouter } from "next/navigation";

/** Kurs dropdown; each choice navigates to the matching prebuilt URL. */
export function KursFilter({
  kurse,
  value,
  hrefs,
}: {
  kurse: { id: string; title: string }[];
  value: string | undefined;
  /** Kurs id ("" for all Kurse) → URL with the other filters kept. */
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  if (kurse.length < 2) return null;
  return (
    <>
      <label htmlFor="kurs-filter" className="sr-only">
        Kurs
      </label>
      <select
        id="kurs-filter"
        value={value ?? ""}
        onChange={(event) =>
          router.push(hrefs[event.target.value], { scroll: false })
        }
        className="h-11 max-w-56 rounded-xl border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Alle Kurse</option>
        {kurse.map((kurs) => (
          <option key={kurs.id} value={kurs.id}>
            {kurs.title}
          </option>
        ))}
      </select>
    </>
  );
}
