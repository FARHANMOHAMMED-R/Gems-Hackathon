import { detectAppNavigation } from "./localAssistant";

export function isGeneralKnowledgeQuestion(message: string): boolean {
  const q = message.trim().toLowerCase();
  if (detectAppNavigation(message)) return false;
  return (
    /^(who (was|is|were|are)|what (is|was|are|were)|when (did|was|is)|where (is|was|did)|why (did|is|was|do)|how (did|does|do|was)|tell me about|explain|define|describe)\b/.test(
      q,
    ) ||
    /\b(napoleon|history|science|math|physics|chemistry|biology|geography|president|war|invented|discovered)\b/.test(
      q,
    )
  );
}

function extractSearchTerm(message: string): string {
  let q = message.trim().replace(/\?+$/, "");
  const patterns = [
    /^who (?:was|is|were|are)\s+/i,
    /^what (?:is|was|are|were)\s+/i,
    /^when (?:did|was|is)\s+/i,
    /^where (?:is|was|did)\s+/i,
    /^why (?:did|is|was|do|does)\s+/i,
    /^how (?:did|does|do|was)\s+/i,
    /^tell me about\s+/i,
    /^explain\s+/i,
    /^define\s+/i,
    /^describe\s+/i,
  ];
  for (const p of patterns) {
    q = q.replace(p, "");
  }
  return q.trim() || message.trim();
}

export async function fetchWikipediaAnswer(message: string): Promise<string | null> {
  const term = extractSearchTerm(message);
  if (!term) return null;

  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=1&namespace=0&format=json&origin=*`,
    );
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json()) as [string, string[], string[], string[]];
    const title = searchData[1]?.[0];
    const description = searchData[2]?.[0];
    if (!title) return null;

    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    );
    if (!summaryRes.ok) {
      return description ? `${title}: ${description}` : null;
    }

    const summary = (await summaryRes.json()) as {
      title?: string;
      description?: string;
      extract?: string;
    };

    const parts: string[] = [];
    if (summary.title) parts.push(summary.title);
    if (summary.description) parts.push(summary.description);
    if (summary.extract) parts.push(summary.extract);
    return parts.join("\n\n").trim() || null;
  } catch {
    return null;
  }
}
