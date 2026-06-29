/**
 * Offline exam blueprint generator — parses uploaded exam text heuristically
 * when no LLM API key is configured.
 */

export interface BlueprintQuestion {
  number: string;
  marks: number;
  topic: string;
  questionType: string;
  cognitiveLevel: string;
  description: string;
}

export interface BlueprintSection {
  name: string;
  instructions: string;
  questions: BlueprintQuestion[];
  sectionMarks: number;
}

export interface TopicDistribution {
  topic: string;
  marks: number;
  percentage: number;
  questionCount: number;
}

export interface CognitiveDistribution {
  level: string;
  marks: number;
  percentage: number;
}

export interface ExamBlueprint {
  examTitle: string;
  totalMarks: number;
  durationMinutes: number | null;
  sections: BlueprintSection[];
  topicDistribution: TopicDistribution[];
  cognitiveDistribution: CognitiveDistribution[];
  summary: string;
}

const PHYSICS_TOPICS: [RegExp, string][] = [
  [/\b(kinematics|velocity|acceleration|displacement|motion)\b/i, "Kinematics"],
  [/\b(newton|force|friction|dynamics)\b/i, "Laws of Motion"],
  [/\b(work|energy|power|conservation)\b/i, "Work, Energy & Power"],
  [/\b(gravitation|orbit|kepler|satellite)\b/i, "Gravitation"],
  [/\b(wave|sound|frequency|amplitude)\b/i, "Waves & Oscillations"],
  [/\b(heat|thermo|temperature|calorimetry)\b/i, "Thermodynamics"],
  [/\b(electric|current|resistance|ohm|circuit|capacitor)\b/i, "Electricity"],
  [/\b(magnetic|magnet|faraday|induction)\b/i, "Magnetism"],
  [/\b(optics|lens|mirror|refraction|light)\b/i, "Optics"],
];

const ENGLISH_TOPICS: [RegExp, string][] = [
  [/\b(comprehension|passage|read the following|unseen)\b/i, "Reading Comprehension"],
  [/\b(grammar|tense|verb|noun|adjective|adverb|clause)\b/i, "Grammar"],
  [/\b(writing|essay|letter|email|report|article|speech)\b/i, "Writing Skills"],
  [/\b(literature|poem|poetry|prose|stanza|metaphor|character)\b/i, "Literature"],
  [/\b(vocabulary|synonym|antonym|word meaning)\b/i, "Vocabulary"],
];

function topicPatterns(subject?: string): [RegExp, string][] {
  const s = (subject ?? "").toLowerCase();
  if (/english|lang/.test(s)) return ENGLISH_TOPICS;
  return PHYSICS_TOPICS;
}

function inferTopic(text: string, subject?: string): string {
  const patterns = topicPatterns(subject);
  if (subject?.trim()) {
    for (const [re, topic] of patterns) {
      if (re.test(text)) return `${subject}: ${topic}`;
    }
    return subject;
  }
  for (const [re, topic] of patterns) {
    if (re.test(text)) return topic;
  }
  if (/\b(calculate|derive|prove|solve|find the value)\b/i.test(text)) return "Numerical / Problem Solving";
  if (/\b(define|state|list|name|what is)\b/i.test(text)) return "Definitions & Concepts";
  if (/\b(explain|describe|discuss|why|how)\b/i.test(text)) return "Explanation & Reasoning";
  if (/\b(draw|diagram|sketch|label)\b/i.test(text)) return "Diagrams & Visuals";
  return "General";
}

function inferQuestionType(text: string, marks: number): string {
  if (/\b(choose|select|mcq|option\s*[a-d])\b/i.test(text) || marks <= 1) return "MCQ";
  if (marks <= 2) return "Very Short Answer";
  if (marks <= 3) return "Short Answer";
  if (marks <= 5) return "Short Answer / Numerical";
  if (/\b(derive|prove|explain in detail|discuss)\b/i.test(text)) return "Long Answer";
  return "Long Answer / Numerical";
}

function inferCognitive(text: string, marks: number): string {
  if (/\b(define|list|state|name|recall|identify)\b/i.test(text) || marks <= 1) return "Remember";
  if (/\b(explain|describe|summarize|compare)\b/i.test(text) || marks <= 3) return "Understand";
  if (/\b(calculate|solve|apply|derive|find)\b/i.test(text)) return "Apply";
  if (/\b(analyse|analyze|differentiate|examine|justify)\b/i.test(text) || marks >= 5) return "Analyze";
  if (marks >= 8) return "Evaluate";
  return marks <= 2 ? "Understand" : "Apply";
}

function extractMarks(line: string, fallback: number): number {
  const patterns = [
    /\[(\d+)\s*marks?\]/i,
    /\((\d+)\s*marks?\)/i,
    /(\d+)\s*marks?\s*$/i,
    /\[(\d+)\]/,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) return Math.min(20, Math.max(1, parseInt(m[1], 10)));
  }
  return fallback;
}

