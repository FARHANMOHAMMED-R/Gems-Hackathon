import type { GradeLevel } from "./gradeLevels";
import { gradeTier } from "./gradeLevels";
import type { ReadingProfile } from "./readingProfiles";

/** Strip parentheticals, dates, and jargon for early readers. */
function stripComplexity(text: string): string {
  return text
    .replace(/\([^)]{20,}\)/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\b(?:1[0-9]{3}|20[0-9]{2})\b/g, "long ago")
    .replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, "long ago")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  return stripComplexity(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function shortenForEarly(s: string, maxWords: number): string {
  const words = s.replace(/[,;:—–-]/g, " ").split(/\s+/).filter(Boolean);
  const simple = words.slice(0, maxWords).join(" ");
  if (!simple.endsWith(".") && !simple.endsWith("!") && !simple.endsWith("?")) {
    return `${simple}.`;
  }
  return simple;
}

function kindergartenRewrite(sentences: string[]): string {
  const picked = sentences.slice(0, 6).map((s) => shortenForEarly(s, 8));
  return picked.join("\n\n");
}

function elementaryRewrite(sentences: string[]): string {
  return sentences
    .slice(0, 10)
    .map((s) => `- ${shortenForEarly(s, 14)}`)
    .join("\n");
}

/** Last-resort local rewrite when no OpenAI/Gemini key — never dumps raw source. */
export function levelTextLocally(
  source: string,
  gradeLevel: GradeLevel,
  readingProfile: ReadingProfile,
): string {
  const trimmed = stripComplexity(source.trim());
  const sentences = splitSentences(trimmed);
  const tier = gradeTier(gradeLevel);

  let body: string;

  if (tier === "early") {
    body = `# ${gradeLevel} version\n\n${kindergartenRewrite(sentences)}`;
  } else if (tier === "elementary") {
    body = `# ${gradeLevel} version\n\n${elementaryRewrite(sentences)}`;
  } else {
    body = `# ${gradeLevel} version\n\n${sentences
      .slice(0, 12)
      .map((s) => `- ${s}`)
      .join("\n")}`;
  }

  if (readingProfile === "ADHD") {
    body = body
      .split("\n")
      .filter((l) => l.trim())
      .map((line, i) => `**Step ${i + 1}** · ${line.replace(/^[-#*\s]+/, "")}`)
      .join("\n\n");
  }

  return `${body}

---
⚠️ **Add your OpenAI API key** on this page for a full AI rewrite. Local mode only shortens text — it cannot truly level complex passages like Wikipedia articles.`;
}
