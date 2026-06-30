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

export function buildPtBlueprintDocument(form: PtBlueprintFormInput): PtBlueprintDocument {
  const totalMarks =
    form.sections.reduce((s, r) => s + r.totalMarks, 0) ||
    form.chapters.reduce((s, c) => s + c.totalMarks, 0) ||
    form.units.reduce((s, u) => s + u.chapterTotal, 0);

  const totalQuestions = form.sections.reduce((s, r) => {
    const n = parseInt(r.questionCountLabel.replace(/\D/g, ""), 10);
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  const chapters = form.chapters.map((c, i) => ({
    ...c,
    serial: i + 1,
    totalMarks: c.totalMarks || form.units[i]?.chapterTotal || 0,
  }));

  const units = form.units.map((u, i) => ({
    ...u,
    unit: i + 1,
    chapterTotal: u.chapterTotal || chapters[i]?.totalMarks || 0,
  }));

  return { ...form, chapters, units, totalMarks, totalQuestions };
}
