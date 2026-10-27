import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TerminValues = {
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  location: string;
};

/** Desktop column layout shared by the Termin rows and their column headings. */
export const TERMIN_COLUMNS =
  "md:grid-cols-[9.5rem_6.5rem_6.5rem_minmax(0,1fr)_9rem]";

const FIELDS = [
  { key: "date", label: "Datum", type: "date", span: "" },
  { key: "startTime", label: "Von", type: "time", span: "" },
  { key: "endTime", label: "Bis", type: "time", span: "" },
  {
    key: "topic",
    label: "Thema",
    type: "text",
    span: "col-span-2 md:col-span-1",
  },
  {
    key: "location",
    label: "Ort",
    type: "text",
    span: "col-span-2 md:col-span-1",
  },
] as const;

/** One Termin's inputs; on phones each input shows its label, on desktop the columns do. */
export function TerminFields({
  values,
  onChange,
  rowLabel,
  idPrefix,
}: {
  values: TerminValues;
  onChange: (values: TerminValues) => void;
  /** e.g. "Tag 2", used in the accessible names. */
  rowLabel: string;
  idPrefix: string;
}) {
  return (
    <div className={cn("grid flex-1 grid-cols-2 gap-2.5", TERMIN_COLUMNS)}>
      {FIELDS.map((field) => (
        <label
          key={field.key}
          htmlFor={`${idPrefix}-${field.key}`}
          className={cn("flex min-w-0 flex-col gap-1", field.span)}
        >
          <span className="text-xs font-semibold text-muted-foreground md:sr-only">
            {field.label}
            <span className="sr-only"> {rowLabel}</span>
          </span>
          <Input
            id={`${idPrefix}-${field.key}`}
            name={field.key}
            type={field.type}
            value={values[field.key]}
            onChange={(event) =>
              onChange({ ...values, [field.key]: event.target.value })
            }
            required={field.key !== "location"}
            placeholder={field.key === "location" ? "optional" : undefined}
            className="px-2.5"
          />
        </label>
      ))}
    </div>
  );
}

/** Column headings above a list of TerminFields (desktop only). */
export function TerminColumnHeads({ trailing }: { trailing: string }) {
  return (
    <div aria-hidden="true" className="hidden items-center gap-3 md:flex">
      <span className="w-7" />
      <div
        className={cn(
          "grid flex-1 gap-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
          TERMIN_COLUMNS,
        )}
      >
        {FIELDS.map((field) => (
          <span key={field.key}>{field.label}</span>
        ))}
      </div>
      <span className={trailing} />
    </div>
  );
}
