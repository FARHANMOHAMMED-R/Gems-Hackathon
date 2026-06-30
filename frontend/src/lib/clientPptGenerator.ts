import type { PptDeck } from "./buildPptx";

const SYSTEM_PROMPT = `You are an expert CBSE teacher creating classroom PowerPoint slide decks.

Build a clear, engaging presentation for Indian school students. Use simple language appropriate to the grade level.

Return strict JSON only:
{
  "title": string,
  "subtitle": string,
  "subject": string,
  "grade": string,
  "slides": [
    {
      "layout": "title" | "section" | "bullets" | "content" | "closing",
      "title": string,
      "subtitle": string (title slide only),
      "bullets": string[] (for bullets layout),
      "body": string (for content/closing),
      "speakerNotes": string (teacher talking points)
    }
  ]
}

Rules:
- First slide: layout "title" with title + subtitle
- Include 1 section divider slide for major topics
- Use "bullets" for teaching points (max 5 bullets per slide, concise)
- Last slide: layout "closing" with summary or homework reminder
- Match the requested slide count closely
- Align content to the given chapters, topics, and grade`;

function parseJsonDeck(raw: string): PptDeck {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI did not return valid JSON.");
  const parsed = JSON.parse(jsonText.slice(start, end + 1)) as PptDeck;
  if (!parsed.slides?.length) throw new Error("AI returned no slides.");
  return parsed;
}

export async function clientGeneratePptDeck(
  provider: "openai" | "gemini",
  apiKey: string,
  input: {
    classManaged: string;
    grade: string;
    subject: string;
    topic: string;
    chapters: string;
    slideCount: number;
    additionalNotes?: string;
  },
): Promise<PptDeck> {
  const userPrompt = [
    `Class: ${input.classManaged} (Grade ${input.grade})`,
    `Subject: ${input.subject}`,
    `Lesson topic: ${input.topic}`,
    `Chapters: ${input.chapters}`,
    `Target slide count: ${input.slideCount}`,
    input.additionalNotes ? `Teacher notes: ${input.additionalNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(body.error?.message ?? `OpenAI error (${res.status})`);
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI returned an empty response.");
    return parseJsonDeck(text);
  }

  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
  ];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
          }),
        },
      );
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(body.error?.message ?? `Gemini error (${res.status})`);
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new Error("Gemini returned an empty response.");
      return parseJsonDeck(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Gemini failed to generate slides.");
}
