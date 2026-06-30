import { useState } from "react";
import { api } from "../api/client";
import { GemsPtBlueprintView } from "../components/GemsPtBlueprintView";
import { buildPtBlueprintDocument } from "../lib/buildPtBlueprint";
import {
  CHEMISTRY_PT1_EXEMPLAR,
  DEFAULT_PT_SECTIONS,
  emptyUnitRow,
} from "../lib/ptBlueprintDefaults";
import { parseQuestionCount } from "../lib/ptBlueprintUtils";
import type { PtBlueprintDocument, PtBlueprintForm, PtSectionRow } from "../lib/ptBlueprintTypes";
import { ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

function defaultGrade(classManaged: string): string {
  const dash = classManaged.indexOf("-");
  const num = dash > 0 ? parseInt(classManaged.slice(0, dash), 10) : NaN;
  return Number.isFinite(num) ? String(num) : "11";
}

function SectionEditor({
  sections,
  onChange,
}: {
  sections: PtSectionRow[];
  onChange: (s: PtSectionRow[]) => void;
}) {
  function update(i: number, patch: Partial<PtSectionRow>) {
    const next = sections.map((row, idx) => {
      if (idx !== i) return row;
      const merged = { ...row, ...patch };
      const count = parseQuestionCount(merged.questionCountLabel);
      merged.totalMarks = count * merged.marksPerQuestion;
      return merged;
    });
    onChange(next);
  }

  return (
    <div className="gems-bp-form-sections">
      {sections.map((s, i) => (
        <div key={s.sectionId} className="gems-bp-section-row">
          <strong>Section {s.sectionId}</strong>
          <input
            value={s.typology}
            onChange={(e) => update(i, { typology: e.target.value })}
            placeholder="Typology"
          />
          <input
            value={s.questionCountLabel}
            onChange={(e) => update(i, { questionCountLabel: e.target.value })}
            placeholder="No. of questions"
          />
          <input
            type="number"
            min={1}
            value={s.marksPerQuestion}
            onChange={(e) => update(i, { marksPerQuestion: Number(e.target.value) || 1 })}
            placeholder="Marks"
          />
          <span className="muted">= {s.totalMarks} marks</span>
        </div>
      ))}
    </div>
  );
}

export function BlueprintGenerator({ classManaged }: { classManaged: string }) {
  const toast = useToast();
  const [form, setForm] = useState<PtBlueprintForm>({
    schoolName: "GEMS UNITED INDIAN SCHOOL, ABU DHABI",
    blueprintTitle: "PT 1 BLUEPRINT – 2026-27",
    grade: defaultGrade(classManaged),
    subject: "",
    sections: DEFAULT_PT_SECTIONS.map((s) => ({ ...s })),
    chapters: [{ serial: 1, chapterName: "", totalMarks: 0 }],
    units: [emptyUnitRow(1)],
  });
  const [doc, setDoc] = useState<PtBlueprintDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadExemplar() {
    setForm(CHEMISTRY_PT1_EXEMPLAR);
    setDoc(null);
    setError(null);
    toast.success("Loaded Chemistry PT1 exemplar.");
  }

  function addChapter() {
    const n = form.chapters.length + 1;
    setForm((f) => ({
      ...f,
      chapters: [...f.chapters, { serial: n, chapterName: "", totalMarks: 0 }],
      units: [...f.units, emptyUnitRow(n)],
    }));
  }

  function removeChapter(i: number) {
    if (form.chapters.length <= 1) return;
    setForm((f) => ({
      ...f,
      chapters: f.chapters.filter((_, idx) => idx !== i),
      units: f.units.filter((_, idx) => idx !== i),
    }));
  }

  function updateChapter(i: number, name: string, total: number) {
    setForm((f) => {
      const chapters = f.chapters.map((c, idx) =>
        idx === i ? { ...c, chapterName: name, totalMarks: total } : c,
      );
      const units = f.units.map((u, idx) =>
        idx === i ? { ...u, concept: name, chapterTotal: total } : u,
      );
      return { ...f, chapters, units };
    });
  }

  async function generate() {
    if (!form.subject.trim()) {
      toast.error("Enter the subject (e.g. Chemistry).");
      return;
    }
    if (form.chapters.some((c) => !c.chapterName.trim())) {
      toast.error("Fill in every chapter / unit name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.generatePtBlueprint(form);
      setDoc(res.document);
      toast.success("PT blueprint ready.");
    } catch {
      try {
        setDoc(buildPtBlueprintDocument(form));
        toast.success("Blueprint generated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate blueprint.");
        toast.error("Generation failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  function printBlueprint() {
    window.print();
  }

  return (
    <div className="blueprint-pt-page">
      <nav className="pro-email-crumb" aria-label="Breadcrumb">
        Teacher Tools <span aria-hidden>›</span> Blueprint Generator
      </nav>

      <div className="blueprint-pt-stack">
        <div className="pro-email-card blueprint-pt-form">
          <header className="pro-email-card-head">
            <div>
              <h2 className="pro-email-title">PT Blueprint Generator</h2>
              <p className="pro-email-desc">
                Answer the questions below to build a GEMS-style PT blueprint with chapter marks,
                section typology, and unit matrix.
              </p>
            </div>
            <button type="button" className="pro-email-link-btn" onClick={loadExemplar}>
              Show exemplar
            </button>
          </header>

          <Field label="School name *">
            <input
              value={form.schoolName}
              onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
            />
          </Field>

          <Field label="Blueprint title *" hint="e.g. PT 1 BLUEPRINT – 2026-27">
            <input
              value={form.blueprintTitle}
              onChange={(e) => setForm((f) => ({ ...f, blueprintTitle: e.target.value }))}
            />
          </Field>

          <div className="grid grid-2">
            <Field label="Grade *">
              <input
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                placeholder="11"
              />
            </Field>
            <Field label="Subject *">
              <input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value.toUpperCase() }))}
                placeholder="CHEMISTRY"
              />
            </Field>
          </div>

          <div className="field">
            <span className="field-label">Section typology *</span>
            <span className="field-hint">MCQ, short answer, case study, long &amp; very long answer</span>
            <SectionEditor
              sections={form.sections}
              onChange={(sections) => setForm((f) => ({ ...f, sections }))}
            />
          </div>

          <div className="field">
            <span className="field-label">Chapters / units *</span>
            {form.chapters.map((c, i) => (
              <div key={i} className="gems-bp-chapter-row">
                <span>{i + 1}.</span>
                <input
                  value={c.chapterName}
                  onChange={(e) => updateChapter(i, e.target.value, c.totalMarks)}
                  placeholder="Chapter name"
                />
                <input
                  type="number"
                  min={0}
                  value={c.totalMarks || ""}
                  onChange={(e) =>
                    updateChapter(i, c.chapterName, Number(e.target.value) || 0)
                  }
                  placeholder="Marks"
                  style={{ width: 72 }}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeChapter(i)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addChapter}>
              + Add chapter
            </button>
          </div>

          <div className="field">
            <span className="field-label">Unit question matrix *</span>
            <span className="field-hint">
              For each mark column, list question numbers. Use (K/U), (APP), HOT, (INTERNAL CHOICE)
              tags — one per line. Chapter totals auto-calculate from the matrix if left blank.
            </span>
            {form.units.map((u, i) => (
              <details key={i} className="gems-bp-unit-block" open={i === 0}>
                <summary>
                  Unit {i + 1}: {form.chapters[i]?.chapterName || "Untitled"}
                </summary>
                <div className="gems-bp-matrix-grid">
                  {(
                    [
                      ["mark1", "1 mark"],
                      ["mark2", "2 marks"],
                      ["mark3", "3 marks"],
                      ["mark4CaseBased", "4 marks case based"],
                      ["mark5", "5 marks"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        rows={4}
                        value={u[key]}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            units: f.units.map((row, idx) =>
                              idx === i ? { ...row, [key]: e.target.value } : row,
                            ),
                          }))
                        }
                        placeholder={`e.g.\n2 QUESTIONS\nQ.NO.1 (K/U)`}
                      />
                    </label>
                  ))}
                </div>
              </details>
            ))}
          </div>

          <button
            type="button"
            className="pro-email-generate"
            onClick={() => void generate()}
            disabled={loading}
          >
            {loading ? "Building…" : "✦ Generate PT Blueprint"}
          </button>
        </div>

        <section className="blueprint-pt-preview" aria-live="polite">
          {loading && <Spinner label="Building blueprint…" />}
          {error && !loading && <ErrorNote>{error}</ErrorNote>}
          {!loading && !doc && !error && (
            <div className="blueprint-pt-empty pro-email-card">
              <p className="muted">
                Fill the form above and click Generate to preview your PT blueprint here.
              </p>
            </div>
          )}
          {doc && !loading && (
            <>
              <div className="blueprint-pt-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={printBlueprint}>
                  Print / Save PDF
                </button>
              </div>
              <GemsPtBlueprintView doc={doc} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
