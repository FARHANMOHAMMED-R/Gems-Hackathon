import type { AssessmentDifficulty, GeneratedAssessment } from "../api/types";

const SYSTEM_PROMPT = `You are a CBSE curriculum specialist creating classroom assessments for Indian schools.

Given the teacher's grade, subject, chapters, topics, and difficulty level, produce a complete printable assessment with real, specific questions — not placeholders.

Rules:
- Questions must match the stated grade (e.g. Class 10 Physics, Class 11 Chemistry).
- Match difficulty: Easy = recall & direct application; Medium = multi-step; Hard = analysis & synthesis; Mixed = blend all three.
- Use varied types: MCQ, Very Short Answer, Short Answer, Long Answer, Numerical where appropriate.
- MCQ questions must include four labelled options (A, B, C, D) in questionText.
- Numerical questions must include realistic values and ask for a clear answer with units.
- Each question must be self-contained and exam-ready — no "provide options in class" placeholders.
- State marks per question; totalMarks must equal the sum of question marks.
- teacherNotes is for the teacher only (marking hints, common mistakes).

Return strict JSON only:
{
  "title": string,
  "grade": string,
  "subject": string,
  "difficulty": string,
  "chapters": string[],
  "topics": string[],
  "totalMarks": number,
  "durationMinutes": number,
  "instructions": string,
  "questions": [
    {
      "number": string,
      "marks": number,
      "topic": string,
      "chapter": string,
      "questionType": string,
      "difficulty": string,
      "questionText": string
    }
  ],
  "teacherNotes": string
}`;

function parseJsonAssessment(raw: string): GeneratedAssessment {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI did not return valid JSON.");
  const parsed = JSON.parse(jsonText.slice(start, end + 1)) as GeneratedAssessment;
  if (!parsed.questions?.length) throw new Error("AI returned no questions.");
  return parsed;
}

export interface AssessmentGenerateInput {
  classManaged: string;
  grade: string;
  subject: string;
  chapters: string;
  topics: string;
  difficulty: AssessmentDifficulty;
  questionCount: number;
  durationMinutes: number;
  additionalNotes?: string;
}

function buildUserPrompt(input: AssessmentGenerateInput): string {
  return [
    `Class / grade: ${input.grade} (Class ${input.classManaged})`,
    `Subject: ${input.subject}`,
    `Chapters: ${input.chapters}`,
    `Topics: ${input.topics}`,
    `Difficulty: ${input.difficulty}`,
    `Number of questions: ${input.questionCount}`,
    `Target duration: ${input.durationMinutes} minutes`,
    input.additionalNotes ? `Teacher notes: ${input.additionalNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function clientGenerateAssessment(
  provider: "openai" | "gemini",
  apiKey: string,
  input: AssessmentGenerateInput,
): Promise<GeneratedAssessment> {
  const userPrompt = buildUserPrompt(input);

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(body.error?.message ?? `OpenAI error (${res.status})`);
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI returned an empty response.");
    return parseJsonAssessment(text);
  }

  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.35, responseMimeType: "application/json" },
          }),
        },
      );
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(body.error?.message ?? `Gemini error (${res.status})`);
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new Error("Gemini returned an empty response.");
      return parseJsonAssessment(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Gemini failed to generate assessment.");
}
