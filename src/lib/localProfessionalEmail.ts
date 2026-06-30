/** Draft a professional email without an LLM — formats teacher notes cleanly. */
export function draftProfessionalEmailLocally(
  authorName: string,
  content: string,
  fileContext?: string,
): { subject: string; body: string } {
  const trimmed = content.trim();
  const firstLine = trimmed.split(/\n+/)[0]?.replace(/^[-•*]\s*/, "").trim() ?? "";
  const subject =
    firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine || "Professional communication";

  const paragraphs = trimmed
    .split(/\n{2,}|\n(?=[-•*])/)
    .map((p) => p.trim())
    .filter(Boolean);

  const bodyParts = ["Dear Colleague,", "", ...paragraphs];

  if (fileContext?.trim()) {
    bodyParts.push("", "Additional context from attached notes:", fileContext.trim());
  }

  bodyParts.push("", "Best regards,", authorName.trim() || "Teacher");

  return { subject, body: bodyParts.join("\n") };
}
