"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { createKursAction } from "@/app/(app)/kurse/actions";
import { FormMessage } from "@/components/form-message";
import { KursFields, type KursValues } from "@/components/kurs-fields";
import { SubmitButton } from "@/components/submit-button";
import {
  TerminColumnHeads,
  TerminFields,
  type TerminValues,
} from "@/components/termin-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { nextDay } from "@/lib/dates";

type Row = TerminValues & { key: number };

/** A Kurs and all its Termine in one go; "Weiterer Tag" copies time and place. */
export function KursCreateForm() {
  const [kurs, setKurs] = useState<KursValues>({
    title: "",
    description: "",
    trainersNeeded: 3,
    backupsNeeded: 2,
  });
  const [rows, setRows] = useState<Row[]>([
    {
      key: 0,
      date: "",
      startTime: "09:00",
      endTime: "17:00",
      topic: "",
      location: "",
    },
  ]);
  const nextKey = useRef(1);
  const [result, formAction] = useActionState(createKursAction, null);

  function addDay() {
    const last = rows[rows.length - 1];
    const key = nextKey.current++;
    setRows([
      ...rows,
      {
        key,
        date: last.date ? nextDay(last.date) : "",
        startTime: last.startTime,
        endTime: last.endTime,
        topic: "",
        location: last.location,
      },
    ]);
  }

  const count = `${rows.length} ${rows.length === 1 ? "Termin" : "Terminen"}`;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-5">
        <section
          aria-labelledby="kurs-heading"
          className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
        >
          <h2 id="kurs-heading" className="text-[17px] font-semibold">
            Kurs
          </h2>
          <KursFields values={kurs} onChange={setKurs} />
        </section>

        <section
          aria-labelledby="termine-heading"
          className="flex min-w-0 flex-col gap-3.5 rounded-2xl border bg-card p-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 id="termine-heading" className="text-[17px] font-semibold">
              Termine
            </h2>
            <span className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "Termin" : "Termine"}
            </span>
          </div>
          <TerminColumnHeads trailing="w-11" />
          <ol className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li
                key={row.key}
                className="flex items-start gap-3 rounded-xl border p-3 md:border-0 md:p-0"
              >
                <span className="mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold md:mt-2">
                  {index + 1}
                </span>
                <TerminFields
                  idPrefix={`termin-${row.key}`}
                  rowLabel={`Tag ${index + 1}`}
                  values={row}
                  onChange={(values) =>
                    setRows(
                      rows.map((r) =>
                        r.key === row.key ? { ...values, key: r.key } : r,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Tag ${index + 1} entfernen`}
                  disabled={rows.length === 1}
                  onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            <Button
              type="button"
              variant="outline"
              className="border-dashed"
              onClick={addDay}
            >
              <Plus aria-hidden="true" />
              Weiterer Tag
            </Button>
            <span className="text-[13px] text-muted-foreground">
              Übernimmt Uhrzeit und Ort, Datum einen Tag später.
            </span>
          </div>
        </section>
      </div>

      <div className="flex flex-col items-end gap-2.5">
        <FormMessage result={result} />
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <Link href="/kurse" className={buttonVariants({ variant: "ghost" })}>
            Abbrechen
          </Link>
          <SubmitButton size="lg" pendingText="Wird angelegt…">
            Kurs mit {count} anlegen
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
