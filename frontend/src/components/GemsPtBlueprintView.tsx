import type { PtBlueprintDocument } from "../lib/ptBlueprintTypes";
import { lineTagClass, parseQuestionCount } from "../lib/ptBlueprintUtils";

function renderCell(text: string) {
  if (!text.trim()) return null;
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="gems-bp-cell">
      {lines.map((line, i) => (
          <div key={i} className={lineTagClass(line)}>
            {line.trim()}
          </div>
        ))}
    </div>
  );
}

export function GemsPtBlueprintView({ doc }: { doc: PtBlueprintDocument }) {
  const sectionTotals = doc.sections.reduce(
    (acc, s) => {
      acc.count += parseQuestionCount(s.questionCountLabel);
      acc.marks += s.totalMarks;
      return acc;
    },
    { count: 0, marks: 0 },
  );

  const colTotals = {
    m1: doc.sections.find((s) => s.sectionId === "A")?.totalMarks ?? 6,
    m2: doc.sections.find((s) => s.sectionId === "B")?.totalMarks ?? 6,
    m3: doc.sections.find((s) => s.sectionId === "D")?.totalMarks ?? 9,
    m4: doc.sections.find((s) => s.sectionId === "C")?.totalMarks ?? 4,
    m5: doc.sections.find((s) => s.sectionId === "E")?.totalMarks ?? 5,
  };

  return (
    <div className="gems-bp-document">
      <header className="gems-bp-header">
        <p className="gems-bp-school">{doc.schoolName}</p>
        <h2 className="gems-bp-title">{doc.blueprintTitle}</h2>
        <p className="gems-bp-subject">
          GRADE {doc.grade}: {doc.subject}
        </p>
      </header>

      <table className="gems-bp-table">
        <thead>
          <tr>
            <th>S.NO.</th>
            <th>CHAPTER NAME</th>
            <th>Chapter wise total marks</th>
          </tr>
        </thead>
        <tbody>
          {doc.chapters.map((c) => (
            <tr key={c.serial}>
              <td>{c.serial}.</td>
              <td>{c.chapterName}</td>
              <td>{c.totalMarks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="gems-bp-table gems-bp-table-sections">
        <thead>
          <tr>
            <th>SECTION BREAK UP</th>
            <th>TYPOLOGY</th>
            <th>NO OF QUESTIONS</th>
            <th>Marks</th>
            <th>TOTAL MARKS</th>
          </tr>
        </thead>
        <tbody>
          {doc.sections.map((s) => (
            <tr key={s.sectionId}>
              <td>SECTION – {s.sectionId}</td>
              <td>{s.typology}</td>
              <td>{s.questionCountLabel}</td>
              <td>{s.marksPerQuestion}</td>
              <td>{s.totalMarks}</td>
            </tr>
          ))}
          <tr className="gems-bp-total-row">
            <td colSpan={2}>
              <strong>TOTAL</strong>
            </td>
            <td>
              <strong>{sectionTotals.count || doc.totalQuestions}</strong>
            </td>
            <td />
            <td>
              <strong>{sectionTotals.marks || doc.totalMarks}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="gems-bp-table gems-bp-table-matrix">
        <thead>
          <tr>
            <th>UNIT</th>
            <th>CONCEPT</th>
            <th>1 mark</th>
            <th>2 marks</th>
            <th>3 marks</th>
            <th>4 MARKS CASE BASED</th>
            <th>5 marks</th>
            <th>Chapter wise total marks</th>
          </tr>
        </thead>
        <tbody>
          {doc.units.map((u) => (
            <tr key={u.unit}>
              <td>{u.unit}</td>
              <td className="gems-bp-concept">{u.concept}</td>
              <td>{renderCell(u.mark1)}</td>
              <td>{renderCell(u.mark2)}</td>
              <td>{renderCell(u.mark3)}</td>
              <td>{renderCell(u.mark4CaseBased)}</td>
              <td>{renderCell(u.mark5)}</td>
              <td>
                <strong>{u.chapterTotal}</strong>
              </td>
            </tr>
          ))}
          <tr className="gems-bp-total-row">
            <td colSpan={2}>
              <strong>TOTAL</strong>
            </td>
            <td>{colTotals.m1} marks</td>
            <td>{colTotals.m2} marks+</td>
            <td>{colTotals.m3} marks</td>
            <td>{colTotals.m4} marks</td>
            <td>{colTotals.m5} marks</td>
            <td>
              <strong>{doc.totalMarks} marks</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <p className="gems-bp-footer">Page 1 of 1</p>
    </div>
  );
}
