import { useEffect, useState } from "react";
import { api } from "./api/client";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Dashboard } from "./pages/Dashboard";
import { ScanAnalyzer } from "./pages/ScanAnalyzer";
import { ContentDifferentiator } from "./pages/ContentDifferentiator";
import { SubstitutionFinder } from "./pages/SubstitutionFinder";
import { LabBooking } from "./pages/LabBooking";
import { ParentMailer } from "./pages/ParentMailer";
import { SignIn } from "./pages/SignIn";
import {
  clearAuthSession,
  getAuthSession,
  isAdminSession,
  isTeacherSession,
  setAuthSession,
  type AuthSession,
  type TeacherSession,
} from "./lib/authSession";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  render: (onNavigate: (id: string) => void) => JSX.Element;
}

const TEACHER_NAV: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "🏆",
    blurb: "Token leaderboard & rewards",
    render: (onNavigate) => <Dashboard onNavigate={onNavigate} />,
  },
  {
    id: "scan",
    label: "Scan Analyzer",
    icon: "📝",
    blurb: "AI grading for exams & notebooks",
    render: () => <ScanAnalyzer />,
  },
  {
    id: "content",
    label: "Content Differentiator",
    icon: "🎯",
    blurb: "Adapt lessons to every learner",
    render: () => <ContentDifferentiator />,
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
    id: "mailer",
    label: "Parent Mailer",
    icon: "✉️",
    blurb: "Draft parent update emails",
    render: () => <ParentMailer />,
  },
];

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

  const isAdmin = session && isAdminSession(session);
  const teacher = session && isTeacherSession(session) ? session : null;
  const nav = isAdmin ? [ADMIN_NAV_ITEM, ...TEACHER_NAV] : TEACHER_NAV;

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
        clearAuthSession();
        setSession(null);
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
            <div className="brand-tag">Education platform</div>
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
            Can't reach the backend on <code>http://localhost:4000</code>. Start
            it with <code>npm run dev</code> in the project root, then this
            banner will clear automatically.
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
    </div>
  );
}
