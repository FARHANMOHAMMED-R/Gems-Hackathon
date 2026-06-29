import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { fetchClassStudents } from "../api/classData";
import type { StudentRosterEntry } from "../api/types";
import { draftBatchMailsLocally } from "../lib/localParentMailer";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

export function ParentMailer({ classManaged }: { classManaged: string }) {
  const toast = useToast();
  const [students, setStudents] = useState<StudentRosterEntry[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  const [teacherSummary, setTeacherSummary] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recentLimit, setRecentLimit] = useState(5);

  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<
    { studentId: string; name: string; rollNumber: string; email: string }[] | null
  >(null);
  const [localMode, setLocalMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchClassStudents(classManaged)
      .then((list) => {
        setStudents(list);
        setSelectedIds(new Set(list.map((s) => s.id)));
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [classManaged]);

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generate() {
    if (!teacherSummary.trim()) {
      toast.error("Write a short summary or prompt for the parent emails first.");
      return;
    }
    if (scope === "selected" && selectedIds.size === 0) {
      toast.error("Select at least one student.");
      return;
    }

    setLoading(true);
    setEmails(null);
    setLocalMode(false);
    setError(null);

    try {
      const res = await api.generateMailBatch({
        classManaged,
        teacherSummary: teacherSummary.trim(),
        scope,
        studentIds: scope === "selected" ? Array.from(selectedIds) : undefined,
        recentLimit,
      });
      setEmails(res.emails);
      setLocalMode(res.analysisMode === "local");
      toast.success(`Drafted ${res.count} email(s).`);
    } catch (err) {
      if (err instanceof ApiError && err.isLlmNotConfigured) {
        const drafted = draftBatchMailsLocally(
          students,
          teacherSummary.trim(),
          scope,
          selectedIds,
        );
        if (drafted.length === 0) {
          setError("No students selected.");
          return;
        }
        setEmails(drafted);
        setLocalMode(true);
        toast.success(`Drafted ${drafted.length} email(s) locally.`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate emails.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied.");
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <div className="grid grid-2">
      <Card title="Parent Mailer" subtitle="Step 1 — your summary, then who receives it">
        {loadingStudents ? (
          <Spinner label="Loading class…" />
        ) : students.length === 0 ? (
          <EmptyState icon="✉️" title="No students" hint="Set up your class roster first." />
        ) : (
          <>
            <Field
              label="Your summary / prompt"
              hint="What should parents know? Focus areas, positives, next steps…"
            >
              <textarea
                value={teacherSummary}
                onChange={(e) => setTeacherSummary(e.target.value)}
                placeholder="This week we focused on kinematics. Several students improved in problem-solving. Please encourage practice on graph interpretation…"
                rows={5}
              />
            </Field>

            <div className="field">
              <span className="field-label">Send to</span>
              <div className="chip-group">
                <button
                  type="button"
                  className={`chip${scope === "all" ? " active" : ""}`}
                  onClick={() => setScope("all")}
                >
                  📬 Entire class ({students.length})
                </button>
                <button
                  type="button"
                  className={`chip${scope === "selected" ? " active" : ""}`}
                  onClick={() => setScope("selected")}
                >
                  👤 Specific students
                </button>
              </div>
            </div>

            {scope === "selected" && (
              <div className="field">
                <span className="field-label">Select students</span>
                <div className="student-pick-list">
                  {students.map((s) => (
                    <label key={s.id} className="student-pick-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                      />
                      <span>
                        {s.name} · Roll {s.rollNumber}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Field label="Recent records per student" hint="1–20">
              <input
                type="number"
                min={1}
                max={20}
                value={recentLimit}
                onChange={(e) =>
                  setRecentLimit(Math.min(20, Math.max(1, Number(e.target.value) || 1)))
                }
              />
            </Field>

            <button className="btn btn-primary btn-block" onClick={generate} disabled={loading}>
              {loading ? "Drafting emails…" : "Generate parent emails"}
            </button>
          </>
        )}
      </Card>

      <Card title="Drafted emails" subtitle="One per student — copy and send">
        {loading && <Spinner label="Composing emails…" />}

        {localMode && emails && !loading && (
          <div className="info-note">
            📧 Local draft — add <code>OPENAI_API_KEY</code> to the backend for fully
            AI-personalized emails.
          </div>
        )}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && !emails && (
          <EmptyState
            icon="✉️"
            title="No emails yet"
            hint="Add your summary, choose recipients, and generate."
          />
        )}

        {emails && !loading && (
          <div className="stack" style={{ gap: 16 }}>
            {emails.map((item) => (
              <div key={item.studentId} className="mail-draft-card">
                <div className="mail-draft-head">
                  <strong>
                    {item.name} (Roll {item.rollNumber})
                  </strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => copy(item.email, item.studentId)}
                  >
                    {copiedId === item.studentId ? "✓ Copied" : "⧉ Copy"}
                  </button>
                </div>
                <div className="text-block">{item.email}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
