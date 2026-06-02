import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DataRow } from '../types';

export async function parseFile(file: File): Promise<{ rows: DataRow[]; columns: string[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(file);
  }
  throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
}

function parseCsv(file: File): Promise<{ rows: DataRow[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<DataRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (result) => {
        const columns = result.meta.fields ?? [];
        resolve({ rows: result.data, columns });
      },
      error: reject,
    });
  });
}

async function parseExcel(file: File): Promise<{ rows: DataRow[]; columns: string[] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<DataRow>(sheet, { defval: null });
  const columns = raw.length > 0 ? Object.keys(raw[0]) : [];
  return { rows: raw, columns };
}
