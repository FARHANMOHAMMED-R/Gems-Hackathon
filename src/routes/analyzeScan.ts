import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { completeJSON, isLlmConfigured } from "../lib/llm";
import { analyzeNotebookLocally } from "../lib/localNotebookAnalyzer";
import { digitizeScanImages, getOcrStatus, type OcrMode } from "../lib/scanOcr";
import { toJsonColumn } from "../lib/json";
import { EXAMINER_SYSTEM_PROMPT } from "../lib/prompts";

export const analyzeScanRouter = Router();

const schema = z
  .object({
    mode: z.enum(["Exam Paper", "Notebook"]),
    studentId: z.string().optional(),
    markingScheme: z.string().optional(),
    images: z.array(z.string()).min(1).optional(),
    rawScannedText: z.string().min(1).optional(),
    provider: z.enum(["openai", "gemini", "claude"]).optional(),
    apiKey: z.string().trim().min(10).max(512).optional(),
  })
  .refine((d) => d.images || d.rawScannedText, {
    message: "Provide either `images` (base64) or `rawScannedText`.",
  });

interface ExaminerResult {
  score_breakdown: Record<string, unknown>;
  constructive_feedback: string;
  concept_gaps: string[];
}

analyzeScanRouter.get(
  "/scan/ocr-status",
  asyncHandler(async (_req, res) => {
    res.json(getOcrStatus());
  }),
);

analyzeScanRouter.post(
  "/analyze-scan",
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);
    const hasLlm = isLlmConfigured();

    let rawText = body.rawScannedText?.trim() ?? "";
    let ocrMode: OcrMode = "pasted";

    if (!rawText && body.images?.length) {
      const digitized = await digitizeScanImages(body.images, body.mode, {
        provider: body.provider,
        apiKey: body.apiKey,
      });
      rawText = digitized.rawText;
      ocrMode = digitized.ocrMode;
    }

    if (!rawText.trim()) {
      throw new ApiError(
        422,
        "Could not extract any text from the scan. Try a clearer photo of the notebook page or paste the text.",
        "OCR_EMPTY",
      );
    }

    let result: ExaminerResult;
    let analysisMode: "ai" | "local" = "ai";

    if (body.mode === "Notebook" && !hasLlm) {
      result = analyzeNotebookLocally(rawText);
      analysisMode = "local";
    } else if (!hasLlm) {
      throw new ApiError(
        503,
        "Exam grading needs OPENAI_API_KEY in .env. Notebook mode works without it once text is extracted.",
        "LLM_NOT_CONFIGURED",
      );
    } else {
      const userContent = [
        `Mode: ${body.mode}`,
        body.mode === "Exam Paper"
          ? `Answer Marking Scheme:\n${body.markingScheme ?? "(none provided)"}`
          : "Evaluate strictly on Handwriting, Creativity and Content (5 marks each).",
        `Extracted Student Text:\n${rawText}`,
      ].join("\n\n");

      result = await completeJSON<ExaminerResult>({
        systemPrompt: EXAMINER_SYSTEM_PROMPT,
        userContent,
      });
    }

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

    res.json({ recordId, rawScannedText: rawText, analysisMode, ocrMode, ...result });
  }),
);
