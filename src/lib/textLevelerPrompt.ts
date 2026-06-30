import type { GradeLevel } from "./gradeLevels";
import { gradeTier } from "./gradeLevels";
import type { ReadingProfile } from "./readingProfiles";
import { READING_PROFILE_HINTS } from "./readingProfiles";

export const TEXT_LEVELER_SYSTEM_PROMPT =
  "You are an expert K-12 reading specialist. Your job is to REWRITE text for a specific grade level. " +
  "You must change vocabulary, sentence length, and complexity — never copy the original wording. " +
  "Keep the same facts and meaning but express them at the target reading level. " +
  "Output markdown only. No preamble, no 'here is the leveled text'.";

const GRADE_RULES: Record<ReturnType<typeof gradeTier>, string> = {
  early:
    "Pre-K / Kindergarten rules: 4–8 short sentences total for a paragraph. Max 6–8 words per sentence. " +
    "Use only everyday words (big, small, king, war, died, lived). No jargon, no dates like 1814, no Latin names. " +
    "Say 'Napoleon' once then 'he'. Explain like you are talking to a 5-year-old.",
  elementary:
    "Elementary rules: Simple sentences (8–12 words). Define hard words in parentheses. " +
    "Break long ideas into bullet points. Avoid passive voice and academic phrases.",
  middle:
    "Middle school rules: Clear paragraphs, grade-appropriate vocabulary, shorter than the source. " +
    "Define specialized terms briefly.",
  high:
    "High school rules: Maintain rigor but improve clarity. Shorter sentences than college-level source text.",
};

export function buildTextLevelerUserPrompt(
  content: string,
  gradeLevel: GradeLevel,
  readingProfile: ReadingProfile,
): string {
  const tier = gradeTier(gradeLevel);
  const lines = [
    `TARGET GRADE: ${gradeLevel}`,
    `RULES: ${GRADE_RULES[tier]}`,
  ];

  if (readingProfile !== "None") {
    lines.push(`READING PROFILE: ${readingProfile}`, READING_PROFILE_HINTS[readingProfile]);
  }

  lines.push(
    "",
    "Rewrite the text below completely for this grade. Do NOT copy sentences verbatim.",
    "",
    "--- ORIGINAL ---",
    content.trim(),
    "--- END ---",
  );

  return lines.join("\n");
}
