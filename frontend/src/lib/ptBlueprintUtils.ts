/** Leading count from labels like "6 (3 MCQ & 3 AR)" or "3". */
export function parseQuestionCount(label: string): number {
  const trimmed = label.trim();
  const lead = trimmed.match(/^(\d+)/);
  if (lead) return parseInt(lead[1], 10);
  const parts = trimmed.match(/\d+/g);
  if (!parts?.length) return 0;
  if (/&|\+|\band\b/i.test(trimmed) && parts.length > 1) {
    return parts.reduce((s, p) => s + parseInt(p, 10), 0);
  }
  return parseInt(parts[0], 10);
}

export function countQuestionsInCell(text: string): number {
  if (!text.trim()) return 0;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const qMatch = line.match(/^(\d+)\s*QUEST/i);
    if (qMatch) return parseInt(qMatch[1], 10);
    const qnMatch = line.match(/^(\d+)\s*QN\b/i);
    if (qnMatch) return parseInt(qnMatch[1], 10);
  }

  const qNos = lines.filter((l) => /Q\.?\s*NO\.?\s*\d+/i.test(l));
  if (qNos.length) return qNos.length;

  return 0;
}

export function computeUnitChapterTotal(unit: {
  mark1: string;
  mark2: string;
  mark3: string;
  mark4CaseBased: string;
  mark5: string;
}): number {
  return (
    countQuestionsInCell(unit.mark1) * 1 +
    countQuestionsInCell(unit.mark2) * 2 +
    countQuestionsInCell(unit.mark3) * 3 +
    countQuestionsInCell(unit.mark4CaseBased) * 4 +
    countQuestionsInCell(unit.mark5) * 5
  );
}

export function lineTagClass(line: string): string {
  const trimmed = line.trim();
  if (/\(\s*k\s*\/\s*u\s*\)/i.test(trimmed)) return "gems-bp-line tag-ku";
  if (/\(\s*app\s*\)/i.test(trimmed)) return "gems-bp-line tag-app";
  if (/^HOT$/i.test(trimmed) || /\(\s*hot\s*\)/i.test(trimmed)) return "gems-bp-line tag-hot";
  if (/INTERNAL CHOICE/i.test(trimmed)) return "gems-bp-line tag-choice";
  return "gems-bp-line";
}
