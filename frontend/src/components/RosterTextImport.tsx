import { useState } from "react";
import { api, ApiError } from "../api/client";
import type { RosterImportStudent } from "../api/types";
import { parseRosterFromText } from "../lib/localRosterParser";
import { Field } from "../components/ui";
import { useToast } from "../components/Toast";

interface RosterTextImportProps {
  onImported: (students: RosterImportStudent[], mode: "ai" | "local") => void;
  disabled?: boolean;
}

export function RosterTextImport({ onImported, disabled }: RosterTextImportProps) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function convert() {
    const raw = text.trim();
    if (!raw) {
      toast.error("Paste your student list first.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.parseRosterText({ text: raw });
      onImported(res.students, res.analysisMode);
      toast.success(
        res.analysisMode === "ai"
          ? `AI found ${res.count} student(s).`
          : `Parsed ${res.count} student(s).`,
      );
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 404 || err.status === 0 || err.isLlmNotConfigured)
      ) {
        const students = parseRosterFromText(raw);
        if (students.length === 0) {
          toast.error("Could not parse students. Try one per line: Name, Roll No, School ID.");
          return;
        }
        onImported(students, "local");
        toast.success(`Parsed ${students.length} student(s) locally. Add OPENAI_API_KEY for AI.`);
      } else {
        toast.error(err instanceof Error ? err.message : "Could not parse student list.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="roster-text-import">
      <Field
        label="Paste student list"
        hint="Any format — AI extracts name, roll number & school ID"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading || disabled}
          rows={6}
          placeholder={`Example:\n1. Aarav Sharma, Roll 12, GEMS-2026-012\n2. Priya Nair, 13, GEMS-2026-013\n\nOr paste from a spreadsheet, WhatsApp message, or attendance sheet…`}
        />
      </Field>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={convert}
        disabled={loading || disabled || !text.trim()}
      >
        {loading ? "Converting…" : "✨ Convert with AI"}
      </button>
    </div>
  );
}
