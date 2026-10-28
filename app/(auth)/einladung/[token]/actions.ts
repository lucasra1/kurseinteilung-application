"use server";

import { redirect } from "next/navigation";
import { type ActionResult, runAction } from "@/lib/action-result";
import { registerViaInvite } from "@/lib/dal/auth-flows";
import { setDemoPersona } from "@/lib/dal/demo";
import { env } from "@/lib/env";
import { inviteSchema } from "@/lib/validation";

export async function register(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { token, ...input } = inviteSchema.parse(
      Object.fromEntries(formData),
    );
    const profileId = await registerViaInvite(token, input);
    if (env.DEMO_MODE) {
      // No email in the demo: logged in right away. `als` switches a Schaufenster frame too.
      await setDemoPersona(profileId);
      redirect(`/termine?als=${profileId}`);
    }
    return "Wir haben dir einen Login-Link geschickt. Schau in dein Postfach.";
  });
}
