import { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFile: (file: File) => void;
  loading: boolean;
}

export default function FileUpload({ onFile, loading }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(file: File): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setError('Please upload a .csv, .xlsx, or .xls file.');
      return false;
    }
    setError(null);
    return true;
  }

  function handleFile(file: File) {
    if (validate(file)) onFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-2xl border-2 border-dashed rounded-3xl p-16 flex flex-col items-center gap-5 cursor-pointer transition-all duration-300 relative overflow-hidden backdrop-blur-md ${
          dragging
            ? 'border-teal-500 bg-teal-50/40 shadow-xl shadow-teal-500/5 scale-[1.015]'
            : 'border-slate-300 bg-white/70 shadow-lg shadow-slate-100 hover:border-teal-400 hover:bg-white/95 hover:shadow-xl hover:shadow-slate-200/50 hover:scale-[1.005]'
        }`}
      >
        {/* Decorative corner glows */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 pointer-events-none ${
          dragging 
            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' 
            : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-teal-500 hover:bg-white'
        }`}>
          {loading ? (
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload size={24} className={`transition-transform duration-300 ${dragging ? 'scale-110' : 'group-hover:-translate-y-0.5'}`} />
          )}
        </div>
        
        <div className="text-center pointer-events-none">
          <p className="text-lg font-bold text-slate-800 tracking-tight">
            {loading ? 'Analyzing & parsing dataset...' : 'Drop your spreadsheet here'}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">
            or <span className="text-teal-600 hover:text-teal-700 font-semibold underline decoration-2 underline-offset-2 transition-colors">click to browse local files</span>
          </p>
        </div>

        <div className="flex gap-2.5 mt-2 pointer-events-none">
          {['CSV', 'XLSX', 'XLS'].map((fmt) => (
            <span key={fmt} className="px-3 py-1 bg-white/90 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-500 tracking-wider shadow-sm transition-colors hover:border-slate-300">
              {fmt}
            </span>
          ))}
        </div>
        
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          try {
            const res = await fetch('/test_leads.csv');
            if (!res.ok) throw new Error('Failed to fetch demo file');
            const blob = await res.blob();
            const file = new File([blob], 'test_leads.csv', { type: 'text/csv' });
            onFile(file);
          } catch {
            setError('Failed to load demo data.');
          }
        }}
        className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-1.5"
      >
        Load Demo Data (test_leads.csv)
      </button>

      {error && (
        <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200/60 rounded-xl px-4 py-3 shadow-sm animate-bounce">
          <AlertCircle size={15} />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-slate-400 text-[10px] font-medium tracking-wide">
        <FileText size={13} className="text-slate-300" />
        Data is processed locally — nothing is sent to external servers except for AI normalization
      </div>
    </div>
  );
}
