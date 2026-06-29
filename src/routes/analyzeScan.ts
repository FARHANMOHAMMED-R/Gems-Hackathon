import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { completeJSON, transcribeDocument } from "../lib/llm";
import { toJsonColumn } from "../lib/json";
import {
  EXAMINER_SYSTEM_PROMPT,
  VISION_TRANSCRIBE_SYSTEM_PROMPT,
} from "../lib/prompts";

export const analyzeScanRouter = Router();

/**
 * Request contract for /api/analyze-scan.
 *
 * Either provide `images` (base64 data URLs of scanned pages) to run the full
 * Vision -> Examiner pipeline, or provide `rawScannedText` directly to skip OCR.
 */
const schema = z
  .object({
    mode: z.enum(["Exam Paper", "Notebook"]),
    studentId: z.string().optional(),
    // For 'Exam Paper' mode the marking scheme is what answers are graded against.
    markingScheme: z.string().optional(),
    images: z.array(z.string()).min(1).optional(),
    rawScannedText: z.string().min(1).optional(),
  })
  .refine((d) => d.images || d.rawScannedText, {
    message: "Provide either `images` (base64) or `rawScannedText`.",
  });

/** Strongly-typed shape we expect back from the examiner model. */
interface ExaminerResult {
  score_breakdown: Record<string, unknown>;
  constructive_feedback: string;
  concept_gaps: string[];
}

analyzeScanRouter.post(
  "/analyze-scan",
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);

    // 1) Digitization step: OCR the scanned pages unless raw text was supplied.
    const rawText =
      body.rawScannedText ??
      (await transcribeDocument(
        VISION_TRANSCRIBE_SYSTEM_PROMPT,
        body.images as string[]
      ));

    if (!rawText.trim()) {
      throw new ApiError(422, "Could not extract any text from the scan.");
    }

    // 2) Examiner step: route the digitized string through the grading prompt.
    //    The user message carries the mode, marking scheme and extracted text.
    const userContent = [
      `Mode: ${body.mode}`,
      body.mode === "Exam Paper"
        ? `Answer Marking Scheme:\n${body.markingScheme ?? "(none provided)"}`
        : "Evaluate strictly on Handwriting, Creativity and Content (5 marks each).",
      `Extracted Student Text:\n${rawText}`,
    ].join("\n\n");

    const result = await completeJSON<ExaminerResult>({
      systemPrompt: EXAMINER_SYSTEM_PROMPT,
      userContent,
    });

    // 3) Persist the grading record when tied to a known student.
    let recordId: string | undefined;
    if (body.studentId) {
      const student = await prisma.studentProfile.findUnique({
        where: { id: body.studentId },
      });
      if (!student) throw new ApiError(404, "Student not found.");

      const record = await prisma.gradingRecord.create({
        data: {
          studentId: body.studentId,
          type: body.mode === "Exam Paper" ? "Exam" : "Notebook",
          rawScannedText: rawText,
          scores: toJsonColumn(result.score_breakdown ?? {}),
          aiFeedbackText: result.constructive_feedback ?? "",
        },
      });
      recordId = record.id;
    }

    res.json({ recordId, rawScannedText: rawText, ...result });
  })
);
