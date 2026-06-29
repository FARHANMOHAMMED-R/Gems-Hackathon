import { useState } from "react";
import { api } from "../api/client";
import type { TeacherSession } from "../lib/authSession";
import { saveLocalRoster } from "../lib/classRoster";
import { RosterTextImport } from "../components/RosterTextImport";
import type { RosterImportStudent } from "../api/types";
import { Card, ErrorNote } from "../components/ui";
import { useToast } from "../components/Toast";

interface Row {
  name: string;
  rollNumber: string;
  schoolId: string;
}

const EMPTY_ROW = (): Row => ({ name: "", rollNumber: "", schoolId: "" });

export function ClassRosterSetup({
  teacher,
  onComplete,
}: {
  teacher: TeacherSession;
  onComplete: () => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, EMPTY_ROW()]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function handleTextImport(students: RosterImportStudent[]) {
    setRows(students.length > 0 ? students : [EMPTY_ROW()]);
    setError(null);
  }

  async function save() {
    const students = rows
      .map((r) => ({
        name: r.name.trim(),
        rollNumber: r.rollNumber.trim(),
        schoolId: r.schoolId.trim(),
      }))
      .filter((r) => r.name && r.rollNumber && r.schoolId);

    if (students.length === 0) {
      setError("Add at least one student with name, roll number, and school ID.");
      return;
    }

    setSaving(true);
    setError(null);

    // Always save locally first — never block the teacher on backend errors.
    saveLocalRoster(teacher.classManaged, students);
    onComplete();

    try {
      await api.createRoster({
        classManaged: teacher.classManaged,
        students,
      });
      toast.success(`Class roster saved — ${students.length} students synced to server.`);
    } catch {
      toast.success(
        `Class roster saved (${students.length} students). Backend offline — run npm run dev to sync.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="signin-page">
      <div className="signin-shell" style={{ maxWidth: 720 }}>
        <Card
          title="Set up your class"
          subtitle={`Welcome, ${teacher.name}. You're the first teacher for Class ${teacher.classManaged}. Add your students below — everyone starts at 0 tokens.`}
        >
          <p className="muted" style={{ marginBottom: 16 }}>
            Enter each student's <strong>name</strong>, <strong>roll number</strong>, and{" "}
            <strong>school ID</strong>. This powers the notebook analyzer, parent mailer, and
            token leaderboard.
          </p>

          <RosterTextImport onImported={handleTextImport} />

          <div className="roster-table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Student name</th>
                  <th>Roll no.</th>
                  <th>School ID</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(i, "name", e.target.value)}
                        placeholder="e.g. Aarav Sharma"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.rollNumber}
                        onChange={(e) => updateRow(i, "rollNumber", e.target.value)}
                        placeholder="e.g. 12"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.schoolId}
                        onChange={(e) => updateRow(i, "schoolId", e.target.value)}
                        placeholder="e.g. GEMS-2026-012"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 1}
                        aria-label="Remove row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={addRow}>
              + Add student
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save class roster"}
            </button>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
        </Card>
      </div>
    </div>
  );
}
