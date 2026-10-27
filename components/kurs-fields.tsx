import { Stepper } from "@/components/stepper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type KursValues = {
  title: string;
  description: string;
  trainersNeeded: number;
  backupsNeeded: number;
};

/** Title, description and staffing of a Kurs (controlled, so failed saves keep the input). */
export function KursFields({
  values,
  onChange,
}: {
  values: KursValues;
  onChange: (values: KursValues) => void;
}) {
  const set = (patch: Partial<KursValues>) => onChange({ ...values, ...patch });
  const { trainersNeeded: t, backupsNeeded: b } = values;
  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title" className="text-sm font-semibold">
            Titel
          </Label>
          <Input
            id="title"
            name="title"
            value={values.title}
            onChange={(event) => set({ title: event.target.value })}
            placeholder="z. B. Erste Hilfe Grundkurs (16 h)"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description" className="text-sm font-semibold">
            Beschreibung{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            value={values.description}
            onChange={(event) => set({ description: event.target.value })}
            placeholder="Was Trainer vorab wissen sollten, z. B. Material oder Treffpunkt."
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold">
            Besetzung pro Termin
          </legend>
          <Stepper
            id="trainersNeeded"
            name="trainersNeeded"
            label="Trainer"
            value={t}
            min={1}
            onChange={(value) => set({ trainersNeeded: value })}
          />
          <Stepper
            id="backupsNeeded"
            name="backupsNeeded"
            label="Backup"
            value={b}
            min={0}
            onChange={(value) => set({ backupsNeeded: value })}
          />
        </fieldset>
        <p className="rounded-xl bg-muted p-3 text-[13px] leading-relaxed text-zinc-700">
          {t === 1
            ? "Wer sich zuerst einträgt, wird Trainer"
            : `Die ersten ${t}, die sich eintragen, werden Trainer`}
          {b > 0 &&
            `, ${b === 1 ? "die nächste Person" : `die nächsten ${b}`} Backup`}
          . Danach ist der Termin voll.
        </p>
      </div>
    </div>
  );
}
