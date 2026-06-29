import { useEffect, useState } from "react";
import { awardClassPoints, fetchClassLeaderboard } from "../api/classData";
import type { AwardReason, LeaderboardEntry } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const FEATURES = [
  { id: "students", icon: "👥", label: "Class Roster", blurb: "Edit students & roll numbers" },
  { id: "scan", icon: "📝", label: "Scan Analyzer", blurb: "AI grading for exams & notebooks" },
  { id: "blueprint", icon: "📋", label: "Blueprint Generator", blurb: "Exam paper topic & marks map" },
  { id: "content", icon: "🎯", label: "Content Differentiator", blurb: "Adapt lessons to every learner" },
  { id: "substitution", icon: "🔁", label: "Substitution Finder", blurb: "Find free teachers by period" },
  { id: "labs", icon: "🔬", label: "Lab Booking", blurb: "Reserve labs, avoid clashes" },
  { id: "3dlab", icon: "🧪", label: "3D Lab", blurb: "PhET physics simulations" },
  { id: "chat", icon: "💬", label: "Teacher Chat", blurb: "Message other teachers" },
  { id: "assessment", icon: "📑", label: "Assessment Assigner", blurb: "AI assessments by topic" },
  { id: "ppt", icon: "📊", label: "PPT Generator", blurb: "AI PowerPoint slides" },
  { id: "mailer", icon: "✉️", label: "Parent Mailer", blurb: "Draft parent update emails" },
] as const;

const REASONS: { value: AwardReason; label: string; points: number; icon: string }[] = [
  { value: "answering", label: "Answering", points: 1, icon: "🙋" },
  { value: "peer_support", label: "Peer support", points: 3, icon: "🤝" },
  { value: "kindness", label: "Kindness", points: 5, icon: "💛" },
];

export function Dashboard({
  classManaged,
  onNavigate,
}: {
  classManaged: string;
  onNavigate?: (id: string) => void;
}) {
  const toast = useToast();
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [reason, setReason] = useState<AwardReason>("answering");
  const [customPoints, setCustomPoints] = useState(1);
  const [awarding, setAwarding] = useState(false);

  async function loadBoard() {
    setLoading(true);
    setError(null);
    try {
      const board = await fetchClassLeaderboard(classManaged);
      setBoard(board);
      setSelectedId((prev) => prev || board[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classManaged]);

  async function awardWithReason() {
    if (!selectedId) {
      toast.error("Pick a student first.");
      return;
    }
    setAwarding(true);
    try {
      const pts = REASONS.find((r) => r.value === reason)?.points ?? 1;
      const res = await awardClassPoints(classManaged, selectedId, pts, reason);
      setBoard(res.leaderboard);
      toast.success(`+${res.awarded.amount} to ${res.student.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not award tokens.");
    } finally {
      setAwarding(false);
    }
  }

  async function awardCustom() {
    if (!selectedId) {
      toast.error("Pick a student first.");
      return;
    }
    const pts = Math.min(100, Math.max(1, customPoints));
    setAwarding(true);
    try {
      const res = await awardClassPoints(classManaged, selectedId, pts);
      setBoard(res.leaderboard);
      toast.success(`+${pts} points to ${res.student.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add points.");
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
          <h2 className="welcome-title">Class {classManaged}</h2>
          <p className="welcome-tagline">
            Token leaderboard for your class — everyone starts at <strong>0</strong>. Use the
            buttons below to reward students in real time.
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
            board
              ? `${board.length} students · ${totalTokens} total points`
              : "Your class ranking"
          }
          actions={
            <>
              {onNavigate && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onNavigate("students")}
                >
                  Edit roster
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={loadBoard} disabled={loading}>
                ↻ Refresh
              </button>
            </>
          }
        >
          {loading && <Spinner label="Loading leaderboard…" />}
          {error && !loading && <ErrorNote>{error}</ErrorNote>}
          {!loading && !error && board && board.length === 0 && (
            <EmptyState
              icon="🏅"
              title="No students yet"
              hint="Complete class setup to add students."
            />
          )}
          {!loading && !error && board && board.length > 0 && (
            <div className="lb-list">
              {board.map((e) => (
                <button
                  key={e.id}
                  className={`lb-row${e.id === selectedId ? " selected" : ""}`}
                  onClick={() => setSelectedId(e.id)}
                  title="Select for points"
                  style={{ cursor: "pointer", textAlign: "left", font: "inherit" }}
                >
                  <span className={`lb-rank${e.rank <= 3 ? ` top${e.rank}` : ""}`}>
                    {e.rank}
                  </span>
                  <span>
                    <div className="lb-name">{e.name}</div>
                    <div className="lb-meta">
                      Roll {e.rollNumber ?? "—"} · ID {e.schoolId ?? "—"}
                    </div>
                  </span>
                  <span className="lb-tokens">
                    {e.totalTokens}
                    <span>pts</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Give Points" subtitle="Quick rewards or custom amount">
          <Field label="Student">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={!board || board.length === 0}
            >
              {(!board || board.length === 0) && <option value="">No students</option>}
              {board?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · Roll {e.rollNumber} ({e.totalTokens} pts)
                </option>
              ))}
            </select>
          </Field>

          <div className="field">
            <span className="field-label">Quick reward</span>
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
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 8 }}
              onClick={awardWithReason}
              disabled={awarding || !selectedId}
            >
              {awarding ? "Adding…" : `Add +${REASONS.find((r) => r.value === reason)?.points} points`}
            </button>
          </div>

          <Field label="Custom points" hint="1–100">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min={1}
                max={100}
                value={customPoints}
                onChange={(e) => setCustomPoints(Number(e.target.value) || 1)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={awardCustom}
                disabled={awarding || !selectedId}
              >
                Add points
              </button>
            </div>
          </Field>
        </Card>
      </div>
    </div>
  );
}
