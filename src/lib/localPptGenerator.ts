import type { PptDeck } from "./pptBuilder";

export function generatePptLocally(input: {
  classManaged: string;
  grade: string;
  subject: string;
  topic: string;
  chapters: string;
  slideCount: number;
}): PptDeck {
  const chapters = input.chapters
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chapterLabel = chapters.slice(0, 2).join(", ") || input.topic;

  const contentSlides = Math.max(1, input.slideCount - 3);
  const slides: PptDeck["slides"] = [
    {
      layout: "title",
      title: input.topic,
      subtitle: `${input.subject} · Grade ${input.grade} · Class ${input.classManaged}`,
    },
    {
      layout: "section",
      title: "Learning objectives",
      speakerNotes: "Review objectives with the class.",
    },
    {
      layout: "bullets",
      title: "What we will cover",
      bullets: [
        `Chapters: ${chapterLabel}`,
        `Core topic: ${input.topic}`,
        "Key definitions and formulas",
        "Worked examples and practice",
        "Summary and quick check",
      ].slice(0, 5),
    },
  ];

  for (let i = 0; i < contentSlides; i++) {
    const chapter = chapters[i % chapters.length] ?? input.topic;
    slides.push({
      layout: "bullets",
      title: chapters.length > 1 ? chapter : `${input.topic} — Part ${i + 1}`,
      bullets: [
        `Key ideas from ${chapter}`,
        "Include one real-world example",
        "Ask a check-for-understanding question",
      ],
      speakerNotes: "Expand with board work and student questions.",
    });
  }

  slides.push({
    layout: "closing",
    title: "Thank you",
    body: "Questions? Review your notes and attempt the practice problems.",
  });

  return {
    title: input.topic,
    subtitle: `${input.subject} · Grade ${input.grade}`,
    subject: input.subject,
    grade: input.grade,
    slides: slides.slice(0, input.slideCount),
  };
}
