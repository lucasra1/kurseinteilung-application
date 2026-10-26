import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; text: string };

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** Sends via Resend; without RESEND_API_KEY (local dev) the email is logged instead. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!resend) {
    console.info(
      `[email] An: ${message.to}\nBetreff: ${message.subject}\n\n${message.text}\n`,
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
