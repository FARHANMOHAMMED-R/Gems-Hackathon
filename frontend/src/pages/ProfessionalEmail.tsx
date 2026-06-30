import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AiProvider, AiProviderInfo } from "../api/types";
import { draftProfessionalEmailLocally } from "../lib/localProfessionalEmail";
import { ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const WORD_LIMIT = 75000;

function providerLabel(id: AiProvider): string {
  if (id === "openai") return "ChatGPT (OpenAI)";
  if (id === "gemini") return "Gemini";
  return "Claude";
}

const EXEMPLAR = {
  authorName: "Jane Smith",
  content: `Request a brief meeting with the principal to discuss chemistry lab resources.

- We need 5 additional lab kits for Grade 10 sections A and B
- Students are sharing equipment, which slows practical work
- Proposed timeline: kits before the acids & bases unit (next month)`,
};

interface EmailDraft {
  subject: string;
  body: string;
}

interface ProfessionalEmailProps {
  teacherEmail: string;
  teacherName: string;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function ProfessionalEmail({ teacherEmail, teacherName }: ProfessionalEmailProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [authorName, setAuthorName] = useState(teacherName);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContext, setFileContext] = useState("");

  const [loading, setLoading] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [previousDraft, setPreviousDraft] = useState<EmailDraft | null>(null);

  const [recipient, setRecipient] = useState("");
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [provider, setProvider] = useState<AiProvider | "">("");

  const totalWords = countWords(content) + countWords(fileContext);
  const configured = providers.filter((p) => p.configured);
  const useTemplate = configured.length === 0;

  useEffect(() => {
    api.getMailStatus().then((s) => setMailConfigured(s.configured)).catch(() => setMailConfigured(false));
    api
      .getAiProviders()
      .then((res) => {
        setProviders(res.providers);
        const openai = res.providers.find((p) => p.id === "openai" && p.configured);
        const first = openai ?? res.providers.find((p) => p.configured);
        if (first) setProvider(first.id);
      })
      .catch(() => setProviders([]));
  }, []);

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isText =
      file.type.startsWith("text/") ||
      /\.(txt|md|csv)$/i.test(file.name);

    if (!isText) {
      toast.error("Upload a text file (.txt, .md, .csv) for now.");
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      setFileName(file.name);
      setFileContext(text.slice(0, 50000));
      toast.success(`Added ${file.name}.`);
    } catch {
      toast.error("Could not read that file.");
    }
    e.target.value = "";
  }

  function showExemplar() {
    setAuthorName(EXEMPLAR.authorName);
    setContent(EXEMPLAR.content);
    setDraft(null);
    setError(null);
  }

  function undo() {
    if (!previousDraft) {
      toast.error("Nothing to undo.");
      return;
    }
    setDraft(previousDraft);
    setPreviousDraft(null);
    toast.success("Restored previous draft.");
  }

  async function generate() {
    if (!authorName.trim()) {
      toast.error("Enter your name as the author.");
      return;
    }
    if (!content.trim()) {
      toast.error("Add content to include in the email.");
      return;
    }
    if (totalWords > WORD_LIMIT) {
      toast.error(`Keep content under ${WORD_LIMIT.toLocaleString()} words.`);
      return;
    }

    setLoading(true);
    setError(null);
    setLocalMode(false);

    try {
      const res = await api.generateProfessionalEmail({
        authorName: authorName.trim(),
        content: content.trim(),
        fileContext: fileContext.trim() || undefined,
        provider: provider || undefined,
      });
      setPreviousDraft(draft);
      setDraft({ subject: res.subject, body: res.body });
      setLocalMode(res.analysisMode === "local");
      toast.success("Email generated.");
    } catch (err) {
      const offline =
        (err instanceof ApiError && err.isLlmNotConfigured) ||
        err instanceof TypeError ||
        (err instanceof ApiError && err.status >= 502);

      if (offline) {
        const local = draftProfessionalEmailLocally(
          authorName.trim(),
          content.trim(),
          fileContext.trim() || undefined,
        );
        setPreviousDraft(draft);
        setDraft(local);
        setLocalMode(true);
        toast.success("Email generated locally.");
      } else {
        setError(err instanceof Error ? err.message : "Generation failed.");
        toast.error("Could not generate email.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!draft) return;
    if (!recipient.trim()) {
      toast.error("Enter a recipient email address.");
      return;
    }

    setSending(true);
    try {
      await api.sendProfessionalEmail({
        to: recipient.trim(),
        subject: draft.subject,
        body: draft.body,
        replyTo: teacherEmail,
      });
      toast.success(`Sent to ${recipient.trim()}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.isMailNotConfigured
          ? "Add RESEND_API_KEY or SMTP settings to the backend .env to send emails."
          : err instanceof Error
            ? err.message
            : "Send failed.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function copyDraft() {
    if (!draft) return;
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <div className="pro-email-page">
      <nav className="pro-email-crumb" aria-label="Breadcrumb">
        Teacher Tools <span aria-hidden>›</span> Professional Email
      </nav>

      <div className="pro-email-card">
        <header className="pro-email-card-head">
          <div>
            <h2 className="pro-email-title">Professional Email</h2>
            <p className="pro-email-desc">Generate a professional email communication.</p>
          </div>
          <div className="pro-email-head-actions">
            <button
              type="button"
              className="pro-email-icon-btn"
              onClick={undo}
              disabled={!previousDraft}
              title="Undo"
              aria-label="Undo"
            >
              ↶
            </button>
            <button type="button" className="pro-email-link-btn" onClick={showExemplar}>
              Show exemplar
            </button>
          </div>
        </header>

        {useTemplate ? (
          <details className="ppt-ai-setup" open>
            <summary>Enable OpenAI / AI generation</summary>
            <p className="muted">
              Add your OpenAI key to backend <code>.env</code>, then restart the server:
            </p>
            <pre className="pro-email-env-snippet">{`OPENAI_API_KEY=sk-...
LLM_TEXT_MODEL=gpt-4o-mini
LLM_DEFAULT_PROVIDER=openai`}</pre>
            <p className="muted">
              Get a key at{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                platform.openai.com/api-keys
              </a>
              . Or use free <code>GEMINI_API_KEY</code> from{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              .
            </p>
          </details>
        ) : (
          <div className="field">
            <span className="field-label">AI provider</span>
            <div className="chip-group">
              {configured.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip${provider === p.id ? " active" : ""}`}
                  onClick={() => setProvider(p.id)}
                  title={p.textModel}
                >
                  {providerLabel(p.id)}
                </button>
              ))}
            </div>
          </div>
        )}

        {mailConfigured === false && (
          <details className="ppt-ai-setup">
            <summary>Enable sending emails (optional)</summary>
            <p className="muted">
              Add <code>RESEND_API_KEY</code> from{" "}
              <a href="https://resend.com" target="_blank" rel="noreferrer">
                resend.com
              </a>{" "}
              or SMTP settings to backend <code>.env</code>. You can still generate and copy
              emails without sending.
            </p>
          </details>
        )}

        <Field label="Author Name:">
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Jane Smith"
          />
        </Field>

        <Field label="Content to include in the email: *">
          <textarea
            className="pro-email-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Bullet points, rough notes, or key messages you want in the email…"
            rows={10}
            required
          />
        </Field>

        <div className="pro-email-footer">
          <div className="pro-email-footer-left">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
              hidden
              onChange={onFilePick}
            />
            <button
              type="button"
              className="pro-email-file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              📎 Add File
            </button>
            {fileName && (
              <span className="pro-email-file-name" title={fileName}>
                {fileName}
                <button
                  type="button"
                  className="pro-email-file-clear"
                  onClick={() => {
                    setFileName(null);
                    setFileContext("");
                  }}
                  aria-label="Remove file"
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <span className="pro-email-wordcount">
            Total word limit: {totalWords.toLocaleString()}/{WORD_LIMIT.toLocaleString()}
          </span>
        </div>

        <button
          type="button"
          className="pro-email-generate"
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generating…" : "✨ Generate"}
        </button>

        {loading && <Spinner label="Writing your email…" />}

        {localMode && draft && !loading && (
          <span className="pill pill-primary">
            📧 {useTemplate ? "Local draft — add OPENAI_API_KEY to backend .env" : "Local draft — backend could not reach AI"}
          </span>
        )}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {draft && !loading && (
          <section className="pro-email-output">
            <div className="pro-email-output-head">
              <h3>Generated email</h3>
              <div className="pro-email-output-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={copyDraft}>
                  {copied ? "✓ Copied" : "⧉ Copy"}
                </button>
              </div>
            </div>

            <Field label="Subject">
              <input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </Field>

            <textarea
              className="pro-email-body"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={14}
            />

            {mailConfigured && (
              <>
                <Field label="Send to" hint={`Replies go to ${teacherEmail}`}>
                  <input
                    type="email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="colleague@school.edu"
                  />
                </Field>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={send}
                  disabled={sending}
                >
                  {sending ? "Sending…" : "Send email"}
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
