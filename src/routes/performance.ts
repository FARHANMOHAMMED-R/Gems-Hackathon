import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";

export const performanceRouter = Router();

export const EXAM_PERIODS = ["PT1", "Half Yearly", "PT2", "Final"] as const;
export type ExamPeriod = (typeof EXAM_PERIODS)[number];

const examPeriodSchema = z.enum(EXAM_PERIODS);

const listQuery = z.object({
  classManaged: z.string().min(1),
  subject: z.string().trim().min(1),
  academicYear: z.string().trim().optional(),
});

const saveSchema = z.object({
  classManaged: z.string().min(1),
  subject: z.string().trim().min(1),
  maxMarks: z.coerce.number().positive().max(1000).default(100),
  academicYear: z.string().trim().optional(),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        examPeriod: examPeriodSchema,
        marks: z.coerce.number().min(0),
      }),
    )
    .min(1),
});

function yearBucket(academicYear?: string): string {
  return academicYear?.trim() ?? "";
}

/** GET /api/performance?classManaged=11-A&subject=Physics */
performanceRouter.get(
  "/performance",
  asyncHandler(async (req, res) => {
    const { classManaged, subject, academicYear } = listQuery.parse(req.query);
    const year = yearBucket(academicYear);

    const students = await prisma.studentProfile.findMany({
      where: { classManaged },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: { id: true, name: true, rollNumber: true },
    });

    const records = await prisma.performanceMark.findMany({
      where: { classManaged, subject, academicYear: year },
    });

    const byStudent = new Map<string, Map<ExamPeriod, { marks: number; maxMarks: number }>>();
    for (const r of records) {
      const period = r.examPeriod as ExamPeriod;
      if (!EXAM_PERIODS.includes(period)) continue;
      let map = byStudent.get(r.studentId);
      if (!map) {
        map = new Map();
        byStudent.set(r.studentId, map);
      }
      map.set(period, { marks: r.marks, maxMarks: r.maxMarks });
    }

    let maxMarks = 100;
    if (records.length > 0) {
      maxMarks = records[0].maxMarks;
    }

    res.json({
      classManaged,
      subject,
      academicYear: year,
      maxMarks,
      examPeriods: [...EXAM_PERIODS],
      students: students.map((s) => {
        const marksMap = byStudent.get(s.id);
        const marks: Record<ExamPeriod, number | null> = {
          PT1: marksMap?.get("PT1")?.marks ?? null,
          "Half Yearly": marksMap?.get("Half Yearly")?.marks ?? null,
          PT2: marksMap?.get("PT2")?.marks ?? null,
          Final: marksMap?.get("Final")?.marks ?? null,
        };
        return { id: s.id, name: s.name, rollNumber: s.rollNumber, marks };
      }),
    });
  }),
);

/** POST /api/performance/marks — upsert marks for one or more students */
performanceRouter.post(
  "/performance/marks",
  asyncHandler(async (req, res) => {
    const body = saveSchema.parse(req.body);
    const year = yearBucket(body.academicYear);

    const studentIds = [...new Set(body.entries.map((e) => e.studentId))];
    const validStudents = await prisma.studentProfile.findMany({
      where: { id: { in: studentIds }, classManaged: body.classManaged },
      select: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));

    for (const entry of body.entries) {
      if (!validIds.has(entry.studentId)) {
        throw new ApiError(400, `Student ${entry.studentId} is not in class ${body.classManaged}.`);
      }
      if (entry.marks > body.maxMarks) {
        throw new ApiError(
          400,
          `Marks for ${entry.examPeriod} cannot exceed max (${body.maxMarks}).`,
        );
      }
    }

    await prisma.$transaction(
      body.entries.map((entry) =>
        prisma.performanceMark.upsert({
          where: {
            student_subject_exam_year: {
              studentId: entry.studentId,
              subject: body.subject,
              examPeriod: entry.examPeriod,
              academicYear: year,
            },
          },
          create: {
            studentId: entry.studentId,
            classManaged: body.classManaged,
            subject: body.subject,
            examPeriod: entry.examPeriod,
            marks: entry.marks,
            maxMarks: body.maxMarks,
            academicYear: year,
          },
          update: {
            marks: entry.marks,
            maxMarks: body.maxMarks,
          },
        }),
      ),
    );

    res.json({ saved: body.entries.length, subject: body.subject, classManaged: body.classManaged });
  }),
);
