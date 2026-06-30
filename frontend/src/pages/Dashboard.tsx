const FEATURES = [
  { id: "classdojo", icon: "⭐", label: "Class Dojo", blurb: "Points, rewards & leaderboard" },
  { id: "students", icon: "👥", label: "Student list", blurb: "Change names, rolls & school IDs" },
  { id: "scan", icon: "📝", label: "Scan Analyzer", blurb: "AI grading for exams & notebooks" },
  { id: "blueprint", icon: "📋", label: "Blueprint Generator", blurb: "Exam paper topic & marks map" },
  { id: "content", icon: "🎯", label: "Content Differentiator", blurb: "Adapt lessons to every learner" },
  { id: "substitution", icon: "🔁", label: "Substitution Finder", blurb: "Find free teachers by period" },
  { id: "labs", icon: "🔬", label: "Lab Booking", blurb: "Reserve labs, avoid clashes" },
  { id: "3dlab", icon: "🧪", label: "3D Lab", blurb: "PhET physics, chemistry & math sims" },
  { id: "chat", icon: "💬", label: "Teacher Chat", blurb: "Message other teachers" },
  { id: "lecture", icon: "🎙", label: "Lecture Recorder", blurb: "Record, note & AI timeline" },
  { id: "performance", icon: "📈", label: "Performance Tracker", blurb: "PT1 → Final marks & line graphs" },
  { id: "ppt", icon: "📊", label: "PPT Generator", blurb: "AI lesson slides" },
  { id: "assessment", icon: "📑", label: "Assessment Assigner", blurb: "AI assessments by topic" },
  { id: "mailer", icon: "✉️", label: "Professional Email", blurb: "AI professional email communication" },
  { id: "reportcomments", icon: "📋", label: "Report Comments", blurb: "AI report card & EOY student comments" },
] as const;

export function Dashboard({
  classManaged,
  teacherName,
  onNavigate,
}: {
  classManaged: string;
  teacherName: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="stack">
      <section className="welcome-hero">
        <div className="welcome-mark" aria-hidden>
          ✦
        </div>
        <div className="welcome-body">
          <h2 className="welcome-title">Dashboard</h2>
          <p className="welcome-tagline">
            Welcome back, <strong>{teacherName}</strong>. Class{" "}
            <strong>{classManaged}</strong> — pick a tool below or use the sidebar anytime.
          </p>
        </div>
        <div className="welcome-features">
          {FEATURES.map((f) => (
            <button
              key={f.id}
              type="button"
              className="welcome-feature"
              onClick={() => onNavigate(f.id)}
            >
              <span className="welcome-feature-icon" aria-hidden>
                {f.icon}
              </span>
              <span className="welcome-feature-label">{f.label}</span>
              <span className="welcome-feature-blurb">{f.blurb}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
