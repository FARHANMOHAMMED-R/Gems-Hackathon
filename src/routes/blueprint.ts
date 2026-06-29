import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../lib/http";
import { completeJSON, transcribeDocument, isLlmConfigured } from "../lib/llm";
import { extractDocumentText } from "../lib/documentExtract";
import { generateBlueprintLocally } from "../lib/localBlueprintGenerator";
import {
  BLUEPRINT_SYSTEM_PROMPT,
  VISION_TRANSCRIBE_SYSTEM_PROMPT,
} from "../lib/prompts";

export const blueprintRouter = Router();

const schema = z
  .object({
    subject: z.string().trim().optional(),
    examTitle: z.string().trim().optional(),
    durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
    images: z.array(z.string()).min(1).optional(),
    rawScannedText: z.string().min(1).optional(),
  })
  .refine((d) => d.images || d.rawScannedText, {
    message: "Provide either `images` (base64) or `rawScannedText`.",
  });

blueprintRouter.post(
  "/generate-blueprint",
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);
    const hasLlm = isLlmConfigured();

    let rawText = body.rawScannedText?.trim() ?? "";
    if (!rawText && body.images?.length) {
      try {
        if (hasLlm) {
          try {
            rawText = await transcribeDocument(
              VISION_TRANSCRIBE_SYSTEM_PROMPT,
              body.images,
            );
          } catch {
            rawText = await extractDocumentText(body.images);
          }
        } else {
          rawText = await extractDocumentText(body.images);
        }
      } catch (err) {
        throw new ApiError(
          422,
          err instanceof Error
            ? err.message
            : "Could not read the uploaded file. Use a PDF with selectable text or paste the exam text.",
        );
      }
    }

    if (!rawText.trim()) {
      throw new ApiError(
        422,
        "Could not extract any text from the exam paper. Try a clearer scan or paste the text.",
      );
    }

    let blueprint;
    let analysisMode: "ai" | "local";

    if (hasLlm) {
      blueprint = await completeJSON({
        systemPrompt: BLUEPRINT_SYSTEM_PROMPT,
        userContent: [
          body.subject ? `Subject: ${body.subject}` : "",
          body.examTitle ? `Suggested title: ${body.examTitle}` : "",
          body.durationMinutes ? `Duration hint: ${body.durationMinutes} minutes` : "",
          `Exam paper text:\n\n${rawText}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        temperature: 0.2,
      });
      analysisMode = "ai";
    } else {
      blueprint = generateBlueprintLocally(rawText, {
        subject: body.subject,
        examTitle: body.examTitle,
        durationMinutes: body.durationMinutes,
      });
      analysisMode = "local";
    }

    res.json({
      rawScannedText: rawText,
      analysisMode,
      blueprint,
    });
  }),
);
