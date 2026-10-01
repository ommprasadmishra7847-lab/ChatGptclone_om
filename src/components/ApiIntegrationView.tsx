import React, { useState } from 'react';
import { ChatRuntimeConfig, ModelSpec, ServerProviderStatus } from '../types/chat';
import { Check, Copy, RotateCcw } from 'lucide-react';

interface ApiIntegrationViewProps {
  activeModel: ModelSpec;
  runtimeConfig: ChatRuntimeConfig;
  providerStatus: ServerProviderStatus;
  onUpdateConfig: (next: ChatRuntimeConfig) => void;
}

export const ApiIntegrationView: React.FC<ApiIntegrationViewProps> = ({
  activeModel,
  runtimeConfig,
  providerStatus,
  onUpdateConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'curl' | 'node' | 'python'>('node');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const curlSnippet = `curl -X POST "${providerStatus.nvidiaBaseUrl}/chat/completions" \\
  -H "Authorization: Bearer $NVIDIA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{
    "model": "${activeModel.provider === 'nvidia' ? activeModel.id : 'meta/llama-3.3-70b-instruct'}",
    "messages": [
      {"role": "system", "content": ${JSON.stringify(runtimeConfig.systemInstruction)}},
      {"role": "user", "content": "Explain how tensor parallelism reduces time-to-first-token."}
    ],
    "temperature": ${runtimeConfig.temperature},
    "top_p": ${runtimeConfig.topP},
    "max_tokens": ${runtimeConfig.maxTokens},
    "stream": true
  }'`;

  const nodeSnippet = `// Server-side NVIDIA NIM Streaming Route (implemented in server.ts)
const response = await fetch(\`\${process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"}/chat/completions\`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${process.env.NVIDIA_API_KEY}\`,
    "Accept": "text/event-stream",
  },
  body: JSON.stringify({
    model: "${activeModel.provider === 'nvidia' ? activeModel.id : 'meta/llama-3.3-70b-instruct'}",
    messages: [
      { role: "system", content: ${JSON.stringify(runtimeConfig.systemInstruction)} },
      ...conversationHistory
    ],
    temperature: ${runtimeConfig.temperature},
    top_p: ${runtimeConfig.topP},
    max_tokens: ${runtimeConfig.maxTokens},
    stream: true,
  }),
});`;

  const pythonSnippet = `import os
from openai import OpenAI

client = OpenAI(
    base_url=os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.environ["NVIDIA_API_KEY"]
)

completion = client.chat.completions.create(
    model="${activeModel.provider === 'nvidia' ? activeModel.id : 'meta/llama-3.3-70b-instruct'}",
    messages=[
        {"role": "system", "content": ${JSON.stringify(runtimeConfig.systemInstruction)}},
        {"role": "user", "content": "Write a lock-free ring buffer in C++20."}
    ],
    temperature=${runtimeConfig.temperature},
    top_p=${runtimeConfig.topP},
    max_tokens=${runtimeConfig.maxTokens},
    stream=True
)

for chunk in completion:
    delta = chunk.choices[0].delta
    if getattr(delta, "reasoning_content", None):
        print(delta.reasoning_content, end="")
    if delta.content is not None:
        print(delta.content, end="")`;

  const currentCode =
    activeTab === 'curl' ? curlSnippet : activeTab === 'node' ? nodeSnippet : pythonSnippet;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleResetDefaults = () => {
    onUpdateConfig({
      systemInstruction:
        'You are a precise, helpful AI assistant. Format technical explanations and code clearly using Markdown.',
      temperature: activeModel.recommendedTemp,
      topP: 0.95,
      maxTokens: 4096,
      enableReasoningTrace: activeModel.supportsReasoning,
      autoFallbackWhenKeyUnset: true,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Inference Runtime & NVIDIA NIM Integration
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Tune generation parameters for the active thread and inspect the server-side proxy integration for NVIDIA NIM and Google Gemini.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-800 bg-[#0F1522] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Parameters</span>
        </button>
      </div>

      {/* Section 1: Runtime Parameter Tuning */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 p-5 rounded-lg border border-slate-800 bg-[#0F1522]/80 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white">Active Thread Parameters</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Applied to all subsequent requests sent to <span className="font-mono text-slate-300">/api/chat/stream</span>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              System Instruction
            </label>
            <textarea
              rows={4}
              value={runtimeConfig.systemInstruction}
              onChange={(e) =>
                onUpdateConfig({ ...runtimeConfig, systemInstruction: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Temperature</span>
                <span className="font-mono text-white tabular-nums">
                  {runtimeConfig.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={runtimeConfig.temperature}
                onChange={(e) =>
                  onUpdateConfig({
                    ...runtimeConfig,
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Top-P</span>
                <span className="font-mono text-white tabular-nums">
                  {runtimeConfig.topP.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={runtimeConfig.topP}
                onChange={(e) =>
                  onUpdateConfig({
                    ...runtimeConfig,
                    topP: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Max Tokens</span>
                <span className="font-mono text-white tabular-nums">
                  {runtimeConfig.maxTokens.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={512}
                max={8192}
                step={512}
                value={runtimeConfig.maxTokens}
                onChange={(e) =>
                  onUpdateConfig({
                    ...runtimeConfig,
                    maxTokens: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-white">
                  Chain-of-Thought Reasoning Trace
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Captures and renders step-by-step analytical reasoning blocks before the final answer.
                </div>
              </div>
              <input
                type="checkbox"
                checked={runtimeConfig.enableReasoningTrace}
                onChange={(e) =>
                  onUpdateConfig({
                    ...runtimeConfig,
                    enableReasoningTrace: e.target.checked,
                  })
                }
                className="mt-1 h-4 w-4 accent-emerald-500 rounded"
              />
            </label>

            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-white">
                  Seamless Cloud Bridge When NVIDIA_API_KEY Is Unset
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Automatically routes NVIDIA model selections through the active server runtime if <span className="font-mono">NVIDIA_API_KEY</span> has not been added to environment variables yet.
                </div>
              </div>
              <input
                type="checkbox"
                checked={runtimeConfig.autoFallbackWhenKeyUnset}
                onChange={(e) =>
                  onUpdateConfig({
                    ...runtimeConfig,
                    autoFallbackWhenKeyUnset: e.target.checked,
                  })
                }
                className="mt-1 h-4 w-4 accent-emerald-500 rounded"
              />
            </label>
          </div>
        </div>

        {/* Section 2: Server Environment & Architecture Contract */}
        <div className="lg:col-span-6 p-5 rounded-lg border border-slate-800 bg-[#0F1522]/80 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Server-Side Proxy Architecture
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                All inference credentials stay strictly on the Node.js server (<span className="font-mono text-slate-300">server.ts</span>) and are never exposed to client bundles.
              </p>
            </div>

            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg bg-[#0B0F17]">
              <div className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono text-slate-200 font-medium">NVIDIA_API_KEY</div>
                  <div className="text-slate-400 mt-0.5">
                    Target: <span className="font-mono">{providerStatus.nvidiaBaseUrl}/chat/completions</span>
                  </div>
                </div>
                <span
                  className={`font-mono font-medium ${
                    providerStatus.nvidiaConfigured ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {providerStatus.nvidiaConfigured
                    ? 'Direct NIM Active'
                    : runtimeConfig.autoFallbackWhenKeyUnset
                    ? 'Bridged Mode Ready'
                    : 'Awaiting Env Var'}
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono text-slate-200 font-medium">GEMINI_API_KEY</div>
                  <div className="text-slate-400 mt-0.5">
                    Target: <span className="font-mono">@google/genai SDK (Server-Side)</span>
                  </div>
                </div>
                <span
                  className={`font-mono font-medium ${
                    providerStatus.geminiConfigured ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {providerStatus.geminiConfigured ? 'Configured' : 'Awaiting Env Var'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <div className="font-semibold text-white">01. Running with Your NVIDIA API Key</div>
              <p className="text-slate-400">
                Set <span className="font-mono text-slate-200">NVIDIA_API_KEY="nvapi-..."</span> in the Secrets panel (or in your local <span className="font-mono text-slate-200">.env</span> file). The Express backend in <span className="font-mono text-slate-200">server.ts</span> automatically detects the variable and streams tokens directly from <span className="font-mono text-slate-200">https://integrate.api.nvidia.com/v1/chat/completions</span>.
              </p>
              <div className="font-semibold text-white pt-1">02. Custom Self-Hosted NIM Microservices</div>
              <p className="text-slate-400">
                To point at a self-hosted NVIDIA NIM container or vLLM cluster, set <span className="font-mono text-slate-200">NVIDIA_BASE_URL</span> in your environment to your cluster gateway URL.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Live Code Reference */}
      <div className="rounded-lg border border-slate-800 bg-[#070A10] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[#0D131F] border-b border-slate-800">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('node')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'node'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Node.js / Express Proxy
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('curl')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'curl'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              cURL Streaming
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'python'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Python OpenAI SDK
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors self-start sm:self-auto"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Snippet</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-slate-200">
          <code>{currentCode}</code>
        </pre>
      </div>
    </div>
  );
};
