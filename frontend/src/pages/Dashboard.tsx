import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AwardReason, LeaderboardEntry } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const FEATURES = [
  { id: "scan", icon: "📝", label: "Scan Analyzer", blurb: "AI grading for exams & notebooks" },
  { id: "content", icon: "🎯", label: "Content Differentiator", blurb: "Adapt lessons to every learner" },
  { id: "substitution", icon: "🔁", label: "Substitution Finder", blurb: "Find free teachers by period" },
  { id: "labs", icon: "🔬", label: "Lab Booking", blurb: "Reserve labs, avoid clashes" },
  { id: "mailer", icon: "✉️", label: "Parent Mailer", blurb: "Draft parent update emails" },
] as const;

const REASONS: { value: AwardReason; label: string; points: number; icon: string }[] =
  [
    { value: "answering", label: "Answering", points: 1, icon: "🙋" },
    { value: "peer_support", label: "Peer support", points: 3, icon: "🤝" },
    { value: "kindness", label: "Kindness", points: 5, icon: "💛" },
  ];

export function Dashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const toast = useToast();
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [reason, setReason] = useState<AwardReason>("answering");
  const [awarding, setAwarding] = useState(false);

  async function loadBoard() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeaderboard();
      setBoard(res.leaderboard);
      // Default the award target to the first student if none chosen yet.
      setSelectedId((prev) => prev || res.leaderboard[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function award() {
    if (!selectedId) {
      toast.error("Pick a student to award tokens to.");
      return;
    }
    setAwarding(true);
    try {
      const res = await api.awardToken(selectedId, reason);
      setBoard(res.leaderboard);
      const pts = res.awarded.amount;
      toast.success(`+${pts} to ${res.student.name} for ${reason.replace("_", " ")}.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.error("That student no longer exists. Refreshing the board.");
        loadBoard();
      } else {
        toast.error(err instanceof Error ? err.message : "Could not award tokens.");
      }
    } finally {
      setAwarding(false);
    }
  }

  const totalTokens = board?.reduce((s, e) => s + e.totalTokens, 0) ?? 0;

  return (
    <div className="stack">
      <section className="welcome-hero">
        <div className="welcome-mark" aria-hidden>
          ✦
        </div>
        <div className="welcome-body">
          <h2 className="welcome-title">Welcome to Gems Assist</h2>
          <p className="welcome-tagline">
            AI-powered tools for grading, differentiated content, teacher substitution,
            lab booking, and parent communication — plus a student token economy.
          </p>
        </div>
        {onNavigate && (
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
        )}
      </section>

      <div className="grid grid-2">
      <Card
        title="Token Leaderboard"
        subtitle={
          board ? `${board.length} students · ${totalTokens} tokens awarded` : "Live class ranking"
        }
        actions={
          <button className="btn btn-ghost btn-sm" onClick={loadBoard} disabled={loading}>
            ↻ Refresh
          </button>
        }
      >
        {loading && <Spinner label="Loading leaderboard…" />}
        {error && !loading && <ErrorNote>{error}</ErrorNote>}
        {!loading && !error && board && board.length === 0 && (
          <EmptyState
            icon="🏅"
            title="No students yet"
            hint="Seed the backend database to populate the leaderboard."
          />
        )}
        {!loading && !error && board && board.length > 0 && (
          <div className="lb-list">
            {board.map((e) => (
              <button
                key={e.id}
                className={`lb-row${e.id === selectedId ? " selected" : ""}`}
                onClick={() => setSelectedId(e.id)}
                title="Select as award target"
                style={{ cursor: "pointer", textAlign: "left", font: "inherit" }}
              >
                <span className={`lb-rank${e.rank <= 3 ? ` top${e.rank}` : ""}`}>
                  {e.rank}
                </span>
                <span>
                  <div className="lb-name">{e.name}</div>
                  <div className="lb-meta">
                    Grade {e.grade}-{e.section}
                  </div>
                </span>
                <span className="lb-tokens">
                  {e.totalTokens}
                  <span>tokens</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title="Award Tokens" subtitle="Reinforce great behaviour in real time">
        <Field label="Student" hint="Tap a student on the leaderboard or pick here.">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={!board || board.length === 0}
          >
            {(!board || board.length === 0) && <option value="">No students</option>}
            {board?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · Grade {e.grade}-{e.section} ({e.totalTokens})
              </option>
            ))}
          </select>
        </Field>

        <div className="field">
          <span className="field-label">Reason</span>
          <div className="chip-group">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`chip${reason === r.value ? " active" : ""}`}
                onClick={() => setReason(r.value)}
              >
                {r.icon} {r.label} +{r.points}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={award}
          disabled={awarding || !selectedId}
        >
          {awarding ? "Awarding…" : "Award tokens"}
        </button>
      </Card>
      </div>
    </div>
  );
}
