import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { completeJSON, isLlmConfigured } from "../lib/llm";
import { parseRosterFromText } from "../lib/localRosterParser";
import { ROSTER_IMPORT_SYSTEM_PROMPT } from "../lib/prompts";

export const studentsRouter = Router();

/** Split "11-A" → { grade: "11", section: "A" }. */
function parseClassManaged(classManaged: string): { grade: string; section: string } {
  const trimmed = classManaged.trim();
  const dash = trimmed.indexOf("-");
  if (dash > 0) {
    return {
      grade: trimmed.slice(0, dash).trim(),
      section: trimmed.slice(dash + 1).trim(),
    };
  }
  const space = trimmed.indexOf(" ");
  if (space > 0) {
    return {
      grade: trimmed.slice(0, space).trim(),
      section: trimmed.slice(space + 1).trim(),
    };
  }
  return { grade: trimmed, section: "" };
}

const classQuery = z.object({
  classManaged: z.string().min(1),
});

const rosterSchema = z.object({
  classManaged: z.string().min(1),
  students: z
    .array(
      z.object({
        name: z.string().min(1),
        rollNumber: z.string().min(1),
        schoolId: z.string().min(1),
      }),
    )
    .min(1),
});

/**
 * GET /api/students/roster-status?classManaged=11-A
 */
studentsRouter.get(
  "/students/roster-status",
  asyncHandler(async (req, res) => {
    const { classManaged } = classQuery.parse(req.query);
    const count = await prisma.studentProfile.count({
      where: { classManaged },
    });
    res.json({ classManaged, count, needsSetup: count === 0 });
  }),
);

/**
 * GET /api/students?classManaged=11-A
 */
studentsRouter.get(
  "/students",
  asyncHandler(async (req, res) => {
    const { classManaged } = classQuery.parse(req.query);
    const students = await prisma.studentProfile.findMany({
      where: { classManaged },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        rollNumber: true,
        schoolId: true,
        grade: true,
        section: true,
        classManaged: true,
        totalTokens: true,
        parentEmail: true,
      },
    });
    res.json({ classManaged, students });
  }),
);

/**
 * POST /api/students/roster — first teacher registers class; all start at 0 tokens.
 */
studentsRouter.post(
  "/students/roster",
  asyncHandler(async (req, res) => {
    const { classManaged, students } = rosterSchema.parse(req.body);
    const existing = await prisma.studentProfile.count({ where: { classManaged } });
    if (existing > 0) {
      throw new ApiError(
        409,
        `Class ${classManaged} already has ${existing} student(s).`,
        "ROSTER_EXISTS",
      );
    }

    const { grade, section } = parseClassManaged(classManaged);

    // Sequential creates inside one transaction (reliable on SQLite).
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const s of students) {
        rows.push(
          await tx.studentProfile.create({
            data: {
              name: s.name.trim(),
              rollNumber: s.rollNumber.trim(),
              schoolId: s.schoolId.trim(),
              classManaged,
              grade,
              section,
              totalTokens: 0,
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              schoolId: true,
              grade: true,
              section: true,
              classManaged: true,
              totalTokens: true,
              parentEmail: true,
            },
          }),
        );
      }
      return rows;
    });

    res.status(201).json({ classManaged, students: created, count: created.length });
  }),
);

const parseTextSchema = z.object({
  text: z.string().trim().min(1, "Paste your student list first."),
});

interface ImportResult {
  students: { name: string; rollNumber: string; schoolId: string }[];
}

/** POST /api/students/roster/parse-text — AI (or local) extract from pasted text. */
studentsRouter.post(
  "/students/roster/parse-text",
  asyncHandler(async (req, res) => {
    const { text } = parseTextSchema.parse(req.body);

    let students: ImportResult["students"];
    let analysisMode: "ai" | "local";

    if (isLlmConfigured()) {
      const result = await completeJSON<ImportResult>({
        systemPrompt: ROSTER_IMPORT_SYSTEM_PROMPT,
        userContent: `Student list text:\n\n${text.slice(0, 12000)}`,
        temperature: 0.1,
      });
      students = (result.students ?? [])
        .map((s) => ({
          name: s.name?.trim() ?? "",
          rollNumber: String(s.rollNumber ?? "").trim(),
          schoolId: String(s.schoolId ?? "").trim(),
        }))
        .filter((s) => s.name && s.rollNumber);
      for (const s of students) {
        if (!s.schoolId) s.schoolId = `GEMS-${s.rollNumber}`;
      }
      analysisMode = "ai";
    } else {
      students = parseRosterFromText(text);
      analysisMode = "local";
    }

    if (students.length === 0) {
      throw new ApiError(
        422,
        "No students found in the text. Include name, roll number, and school ID for each student.",
      );
    }

    res.json({ students, count: students.length, analysisMode });
  }),
);

const studentFields = {
  id: true,
  name: true,
  rollNumber: true,
  schoolId: true,
  grade: true,
  section: true,
  classManaged: true,
  totalTokens: true,
  parentEmail: true,
} as const;

const updateStudentSchema = z.object({
  name: z.string().trim().min(1).optional(),
  rollNumber: z.string().trim().min(1).optional(),
  schoolId: z.string().trim().min(1).optional(),
  parentEmail: z.string().trim().email().optional().or(z.literal("")),
});

const addStudentSchema = z.object({
  classManaged: z.string().min(1),
  name: z.string().trim().min(1),
  rollNumber: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
});

/** POST /api/students — add one student to an existing class. */
studentsRouter.post(
  "/students",
  asyncHandler(async (req, res) => {
    const body = addStudentSchema.parse(req.body);
    const { grade, section } = parseClassManaged(body.classManaged);

    try {
      const student = await prisma.studentProfile.create({
        data: {
          name: body.name,
          rollNumber: body.rollNumber,
          schoolId: body.schoolId,
          classManaged: body.classManaged,
          grade,
          section,
          totalTokens: 0,
        },
        select: studentFields,
      });
      res.status(201).json({ student });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Unique constraint")
      ) {
        throw new ApiError(
          409,
          `Roll number ${body.rollNumber} already exists in this class.`,
          "DUPLICATE_ROLL",
        );
      }
      throw err;
    }
  }),
);

/** PATCH /api/students/:id — update name, roll no., or school ID. */
studentsRouter.patch(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const updates = updateStudentSchema.parse(req.body);

    if (!updates.name && !updates.rollNumber && !updates.schoolId && updates.parentEmail === undefined) {
      throw new ApiError(400, "Provide at least one field to update.");
    }

    try {
      const student = await prisma.studentProfile.update({
        where: { id },
        data: updates,
        select: studentFields,
      });
      res.json({ student });
    } catch {
      throw new ApiError(404, "Student not found.");
    }
  }),
);

/** DELETE /api/students/:id — remove a student from the class. */
studentsRouter.delete(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    try {
      await prisma.studentProfile.delete({ where: { id } });
      res.json({ ok: true, deletedId: id });
    } catch {
      throw new ApiError(404, "Student not found.");
    }
  }),
);
