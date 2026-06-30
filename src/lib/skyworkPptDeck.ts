import type { PptDeck } from "./pptBuilder";

export function deckFromSkyworkOutline(
  outline: string,
  meta: { topic: string; subject: string; grade: string },
): PptDeck {
  const chunks = outline
    .split(/\n(?=\s*(?:Page|Slide)\s+\d+[:.)]|\d+[.)]\s)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const slides =
    chunks.length > 0
      ? chunks.map((chunk, i) => {
          const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
          const title = lines[0]?.replace(/^(?:Page|Slide)\s+\d+[:.)]\s*/i, "") || `Slide ${i + 1}`;
          const bullets = lines.slice(1).filter((l) => l.length > 2);
          return {
            layout: "bullets" as const,
            title: title.slice(0, 120),
            bullets: bullets.length ? bullets.slice(0, 8) : undefined,
            body: bullets.length ? undefined : lines.slice(1).join(" ").slice(0, 500) || undefined,
          };
        })
      : outline
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 20)
          .map((line, i) => ({
            layout: "bullets" as const,
            title: `Point ${i + 1}`,
            bullets: [line],
          }));

  return {
    title: meta.topic,
    subtitle: `${meta.subject} · Grade ${meta.grade}`,
    subject: meta.subject,
    grade: meta.grade,
    slides: [
      {
        layout: "title",
        title: meta.topic,
        subtitle: `${meta.subject} · Grade ${meta.grade} · Skywork AI`,
      },
      ...slides.slice(0, 24),
      {
        layout: "closing",
        title: "Thank you",
        subtitle: "Download the .pptx for the full designed deck.",
      },
    ],
  };
}

export function placeholderSkyworkDeck(meta: {
  topic: string;
  subject: string;
  grade: string;
  slideCount: number;
}): PptDeck {
  return {
    title: meta.topic,
    subtitle: `${meta.subject} · Grade ${meta.grade}`,
    subject: meta.subject,
    grade: meta.grade,
    slides: [
      {
        layout: "title",
        title: meta.topic,
        subtitle: `${meta.subject} · Grade ${meta.grade}`,
      },
      {
        layout: "content",
        title: "Skywork presentation ready",
        body: `Your ${meta.slideCount}-slide deck was generated with Skywork AI. Download the .pptx file for the full designed slides, images, and layout.`,
      },
      { layout: "closing", title: "Questions?", subtitle: meta.topic },
    ],
  };
}
