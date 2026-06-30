/** US K–12 grade levels (MagicSchool Text Leveler style). */
export const GRADE_LEVELS = [
  "Pre-K",
  "Kindergarten",
  "1st grade",
  "2nd grade",
  "3rd grade",
  "4th grade",
  "5th grade",
  "6th grade",
  "7th grade",
  "8th grade",
  "9th grade",
  "10th grade",
  "11th grade",
  "12th grade",
] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];

export function isGradeLevel(value: string): value is GradeLevel {
  return (GRADE_LEVELS as readonly string[]).includes(value);
}

export function gradeTier(level: GradeLevel): "early" | "elementary" | "middle" | "high" {
  if (level === "Pre-K" || level === "Kindergarten") return "early";
  if (["1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade"].includes(level)) {
    return "elementary";
  }
  if (["6th grade", "7th grade", "8th grade"].includes(level)) return "middle";
  return "high";
}
