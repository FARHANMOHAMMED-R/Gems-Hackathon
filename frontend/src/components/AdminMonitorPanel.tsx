import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AdminMonitorResponse } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminMonitorPanel() {
  const [data, setData] = useState<AdminMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("all");
  const [teacherTab, setTeacherTab] = useState<"all" | "online">("all");

  const load = useCallback(async () => {
    try {
      const res = await api.getAdminMonitor();
      setData(res);
      setError(null);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load monitor data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    if (classFilter === "all") return data.students;
    return data.students.filter((s) => s.classManaged === classFilter);
  }, [data, classFilter]);

  const filteredTeachers = useMemo(() => {
    if (!data) return [];
    if (teacherTab === "online") return data.teachers.filter((t) => t.isOnline);
    return data.teachers;
  }, [data, teacherTab]);

  if (loading && !data) {
    return (
      <Card title="Platform monitor" subtitle="Teachers, online users & student rosters">
        <Spinner label="Loading monitor…" />
      </Card>
    );
  }

  return (
    <div className="admin-monitor">
      <Card
        title="Platform monitor"
        subtitle="Live view of teachers and uploaded student rosters"
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            ↻ Refresh
          </button>
        }
      >
        {error && <ErrorNote>{error}</ErrorNote>}

        {data && (
          <>
            <div className="admin-stat-grid">
              <div className="admin-stat">
                <span className="admin-stat-value">{data.stats.totalTeachers}</span>
                <span className="admin-stat-label">Teachers registered</span>
              </div>
              <div className="admin-stat online">
                <span className="admin-stat-value">{data.stats.onlineTeachers}</span>
                <span className="admin-stat-label">Online now</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-value">{data.stats.totalStudents}</span>
                <span className="admin-stat-label">Students uploaded</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-value">{data.stats.totalClasses}</span>
                <span className="admin-stat-label">Classes active</span>
              </div>
            </div>

            <div className="grid grid-2 admin-monitor-panels">
              <div>
                <div className="admin-monitor-head">
                  <h3>Teachers</h3>
                  <div className="chip-group">
                    <button
                      type="button"
                      className={`chip${teacherTab === "all" ? " active" : ""}`}
                      onClick={() => setTeacherTab("all")}
                    >
                      All ({data.stats.totalTeachers})
                    </button>
                    <button
                      type="button"
                      className={`chip${teacherTab === "online" ? " active" : ""}`}
                      onClick={() => setTeacherTab("online")}
                    >
                      Online ({data.stats.onlineTeachers})
                    </button>
                  </div>
                </div>

                {filteredTeachers.length === 0 ? (
                  <EmptyState icon="👩‍🏫" title="No teachers" hint="Teachers appear after they sign in." />
                ) : (
                  <div className="roster-table-wrap">
                    <table className="roster-table admin-monitor-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Name</th>
                          <th>Class</th>
                          <th>Email</th>
                          <th>Last seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeachers.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <span className={`online-dot${t.isOnline ? " on" : ""}`}>
                                {t.isOnline ? "Online" : "Offline"}
                              </span>
                            </td>
                            <td>{t.name}</td>
                            <td>{t.classManaged}</td>
                            <td className="admin-monitor-email">{t.email}</td>
                            <td>{formatWhen(t.lastSeenAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="admin-monitor-head">
                  <h3>All students</h3>
                  <Field label="Filter by class">
                    <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                      <option value="all">All classes ({data.stats.totalStudents})</option>
                      {data.classCounts.map((c) => (
                        <option key={c.classManaged} value={c.classManaged}>
                          Class {c.classManaged} ({c.count})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {filteredStudents.length === 0 ? (
                  <EmptyState icon="👥" title="No students" hint="Students appear when teachers save rosters." />
                ) : (
                  <div className="roster-table-wrap admin-student-scroll">
                    <table className="roster-table admin-monitor-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Roll</th>
                          <th>School ID</th>
                          <th>Class</th>
                          <th>Tokens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((s) => (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            <td>{s.rollNumber}</td>
                            <td>{s.schoolId}</td>
                            <td>{s.classManaged}</td>
                            <td>{s.totalTokens}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
