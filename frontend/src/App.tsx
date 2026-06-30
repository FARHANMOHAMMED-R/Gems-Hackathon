import { useEffect, useState } from "react";
import { api } from "./api/client";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Dashboard } from "./pages/Dashboard";
import { ClassDojo } from "./pages/ClassDojo";
import { ScanAnalyzer } from "./pages/ScanAnalyzer";
import { BlueprintGenerator } from "./pages/BlueprintGenerator";
import { ContentDifferentiator } from "./pages/ContentDifferentiator";
import { SubstitutionFinder } from "./pages/SubstitutionFinder";
import { LabBooking } from "./pages/LabBooking";
import { ThreeDLab } from "./pages/ThreeDLab";
import { ProfessionalEmail } from "./pages/ProfessionalEmail";
import { ReportCardComments } from "./pages/ReportCardComments";
import { AssessmentAssigner } from "./pages/AssessmentAssigner";
import { PptGenerator } from "./pages/PptGenerator";
import { PerformanceTracker } from "./pages/PerformanceTracker";
import { LectureRecorder } from "./pages/LectureRecorder";
import { SignIn } from "./pages/SignIn";
import { ClassRosterSetup } from "./pages/ClassRosterSetup";
import { ClassStudents } from "./pages/ClassStudents";
import { TeacherChat } from "./pages/TeacherChat";
import {
  clearAuthSession,
  getAuthSession,
  isAdminSession,
  isTeacherSession,
  setAuthSession,
  type AuthSession,
  type TeacherSession,
} from "./lib/authSession";
import { hasLocalRoster } from "./lib/classRoster";
import { TeacherNotificationBox } from "./components/TeacherNotificationBox";
import { AiAssistant } from "./components/AiAssistant";
import { bootstrapAiFromEnv } from "./lib/bootstrapAiKeys";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  render: (onNavigate: (id: string) => void) => JSX.Element;
}

function buildTeacherNav(teacher: TeacherSession): NavItem[] {
  const { classManaged } = teacher;
  return [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "🏠",
      blurb: "Home — all your tools",
      render: (onNavigate) => (
        <Dashboard
          classManaged={classManaged}
          teacherName={teacher.name}
          onNavigate={onNavigate}
        />
      ),
    },
    {
      id: "classdojo",
      label: "Class Dojo",
      icon: "⭐",
      blurb: "Points, rewards & leaderboard",
      render: (onNavigate) => (
        <ClassDojo classManaged={classManaged} onNavigate={onNavigate} />
      ),
    },
    {
      id: "students",
      label: "Student list",
      icon: "👥",
      blurb: "Change names, rolls & school IDs",
      render: () => <ClassStudents classManaged={classManaged} />,
    },
    {
      id: "scan",
      label: "Scan Analyzer",
      icon: "📝",
      blurb: "AI grading for exams & notebooks",
      render: () => <ScanAnalyzer classManaged={classManaged} />,
    },
    {
      id: "blueprint",
      label: "Blueprint Generator",
      icon: "📋",
      blurb: "Exam paper topic & marks map",
      render: () => <BlueprintGenerator classManaged={classManaged} />,
    },
    {
      id: "content",
      label: "Text Leveler",
      icon: "📖",
      blurb: "Adapt text to any grade reading level",
      render: () => <ContentDifferentiator classManaged={classManaged} />,
    },
    {
      id: "substitution",
      label: "Substitution Finder",
      icon: "🔁",
      blurb: "Find free teachers by period",
      render: () => <SubstitutionFinder />,
    },
    {
      id: "labs",
      label: "Lab Booking",
      icon: "🔬",
      blurb: "Reserve labs, avoid clashes",
      render: () => <LabBooking />,
    },
    {
      id: "3dlab",
      label: "3D Lab",
      icon: "🧪",
      blurb: "PhET physics, chemistry & math sims",
      render: () => <ThreeDLab />,
    },
    {
      id: "chat",
      label: "Teacher Chat",
      icon: "💬",
      blurb: "Message other teachers",
      render: () => <TeacherChat teacher={teacher} />,
    },
    {
      id: "lecture",
      label: "Lecture Recorder",
      icon: "🎙",
      blurb: "Record, note & AI timeline",
      render: () => (
        <LectureRecorder
          classManaged={classManaged}
          teacherEmail={teacher.email}
          teacherName={teacher.name}
        />
      ),
    },
    {
      id: "performance",
      label: "Performance Tracker",
      icon: "📈",
      blurb: "PT1 → Final marks & line graphs",
      render: () => <PerformanceTracker classManaged={classManaged} />,
    },
    {
      id: "ppt",
      label: "PPT Generator",
      icon: "📊",
      blurb: "AI lesson slides — ChatGPT, Gemini, Claude",
      render: () => <PptGenerator classManaged={classManaged} />,
    },
    {
      id: "assessment",
      label: "Assessment Assigner",
      icon: "📑",
      blurb: "AI assessments by topic & chapter",
      render: () => (
        <AssessmentAssigner
          classManaged={classManaged}
          teacherEmail={teacher.email}
          teacherName={teacher.name}
        />
      ),
    },
    {
      id: "mailer",
      label: "Professional Email",
      icon: "✉️",
      blurb: "AI professional email communication",
      render: () => (
        <ProfessionalEmail
          teacherEmail={teacher.email}
          teacherName={teacher.name}
        />
      ),
    },
    {
      id: "reportcomments",
      label: "Report Comments",
      icon: "📋",
      blurb: "AI report card & EOY student comments",
      render: () => <ReportCardComments classManaged={classManaged} />,
    },
  ];
}

