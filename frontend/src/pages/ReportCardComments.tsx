import { useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { draftReportCommentsLocally } from "../lib/localReportComments";
import { ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const WORD_LIMIT = 75000;

const GRADE_LEVELS = [
  "Kindergarten",
  "1st grade",
  "2nd grade",
  "3rd grade",
  "4th grade",
  "5th grade",
  "6th grade",
  "7th grade",
  "8th grade",
  "9th grade",
  "10th grade",
  "11th grade",
  "12th grade",
] as const;

const EXEMPLAR = {
  gradeLevel: "9th grade",
  studentPronouns: "they/them",
  strengths: `Consistently participates in class discussions and asks thoughtful questions.
Strong analytical skills in written work and lab reports.
Supports peers during group activities and models kindness.`,
  growthAreas: `Complete homework on time and review feedback before resubmitting.
Show all steps clearly in math and physics problem sets.
Ask for help early when concepts feel unclear before unit tests.`,
};

function countWords(...texts: string[]): number {
  return texts.reduce((sum, text) => {
    const n = text.trim() ? text.trim().split(/\s+/).length : 0;
    return sum + n;
  }, 0);
}

function defaultGrade(classManaged: string): string {
  const dash = classManaged.indexOf("-");
  const num = dash > 0 ? parseInt(classManaged.slice(0, dash), 10) : NaN;
  if (num >= 1 && num <= 12) {
    const suffix =
      num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} grade`;
  }
  return "9th grade";
}

export function ReportCardComments({ classManaged }: { classManaged: string }) {
  const toast = useToast();
  const strengthsFileRef = useRef<HTMLInputElement>(null);
  const growthFileRef = useRef<HTMLInputElement>(null);

  const [gradeLevel, setGradeLevel] = useState(defaultGrade(classManaged));
  const [studentPronouns, setStudentPronouns] = useState("");
  const [strengths, setStrengths] = useState("");
  const [growthAreas, setGrowthAreas] = useState("");
  const [strengthsFileName, setStrengthsFileName] = useState<string | null>(null);
  const [growthFileName, setGrowthFileName] = useState<string | null>(null);
  const [strengthsFileContext, setStrengthsFileContext] = useState("");
  const [growthFileContext, setGrowthFileContext] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [previousComment, setPreviousComment] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const totalWords = countWords(strengths, growthAreas, strengthsFileContext, growthFileContext);

  async function readTextFile(
    file: File,
    onSuccess: (name: string, text: string) => void,
  ) {
    const isText =
      file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name);
    if (!isText) {
      toast.error("Upload a text file (.txt, .md, .csv) for now.");
      return;
    }
    try {
      const text = await file.text();
      onSuccess(file.name, text.slice(0, 50000));
      toast.success(`Added ${file.name}.`);
    } catch {
      toast.error("Could not read that file.");
    }
  }

  function showExemplar() {
    setGradeLevel(EXEMPLAR.gradeLevel);
    setStudentPronouns(EXEMPLAR.studentPronouns);
    setStrengths(EXEMPLAR.strengths);
    setGrowthAreas(EXEMPLAR.growthAreas);
    setComment(null);
    setError(null);
  }

  function undo() {
    if (!previousComment) {
      toast.error("Nothing to undo.");
      return;
    }
    setComment(previousComment);
    setPreviousComment(null);
    toast.success("Restored previous comment.");
  }

  async function generate() {
    if (!studentPronouns.trim()) {
      toast.error("Enter student pronouns (e.g. he/him, she/her, they/them).");
      return;
    }
    if (!strengths.trim()) {
      toast.error("Add areas of strength.");
      return;
    }
    if (!growthAreas.trim()) {
      toast.error("Add areas for growth.");
      return;
    }
    if (totalWords > WORD_LIMIT) {
      toast.error(`Keep content under ${WORD_LIMIT.toLocaleString()} words.`);
      return;
    }

    const payload = {
      gradeLevel,
      studentPronouns: studentPronouns.trim(),
      strengths: strengths.trim(),
      growthAreas: growthAreas.trim(),
      strengthsFileContext: strengthsFileContext.trim() || undefined,
      growthFileContext: growthFileContext.trim() || undefined,
      provider: "gemini" as const,
    };

    setLoading(true);
    setError(null);

    try {
      const res = await api.generateReportComments(payload);
      setPreviousComment(comment);
      setComment(res.comment);
      toast.success(res.analysisMode === "ai" ? "Comment generated with AI." : "Comment generated.");
    } catch (err) {
      const offline =
        (err instanceof ApiError && err.isLlmNotConfigured) ||
        err instanceof TypeError ||
        (err instanceof ApiError && err.status >= 502);

      if (offline) {
        const local = draftReportCommentsLocally(payload);
        setPreviousComment(comment);
        setComment(local.comment);
        toast.success("Comment generated.");
      } else {
        setError(err instanceof Error ? err.message : "Generation failed.");
        toast.error("Could not generate comment.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyComment() {
    if (!comment) return;
    try {
      await navigator.clipboard.writeText(comment);
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
        Teacher Tools <span aria-hidden>›</span> Report Card Comments
      </nav>

      <div className="pro-email-card">
        <header className="pro-email-card-head">
          <div>
            <h2 className="pro-email-title">Report Card Comments</h2>
            <p className="pro-email-desc">
              Generate report card comments with a student&apos;s strengths and areas for growth.
            </p>
          </div>
          <div className="pro-email-head-actions">
            <button
              type="button"
              className="pro-email-icon-btn"
              onClick={undo}
              disabled={!previousComment}
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

        <Field label="Grade level *">
          <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Student Pronouns *" hint="he/him, she/her, they/them, etc.">
          <input
            value={studentPronouns}
            onChange={(e) => setStudentPronouns(e.target.value)}
            placeholder="he/him, she/her, they/them, etc."
          />
        </Field>

        <Field label="Areas of Strength *">
          <textarea
            className="pro-email-content"
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="Areas to celebrate — participation, skills, character, effort…"
            rows={6}
          />
        </Field>

        <div className="pro-email-footer">
          <div className="pro-email-footer-left">
            <input
              ref={strengthsFileRef}
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  readTextFile(file, (name, text) => {
                    setStrengthsFileName(name);
                    setStrengthsFileContext(text);
                  });
                }
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="pro-email-file-btn"
              onClick={() => strengthsFileRef.current?.click()}
            >
              📎 Add File
            </button>
            {strengthsFileName && (
              <span className="pro-email-file-name">
                {strengthsFileName}
                <button
                  type="button"
                  className="pro-email-file-clear"
                  onClick={() => {
                    setStrengthsFileName(null);
                    setStrengthsFileContext("");
                  }}
                  aria-label="Remove strengths file"
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

        <Field label="Areas for Growth *">
          <textarea
            className="pro-email-content"
            value={growthAreas}
            onChange={(e) => setGrowthAreas(e.target.value)}
            placeholder="Areas to improve — habits, skills, next steps…"
            rows={6}
          />
        </Field>

        <div className="pro-email-footer">
          <div className="pro-email-footer-left">
            <input
              ref={growthFileRef}
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  readTextFile(file, (name, text) => {
                    setGrowthFileName(name);
                    setGrowthFileContext(text);
                  });
                }
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="pro-email-file-btn"
              onClick={() => growthFileRef.current?.click()}
            >
              📎 Add File
            </button>
            {growthFileName && (
              <span className="pro-email-file-name">
                {growthFileName}
                <button
                  type="button"
                  className="pro-email-file-clear"
                  onClick={() => {
                    setGrowthFileName(null);
                    setGrowthFileContext("");
                  }}
                  aria-label="Remove growth file"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="pro-email-generate"
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generating…" : "✨ Generate"}
        </button>

        {loading && <Spinner label="Writing report comment…" />}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {comment && !loading && (
          <section className="pro-email-output">
            <div className="pro-email-output-head">
              <h3>Generated comment</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copyComment}>
                {copied ? "✓ Copied" : "⧉ Copy"}
              </button>
            </div>
            <textarea
              className="pro-email-body"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={14}
            />
          </section>
        )}
      </div>
    </div>
  );
}
