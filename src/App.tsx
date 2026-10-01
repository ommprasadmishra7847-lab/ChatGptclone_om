/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MODEL_CATALOG,
  DEFAULT_PROMPT_TEMPLATES,
  ModelSpec,
  ConversationThread,
  ChatMessage,
  ChatRuntimeConfig,
  PromptTemplate,
  AttachmentItem,
  ServerProviderStatus,
  ProviderId,
} from './types/chat';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { PromptLibraryView } from './components/PromptLibraryView';
import { ModelCatalogView } from './components/ModelCatalogView';
import { ApiIntegrationView } from './components/ApiIntegrationView';
import {
  Plus,
  Search,
  Send,
  Square,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  Trash2,
  Pin,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Download,
  Menu,
  X,
  Volume2,
  VolumeX,
  Sliders,
  FileText,
} from 'lucide-react';

type ActiveNavTab = 'workspace' | 'prompts' | 'models' | 'api';

const STORAGE_KEY_THREADS = 'kinetix_threads_v1';
const STORAGE_KEY_TEMPLATES = 'kinetix_templates_v1';

const DEFAULT_CONFIG: ChatRuntimeConfig = {
  systemInstruction:
    'You are a precise, helpful AI assistant. Format technical explanations and code clearly using Markdown.',
  temperature: 0.6,
  topP: 0.95,
  maxTokens: 4096,
  enableReasoningTrace: false,
  autoFallbackWhenKeyUnset: true,
};

function createInitialThread(model: ModelSpec = MODEL_CATALOG[0]): ConversationThread {
  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Conversation',
    modelId: model.id,
    provider: model.provider,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    messages: [],
    config: {
      ...DEFAULT_CONFIG,
      temperature: model.recommendedTemp,
      enableReasoningTrace: model.supportsReasoning,
    },
  };
}

const STARTER_PROMPTS = [
  {
    category: 'Distributed Systems',
    title: 'Design an LLM inference router across NVIDIA NIM & Gemini',
    prompt:
      'Design a fault-tolerant TypeScript API gateway that routes streaming chat requests across NVIDIA NIM microservices and Google Gemini with automatic circuit breaking and token rate limiting.',
  },
  {
    category: 'Interactive Artifact',
    title: 'Build a self-contained HTML/Canvas particle physics simulator',
    prompt:
      'Write a complete, single-file HTML5 Canvas interactive orbital gravity simulator with dark studio UI controls to spawn planets and adjust gravitational constant G in real time.',
  },
  {
    category: 'Quantitative Reasoning',
    title: 'Compare KV-cache memory footprint for 70B models',
    prompt:
      'Calculate and compare the exact KV-cache VRAM requirements (in GB) for Llama 3.3 70B using FP16 vs FP8 quantization across batch sizes 1, 8, and 32 at 32K context length. Present a Markdown table.',
  },
  {
    category: 'SQL & Data Engineering',
    title: 'Optimize a high-ingestion time-series schema',
    prompt:
      'Write an optimized PostgreSQL schema and indexing strategy for storing real-time GPU cluster telemetry (utilization, temperature, power draw, token throughput) with fast 5-minute rollups.',
  },
];

