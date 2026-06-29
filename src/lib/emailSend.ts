import { ApiError } from "./http";

export class MailConfigError extends Error {}

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() ||
      (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim()),
  );
}

function mailFrom(): string {
  return (
    process.env.MAIL_FROM?.trim() ||
    "Gems Assist <onboarding@resend.dev>"
  );
}

function validateAddress(email: string, label: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, `Invalid ${label} address.`, "INVALID_EMAIL");
  }
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new MailConfigError("RESEND_API_KEY is not set.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      reply_to: opts.replyTo,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new ApiError(
      502,
      body.message ?? `Email provider error (${res.status}).`,
      "MAIL_SEND_FAILED",
    );
  }

  return body.id ?? "sent";
}

async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<string> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    throw new MailConfigError("SMTP_HOST, SMTP_USER, and SMTP_PASS are required for SMTP.");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const info = await transport.sendMail({
    from: mailFrom(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    replyTo: opts.replyTo,
  });

  return info.messageId ?? "sent";
}

/** Send one plain-text email via Resend (preferred) or SMTP. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ messageId: string; provider: "resend" | "smtp" }> {
  validateAddress(opts.to, "recipient");
  if (opts.replyTo) validateAddress(opts.replyTo, "reply-to");

  if (process.env.RESEND_API_KEY?.trim()) {
    const messageId = await sendViaResend(opts);
    return { messageId, provider: "resend" };
  }
  if (process.env.SMTP_HOST?.trim()) {
    const messageId = await sendViaSmtp(opts);
    return { messageId, provider: "smtp" };
  }

  throw new MailConfigError(
    "Email is not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS in .env.",
  );
}

export function defaultMailSubject(studentName: string, classManaged: string): string {
  return `Class update for ${studentName} — ${classManaged}`;
}
