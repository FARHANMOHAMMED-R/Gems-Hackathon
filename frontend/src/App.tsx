import { useEffect, useState } from "react";
import { api } from "./api/client";
import { Dashboard } from "./pages/Dashboard";
import { ScanAnalyzer } from "./pages/ScanAnalyzer";
import { ContentDifferentiator } from "./pages/ContentDifferentiator";
import { SubstitutionFinder } from "./pages/SubstitutionFinder";
import { LabBooking } from "./pages/LabBooking";
import { ParentMailer } from "./pages/ParentMailer";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  render: (onNavigate: (id: string) => void) => JSX.Element;
}

const NAV: NavItem[] = [
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

type BackendStatus = "checking" | "online" | "offline";

export function App() {
  const [active, setActive] = useState<string>(NAV[0].id);
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [navOpen, setNavOpen] = useState(false);

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

  const current = NAV.find((n) => n.id === active) ?? NAV[0];

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

        <nav className="nav">
          {NAV.map((item) => (
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
