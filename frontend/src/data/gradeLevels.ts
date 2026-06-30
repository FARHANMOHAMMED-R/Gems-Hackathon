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

export function defaultGradeFromClass(classManaged: string): GradeLevel {
  const dash = classManaged.indexOf("-");
  const num = dash > 0 ? parseInt(classManaged.slice(0, dash), 10) : NaN;
  if (num >= 1 && num <= 12) {
    const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} grade` as GradeLevel;
  }
  return "8th grade";
}
