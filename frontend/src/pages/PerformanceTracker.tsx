import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type {
  ExamPeriod,
  PerformanceDataResponse,
  PerformanceStudentRow,
  SavePerformanceMarksRequest,
} from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const SUBJECTS = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
  "English",
  "Computer Science",
  "History",
  "Geography",
];

const EXAM_PERIODS: ExamPeriod[] = ["PT1", "Half Yearly", "PT2", "Final"];

const LINE_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#22c55e",
];

type MarksGrid = Record<string, Record<ExamPeriod, string>>;

function emptyGrid(students: PerformanceStudentRow[]): MarksGrid {
  const grid: MarksGrid = {};
  for (const s of students) {
    grid[s.id] = {
      PT1: s.marks.PT1 != null ? String(s.marks.PT1) : "",
      "Half Yearly": s.marks["Half Yearly"] != null ? String(s.marks["Half Yearly"]) : "",
      PT2: s.marks.PT2 != null ? String(s.marks.PT2) : "",
      Final: s.marks.Final != null ? String(s.marks.Final) : "",
    };
  }
  return grid;
}

function chartSeries(
  students: PerformanceStudentRow[],
): { id: string; name: string; color: string; points: (number | null)[] }[] {
  return students.map((s, i) => ({
    id: s.id,
    name: s.name,
    color: LINE_COLORS[i % LINE_COLORS.length],
    points: EXAM_PERIODS.map((p) => s.marks[p]),
  })).filter((s) => s.points.some((p) => p != null));
}

