/** GEMS PT blueprint — matches school PT1 format. */

export type CognitiveTag = "K/U" | "APP" | "HOT";

export interface PtSectionRow {
  sectionId: string;
  typology: string;
  questionCountLabel: string;
  marksPerQuestion: number;
  totalMarks: number;
}

export interface PtChapterRow {
  serial: number;
  chapterName: string;
  totalMarks: number;
}

export interface PtUnitRow {
  unit: number;
  concept: string;
  mark1: string;
  mark2: string;
  mark3: string;
  mark4CaseBased: string;
  mark5: string;
  chapterTotal: number;
}

export interface PtBlueprintForm {
  schoolName: string;
  blueprintTitle: string;
  grade: string;
  subject: string;
  sections: PtSectionRow[];
  chapters: PtChapterRow[];
  units: PtUnitRow[];
}

export interface PtBlueprintDocument extends PtBlueprintForm {
  totalQuestions: number;
  totalMarks: number;
}
