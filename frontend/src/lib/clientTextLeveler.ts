import type { GradeLevel, ReadingProfile } from "../api/types";
import { friendlyAiErrorMessage } from "./aiErrors";

const SYSTEM_PROMPT =
  "You are an expert K-12 reading specialist. REWRITE the text for the target grade level. " +
  "Change every sentence — never copy wording from the original. " +
  "Keep the same facts but use vocabulary and sentence length appropriate for that grade. " +
  "Return markdown only.";

const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b",
];

function gradeRules(gradeLevel: GradeLevel): string {
  if (gradeLevel === "Pre-K" || gradeLevel === "Kindergarten") {
    return (
      "Kindergarten: 4–8 very short sentences. Max 6–8 words each. " +
      "Only simple words. No dates like 1814, no 'regnal', 'abdication', 'prominence'. " +
      "Explain like talking to a 5-year-old."
    );
  }
  if (["1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade"].includes(gradeLevel)) {
    return "Elementary: simple sentences, define hard words, use bullets for lists.";
  }
  if (["6th grade", "7th grade", "8th grade"].includes(gradeLevel)) {
    return "Middle school: clear paragraphs, shorter than source, define key terms.";
  }
  return "High school: rigorous but clearer and more concise than the source.";
}

function profileHint(profile: ReadingProfile): string {
  if (profile === "Dyslexia") return "Use short lines and bullet lists.";
  if (profile === "ADHD") return "Micro-chunk with numbered steps and milestones.";
  if (profile === "English Language Learner") return "Simple vocabulary, define terms inline.";
  if (profile === "Visual impairment") return "Strong heading hierarchy.";
  return "";
}

function buildUserPrompt(
  content: string,
  gradeLevel: GradeLevel,
  readingProfile: ReadingProfile,
): string {
  const profileLine = profileHint(readingProfile);
  return [
    `TARGET GRADE: ${gradeLevel}`,
    `RULES: ${gradeRules(gradeLevel)}`,
    profileLine ? `PROFILE: ${profileLine}` : "",
    "",
    "Rewrite completely — do NOT copy original sentences.",
    "",
    content.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseApiError(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const err = body as { error?: { message?: string } };
    if (err.error?.message) return err.error.message;
  }
  return fallback;
}

export async function clientOpenAiLevelText(
  apiKey: string,
  content: string,
  gradeLevel: GradeLevel,
  readingProfile: ReadingProfile,
): Promise<string> {
  const userPrompt = buildUserPrompt(content, gradeLevel, readingProfile);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.35,
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

  if (!res.ok) {
    const msg = parseApiError(body, `OpenAI error (${res.status})`);
    throw new Error(friendlyAiErrorMessage(msg, "openai"));
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned an empty response.");
  return text;
}

async function callGeminiModel(
  model: string,
  apiKey: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.35 },
      }),
    },
  );

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = parseApiError(body, `Gemini error (${res.status})`);
    throw new Error(friendlyAiErrorMessage(msg, "gemini"));
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

export async function clientGeminiLevelText(
  apiKey: string,
  content: string,
  gradeLevel: GradeLevel,
  readingProfile: ReadingProfile,
): Promise<string> {
  const userPrompt = buildUserPrompt(content, gradeLevel, readingProfile);
  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiModel(model, apiKey, userPrompt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("All Gemini models failed.");
}

export async function levelTextWithProvider(
  provider: "openai" | "gemini",
  apiKey: string,
  content: string,
  gradeLevel: GradeLevel,
  readingProfile: ReadingProfile,
): Promise<string> {
  if (provider === "openai") {
    return clientOpenAiLevelText(apiKey, content, gradeLevel, readingProfile);
  }
  return clientGeminiLevelText(apiKey, content, gradeLevel, readingProfile);
}
