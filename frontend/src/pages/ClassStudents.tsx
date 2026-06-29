import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  addClassStudent,
  deleteClassStudent,
  fetchClassStudents,
  updateClassStudent,
} from "../api/classData";
import type { StudentRosterEntry } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { RosterTextImport } from "../components/RosterTextImport";
import type { RosterImportStudent } from "../api/types";
import { useToast } from "../components/Toast";

interface EditForm {
  name: string;
  rollNumber: string;
  schoolId: string;
  parentEmail: string;
}

function toEditForm(s: StudentRosterEntry): EditForm {
  return {
    name: s.name,
    rollNumber: s.rollNumber,
    schoolId: s.schoolId,
    parentEmail: s.parentEmail ?? "",
  };
}

export function ClassStudents({ classManaged }: { classManaged: string }) {
  const toast = useToast();

  const [students, setStudents] = useState<StudentRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StudentRosterEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [addName, setAddName] = useState("");
  const [addRoll, setAddRoll] = useState("");
  const [addSchoolId, setAddSchoolId] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchClassStudents(classManaged);
      setStudents(list);
    } catch (err) {
      setStudents([]);
      setError(err instanceof Error ? err.message : "Could not load students.");
    } finally {
      setLoading(false);
    }
  }, [classManaged]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  function startEdit(s: StudentRosterEntry) {
    setEditingId(s.id);
    setEditForm(toEditForm(s));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm) return;

    const name = editForm.name.trim();
    const rollNumber = editForm.rollNumber.trim();
    const schoolId = editForm.schoolId.trim();
    if (!name || !rollNumber || !schoolId) {
      toast.error("Name, roll number, and school ID are required.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateClassStudent(classManaged, editingId, {
        name,
        rollNumber,
        schoolId,
        parentEmail: editForm.parentEmail.trim(),
      });
      setStudents((prev) =>
        prev
          .map((s) => (s.id === editingId ? updated : s))
          .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber) || a.name.localeCompare(b.name)),
      );
      cancelEdit();
      toast.success(`Updated ${updated.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update student.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClassStudent(classManaged, deleteTarget.id);
      setStudents((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success(`Removed ${deleteTarget.name}.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove student.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = addName.trim();
    const rollNumber = addRoll.trim();
    const schoolId = addSchoolId.trim();
    if (!name || !rollNumber || !schoolId) {
      toast.error("Fill in name, roll number, and school ID.");
      return;
    }

    setAdding(true);
    try {
      const created = await addClassStudent(classManaged, { name, rollNumber, schoolId });
      setStudents((prev) =>
        [...prev, created].sort(
          (a, b) => a.rollNumber.localeCompare(b.rollNumber) || a.name.localeCompare(b.name),
        ),
      );
      setAddName("");
      setAddRoll("");
      setAddSchoolId("");
      toast.success(`Added ${created.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add student.");
    } finally {
      setAdding(false);
    }
  }

  async function handleTextImport(students: RosterImportStudent[]) {
    setBulkImporting(true);
    let added = 0;
    try {
      for (const s of students) {
        await addClassStudent(classManaged, s);
        added++;
      }
      await loadStudents();
      toast.success(`Added ${added} student(s) from pasted text.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add students.");
    } finally {
      setBulkImporting(false);
    }
  }

  return (
    <div className="page">
      <Card
        title="Manage class roster"
        subtitle={`Class ${classManaged} — edit names, roll numbers, and school IDs. Token balances are kept when you edit.`}
      >
        {loading && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Spinner />
          </div>
        )}

        {!loading && error && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && students.length === 0 && (
          <EmptyState icon="👥" title="No students yet" hint="Add students below to get started." />
        )}

        {!loading && students.length > 0 && (
          <div className="roster-table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll no.</th>
                  <th>School ID</th>
                  <th>Parent email</th>
                  <th>Tokens</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {students.map((s) =>
                  editingId === s.id && editForm ? (
                    <tr key={s.id}>
                      <td colSpan={6}>
                        <form
                          onSubmit={saveEdit}
                          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                        >
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Name"
                            required
                          />
                          <input
                            type="text"
                            value={editForm.rollNumber}
                            onChange={(e) =>
                              setEditForm({ ...editForm, rollNumber: e.target.value })
                            }
                            placeholder="Roll no."
                            required
                          />
                          <input
                            type="text"
                            value={editForm.schoolId}
                            onChange={(e) =>
                              setEditForm({ ...editForm, schoolId: e.target.value })
                            }
                            placeholder="School ID"
                            required
                          />
                          <input
                            type="email"
                            value={editForm.parentEmail}
                            onChange={(e) =>
                              setEditForm({ ...editForm, parentEmail: e.target.value })
                            }
                            placeholder="Parent email"
                          />
                          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.rollNumber}</td>
                      <td>{s.schoolId}</td>
                      <td className="muted">{s.parentEmail || "—"}</td>
                      <td>{s.totalTokens}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => startEdit(s)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteTarget(s)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <form
          onSubmit={handleAdd}
          style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Add students</h3>
          <RosterTextImport onImported={handleTextImport} disabled={bulkImporting} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <Field label="Name">
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
              />
            </Field>
            <Field label="Roll no.">
              <input
                type="text"
                value={addRoll}
                onChange={(e) => setAddRoll(e.target.value)}
                placeholder="e.g. 12"
              />
            </Field>
            <Field label="School ID">
              <input
                type="text"
                value={addSchoolId}
                onChange={(e) => setAddSchoolId(e.target.value)}
                placeholder="e.g. GEMS-2026-012"
              />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={adding}>
            {adding ? "Adding…" : "+ Add student"}
          </button>
        </form>
      </Card>

      {deleteTarget && (
        <div className="modal-scrim" role="presentation">
          <div className="modal-card" role="alertdialog" aria-labelledby="delete-student-title">
            <h3 id="delete-student-title" className="modal-title">
              Remove student?
            </h3>
            <p className="modal-body">
              Remove <strong>{deleteTarget.name}</strong> (roll {deleteTarget.rollNumber}) from
              Class {classManaged}? Their token balance ({deleteTarget.totalTokens}) will be lost.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
