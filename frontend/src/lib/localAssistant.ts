/** Browser-side assistant fallback when the API is unreachable. */
export function localAssistantReply(
  message: string,
  context?: { teacherName?: string; classManaged?: string },
): string {
  const q = message.trim().toLowerCase();
  const name = context?.teacherName?.trim() || "there";
  const cls = context?.classManaged?.trim();

  if (/^(hi|hello|hey|good morning|good afternoon)/.test(q)) {
    return `Hello ${name}! I'm your Gems Assist helper. Ask me about grading, lesson tools, class setup, or anything on the platform.`;
  }

  if (/scan|grade|grading|notebook|exam|analyzer/.test(q)) {
    return "Open Scan Analyzer from the sidebar to upload notebook or exam photos. Pick a student, add images or text, then run Analyze.";
  }

  if (/student|roster|list|roll/.test(q)) {
    return "Use Student list in the sidebar to add or edit names, roll numbers, and school IDs.";
  }

  if (/dojo|point|token|reward|leaderboard/.test(q)) {
    return "Class Dojo lets you award points and view the live leaderboard for your class.";
  }

  if (/email|mail|parent|professional|report/.test(q)) {
    return "Professional Email and Report Comments are in the sidebar — they draft emails and report-card comments from your notes.";
  }

  if (/help|how|what|where|start/.test(q)) {
    const classLine = cls ? ` You're on class ${cls}.` : "";
    return `Open the Dashboard for shortcuts to every tool.${classLine} Ask me something specific like "How do I grade notebooks?"`;
  }

  return `I can help with Gems Assist — grading, points, emails, assessments, and more. What would you like to do, ${name}?`;
}
