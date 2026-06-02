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
    <div className="flex flex-col items-center gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-blue-400 bg-blue-50 scale-[1.01]'
            : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'
        }`}
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-blue-100' : 'bg-white border border-slate-200'}`}>
          {loading ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload size={24} className={dragging ? 'text-blue-500' : 'text-slate-400'} />
          )}
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-700">
            {loading ? 'Parsing file...' : 'Drop your file here'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            or <span className="text-blue-600 font-medium">click to browse</span> — CSV, XLSX, XLS supported
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          {['CSV', 'XLSX', 'XLS'].map((fmt) => (
            <span key={fmt} className="px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600">
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

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 text-slate-400 text-xs">
        <FileText size={13} />
        Data is processed locally — nothing is sent to external servers except for AI normalization
      </div>
    </div>
  );
}
