import type { DataRow } from '../types';

export function normalizeValue(val: unknown): string | number | null {
  if (val === null || val === undefined) return 'Unknown';
  const s = String(val).trim();
  if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'na') return 'Unknown';
  return s;
}

export function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s|-)\w/g, (char) => char.toUpperCase());
}

export function structuralNormalize(rows: DataRow[], columns: string[]): DataRow[] {
  return rows.map((row) => {
    const newRow: DataRow = { ...row };
    for (const col of columns) {
      newRow[col] = normalizeValue(row[col]);
    }
    return newRow;
  });
}

export function dropDuplicates(rows: DataRow[], subsetCols: string[]): DataRow[] {
  if (subsetCols.length === 0) return rows;
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = subsetCols.map((c) => String(row[c] ?? '')).join('\x00');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getUniqueValues(rows: DataRow[], col: string): string[] {
  const vals = new Set<string>();
  for (const row of rows) {
    const v = row[col];
    if (v !== null && v !== undefined) vals.add(String(v));
  }
  return Array.from(vals);
}

export function applyColumnMapping(
  rows: DataRow[],
  sourceCol: string,
  newCol: string,
  mapping: Record<string, string>
): DataRow[] {
  return rows.map((row) => {
    const original = String(row[sourceCol] ?? '');
    return {
      ...row,
      [newCol]: mapping[original] ?? original,
    };
  });
}

export function pivotData(
  rows: DataRow[],
  groupByCols: string[],
  valueCol: string | null,
  aggFunc: 'count' | 'sum' | 'avg'
): DataRow[] {
  if (groupByCols.length === 0) return [];

  const groups: Record<string, { rows: DataRow[]; key: Record<string, string> }> = {};

  for (const row of rows) {
    const keyParts = groupByCols.map((c) => String(row[c] ?? 'Unknown'));
    const groupKey = keyParts.join('\x00');
    if (!groups[groupKey]) {
      const key: Record<string, string> = {};
      groupByCols.forEach((c, i) => { key[c] = keyParts[i]; });
      groups[groupKey] = { rows: [], key };
    }
    groups[groupKey].rows.push(row);
  }

  return Object.values(groups).map(({ rows: groupRows, key }) => {
    let metric: number;
    if (!valueCol || aggFunc === 'count') {
      metric = groupRows.length;
    } else {
      const nums = groupRows
        .map((r) => parseFloat(String(r[valueCol] ?? '')))
        .filter((n) => !isNaN(n));
      if (aggFunc === 'sum') metric = nums.reduce((a, b) => a + b, 0);
      else metric = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    }
    return { ...key, _metric: metric };
  });
}

export function exportToCSV(rows: DataRow[], filename: string): void {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const header = cols.join(',');
  const body = rows
    .map((row) =>
      cols
        .map((c) => {
          const v = String(row[c] ?? '');
          return v.includes(',') || v.includes('"') || v.includes('\n')
            ? `"${v.replace(/"/g, '""')}"`
            : v;
        })
        .join(',')
    )
    .join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
