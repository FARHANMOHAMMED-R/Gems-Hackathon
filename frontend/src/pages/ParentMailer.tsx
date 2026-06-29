import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { fetchClassStudents } from "../api/classData";
import type { MailDraftItem, StudentRosterEntry } from "../api/types";
import { draftBatchMailsLocally } from "../lib/localParentMailer";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

type SendStatus = "idle" | "sending" | "sent" | "failed";

interface DraftRow extends MailDraftItem {
  sendStatus: SendStatus;
  sendError?: string;
}

interface ParentMailerProps {
  classManaged: string;
  teacherEmail: string;
  teacherName: string;
}

function toDraftRows(items: MailDraftItem[]): DraftRow[] {
  return items.map((item) => ({
    ...item,
    body: item.body ?? item.email,
    email: item.email ?? item.body,
    sendStatus: "idle" as const,
  }));
}

export function ParentMailer({ classManaged, teacherEmail, teacherName }: ParentMailerProps) {
  const toast = useToast();
  const [students, setStudents] = useState<StudentRosterEntry[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);

  const [teacherSummary, setTeacherSummary] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recentLimit, setRecentLimit] = useState(5);

  const [loading, setLoading] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
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

  useEffect(() => {
    api.getMailStatus().then((s) => setMailConfigured(s.configured)).catch(() => setMailConfigured(false));
  }, []);

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateDraft(studentId: string, patch: Partial<DraftRow>) {
    setDrafts((prev) =>
      prev?.map((d) => (d.studentId === studentId ? { ...d, ...patch } : d)) ?? null,
    );
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
    setDrafts(null);
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
      setDrafts(toDraftRows(res.emails));
      setLocalMode(res.analysisMode === "local");
      toast.success(`Drafted ${res.count} email(s).`);
    } catch (err) {
      if (err instanceof ApiError && err.isLlmNotConfigured) {
        const drafted = draftBatchMailsLocally(
          students,
          teacherSummary.trim(),
          scope,
          selectedIds,
          classManaged,
        );
        if (drafted.length === 0) {
          setError("No students selected.");
          return;
        }
        setDrafts(toDraftRows(drafted));
        setLocalMode(true);
        toast.success(`Drafted ${drafted.length} email(s) locally.`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate emails.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendOne(draft: DraftRow) {
    if (!draft.parentEmail.trim()) {
      toast.error(`Add a parent email for ${draft.name}.`);
      return;
    }
    updateDraft(draft.studentId, { sendStatus: "sending", sendError: undefined });
    try {
      await api.sendMail({
        studentId: draft.studentId,
        to: draft.parentEmail.trim(),
        subject: draft.subject.trim(),
        body: draft.body,
        replyTo: teacherEmail,
      });
      updateDraft(draft.studentId, { sendStatus: "sent" });
      toast.success(`Sent to ${draft.parentEmail}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.isMailNotConfigured
          ? "Add RESEND_API_KEY or SMTP settings to the backend .env to send emails."
          : err instanceof Error
            ? err.message
            : "Send failed.";
      updateDraft(draft.studentId, { sendStatus: "failed", sendError: msg });
      toast.error(msg);
    }
  }

  async function sendAll() {
    if (!drafts?.length) return;
    const ready = drafts.filter((d) => d.parentEmail.trim() && d.sendStatus !== "sent");
    if (ready.length === 0) {
      toast.error("Add parent emails for at least one student.");
      return;
    }

    setSendingAll(true);
    setDrafts((prev) =>
      prev?.map((d) =>
        d.parentEmail.trim() && d.sendStatus !== "sent"
          ? { ...d, sendStatus: "sending", sendError: undefined }
          : d,
      ) ?? null,
    );

    try {
      const res = await api.sendMailBatch({
        classManaged,
        replyTo: teacherEmail,
        messages: ready.map((d) => ({
          studentId: d.studentId,
          to: d.parentEmail.trim(),
          subject: d.subject.trim(),
          body: d.body,
        })),
      });

      setDrafts((prev) =>
        prev?.map((d) => {
          const result = res.results.find((r) => r.studentId === d.studentId);
          if (!result) return d;
          return {
            ...d,
            sendStatus: result.ok ? "sent" : "failed",
            sendError: result.error,
          };
        }) ?? null,
      );

      if (res.sent > 0) {
        toast.success(`Sent ${res.sent} email(s) via ${res.provider}.`);
      }
      if (res.failed > 0) {
        toast.error(`${res.failed} email(s) failed to send.`);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError && err.isMailNotConfigured
          ? "Add RESEND_API_KEY or SMTP settings to the backend .env to send emails."
          : err instanceof Error
            ? err.message
            : "Batch send failed.";
      setDrafts((prev) =>
        prev?.map((d) =>
          d.sendStatus === "sending" ? { ...d, sendStatus: "failed", sendError: msg } : d,
        ) ?? null,
      );
      toast.error(msg);
    } finally {
      setSendingAll(false);
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

  const pendingCount =
    drafts?.filter((d) => d.sendStatus !== "sent" && d.parentEmail.trim()).length ?? 0;

  return (
    <div className="grid grid-2">
      <Card title="Parent Mailer" subtitle="Draft with AI, then send to parent inboxes">
        {loadingStudents ? (
          <Spinner label="Loading class…" />
        ) : students.length === 0 ? (
          <EmptyState icon="✉️" title="No students" hint="Set up your class roster first." />
        ) : (
          <>
            {mailConfigured === false && (
              <div className="info-note">
                Sending is off until you add <code>RESEND_API_KEY</code> (or SMTP) to the backend{" "}
                <code>.env</code>. You can still draft and copy emails.
              </div>
            )}
            {mailConfigured && (
              <div className="info-note">
                ✉️ Email API connected — replies go to <strong>{teacherEmail}</strong> (
                {teacherName}).
              </div>
            )}

            <Field
              label="Your summary / prompt"
              hint="What should parents know? Focus areas, positives, next steps…"
            >
              <textarea
                value={teacherSummary}
                onChange={(e) => setTeacherSummary(e.target.value)}
                placeholder="This week we focused on kinematics. Several students improved in problem-solving…"
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
                        {s.parentEmail ? ` · ${s.parentEmail}` : ""}
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

      <Card title="Draft & send" subtitle="Review, edit parent addresses, then send">
        {loading && <Spinner label="Composing emails…" />}

        {localMode && drafts && !loading && (
          <div className="info-note">
            📧 Local draft — add <code>OPENAI_API_KEY</code> for fully AI-personalized content.
          </div>
        )}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && !drafts && (
          <EmptyState
            icon="✉️"
            title="No emails yet"
            hint="Add your summary, choose recipients, and generate."
          />
        )}

        {drafts && !loading && (
          <div className="stack" style={{ gap: 16 }}>
            {mailConfigured && pendingCount > 0 && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={sendAll}
                disabled={sendingAll}
              >
                {sendingAll ? "Sending…" : `Send ${pendingCount} email(s) now`}
              </button>
            )}

            {drafts.map((item) => (
              <div key={item.studentId} className="mail-draft-card">
                <div className="mail-draft-head">
                  <strong>
                    {item.name} (Roll {item.rollNumber})
                  </strong>
                  <div className="mail-draft-actions">
                    {item.sendStatus === "sent" && (
                      <span className="pill pill-success">✓ Sent</span>
                    )}
                    {item.sendStatus === "failed" && (
                      <span className="pill pill-warn" title={item.sendError}>
                        Failed
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => copy(item.body, item.studentId)}
                    >
                      {copiedId === item.studentId ? "✓ Copied" : "⧉ Copy"}
                    </button>
                    {mailConfigured && item.sendStatus !== "sent" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => sendOne(item)}
                        disabled={item.sendStatus === "sending" || sendingAll}
                      >
                        {item.sendStatus === "sending" ? "…" : "Send"}
                      </button>
                    )}
                  </div>
                </div>

                <Field label="Parent email">
                  <input
                    type="email"
                    value={item.parentEmail}
                    placeholder="parent@example.com"
                    onChange={(e) =>
                      updateDraft(item.studentId, { parentEmail: e.target.value })
                    }
                  />
                </Field>

                <Field label="Subject">
                  <input
                    type="text"
                    value={item.subject}
                    onChange={(e) => updateDraft(item.studentId, { subject: e.target.value })}
                  />
                </Field>

                <div className="text-block">{item.body}</div>
                {item.sendError && (
                  <p className="field-error" role="alert">
                    {item.sendError}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
