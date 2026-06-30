/** Built-in assistant replies when no LLM API key is configured. */
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
    return "Open Scan Analyzer from the sidebar to upload notebook or exam photos. Pick a student from your list, add images or paste text, then run Analyze.";
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

  if (/ppt|slide|presentation/.test(q)) {
    return "PPT Generator creates lesson slides from your topic and chapters.";
  }

  if (/lab|phet|3d|simulation/.test(q)) {
    return "3D Lab has PhET simulations. Lab Booking helps reserve school labs.";
  }

  if (/assessment|quiz|test|assign/.test(q)) {
    return "Assessment Assigner generates CBSE-style assessments by topic.";
  }

  if (/performance|mark|graph|pt1|term/.test(q)) {
    return "Performance Tracker stores term marks and draws trend graphs per student.";
  }

  if (/lecture|record|audio|transcri/.test(q)) {
    return "Lecture Recorder captures class audio and builds a timeline summary.";
  }

  if (/help|how|what|where|start|begin/.test(q)) {
    const classLine = cls ? ` You're on class ${cls}.` : "";
    return `Start from the Dashboard — it links to every tool.${classLine} Ask me something specific!`;
  }

  return `Thanks, ${name}. I can help with Gems Assist — grading, points, emails, assessments, and more. Try "How do I grade notebooks?"`;
}
