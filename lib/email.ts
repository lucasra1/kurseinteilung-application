import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; text: string };

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Resend accepts up to 100 emails per batch request.
const BATCH_SIZE = 100;

/**
 * Sends via Resend's batch API, one request per 100 emails, so a burst of notifications
 * stays within Resend's rate limit (2 requests/second). Without RESEND_API_KEY (local dev)
 * the emails are logged instead.
 */
export async function sendEmails(messages: EmailMessage[]): Promise<void> {
  if (messages.length === 0) return;
  if (!resend) {
    for (const message of messages) {
      console.info(
        `[email] An: ${message.to}\nBetreff: ${message.subject}\n\n${message.text}\n`,
      );
    }
    return;
  }
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const { error } = await resend.batch.send(
      messages.slice(i, i + BATCH_SIZE).map((message) => ({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
      })),
    );
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}
