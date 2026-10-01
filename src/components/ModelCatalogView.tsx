import React, { useState } from 'react';
import { MODEL_CATALOG, ModelSpec, ProviderId } from '../types/chat';
import { Check, ArrowUpRight, Search } from 'lucide-react';

interface ModelCatalogViewProps {
  selectedModelId: string;
  onSelectModel: (model: ModelSpec) => void;
}

export const ModelCatalogView: React.FC<ModelCatalogViewProps> = ({
  selectedModelId,
  onSelectModel,
}) => {
  const [providerFilter, setProviderFilter] = useState<'all' | ProviderId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModels = MODEL_CATALOG.filter((m) => {
    const matchesProvider = providerFilter === 'all' || m.provider === providerFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.specialization.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q);
    return matchesProvider && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Inference Model Catalog
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Compare supported NVIDIA NIM microservices and Google Gemini models across context window, token ceilings, and reasoning traces.
          </p>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 my-6">
        <div className="flex items-center gap-1 p-1 bg-[#0F1522] border border-slate-800/80 rounded-lg">
          <button
            type="button"
            onClick={() => setProviderFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              providerFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Providers ({MODEL_CATALOG.length})
          </button>
          <button
            type="button"
            onClick={() => setProviderFilter('nvidia')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              providerFilter === 'nvidia'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            NVIDIA NIM ({MODEL_CATALOG.filter((m) => m.provider === 'nvidia').length})
          </button>
          <button
            type="button"
            onClick={() => setProviderFilter('gemini')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              providerFilter === 'gemini'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Google Gemini ({MODEL_CATALOG.filter((m) => m.provider === 'gemini').length})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by model ID or domain..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0F1522] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* High-Density Comparison Table */}
      <div className="rounded-lg border border-slate-800 bg-[#0F1522]/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0D121D] text-xs font-medium text-slate-400">
                <th className="py-3 px-4">Model & Identifier</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Primary Specialization</th>
                <th className="py-3 px-4 text-right">Context Tokens</th>
                <th className="py-3 px-4 text-right">Max Output</th>
                <th className="py-3 px-4 text-right">Default Temp</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredModels.map((model) => {
                const isSelected = model.id === selectedModelId;
                return (
                  <tr
                    key={model.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-emerald-500/5' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-sm">{model.name}</div>
                      <div className="font-mono text-xs text-slate-400 mt-0.5">{model.id}</div>
                      <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
                        {model.description}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <span className="text-xs text-slate-300 font-medium">
                        {model.providerLabel}
                      </span>
                      {model.supportsReasoning && (
                        <div className="text-[11px] text-emerald-400 mt-0.5">
                          Chain-of-Thought
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 align-top text-xs text-slate-300">
                      {model.specialization}
                    </td>
                    <td className="py-3.5 px-4 align-top text-right font-mono text-xs text-slate-200 tabular-nums whitespace-nowrap">
                      {model.contextWindow}
                    </td>
                    <td className="py-3.5 px-4 align-top text-right font-mono text-xs text-slate-200 tabular-nums whitespace-nowrap">
                      {model.maxOutputTokens.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 align-top text-right font-mono text-xs text-slate-200 tabular-nums whitespace-nowrap">
                      {model.recommendedTemp.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectModel(model)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <span>Use Model</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
