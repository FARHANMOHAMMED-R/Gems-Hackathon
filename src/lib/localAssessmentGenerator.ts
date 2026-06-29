export interface AssessmentQuestion {
  number: string;
  marks: number;
  topic: string;
  chapter: string;
  questionType: string;
  difficulty: string;
  questionText: string;
}

export interface GeneratedAssessment {
  title: string;
  grade: string;
  subject: string;
  difficulty: string;
  chapters: string[];
  topics: string[];
  totalMarks: number;
  durationMinutes: number;
  instructions: string;
  questions: AssessmentQuestion[];
  teacherNotes: string;
}

export type DifficultyLevel = "Easy" | "Medium" | "Hard" | "Mixed";

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const TYPE_ROTATION = ["Short Answer", "MCQ", "Numerical", "Long Answer", "Very Short Answer"];

function questionStem(
  topic: string,
  chapter: string,
  difficulty: DifficultyLevel,
  index: number,
  qType: string,
): string {
  const base = `${topic} (${chapter})`;
  if (qType === "MCQ") {
    return `Which statement best describes ${base}? (Provide four options A–D in class.)`;
  }
  if (qType === "Numerical") {
    return difficulty === "Hard"
      ? `A multi-step numerical problem on ${base}. Show all working and units.`
      : `Solve a standard numerical problem on ${base}. Show formula and substitution.`;
  }
  if (qType === "Long Answer") {
    return `Explain ${base} in detail with diagrams or examples where appropriate.`;
  }
  if (qType === "Very Short Answer") {
    return `Define or state one key fact about ${base} (1–2 sentences).`;
  }
  return `Answer concisely: How does ${base} relate to real-world applications?`;
}

function marksForDifficulty(difficulty: DifficultyLevel, qType: string): number {
  if (qType === "MCQ" || qType === "Very Short Answer") return difficulty === "Hard" ? 2 : 1;
  if (qType === "Numerical") return difficulty === "Easy" ? 2 : difficulty === "Hard" ? 5 : 3;
  if (qType === "Long Answer") return difficulty === "Easy" ? 3 : 5;
  return difficulty === "Hard" ? 4 : 2;
}

/** Offline assessment generator when no LLM key is configured. */
export function generateAssessmentLocally(input: {
  grade: string;
  classManaged: string;
  subject: string;
  chapters: string;
  topics: string;
  difficulty: DifficultyLevel;
  questionCount: number;
  durationMinutes?: number;
  additionalNotes?: string;
}): GeneratedAssessment {
  const chapters = splitList(input.chapters);
  const topics = splitList(input.topics);
  const chapterFallback = chapters[0] ?? "Unit 1";
  const topicFallback = topics[0] ?? "Core concepts";

  const questions: AssessmentQuestion[] = [];
  for (let i = 0; i < input.questionCount; i++) {
    const chapter = chapters[i % chapters.length] || chapterFallback;
    const topic = topics[i % topics.length] || topicFallback;
    const qType = TYPE_ROTATION[i % TYPE_ROTATION.length];
    const qDifficulty =
      input.difficulty === "Mixed"
        ? (["Easy", "Medium", "Hard"] as const)[i % 3]
        : input.difficulty;

    questions.push({
      number: String(i + 1),
      marks: marksForDifficulty(input.difficulty, qType),
      topic,
      chapter,
      questionType: qType,
      difficulty: qDifficulty,
      questionText: questionStem(topic, chapter, input.difficulty, i, qType),
    });
  }

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const duration = input.durationMinutes ?? Math.max(30, input.questionCount * 6);

  return {
    title: `${input.subject} Assessment — Class ${input.classManaged}`,
    grade: input.grade,
    subject: input.subject,
    difficulty: input.difficulty,
    chapters: chapters.length ? chapters : [chapterFallback],
    topics: topics.length ? topics : [topicFallback],
    totalMarks,
    durationMinutes: duration,
    instructions:
      "Answer all questions. Write clearly and show working for numericals. " +
      "Time allowed as stated. All questions are compulsory unless marked optional.",
    questions,
    teacherNotes:
      input.additionalNotes?.trim() ||
      "Review question stems before class. Add MCQ options and numerical values where needed.",
  };
}

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