function PerformanceLineChart({
  students,
  maxMarks,
}: {
  students: PerformanceStudentRow[];
  maxMarks: number;
}) {
  const width = 640;
  const height = 320;
  const pad = { top: 24, right: 24, bottom: 48, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const series = useMemo(() => chartSeries(students), [students]);

  const xStep = innerW / Math.max(EXAM_PERIODS.length - 1, 1);
  const yScale = (v: number) => pad.top + innerH - (v / maxMarks) * innerH;
  const xAt = (i: number) => pad.left + i * xStep;

  const yTicks = [0, maxMarks * 0.25, maxMarks * 0.5, maxMarks * 0.75, maxMarks];

  if (series.length === 0) {
    return (
      <EmptyState
        icon="📈"
        title="No marks to chart yet"
        hint="Enter marks in the table and save — each student appears as a line."
      />
    );
  }

  return (
    <div className="perf-chart-wrap">
      <svg
        className="perf-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Student performance line chart"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={yScale(tick)}
              x2={width - pad.right}
              y2={yScale(tick)}
              className="perf-chart-grid"
            />
            <text x={pad.left - 8} y={yScale(tick) + 4} className="perf-chart-axis-label" textAnchor="end">
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {EXAM_PERIODS.map((label, i) => (
          <text
            key={label}
            x={xAt(i)}
            y={height - 12}
            className="perf-chart-axis-label"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}

        {series.map((s) => {
          const segments: string[] = [];
          let segment: string[] = [];
          s.points.forEach((val, i) => {
            if (val == null) {
              if (segment.length) {
                segments.push(segment.join(" "));
                segment = [];
              }
              return;
            }
            segment.push(`${i === 0 && segment.length === 0 ? "M" : "L"} ${xAt(i)} ${yScale(val)}`);
          });
          if (segment.length) segments.push(segment.join(" "));

          return (
            <g key={s.id}>
              {segments.map((d, si) => (
                <path
                  key={si}
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {s.points.map((val, i) =>
                val != null ? (
                  <circle
                    key={i}
                    cx={xAt(i)}
                    cy={yScale(val)}
                    r={4}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ) : null,
              )}
            </g>
          );
        })}
      </svg>

      <ul className="perf-chart-legend">
        {series.map((s) => (
          <li key={s.id}>
            <span className="perf-legend-swatch" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PerformanceTracker({ classManaged }: { classManaged: string }) {
  const toast = useToast();
  const [subject, setSubject] = useState("Physics");
  const [maxMarks, setMaxMarks] = useState(100);
  const [data, setData] = useState<PerformanceDataResponse | null>(null);
  const [grid, setGrid] = useState<MarksGrid>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPerformance(classManaged, subject);
      setData(res);
      setMaxMarks(res.maxMarks);
      setGrid(emptyGrid(res.students));
    } catch (err) {
      setData(null);
      setGrid({});
      setError(err instanceof Error ? err.message : "Could not load performance data.");
    } finally {
      setLoading(false);
    }
  }, [classManaged, subject]);

  useEffect(() => {
    load();
  }, [load]);

  function updateCell(studentId: string, period: ExamPeriod, value: string) {
    setGrid((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [period]: value },
    }));
  }

  const chartStudents = useMemo((): PerformanceStudentRow[] => {
    if (!data) return [];
    return data.students.map((s) => ({
      ...s,
      marks: {
        PT1: parseMark(grid[s.id]?.PT1) ?? s.marks.PT1,
        "Half Yearly": parseMark(grid[s.id]?.["Half Yearly"]) ?? s.marks["Half Yearly"],
        PT2: parseMark(grid[s.id]?.PT2) ?? s.marks.PT2,
        Final: parseMark(grid[s.id]?.Final) ?? s.marks.Final,
      },
    }));
  }, [data, grid]);

  async function save() {
    if (!data) return;

    const entries: SavePerformanceMarksRequest["entries"] = [];
    for (const s of data.students) {
      const row = grid[s.id];
      if (!row) continue;
      for (const period of EXAM_PERIODS) {
        const raw = row[period].trim();
        if (!raw) continue;
        const marks = Number(raw);
        if (Number.isNaN(marks) || marks < 0) {
          toast.error(`Invalid marks for ${s.name} (${period}).`);
          return;
        }
        if (marks > maxMarks) {
          toast.error(`${s.name}: ${period} cannot exceed ${maxMarks}.`);
          return;
        }
        entries.push({ studentId: s.id, examPeriod: period, marks });
      }
    }

    if (entries.length === 0) {
      toast.error("Enter at least one mark before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.savePerformanceMarks({
        classManaged,
        subject,
        maxMarks,
        entries,
      });
      toast.success(`Saved ${entries.length} mark(s) for ${subject}.`);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-2 perf-tracker-layout">
      <Card
        title="Enter marks"
        subtitle={`PT1 → Half Yearly → PT2 → Final · Class ${classManaged}`}
      >
        <Field label="Subject">
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Max marks per exam" hint="Used for chart scale and validation">
          <input
            type="number"
            min={1}
            max={1000}
            value={maxMarks}
            onChange={(e) => setMaxMarks(Math.max(1, Number(e.target.value) || 100))}
          />
        </Field>

        {loading && <Spinner label="Loading roster & marks…" />}
        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && data && data.students.length === 0 && (
          <EmptyState
            icon="👥"
            title="No students in this class"
            hint="Add students in Student list first."
          />
        )}

        {!loading && data && data.students.length > 0 && (
          <>
            <div className="perf-marks-table-wrap">
              <table className="data-table perf-marks-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll</th>
                    {EXAM_PERIODS.map((p) => (
                      <th key={p}>{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td className="muted">{s.rollNumber}</td>
                      {EXAM_PERIODS.map((period) => (
                        <td key={period}>
                          <input
                            type="number"
                            className="perf-mark-input"
                            min={0}
                            max={maxMarks}
                            step={0.5}
                            placeholder="—"
                            value={grid[s.id]?.[period] ?? ""}
                            onChange={(e) => updateCell(s.id, period, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save marks"}
            </button>
          </>
        )}
      </Card>

      <Card title="Performance graph" subtitle={`${subject} — term-wise trend per student`}>
        {loading && <Spinner label="Building chart…" />}
        {!loading && data && (
          <PerformanceLineChart students={chartStudents} maxMarks={maxMarks} />
        )}
      </Card>
    </div>
  );
}

function parseMark(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}
