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
    if (v !== null && v !== undefined) {
      const s = String(v).trim();
      if (s !== '') {
        vals.add(s);
      }
    }
  }
  return Array.from(vals);
}

export function applyColumnMapping(
  rows: DataRow[],
  sourceCol: string,
  newCol: string,
  mapping: Record<string, string>
): DataRow[] {
  // 1. Build lookup of normalized keys
  const normalizedMapping: Record<string, string> = {};
  for (const [key, val] of Object.entries(mapping)) {
    // Exact mapping key
    normalizedMapping[key] = val;
    
    // Lowercase and trimmed mapping key
    const lowKey = key.trim().toLowerCase();
    if (!(lowKey in normalizedMapping)) {
      normalizedMapping[lowKey] = val;
    }
    
    // Canonicalized mapping key (alphanumeric and converting ampersands)
    const canonKey = lowKey.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
    if (!(canonKey in normalizedMapping)) {
      normalizedMapping[canonKey] = val;
    }
  }

  // Pre-sort keys by length descending for substring lookup to prefer more specific matches
  const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);

  return rows.map((row) => {
    const original = String(row[sourceCol] ?? '');
    
    // Check 1: Exact match
    if (original in normalizedMapping) {
      return {
        ...row,
        [newCol]: normalizedMapping[original],
      };
    }
    
    // Check 2: Lowercase and trimmed match
    const lowOriginal = original.trim().toLowerCase();
    if (lowOriginal in normalizedMapping) {
      return {
        ...row,
        [newCol]: normalizedMapping[lowOriginal],
      };
    }
    
    // Check 3: Canonicalized match
    const canonOriginal = lowOriginal.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
    if (canonOriginal in normalizedMapping) {
      return {
        ...row,
        [newCol]: normalizedMapping[canonOriginal],
      };
    }
    
    // Check 4: Substring/fuzzy match (longest keys first, ignoring case/spacing/punctuation)
    for (const key of sortedKeys) {
      const kLow = key.trim().toLowerCase();
      if (
        kLow.length > 3 &&
        lowOriginal.length > 3 &&
        (lowOriginal.includes(kLow) || kLow.includes(lowOriginal))
      ) {
        return {
          ...row,
          [newCol]: mapping[key],
        };
      }
    }

    // Default fallback
    return {
      ...row,
      [newCol]: original,
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

export function applyCleansingRules(
  rows: DataRow[],
  selectedCols: string[],
  selectedRules: string[],
  customPattern?: string,
  customReplacement?: string,
  nullFillText: string = 'Unknown'
): DataRow[] {
  if (selectedCols.length === 0 || selectedRules.length === 0) return rows;

  let result = [...rows];

  const cellRules = selectedRules.filter((r) => r !== 'dedup');
  const hasDedup = selectedRules.includes('dedup');

  // Order of cell-level rules execution to be stable and logical:
  const ruleOrder = [
    'null_fill',
    'trim',
    'remove_html',
    'remove_accents',
    'alphanumeric',
    'phone',
    'email',
    'pii',
    'email_domain',
    'numeric',
    'text_only',
    'date_format',
    'boolean',
    'redact_ip',
    'titlecase',
    'uppercase',
    'lowercase',
    'custom'
  ];

  const sortedCellRules = [...cellRules].sort((a, b) => ruleOrder.indexOf(a) - ruleOrder.indexOf(b));

  if (sortedCellRules.length > 0) {
    result = result.map((row) => {
      const newRow = { ...row };
      for (const col of selectedCols) {
        let val = String(newRow[col] ?? '');
        
        for (const rule of sortedCellRules) {
          if (rule === 'null_fill') {
            const trimmed = val.trim().toLowerCase();
            if (trimmed === '' || trimmed === 'null' || trimmed === 'n/a' || trimmed === 'na' || trimmed === 'undefined') {
              val = nullFillText;
            }
          } else if (rule === 'trim') {
            val = val.trim().replace(/\s+/g, ' ');
          } else if (rule === 'remove_html') {
            val = val.replace(/<[^>]*>/g, '');
          } else if (rule === 'remove_accents') {
            val = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          } else if (rule === 'alphanumeric') {
            val = val.replace(/[^a-zA-Z0-9\s]/g, '');
          } else if (rule === 'phone') {
            const digits = val.replace(/\D/g, '');
            if (digits.length === 10) {
              val = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            } else if (digits.length === 11 && digits.startsWith('1')) {
              val = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
            }
          } else if (rule === 'email') {
            const parts = val.split('@');
            if (parts.length === 2) {
              const [local, domain] = parts;
              if (local.length <= 2) {
                val = `${local.charAt(0)}*@${domain}`;
              } else {
                val = `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
              }
            }
          } else if (rule === 'pii') {
            const digits = val.replace(/\D/g, '');
            if (digits.length === 9) {
              val = `XXX-XX-${digits.slice(5)}`;
            } else if (digits.length >= 12 && digits.length <= 16) {
              val = `XXXX-XXXX-XXXX-${digits.slice(-4)}`;
            } else {
              val = val.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, 'XXXX-XXXX-XXXX-XXXX')
                        .replace(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, 'XXX-XX-XXXX');
            }
          } else if (rule === 'titlecase') {
            val = toTitleCase(val);
          } else if (rule === 'uppercase') {
            val = val.toUpperCase();
          } else if (rule === 'lowercase') {
            val = val.toLowerCase();
          } else if (rule === 'numeric') {
            const matched = val.replace(/[^0-9.]/g, '');
            val = matched || '0';
          } else if (rule === 'email_domain') {
            const parts = val.split('@');
            val = parts.length === 2 ? parts[1] : val;
          } else if (rule === 'text_only') {
            val = val.replace(/[^a-zA-Z\s]/g, '');
          } else if (rule === 'date_format') {
            const parsedDate = Date.parse(val);
            if (!isNaN(parsedDate)) {
              const d = new Date(parsedDate);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              val = `${yyyy}-${mm}-${dd}`;
            }
          } else if (rule === 'boolean') {
            const lowerVal = val.trim().toLowerCase();
            if (['true', 'yes', 'y', '1', 'active', 't'].includes(lowerVal)) {
              val = 'true';
            } else if (['false', 'no', 'n', '0', 'inactive', 'f'].includes(lowerVal)) {
              val = 'false';
            }
          } else if (rule === 'redact_ip') {
            val = val.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, '$1.$2.$3.XXX');
          } else if (rule === 'custom' && customPattern !== undefined && customReplacement !== undefined) {
            try {
              const regex = new RegExp(customPattern, 'g');
              val = val.replace(regex, customReplacement);
            } catch {
              // Ignore invalid regex
            }
          }
        }
        
        newRow[col] = val;
      }
      return newRow;
    });
  }

  if (hasDedup) {
    result = dropDuplicates(result, selectedCols);
  }

  return result;
}