function splitSections(text: string): { name: string; body: string }[] {
  const parts = text.split(/(?=(?:^|\n)\s*(?:Section|Part|PART|SECTION)\s+[A-ZIVX0-9]+)/gi);
  if (parts.length <= 1) return [{ name: "Main Paper", body: text }];

  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const head = p.match(/^(Section|Part|PART|SECTION)\s+[A-ZIVX0-9]+[^\n]*/i);
      const name = head ? head[0].trim() : "Section";
      return { name, body: p };
    });
}

function parseQuestions(block: string, subject?: string): BlueprintQuestion[] {
  const questions: BlueprintQuestion[] = [];
  const chunks = block.split(/(?=(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*)?\d+[a-z]?[.)]\s*)/i);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (trimmed.length < 8) continue;

    const numMatch = trimmed.match(/^(?:Q(?:uestion)?\.?\s*)?(\d+[a-z]?)[.)]\s*/i);
    if (!numMatch) continue;

    const number = numMatch[1];
    const body = trimmed.slice(numMatch[0].length).trim();
    const firstLine = body.split("\n")[0] ?? body;
    const marks = extractMarks(`${firstLine} ${body.slice(0, 200)}`, 2);
    const snippet = body.replace(/\s+/g, " ").slice(0, 120);

    questions.push({
      number,
      marks,
      topic: inferTopic(body, subject),
      questionType: inferQuestionType(body, marks),
      cognitiveLevel: inferCognitive(body, marks),
      description: snippet + (body.length > 120 ? "…" : ""),
    });
  }

  if (questions.length === 0) {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.length > 20);
    lines.slice(0, 12).forEach((line, i) => {
      const marks = extractMarks(line, 2);
      questions.push({
        number: String(i + 1),
        marks,
        topic: inferTopic(line, subject),
        questionType: inferQuestionType(line, marks),
        cognitiveLevel: inferCognitive(line, marks),
        description: line.slice(0, 120) + (line.length > 120 ? "…" : ""),
      });
    });
  }

  return questions;
}

function buildDistribution(questions: BlueprintQuestion[]): {
  topics: TopicDistribution[];
  cognitive: CognitiveDistribution[];
} {
  const topicMap = new Map<string, { marks: number; count: number }>();
  const cogMap = new Map<string, number>();

  for (const q of questions) {
    const t = topicMap.get(q.topic) ?? { marks: 0, count: 0 };
    t.marks += q.marks;
    t.count += 1;
    topicMap.set(q.topic, t);
    cogMap.set(q.cognitiveLevel, (cogMap.get(q.cognitiveLevel) ?? 0) + q.marks);
  }

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0) || 1;

  const topics = [...topicMap.entries()]
    .map(([topic, { marks, count }]) => ({
      topic,
      marks,
      questionCount: count,
      percentage: Math.round((marks / totalMarks) * 100),
    }))
    .sort((a, b) => b.marks - a.marks);

  const cognitive = [...cogMap.entries()]
    .map(([level, marks]) => ({
      level,
      marks,
      percentage: Math.round((marks / totalMarks) * 100),
    }))
    .sort((a, b) => b.marks - a.marks);

  return { topics, cognitive };
}

export function generateBlueprintLocally(
  rawText: string,
  opts?: { subject?: string; examTitle?: string; durationMinutes?: number },
): ExamBlueprint {
  const text = rawText.trim();
  const titleMatch = text.match(/^(?:.*?\n)?(.{5,80}(?:Exam|Paper|Test|Assessment).{0,40})/im);
  const examTitle = opts?.examTitle?.trim() || titleMatch?.[1]?.trim() || "Uploaded Exam Paper";

  const sectionParts = splitSections(text);
  const sections: BlueprintSection[] = sectionParts.map((sp) => {
    const questions = parseQuestions(sp.body, opts?.subject);
    const sectionMarks = questions.reduce((s, q) => s + q.marks, 0);
    const instrMatch = sp.body.match(/(?:attempt|answer|all questions|compulsory)[^\n]{0,120}/i);
    return {
      name: sp.name,
      instructions: instrMatch?.[0]?.trim() ?? "",
      questions,
      sectionMarks,
    };
  });

  const allQuestions = sections.flatMap((s) => s.questions);
  const totalMarks = allQuestions.reduce((s, q) => s + q.marks, 0);
  const { topics, cognitive } = buildDistribution(allQuestions);

  const durationMatch = text.match(/(\d+)\s*(?:hours?|hrs?|minutes?|mins?)/i);
  const durationMinutes =
    opts?.durationMinutes ??
    (durationMatch
      ? parseInt(durationMatch[1], 10) * (/hour|hr/i.test(durationMatch[0]) ? 60 : 1)
      : null);

  return {
    examTitle,
    totalMarks,
    durationMinutes,
    sections,
    topicDistribution: topics,
    cognitiveDistribution: cognitive,
    summary:
      `Local blueprint from ${allQuestions.length} detected question(s) totalling ${totalMarks} marks. ` +
      `Top topic: ${topics[0]?.topic ?? "N/A"}. Add OPENAI_API_KEY for full AI blueprint analysis.`,
  };
}
