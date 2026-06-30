/** Sidebar page ids the assistant can open. */
export type AssistantNavId =
  | "dashboard"
  | "classdojo"
  | "students"
  | "scan"
  | "blueprint"
  | "content"
  | "substitution"
  | "labs"
  | "3dlab"
  | "chat"
  | "lecture"
  | "performance"
  | "ppt"
  | "assessment"
  | "mailer"
  | "reportcomments";

export const ASSISTANT_NAV_LABELS: Record<AssistantNavId, string> = {
  dashboard: "Dashboard",
  classdojo: "Class Dojo",
  students: "Student list",
  scan: "Scan Analyzer",
  blueprint: "Blueprint Generator",
  content: "Text Leveler",
  substitution: "Substitution Finder",
  labs: "Lab Booking",
  "3dlab": "3D Lab",
  chat: "Teacher Chat",
  lecture: "Lecture Recorder",
  performance: "Performance Tracker",
  ppt: "PPT Generator",
  assessment: "Assessment Assigner",
  mailer: "Professional Email",
  reportcomments: "Report Comments",
};

const VALID_NAV_IDS = new Set<string>(Object.keys(ASSISTANT_NAV_LABELS));

export function isAssistantNavId(id: string): id is AssistantNavId {
  return VALID_NAV_IDS.has(id);
}

export function detectAppNavigation(message: string): AssistantNavId | null {
  const q = message.trim().toLowerCase();

  if (
    /correct.*book|grade.*book|check.*book|mark.*book|notebook|exam.*paper|scan|grading|analyzer|ocr|answer.?sheet/.test(
      q,
    )
  ) {
    return "scan";
  }
  if (/student.?list|roster|roll.?number|school.?id|add.?student|edit.?student/.test(q)) {
    return "students";
  }
  if (/class.?dojo|point|token|reward|leaderboard|give.?point/.test(q)) {
    return "classdojo";
  }
  if (/professional.?email|draft.?email|parent.?email|send.?mail/.test(q)) {
    return "mailer";
  }
  if (/report.?card|report.?comment|eoy|end.?of.?year.?comment|strength.*growth/.test(q)) {
    return "reportcomments";
  }
  if (/ppt|powerpoint|slide|presentation/.test(q)) {
    return "ppt";
  }
  if (/3d.?lab|phet|simulation|virtual.?lab/.test(q)) {
    return "3dlab";
  }
  if (/book.?lab|lab.?book|reserve.?lab|lab.?slot/.test(q)) {
    return "labs";
  }
  if (/assessment|assign.?test|quiz|question.?paper/.test(q)) {
    return "assessment";
  }
  if (/performance|term.?mark|pt1|line.?graph|track.?mark/.test(q)) {
    return "performance";
  }
  if (/lecture.?record|record.?class|transcri/.test(q)) {
    return "lecture";
  }
  if (/text.?level|level.?text|reading.?level|differentiat|dyslexia|adhd|adapt.?content|iep/.test(q)) {
    return "content";
  }
  if (/substitut|cover.?class|free.?teacher/.test(q)) {
    return "substitution";
  }
  if (/blueprint|exam.?pattern|marks.?distribution|syllabus.?map/.test(q)) {
    return "blueprint";
  }
  if (/teacher.?chat|staff.?chat|message.?teacher/.test(q)) {
    return "chat";
  }
  if (/dashboard|home|all.?tool|where.?start/.test(q)) {
    return "dashboard";
  }

  return null;
}

export interface AssistantAnswer {
  reply: string;
  navigateTo?: AssistantNavId;
}

export function localAssistantAnswer(
  message: string,
  context?: { teacherName?: string; classManaged?: string },
): AssistantAnswer {
  const q = message.trim().toLowerCase();
  const name = context?.teacherName?.trim() || "there";
  const cls = context?.classManaged?.trim();
  const nav = detectAppNavigation(message);

  if (nav) {
    const label = ASSISTANT_NAV_LABELS[nav];
    const tips: Partial<Record<AssistantNavId, string>> = {
      scan: "Upload notebook or exam photos, pick a student, then run Analyze to grade and save feedback.",
      students: "Add or edit names, roll numbers, school IDs, and parent emails.",
      classdojo: "Award points for participation, peer support, or kindness and view the leaderboard.",
      mailer: "Paste bullet points and Generate to get a polished professional email.",
      reportcomments: "Enter strengths and growth areas to generate report-card comments.",
    };
    const tip = tips[nav] ?? `Use ${label} from the sidebar.`;
    return {
      reply: `${tip} Opening ${label} for you now.`,
      navigateTo: nav,
    };
  }

  if (/^(hi|hello|hey|good morning|good afternoon)/.test(q)) {
    return {
      reply: `Hello ${name}! Ask me anything — general questions or how to use Gems Assist (e.g. "How do I correct notebooks?").`,
    };
  }

  if (/help|how do i|where is|where do i|how to use gems|what can you/.test(q)) {
    const classLine = cls ? ` You're on class ${cls}.` : "";
    return {
      reply: `I answer general questions and guide you to the right Gems Assist tool.${classLine} Try "How do I grade exam papers?" or any subject doubt.`,
    };
  }

  return {
    reply: `I'm here for general questions and Gems Assist help, ${name}. If your question is about the app, I'll take you to the right page automatically.`,
  };
}
