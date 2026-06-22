import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Info, Plus, Trash2, Loader2 } from 'lucide-react';
import type { DataRow, StandardizationPair } from '../types';
import { getUniqueValues, applyColumnMapping } from '../utils/dataUtils';
import DataGrid from './DataGrid';
import { getSupabaseConfig } from '../utils/db';

export type AIProvider = 'groq' | 'openai' | 'anthropic' | 'gemini';

interface StandardizationRule {
  id: string;
  selectedCol: string;
  instruction: string;
  newColName: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  mappings: StandardizationPair[] | null;
  preset?: string;
  progressMsg?: string;
}

interface AIStandardizeModuleProps {
  data: DataRow[];
  columns: string[];
  onApply: (updated: DataRow[], newCols: string[]) => void;
  apiKeys: Record<AIProvider, string>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function parseJsonResponse(text: string): { mappings: StandardizationPair[] } {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("Could not parse response as JSON");
    parsed = JSON.parse(match[0]);
  }

  if (Array.isArray(parsed)) {
    return { mappings: parsed };
  }

  if (!parsed || !parsed.mappings || !Array.isArray(parsed.mappings)) {
    if (parsed && typeof parsed === 'object') {
      const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
      if (possibleArray) {
        return { mappings: possibleArray as StandardizationPair[] };
      }
    }
    throw new Error("Invalid response structure: 'mappings' array not found in JSON response");
  }

  return parsed as { mappings: StandardizationPair[] };
}

