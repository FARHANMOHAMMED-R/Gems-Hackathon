import type { PtBlueprintForm, PtSectionRow, PtUnitRow } from "./ptBlueprintTypes";

export const DEFAULT_PT_SECTIONS: PtSectionRow[] = [
  {
    sectionId: "A",
    typology: "MCQ",
    questionCountLabel: "6 (3 MCQ & 3 AR)",
    marksPerQuestion: 1,
    totalMarks: 6,
  },
  {
    sectionId: "B",
    typology: "SHORT ANSWER TYPE",
    questionCountLabel: "3",
    marksPerQuestion: 2,
    totalMarks: 6,
  },
  {
    sectionId: "C",
    typology: "CASE STUDY",
    questionCountLabel: "1",
    marksPerQuestion: 4,
    totalMarks: 4,
  },
  {
    sectionId: "D",
    typology: "LONG ANSWER TYPE",
    questionCountLabel: "3",
    marksPerQuestion: 3,
    totalMarks: 9,
  },
  {
    sectionId: "E",
    typology: "VERY LONG ANSWER TYPE",
    questionCountLabel: "1",
    marksPerQuestion: 5,
    totalMarks: 5,
  },
];

export const CHEMISTRY_PT1_EXEMPLAR: PtBlueprintForm = {
  schoolName: "GEMS UNITED INDIAN SCHOOL, ABU DHABI",
  blueprintTitle: "PT 1 BLUEPRINT – 2026-27",
  grade: "11",
  subject: "CHEMISTRY",
  sections: DEFAULT_PT_SECTIONS.map((s) => ({ ...s })),
  chapters: [
    { serial: 1, chapterName: "SOME BASIC CONCEPTS OF CHEMISTRY", totalMarks: 11 },
    { serial: 2, chapterName: "STRUCTURE OF ATOM", totalMarks: 13 },
    { serial: 3, chapterName: "PERIODIC CLASSIFICATION OF ELEMENT", totalMarks: 6 },
  ],
  units: [
    {
      unit: 1,
      concept: "SOME BASIC CONCEPTS OF CHEMISTRY",
      mark1: "2 QUESTIONS\nQ.NO.1 (K/U)\nQ.NO. 3 (K/U)",
      mark2: "1 QUESTION\nQ.NO.9 (APP)",
      mark3: "1 QN (K/U)\nQ.No.11",
      mark4CaseBased: "1 QUESTION\nHOT\nQ.No.13",
      mark5: "",
      chapterTotal: 11,
    },
    {
      unit: 2,
      concept: "STRUCTURE OF ATOM",
      mark1: "3 QUESTIONS\nQ.NO.2 (K/U)\nQ.NO.4 (APP)\nQ.NO. 5 (K/U)",
      mark2: "1 QUESTION\nQ.NO.7 (APP)",
      mark3: "1 Question\nQ.No.12\nHOT",
      mark4CaseBased: "",
      mark5: "1 QN\n(APP)\n(INTERNAL CHOICE)\nQ.No.14",
      chapterTotal: 13,
    },
    {
      unit: 3,
      concept: "PERIODIC CLASSIFICATION OF ELEMENT",
      mark1: "1 QUESTION\nQ.NO. 6 (APP)",
      mark2: "1 QUESTION\nQ.NO. 8",
      mark3: "1 QN (HOT)\nQ.No.10\n(INTERNAL CHOICE)",
      mark4CaseBased: "",
      mark5: "",
      chapterTotal: 6,
    },
  ],
};

export function emptyUnitRow(unit: number): PtUnitRow {
  return {
    unit,
    concept: "",
    mark1: "",
    mark2: "",
    mark3: "",
    mark4CaseBased: "",
    mark5: "",
    chapterTotal: 0,
  };
}
