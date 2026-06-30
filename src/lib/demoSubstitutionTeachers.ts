import { prisma } from "./prisma";

/** Demo teachers for Substitution Finder (synced on server start). */
export const DEMO_SUBSTITUTION_TEACHERS = [
  {
    teacherName: "Irfana Ma'am",
    department: "Computer Science",
    /** Free in periods 1, 3, 4, 6 */
    currentPeriodFreeStatus: [true, false, true, true, false, true, false],
  },
  {
    teacherName: "Tina Ma'am",
    department: "Mathematics",
    /** Free in periods 2, 3, 5, 7 */
    currentPeriodFreeStatus: [false, true, true, false, true, false, true],
  },
  {
    teacherName: "Yogesh Sir",
    department: "CHEM",
    /** Free in periods 2, 4, 5, 7 */
    currentPeriodFreeStatus: [false, true, false, true, true, false, true],
  },
] as const;

const RETIRED_TEACHER_NAMES = [
  "Mr. Rajesh Kumar",
  "Ms. Anita Desai",
  "Mr. Suresh Iyer",
  "Ms. Fatima Khan",
] as const;

/** Replace legacy demo teachers with Irfana, Tina, and Yogesh. */
export async function ensureDemoSubstitutionTeachers(): Promise<void> {
  await prisma.teacherAvailability.deleteMany({
    where: { teacherName: { in: [...RETIRED_TEACHER_NAMES] } },
  });

  for (const teacher of DEMO_SUBSTITUTION_TEACHERS) {
    const payload = {
      teacherName: teacher.teacherName,
      department: teacher.department,
      currentPeriodFreeStatus: JSON.stringify(teacher.currentPeriodFreeStatus),
    };

    const existing = await prisma.teacherAvailability.findFirst({
      where: { teacherName: teacher.teacherName },
    });

    if (existing) {
      await prisma.teacherAvailability.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.teacherAvailability.create({ data: payload });
    }
  }
}
