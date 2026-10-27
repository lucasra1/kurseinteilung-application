import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type KursValues = { title: string; description: string };

/** Title and description of a Kurs (controlled, so failed saves keep the input). */
export function KursFields({
  values,
  onChange,
}: {
  values: KursValues;
  onChange: (values: KursValues) => void;
}) {
  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className="text-sm font-semibold">
          Titel
        </Label>
        <Input
          id="title"
          name="title"
          value={values.title}
          onChange={(event) =>
            onChange({ ...values, title: event.target.value })
          }
          placeholder="z. B. Erste Hilfe Grundkurs (16 h)"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="text-sm font-semibold">
          Beschreibung{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          value={values.description}
          onChange={(event) =>
            onChange({ ...values, description: event.target.value })
          }
          placeholder="Was alle vorab wissen sollten, z. B. Material oder Treffpunkt."
          className="min-h-11"
        />
      </div>
    </div>
  );
}
