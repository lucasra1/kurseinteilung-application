"use client";

import { MailCheck } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "./actions";

/** Controlled, so a failed submit (e.g. no qualification ticked) keeps what was typed. */
export function InviteForm({ token }: { token: string }) {
  const [result, formAction] = useActionState(register, null);
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    phone: "",
    isInstruktor: false,
    isPraxisanleiter: false,
  });
  const set = (patch: Partial<typeof values>) =>
    setValues({ ...values, ...patch });

  if (result?.ok) {
    return (
      <output className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-green-100 text-green-800">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <p className="text-lg font-semibold">Fast geschafft!</p>
        <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
          Wir haben dir einen Login-Link an{" "}
          <strong className="font-semibold text-foreground">
            {values.email}
          </strong>{" "}
          geschickt. Öffne ihn, dann kannst du dir deine Termine aussuchen.
        </p>
      </output>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName" className="text-sm font-semibold">
          Vor- und Nachname
        </Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="z. B. Julia Steiner"
          value={values.fullName}
          onChange={(event) => set({ fullName: event.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-sm font-semibold">
          E-Mail
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@beispiel.at"
          value={values.email}
          onChange={(event) => set({ email: event.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone" className="text-sm font-semibold">
          Telefon{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+43 …"
          aria-describedby="phone-hint"
          value={values.phone}
          onChange={(event) => set({ phone: event.target.value })}
        />
        <span id="phone-hint" className="text-[13px] text-muted-foreground">
          Sehen nur Admins, falls kurzfristig etwas ist.
        </span>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold">
          Deine Qualifikation
        </legend>
        <QualificationOption
          name="isInstruktor"
          label="Instruktor"
          checked={values.isInstruktor}
          onChange={(checked) => set({ isInstruktor: checked })}
        />
        <QualificationOption
          name="isPraxisanleiter"
          label="Praxisanleiter"
          checked={values.isPraxisanleiter}
          onChange={(checked) => set({ isPraxisanleiter: checked })}
        />
        <span className="text-[13px] text-muted-foreground">
          Mindestens eine. Du siehst dann die Termine, die dazu passen.
        </span>
      </fieldset>
      <FormMessage result={result} />
      <SubmitButton size="lg" className="w-full" pendingText="Wird gesendet…">
        Login-Link schicken
      </SubmitButton>
    </form>
  );
}

function QualificationOption({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3.5 text-[15px] font-medium transition-colors has-checked:border-primary has-checked:bg-brand-50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-primary"
      />
      {label}
    </label>
  );
}
