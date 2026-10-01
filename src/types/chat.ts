export type ProviderId = 'nvidia' | 'gemini';

export interface ModelSpec {
  id: string;
  name: string;
  provider: ProviderId;
  providerLabel: string;
  contextWindow: string;
  maxOutputTokens: number;
  supportsReasoning: boolean;
  specialization: string;
  description: string;
  endpoint: string;
  recommendedTemp: number;
}

export interface AttachmentItem {
  id: string;
  name: string;
  type: 'code' | 'text' | 'image';
  mimeType: string;
  content: string; // text content or base64 data
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  createdAt: number;
  modelId?: string;
  provider?: ProviderId;
  latencyMs?: number;
  tokenEstimate?: number;
  bridgedViaGemini?: boolean;
  attachments?: AttachmentItem[];
  isStreaming?: boolean;
  error?: string;
}

export interface ChatRuntimeConfig {
  systemInstruction: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  enableReasoningTrace: boolean;
  autoFallbackWhenKeyUnset: boolean;
}

export interface ConversationThread {
  id: string;
  title: string;
  modelId: string;
  provider: ProviderId;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  messages: ChatMessage[];
  config: ChatRuntimeConfig;
}

export interface PromptTemplate {
  id: string;
  title: string;
  category: 'Architecture' | 'Coding' | 'Reasoning' | 'Writing' | 'Data';
  description: string;
  systemInstruction: string;
  starterPrompt: string;
  recommendedModelId: string;
}

export interface ServerProviderStatus {
  nvidiaConfigured: boolean;
  nvidiaBaseUrl: string;
  geminiConfigured: boolean;
}

