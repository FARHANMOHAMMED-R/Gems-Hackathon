import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type {
  AiProvider,
  AssessmentDifficulty,
  AssessmentRecipientsResponse,
  GeneratedAssessment,
} from "../api/types";
import {
  defaultAssessmentEmailSubject,
  formatAssessmentForStudents,
} from "../lib/assessmentFormat";
import { clientGenerateAssessment } from "../lib/clientAssessmentGenerator";
import { loadAssistantAiConfig } from "../lib/assistantAiConfig";
import {
  defaultTextLevelerProvider,
  persistTextLevelerCredentials,
  resolveTextLevelerCredentials,
} from "../lib/resolveTextLevelerCredentials";
import {
  loadTextLevelerAiConfig,
  saveTextLevelerAiConfig,
  TEXT_LEVELER_PROVIDER_HINTS,
  TEXT_LEVELER_PROVIDER_LABELS,
  TEXT_LEVELER_PROVIDER_PLACEHOLDERS,
  TEXT_LEVELER_PROVIDERS,
  type TextLevelerProvider,
} from "../lib/textLevelerAiConfig";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const DIFFICULTIES: AssessmentDifficulty[] = ["Easy", "Medium", "Hard", "Mixed"];
const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Computer Science"];

function parseGrade(classManaged: string): string {
  const dash = classManaged.indexOf("-");
  return dash > 0 ? classManaged.slice(0, dash) : classManaged;
}

interface AssessmentAssignerProps {
  classManaged: string;
  teacherEmail: string;
  teacherName: string;
}

