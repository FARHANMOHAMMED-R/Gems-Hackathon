import type { PtBlueprintDocument, PtBlueprintForm } from "./ptBlueprintTypes";
import { computeUnitChapterTotal, parseQuestionCount } from "./ptBlueprintUtils";

export function buildPtBlueprintDocument(form: PtBlueprintForm): PtBlueprintDocument {
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

  return {
    ...form,
    chapters,
    units,
    totalMarks,
    totalQuestions,
  };
}
