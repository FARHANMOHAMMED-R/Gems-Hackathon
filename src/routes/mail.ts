import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { complete, isLlmConfigured } from "../lib/llm";
import { PARENT_MAIL_SYSTEM_PROMPT } from "../lib/prompts";
import { draftParentMailLocally } from "../lib/localParentMailer";

export const mailRouter = Router();

const singleSchema = z.object({
  studentId: z.string().min(1),
  teacherSummary: z.string().optional(),
  recentLimit: z.coerce.number().int().min(1).max(20).default(5),
});

const batchSchema = z.object({
  classManaged: z.string().min(1),
  teacherSummary: z.string().min(1, "Provide a summary or prompt for the email."),
  scope: z.enum(["all", "selected"]),
  studentIds: z.array(z.string()).optional(),
  recentLimit: z.coerce.number().int().min(1).max(20).default(5),
});

function buildStudentDataString(
  student: {
    name: string;
    grade: string;
    section: string;
    rollNumber: string;
    schoolId: string;
    totalTokens: number;
    gradingRecords: {
      type: string;
      scores: string;
      aiFeedbackText: string;
      dateTimestamp: Date;
    }[];
  },
  teacherSummary?: string,
) {
  const performanceLines = student.gradingRecords.map((r) => {
    const when = r.dateTimestamp.toISOString().slice(0, 10);
    return `- [${when}] ${r.type}: scores=${r.scores}; feedback="${r.aiFeedbackText}"`;
  });

  const lines = [
    `Student: ${student.name} (Roll ${student.rollNumber}, School ID ${student.schoolId})`,
    `Class: Grade ${student.grade}-${student.section}`,
    `Total reward tokens earned: ${student.totalTokens}`,
    `Recent performance records (${student.gradingRecords.length}):`,
    performanceLines.length ? performanceLines.join("\n") : "- (no records yet)",
  ];
  if (teacherSummary?.trim()) {
    lines.unshift(`Teacher context / focus for this email:\n${teacherSummary.trim()}`);
  }
  return lines.join("\n");
}

async function generateEmail(
  student: {
    name: string;
    grade: string;
    section: string;
    rollNumber: string;
    schoolId: string;
    totalTokens: number;
    gradingRecords: {
      type: string;
      scores: string;
      aiFeedbackText: string;
      dateTimestamp: Date;
    }[];
  },
  teacherSummary?: string,
): Promise<{ email: string; analysisMode: "ai" | "local" }> {
  if (!isLlmConfigured()) {
    return {
      email: draftParentMailLocally(student, teacherSummary),
      analysisMode: "local",
    };
  }
  const dataString = buildStudentDataString(student, teacherSummary);
  const email = await complete({
    systemPrompt: PARENT_MAIL_SYSTEM_PROMPT,
    userContent: `Student performance data:\n\n${dataString}`,
    temperature: 0.5,
  });
  return { email, analysisMode: "ai" };
}

mailRouter.post(
  "/generate-mail",
  asyncHandler(async (req, res) => {
    const { studentId, teacherSummary, recentLimit } = singleSchema.parse(req.body);

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        gradingRecords: {
          orderBy: { dateTimestamp: "desc" },
          take: recentLimit,
        },
      },
    });
    if (!student) throw new ApiError(404, "Student not found.");

    const { email, analysisMode } = await generateEmail(student, teacherSummary);

    res.json({ studentId, name: student.name, email, analysisMode });
  }),
);

mailRouter.post(
  "/generate-mail/batch",
  asyncHandler(async (req, res) => {
    const body = batchSchema.parse(req.body);

    let targetIds: string[];
    if (body.scope === "all") {
      const all = await prisma.studentProfile.findMany({
        where: { classManaged: body.classManaged },
        select: { id: true },
      });
      if (all.length === 0) {
        throw new ApiError(404, "No students in this class. Set up the roster first.");
      }
      targetIds = all.map((s) => s.id);
    } else {
      if (!body.studentIds?.length) {
        throw new ApiError(400, "Select at least one student for targeted emails.");
      }
      targetIds = body.studentIds;
    }

    const emails: {
      studentId: string;
      name: string;
      rollNumber: string;
      email: string;
    }[] = [];
    let analysisMode: "ai" | "local" = isLlmConfigured() ? "ai" : "local";

    for (const id of targetIds) {
      const student = await prisma.studentProfile.findUnique({
        where: { id },
        include: {
          gradingRecords: {
            orderBy: { dateTimestamp: "desc" },
            take: body.recentLimit,
          },
        },
      });
      if (!student || student.classManaged !== body.classManaged) continue;

      const result = await generateEmail(student, body.teacherSummary);
      analysisMode = result.analysisMode;
      emails.push({
        studentId: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        email: result.email,
      });
    }

    if (emails.length === 0) {
      throw new ApiError(404, "No matching students found for this class.");
    }

    res.json({
      scope: body.scope,
      classManaged: body.classManaged,
      count: emails.length,
      emails,
      analysisMode,
    });
  }),
);