async function callAIDirectly(
  provider: AIProvider,
  apiKey: string,
  columnName: string,
  instruction: string,
  uniqueValues: string[],
  signal?: AbortSignal
): Promise<{ mappings: StandardizationPair[] }> {
  const prompt = `You are a data standardization engine. Your task is to map raw, messy values from a dataset column to clean, standardized values.

Column Name: "${columnName}"
Standardization Rule: ${instruction}

Here are the unique raw values to standardize:
${uniqueValues.map((v, i) => `${i + 1}. "${v}"`).join("\n")}

Return a JSON object with this exact structure:
{
  "mappings": [
    { "original_value": "<exact original value>", "standardized_value": "<clean standardized value>" },
    ...
  ]
}

Rules:
- Every input value must appear exactly once in the mappings as "original_value"
- "original_value" must be EXACTLY the raw value (case-sensitive, character-for-character match)
- "standardized_value" should follow the standardization rule
- Do not skip any values
- Return only the JSON object, nothing else`;

  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
        signal,
      }
    );
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${err}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseJsonResponse(text);
  } else if (provider === 'openai') {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a data cleansing assistant. Output data strictly in valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      }),
      signal,
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }
    const data = await response.json();
    const text = data.choices[0]?.message?.content || "";
    return parseJsonResponse(text);
  } else if (provider === 'groq') {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a data cleansing assistant. Output data strictly in valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      }),
      signal,
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${err}`);
    }
    const data = await response.json();
    const text = data.choices[0]?.message?.content || "";
    return parseJsonResponse(text);
  } else if (provider === 'anthropic') {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }
    const data = await response.json();
    const text = data.content[0]?.text || "";
    return parseJsonResponse(text);
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function AIStandardizeModule({ data, columns, onApply, apiKeys }: AIStandardizeModuleProps) {
  const [expanded, setExpanded] = useState(true);
  const [provider, setProvider] = useState<AIProvider>('groq');
  const [rules, setRules] = useState<StandardizationRule[]>([]);
  const [previewData, setPreviewData] = useState<DataRow[] | null>(null);
  const [running, setRunning] = useState(false);

  function addRule() {
    const newRule: StandardizationRule = {
      id: generateId(),
      selectedCol: '',
      instruction: '',
      newColName: '',
      status: 'idle',
      error: null,
      mappings: null,
      preset: 'custom',
    };
    setRules((prev) => [...prev, newRule]);
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRule(id: string, updates: Partial<StandardizationRule>) {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        if (updates.selectedCol !== undefined) {
          updated.newColName = updates.selectedCol ? `${updates.selectedCol}_Cleaned` : '';
          updated.mappings = null;
          updated.error = null;
          updated.status = 'idle';
        }
        if (updates.preset !== undefined) {
          if (updates.preset === 'translate_es') {
            updated.instruction = 'Translate the content of this column into Spanish';
          } else if (updates.preset === 'sentiment') {
            updated.instruction = 'Analyze the sentiment of this text. Categorize it as Positive, Neutral, or Negative.';
          } else if (updates.preset === 'summarize') {
            updated.instruction = 'Provide a concise summary of this text in 10 words or less.';
          } else if (updates.preset === 'intro') {
            updated.instruction = 'Generate a highly personalized, brief cold email intro line based on this value.';
          } else if (updates.preset === 'custom') {
            updated.instruction = '';
          }
          updated.mappings = null;
          updated.error = null;
          updated.status = 'idle';
        }
        if (updates.instruction !== undefined) {
          updated.mappings = null;
          updated.error = null;
          updated.status = 'idle';
        }
        return updated;
      })
    );
  }

  async function runStandardizationForRule(
    rule: StandardizationRule,
    onProgress?: (msg: string) => void
  ): Promise<StandardizationRule> {
    if (!rule.selectedCol || !rule.instruction.trim() || !apiKeys[provider]) {
      return { ...rule, status: 'error', error: 'Missing column, instruction, or API key' };
    }

    const uniqueVals = getUniqueValues(data, rule.selectedCol);
    const BATCH_SIZE = 30;
    const batches: string[][] = [];
    for (let i = 0; i < uniqueVals.length; i += BATCH_SIZE) {
      batches.push(uniqueVals.slice(i, i + BATCH_SIZE));
    }

    const allMappings: StandardizationPair[] = [];

    try {
      const config = getSupabaseConfig();
      const finalUrl = config.url || SUPABASE_URL;
      const finalAnonKey = config.anonKey || SUPABASE_ANON_KEY;
      const hasSupabaseUrl = finalUrl && finalUrl.includes('http') && !finalUrl.includes('your-project');

      for (let b = 0; b < batches.length; b++) {
        const chunk = batches[b];
        if (onProgress) {
          onProgress(`Batch ${b + 1} of ${batches.length}...`);
        }

        // Delay between batches to avoid rate limit issues
        if (b > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          let resultData: { mappings: StandardizationPair[] };

          if (hasSupabaseUrl) {
            try {
              const response = await fetch(
                `${finalUrl}/functions/v1/ai-standardize`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${finalAnonKey}`,
                    'apikey': finalAnonKey,
                  },
                  body: JSON.stringify({
                    provider,
                    api_key: apiKeys[provider],
                    unique_values: chunk,
                    column_name: rule.selectedCol,
                    instruction: rule.instruction.trim(),
                  }),
                  signal: controller.signal,
                }
              );

              if (!response.ok) {
                const err = await response.text();
                throw new Error(err || `Request failed with status ${response.status}`);
              }

              resultData = await response.json();
            } catch (supabaseErr) {
              console.warn("Supabase function request failed. Trying direct client-side fallback connection...", supabaseErr);
              resultData = await callAIDirectly(
                provider,
                apiKeys[provider],
                rule.selectedCol,
                rule.instruction.trim(),
                chunk,
                controller.signal
              );
            }
          } else {
            // Bypass Supabase and call directly
            resultData = await callAIDirectly(
              provider,
              apiKeys[provider],
              rule.selectedCol,
              rule.instruction.trim(),
              chunk,
              controller.signal
            );
          }

          const mappings: StandardizationPair[] = resultData.mappings || [];
          allMappings.push(...mappings);
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'AbortError') {
            throw new Error(`Batch ${b + 1} request timed out after 30 seconds.`);
          }
          throw e;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      return { ...rule, status: 'success', mappings: allMappings, error: null, progressMsg: undefined };
    } catch (e: unknown) {
      return { ...rule, status: 'error', error: e instanceof Error ? e.message : 'Unknown error', progressMsg: undefined };
    }
  }

  async function runAllRules() {
    if (rules.length === 0) return;
    setRunning(true);

    const runningRules = rules.map((r) => ({ ...r, status: 'loading' as const, error: null, progressMsg: 'Starting...' }));
    setRules(runningRules);

    const results = await Promise.all(
      runningRules.map((r) =>
        runStandardizationForRule(r, (msg) => {
          setRules((prev) =>
            prev.map((item) => (item.id === r.id ? { ...item, progressMsg: msg } : item))
          );
        })
      )
    );

    setRules(results);

    const allSuccess = results.every((r) => r.status === 'success' && r.mappings);
    if (allSuccess) {
      let updatedData = [...data];
      const newColNames: string[] = [];

      for (const rule of results) {
        if (!rule.mappings) continue;
        const mapping: Record<string, string> = {};
        for (const p of rule.mappings) {
          mapping[p.original_value] = p.standardized_value;
        }
        const colName = rule.newColName.trim() || `${rule.selectedCol}_Cleaned`;
        updatedData = applyColumnMapping(updatedData, rule.selectedCol, colName, mapping);
        newColNames.push(colName);
      }

      setPreviewData(updatedData);
    }

    setRunning(false);
  }

  function confirmApply() {
    if (previewData) {
      const newColNames = rules
        .filter((r) => r.status === 'success')
        .map((r) => r.newColName.trim() || `${r.selectedCol}_Cleaned`);
      onApply(previewData, newColNames);
      setRules([]);
      setPreviewData(null);
    }
  }

  function clearAll() {
    setRules([]);
    setPreviewData(null);
  }

  const hasApiKey = !!apiKeys[provider];
  const hasValidRules = rules.some((r) => r.selectedCol && r.instruction.trim());
  const uniqueCounts: Record<string, number> = {};
  for (const col of columns) {
    uniqueCounts[col] = getUniqueValues(data, col).length;
  }

  const allPreviewCols = previewData
    ? [...columns, ...rules.filter((r) => r.status === 'success').map((r) => r.newColName.trim() || `${r.selectedCol}_Cleaned`)].filter((c, i, arr) => arr.indexOf(c) === i)
    : columns;

  const newCols = rules
    .filter((r) => r.status === 'success')
    .map((r) => r.newColName.trim() || `${r.selectedCol}_Cleaned`);

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 border-l-4 border-l-violet-500 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shadow-sm">
            <Sparkles size={16} className="text-violet-600" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-slate-800 text-sm">Module 3: AI Taxonomy Standardization</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">AI-powered contextual normalization with multi-provider support</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-605">AI Provider</label>
            <div className="flex flex-wrap gap-2">
              {(['groq', 'openai', 'anthropic', 'gemini'] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    provider === p
                      ? 'border-violet-500 bg-violet-50/50 text-violet-700 shadow-sm shadow-violet-500/5'
                      : 'border-slate-200 bg-white text-slate-650 hover:border-violet-300'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            {!hasApiKey && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>Enter your {provider.charAt(0).toUpperCase() + provider.slice(1)} API key in the header to enable AI standardization.</span>
              </div>
            )}
          </div>

          {/* Rules List */}
          {rules.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Standardization Rules ({rules.length})</span>
                <button
                  onClick={clearAll}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                >
                  Clear All
                </button>
              </div>

              {rules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Rule {idx + 1}</span>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Source Column</label>
                      <select
                        value={rule.selectedCol}
                        onChange={(e) => updateRule(rule.id, { selectedCol: e.target.value })}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      >
                        <option value="">Select...</option>
                        {columns.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {rule.selectedCol && (
                        <p className="text-xs text-slate-500 mt-1">
                          <span className="font-semibold text-blue-600">{uniqueCounts[rule.selectedCol] || 0}</span> unique values
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">AI Task Preset</label>
                      <select
                        value={rule.preset || 'custom'}
                        onChange={(e) => updateRule(rule.id, { preset: e.target.value })}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      >
                        <option value="custom">Custom Instruction</option>
                        <option value="translate_es">Translate to Spanish</option>
                        <option value="sentiment">Sentiment Analysis</option>
                        <option value="summarize">Text Summarization</option>
                        <option value="intro">Generate Cold Intro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">New Column Name</label>
                      <input
                        type="text"
                        value={rule.newColName}
                        onChange={(e) => updateRule(rule.id, { newColName: e.target.value })}
                        placeholder={rule.selectedCol ? `${rule.selectedCol}_Cleaned` : 'Output column...'}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                    </div>

                    <div className="col-span-1 flex items-center justify-end pt-5">
                      {rule.status === 'loading' && (
                        <div className="flex items-center gap-1.5 text-xs text-violet-600">
                          <Loader2 size={12} className="animate-spin" />
                          {rule.progressMsg || 'Processing...'}
                        </div>
                      )}
                      {rule.status === 'success' && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <CheckCircle2 size={12} />
                          {rule.mappings?.length || 0} mapped
                        </div>
                      )}
                      {rule.status === 'error' && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600">
                          <AlertCircle size={12} />
                          Failed
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Standardization Instruction</label>
                    <textarea
                      value={rule.instruction}
                      onChange={(e) => updateRule(rule.id, { instruction: e.target.value })}
                      placeholder='e.g. "Normalize to standard industries: Technology, Healthcare, Finance, Retail, Manufacturing, Other"'
                      rows={2}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>

                  {rule.error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                      <span>{rule.error}</span>
                    </div>
                  )}

                  {rule.mappings && rule.mappings.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-slate-600 font-semibold">Original</th>
                            <th className="px-3 py-2 text-left text-slate-400 w-6">→</th>
                            <th className="px-3 py-2 text-left text-emerald-700 font-semibold">Standardized</th>
                          </tr>
                        </thead>
                        <tbody className="max-h-32 overflow-y-auto">
                          {rule.mappings.slice(0, 10).map((m, i) => (
                            <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                              <td className="px-3 py-1.5 text-slate-600 truncate max-w-[120px]">{m.original_value}</td>
                              <td className="px-3 py-1.5 text-slate-400">→</td>
                              <td className="px-3 py-1.5 text-emerald-700 font-medium truncate max-w-[120px]">{m.standardized_value}</td>
                            </tr>
                          ))}
                          {rule.mappings.length > 10 && (
                            <tr className="bg-slate-50">
                              <td colSpan={3} className="px-3 py-1.5 text-slate-500 text-center">
                                +{rule.mappings.length - 10} more mappings
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Rule Button */}
          <button
            onClick={addRule}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 text-slate-600 text-xs font-semibold rounded-xl hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 transition-all"
          >
            <Plus size={14} />
            Add Standardization Rule
          </button>

          {/* Run Button */}
          {rules.length > 0 && (
            <button
              onClick={runAllRules}
              disabled={!hasApiKey || !hasValidRules || running}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {running ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Running {rules.filter((r) => r.status === 'loading').length} of {rules.length}...
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Run All Standardizations
                </>
              )}
            </button>
          )}

          {/* Preview & Apply */}
          {previewData && newCols.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <CheckCircle2 size={16} className="text-emerald-600" />
                All rules completed successfully! ({newCols.length} new columns created)
              </div>

              <DataGrid
                rows={previewData}
                columns={allPreviewCols}
                maxRows={5}
                highlightCols={newCols}
                title={`Preview with ${newCols.length} new column${newCols.length > 1 ? 's' : ''} (first 5 rows)`}
                subtitle="Original columns are preserved untouched"
              />

              <button
                onClick={confirmApply}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Apply All to Dataset
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
