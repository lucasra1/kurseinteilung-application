import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/dal/auth";
import { listDemoPeople, listOwnDemoMails } from "@/lib/dal/demo";
import { DEMO_PERSONA_HEADER } from "@/lib/demo";
import { env } from "@/lib/env";
import { DemoClientLazy } from "./demo-client-lazy";

/** The demo's bar, mailbox and tour around the app; nothing unless DEMO_MODE is set. */
export async function DemoChrome() {
  if (!env.DEMO_MODE) return null;
  const [user, mails, people, requestHeaders] = await Promise.all([
    getCurrentUser(),
    listOwnDemoMails(),
    listDemoPeople(),
    headers(),
  ]);
  return (
    <DemoClientLazy
      // Only Schaufenster frames send the persona header.
      framed={requestHeaders.has(DEMO_PERSONA_HEADER)}
      persona={user && { id: user.id, fullName: user.fullName }}
      people={people}
      mails={mails.map((mail) => ({
        ...mail,
        createdAt: mail.createdAt.toISOString(),
      }))}
    />
  );
}
