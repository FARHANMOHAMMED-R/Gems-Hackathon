import type { PtBlueprintDocument, PtBlueprintForm } from "./ptBlueprintTypes";

export function buildPtBlueprintDocument(form: PtBlueprintForm): PtBlueprintDocument {
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

  return {
    ...form,
    chapters,
    units,
    totalMarks,
    totalQuestions,
  };
}
