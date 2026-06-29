/**
 * Parse pasted student list text without an LLM.
 */

export interface RosterImportRow {
  name: string;
  rollNumber: string;
  schoolId: string;
}

const NAME_HEADERS = /^(student\s*)?name|pupil|learner|full\s*name$/i;
const ROLL_HEADERS = /^roll(\s*(no|number|#))?|rollno|s\.?\s*no\.?|serial|sr\.?\s*no\.?|#$/i;
const ID_HEADERS = /^(school\s*)?(id|student\s*id)|admission|registration|reg\.?\s*no|gems|enroll/i;

function norm(cell: unknown): string {
  if (cell == null) return "";
  return String(cell).trim();
}

function looksLikeName(s: string): boolean {
  return s.length >= 2 && /[a-zA-Z]/.test(s) && !/^\d+$/.test(s);
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes("|")) return line.split("|").map((c) => c.trim());
  if (line.includes(",")) return line.split(",").map((c) => c.trim());
  return [line];
}

function findHeaderRow(rows: string[][]): { index: number; cols: { name: number; roll: number; id: number } } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i] ?? [];
    let nameCol = -1;
    let rollCol = -1;
    let idCol = -1;

    cells.forEach((c, idx) => {
      const lower = c.toLowerCase();
      if (NAME_HEADERS.test(lower)) nameCol = idx;
      else if (ROLL_HEADERS.test(lower)) rollCol = idx;
      else if (ID_HEADERS.test(lower)) idCol = idx;
    });

    if (nameCol >= 0 && (rollCol >= 0 || idCol >= 0)) {
      if (rollCol < 0) rollCol = nameCol === 0 ? 1 : 0;
      if (idCol < 0) idCol = Math.max(nameCol, rollCol) + 1;
      return { index: i, cols: { name: nameCol, roll: rollCol, id: idCol } };
    }
  }
  return null;
}

function parseTableRows(rows: string[][]): RosterImportRow[] {
  if (rows.length === 0) return [];

  const header = findHeaderRow(rows);
  const students: RosterImportRow[] = [];
  const start = header ? header.index + 1 : 0;

  if (header) {
    for (let i = start; i < rows.length; i++) {
      const cells = rows[i] ?? [];
      const name = cells[header.cols.name] ?? "";
      const rollNumber = cells[header.cols.roll] ?? "";
      let schoolId = cells[header.cols.id] ?? "";
      if (!name || !looksLikeName(name)) continue;
      if (!rollNumber && !schoolId) continue;
      if (!schoolId) schoolId = `GEMS-${rollNumber || i}`;
      if (!rollNumber) continue;
      students.push({ name, rollNumber, schoolId });
    }
    if (students.length > 0) return students;
  }

  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] ?? []).filter(Boolean);
    if (cells.length < 2) continue;
    const [a, b, c] = cells;
    if (!looksLikeName(a)) continue;
    students.push({
      name: a,
      rollNumber: b,
      schoolId: c?.trim() ? c : `GEMS-${b}`,
    });
  }

  return students;
}

function parseFreeformLine(line: string): RosterImportRow | null {
  let body = line.replace(/^\d+[.)]\s*/, "").trim();
  if (!body || /^(name|student|roll|school)/i.test(body)) return null;

  const rollLabel = body.match(/roll\s*(?:no\.?|number|#)?\s*[:\-]?\s*(\d+)/i);
  const idLabel = body.match(/(?:(?:school\s*)?id|admission|gems)\s*[:\-#]?\s*([\w-]+)/i);

  const parts = body
    .replace(/roll\s*(?:no\.?|number|#)?\s*[:\-]?\s*\d+/gi, "")
    .replace(/(?:(?:school\s*)?id|admission|gems)\s*[:\-#]?\s*[\w-]+/gi, "")
    .split(/\s*[,|–-]\s*|\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  let name = "";
  let rollNumber = rollLabel?.[1] ?? "";
  let schoolId = idLabel?.[1] ?? "";

  for (const p of parts) {
    if (!name && looksLikeName(p)) name = p;
    else if (!rollNumber && /^\d+$/.test(p)) rollNumber = p;
    else if (!schoolId && /^[\w-]{3,}$/i.test(p) && p !== rollNumber) schoolId = p;
  }

  if (!name && parts.length >= 1 && looksLikeName(parts[0])) name = parts[0];
  if (!rollNumber && parts.length >= 2 && /^\d+$/.test(parts[1])) rollNumber = parts[1];
  if (!schoolId && parts.length >= 3) schoolId = parts[2];

  if (!name || !rollNumber) return null;
  if (!schoolId) schoolId = `GEMS-${rollNumber}`;
  return { name, rollNumber, schoolId };
}

/** Parse pasted text into student roster entries. */
export function parseRosterFromText(text: string): RosterImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tableRows = lines.map(splitLine);
  const fromTable = parseTableRows(tableRows);
  if (fromTable.length > 0) return fromTable;

  const fromLines: RosterImportRow[] = [];
  for (const line of lines) {
    const row = parseFreeformLine(line);
    if (row) fromLines.push(row);
  }
  return fromLines;
}

/** @deprecated use parseRosterFromText */
export function parseRosterLocally(rows: unknown[][]): RosterImportRow[] {
  return parseTableRows(rows.map((r) => rowCells(r)));
}

function rowCells(row: unknown[]): string[] {
  return row.map(norm);
}
