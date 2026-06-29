import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { completeJSON, isLlmConfigured } from "../lib/llm";
import { ASSESSMENT_SYSTEM_PROMPT } from "../lib/prompts";
import {
  defaultAssessmentEmailSubject,
  formatAssessmentForStudents,
  generateAssessmentLocally,
  type GeneratedAssessment,
} from "../lib/localAssessmentGenerator";
import { isMailConfigured, sendEmail } from "../lib/emailSend";

export const assessmentRouter = Router();

const difficultyEnum = z.enum(["Easy", "Medium", "Hard", "Mixed"]);

const generateSchema = z.object({
  classManaged: z.string().min(1),
  grade: z.string().min(1),
  subject: z.string().trim().min(1).default("Physics"),
  chapters: z.string().trim().min(1, "List at least one chapter."),
  topics: z.string().trim().min(1, "List at least one topic."),
  difficulty: difficultyEnum.default("Medium"),
  questionCount: z.coerce.number().int().min(1).max(30).default(5),
  durationMinutes: z.coerce.number().int().min(10).max(300).optional(),
  additionalNotes: z.string().trim().optional(),
});

const sendSchema = z.object({
  classManaged: z.string().min(1),
  replyTo: z.string().trim().email().optional(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  scope: z.enum(["all", "selected"]).default("all"),
  studentIds: z.array(z.string()).optional(),
});

function parseGradeFromClass(classManaged: string): string {
  const dash = classManaged.indexOf("-");
  return dash > 0 ? classManaged.slice(0, dash).trim() : classManaged.trim();
}

assessmentRouter.post(
  "/generate-assessment",
  asyncHandler(async (req, res) => {
    const body = generateSchema.parse(req.body);
    const hasLlm = isLlmConfigured();

    let assessment: GeneratedAssessment;
    let analysisMode: "ai" | "local";

    if (hasLlm) {
      assessment = await completeJSON<GeneratedAssessment>({
        systemPrompt: ASSESSMENT_SYSTEM_PROMPT,
        userContent: [
          `Class / grade: ${body.grade} (Class ${body.classManaged})`,
          `Subject: ${body.subject}`,
          `Chapters: ${body.chapters}`,
          `Topics: ${body.topics}`,
          `Difficulty: ${body.difficulty}`,
          `Number of questions: ${body.questionCount}`,
          body.durationMinutes ? `Target duration: ${body.durationMinutes} minutes` : "",
          body.additionalNotes ? `Teacher notes: ${body.additionalNotes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        temperature: 0.35,
      });
      analysisMode = "ai";
    } else {
      assessment = generateAssessmentLocally({
        grade: body.grade,
        classManaged: body.classManaged,
        subject: body.subject,
        chapters: body.chapters,
        topics: body.topics,
        difficulty: body.difficulty,
        questionCount: body.questionCount,
        durationMinutes: body.durationMinutes,
        additionalNotes: body.additionalNotes,
      });
      analysisMode = "local";
    }

    if (!assessment.questions?.length) {
      throw new ApiError(422, "Could not generate assessment questions. Try different topics.");
    }

    const studentBody = formatAssessmentForStudents(assessment);
    const emailSubject = defaultAssessmentEmailSubject(assessment, body.classManaged);

    res.json({
      assessment,
      studentBody,
      emailSubject,
      analysisMode,
    });
  }),
);

assessmentRouter.post(
  "/send-assessment",
  asyncHandler(async (req, res) => {
    if (!isMailConfigured()) {
      throw new ApiError(
        503,
        "Email is not configured. Set RESEND_API_KEY or SMTP credentials in .env.",
        "MAIL_NOT_CONFIGURED",
      );
    }

    const body = sendSchema.parse(req.body);

    let targetIds: string[];
    if (body.scope === "all") {
      const all = await prisma.studentProfile.findMany({
        where: { classManaged: body.classManaged },
        select: { id: true },
      });
      if (all.length === 0) {
        throw new ApiError(404, "No students in this class.");
      }
      targetIds = all.map((s) => s.id);
    } else {
      if (!body.studentIds?.length) {
        throw new ApiError(400, "Select at least one student.");
      }
      targetIds = body.studentIds;
    }

    const results: {
      studentId: string;
      name: string;
      to: string;
      ok: boolean;
      messageId?: string;
      error?: string;
    }[] = [];

    for (const id of targetIds) {
      const student = await prisma.studentProfile.findUnique({ where: { id } });
      if (!student || student.classManaged !== body.classManaged) continue;

      const to = student.parentEmail?.trim();
      if (!to) {
        results.push({
          studentId: student.id,
          name: student.name,
          to: "",
          ok: false,
          error: "No parent email on file.",
        });
        continue;
      }

      const personalizedBody = [
        `Dear Parent/Guardian of ${student.name} (Roll ${student.rollNumber}),`,
        "",
        body.body,
      ].join("\n");

      try {
        const sent = await sendEmail({
          to,
          subject: body.subject,
          text: personalizedBody,
          replyTo: body.replyTo,
        });
        results.push({
          studentId: student.id,
          name: student.name,
          to,
          ok: true,
          messageId: sent.messageId,
        });
      } catch (err) {
        results.push({
          studentId: student.id,
          name: student.name,
          to,
          ok: false,
          error: err instanceof Error ? err.message : "Send failed.",
        });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    res.json({
      sent,
      failed: results.length - sent,
      skipped: results.filter((r) => !r.to).length,
      results,
      provider: process.env.RESEND_API_KEY?.trim() ? "resend" : "smtp",
    });
  }),
);

/** Preview how many students can receive the assessment by email. */
assessmentRouter.get(
  "/assessment/recipients",
  asyncHandler(async (req, res) => {
    const classManaged = z.string().min(1).parse(req.query.classManaged);
    const students = await prisma.studentProfile.findMany({
      where: { classManaged },
      select: { id: true, name: true, rollNumber: true, parentEmail: true },
      orderBy: { rollNumber: "asc" },
    });

    const withEmail = students.filter((s) => s.parentEmail?.trim());
    res.json({
      classManaged,
      total: students.length,
      withEmail: withEmail.length,
      withoutEmail: students.length - withEmail.length,
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        parentEmail: s.parentEmail ?? "",
        canSend: Boolean(s.parentEmail?.trim()),
      })),
    });
  }),
);
