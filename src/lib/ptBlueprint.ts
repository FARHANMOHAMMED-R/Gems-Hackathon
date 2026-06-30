import { z } from "zod";

const sectionSchema = z.object({
  sectionId: z.string().min(1),
  typology: z.string().min(1),
  questionCountLabel: z.string().min(1),
  marksPerQuestion: z.number().int().min(1),
  totalMarks: z.number().int().min(0),
});

const chapterSchema = z.object({
  serial: z.number().int().min(1),
  chapterName: z.string().min(1),
  totalMarks: z.number().int().min(0),
});

const unitSchema = z.object({
  unit: z.number().int().min(1),
  concept: z.string().min(1),
  mark1: z.string(),
  mark2: z.string(),
  mark3: z.string(),
  mark4CaseBased: z.string(),
  mark5: z.string(),
  chapterTotal: z.number().int().min(0),
});

export const ptBlueprintFormSchema = z.object({
  schoolName: z.string().trim().min(1),
  blueprintTitle: z.string().trim().min(1),
  grade: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  sections: z.array(sectionSchema).min(1),
  chapters: z.array(chapterSchema).min(1),
  units: z.array(unitSchema).min(1),
});

export type PtBlueprintFormInput = z.infer<typeof ptBlueprintFormSchema>;

export interface PtBlueprintDocument extends PtBlueprintFormInput {
  totalQuestions: number;
  totalMarks: number;
}

function parseQuestionCount(label: string): number {
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

function countQuestionsInCell(text: string): number {
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

function computeUnitChapterTotal(unit: {
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

export function buildPtBlueprintDocument(form: PtBlueprintFormInput): PtBlueprintDocument {
  const totalMarks = form.sections.reduce((s, r) => s + r.totalMarks, 0);

  const totalQuestions = form.sections.reduce(
    (s, r) => s + parseQuestionCount(r.questionCountLabel),
    0,
  );

  const units = form.units.map((u, i) => {
    const computed = computeUnitChapterTotal(u);
    const chapterTotal = u.chapterTotal > 0 ? u.chapterTotal : computed;
    return {
      ...u,
      unit: i + 1,
      concept: u.concept || form.chapters[i]?.chapterName || "",
      chapterTotal,
    };
  });

  const chapters = form.chapters.map((c, i) => ({
    ...c,
    serial: i + 1,
    totalMarks: c.totalMarks > 0 ? c.totalMarks : units[i]?.chapterTotal || 0,
  }));

  return { ...form, chapters, units, totalMarks, totalQuestions };
}
