import { useState } from "react";
import { api, ApiError } from "../api/client";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

export function ParentMailer() {
  const toast = useToast();
  const [studentId, setStudentId] = useState("");
  const [recentLimit, setRecentLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [llmDown, setLlmDown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!studentId.trim()) {
      toast.error("Enter a student ID.");
      return;
    }
    setLoading(true);
    setEmail(null);
    setLlmDown(false);
    setError(null);
    setCopied(false);
    try {
      const res = await api.generateMail({
        studentId: studentId.trim(),
        recentLimit,
      });
      setEmail(res.email);
      toast.success("Email drafted.");
    } catch (err) {
      if (err instanceof ApiError && err.isLlmNotConfigured) {
        setLlmDown(true);
      } else if (err instanceof ApiError && err.status === 404) {
        setError("No student found with that ID.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate email.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success("Copied to clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <div className="grid grid-2">
      <Card title="Parent Mailer" subtitle="Draft a warm, solution-focused update">
        <Field label="Student ID" hint="Find IDs on the Dashboard leaderboard.">
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. clxxxx…"
          />
        </Field>

        <Field label="Recent records to summarize" hint="Between 1 and 20.">
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
          {loading ? "Drafting…" : "Generate email"}
        </button>
      </Card>

      <Card
        title="Drafted Email"
        subtitle="Review, edit and send to parents"
        actions={
          email ? (
            <button className="btn btn-ghost btn-sm" onClick={copy}>
              {copied ? "✓ Copied" : "⧉ Copy"}
            </button>
          ) : undefined
        }
      >
        {loading && <Spinner label="Composing the email…" />}

        {llmDown && !loading && (
          <div className="info-note">
            The AI mailer isn't configured on the backend (no{" "}
            <code>OPENAI_API_KEY</code>). Add a key to the backend{" "}
            <code>.env</code> and restart it to enable email drafting.
          </div>
        )}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !llmDown && !error && !email && (
          <EmptyState
            icon="✉️"
            title="No email yet"
            hint="Enter a student ID and generate a draft."
          />
        )}

        {email && !loading && <div className="text-block">{email}</div>}
      </Card>
    </div>
  );
}
