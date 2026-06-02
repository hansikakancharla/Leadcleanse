import { type DataRow } from '../types';

interface DataGridProps {
  rows: DataRow[];
  columns: string[];
  maxRows?: number;
  highlightCols?: string[];
  title?: string;
  subtitle?: string;
}

export default function DataGrid({
  rows,
  columns,
  maxRows = 10,
  highlightCols = [],
  title,
  subtitle,
}: DataGridProps) {
  const displayRows = rows.slice(0, maxRows);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-slate-100">
          {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col}
                  className={`px-4 py-3 text-left font-semibold whitespace-nowrap tracking-wide ${
                    highlightCols.includes(col)
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 transition-colors ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                } hover:bg-blue-50/40`}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`px-4 py-2.5 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis ${
                      highlightCols.includes(col)
                        ? 'text-emerald-700 font-medium bg-emerald-50/50'
                        : 'text-slate-700'
                    }`}
                    title={String(row[col] ?? '')}
                  >
                    {row[col] === null || row[col] === undefined ? (
                      <span className="text-slate-300 italic">null</span>
                    ) : String(row[col]) === 'Unknown' ? (
                      <span className="text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded text-xs font-medium">Unknown</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          Showing {maxRows} of {rows.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
