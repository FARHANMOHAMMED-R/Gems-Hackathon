import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AvailabilityResponse, LabReservation } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LabBooking() {
  const toast = useToast();

  const [roomName, setRoomName] = useState("");
  const [date, setDate] = useState(today());
  const [periodNumber, setPeriodNumber] = useState(1);
  const [teacherId, setTeacherId] = useState("");
  const [reserving, setReserving] = useState(false);
  const [lastBooked, setLastBooked] = useState<LabReservation | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const [availDate, setAvailDate] = useState(today());
  const [availLoading, setAvailLoading] = useState(false);
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);

  async function reserve() {
    if (!roomName.trim() || !teacherId.trim()) {
      toast.error("Room name and teacher ID are required.");
      return;
    }
    setReserving(true);
    setLastBooked(null);
    setConflict(null);
    try {
      const res = await api.reserveLab({
        roomName: roomName.trim(),
        date,
        periodNumber,
        reservedByTeacherId: teacherId.trim(),
      });
      setLastBooked(res.reservation);
      toast.success("Lab reserved.");
      // Keep the availability view fresh if it's showing the same date.
      if (availDate === date) loadAvailability(date);
    } catch (err) {
      if (err instanceof ApiError && err.isDoubleBooking) {
        setConflict(err.message);
        toast.error("Double booking — slot already taken.");
      } else {
        toast.error(err instanceof Error ? err.message : "Reservation failed.");
      }
    } finally {
      setReserving(false);
    }
  }

  async function loadAvailability(d: string = availDate) {
    setAvailLoading(true);
    setAvailError(null);
    setAvail(null);
    try {
      const res = await api.labAvailability(d);
      setAvail(res);
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : "Could not load availability.");
    } finally {
      setAvailLoading(false);
    }
  }

  useEffect(() => {
    void loadAvailability(availDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once for today on mount
  }, []);

  return (
    <div className="grid grid-2">
      <Card title="Reserve a Lab" subtitle="One booking per room · date · period">
        <Field label="Room name">
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g. Physics Lab 1"
          />
        </Field>

        <div className="row">
          <div style={{ flex: 1, minWidth: 140 }}>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <Field label="Period">
              <select
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
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

        <Field label="Reserved by (teacher)" hint="Teacher name or ID.">
          <input
            type="text"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="e.g. Mr. Rajesh Kumar"
          />
        </Field>

        <button className="btn btn-primary btn-block" onClick={reserve} disabled={reserving}>
          {reserving ? "Reserving…" : "Reserve lab"}
        </button>

        {conflict && (
          <div style={{ marginTop: 14 }}>
            <ErrorNote>
              <strong>Double booking.</strong> {conflict}
            </ErrorNote>
          </div>
        )}

        {lastBooked && (
          <div style={{ marginTop: 14 }} className="info-note">
            <strong>Reserved:</strong> {lastBooked.roomName} · {lastBooked.date} ·
            Period {lastBooked.periodNumber}
            {lastBooked.reservedByTeacherId
              ? ` · ${lastBooked.reservedByTeacherId}`
              : ""}
          </div>
        )}
      </Card>

      <Card
        title="Availability"
        subtitle="Occupied slots for a date"
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => loadAvailability()}
            disabled={availLoading}
          >
            ↻ Load
          </button>
        }
      >
        <Field label="Date">
          <input
            type="date"
            value={availDate}
            onChange={(e) => setAvailDate(e.target.value)}
          />
        </Field>

        {availLoading && <Spinner label="Loading occupied slots…" />}
        {availError && !availLoading && <ErrorNote>{availError}</ErrorNote>}

        {!availLoading && !availError && !avail && (
          <EmptyState
            icon="🔬"
            title="No date loaded"
            hint="Choose a date and press Load to see occupied labs."
          />
        )}

        {!availLoading && !availError && avail && avail.occupied.length === 0 && (
          <EmptyState
            icon="✅"
            title="All labs free"
            hint={`No reservations on ${avail.date}.`}
          />
        )}

        {!availLoading && !availError && avail && avail.occupied.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Period</th>
                <th>Reserved by</th>
              </tr>
            </thead>
            <tbody>
              {avail.occupied.map((r) => (
                <tr key={r.id}>
                  <td>{r.roomName}</td>
                  <td>
                    <span className="pill pill-primary">P{r.periodNumber}</span>
                  </td>
                  <td>{r.reservedByTeacherId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