const ADMIN_NAV_ITEM: NavItem = {
  id: "admin",
  label: "Admin Dashboard",
  icon: "🛡️",
  blurb: "Manage lab bookings & platform",
  render: () => <AdminDashboard />,
};

type BackendStatus = "checking" | "online" | "offline";

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [sessionReady, setSessionReady] = useState(() => !getAuthSession());
  const [active, setActive] = useState<string>(() => {
    const stored = getAuthSession();
    return stored && isAdminSession(stored) ? "admin" : "dashboard";
  });
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [navOpen, setNavOpen] = useState(false);
  /** null = checking, false = needs roster setup, true = ready */
  const [rosterReady, setRosterReady] = useState<boolean | null>(null);

  const isAdmin = session && isAdminSession(session);
  const teacher = session && isTeacherSession(session) ? session : null;
  const nav = isAdmin
    ? [ADMIN_NAV_ITEM, ...(teacher ? buildTeacherNav(teacher) : [])]
    : teacher
      ? buildTeacherNav(teacher)
      : [];

  useEffect(() => {
    bootstrapAiFromEnv();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = () =>
      api
        .health()
        .then((h) => !cancelled && setStatus(h.ok ? "online" : "offline"))
        .catch(() => !cancelled && setStatus("offline"));
    ping();
    const t = window.setInterval(ping, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const stored = getAuthSession();
    if (!stored) {
      setSessionReady(true);
      return;
    }

    if (isAdminSession(stored)) {
      setSession(stored);
      setSessionReady(true);
      return;
    }

    let cancelled = false;
    api
      .getTeacherMe(stored.email)
      .then((profile) => {
        if (cancelled) return;
        const refreshed: TeacherSession = {
          role: "teacher",
          id: profile.id,
          name: profile.name,
          classManaged: profile.classManaged,
          email: profile.email,
          signedInAt: stored.signedInAt,
        };
        setAuthSession(refreshed);
        setSession(refreshed);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep local session when backend is down or not yet restarted.
        setSession(stored as TeacherSession);
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!teacher) {
      setRosterReady(null);
      return;
    }
    let cancelled = false;
    api
      .getRosterStatus(teacher.classManaged)
      .then((r) =>
        !cancelled &&
        setRosterReady(!r.needsSetup || hasLocalRoster(teacher.classManaged)),
      )
      .catch(() =>
        !cancelled && setRosterReady(hasLocalRoster(teacher.classManaged)),
      );
    return () => {
      cancelled = true;
    };
  }, [teacher?.classManaged, teacher?.email]);

  useEffect(() => {
    if (!teacher?.email) return;
    const ping = () => {
      api.teacherPresence(teacher.email).catch(() => {});
    };
    ping();
    const t = window.setInterval(ping, 60000);
    return () => window.clearInterval(t);
  }, [teacher?.email]);

  function handleSignedIn(next: AuthSession) {
    setSession(next);
    setActive(isAdminSession(next) ? "admin" : "dashboard");
  }

  function handleSignOut() {
    clearAuthSession();
    setSession(null);
    setNavOpen(false);
  }

  if (!sessionReady) {
    return (
      <div className="signin-page">
        <div className="signin-shell">
          <p className="signin-footnote">Loading your session…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <SignIn onSignedIn={handleSignedIn} />;
  }

  if (teacher && rosterReady === null) {
    return (
      <div className="signin-page">
        <div className="signin-shell">
          <p className="signin-footnote">Checking student list…</p>
        </div>
      </div>
    );
  }

  if (teacher && rosterReady === false) {
    return (
      <ClassRosterSetup
        teacher={teacher}
        onComplete={() => setRosterReady(true)}
      />
    );
  }

  const current = nav.find((n) => n.id === active) ?? nav[0];
  const displayName = isAdmin ? session.name ?? "Admin" : teacher!.name;
  const displayMeta = isAdmin ? "Owner" : `Class ${teacher!.classManaged}`;
  const displayEmail = isAdmin ? "Administrator" : teacher!.email;

  return (
    <div className="app">
      <aside className={`sidebar${navOpen ? " open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          <div>
            <div className="brand-name">Gems Assist</div>
            <div className="brand-tag">Group 3 · NEPTUNE</div>
          </div>
        </div>

        <div className="teacher-chip" title={displayEmail}>
          <span className="teacher-chip-avatar" aria-hidden>
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="teacher-chip-text">
            <span className="teacher-chip-name">{displayName}</span>
            <span className="teacher-chip-meta">{displayMeta}</span>
          </div>
        </div>

        {teacher && <TeacherNotificationBox />}

        <nav className="nav">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item${item.id === active ? " active" : ""}`}
              onClick={() => {
                setActive(item.id);
                setNavOpen(false);
              }}
            >
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="nav-text">
                <span className="nav-label">{item.label}</span>
                <span className="nav-blurb">{item.blurb}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button className="btn btn-ghost btn-sm btn-block" onClick={handleSignOut}>
            Sign out
          </button>
          <div className={`backend-status status-${status}`}>
            <span className="status-dot" aria-hidden />
            <span>
              Backend{" "}
              {status === "checking"
                ? "checking…"
                : status === "online"
                  ? "online"
                  : "offline"}
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="hamburger"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div className="topbar-title">
            <span className="topbar-icon" aria-hidden>
              {current.icon}
            </span>
            <div>
              <h1>{current.label}</h1>
              <p>{current.blurb}</p>
            </div>
          </div>
          <div className="topbar-teacher" title={displayEmail}>
            Welcome, <strong>{displayName}</strong>
          </div>
        </header>

        {status === "offline" && (
          <div className="banner banner-warn" role="alert">
            {window.location.hostname.endsWith(".base44.app") ? (
              <>
                API server is starting or offline. Hosted frontend needs{" "}
                <code>gems-assist-api.onrender.com</code> — first visit may take ~1 min
                after deploy. Or run <code>npm run share</code> for the full local stack.
              </>
            ) : (
              <>
                Can't reach the backend. Start it with <code>npm run dev</code> in the
                project root, then this banner will clear automatically.
              </>
            )}
          </div>
        )}

        <main className="content">{current.render(setActive)}</main>
      </div>

      {navOpen && (
        <div
          className="nav-scrim"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <AiAssistant
        teacherName={displayName}
        classManaged={teacher?.classManaged}
        onNavigate={setActive}
      />
    </div>
  );
}
