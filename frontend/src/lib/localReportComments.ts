/** Built-in report comment drafting — no external API key required. */
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

  function toSentences(text: string): string[] {
    return text
      .split(/\n+/)
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .map((line) => (/[.!?]$/.test(line) ? line : `${line}.`));
  }

  const subj = subjectPronoun(input.studentPronouns);
  const obj = objectPronoun(input.studentPronouns);
  const pos = possessive(input.studentPronouns);
  const grade = input.gradeLevel.trim() || "this grade level";

  const strengthLines = [
    ...toSentences(input.strengths),
    ...(input.strengthsFileContext?.trim() ? toSentences(input.strengthsFileContext) : []),
  ];
  const growthLines = [
    ...toSentences(input.growthAreas),
    ...(input.growthFileContext?.trim() ? toSentences(input.growthFileContext) : []),
  ];

  const strengthPara =
    strengthLines.length > 0
      ? `${subj} demonstrates several strengths this term. ${strengthLines.join(" ")}`
      : `${subj} contributes positively to our ${grade} classroom community.`;

  const growthPara =
    growthLines.length > 0
      ? `Areas for continued growth include the following goals: ${growthLines.join(" ")} With consistent practice and support, ${subj.toLowerCase()} can make strong progress in these areas.`
      : `With continued effort, ${subj.toLowerCase()} can build on ${pos} strengths in the coming term.`;

  const closing = `Overall, ${subj.toLowerCase()} is a valued member of our class, and I look forward to supporting ${obj} as ${subj.toLowerCase()} continues to grow academically and personally.`;

  return { comment: [strengthPara, growthPara, closing].join("\n\n") };
}
