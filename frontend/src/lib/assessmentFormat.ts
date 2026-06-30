import type { GeneratedAssessment } from "../api/types";

export function formatAssessmentForStudents(a: GeneratedAssessment): string {
  const lines = [
    a.title,
    `Class: ${a.grade} · Subject: ${a.subject} · Difficulty: ${a.difficulty}`,
    `Total marks: ${a.totalMarks} · Duration: ${a.durationMinutes} minutes`,
    "",
    "INSTRUCTIONS",
    a.instructions,
    "",
    "QUESTIONS",
    "",
  ];

  for (const q of a.questions) {
    lines.push(
      `Q${q.number}. [${q.marks} mark${q.marks === 1 ? "" : "s"}] (${q.questionType} · ${q.difficulty})`,
      q.questionText,
      "",
    );
  }

  lines.push("—", "Good luck!", "Your teacher");
  return lines.join("\n");
}

export function defaultAssessmentEmailSubject(a: GeneratedAssessment, classManaged: string): string {
  return `${a.subject} assessment — Class ${classManaged}`;
}
