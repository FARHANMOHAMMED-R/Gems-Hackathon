import type { AssistantAiProvider } from "./assistantAiConfig";

/** Read notebook/exam images with the browser-stored Gemini or OpenAI key. */
export async function clientVisionOcr(
  provider: AssistantAiProvider,
  apiKey: string,
  dataUrls: string[],
): Promise<string> {
  const prompt =
    "Transcribe all visible handwritten and printed text from this student notebook or exam page. " +
    "Preserve line breaks. Return only the transcribed text, no commentary.";

  if (provider === "gemini") {
    const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = [
      { text: prompt },
    ];
    for (const url of dataUrls) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
    }

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        encodeURIComponent(apiKey.trim()),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0 },
        }),
      },
    );

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(body.error?.message ?? `Gemini OCR failed (${res.status})`);
    return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe the following page(s)." },
            ...dataUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        },
      ],
    }),
  });

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? `OpenAI OCR failed (${res.status})`);
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}
