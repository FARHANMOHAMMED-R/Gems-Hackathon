import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { complete, isLlmConfigured } from "../lib/llm";
import {
  aiCompleteJSON,
  isAnyAiConfigured,
  type AiProvider,
} from "../lib/aiProviders";
import { PARENT_MAIL_SYSTEM_PROMPT, PROFESSIONAL_EMAIL_SYSTEM_PROMPT } from "../lib/prompts";
import { draftParentMailLocally } from "../lib/localParentMailer";
import { draftProfessionalEmailLocally } from "../lib/localProfessionalEmail";
import {
  defaultMailSubject,
  isMailConfigured,
  sendEmail,
} from "../lib/emailSend";

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

const sendOneSchema = z.object({
  studentId: z.string().min(1),
  to: z.string().trim().email(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  replyTo: z.string().trim().email().optional(),
  saveParentEmail: z.boolean().optional(),
});

const providerSchema = z.enum(["openai", "gemini", "claude"]).optional();

const professionalEmailSchema = z.object({
  authorName: z.string().trim().min(1, "Author name is required."),
  content: z.string().trim().min(1, "Content to include in the email is required."),
  fileContext: z.string().trim().optional(),
  provider: providerSchema,
});

const sendProfessionalSchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  replyTo: z.string().trim().email().optional(),
});

