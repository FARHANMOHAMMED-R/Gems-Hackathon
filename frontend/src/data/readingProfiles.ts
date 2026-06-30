export const READING_PROFILES = [
  "None",
  "Dyslexia",
  "ADHD",
  "English Language Learner",
  "Visual impairment",
] as const;

export type ReadingProfile = (typeof READING_PROFILES)[number];

export const READING_PROFILE_LABELS: Record<ReadingProfile, string> = {
  None: "Standard (grade level only)",
  Dyslexia: "Dyslexia-friendly layout",
  ADHD: "ADHD — micro-chunked steps",
  "English Language Learner": "English Language Learner (ELL)",
  "Visual impairment": "Visual impairment — screen-reader friendly",
};
