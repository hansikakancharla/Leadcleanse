import { useState } from 'react';
import { CheckSquare, Square, Wand2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { DataRow } from '../types';
import { dropDuplicates, structuralNormalize } from '../utils/dataUtils';
import DataGrid from './DataGrid';

interface CleansingModuleProps {
  data: DataRow[];
  columns: string[];
  onApply: (updated: DataRow[]) => void;
}

export default function CleansingModule({ data, columns, onApply }: CleansingModuleProps) {
  const [dedupCols, setDedupCols] = useState<string[]>([]);
  const [normalizeEnabled, setNormalizeEnabled] = useState(false);
  const [previewData, setPreviewData] = useState<DataRow[] | null>(null);
  const [removedCount, setRemovedCount] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);

  function toggleDedupCol(col: string) {
    setDedupCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
    setPreviewData(null);
    setRemovedCount(null);
  }

  function applyRules() {
    let result = [...data];
    if (dedupCols.length > 0) {
      const before = result.length;
      result = dropDuplicates(result, dedupCols);
      setRemovedCount(before - result.length);
    }
    if (normalizeEnabled) {
      result = structuralNormalize(result, columns);
    }
    setPreviewData(result);
  }

  function confirmApply() {
    if (previewData) {
      onApply(previewData);
      setPreviewData(null);
      setRemovedCount(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Wand2 size={16} className="text-blue-600" />
          </div>
          <div className="text-left">
            <h2 className="font-semibold text-slate-800 text-sm">Module 2: Deterministic Cleansing</h2>
            <p className="text-xs text-slate-500 mt-0.5">Rule-based deduplication and structural normalization</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-slate-100">
          {/* Dedup */}
          <div className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Drop Duplicates</h3>
                <p className="text-xs text-slate-500 mt-0.5">Select columns to identify duplicate rows (keeps first occurrence)</p>
              </div>
              {dedupCols.length > 0 && (
                <button
                  onClick={() => setDedupCols([])}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => {
                const selected = dedupCols.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => toggleDedupCol(col)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    {selected ? <CheckSquare size={13} /> : <Square size={13} />}
                    {col}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Normalize */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Structural Normalization</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Strip whitespace, fix casing, replace empty/null values with "Unknown"
                </p>
              </div>
              <button
                onClick={() => setNormalizeEnabled((p) => !p)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  normalizeEnabled ? 'bg-blue-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    normalizeEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Apply button */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={applyRules}
              disabled={dedupCols.length === 0 && !normalizeEnabled}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Preview Changes
            </button>
            {previewData && (
              <button
                onClick={confirmApply}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Apply to Dataset
              </button>
            )}
          </div>

          {/* Preview */}
          {previewData && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {removedCount !== null && removedCount > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                    <span className="font-semibold text-amber-700">{removedCount.toLocaleString()} duplicate rows</span>
                    <span className="text-amber-600">will be removed</span>
                  </div>
                )}
                {removedCount === 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                    No duplicates found
                  </div>
                )}
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <span className="font-semibold">{previewData.length.toLocaleString()}</span> rows after cleaning
                </div>
              </div>
              <DataGrid
                rows={previewData}
                columns={columns}
                maxRows={5}
                title="Preview (first 5 rows)"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