const sendBatchSchema = z.object({
  classManaged: z.string().min(1),
  replyTo: z.string().trim().email().optional(),
  messages: z
    .array(
      z.object({
        studentId: z.string().min(1),
        to: z.string().trim().email(),
        subject: z.string().trim().min(1),
        body: z.string().trim().min(1),
        saveParentEmail: z.boolean().optional(),
      }),
    )
    .min(1),
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

async function generateEmailBody(
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
): Promise<{ body: string; analysisMode: "ai" | "local" }> {
  if (!isLlmConfigured()) {
    return {
      body: draftParentMailLocally(student, teacherSummary),
      analysisMode: "local",
    };
  }
  const dataString = buildStudentDataString(student, teacherSummary);
  const body = await complete({
    systemPrompt: PARENT_MAIL_SYSTEM_PROMPT,
    userContent: `Student performance data:\n\n${dataString}`,
    temperature: 0.5,
  });
  return { body, analysisMode: "ai" };
}

async function maybeSaveParentEmail(studentId: string, to: string, save?: boolean) {
  if (!save) return;
  await prisma.studentProfile.update({
    where: { id: studentId },
    data: { parentEmail: to },
  });
}

mailRouter.get(
  "/mail/status",
  asyncHandler(async (_req, res) => {
    res.json({
      configured: isMailConfigured(),
      provider: process.env.RESEND_API_KEY?.trim()
        ? "resend"
        : process.env.SMTP_HOST?.trim()
          ? "smtp"
          : null,
    });
  }),
);

mailRouter.post(
  "/generate-professional-email",
  asyncHandler(async (req, res) => {
    const body = professionalEmailSchema.parse(req.body);

    if (!isAnyAiConfigured()) {
      const draft = draftProfessionalEmailLocally(
        body.authorName,
        body.content,
        body.fileContext,
      );
      res.json({ ...draft, analysisMode: "local" as const });
      return;
    }

    const userParts = [
      `Author name (sign the email with this name): ${body.authorName}`,
      "",
      "Content to include in the email:",
      body.content,
    ];
    if (body.fileContext?.trim()) {
      userParts.push("", "Additional context from an attached file:", body.fileContext.trim());
    }

    const { data: result, provider } = await aiCompleteJSON<{ subject: string; body: string }>({
      systemPrompt: PROFESSIONAL_EMAIL_SYSTEM_PROMPT,
      userContent: userParts.join("\n"),
      temperature: 0.45,
      provider: body.provider as AiProvider | undefined,
    });

    res.json({
      subject: result.subject?.trim() || "Professional communication",
      body: result.body?.trim() || body.content,
      analysisMode: "ai" as const,
      providerUsed: provider,
    });
  }),
);

mailRouter.post(
  "/send-professional-email",
  asyncHandler(async (req, res) => {
    if (!isMailConfigured()) {
      throw new ApiError(
        503,
        "Email is not configured. Set RESEND_API_KEY or SMTP credentials in .env.",
        "MAIL_NOT_CONFIGURED",
      );
    }

    const payload = sendProfessionalSchema.parse(req.body);
    const sent = await sendEmail({
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      replyTo: payload.replyTo,
    });

    res.json({
      ok: true,
      to: payload.to,
      messageId: sent.messageId,
      provider: sent.provider,
    });
  }),
);

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

    const { body, analysisMode } = await generateEmailBody(student, teacherSummary);

    res.json({
      studentId,
      name: student.name,
      parentEmail: student.parentEmail,
      subject: defaultMailSubject(student.name, student.classManaged),
      body,
      email: body,
      analysisMode,
    });
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
      parentEmail: string;
      subject: string;
      body: string;
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

      const result = await generateEmailBody(student, body.teacherSummary);
      analysisMode = result.analysisMode;
      emails.push({
        studentId: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        parentEmail: student.parentEmail,
        subject: defaultMailSubject(student.name, student.classManaged),
        body: result.body,
        email: result.body,
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

mailRouter.post(
  "/send-mail",
  asyncHandler(async (req, res) => {
    if (!isMailConfigured()) {
      throw new ApiError(
        503,
        "Email is not configured. Set RESEND_API_KEY or SMTP credentials in .env.",
        "MAIL_NOT_CONFIGURED",
      );
    }

    const payload = sendOneSchema.parse(req.body);
    const student = await prisma.studentProfile.findUnique({
      where: { id: payload.studentId },
    });
    if (!student) throw new ApiError(404, "Student not found.");

    const sent = await sendEmail({
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      replyTo: payload.replyTo,
    });

    await maybeSaveParentEmail(payload.studentId, payload.to, payload.saveParentEmail ?? true);

    res.json({
      ok: true,
      studentId: payload.studentId,
      to: payload.to,
      messageId: sent.messageId,
      provider: sent.provider,
    });
  }),
);

mailRouter.post(
  "/send-mail/batch",
  asyncHandler(async (req, res) => {
    if (!isMailConfigured()) {
      throw new ApiError(
        503,
        "Email is not configured. Set RESEND_API_KEY or SMTP credentials in .env.",
        "MAIL_NOT_CONFIGURED",
      );
    }

    const payload = sendBatchSchema.parse(req.body);
    const results: {
      studentId: string;
      to: string;
      ok: boolean;
      messageId?: string;
      error?: string;
    }[] = [];

    for (const msg of payload.messages) {
      const student = await prisma.studentProfile.findUnique({
        where: { id: msg.studentId },
      });
      if (!student || student.classManaged !== payload.classManaged) {
        results.push({
          studentId: msg.studentId,
          to: msg.to,
          ok: false,
          error: "Student not found in this class.",
        });
        continue;
      }

      try {
        const sent = await sendEmail({
          to: msg.to,
          subject: msg.subject,
          text: msg.body,
          replyTo: payload.replyTo,
        });
        await maybeSaveParentEmail(msg.studentId, msg.to, msg.saveParentEmail ?? true);
        results.push({
          studentId: msg.studentId,
          to: msg.to,
          ok: true,
          messageId: sent.messageId,
        });
      } catch (err) {
        results.push({
          studentId: msg.studentId,
          to: msg.to,
          ok: false,
          error: err instanceof Error ? err.message : "Send failed.",
        });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    res.json({
      sent,
      failed: results.length - sent,
      results,
      provider: process.env.RESEND_API_KEY?.trim() ? "resend" : "smtp",
    });
  }),
);
