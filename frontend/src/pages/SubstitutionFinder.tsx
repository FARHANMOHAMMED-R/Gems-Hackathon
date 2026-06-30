import { useState } from "react";
import { api } from "../api/client";
import type { SubstitutionResponse } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export function SubstitutionFinder() {
  const toast = useToast();
  const [period, setPeriod] = useState(1);
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubstitutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.checkFree(period, department.trim() || undefined);
      setResult(res);
      if (res.freeTeachers.length === 0) {
        toast.info("No free teachers found for that period.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      toast.error("Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-2">
      <Card title="Find a Substitute" subtitle="Free teachers for a given period">
        <Field label="Period">
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                Period {p}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Department"
          hint="Optional — department-matched teachers are listed first."
        >
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Mathematics, CHEM, Computer Science"
          />
        </Field>

        <button className="btn btn-primary btn-block" onClick={search} disabled={loading}>
          {loading ? "Searching…" : "Find free teachers"}
        </button>
      </Card>

      <Card
        title="Available Teachers"
        subtitle={
          result
            ? `Period ${result.period}${result.department ? ` · ${result.department}` : ""}`
            : "Results appear here"
        }
      >
        {loading && <Spinner label="Checking availability…" />}
        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && !result && (
          <EmptyState
            icon="🔁"
            title="No search yet"
            hint="Pick a period and search to see who's free."
          />
        )}

        {!loading && !error && result && result.freeTeachers.length === 0 && (
          <EmptyState
            icon="🚫"
            title="No free teachers"
            hint={result.note ?? "Try a different period or remove the department filter."}
          />
        )}

        {!loading && !error && result && result.freeTeachers.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {result.freeTeachers.map((t) => {
                const matched =
                  result.department && t.department === result.department;
                return (
                  <tr key={t.id}>
                    <td>{t.teacherName}</td>
                    <td>
                      <span className={`pill${matched ? " pill-success" : ""}`}>
                        {t.department}
                        {matched ? " ✓ match" : ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
