/** Draft report card comments in the browser when the backend is offline. */
export function draftReportCommentsLocally(input: {
  gradeLevel: string;
  studentPronouns: string;
  strengths: string;
  growthAreas: string;
  strengthsFileContext?: string;
  growthFileContext?: string;
}): { comment: string } {
  function subjectPronoun(pronouns: string): string {
    const p = pronouns.trim().toLowerCase();
    if (p.startsWith("he")) return "He";
    if (p.startsWith("she")) return "She";
    if (p.startsWith("they")) return "They";
    return "This student";
  }

  function objectPronoun(pronouns: string): string {
    const p = pronouns.trim().toLowerCase();
    if (p.startsWith("he")) return "him";
    if (p.startsWith("she")) return "her";
    if (p.startsWith("they")) return "them";
    return "them";
  }

  function possessive(pronouns: string): string {
    const p = pronouns.trim().toLowerCase();
    if (p.startsWith("he")) return "his";
    if (p.startsWith("she")) return "her";
    if (p.startsWith("they")) return "their";
    return "their";
  }

  function formatBullets(text: string): string {
    return text
      .trim()
      .split(/\n+/)
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .join(". ");
  }

  const subj = subjectPronoun(input.studentPronouns);
  const obj = objectPronoun(input.studentPronouns);
  const pos = possessive(input.studentPronouns);

  let strengthText = formatBullets(input.strengths);
  if (input.strengthsFileContext?.trim()) {
    strengthText = strengthText
      ? `${strengthText}. ${formatBullets(input.strengthsFileContext)}`
      : formatBullets(input.strengthsFileContext);
  }

  let growthText = formatBullets(input.growthAreas);
  if (input.growthFileContext?.trim()) {
    growthText = growthText
      ? `${growthText}. ${formatBullets(input.growthFileContext)}`
      : formatBullets(input.growthFileContext);
  }

  const grade = input.gradeLevel.trim() || "this grade";

  const p1 = `${subj} has shown meaningful progress this year in ${grade}. ${strengthText || `${subj} contributes positively to class.`}`;

  const p2 = growthText
    ? `Moving forward, ${subj.toLowerCase()} will benefit from focusing on: ${growthText}. With continued support at home and school, ${subj.toLowerCase()} can build on ${pos} strengths in the coming term.`
    : `With continued effort, ${subj.toLowerCase()} can build on ${pos} strengths in the coming term.`;

  const p3 = `I appreciate ${pos} engagement and look forward to seeing ${obj} continue to grow.`;

  return { comment: [p1, p2, p3].join("\n\n") };
}