export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM',
    contextWindow: '128,000',
    maxOutputTokens: 4096,
    supportsReasoning: false,
    specialization: 'General & Code Synthesis',
    description: 'High-throughput 70B parameter instruction-tuned model hosted on NVIDIA NIM tensor cores for fast dialogue and software engineering.',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    recommendedTemp: 0.6,
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1 (NIM)',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM',
    contextWindow: '128,000',
    maxOutputTokens: 8192,
    supportsReasoning: true,
    specialization: 'Chain-of-Thought Reasoning',
    description: 'First-principles reasoning model deployed via NVIDIA NIM microservice with explicit step-by-step verification traces.',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    recommendedTemp: 0.6,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Llama 3.1 Nemotron 70B',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM',
    contextWindow: '128,000',
    maxOutputTokens: 4096,
    supportsReasoning: true,
    specialization: 'RLHF Alignment & Precision',
    description: 'NVIDIA custom-aligned 70B model optimized with SteerLM and RLHF for factual accuracy, complex instruction following, and structured output.',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    recommendedTemp: 0.5,
  },
  {
    id: 'qwen/qwen2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM',
    contextWindow: '128,000',
    maxOutputTokens: 4096,
    supportsReasoning: false,
    specialization: 'Systems & Polyglot Code',
    description: 'Code-specialized model running on NVIDIA NIM infrastructure for TypeScript, Python, CUDA, Rust, and SQL refactoring.',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    recommendedTemp: 0.3,
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct-v0.1',
    name: 'Mixtral 8x22B MoE',
    provider: 'nvidia',
    providerLabel: 'NVIDIA NIM',
    contextWindow: '64,000',
    maxOutputTokens: 4096,
    supportsReasoning: false,
    specialization: 'Sparse Mixture-of-Experts',
    description: 'Sparse MoE architecture served via NVIDIA NIM for low-latency multilingual synthesis and analytical summarization.',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    recommendedTemp: 0.7,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    contextWindow: '1,000,000',
    maxOutputTokens: 8192,
    supportsReasoning: true,
    specialization: 'Multimodal & High-Speed Reasoning',
    description: 'Flagship high-efficiency multimodal model with 1M context window, rapid code generation, and deep analytical reasoning.',
    endpoint: 'GoogleGenAI SDK (Server-Side)',
    recommendedTemp: 0.7,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    contextWindow: '1,000,000',
    maxOutputTokens: 8192,
    supportsReasoning: false,
    specialization: 'Ultra-Low Latency Dialogue',
    description: 'Sub-second first-token latency model optimized for rapid interactive chat, summarization, and instant code transforms.',
    endpoint: 'GoogleGenAI SDK (Server-Side)',
    recommendedTemp: 0.7,
  },
];

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tpl-cuda-arch',
    title: 'GPU & Parallel Systems Architect',
    category: 'Architecture',
    description: 'Design high-throughput distributed pipelines, CUDA kernels, and low-latency inference services.',
    systemInstruction: 'You are a Principal GPU & Distributed Systems Architect. Provide concrete architectural diagrams in ASCII/Mermaid, memory bandwidth calculations, latency budgets, and production-ready code examples.',
    starterPrompt: 'Design a low-latency LLM token batching and KV-cache eviction strategy for serving 70B parameter models across 4 GPUs.',
    recommendedModelId: 'deepseek-ai/deepseek-r1',
  },
  {
    id: 'tpl-fullstack-ts',
    title: 'Principal TypeScript & React Reviewer',
    category: 'Coding',
    description: 'Write, audit, and refactor full-stack TypeScript, React, and Node.js code with zero runtime defects.',
    systemInstruction: 'You are a Staff Full-Stack Engineer specializing in TypeScript, React 19, and Node.js. Write complete, strongly-typed, self-contained code without placeholders. Explain time/space complexity and edge cases concisely.',
    starterPrompt: 'Write a resilient TypeScript Server-Sent Events (SSE) stream parser with automatic exponential backoff, AbortController cancellation, and typed event emitters.',
    recommendedModelId: 'qwen/qwen2.5-coder-32b-instruct',
  },
  {
    id: 'tpl-first-principles',
    title: 'First-Principles Mathematical Analyst',
    category: 'Reasoning',
    description: 'Deconstruct complex quantitative, algorithmic, and physics problems step-by-step from foundational axioms.',
    systemInstruction: 'You are a First-Principles Research Scientist. Before stating your final conclusion, explicitly lay out your assumptions, derive equations step-by-step, verify boundary conditions, and test against a concrete numerical example.',
    starterPrompt: 'Derive the computational and memory complexity of FlashAttention compared to standard self-attention as sequence length scales from 4K to 128K tokens.',
    recommendedModelId: 'deepseek-ai/deepseek-r1',
  },
  {
    id: 'tpl-sql-optimizer',
    title: 'Database & Query Execution Optimizer',
    category: 'Data',
    description: 'Design normalized schemas, composite indexes, and high-concurrency analytical SQL queries.',
    systemInstruction: 'You are a Principal Database Internals Engineer. Analyze query execution plans, B-tree vs GIN indexing trade-offs, lock contention, and write optimized SQL with clear schema definitions.',
    starterPrompt: 'Design a multi-tenant time-series telemetry schema in PostgreSQL capable of ingesting 50,000 events/sec with sub-50ms p99 dashboard aggregation queries.',
    recommendedModelId: 'nvidia/llama-3.1-nemotron-70b-instruct',
  },
  {
    id: 'tpl-exec-brief',
    title: 'Technical RFC & Executive Specification',
    category: 'Writing',
    description: 'Transform rough engineering notes into crisp RFC documents with trade-off matrices and rollout milestones.',
    systemInstruction: 'You are an Engineering Director authoring a crisp, high-signal RFC. Structure your output with: 1. Context & Problem Statement, 2. Proposed Architecture, 3. Trade-off Matrix (Markdown Table), 4. Failure Modes & Mitigations.',
    starterPrompt: 'Draft an engineering RFC proposing a unified API gateway that routes inference traffic dynamically between NVIDIA NIM endpoints and Google Gemini models based on latency and token budget.',
    recommendedModelId: 'meta/llama-3.3-70b-instruct',
  },
];
