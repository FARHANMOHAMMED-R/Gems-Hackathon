import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { LabReservation } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { AdminNotificationsPanel } from "../components/AdminNotificationsPanel";
import { AdminMonitorPanel } from "../components/AdminMonitorPanel";
import { useToast } from "../components/Toast";

const PERIODS = [1, 2, 3, 4, 5, 6, 7];
const STATUSES = ["Occupied", "Free"] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EditForm {
  roomName: string;
  date: string;
  periodNumber: number;
  reservedByTeacherId: string;
  status: (typeof STATUSES)[number];
}

function toEditForm(r: LabReservation): EditForm {
  return {
    roomName: r.roomName,
    date: r.date,
    periodNumber: r.periodNumber,
    reservedByTeacherId: r.reservedByTeacherId ?? "",
    status: r.status === "Free" ? "Free" : "Occupied",
  };
}

export function AdminDashboard() {
  const toast = useToast();

  const [filterDate, setFilterDate] = useState("");
  const [reservations, setReservations] = useState<LabReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LabReservation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [addRoom, setAddRoom] = useState("");
  const [addDate, setAddDate] = useState(today());
  const [addPeriod, setAddPeriod] = useState(1);
  const [addTeacher, setAddTeacher] = useState("");
  const [adding, setAdding] = useState(false);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listLabReservations(filterDate || undefined);
      setReservations(res.reservations);
    } catch (err) {
      setReservations([]);
      setError(err instanceof Error ? err.message : "Could not load reservations.");
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  function startEdit(r: LabReservation) {
    setEditingId(r.id);
    setEditForm(toEditForm(r));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm) return;

    setSaving(true);
    try {
      await api.updateLabReservation(editingId, {
        roomName: editForm.roomName.trim(),
        date: editForm.date,
        periodNumber: editForm.periodNumber,
        reservedByTeacherId: editForm.reservedByTeacherId.trim() || null,
        status: editForm.status,
      });
      toast.success("Reservation updated.");
      cancelEdit();
      await loadReservations();
    } catch (err) {
      const message =
        err instanceof ApiError && err.isDoubleBooking
          ? err.message
          : err instanceof Error
            ? err.message
            : "Update failed.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteLabReservation(deleteTarget.id);
      toast.success("Reservation deleted.");
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) cancelEdit();
      await loadReservations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function addReservation() {
    if (!addRoom.trim() || !addTeacher.trim()) {
      toast.error("Room name and teacher are required.");
      return;
    }
    setAdding(true);
    try {
      await api.reserveLab({
        roomName: addRoom.trim(),
        date: addDate,
        periodNumber: addPeriod,
        reservedByTeacherId: addTeacher.trim(),
      });
      toast.success("Reservation added.");
      setAddRoom("");
      setAddTeacher("");
      await loadReservations();
    } catch (err) {
      const message =
        err instanceof ApiError && err.isDoubleBooking
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not add reservation.";
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="admin-dashboard">
      <AdminMonitorPanel />
      <AdminNotificationsPanel />

      <Card
        title="Add reservation"
        subtitle="Admin override — book any available slot"
        className="admin-add-card"
      >
        <div className="row admin-add-row">
          <div style={{ flex: 2, minWidth: 140 }}>
            <Field label="Room name">
              <input
                type="text"
                value={addRoom}
                onChange={(e) => setAddRoom(e.target.value)}
                placeholder="e.g. Chemistry Lab"
              />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <Field label="Date">
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
              />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <Field label="Period">
              <select
                value={addPeriod}
                onChange={(e) => setAddPeriod(Number(e.target.value))}
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    Period {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ flex: 2, minWidth: 140 }}>
            <Field label="Reserved by">
              <input
                type="text"
                value={addTeacher}
                onChange={(e) => setAddTeacher(e.target.value)}
                placeholder="Teacher name or ID"
              />
            </Field>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={addReservation}
          disabled={adding}
        >
          {adding ? "Adding…" : "Add reservation"}
        </button>
      </Card>

      <Card
        title="Lab booking management"
        subtitle="View, edit, and cancel all lab reservations"
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => loadReservations()}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        }
      >
        <div className="row" style={{ marginBottom: 16, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Field label="Filter by date" hint="Leave empty to show all dates.">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </Field>
          </div>
          {filterDate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFilterDate("")}
            >
              Clear filter
            </button>
          )}
        </div>

        {loading && <Spinner label="Loading reservations…" />}
        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && reservations.length === 0 && (
          <EmptyState
            icon="🔬"
            title="No reservations"
            hint={
              filterDate
                ? `No lab bookings on ${filterDate}.`
                : "No lab bookings in the system yet."
            }
          />
        )}

        {!loading && !error && reservations.length > 0 && (
          <div className="table-wrap">
            <table className="table admin-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Date</th>
                  <th>Period</th>
                  <th>Reserved by</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Room">{r.roomName}</td>
                    <td data-label="Date">{r.date}</td>
                    <td data-label="Period">
                      <span className="pill pill-primary">P{r.periodNumber}</span>
                    </td>
                    <td data-label="Reserved by">{r.reservedByTeacherId ?? "—"}</td>
                    <td data-label="Status">
                      <span
                        className={`pill${r.status === "Occupied" ? " pill-primary" : ""}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td data-label="Actions" className="table-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-danger"
                        onClick={() => setDeleteTarget(r)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editingId && editForm && (
        <div className="modal-scrim" role="presentation" onClick={cancelEdit}>
          <div
            className="modal-card"
            role="dialog"
            aria-labelledby="edit-reservation-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-reservation-title" className="modal-title">
              Edit reservation
            </h3>
            <form onSubmit={saveEdit}>
              <Field label="Room name">
                <input
                  type="text"
                  value={editForm.roomName}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, roomName: e.target.value })
                  }
                  required
                />
              </Field>
              <div className="row">
                <div style={{ flex: 1, minWidth: 130 }}>
                  <Field label="Date">
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) =>
                        setEditForm((f) => f && { ...f, date: e.target.value })
                      }
                      required
                    />
                  </Field>
                </div>
                <div style={{ flex: 1, minWidth: 110 }}>
                  <Field label="Period">
                    <select
                      value={editForm.periodNumber}
                      onChange={(e) =>
                        setEditForm((f) => f && { ...f, periodNumber: Number(e.target.value) })
                      }
                    >
                      {PERIODS.map((p) => (
                        <option key={p} value={p}>
                          Period {p}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
              <Field label="Reserved by">
                <input
                  type="text"
                  value={editForm.reservedByTeacherId}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, reservedByTeacherId: e.target.value })
                  }
                  placeholder="Teacher name or ID"
                />
              </Field>
              <Field label="Status">
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => f && {
                      ...f,
                      status: e.target.value as EditForm["status"],
                    })
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-scrim" role="presentation">
          <div
            className="modal-card"
            role="alertdialog"
            aria-labelledby="delete-reservation-title"
            aria-describedby="delete-reservation-desc"
          >
            <h3 id="delete-reservation-title" className="modal-title">
              Delete reservation?
            </h3>
            <p id="delete-reservation-desc" className="modal-body">
              Remove <strong>{deleteTarget.roomName}</strong> on{" "}
              <strong>{deleteTarget.date}</strong>, period{" "}
              <strong>{deleteTarget.periodNumber}</strong>? This cannot be undone.
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
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