export function AssessmentAssigner({
  classManaged,
  teacherEmail,
  teacherName,
}: AssessmentAssignerProps) {
  const toast = useToast();
  const grade = useMemo(() => parseGrade(classManaged), [classManaged]);

  const savedAi = loadTextLevelerAiConfig();
  const [provider, setProvider] = useState<TextLevelerProvider>(
    savedAi?.provider ?? defaultTextLevelerProvider(),
  );
  const [apiKey, setApiKey] = useState(savedAi?.apiKey ?? "");
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [backendProviders, setBackendProviders] = useState<
    { id: AiProvider; configured: boolean }[]
  >([]);

  const [subject, setSubject] = useState("Physics");
  const [chapters, setChapters] = useState("");
  const [topics, setTopics] = useState("");
  const [difficulty, setDifficulty] = useState<AssessmentDifficulty>("Medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [aiProviderUsed, setAiProviderUsed] = useState<TextLevelerProvider | null>(null);
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);

  const [assessment, setAssessment] = useState<GeneratedAssessment | null>(null);
  const [studentBody, setStudentBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [recipients, setRecipients] = useState<AssessmentRecipientsResponse | null>(null);
  const [sendResults, setSendResults] = useState<
    { name: string; ok: boolean; error?: string }[] | null
  >(null);

  useEffect(() => {
    api.getMailStatus().then((s) => setMailConfigured(s.configured)).catch(() => setMailConfigured(false));
    api
      .getAiProviders()
      .then((res) => setBackendProviders(res.providers))
      .catch(() => setBackendProviders([]));
  }, []);

  useEffect(() => {
    const creds = resolveTextLevelerCredentials(provider, apiKey, []);
    if (creds?.apiKey && !apiKey.trim()) {
      setProvider(creds.provider);
      setApiKey(creds.apiKey);
      persistTextLevelerCredentials(creds);
    }
  }, []);

  const creds = resolveTextLevelerCredentials(provider, apiKey, backendProviders);
  const aiReady = Boolean(creds);
  const formReady = chapters.trim().length > 0 && topics.trim().length > 0;

  function saveKey() {
    const trimmed = apiKey.trim();
    if (trimmed.length < 10) {
      toast.error("Paste a valid API key.");
      return;
    }
    saveTextLevelerAiConfig({ provider, apiKey: trimmed });
    setShowApiSettings(false);
    toast.success(`${TEXT_LEVELER_PROVIDER_LABELS[provider]} key saved.`);
  }

  function useAssistantKey() {
    const assistant = loadAssistantAiConfig();
    if (!assistant?.apiKey || assistant.apiKey.length < 10) {
      toast.error("Set a key in the ✦ AI assistant first (bottom-right → ⚙).");
      return;
    }
    if (assistant.provider !== "openai" && assistant.provider !== "gemini") {
      toast.error("Assistant must use OpenAI or Gemini.");
      return;
    }
    setProvider(assistant.provider);
    setApiKey(assistant.apiKey);
    saveTextLevelerAiConfig({ provider: assistant.provider, apiKey: assistant.apiKey });
    setShowApiSettings(false);
    toast.success(`Using ${TEXT_LEVELER_PROVIDER_LABELS[assistant.provider]} from assistant.`);
  }

  async function loadRecipients() {
    try {
      const res = await api.getAssessmentRecipients(classManaged);
      setRecipients(res);
      return res;
    } catch {
      setRecipients(null);
      return null;
    }
  }

  async function generate() {
    if (!formReady) {
      toast.error("Enter chapters and topics for the assessment.");
      return;
    }

    const resolved = resolveTextLevelerCredentials(provider, apiKey, backendProviders);

    setLoading(true);
    setError(null);
    setAssessment(null);
    setStudentBody("");
    setSendResults(null);
    setShowSendConfirm(false);
    setAiProviderUsed(null);

    const input = {
      classManaged,
      grade,
      subject,
      chapters: chapters.trim(),
      topics: topics.trim(),
      difficulty,
      questionCount,
      durationMinutes,
      additionalNotes: additionalNotes.trim() || undefined,
    };

    try {
      if (resolved?.apiKey) {
        persistTextLevelerCredentials(resolved);
        setProvider(resolved.provider);
        setApiKey(resolved.apiKey);
        setShowApiSettings(false);

        const generated = await clientGenerateAssessment(resolved.provider, resolved.apiKey, input);
        setAssessment(generated);
        setStudentBody(formatAssessmentForStudents(generated));
        setEmailSubject(defaultAssessmentEmailSubject(generated, classManaged));
        setLocalMode(false);
        setAiProviderUsed(resolved.provider);
        await loadRecipients();
        toast.success(
          `Created ${generated.questions.length} questions with ${TEXT_LEVELER_PROVIDER_LABELS[resolved.provider]}.`,
        );
        return;
      }

      const res = await api.generateAssessment({
        ...input,
        provider: resolved?.provider,
      });

      setAssessment(res.assessment);
      setStudentBody(res.studentBody);
      setEmailSubject(res.emailSubject);
      setLocalMode(res.analysisMode === "local");
      if (res.analysisMode === "ai") {
        const used =
          res.providerUsed === "openai" || res.providerUsed === "gemini"
            ? res.providerUsed
            : resolved?.provider ?? null;
        setAiProviderUsed(used);
      } else {
        toast.info("Template questions created. Add a free Gemini key for custom AI questions.");
        setShowApiSettings(true);
      }
      await loadRecipients();
      toast.success(
        res.analysisMode === "ai"
          ? `Created ${res.assessment.questions.length} AI questions.`
          : "Assessment created.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not generate assessment.";
      setError(msg);
      setShowApiSettings(true);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function confirmSend() {
    if (!studentBody.trim()) return;

    setSending(true);
    setSendResults(null);
    try {
      const res = await api.sendAssessment({
        classManaged,
        replyTo: teacherEmail,
        subject: emailSubject,
        body: studentBody,
        scope: "all",
      });
      setSendResults(
        res.results.map((r) => ({
          name: r.name,
          ok: r.ok,
          error: r.error,
        })),
      );
      setShowSendConfirm(false);
      if (res.sent > 0) {
        toast.success(`Assessment emailed to ${res.sent} parent(s).`);
      }
      if (res.failed > 0 || res.skipped > 0) {
        toast.error(
          `${res.failed} failed, ${res.skipped} skipped (no parent email). Add emails in Student list.`,
        );
      }
    } catch (err) {
      const msg =
        err instanceof ApiError && err.isMailNotConfigured
          ? "Add RESEND_API_KEY or SMTP settings to the backend .env."
          : err instanceof Error
            ? err.message
            : "Send failed.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(studentBody);
      toast.success("Assessment copied.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  function openSendDialog() {
    if (!recipients) {
      loadRecipients().then((r) => {
        if (!r?.withEmail) {
          toast.error("No parent emails on file. Add them in Student list first.");
          return;
        }
        setShowSendConfirm(true);
      });
      return;
    }
    if (recipients.withEmail === 0) {
      toast.error("No parent emails on file. Add them in Student list first.");
      return;
    }
    setShowSendConfirm(true);
  }

  return (
    <div className="grid grid-2">
      <Card
        title="Assessment Assigner"
        subtitle={`AI builds assessments for Grade ${grade} (${classManaged})`}
      >
        <p className="muted" style={{ marginBottom: 12 }}>
          Teaching <strong>{classManaged}</strong> as <strong>{teacherName}</strong>. Fill chapters
          and topics, then generate exam-ready questions with Gemini.
        </p>

        {aiReady && !showApiSettings && (
          <p className="field-hint" style={{ color: "#059669", marginBottom: 12 }}>
            ✓ AI connected
            {creds?.apiKey
              ? ` (${TEXT_LEVELER_PROVIDER_LABELS[creds.provider]})`
              : " (server)"}
            {" — "}
            <button
              type="button"
              className="pro-email-link-btn"
              style={{ padding: 0, fontSize: "inherit" }}
              onClick={() => setShowApiSettings(true)}
            >
              Change key
            </button>
          </p>
        )}

        {mailConfigured === false && (
          <details className="ppt-ai-setup">
            <summary>Enable email to parents (optional)</summary>
            <p className="muted">
              Add <code>RESEND_API_KEY</code> from{" "}
              <a href="https://resend.com" target="_blank" rel="noreferrer">
                resend.com
              </a>{" "}
              or SMTP settings to backend <code>.env</code>, then restart the server. You can still
              generate and copy assessments without email.
            </p>
          </details>
        )}

        <Field label="Subject">
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Chapters" hint="One per line or comma-separated">
          <textarea
            value={chapters}
            onChange={(e) => setChapters(e.target.value)}
            placeholder="Chapter 3: Laws of Motion&#10;Chapter 4: Work, Energy and Power"
            rows={3}
          />
        </Field>

        <Field label="Topics" hint="Specific concepts to cover">
          <textarea
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="Newton's second law, friction, conservation of energy, power"
            rows={3}
          />
        </Field>

        <div className="field">
          <span className="field-label">Difficulty</span>
          <div className="chip-group">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip${difficulty === d ? " active" : ""}`}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <Field label="Questions" hint="1–30">
            <input
              type="number"
              min={1}
              max={30}
              value={questionCount}
              onChange={(e) =>
                setQuestionCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </Field>
          <Field label="Duration (min)">
            <input
              type="number"
              min={10}
              max={300}
              value={durationMinutes}
              onChange={(e) =>
                setDurationMinutes(Math.min(300, Math.max(10, Number(e.target.value) || 45)))
              }
            />
          </Field>
        </div>

        <Field label="Extra instructions (optional)">
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Include one diagram-based question, focus on numericals…"
            rows={2}
          />
        </Field>

        {!aiReady && !showApiSettings && (
          <p className="field-hint" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="pro-email-link-btn"
              style={{ padding: 0, fontSize: "inherit" }}
              onClick={() => setShowApiSettings(true)}
            >
              Connect Gemini for AI questions
            </button>
            {" "}(or generate a template without a key)
          </p>
        )}

        {showApiSettings && (
          <details className="ppt-ai-setup" open>
            <summary>AI API (one-time setup)</summary>
            <div className="text-leveler-key-box" style={{ marginTop: 10 }}>
              <Field label="AI provider">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as TextLevelerProvider)}
                >
                  {TEXT_LEVELER_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {TEXT_LEVELER_PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="API key" hint={TEXT_LEVELER_PROVIDER_HINTS[provider]}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={TEXT_LEVELER_PROVIDER_PLACEHOLDERS[provider]}
                  autoComplete="off"
                />
              </Field>
              <div className="text-leveler-key-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={saveKey}>
                  Save key
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={useAssistantKey}>
                  Use assistant key
                </button>
              </div>
            </div>
          </details>
        )}

        <button
          className="btn btn-primary btn-block"
          onClick={() => void generate()}
          disabled={loading || !formReady}
        >
          {loading ? "Creating assessment…" : "✦ Generate questions with AI"}
        </button>
      </Card>

      <Card title="Preview & send" subtitle="Review, then email all parents">
        {loading && <Spinner label="AI is writing your assessment questions…" />}
        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && !assessment && (
          <EmptyState
            icon="📑"
            title="No assessment yet"
            hint="Set chapters, topics, and difficulty, then generate."
          />
        )}

        {assessment && !loading && (
          <div className="stack" style={{ gap: 16 }}>
            {localMode && (
              <span className="pill pill-primary">
                📑 Template assessment — connect Gemini for custom questions
              </span>
            )}
            {aiProviderUsed && !localMode && (
              <span className="pill pill-primary">
                ✦ Generated with {TEXT_LEVELER_PROVIDER_LABELS[aiProviderUsed]}
              </span>
            )}

            <div>
              <div className="section-label">{assessment.title}</div>
              <p className="muted">
                {assessment.totalMarks} marks · {assessment.durationMinutes} min ·{" "}
                {assessment.questions.length} questions · {assessment.difficulty}
              </p>
            </div>

            <div>
              <div className="section-label">Instructions</div>
              <div className="text-block">{assessment.instructions}</div>
            </div>

            <div>
              <div className="section-label">Questions</div>
              <div className="assessment-questions">
                {assessment.questions.map((q) => (
                  <div key={q.number} className="assessment-q">
                    <div className="assessment-q-head">
                      <strong>Q{q.number}</strong>
                      <span className="pill pill-primary">
                        {q.marks} mark{q.marks === 1 ? "" : "s"} · {q.questionType}
                      </span>
                    </div>
                    <p style={{ whiteSpace: "pre-wrap" }}>{q.questionText}</p>
                    <p className="muted" style={{ fontSize: 12 }}>
                      {q.chapter} · {q.topic} · {q.difficulty}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {assessment.teacherNotes && (
              <details>
                <summary className="section-label" style={{ cursor: "pointer" }}>
                  Teacher notes (not sent to parents)
                </summary>
                <div className="text-block" style={{ marginTop: 8 }}>
                  {assessment.teacherNotes}
                </div>
              </details>
            )}

            <div className="stack" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-block" onClick={copyText}>
                ⧉ Copy full assessment
              </button>
              {mailConfigured && (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={openSendDialog}
                  disabled={sending}
                >
                  ✉️ Email assessment to all students
                </button>
              )}
            </div>

            {recipients && (
              <p className="muted" style={{ fontSize: 13 }}>
                {recipients.withEmail} of {recipients.total} students have a parent email on file.
              </p>
            )}

            {sendResults && (
              <div>
                <div className="section-label">Send results</div>
                <ul className="send-results-list">
                  {sendResults.map((r) => (
                    <li key={r.name} className={r.ok ? "send-ok" : "send-fail"}>
                      {r.ok ? "✓" : "✗"} {r.name}
                      {r.error ? ` — ${r.error}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {showSendConfirm && recipients && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Send assessment by email?</h3>
            <p>
              This will email the assessment to <strong>{recipients.withEmail}</strong> parent
              {recipients.withEmail === 1 ? "" : "s"} in class <strong>{classManaged}</strong>.
            </p>
            {recipients.withoutEmail > 0 && (
              <p className="muted">
                {recipients.withoutEmail} student(s) have no parent email — they will be skipped.
                Add emails in Student list.
              </p>
            )}
            <p className="muted" style={{ fontSize: 13 }}>
              Subject: <code>{emailSubject}</code>
              <br />
              Replies go to {teacherEmail}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowSendConfirm(false)}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmSend}
                disabled={sending}
              >
                {sending ? "Sending…" : "Yes, send to all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
