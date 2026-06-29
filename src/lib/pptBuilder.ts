import PptxGenJS from "pptxgenjs";

export interface PptSlide {
  layout: "title" | "section" | "bullets" | "content" | "closing";
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  speakerNotes?: string;
}

export interface PptDeck {
  title: string;
  subtitle: string;
  subject: string;
  grade: string;
  slides: PptSlide[];
}

const TITLE_COLOR = "363636";
const ACCENT = "6366F1";
const SUB_COLOR = "5B647A";

export async function buildPptxBuffer(deck: PptDeck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "Gems Assist";
  pptx.title = deck.title;
  pptx.subject = deck.subject;
  pptx.layout = "LAYOUT_16x9";

  for (const s of deck.slides) {
    const slide = pptx.addSlide();

    if (s.layout === "title") {
      slide.background = { color: "0B1020" };
      slide.addText(s.title, {
        x: 0.6,
        y: 1.8,
        w: 8.8,
        h: 1.2,
        fontSize: 36,
        bold: true,
        color: "FFFFFF",
      });
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 0.6,
          y: 3.1,
          w: 8.8,
          h: 0.8,
          fontSize: 18,
          color: "C7CBE8",
        });
      }
    } else if (s.layout === "section") {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: "100%",
        h: 0.15,
        fill: { color: ACCENT },
      });
      slide.addText(s.title, {
        x: 0.6,
        y: 2.2,
        w: 8.8,
        h: 1,
        fontSize: 32,
        bold: true,
        color: ACCENT,
      });
    } else if (s.layout === "closing") {
      slide.background = { color: "0B1020" };
      slide.addText(s.title, {
        x: 0.6,
        y: 2.4,
        w: 8.8,
        h: 1,
        fontSize: 28,
        bold: true,
        color: "FFFFFF",
        align: "center",
      });
      if (s.body) {
        slide.addText(s.body, {
          x: 0.6,
          y: 3.5,
          w: 8.8,
          h: 0.8,
          fontSize: 16,
          color: "C7CBE8",
          align: "center",
        });
      }
    } else {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: "100%",
        h: 0.08,
        fill: { color: ACCENT },
      });
      slide.addText(s.title, {
        x: 0.5,
        y: 0.35,
        w: 9,
        h: 0.7,
        fontSize: 24,
        bold: true,
        color: TITLE_COLOR,
      });

      if (s.bullets?.length) {
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
          {
            x: 0.6,
            y: 1.2,
            w: 8.8,
            h: 4,
            fontSize: 16,
            color: SUB_COLOR,
            valign: "top",
          },
        );
      } else if (s.body) {
        slide.addText(s.body, {
          x: 0.6,
          y: 1.2,
          w: 8.8,
          h: 4,
          fontSize: 16,
          color: SUB_COLOR,
          valign: "top",
        });
      }
    }

    if (s.speakerNotes) {
      slide.addNotes(s.speakerNotes);
    }
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as ArrayBuffer);
}

export function deckFileName(deck: PptDeck, classManaged: string): string {
  const safe = deck.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return `${safe || "Lesson"}-Class-${classManaged}.pptx`;
}
