import type { DifferentiationTarget } from "./prompts";

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

/** Pull likely key terms from source (proper nouns, repeated capitalized phrases). */
function extractKeyTerms(text: string): string[] {
  const proper = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const p of proper) {
    if (p.length < 4 || ["The", "This", "That", "They", "Their"].includes(p)) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  if (ranked.length >= 3) return ranked.slice(0, 8);
  const words = text.split(/\s+/).filter((w) => w.length > 6);
  return [...new Set(words.map((w) => w.replace(/[^a-zA-Z-]/g, "")))].slice(0, 6);
}

function chunkLines(text: string, size: number): string[] {
  const s = splitSentences(text);
  const chunks: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    chunks.push(s.slice(i, i + size).join(" "));
  }
  return chunks.length ? chunks : [text.trim()];
}

function standardNotes(source: string, sentences: string[], terms: string[]): string {
  const termBlock =
    terms.length > 0
      ? terms.map((t) => `- **${t}** — referenced in the lesson`).join("\n")
      : "- *(Key terms appear in the summary below)*";

  const summary = sentences.map((s) => `- ${s}`).join("\n");

  return `# CBSE Study Notes

## Key Terms
${termBlock}

## Lesson Summary
${summary}

## Example Applications
- Relate the main ideas above to a real-world case from your textbook or current affairs.
- Write one paragraph explaining how **${terms[0] ?? "the main concept"}** connects to the chapter theme.

---
*Adapted locally from your source lesson (Standard track). Add \`OPENAI_API_KEY\` for full AI rewriting.*`;
}

function advancedPrimer(source: string, sentences: string[], terms: string[]): string {
  return `# Advanced Research Primer

## Core Framework
${sentences.slice(0, 3).map((s) => `- ${s}`).join("\n")}

## Extended Exploratory Concepts
${terms.map((t) => `- **${t}**: How does this concept interact with broader historical / scientific frameworks? What assumptions does it rely on?`).join("\n")}

## Deeper Questions for Investigation
${sentences.slice(0, 5).map((s, i) => `${i + 1}. What evidence supports or challenges: "${s.slice(0, 80)}…"?`).join("\n")}

## Logic & Analysis Prompt
- Compare two interpretations of the source material.
- Draft a short proof-style argument linking cause → effect using only facts from the lesson.

---
*Local Advanced adaptation — grounded to source text.*`;
}

function simplifiedVisual(source: string, sentences: string[]): string {
  const steps = chunkLines(source, 2);
  const body = steps
    .map(
      (step, i) => `## Step ${i + 1}

${step.split(/,\s+/).map((p) => `- ${p.trim()}`).join("\n")}

> **[VISUAL PLACEHOLDER]**  
> Draw or paste a simple diagram for Step ${i + 1} here.`,
    )
    .join("\n\n");

  return `# Simplified Lesson (Visual Layout)

${body}

## Quick Recap
- Read one step at a time.
- Match each step to the visual placeholder above.

---
*Local Simplified Visual track — short steps + diagram slots.*`;
}

function neurodivergent(source: string, sentences: string[]): string {
  const micro = chunkLines(source, 1);
  const chunks = micro
    .map(
      (line, i) => `### Micro-Chunk ${i + 1} · ~5 minutes

- ${line}

**Study milestone:** Can you say this idea in one sentence aloud?

---`,
    )
    .join("\n\n");

  return `# Micro-Chunked Lesson

> Dyslexia-friendly layout: short lines, clear bullets, frequent breaks.

${chunks}

## ADHD Study Plan
1. Set a 5-minute timer for each micro-chunk.
2. Tick ✓ when you finish each milestone.
3. Take a 2-minute movement break between chunks.

---
*Local Neurodivergent track — micro-steps with 5-minute milestones.*`;
}

/**
 * Rule-based content differentiation when no LLM is configured.
 * Output is markdown grounded strictly in the source text.
 */
export function differentiateLocally(
  source: string,
  target: DifferentiationTarget,
): string {
  const trimmed = source.trim();
  const sentences = splitSentences(trimmed);
  const terms = extractKeyTerms(trimmed);

  switch (target) {
    case "Advanced":
      return advancedPrimer(trimmed, sentences, terms);
    case "Standard":
      return standardNotes(trimmed, sentences, terms);
    case "Simplified Visual":
      return simplifiedVisual(trimmed, sentences);
    case "Neurodivergent":
      return neurodivergent(trimmed, sentences);
    default:
      return standardNotes(trimmed, sentences, terms);
  }
}
