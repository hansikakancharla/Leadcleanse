import { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Trash2, Clock, Database, BarChart2, Loader2 } from 'lucide-react';
import {
  getAttachedFiles,
  getExportLog,
  getDownloadLog,
  clearDatabaseHistory,
  getAttachedFileContent,
  getExportFileContent,
  logDownload,
  type AttachedFileRecord,
  type ExportRecord,
  type DownloadRecord,
} from '../utils/db';

interface DatabaseLogProps {
  refreshTrigger: number;
  username: string;
}

export default function DatabaseLog({ refreshTrigger, username }: DatabaseLogProps) {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileRecord[]>([]);
  const [exportLog, setExportLog] = useState<ExportRecord[]>([]);
  const [downloadLog, setDownloadLog] = useState<DownloadRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'attached' | 'exported' | 'downloaded'>('attached');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const attached = await getAttachedFiles();
        const exported = await getExportLog();
        const downloaded = await getDownloadLog();
        setAttachedFiles(attached);
        setExportLog(exported);
        setDownloadLog(downloaded);
      } catch (err) {
        console.error('Failed to load logs', err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [refreshTrigger]);

  async function handleClear() {
    if (confirm('Are you sure you want to clear the entire file, export, and download history database?')) {
      setLoading(true);
      try {
        await clearDatabaseHistory();
        setAttachedFiles([]);
        setExportLog([]);
        setDownloadLog([]);
      } catch (err) {
        console.error('Failed to clear logs', err);
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleDownloadAttached(record: AttachedFileRecord) {
    try {
      const rows = await getAttachedFileContent(record.id);
      if (!rows || rows.length === 0) {
        alert('File content is empty or not found. Note: Old files uploaded before the PostgreSQL migration do not contain saved content.');
        return;
      }

      // Convert rows back to CSV string
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
      
      // Force CSV extension if the original file had an Excel extension
      let downloadName = `Original_${record.filename}`;
      if (downloadName.toLowerCase().endsWith('.xlsx')) {
        downloadName = downloadName.slice(0, -5) + '.csv';
      } else if (downloadName.toLowerCase().endsWith('.xls')) {
        downloadName = downloadName.slice(0, -4) + '.csv';
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Audit download action in Postgres
      await logDownload(record.filename, username, 'Attached');
      const downloaded = await getDownloadLog();
      setDownloadLog(downloaded);
    } catch (e) {
      console.error(e);
      alert('Failed to download file.');
    }
  }

  async function handleDownloadExported(record: ExportRecord) {
    try {
      const rows = await getExportFileContent(record.id);
      if (!rows || rows.length === 0) {
        alert('File content is empty or not found. Note: Old files exported before the PostgreSQL migration do not contain saved content.');
        return;
      }

      // Convert rows back to CSV string
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
      
      // Force CSV extension if the original file had an Excel extension
      let downloadName = record.filename;
      if (downloadName.toLowerCase().endsWith('.xlsx')) {
        downloadName = downloadName.slice(0, -5) + '.csv';
      } else if (downloadName.toLowerCase().endsWith('.xls')) {
        downloadName = downloadName.slice(0, -4) + '.csv';
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Audit download action in Postgres
      await logDownload(record.filename, username, 'Exported');
      const downloaded = await getDownloadLog();
      setDownloadLog(downloaded);
    } catch (e) {
      console.error(e);
      alert('Failed to download file.');
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(isoStr: string): string {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  }

  const totalUploaded = attachedFiles.length;
  const totalExported = exportLog.reduce((sum, item) => sum + item.rowsCount, 0);
  const totalExportsCount = exportLog.length;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 border-l-4 border-l-violet-600 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shadow-sm">
            <Database size={16} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Audit Database & File History</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Logs all file attachments and export transactions</p>
          </div>
        </div>
        {(totalUploaded > 0 || totalExportsCount > 0 || downloadLog.length > 0) && (
          <button
            onClick={handleClear}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-650 bg-red-50 hover:bg-red-100/80 rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
            Clear Log Database
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* KPI metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50/70 border border-slate-150 p-4 rounded-xl flex items-center gap-3.5 transition-all hover:shadow-sm hover:scale-[1.01]">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shadow-sm shadow-blue-500/5">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Files Ingested</div>
              <div className="text-lg font-extrabold text-slate-850">{totalUploaded}</div>
            </div>
          </div>

          <div className="bg-slate-50/70 border border-slate-150 p-4 rounded-xl flex items-center gap-3.5 transition-all hover:shadow-sm hover:scale-[1.01]">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-500/5">
              <Download size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export Actions</div>
              <div className="text-lg font-extrabold text-slate-850">{totalExportsCount}</div>
            </div>
          </div>

          <div className="bg-slate-50/70 border border-slate-150 p-4 rounded-xl flex items-center gap-3.5 transition-all hover:shadow-sm hover:scale-[1.01]">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-650 shadow-sm shadow-purple-500/5">
              <BarChart2 size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rows Exported</div>
              <div className="text-lg font-extrabold text-slate-850">{totalExported.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('attached')}
            className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition-all px-2 ${
              activeTab === 'attached'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet size={13} />
            Attached Files History ({totalUploaded})
          </button>
          <button
            onClick={() => setActiveTab('exported')}
            className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition-all px-2 ${
              activeTab === 'exported'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download size={13} />
            Export Actions Log ({totalExportsCount})
          </button>
          <button
            onClick={() => setActiveTab('downloaded')}
            className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition-all px-2 ${
              activeTab === 'downloaded'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download size={13} className="rotate-180" />
            Download Actions Log ({downloadLog.length})
          </button>
          {loading && <Loader2 size={14} className="animate-spin text-slate-400 ml-2" />}
        </div>

        {/* Logs tables */}
        {activeTab === 'attached' ? (
          <div>
            {attachedFiles.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-150">
                No files logged yet. Upload your first dataset to start tracking.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">File Name</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Attached By</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Attached When</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Size</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Rows</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Cols</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {attachedFiles.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700 max-w-[200px] truncate" title={f.filename}>
                          {f.filename}
                        </td>
                         <td className="px-4 py-3 text-slate-700">
                           <div className="font-semibold">{f.attachedBy}</div>
                         </td>
                        <td className="px-4 py-3 text-slate-500 flex items-center gap-1.5">
                          <Clock size={11} className="text-slate-400" />
                          {formatDate(f.attachedAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-right">{formatBytes(f.sizeBytes)}</td>
                        <td className="px-4 py-3 text-slate-500 text-right font-medium">{f.rowsCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500 text-right">{f.columnsCount}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDownloadAttached(f)}
                            className="p-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-900 rounded-lg transition-colors inline-flex items-center justify-center shadow-xs"
                            title="Download original attached file"
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'exported' ? (
          <div>
            {exportLog.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-150">
                No exports tracked yet. Use the Pivot & Export module to trigger log entries.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Exported File</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Exported By</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Exported When</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Rows</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Scope</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {exportLog.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700 max-w-[200px] truncate" title={e.filename}>
                          {e.filename}
                        </td>
                         <td className="px-4 py-3 text-slate-700">
                           <div className="font-semibold">{e.exportedBy}</div>
                         </td>
                        <td className="px-4 py-3 text-slate-500 flex items-center gap-1.5">
                          <Clock size={11} className="text-slate-400" />
                          {formatDate(e.exportedAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-right font-semibold text-emerald-600">
                          {e.rowsCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            e.exportType === 'Full Dataset'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-teal-50 text-teal-700 border border-teal-100'
                          }`}>
                            {e.exportType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDownloadExported(e)}
                            className="p-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-900 rounded-lg transition-colors inline-flex items-center justify-center shadow-xs"
                            title="Download exported dataset"
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            {downloadLog.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-150">
                No downloads audited yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Downloaded File</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Downloaded By</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Downloaded When</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Source Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {downloadLog.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700 max-w-[280px] truncate" title={d.filename}>
                          {d.filename}
                        </td>
                         <td className="px-4 py-3 text-slate-700">
                           <div className="font-semibold">{d.downloadedBy}</div>
                         </td>
                        <td className="px-4 py-3 text-slate-500 flex items-center gap-1.5">
                          <Clock size={11} className="text-slate-400" />
                          {formatDate(d.downloadedAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            d.fileType === 'Attached'
                              ? 'bg-amber-50 text-amber-750 border border-amber-100'
                              : 'bg-teal-50 text-teal-750 border border-teal-100'
                          }`}>
                            {d.fileType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
