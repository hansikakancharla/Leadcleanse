import { useState } from 'react';
import { BarChart3, Download, ChevronDown, ChevronUp, CheckSquare, Square, PieChart, TrendingUp, Table2, Search } from 'lucide-react';
import type { DataRow } from '../types';
import { pivotData, exportToCSV } from '../utils/dataUtils';
import { logExport } from '../utils/db';
import SearchableSelect from './SearchableSelect';

interface SVGChartProps {
  data: DataRow[];
  groupByCols: string[];
  metricLabel: string;
  chartType: 'bar' | 'line' | 'donut';
  aggFunc: string;
}

function SVGChart({ data, groupByCols, metricLabel, chartType, aggFunc }: SVGChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  
  const displayData = data.slice(0, 10);
  const metrics = displayData.map(d => Number(d._metric) || 0);
  const maxMetric = Math.max(...metrics, 1);
  
  const width = 600;
  const height = 300;
  const padding = 50;
  
  const getLabel = (d: DataRow) => {
    return groupByCols.map(c => String(d[c] ?? '')).join(' - ');
  };

  const colors = [
    '#4E342E', // Dark Truffle
    '#7B5E43', // Warm Chocolate
    '#A07855', // Cocoa
    '#C68642', // Rich Caramel
    '#D7B18E', // Creamy Caramel
    '#EAD2AC', // Warm Cream
    '#8C6239', // Hazelnut
    '#5C4033', // Dark Cocoa
    '#B07C57', // Golden Caramel
    '#D8B48F'  // Soft Cream
  ];

  if (chartType === 'bar') {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const barWidth = (chartWidth / displayData.length) * 0.7;
    const barSpacing = (chartWidth / displayData.length) * 0.3;

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white rounded-xl">
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + chartHeight * (1 - p);
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padding - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-medium">
                  {aggFunc === 'avg' ? (maxMetric * p).toFixed(1) : Math.round(maxMetric * p).toLocaleString()}
                </text>
              </g>
            );
          })}

          {displayData.map((d, idx) => {
            const val = Number(d._metric) || 0;
            const barHeight = (val / maxMetric) * chartHeight;
            const x = padding + idx * (barWidth + barSpacing) + barSpacing / 2;
            const y = height - padding - barHeight;
            const label = getLabel(d);
            const truncatedLabel = label.length > 12 ? label.slice(0, 10) + '..' : label;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  fill={hoveredIdx === idx ? '#0f766e' : '#14b8a6'}
                  rx="4"
                  className="transition-all duration-300"
                />
                <text
                  x={x + barWidth / 2}
                  y={height - padding + 15}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-500 font-medium"
                >
                  {truncatedLabel}
                </text>
              </g>
            );
          })}

          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1.5" />
        </svg>

        {hoveredIdx !== null && displayData[hoveredIdx] && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-slate-900/95 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md flex gap-2 items-center pointer-events-none">
            <span className="font-semibold text-slate-300">{getLabel(displayData[hoveredIdx])}:</span>
            <span className="font-bold text-teal-400">
              {aggFunc === 'avg' ? Number(displayData[hoveredIdx]._metric).toFixed(2) : Number(displayData[hoveredIdx]._metric).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400">({metricLabel})</span>
          </div>
        )}
      </div>
    );
  }

  if (chartType === 'line') {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const step = chartWidth / (displayData.length - 1 || 1);

    const points = displayData.map((d, idx) => {
      const val = Number(d._metric) || 0;
      const x = padding + idx * step;
      const y = height - padding - (val / maxMetric) * chartHeight;
      return { x, y, val, label: getLabel(d) };
    });

    const pathData = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white rounded-xl">
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + chartHeight * (1 - p);
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padding - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-medium">
                  {aggFunc === 'avg' ? (maxMetric * p).toFixed(1) : Math.round(maxMetric * p).toLocaleString()}
                </text>
              </g>
            );
          })}

          {points.length > 0 && (
            <path
              d={pathData}
              fill="none"
              stroke="#0d9488"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((p, idx) => {
            const label = p.label;
            const truncatedLabel = label.length > 12 ? label.slice(0, 10) + '..' : label;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIdx === idx ? 7 : 5}
                  fill="#0d9488"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />
                <text
                  x={p.x}
                  y={height - padding + 15}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-500 font-medium"
                >
                  {truncatedLabel}
                </text>
              </g>
            );
          })}

          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1.5" />
        </svg>

        {hoveredIdx !== null && points[hoveredIdx] && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-slate-900/95 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md flex gap-2 items-center pointer-events-none">
            <span className="font-semibold text-slate-300">{points[hoveredIdx].label}:</span>
            <span className="font-bold text-teal-400">
              {aggFunc === 'avg' ? points[hoveredIdx].val.toFixed(2) : points[hoveredIdx].val.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400">({metricLabel})</span>
          </div>
        )}
      </div>
    );
  }

  if (chartType === 'donut') {
    const totalMetric = metrics.reduce((a, b) => a + b, 0);
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const cx = 160;
    const cy = 150;
    
    let accumulatedValue = 0;

    return (
      <div className="relative flex flex-col md:flex-row items-center justify-center bg-white p-5 rounded-xl border border-slate-100 min-h-[300px]">
        <div className="w-full md:w-1/2 flex justify-center">
          <svg width={300} height={300} viewBox="0 0 320 300">
            <g transform="rotate(-90 160 150)">
              <circle cx={cx} cy={cy} r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="24" />
              
              {displayData.map((d, idx) => {
                const val = Number(d._metric) || 0;
                const percentage = totalMetric > 0 ? val / totalMetric : 0;
                const strokeLength = percentage * circumference;
                const strokeOffset = circumference - (accumulatedValue / totalMetric) * circumference;
                accumulatedValue += val;
                const color = colors[idx % colors.length];

                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={hoveredIdx === idx ? 28 : 24}
                    strokeDasharray={`${strokeLength} ${circumference}`}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer transition-all duration-300 origin-center"
                    style={{ transformOrigin: '160px 150px' }}
                  />
                );
              })}
            </g>
            <circle cx={cx} cy={cy} r={radius - 12} fill="#ffffff" />
            <text x={cx} y={cy - 5} textAnchor="middle" className="text-[10px] fill-slate-400 font-semibold uppercase tracking-wider">Total</text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="text-sm font-extrabold fill-slate-800">
              {aggFunc === 'avg' ? (totalMetric / (displayData.length || 1)).toFixed(2) : totalMetric.toLocaleString()}
            </text>
          </svg>
        </div>

        <div className="w-full md:w-1/2 space-y-2 max-h-56 overflow-y-auto pr-3 mt-4 md:mt-0">
          {displayData.map((d, idx) => {
            const val = Number(d._metric) || 0;
            const percentage = totalMetric > 0 ? (val / totalMetric) * 100 : 0;
            const color = colors[idx % colors.length];
            const label = getLabel(d);

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                  hoveredIdx === idx ? 'bg-slate-50' : ''
                }`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-600 font-medium truncate">{label}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-slate-800">
                    {aggFunc === 'avg' ? val.toFixed(2) : val.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1.5">({percentage.toFixed(1)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

interface PivotExportModuleProps {
  data: DataRow[];
  columns: string[];
  fileName?: string;
  username: string;
  onExportLogged?: () => void;
  onExportSuccess?: (msg: string) => void;
}

export default function PivotExportModule({ data, columns, fileName = '', username, onExportLogged, onExportSuccess }: PivotExportModuleProps) {
  const [expanded, setExpanded] = useState(true);
  const [groupByCols, setGroupByCols] = useState<string[]>([]);
  const [valueCol, setValueCol] = useState<string>('');
  const [aggFunc, setAggFunc] = useState<'count' | 'sum' | 'avg'>('count');
  const [pivotRows, setPivotRows] = useState<DataRow[] | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut'>('bar');
  const [searchQuery, setSearchQuery] = useState('');
  const [columnSearch, setColumnSearch] = useState('');

  const numericCols = columns.filter((c) => {
    const sample = data.slice(0, 20).map((r) => r[c]);
    return sample.some((v) => v !== null && v !== 'Unknown' && !isNaN(parseFloat(String(v))));
  });

  const filteredPivotRows = pivotRows
    ? pivotRows.filter((row) =>
        groupByCols.some((col) =>
          String(row[col] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : [];

  function toggleGroupBy(col: string) {
    setGroupByCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
    setPivotRows(null);
    setSearchQuery('');
  }

  function runPivot() {
    const rows = pivotData(data, groupByCols, valueCol || null, aggFunc);
    rows.sort((a, b) => (Number(b._metric) || 0) - (Number(a._metric) || 0));
    setPivotRows(rows);
    setSelectedRows(new Set(rows.map((_, i) => i)));
    setSearchQuery('');
  }

  function toggleRow(i: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  function toggleAll() {
    if (!pivotRows) return;
    const visibleIndices = filteredPivotRows.map((r) => pivotRows.indexOf(r));
    const allVisibleSelected = visibleIndices.every((idx) => selectedRows.has(idx));

    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIndices.forEach((idx) => next.delete(idx));
      } else {
        visibleIndices.forEach((idx) => next.add(idx));
      }
      return next;
    });
  }

  async function exportFiltered() {
    if (!pivotRows) return;
    const selectedGroupKeys = pivotRows
      .filter((_, i) => selectedRows.has(i))
      .map((r) => groupByCols.map((c) => String(r[c] ?? '')).join('\x00'));

    const filtered = data.filter((row) => {
      const key = groupByCols.map((c) => String(row[c] ?? '')).join('\x00');
      return selectedGroupKeys.includes(key);
    });

    const exportName = fileName ? `Cleaned_${fileName.replace(/\.[^/.]+$/, '')}.csv` : 'Enriched_Cleaned_Dataset.csv';
    exportToCSV(filtered, exportName);
    await logExport(exportName, filtered.length, 'Filtered Group(s)', username, filtered);
    if (onExportLogged) onExportLogged();
    if (onExportSuccess) onExportSuccess(`Successfully exported ${filtered.length.toLocaleString()} rows to ${exportName}!`);
  }

  async function exportAll() {
    const exportName = fileName ? `Cleaned_${fileName.replace(/\.[^/.]+$/, '')}.csv` : 'Enriched_Cleaned_Dataset.csv';
    exportToCSV(data, exportName);
    await logExport(exportName, data.length, 'Full Dataset', username, data);
    if (onExportLogged) onExportLogged();
    if (onExportSuccess) onExportSuccess(`Successfully exported ${data.length.toLocaleString()} rows to ${exportName}!`);
  }

  const metricLabel = aggFunc === 'count' ? 'Count' : aggFunc === 'sum' ? `Sum(${valueCol})` : `Avg(${valueCol})`;

  const maxMetric = pivotRows ? Math.max(...pivotRows.map((r) => Number(r._metric) || 0)) : 1;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 border-l-4 border-l-teal-500 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center shadow-sm">
            <BarChart3 size={16} className="text-teal-600" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-slate-800 text-sm">Module 4: Pivot Aggregator & Export</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Group and summarize data, then export filtered subsets</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
          {/* Config */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-605 mb-2">Group By Column(s)</label>
              
              {/* Column Search Input */}
              <div className="mb-2.5 max-w-md relative">
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white text-slate-700 placeholder-slate-400"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-slate-450" />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-slate-50">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-[1px] bg-slate-200">
                  {columns.filter(col => col.toLowerCase().includes(columnSearch.toLowerCase())).length === 0 ? (
                    <div className="col-span-full bg-white p-4 text-xs text-slate-400 text-center font-medium">No columns matching search</div>
                  ) : (
                    columns
                      .filter(col => col.toLowerCase().includes(columnSearch.toLowerCase()))
                      .map((col) => {
                        const selected = groupByCols.includes(col);
                        return (
                          <button
                            key={col}
                            onClick={() => toggleGroupBy(col)}
                            className={`flex items-center justify-between px-3 py-2.5 text-xs font-semibold transition-all text-left ${
                              selected
                                ? 'bg-teal-50/80 text-teal-800 hover:bg-teal-100/50'
                                : 'bg-white text-slate-600 hover:bg-slate-50/80'
                            }`}
                          >
                            <span className="truncate mr-2 font-medium" title={col}>{col}</span>
                            {selected ? (
                              <CheckSquare size={14} className="text-teal-600 shrink-0" />
                            ) : (
                              <Square size={14} className="text-slate-350 shrink-0" />
                            )}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

             <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Aggregation</label>
              <SearchableSelect
                value={aggFunc}
                onChange={(val) => setAggFunc(val as 'count' | 'sum' | 'avg')}
                options={[
                  { value: 'count', label: 'Count (rows)' },
                  { value: 'sum', label: 'Sum' },
                  { value: 'avg', label: 'Average' }
                ]}
                buttonClass="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-teal-500/30"
                activeClass="bg-teal-50 text-teal-800"
                checkColorClass="text-teal-650"
              />
            </div>

            {aggFunc !== 'count' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Numeric Column</label>
                <SearchableSelect
                  value={valueCol}
                  onChange={(val) => setValueCol(val)}
                  options={[
                    { value: '', label: 'Select column...' },
                    ...numericCols.map((c) => ({ value: c, label: c }))
                  ]}
                  buttonClass="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-teal-500/30"
                  activeClass="bg-teal-50 text-teal-800"
                  checkColorClass="text-teal-650"
                />
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
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      activeTab === 'table'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Table2 size={13} />
                    Table View
                  </button>
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      activeTab === 'chart'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <BarChart3 size={13} />
                    Visual Analytics
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search box */}
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search pivot groups..."
                      className="pl-8.5 pr-3 py-1.5 w-48 text-[11px] border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/25 transition-all"
                    />
                  </div>

                  {activeTab === 'chart' && (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      <button
                        onClick={() => setChartType('bar')}
                        className={`p-1.5 rounded-md transition-all ${
                          chartType === 'bar' ? 'bg-white text-teal-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Bar Chart"
                      >
                        <BarChart3 size={13} />
                      </button>
                      <button
                        onClick={() => setChartType('line')}
                        className={`p-1.5 rounded-md transition-all ${
                          chartType === 'line' ? 'bg-white text-teal-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Line Chart"
                      >
                        <TrendingUp size={13} />
                      </button>
                      <button
                        onClick={() => setChartType('donut')}
                        className={`p-1.5 rounded-md transition-all ${
                          chartType === 'donut' ? 'bg-white text-teal-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Donut Chart"
                      >
                        <PieChart size={13} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={exportFiltered}
                    disabled={selectedRows.size === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                  >
                    <Download size={13} />
                    Export {selectedRows.size} Selected Group{selectedRows.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>

              {activeTab === 'table' ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left w-10">
                          <button onClick={toggleAll} className="text-slate-500 hover:text-slate-700">
                            {pivotRows && filteredPivotRows.length > 0 && filteredPivotRows.every((r) => selectedRows.has(pivotRows.indexOf(r)))
                              ? <CheckSquare size={14} className="text-teal-600" />
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
                      {filteredPivotRows.map((row) => {
                        const originalIdx = pivotRows.indexOf(row);
                        const metric = Number(row._metric) || 0;
                        const barWidth = maxMetric > 0 ? (metric / maxMetric) * 100 : 0;
                        const isSelected = selectedRows.has(originalIdx);
                        return (
                          <tr
                            key={originalIdx}
                            className={`border-b border-slate-100 cursor-pointer transition-colors ${
                              isSelected ? 'bg-teal-50/50' : 'bg-white hover:bg-slate-50'
                            }`}
                            onClick={() => toggleRow(originalIdx)}
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
                      {filteredPivotRows.length === 0 && (
                        <tr>
                          <td colSpan={groupByCols.length + 3} className="px-4 py-8 text-center text-slate-400 font-medium">
                            No groups found matching "{searchQuery}"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {chartType === 'donut' ? 'Donut Chart Distribution' : chartType === 'line' ? 'Trend / Comparison Chart' : 'Metric Group Comparison'} (Top 10 Groups)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Showing distribution of {metricLabel} for the top groups</p>
                  </div>
                  <SVGChart
                    data={filteredPivotRows}
                    groupByCols={groupByCols}
                    metricLabel={metricLabel}
                    chartType={chartType}
                    aggFunc={aggFunc}
                  />
                </div>
              )}
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
