import { useState, useMemo } from 'react';
import { 
  CheckSquare, Square, Wand2, ChevronDown, ChevronUp, Search,
  Phone, Mail, Lock, Type, Hash, Globe, FileText, Settings, Info, Check,
  Trash2, Calendar, Code, Languages, ToggleLeft, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';
import type { DataRow } from '../types';
import { structuralNormalize, applyCleansingRules } from '../utils/dataUtils';
import DataGrid from './DataGrid';

const RULE_DETAILS: Record<string, { title: string; description: string; example: string; iconName: string; category: string }> = {
  dedup: {
    title: "Drop Duplicate Rows",
    description: "Keep only unique rows based on selected columns (keeps first occurrence).",
    example: "Duplicate rows ➔ removed",
    iconName: "Trash2",
    category: "Dataset"
  },
  trim: {
    title: "Trim Whitespace",
    description: "Strip leading/trailing spaces and collapse multiple consecutive spaces.",
    example: "\"  hello   world  \" ➔ \"hello world\"",
    iconName: "FileText",
    category: "Formatting"
  },
  remove_html: {
    title: "Remove HTML Tags",
    description: "Strip HTML/XML tags from values.",
    example: "\"<b>Hello</b>\" ➔ \"Hello\"",
    iconName: "Code",
    category: "Formatting"
  },
  remove_accents: {
    title: "Remove Accents",
    description: "Normalize accented letters to standard English alphabet counterparts.",
    example: "\"Café\" ➔ \"Cafe\"",
    iconName: "Languages",
    category: "Formatting"
  },
  alphanumeric: {
    title: "Alphanumeric Only",
    description: "Keep only alphanumeric characters, removing special symbols.",
    example: "\"A-B_12#\" ➔ \"AB12\"",
    iconName: "Type",
    category: "Formatting"
  },
  phone: {
    title: "Standardize Phone Numbers",
    description: "Format phone numbers to standard structure.",
    example: "1234567890 ➔ (123) 456-7890",
    iconName: "Phone",
    category: "Specialized"
  },
  email: {
    title: "Mask Email Usernames",
    description: "Mask username characters for PII protection.",
    example: "john.doe@gmail.com ➔ j***e@gmail.com",
    iconName: "Mail",
    category: "Security & PII"
  },
  pii: {
    title: "Redact Cards / SSNs",
    description: "Redact Credit Cards and SSNs securely.",
    example: "123-45-6789 ➔ XXX-XX-6789",
    iconName: "Lock",
    category: "Security & PII"
  },
  titlecase: {
    title: "Format to Title Case",
    description: "Capitalize the first letter of every word.",
    example: "john doe ➔ John Doe",
    iconName: "Type",
    category: "Casing"
  },
  uppercase: {
    title: "Convert to UPPERCASE",
    description: "Convert all alphabetical text to uppercase.",
    example: "john doe ➔ JOHN DOE",
    iconName: "Type",
    category: "Casing"
  },
  lowercase: {
    title: "Convert to lowercase",
    description: "Convert all alphabetical text to lowercase.",
    example: "JOHN DOE ➔ john doe",
    iconName: "Type",
    category: "Casing"
  },
  numeric: {
    title: "Extract Numbers Only",
    description: "Extract numbers, decimals, and remove all text/symbols.",
    example: "$80,000.50 ➔ 80000.50",
    iconName: "Hash",
    category: "Specialized"
  },
  email_domain: {
    title: "Extract Email Domain",
    description: "Extract the domain name from email addresses.",
    example: "john@gmail.com ➔ gmail.com",
    iconName: "Globe",
    category: "Specialized"
  },
  text_only: {
    title: "Extract Letters Only",
    description: "Extract letters and spaces, removing numbers and symbols.",
    example: "User_123! ➔ User",
    iconName: "FileText",
    category: "Specialized"
  },
  date_format: {
    title: "Standardize Dates",
    description: "Convert common date strings to standard YYYY-MM-DD format.",
    example: "12/31/2023 ➔ 2023-12-31",
    iconName: "Calendar",
    category: "Specialized"
  },
  boolean: {
    title: "Standardize Booleans",
    description: "Normalize common boolean indicators to true/false.",
    example: "Yes/Y/1 ➔ true, No/N/0 ➔ false",
    iconName: "ToggleLeft",
    category: "Specialized"
  },
  redact_ip: {
    title: "Redact IP Addresses",
    description: "Redact/mask IP addresses for security compliance.",
    example: "192.168.1.1 ➔ 192.168.1.XXX",
    iconName: "ShieldAlert",
    category: "Security & PII"
  },
  null_fill: {
    title: "Fill Empty/Null Values",
    description: "Replace empty, null, or NA cell values with a default string.",
    example: "\"\" / \"null\" ➔ \"Unknown\"",
    iconName: "FileText",
    category: "Specialized"
  },
  custom: {
    title: "Custom Find & Replace",
    description: "Specify a custom regex pattern find and replace.",
    example: "Regex match ➔ replacement",
    iconName: "Settings",
    category: "Custom"
  }
};

const getRuleIcon = (iconName: string, className?: string) => {
  switch (iconName) {
    case 'Phone': return <Phone className={className} size={16} />;
    case 'Mail': return <Mail className={className} size={16} />;
    case 'Lock': return <Lock className={className} size={16} />;
    case 'Type': return <Type className={className} size={16} />;
    case 'Hash': return <Hash className={className} size={16} />;
    case 'Globe': return <Globe className={className} size={16} />;
    case 'FileText': return <FileText className={className} size={16} />;
    case 'Settings': return <Settings className={className} size={16} />;
    case 'Trash2': return <Trash2 className={className} size={16} />;
    case 'Calendar': return <Calendar className={className} size={16} />;
    case 'Code': return <Code className={className} size={16} />;
    case 'Languages': return <Languages className={className} size={16} />;
    case 'ToggleLeft': return <ToggleLeft className={className} size={16} />;
    case 'ShieldAlert': return <ShieldAlert className={className} size={16} />;
    default: return <Settings className={className} size={16} />;
  }
};

interface CleansingModuleProps {
  data: DataRow[];
  columns: string[];
  onApply: (updated: DataRow[]) => void;
}

export default function CleansingModule({ data, columns, onApply }: CleansingModuleProps) {
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [normalizeEnabled, setNormalizeEnabled] = useState(false);
  const [customPattern, setCustomPattern] = useState<string>('');
  const [customReplacement, setCustomReplacement] = useState<string>('');
  const [nullFillText, setNullFillText] = useState<string>('Unknown');
  const [previewData, setPreviewData] = useState<DataRow[] | null>(null);
  const [removedCount, setRemovedCount] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [colSearchTerm, setColSearchTerm] = useState('');
  const [ruleSearchTerm, setRuleSearchTerm] = useState('');

  function toggleCol(col: string) {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
    setPreviewData(null);
    setRemovedCount(null);
  }

  function toggleRule(rule: string) {
    setSelectedRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
    setPreviewData(null);
    setRemovedCount(null);
  }

  function isSuggested(colName: string): boolean {
    const name = colName.toLowerCase();
    return (
      name.includes('phone') || name.includes('mobile') || name.includes('contact') ||
      name.includes('email') || name.includes('mail') ||
      name.includes('name') || name.includes('title') || name.includes('first') || name.includes('last') ||
      name.includes('salary') || name.includes('price') || name.includes('amount') || name.includes('cost') ||
      name.includes('balance') || name.includes('count') || name.includes('age') ||
      name.includes('ssn') || name.includes('card') || name.includes('pii') || name.includes('tax') ||
      name.includes('secure') || name.includes('password') ||
      name.includes('date') || name.includes('created') || name.includes('updated')
    );
  }

  function selectSuggestedCols() {
    const suggested = columns.filter(isSuggested);
    setSelectedCols(suggested);
    setPreviewData(null);
    setRemovedCount(null);
  }

  function selectAllCols() {
    setSelectedCols([...columns]);
    setPreviewData(null);
    setRemovedCount(null);
  }

  function clearCols() {
    setSelectedCols([]);
    setPreviewData(null);
    setRemovedCount(null);
  }

  function selectAllRules() {
    setSelectedRules(Object.keys(RULE_DETAILS));
    setPreviewData(null);
    setRemovedCount(null);
  }

  function clearRules() {
    setSelectedRules([]);
    setPreviewData(null);
    setRemovedCount(null);
  }

  const filteredCols = useMemo(() => {
    return columns.filter((col) => col.toLowerCase().includes(colSearchTerm.toLowerCase()));
  }, [columns, colSearchTerm]);

  const filteredRules = useMemo(() => {
    return Object.entries(RULE_DETAILS).filter(([, details]) => 
      details.title.toLowerCase().includes(ruleSearchTerm.toLowerCase()) || 
      details.description.toLowerCase().includes(ruleSearchTerm.toLowerCase()) ||
      details.category.toLowerCase().includes(ruleSearchTerm.toLowerCase())
    );
  }, [ruleSearchTerm]);

  function applyRules() {
    let result = [...data];
    if (normalizeEnabled) {
      result = structuralNormalize(result, columns);
    }
    
    result = applyCleansingRules(
      result,
      selectedCols,
      selectedRules,
      customPattern,
      customReplacement,
      nullFillText
    );

    if (selectedRules.includes('dedup') && selectedCols.length > 0) {
      const rulesWithoutDedup = selectedRules.filter(r => r !== 'dedup');
      let intermediate = [...data];
      if (normalizeEnabled) {
        intermediate = structuralNormalize(intermediate, columns);
      }
      if (rulesWithoutDedup.length > 0) {
        intermediate = applyCleansingRules(
          intermediate,
          selectedCols,
          rulesWithoutDedup,
          customPattern,
          customReplacement,
          nullFillText
        );
      }
      setRemovedCount(intermediate.length - result.length);
    } else {
      setRemovedCount(null);
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
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 border-l-4 border-l-amber-500 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50/40 transition-colors animate-fade-in"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shadow-sm">
            <Wand2 size={16} className="text-amber-600" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-slate-800 text-sm">Module 2: Deterministic Cleansing</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rule-based deduplication and structural normalization</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-slate-100">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
            {/* Target Columns Multi-Select */}
            <div className="lg:col-span-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  1. Select Target Columns
                  {selectedCols.length > 0 && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {selectedCols.length}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Choose columns you wish to clean.</p>
              </div>

              {/* Column Search & Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search columns..."
                    value={colSearchTerm}
                    onChange={(e) => setColSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 bg-white text-slate-750 placeholder-slate-400"
                  />
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={selectAllCols}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearCols}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={selectSuggestedCols}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Sparkles size={10} /> Suggested
                  </button>
                </div>
              </div>

              {/* Columns Checklist */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white shadow-inner">
                {filteredCols.length === 0 ? (
                  <div className="p-4 text-xs text-slate-400 text-center font-medium">No columns matching search</div>
                ) : (
                  filteredCols.map((col) => {
                    const selected = selectedCols.includes(col);
                    const suggested = isSuggested(col);
                    return (
                      <button
                        key={col}
                        onClick={() => toggleCol(col)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-left font-medium transition-colors ${
                          selected
                            ? 'bg-amber-50/40 text-amber-800'
                            : 'text-slate-700 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selected ? (
                            <CheckSquare size={14} className="text-amber-600 shrink-0" />
                          ) : (
                            <Square size={14} className="text-slate-400 shrink-0" />
                          )}
                          <span className="truncate font-semibold text-slate-750">{col}</span>
                        </div>
                        {suggested && (
                          <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                            <Sparkles size={8} /> Suggested
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cleansing Rules Multi-Select */}
            <div className="lg:col-span-8 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    2. Select Cleansing Rules
                    {selectedRules.length > 0 && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {selectedRules.length}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Choose data transformations to apply.</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={selectAllRules}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold transition-colors"
                  >
                    Select All Rules
                  </button>
                  <button
                    onClick={clearRules}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold transition-colors"
                  >
                    Clear Rules
                  </button>
                </div>
              </div>

              {/* Rules Filter Bar */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search cleansing rules..."
                    value={ruleSearchTerm}
                    onChange={(e) => setRuleSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 bg-white text-slate-750 placeholder-slate-400"
                  />
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              {/* Rules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                {filteredRules.length === 0 ? (
                  <div className="col-span-full border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50 text-center text-xs text-slate-450 font-medium">
                    No cleansing rules found matching search
                  </div>
                ) : (
                  filteredRules.map(([key, details]) => {
                    const isSelected = selectedRules.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleRule(key)}
                        className={`flex items-start text-left p-3 rounded-xl border transition-all duration-200 group ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/30'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-3 transition-colors ${
                          isSelected
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}>
                          {getRuleIcon(details.iconName, 'shrink-0')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-800 truncate">{details.title}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded-full uppercase tracking-wider shrink-0">
                                {details.category}
                              </span>
                              {isSelected && (
                                <span className="bg-amber-100 text-amber-800 p-0.5 rounded-full shrink-0">
                                  <Check size={10} strokeWidth={3} />
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                            {details.description}
                          </p>
                          {details.example && (
                            <div className="text-[9px] font-mono text-slate-400 bg-slate-50/70 group-hover:bg-slate-100/50 rounded px-1.5 py-0.5 mt-1.5 inline-block">
                              <span className="text-slate-450">e.g.</span> {details.example}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Dynamic Parameter Settings */}
              {(selectedRules.includes('custom') || selectedRules.includes('null_fill')) && (
                <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3 animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Settings size={12} className="text-slate-500" />
                    Cleansing Rule Parameters
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRules.includes('null_fill') && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Null/Empty Fallback Value</label>
                        <input
                          type="text"
                          value={nullFillText}
                          onChange={(e) => {
                            setNullFillText(e.target.value);
                            setPreviewData(null);
                          }}
                          placeholder="e.g. Unknown"
                          className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-750 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>
                    )}
                    {selectedRules.includes('custom') && (
                      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200/60 pt-3 mt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Regex Pattern (Custom Find)</label>
                          <input
                            type="text"
                            value={customPattern}
                            onChange={(e) => {
                              setCustomPattern(e.target.value);
                              setPreviewData(null);
                            }}
                            placeholder="e.g. \\d+"
                            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-750 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Replacement Text</label>
                          <input
                            type="text"
                            value={customReplacement}
                            onChange={(e) => {
                              setCustomReplacement(e.target.value);
                              setPreviewData(null);
                            }}
                            placeholder="e.g. NUM"
                            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-750 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Global Normalization */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-705">Structural Normalization</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Strip leading/trailing whitespace, fix casing issues, and automatically fill empty values with "Unknown" across all columns.
                </p>
              </div>
              <button
                onClick={() => setNormalizeEnabled((p) => !p)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  normalizeEnabled ? 'bg-amber-500 shadow-sm shadow-amber-500/10' : 'bg-slate-300'
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

          {/* Action Trigger Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={applyRules}
              disabled={selectedCols.length === 0 && selectedRules.length === 0 && !normalizeEnabled}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} /> Preview Changes
            </button>
            
            {previewData && (
              <button
                onClick={confirmApply}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Check size={14} /> Apply to Dataset
              </button>
            )}

            {/* Selection Summary */}
            <div className="text-[11px] text-slate-500 font-semibold mt-1 sm:mt-0 sm:ml-auto">
              {selectedCols.length > 0 && selectedRules.length > 0 ? (
                <span>
                  Ready to apply <span className="text-amber-700 font-bold">{selectedRules.length} rules</span> to <span className="text-amber-700 font-bold">{selectedCols.length} columns</span>.
                </span>
              ) : (
                <span>No columns or rules selected yet.</span>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          {previewData && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex flex-wrap gap-2">
                {removedCount !== null && removedCount > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-1.5 text-xs text-amber-700 font-semibold shadow-sm">
                    <Trash2 size={13} className="text-amber-600" />
                    <span>{removedCount.toLocaleString()} duplicate row(s) will be dropped</span>
                  </div>
                )}
                {removedCount === 0 && selectedRules.includes('dedup') && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-xl px-3 py-1.5 text-xs text-emerald-800 font-semibold shadow-sm">
                    <Check size={13} className="text-emerald-600" />
                    <span>No duplicate rows found matching the subset columns</span>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200/60 rounded-xl px-3 py-1.5 text-xs text-blue-700 font-semibold shadow-sm">
                  <Info size={13} className="text-blue-600" />
                  <span>{previewData.length.toLocaleString()} row(s) after processing</span>
                </div>
              </div>
              
              <DataGrid
                rows={previewData}
                columns={columns}
                maxRows={5}
                title="Cleansing Preview (first 5 rows)"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
