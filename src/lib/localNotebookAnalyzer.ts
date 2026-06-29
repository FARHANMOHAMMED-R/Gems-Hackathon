/**
 * Offline notebook grader for CBSE Class 11 notebooks.
 * Scores Handwriting, Creativity, and Content (5 marks each) using text
 * structure heuristics when no LLM API key is configured.
 */

export interface NotebookAnalysisResult {
  score_breakdown: {
    Handwriting: number;
    Creativity: number;
    Content: number;
    total: number;
    max: number;
  };
  constructive_feedback: string;
  concept_gaps: string[];
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function analyzeNotebookLocally(text: string): NotebookAnalysisResult {
  const trimmed = text.trim();
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/gi, "")));
  const uniqueRatio = uniqueWords.size / Math.max(wordCount, 1);

  const hasBullets = lines.some((l) => /^(\d+[.)]|[-•*])\s/.test(l));
  const hasHeadings = lines.some((l) => l.length < 60 && /^[A-Z]/.test(l));
  const avgLineLen =
    lines.length > 0 ? lines.reduce((s, l) => s + l.length, 0) / lines.length : 0;
  const hasMathOrScience =
    /\b(formula|equation|theorem|law|experiment|reaction|graph|diagram|definition|derive|calculate|because|therefore|hence)\b/i.test(
      trimmed,
    );
  const hasExamples = /\b(example|e\.g\.|for instance|such as|case study)\b/i.test(trimmed);
  const hasQuestions = /\?/.test(trimmed) || /\b(Q\d+|Question\s*\d+)/i.test(trimmed);

  // Handwriting proxy: legible structure, spacing, organisation
  let handwriting = 2.5;
  if (lines.length >= 4) handwriting += 0.8;
  if (lines.length >= 10) handwriting += 0.5;
  if (hasBullets || hasHeadings) handwriting += 0.7;
  if (avgLineLen > 0 && avgLineLen < 90) handwriting += 0.5;
  if (wordCount < 15) handwriting -= 1;

  // Creativity: varied vocabulary, examples, visual cues, expressive language
  let creativity = 2;
  if (uniqueRatio > 0.45) creativity += 1;
  if (uniqueRatio > 0.6) creativity += 0.5;
  if (hasExamples) creativity += 1;
  if (/\b(idea|creative|design|model|sketch|color|colour|draw)\b/i.test(trimmed)) creativity += 0.5;
  if (hasQuestions) creativity += 0.5;

  // Content: depth, subject terms, length, completeness
  let content = 2;
  if (wordCount >= 40) content += 0.8;
  if (wordCount >= 100) content += 0.8;
  if (wordCount >= 200) content += 0.5;
  if (hasMathOrScience) content += 1;
  if (lines.length >= 6) content += 0.5;

  const h = clampScore(handwriting);
  const c = clampScore(creativity);
  const co = clampScore(content);
  const total = h + c + co;

  const concept_gaps: string[] = [];
  if (wordCount < 40) concept_gaps.push("Notes are very brief — expand key definitions and worked steps.");
  if (!hasMathOrScience && wordCount > 30)
    concept_gaps.push("Add subject-specific terms, formulas, or labelled diagrams where relevant.");
  if (!hasExamples) concept_gaps.push("Include at least one worked example or application.");
  if (!hasBullets && lines.length > 8)
    concept_gaps.push("Use bullet points or numbered steps to improve readability.");
  if (h < 3) concept_gaps.push("Improve presentation: clearer headings and consistent line spacing.");
  if (c < 3) concept_gaps.push("Add creative elements — diagrams, real-world links, or varied examples.");
  if (co < 3) concept_gaps.push("Deepen content coverage with definitions, derivations, or summary tables.");

  const feedbackParts: string[] = [
    `Notebook reviewed locally (Handwriting ${h}/5, Creativity ${c}/5, Content ${co}/5).`,
  ];
  if (total >= 12) feedbackParts.push("Strong overall notebook with good structure and coverage.");
  else if (total >= 9) feedbackParts.push("Solid foundation — a few areas can be strengthened for full marks.");
  else feedbackParts.push("Focus on expanding content and organising notes more clearly.");

  if (h >= 4) feedbackParts.push("Presentation is neat and well structured.");
  if (co >= 4) feedbackParts.push("Content depth is good for CBSE Class 11 level.");
  if (c >= 4) feedbackParts.push("Creative presentation with useful examples or varied expression.");

  return {
    score_breakdown: {
      Handwriting: h,
      Creativity: c,
      Content: co,
      total,
      max: 15,
    },
    constructive_feedback: feedbackParts.join(" "),
    concept_gaps: concept_gaps.slice(0, 5),
  };
}