export default function App() {
  const [activeNav, setActiveNav] = useState<ActiveNavTab>('workspace');
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  // Threads state persisted in localStorage
  const [threads, setThreads] = useState<ConversationThread[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_THREADS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [createInitialThread(MODEL_CATALOG[0])];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => threads[0]?.id || '');

  // Prompt templates state
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROMPT_TEMPLATES;
  });

  // Server provider status
  const [providerStatus, setProviderStatus] = useState<ServerProviderStatus>({
    nvidiaConfigured: false,
    nvidiaBaseUrl: 'https://integrate.api.nvidia.com/v1',
    geminiConfigured: true,
  });

  // Sidebar search & filter
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarProviderFilter, setSidebarProviderFilter] = useState<'all' | ProviderId>('all');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState('');

  // Composer state
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});
  const [showSystemDrawer, setShowSystemDrawer] = useState(false);

  // Inline message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeThread =
    threads.find((t) => t.id === activeThreadId) || threads[0] || createInitialThread();

  const activeModel =
    MODEL_CATALOG.find((m) => m.id === activeThread.modelId) || MODEL_CATALOG[0];

  // Save threads & templates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(threads));
    } catch {
      // ignore quota errors
    }
  }, [threads]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
    } catch {
      // ignore
    }
  }, [templates]);

  // Check server provider configuration on mount
  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data: ServerProviderStatus) => {
        if (data && typeof data.nvidiaConfigured === 'boolean') {
          setProviderStatus(data);
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread.messages.length, isStreaming]);

  // Auto-resize composer textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputPrompt]);

  const updateThreadById = (
    threadId: string,
    updater: (prev: ConversationThread) => ConversationThread
  ) => {
    setThreads((prevThreads) =>
      prevThreads.map((t) => (t.id === threadId ? updater(t) : t))
    );
  };

  const handleCreateNewThread = (customModel?: ModelSpec, customSystemInstruction?: string) => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    const targetModel = customModel || activeModel;
    const fresh = createInitialThread(targetModel);
    if (customSystemInstruction) {
      fresh.config.systemInstruction = customSystemInstruction;
    }
    setThreads((prev) => [fresh, ...prev]);
    setActiveThreadId(fresh.id);
    setActiveNav('workspace');
    setSidebarOpenMobile(false);
    setInputPrompt('');
    setAttachments([]);
  };

  const handleSelectModel = (model: ModelSpec) => {
    updateThreadById(activeThread.id, (t) => ({
      ...t,
      modelId: model.id,
      provider: model.provider,
      config: {
        ...t.config,
        temperature: model.recommendedTemp,
        enableReasoningTrace: model.supportsReasoning,
      },
    }));
    setActiveNav('workspace');
  };

  const handleDeleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const fallback = createInitialThread(activeModel);
        setActiveThreadId(fallback.id);
        return [fallback];
      }
      if (activeThreadId === id) {
        setActiveThreadId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleTogglePinThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateThreadById(id, (t) => ({ ...t, pinned: !t.pinned }));
  };

  const handleStartRenameThread = (thread: ConversationThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditingThreadTitle(thread.title);
  };

  const handleSaveRenameThread = (id: string) => {
    if (editingThreadTitle.trim()) {
      updateThreadById(id, (t) => ({ ...t, title: editingThreadTitle.trim() }));
    }
    setEditingThreadId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        newAttachments.push({
          id: `att-${Date.now()}-${i}`,
          name: file.name,
          type: 'image',
          mimeType: file.type || 'image/png',
          content: base64,
          sizeBytes: file.size,
        });
      } else {
        const text = await file.text();
        newAttachments.push({
          id: `att-${Date.now()}-${i}`,
          name: file.name,
          type: 'code',
          mimeType: file.type || 'text/plain',
          content: text.slice(0, 40000),
          sizeBytes: file.size,
        });
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const generateThreadTitle = async (threadId: string, firstPrompt: string) => {
    try {
      const res = await fetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstPrompt }),
      });
      const data = await res.json();
      if (data?.title) {
        updateThreadById(threadId, (t) => ({ ...t, title: data.title }));
      }
    } catch {
      // fallback already handled
    }
  };

  const executeChatTurn = async (
    targetThreadId: string,
    historyMessages: ChatMessage[],
    model: ModelSpec,
    config: ChatRuntimeConfig
  ) => {
    const assistantMsgId = `msg-ai-${Date.now()}`;
    const startTime = performance.now();

    const placeholderAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      createdAt: Date.now(),
      modelId: model.id,
      provider: model.provider,
      isStreaming: true,
    };

    updateThreadById(targetThreadId, (t) => ({
      ...t,
      updatedAt: Date.now(),
      messages: [...historyMessages, placeholderAssistantMsg],
    }));

    if (config.enableReasoningTrace || model.supportsReasoning) {
      setExpandedReasoningIds((prev) => ({ ...prev, [assistantMsgId]: true }));
    }

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = '';
    let accumulatedReasoning = '';
    let wasBridged = false;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          modelId: model.id,
          provider: model.provider,
          config,
          messages: historyMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(errText || `HTTP Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'reasoning' && typeof event.text === 'string') {
              accumulatedReasoning += event.text;
            } else if (event.type === 'content' && typeof event.text === 'string') {
              accumulatedContent += event.text;
            } else if (event.type === 'done') {
              wasBridged = Boolean(event.bridgedViaGemini);
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Stream error');
            }

            const elapsed = Math.round(performance.now() - startTime);
            const estTokens = Math.max(
              1,
              Math.round((accumulatedContent.length + accumulatedReasoning.length) / 4)
            );

            updateThreadById(targetThreadId, (t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: accumulatedContent,
                      reasoning: accumulatedReasoning || undefined,
                      latencyMs: elapsed,
                      tokenEstimate: estTokens,
                      bridgedViaGemini: wasBridged,
                    }
                  : m
              ),
            }));
          } catch (innerErr) {
            if (innerErr instanceof Error && innerErr.message !== 'Unexpected end of JSON input') {
              throw innerErr;
            }
          }
        }
      }

      const totalLatency = Math.round(performance.now() - startTime);
      const finalTokens = Math.max(
        1,
        Math.round((accumulatedContent.length + accumulatedReasoning.length) / 4)
      );

      updateThreadById(targetThreadId, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: t.messages.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: accumulatedContent || 'Response completed.',
                reasoning: accumulatedReasoning || undefined,
                latencyMs: totalLatency,
                tokenEstimate: finalTokens,
                bridgedViaGemini: wasBridged,
                isStreaming: false,
              }
            : m
        ),
      }));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateThreadById(targetThreadId, (t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: accumulatedContent || 'Generation stopped by user.',
                  isStreaming: false,
                }
              : m
          ),
        }));
      } else {
        const errMessage = err instanceof Error ? err.message : 'Failed to generate response.';
        updateThreadById(targetThreadId, (t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: accumulatedContent,
                  error: errMessage,
                  isStreaming: false,
                }
              : m
          ),
        }));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendPrompt = async (overrideText?: string) => {
    const textToSend = (overrideText !== undefined ? overrideText : inputPrompt).trim();
    if ((!textToSend && attachments.length === 0) || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      createdAt: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const isFirstMessage = activeThread.messages.length === 0;
    const nextHistory = [...activeThread.messages, userMsg];

    if (overrideText === undefined) {
      setInputPrompt('');
    }
    setAttachments([]);

    if (isFirstMessage && textToSend) {
      const quickTitle = textToSend.split(/\s+/).slice(0, 5).join(' ').slice(0, 46);
      updateThreadById(activeThread.id, (t) => ({ ...t, title: quickTitle }));
      generateThreadTitle(activeThread.id, textToSend);
    }

    await executeChatTurn(activeThread.id, nextHistory, activeModel, activeThread.config);
  };

  const handleRegenerateFromAssistantIndex = async (assistantIndex: number) => {
    if (isStreaming) return;
    const historyUpToUser = activeThread.messages.slice(0, assistantIndex);
    if (historyUpToUser.length === 0) return;
    await executeChatTurn(activeThread.id, historyUpToUser, activeModel, activeThread.config);
  };

  const handleSaveEditedUserMessage = async (msgIndex: number) => {
    const trimmed = editingMessageContent.trim();
    if (!trimmed || isStreaming) return;

    const updatedUserMsg: ChatMessage = {
      ...activeThread.messages[msgIndex],
      content: trimmed,
      createdAt: Date.now(),
    };

    const historyBranch = [...activeThread.messages.slice(0, msgIndex), updatedUserMsg];
    setEditingMessageId(null);
    setEditingMessageContent('');

    await executeChatTurn(activeThread.id, historyBranch, activeModel, activeThread.config);
  };

  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleToggleSpeak = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted.').replace(/[#*_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleExportThreadMarkdown = () => {
    const lines: string[] = [
      `# ${activeThread.title}`,
      `Model: ${activeModel.name} (${activeModel.id}) · Provider: ${activeModel.providerLabel}`,
      `Exported: ${new Date().toISOString()}`,
      '',
      '---',
      '',
    ];

    for (const m of activeThread.messages) {
      lines.push(`### ${m.role === 'user' ? 'User' : activeModel.name}`);
      if (m.reasoning) {
        lines.push(`> **Reasoning Trace:** ${m.reasoning.replace(/\n/g, '\n> ')}\n`);
      }
      lines.push(m.content);
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeThread.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'conversation'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLaunchTemplate = (tpl: PromptTemplate) => {
    const targetModel =
      MODEL_CATALOG.find((m) => m.id === tpl.recommendedModelId) || MODEL_CATALOG[0];
    const newThread = createInitialThread(targetModel);
    newThread.title = tpl.title;
    newThread.config.systemInstruction = tpl.systemInstruction;

    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setActiveNav('workspace');

    setTimeout(() => {
      const userMsg: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content: tpl.starterPrompt,
        createdAt: Date.now(),
      };
      executeChatTurn(newThread.id, [userMsg], targetModel, newThread.config);
    }, 30);
  };

  // Filtered sidebar threads
  const filteredThreads = threads
    .filter((t) => {
      const matchesProvider =
        sidebarProviderFilter === 'all' || t.provider === sidebarProviderFilter;
      const q = sidebarSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q));
      return matchesProvider && matchesSearch;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0B0F17] text-slate-100 select-none sm:select-auto">
      {/* TOP BAR CONTRACT: Strictly 3 Zones (Brand Wordmark — 4 Nav Links — 2 Primary Actions) */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-slate-800/80 bg-[#0B0F17]/95 z-30">
        {/* Zone 1: Single text element wordmark (with mobile menu button on small screens) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpenMobile((prev) => !prev)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            aria-label="Toggle conversation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              setActiveNav('workspace');
            }}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap"
          >
            Kinetix
          </a>
        </div>

        {/* Zone 2: 4 Clean Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveNav('workspace')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeNav === 'workspace'
                ? 'text-white underline underline-offset-8 decoration-emerald-400 decoration-2'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Workspace
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('prompts')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeNav === 'prompts'
                ? 'text-white underline underline-offset-8 decoration-emerald-400 decoration-2'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Prompt Library
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('models')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeNav === 'models'
                ? 'text-white underline underline-offset-8 decoration-emerald-400 decoration-2'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Model Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('api')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeNav === 'api'
                ? 'text-white underline underline-offset-8 decoration-emerald-400 decoration-2'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            API Spec
          </button>
        </nav>

        {/* Zone 3: 2 Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportThreadMarkdown}
            disabled={activeThread.messages.length === 0}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0F1522] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            type="button"
            onClick={() => handleCreateNewThread()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Thread</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Sub-bar */}
      <div className="flex md:hidden items-center justify-around border-b border-slate-800/80 bg-[#0D121C] px-2 py-1.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveNav('workspace')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeNav === 'workspace' ? 'text-emerald-400 bg-slate-800/70' : 'text-slate-400'
          }`}
        >
          Workspace
        </button>
        <button
          type="button"
          onClick={() => setActiveNav('prompts')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeNav === 'prompts' ? 'text-emerald-400 bg-slate-800/70' : 'text-slate-400'
          }`}
        >
          Prompts
        </button>
        <button
          type="button"
          onClick={() => setActiveNav('models')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeNav === 'models' ? 'text-emerald-400 bg-slate-800/70' : 'text-slate-400'
          }`}
        >
          Models
        </button>
        <button
          type="button"
          onClick={() => setActiveNav('api')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeNav === 'api' ? 'text-emerald-400 bg-slate-800/70' : 'text-slate-400'
          }`}
        >
          API Spec
        </button>
      </div>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpenMobile && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={() => setSidebarOpenMobile(false)}
          />
        )}

        {/* Left Sidebar (268px width) */}
        <aside
          className={`w-[268px] shrink-0 border-r border-slate-800/80 bg-[#0D121D] flex flex-col justify-between z-40 transition-transform duration-150 ease-out ${
            sidebarOpenMobile
              ? 'fixed inset-y-0 left-0 translate-x-0'
              : 'fixed inset-y-0 left-0 -translate-x-full lg:static lg:translate-x-0'
          }`}
        >
          {/* Top Search & Provider Filter */}
          <div className="p-3.5 space-y-3 border-b border-slate-800/80">
            <div className="flex items-center justify-between lg:hidden pb-1">
              <span className="text-xs font-semibold text-slate-300">Conversation History</span>
              <button
                type="button"
                onClick={() => setSidebarOpenMobile(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search threads..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#0B0F17] border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B0F17] border border-slate-800/80 rounded-lg">
              {(['all', 'nvidia', 'gemini'] as const).map((prov) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => setSidebarProviderFilter(prov)}
                  className={`py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    sidebarProviderFilter === prov
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {prov === 'all' ? 'All' : prov === 'nvidia' ? 'NVIDIA' : 'Gemini'}
                </button>
              ))}
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {filteredThreads.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="text-xs text-slate-500">No conversations match your filter.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = thread.id === activeThread.id;
                const isEditing = editingThreadId === thread.id;

                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      setActiveNav('workspace');
                      setSidebarOpenMobile(false);
                    }}
                    className={`group rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-800/90 text-white'
                        : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingThreadTitle}
                        onChange={(e) => setEditingThreadTitle(e.target.value)}
                        onBlur={() => handleSaveRenameThread(thread.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRenameThread(thread.id);
                          if (e.key === 'Escape') setEditingThreadId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-0.5 bg-[#0B0F17] border border-emerald-500 rounded text-xs text-white focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{thread.title}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleTogglePinThread(thread.id, e)}
                            title={thread.pinned ? 'Unpin' : 'Pin'}
                            className={`p-0.5 rounded hover:text-white ${
                              thread.pinned ? 'text-emerald-400 opacity-100' : 'text-slate-400'
                            }`}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleStartRenameThread(thread, e)}
                            title="Rename"
                            className="p-0.5 rounded text-slate-400 hover:text-white"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteThread(thread.id, e)}
                            title="Delete"
                            className="p-0.5 rounded text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quiet unboxed metadata line */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-mono tabular-nums truncate">
                      {thread.pinned && (
                        <>
                          <span className="text-emerald-400">Pinned</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span>{thread.provider === 'nvidia' ? 'NIM' : 'Gemini'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{thread.messages.length} msgs</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer: Active Runtime Summary */}
          <div className="p-3.5 border-t border-slate-800/80 bg-[#0B0F17]/60">
            <button
              type="button"
              onClick={() => {
                setActiveNav('api');
                setSidebarOpenMobile(false);
              }}
              className="w-full text-left p-2.5 rounded-lg border border-slate-800/90 hover:border-slate-700 bg-[#0F1522] transition-colors"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200">Runtime Configuration</span>
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1 truncate">
                {providerStatus.nvidiaConfigured
                  ? 'NVIDIA NIM Direct · Ready'
                  : 'Cloud Runtime · Ready'}
              </div>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        {activeNav === 'prompts' ? (
          <PromptLibraryView
            templates={templates}
            onSelectTemplate={handleLaunchTemplate}
            onAddTemplate={(tpl) => setTemplates((prev) => [tpl, ...prev])}
            onDeleteTemplate={(id) =>
              setTemplates((prev) => prev.filter((item) => item.id !== id))
            }
          />
        ) : activeNav === 'models' ? (
          <ModelCatalogView
            selectedModelId={activeModel.id}
            onSelectModel={handleSelectModel}
          />
        ) : activeNav === 'api' ? (
          <ApiIntegrationView
            activeModel={activeModel}
            runtimeConfig={activeThread.config}
            providerStatus={providerStatus}
            onUpdateConfig={(nextConfig) =>
              updateThreadById(activeThread.id, (t) => ({ ...t, config: nextConfig }))
            }
          />
        ) : (
          /* WORKSPACE CHAT VIEW */
          <main className="flex-1 flex flex-col overflow-hidden bg-[#0B0F17]">
            {/* Sub-header Model & System Controls Bar */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-slate-800/70 bg-[#0D121D]/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label htmlFor="model-select" className="sr-only">
                  Select Inference Model
                </label>
                <select
                  id="model-select"
                  value={activeModel.id}
                  onChange={(e) => {
                    const found = MODEL_CATALOG.find((m) => m.id === e.target.value);
                    if (found) handleSelectModel(found);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0F1522] border border-slate-800 text-xs font-medium text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <optgroup label="NVIDIA NIM Microservices">
                    {MODEL_CATALOG.filter((m) => m.provider === 'nvidia').map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.id}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Google Gemini Models">
                    {MODEL_CATALOG.filter((m) => m.provider === 'gemini').map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.id}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {/* Quiet unboxed metadata */}
                <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                  <span>{activeModel.providerLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeModel.contextWindow} ctx</span>
                  <span aria-hidden="true">·</span>
                  <span>Temp {activeThread.config.temperature.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateThreadById(activeThread.id, (t) => ({
                      ...t,
                      config: {
                        ...t.config,
                        enableReasoningTrace: !t.config.enableReasoningTrace,
                      },
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                    activeThread.config.enableReasoningTrace
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-[#0F1522] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Reasoning Trace: {activeThread.config.enableReasoningTrace ? 'On' : 'Off'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSystemDrawer((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                    showSystemDrawer
                      ? 'border-slate-600 bg-slate-800 text-white'
                      : 'border-slate-800 bg-[#0F1522] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  System Persona
                </button>
              </div>
            </div>

            {/* Collapsible System Instruction Drawer */}
            {showSystemDrawer && (
              <div className="px-4 sm:px-6 py-3.5 bg-[#0F1522] border-b border-slate-800">
                <div className="max-w-3xl mx-auto space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      Thread System Instruction & Temperature
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSystemDrawer(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <textarea
                      rows={2}
                      value={activeThread.config.systemInstruction}
                      onChange={(e) =>
                        updateThreadById(activeThread.id, (t) => ({
                          ...t,
                          config: { ...t.config, systemInstruction: e.target.value },
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      placeholder="Define system persona and formatting rules..."
                    />
                    <div className="sm:w-48 flex flex-col justify-center px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Temperature</span>
                        <span className="font-mono text-white tabular-nums">
                          {activeThread.config.temperature.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={activeThread.config.temperature}
                        onChange={(e) =>
                          updateThreadById(activeThread.id, (t) => ({
                            ...t,
                            config: {
                              ...t.config,
                              temperature: parseFloat(e.target.value),
                            },
                          }))
                        }
                        className="accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Conversation Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
              {activeThread.messages.length === 0 ? (
                /* Empty Conversation State */
                <div className="max-w-3xl mx-auto h-full flex flex-col justify-center py-8">
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 tabular-nums">
                      <span className="text-emerald-400">{activeModel.providerLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeModel.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeModel.contextWindow} tokens</span>
                    </div>

                    <h1
                      className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight"
                      style={{ textWrap: 'balance' }}
                    >
                      What engineering or analytical problem are we solving today?
                    </h1>

                    <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
                      {activeModel.description} Switch seamlessly between NVIDIA NIM microservices and Google Gemini models at any point in the thread.
                    </p>
                  </div>

                  {/* 4 Curated Starter Prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {STARTER_PROMPTS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendPrompt(item.prompt)}
                        className="text-left p-4 rounded-lg border border-slate-800/90 bg-[#0F1522]/70 hover:bg-[#0F1522] hover:border-slate-700 transition-colors group flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-[11px] font-mono text-emerald-400 mb-1">
                            {item.category}
                          </div>
                          <div className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                            {item.title}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                          {item.prompt}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Populated Message Stream */
                <div className="max-w-3xl mx-auto space-y-6 pb-6">
                  {activeThread.messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const isEditingThisMsg = editingMessageId === msg.id;
                    const isReasoningOpen = Boolean(expandedReasoningIds[msg.id]);

                    return (
                      <div
                        key={msg.id}
                        className={` ${
                          isUser
                            ? 'flex flex-col items-end'
                            : 'flex flex-col items-start border-b border-slate-800/60 pb-6'
                        }`}
                      >
                        {/* Turn Header Metadata */}
                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-mono tabular-nums">
                          <span className="font-semibold text-slate-200 font-sans">
                            {isUser
                              ? 'You'
                              : MODEL_CATALOG.find((m) => m.id === msg.modelId)?.name ||
                                msg.modelId ||
                                activeModel.name}
                          </span>
                          {!isUser && msg.modelId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{msg.modelId}</span>
                            </>
                          )}
                          {!isUser && typeof msg.latencyMs === 'number' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{(msg.latencyMs / 1000).toFixed(2)}s</span>
                            </>
                          )}
                          {!isUser && typeof msg.tokenEstimate === 'number' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>~{msg.tokenEstimate} tokens</span>
                            </>
                          )}
                        </div>

                        {/* User Message Body */}
                        {isUser ? (
                          <div className="max-w-2xl w-full flex flex-col items-end">
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2 justify-end">
                                {msg.attachments.map((att) =>
                                  att.type === 'image' ? (
                                    <img
                                      key={att.id}
                                      src={att.content}
                                      alt={att.name}
                                      referrerPolicy="no-referrer"
                                      className="h-20 w-20 object-cover rounded-lg border border-slate-700"
                                    />
                                  ) : (
                                    <div
                                      key={att.id}
                                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 font-mono"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>{att.name}</span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {isEditingThisMsg ? (
                              <div className="w-full p-3 rounded-lg border border-emerald-500/60 bg-[#0F1522] space-y-2.5">
                                <textarea
                                  rows={3}
                                  value={editingMessageContent}
                                  onChange={(e) => setEditingMessageContent(e.target.value)}
                                  className="w-full bg-[#0B0F17] border border-slate-800 rounded p-2.5 text-sm text-white focus:outline-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedUserMessage(idx)}
                                    className="px-3 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400"
                                  >
                                    Save & Resubmit
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="group relative rounded-lg bg-[#131C2E] border border-slate-800 px-4 py-3 text-[15px] text-slate-100 leading-relaxed whitespace-pre-wrap">
                                {msg.content}
                                <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-end gap-3 text-xs text-slate-400">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditingMessageContent(msg.content);
                                    }}
                                    className="hover:text-white flex items-center gap-1 transition-colors"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                                    className="hover:text-white flex items-center gap-1 transition-colors"
                                  >
                                    {copiedMsgId === msg.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-400">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Assistant Message Body */
                          <div className="w-full space-y-3">
                            {/* Collapsible Reasoning Trace */}
                            {msg.reasoning && (
                              <div className="rounded-lg border border-slate-800/90 bg-[#0D131F] overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedReasoningIds((prev) => ({
                                      ...prev,
                                      [msg.id]: !prev[msg.id],
                                    }))
                                  }
                                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800/50 transition-colors"
                                >
                                  <div className="flex items-center gap-2 font-mono">
                                    {isReasoningOpen ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                                    )}
                                    <span className="font-medium text-emerald-400">
                                      Reasoning Process
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-slate-400 tabular-nums">
                                      {msg.reasoning.length} chars
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400">
                                    {isReasoningOpen ? 'Hide trace' : 'Inspect trace'}
                                  </span>
                                </button>
                                {isReasoningOpen && (
                                  <div className="px-4 py-3 border-t border-slate-800/80 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap bg-[#090D15]">
                                    {msg.reasoning}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Error Banner if request failed */}
                            {msg.error && (
                              <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 leading-relaxed">
                                <span className="font-semibold">Inference Error: </span>
                                {msg.error}
                              </div>
                            )}

                            {/* Main Assistant Markdown Content */}
                            {msg.content ? (
                              <MarkdownRenderer content={msg.content} />
                            ) : msg.isStreaming ? (
                              <div className="py-3 space-y-2 max-w-md animate-pulse">
                                <div className="h-3.5 bg-slate-800 rounded w-3/4" />
                                <div className="h-3.5 bg-slate-800 rounded w-1/2" />
                              </div>
                            ) : null}

                            {/* Assistant Turn Action Bar */}
                            {!msg.isStreaming && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                                <div className="flex items-center gap-4">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                                  >
                                    {copiedMsgId === msg.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateFromAssistantIndex(idx)}
                                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Regenerate</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleSpeak(msg.id, msg.content)}
                                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                                  >
                                    {speakingMsgId === msg.id ? (
                                      <>
                                        <VolumeX className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400">Stop Audio</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-3.5 h-3.5" />
                                        <span>Read Aloud</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                {msg.bridgedViaGemini && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveNav('api')}
                                    className="text-[11px] font-mono text-slate-400 hover:text-emerald-400 transition-colors"
                                  >
                                    Cloud Bridge · Configure NVIDIA_API_KEY in API Spec →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Bottom Composer Dock */}
            <div className="px-4 sm:px-6 pb-4 pt-2 bg-[#0B0F17] border-t border-slate-800/70">
              <div className="max-w-3xl mx-auto">
                {/* Pending Attachments Strip */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0F1522] border border-slate-800 text-xs text-slate-200 font-mono"
                      >
                        <span className="truncate max-w-[160px]">{att.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                          }
                          className="text-slate-400 hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-800 bg-[#0F1522] focus-within:border-emerald-500/70 transition-colors p-2.5">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendPrompt();
                      }
                    }}
                    placeholder={`Message ${activeModel.name} (${activeModel.providerLabel})...`}
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 resize-none focus:outline-none px-1.5 py-1 max-h-[200px] leading-relaxed"
                  />

                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/70">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.rs,.sql,.cu,.cpp,.c,.html,.css,image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Attach Context</span>
                      </button>

                      <span className="hidden sm:inline text-[11px] text-slate-500 font-mono">
                        Enter to send · Shift+Enter for newline
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isStreaming ? (
                        <button
                          type="button"
                          onClick={() => abortControllerRef.current?.abort()}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendPrompt()}
                          disabled={!inputPrompt.trim() && attachments.length === 0}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <span>Send</span>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
