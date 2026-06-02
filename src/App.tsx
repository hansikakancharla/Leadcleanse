import { useState, useCallback } from 'react';
import { Database, Eye, EyeOff, Key, RefreshCw, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import type { DataRow } from './types';
import { parseFile } from './utils/fileParser';
import FileUpload from './components/FileUpload';
import DataGrid from './components/DataGrid';
import CleansingModule from './components/CleansingModule';
import AIStandardizeModule, { type AIProvider } from './components/AIStandardizeModule';
import PivotExportModule from './components/PivotExportModule';

export default function App() {
  const [data, setData] = useState<DataRow[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    groq: '',
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [showKeys, setShowKeys] = useState(false);
  const [keysExpanded, setKeysExpanded] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setFileError(null);
    try {
      const { rows, columns: cols } = await parseFile(file);
      setData(rows);
      setColumns(cols);
      setFileName(file.name);
    } catch (e: unknown) {
      setFileError(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleCleansingApply(updated: DataRow[]) {
    setData(updated);
  }

  function handleAIApply(updated: DataRow[], newCols: string[]) {
    setData(updated);
    setColumns((prev) => {
      const newSet = new Set(prev);
      for (const col of newCols) {
        if (!newSet.has(col)) {
          newSet.add(col);
        }
      }
      return Array.from(newSet);
    });
  }

  function updateApiKey(provider: AIProvider, key: string) {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  }

  function hasAnyApiKey() {
    return Object.values(apiKeys).some((k) => k.trim().length > 0);
  }

  function reset() {
    setData(null);
    setColumns([]);
    setFileName('');
    setFileError(null);
  }

  const providerLabels: Record<AIProvider, string> = {
    groq: 'Groq',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google AI',
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">DataCleanse AI</h1>
              <p className="text-xs text-slate-500">AI-Enriched Data Cleansing Tool</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data && (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 rounded-xl px-3 py-2">
                <FileSpreadsheet size={13} className="text-slate-500" />
                <span className="font-medium truncate max-w-[180px]">{fileName}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{data.length.toLocaleString()} rows</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{columns.length} cols</span>
              </div>
            )}

            {/* API Keys Section */}
            <div className="relative">
              <button
                onClick={() => setKeysExpanded((p) => !p)}
                className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-all ${
                  hasAnyApiKey()
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Key size={13} />
                API Keys
                {hasAnyApiKey() && (
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                )}
                {keysExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {keysExpanded && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3 z-30">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Configure AI Provider Keys</div>
                  {(['groq', 'openai', 'anthropic', 'gemini'] as AIProvider[]).map((provider) => (
                    <div key={provider} className="relative">
                      <label className="block text-xs font-medium text-slate-600 mb-1">{providerLabels[provider]}</label>
                      <input
                        type={showKeys ? 'text' : 'password'}
                        value={apiKeys[provider]}
                        onChange={(e) => updateApiKey(provider, e.target.value)}
                        placeholder={`${providerLabels[provider]} API Key`}
                        className="w-full pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowKeys((p) => !p);
                        }}
                        className="absolute right-2 top-7 text-slate-400 hover:text-slate-600"
                      >
                        {showKeys ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setShowKeys((p) => !p)}
                    className="w-full text-xs text-slate-500 hover:text-slate-700 py-1"
                  >
                    {showKeys ? 'Hide all keys' : 'Show all keys'}
                  </button>
                </div>
              )}
            </div>

            {data && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <RefreshCw size={13} />
                New File
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {!data ? (
          /* Upload screen */
          <div className="space-y-8">
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Your Dataset</h2>
              <p className="text-slate-500 text-sm max-w-lg mx-auto">
                Import a CSV or Excel file to begin cleansing, normalizing, and analyzing your tabular data.
              </p>
            </div>
            <FileUpload onFile={handleFile} loading={loading} />
            {fileError && (
              <div className="max-w-xl mx-auto text-center text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {fileError}
              </div>
            )}

            {/* Feature cards */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              {[
                { icon: '01', label: 'File Ingestion', desc: 'CSV & Excel with interactive data preview', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { icon: '02', label: 'Rule-Based Cleansing', desc: 'Deduplication and structural normalization', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { icon: '03', label: 'AI Standardization', desc: 'Multi-provider taxonomy alignment', color: 'bg-violet-50 text-violet-700 border-violet-200' },
                { icon: '04', label: 'Pivot & Export', desc: 'Aggregate, filter, and download clean data', color: 'bg-teal-50 text-teal-700 border-teal-200' },
              ].map((f) => (
                <div key={f.icon} className={`rounded-2xl border p-5 ${f.color}`}>
                  <div className="text-xs font-bold opacity-60 mb-2 tracking-widest">MODULE {f.icon}</div>
                  <div className="font-semibold text-sm mb-1">{f.label}</div>
                  <div className="text-xs opacity-75">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Main workspace */
          <div className="space-y-5">
            {/* Module 1 - Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Database size={16} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-sm">Module 1: Data Preview</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {data.length.toLocaleString()} rows · {columns.length} columns — showing first 10
                  </p>
                </div>
              </div>
              <div className="p-5">
                <DataGrid
                  rows={data}
                  columns={columns}
                  maxRows={10}
                />
              </div>
            </div>

            {/* Module 2 */}
            <CleansingModule
              data={data}
              columns={columns}
              onApply={handleCleansingApply}
            />

            {/* Module 3 */}
            <AIStandardizeModule
              data={data}
              columns={columns}
              onApply={handleAIApply}
              apiKeys={apiKeys}
            />

            {/* Module 4 */}
            <PivotExportModule
              data={data}
              columns={columns}
            />
          </div>
        )}
      </main>
    </div>
  );
}
