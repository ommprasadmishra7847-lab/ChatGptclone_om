import React, { useState } from 'react';
import { PromptTemplate, MODEL_CATALOG } from '../types/chat';
import { Search, Plus, ArrowUpRight, Trash2, X } from 'lucide-react';

interface PromptLibraryViewProps {
  templates: PromptTemplate[];
  onSelectTemplate: (template: PromptTemplate) => void;
  onAddTemplate: (template: PromptTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}

const CATEGORIES: Array<'All' | PromptTemplate['category']> = [
  'All',
  'Architecture',
  'Coding',
  'Reasoning',
  'Data',
  'Writing',
];

export const PromptLibraryView: React.FC<PromptLibraryViewProps> = ({
  templates,
  onSelectTemplate,
  onAddTemplate,
  onDeleteTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | PromptTemplate['category']>('All');
  const [isCreating, setIsCreating] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<PromptTemplate['category']>('Coding');
  const [newDescription, setNewDescription] = useState('');
  const [newSystemInstruction, setNewSystemInstruction] = useState('');
  const [newStarterPrompt, setNewStarterPrompt] = useState('');
  const [newModelId, setNewModelId] = useState(MODEL_CATALOG[0].id);

  const filtered = templates.filter((tpl) => {
    const matchesCat = activeCategory === 'All' || tpl.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tpl.title.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.starterPrompt.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStarterPrompt.trim()) return;

    const created: PromptTemplate = {
      id: `tpl-custom-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      description: newDescription.trim() || 'Custom engineering workflow prompt.',
      systemInstruction:
        newSystemInstruction.trim() ||
        'You are a senior technical specialist. Provide structured, accurate responses.',
      starterPrompt: newStarterPrompt.trim(),
      recommendedModelId: newModelId,
    };

    onAddTemplate(created);
    setNewTitle('');
    setNewDescription('');
    setNewSystemInstruction('');
    setNewStarterPrompt('');
    setIsCreating(false);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Prompt & System Personas
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Curated system instructions and starter prompts paired with optimal NVIDIA NIM and Gemini inference models.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
        >
          {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isCreating ? 'Cancel' : 'New Prompt Template'}</span>
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="my-6 p-5 rounded-lg border border-slate-800 bg-[#0F1522] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Create Reusable Prompt Workflow</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Template Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Rust Memory Safety Auditor"
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as PromptTemplate['category'])}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Architecture">Architecture</option>
                <option value="Coding">Coding</option>
                <option value="Reasoning">Reasoning</option>
                <option value="Data">Data</option>
                <option value="Writing">Writing</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Target Model</label>
              <select
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {MODEL_CATALOG.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.providerLabel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Short Description</label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Concise summary of what this persona solves..."
              className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">System Instruction</label>
              <textarea
                rows={3}
                value={newSystemInstruction}
                onChange={(e) => setNewSystemInstruction(e.target.value)}
                placeholder="You are a Principal Systems Engineer..."
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Starter Prompt</label>
              <textarea
                rows={3}
                required
                value={newStarterPrompt}
                onChange={(e) => setNewStarterPrompt(e.target.value)}
                placeholder="Enter the initial prompt to execute..."
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Save Template
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 my-6">
        <div className="flex items-center gap-1 p-1 bg-[#0F1522] border border-slate-800/80 rounded-lg overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0F1522] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center border border-slate-800/70 rounded-lg bg-[#0F1522]/40">
          <p className="text-sm text-slate-400">No prompt templates match your current filter.</p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('All');
              setSearchQuery('');
            }}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((tpl) => {
            const modelObj = MODEL_CATALOG.find((m) => m.id === tpl.recommendedModelId);
            const isCustom = tpl.id.startsWith('tpl-custom-');

            return (
              <div
                key={tpl.id}
                className="p-5 rounded-lg border border-slate-800/90 bg-[#0F1522]/80 hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  {/* Quiet unboxed metadata line */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-2">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-emerald-400">{tpl.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{modelObj ? modelObj.name : tpl.recommendedModelId}</span>
                    </div>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => onDeleteTemplate(tpl.id)}
                        title="Delete custom template"
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-white">{tpl.title}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{tpl.description}</p>

                  <div className="mt-4 pt-3 border-t border-slate-800/70">
                    <p className="text-[11px] text-slate-500 mb-1">Starter Prompt</p>
                    <p className="text-xs text-slate-300 font-mono line-clamp-2 leading-relaxed">
                      "{tpl.starterPrompt}"
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-800/70">
                  <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                    {tpl.recommendedModelId}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectTemplate(tpl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    <span>Launch Thread</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
