import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { completeJSON, transcribeDocument, isLlmConfigured } from "../lib/llm";
import { analyzeNotebookLocally } from "../lib/localNotebookAnalyzer";
import { guruPdfOcrImages, isGuruPdfConfigured } from "../lib/gurupdfOcr";
import { ocrImages } from "../lib/ocr";
import { toJsonColumn } from "../lib/json";
import {
  EXAMINER_SYSTEM_PROMPT,
  VISION_TRANSCRIBE_SYSTEM_PROMPT,
} from "../lib/prompts";

export const analyzeScanRouter = Router();

const schema = z
  .object({
    mode: z.enum(["Exam Paper", "Notebook"]),
    studentId: z.string().optional(),
    markingScheme: z.string().optional(),
    images: z.array(z.string()).min(1).optional(),
    rawScannedText: z.string().min(1).optional(),
  })
  .refine((d) => d.images || d.rawScannedText, {
    message: "Provide either `images` (base64) or `rawScannedText`.",
  });

interface ExaminerResult {
  score_breakdown: Record<string, unknown>;
  constructive_feedback: string;
  concept_gaps: string[];
}

analyzeScanRouter.post(
  "/analyze-scan",
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);
    const hasLlm = isLlmConfigured();
    const hasGuruPdf = isGuruPdfConfigured();

    // 1) Digitization: pasted text, PDF Guru OCR, AI vision, or local Tesseract.
    let rawText = body.rawScannedText?.trim() ?? "";
    let ocrMode: "pasted" | "gurupdf" | "openai" | "tesseract" = "pasted";
    if (!rawText && body.images?.length) {
      if (hasGuruPdf) {
        rawText = await guruPdfOcrImages(body.images);
        ocrMode = "gurupdf";
      } else if (hasLlm) {
        rawText = await transcribeDocument(
          VISION_TRANSCRIBE_SYSTEM_PROMPT,
          body.images,
        );
        ocrMode = "openai";
      } else if (body.mode === "Notebook") {
        rawText = await ocrImages(body.images);
        ocrMode = "tesseract";
      } else {
        throw new ApiError(
          503,
          "Upload OCR needs GURUPDF_API_KEY (PDF Guru image-to-text) or OPENAI_API_KEY. Notebook mode also works with local Tesseract.",
          "OCR_NOT_CONFIGURED",
        );
      }
    }

    if (!rawText.trim()) {
      throw new ApiError(
        422,
        "Could not extract any text from the scan. Try a clearer image or paste the note text.",
      );
    }

    // 2) Grading: AI examiner or local notebook analyzer.
    let result: ExaminerResult;
    let analysisMode: "ai" | "local" = "ai";

    if (body.mode === "Notebook" && !hasLlm) {
      result = analyzeNotebookLocally(rawText);
      analysisMode = "local";
    } else if (!hasLlm) {
      throw new ApiError(
        503,
        "OPENAI_API_KEY is not set. Notebook mode works offline; exam grading needs a key.",
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

    // 3) Persist grading record when linked to a student.
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
