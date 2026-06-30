import { detectAppNavigation } from "./localAssistant";

/** Detect history, science, and other general-knowledge questions. */
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
    /^what (?:is|was|are|were)\s+(?:the date when|the year when|the time when)\s+/i,
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
  return q.replace(/\b(die|died|death|born|birth)\b/gi, "").trim() || message.trim();
}

function buildSearchCandidates(message: string): string[] {
  const q = message.trim();
  const out: string[] = [];

  if (/\bnapoleon(?:\s+bonaparte)?s?\b/i.test(q)) out.push("Napoleon");
  if (/\b(einstein|shakespeare|gandhi|cleopatra|newton|darwin)\b/i.test(q)) {
    const m = q.match(/\b(einstein|shakespeare|gandhi|cleopatra|newton|darwin)\b/i);
    if (m) out.push(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase());
  }

  out.push(extractSearchTerm(message));
  return [...new Set(out.map((s) => s.trim()).filter((s) => s.length >= 2))];
}

async function searchWikipedia(term: string): Promise<string | null> {
  const searchRes = await fetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=1&namespace=0&format=json`,
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
}

/** Free general-knowledge lookup via Wikipedia (no API key). */
export async function fetchWikipediaAnswer(message: string): Promise<string | null> {
  for (const term of buildSearchCandidates(message)) {
    try {
      const answer = await searchWikipedia(term);
      if (answer) return answer;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}
