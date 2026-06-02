import { useState } from 'react';
import { BarChart3, Download, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import type { DataRow } from '../types';
import { pivotData, exportToCSV } from '../utils/dataUtils';

interface PivotExportModuleProps {
  data: DataRow[];
  columns: string[];
}

export default function PivotExportModule({ data, columns }: PivotExportModuleProps) {
  const [expanded, setExpanded] = useState(true);
  const [groupByCols, setGroupByCols] = useState<string[]>([]);
  const [valueCol, setValueCol] = useState<string>('');
  const [aggFunc, setAggFunc] = useState<'count' | 'sum' | 'avg'>('count');
  const [pivotRows, setPivotRows] = useState<DataRow[] | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const numericCols = columns.filter((c) => {
    const sample = data.slice(0, 20).map((r) => r[c]);
    return sample.some((v) => v !== null && v !== 'Unknown' && !isNaN(parseFloat(String(v))));
  });

  function toggleGroupBy(col: string) {
    setGroupByCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
    setPivotRows(null);
  }

  function runPivot() {
    const rows = pivotData(data, groupByCols, valueCol || null, aggFunc);
    rows.sort((a, b) => (Number(b._metric) || 0) - (Number(a._metric) || 0));
    setPivotRows(rows);
    setSelectedRows(new Set(rows.map((_, i) => i)));
  }

  function toggleRow(i: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleAll() {
    if (pivotRows && selectedRows.size === pivotRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pivotRows?.map((_, i) => i) ?? []));
    }
  }

  function exportFiltered() {
    if (!pivotRows) return;
    const selectedGroupKeys = pivotRows
      .filter((_, i) => selectedRows.has(i))
      .map((r) => groupByCols.map((c) => String(r[c] ?? '')).join('\x00'));

    const filtered = data.filter((row) => {
      const key = groupByCols.map((c) => String(row[c] ?? '')).join('\x00');
      return selectedGroupKeys.includes(key);
    });

    exportToCSV(filtered, 'Enriched_Cleaned_Dataset.csv');
  }

  function exportAll() {
    exportToCSV(data, 'Enriched_Cleaned_Dataset.csv');
  }

  const metricLabel = aggFunc === 'count' ? 'Count' : aggFunc === 'sum' ? `Sum(${valueCol})` : `Avg(${valueCol})`;
  const pivotCols = pivotRows && pivotRows.length > 0
    ? [...groupByCols, '_metric']
    : groupByCols;

  const maxMetric = pivotRows ? Math.max(...pivotRows.map((r) => Number(r._metric) || 0)) : 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
            <BarChart3 size={16} className="text-teal-600" />
          </div>
          <div className="text-left">
            <h2 className="font-semibold text-slate-800 text-sm">Module 4: Pivot Aggregator & Export</h2>
            <p className="text-xs text-slate-500 mt-0.5">Group and summarize data, then export filtered subsets</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
          {/* Config */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-2">Group By Column(s)</label>
              <div className="flex flex-wrap gap-2">
                {columns.map((col) => {
                  const selected = groupByCols.includes(col);
                  return (
                    <button
                      key={col}
                      onClick={() => toggleGroupBy(col)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        selected
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                      }`}
                    >
                      {selected ? <CheckSquare size={13} /> : <Square size={13} />}
                      {col}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Aggregation</label>
              <select
                value={aggFunc}
                onChange={(e) => setAggFunc(e.target.value as 'count' | 'sum' | 'avg')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              >
                <option value="count">Count (rows)</option>
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
              </select>
            </div>

            {aggFunc !== 'count' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Numeric Column</label>
                <select
                  value={valueCol}
                  onChange={(e) => setValueCol(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                >
                  <option value="">Select column...</option>
                  {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runPivot}
              disabled={groupByCols.length === 0}
              className="px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Generate Pivot
            </button>
            <button
              onClick={exportAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <Download size={15} />
              Export Full Dataset
            </button>
          </div>

          {/* Pivot result */}
          {pivotRows && pivotRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  Summary — {pivotRows.length} groups
                </h3>
                <button
                  onClick={exportFiltered}
                  disabled={selectedRows.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  <Download size={13} />
                  Export {selectedRows.size} Selected Group{selectedRows.size !== 1 ? 's' : ''}
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <button onClick={toggleAll} className="text-slate-500 hover:text-slate-700">
                          {selectedRows.size === pivotRows.length
                            ? <CheckSquare size={14} />
                            : <Square size={14} />}
                        </button>
                      </th>
                      {groupByCols.map((c) => (
                        <th key={c} className="px-4 py-3 text-left font-semibold text-slate-600">{c}</th>
                      ))}
                      <th className="px-4 py-3 text-right font-semibold text-teal-700">{metricLabel}</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 w-48">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotRows.map((row, i) => {
                      const metric = Number(row._metric) || 0;
                      const barWidth = maxMetric > 0 ? (metric / maxMetric) * 100 : 0;
                      const isSelected = selectedRows.has(i);
                      return (
                        <tr
                          key={i}
                          className={`border-b border-slate-100 cursor-pointer transition-colors ${
                            isSelected ? 'bg-teal-50/50' : 'bg-white hover:bg-slate-50'
                          }`}
                          onClick={() => toggleRow(i)}
                        >
                          <td className="px-4 py-3">
                            {isSelected
                              ? <CheckSquare size={14} className="text-teal-600" />
                              : <Square size={14} className="text-slate-400" />}
                          </td>
                          {groupByCols.map((c) => (
                            <td key={c} className="px-4 py-3 text-slate-700 font-medium">
                              {String(row[c] ?? '')}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-semibold text-teal-700">
                            {aggFunc === 'avg' ? metric.toFixed(2) : metric.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pivotRows && pivotRows.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              No data to group. Select at least one column.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
