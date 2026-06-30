function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function deriveSubject(headline: string): string {
  const raw = headline.replace(/^[-•*]\s*/, "").trim();
  if (!raw) return "Professional communication";
  const withoutPeriod = raw.replace(/[.!?]$/, "");
  const subject =
    withoutPeriod.length > 72 ? `${withoutPeriod.slice(0, 69)}…` : withoutPeriod;
  return capitalize(subject);
}

/** Built-in smart email drafting — no external API key required. */
export function draftProfessionalEmailLocally(
  authorName: string,
  content: string,
  fileContext?: string,
): { subject: string; body: string } {
  const bullets = toBullets(content);
  const extra = fileContext?.trim() ? toBullets(fileContext) : [];
  const subject = deriveSubject(bullets[0] ?? extra[0] ?? "Professional communication");

  const lead = bullets[0] ?? extra[0] ?? "";
  const detailItems = [...bullets.slice(1), ...(bullets.length ? extra : extra.slice(1))];

  const bodyParts = ["Dear Colleague,", ""];

  if (lead) {
    bodyParts.push(
      `I am writing regarding ${lead.charAt(0).toLowerCase()}${lead.slice(1).replace(/[.!?]$/, "")}.`,
    );
  } else {
    bodyParts.push("I wanted to share a brief professional update with you.");
  }

  if (detailItems.length > 0) {
    bodyParts.push("", "Key points:");
    for (const item of detailItems) {
      bodyParts.push(`• ${ensurePeriod(item)}`);
    }
  }

  bodyParts.push(
    "",
    "Please let me know if you have any questions or if you would like to discuss this further.",
    "",
    "Best regards,",
    authorName.trim() || "Teacher",
  );

  return { subject, body: bodyParts.join("\n") };
}
