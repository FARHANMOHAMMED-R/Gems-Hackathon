/** Optional learning / accessibility profiles layered on grade-level text. */
export const READING_PROFILES = [
  "None",
  "Dyslexia",
  "ADHD",
  "English Language Learner",
  "Visual impairment",
] as const;

export type ReadingProfile = (typeof READING_PROFILES)[number];

export function isReadingProfile(value: string): value is ReadingProfile {
  return (READING_PROFILES as readonly string[]).includes(value);
}

export const READING_PROFILE_HINTS: Record<ReadingProfile, string> = {
  None: "Adjust vocabulary and sentence length to the selected grade only.",
  Dyslexia: "Short lines, bullet syntax, extra white space, dyslexia-friendly layout.",
  ADHD: "Micro-chunk into ~5-minute steps with clear milestones between sections.",
  "English Language Learner": "Simpler vocabulary, define key terms inline, shorter sentences.",
  "Visual impairment": "Strong heading hierarchy and descriptive structure for screen readers.",
};
