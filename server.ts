import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isConfiguredKey(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed === 'MY_GEMINI_API_KEY' ||
    trimmed === 'MY_NVIDIA_API_KEY' ||
    trimmed === 'nvapi-YOUR_NVIDIA_API_KEY'
  ) {
    return false;
  }
  return true;
}

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface IncomingAttachment {
  name: string;
  type: 'code' | 'text' | 'image';
  mimeType: string;
  content: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: IncomingAttachment[];
}

function formatMessageTextWithAttachments(msg: IncomingMessage): string {
  if (!msg.attachments || msg.attachments.length === 0) {
    return msg.content;
  }
  const textAttachments = msg.attachments
    .filter((a) => a.type !== 'image')
    .map((a) => `\n\n--- Attached File: ${a.name} ---\n${a.content}\n--- End of ${a.name} ---`)
    .join('');
  return `${msg.content}${textAttachments}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // 1. Provider & Runtime Configuration Endpoint
  app.get('/api/providers', (_req, res) => {
    const nvidiaConfigured = isConfiguredKey(process.env.NVIDIA_API_KEY);
    const geminiConfigured = isConfiguredKey(process.env.GEMINI_API_KEY);
    const nvidiaBaseUrl = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');

    res.json({
      nvidiaConfigured,
      nvidiaBaseUrl,
      geminiConfigured,
    });
  });

  // 2. Streaming Chat Endpoint (SSE) supporting NVIDIA NIM & Google Gemini
  app.post('/api/chat/stream', async (req, res) => {
    const {
      messages = [],
      modelId = 'meta/llama-3.3-70b-instruct',
      provider = 'nvidia',
      config = {},
    } = req.body as {
      messages: IncomingMessage[];
      modelId: string;
      provider: 'nvidia' | 'gemini';
      config?: {
        systemInstruction?: string;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
        enableReasoningTrace?: boolean;
        autoFallbackWhenKeyUnset?: boolean;
      };
    };

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, unknown>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    const systemInstruction = (config.systemInstruction || 'You are a precise, helpful AI assistant. Format technical explanations and code clearly using Markdown.').trim();
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0.6;
    const topP = typeof config.topP === 'number' ? config.topP : 0.95;
    const maxTokens = typeof config.maxTokens === 'number' ? config.maxTokens : 4096;
    const enableReasoningTrace = Boolean(config.enableReasoningTrace);
    const autoFallbackWhenKeyUnset = config.autoFallbackWhenKeyUnset !== false;

    const nvidiaApiKey = process.env.NVIDIA_API_KEY?.trim();
    const nvidiaBaseUrl = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
    const hasNvidiaKey = isConfiguredKey(nvidiaApiKey);

    try {
      // PATH A: Direct NVIDIA NIM OpenAI-compatible SSE Streaming
      if (provider === 'nvidia' && hasNvidiaKey) {
        const openAiMessages: Array<{ role: string; content: string }> = [];
        if (systemInstruction) {
          openAiMessages.push({ role: 'system', content: systemInstruction });
        }
        for (const m of messages) {
          openAiMessages.push({
            role: m.role,
            content: formatMessageTextWithAttachments(m),
          });
        }

        const nvidiaResponse = await fetch(`${nvidiaBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${nvidiaApiKey}`,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            model: modelId,
            messages: openAiMessages,
            temperature,
            top_p: topP,
            max_tokens: maxTokens,
            stream: true,
          }),
        });

        if (!nvidiaResponse.ok || !nvidiaResponse.body) {
          const errText = await nvidiaResponse.text().catch(() => nvidiaResponse.statusText);
          throw new Error(`NVIDIA NIM API Error (${nvidiaResponse.status}): ${errText}`);
        }

        const reader = nvidiaResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let inThinkTag = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              // Explicit reasoning_content field (supported by DeepSeek-R1 / Nemotron on NVIDIA NIM)
              if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
                sendEvent({ type: 'reasoning', text: delta.reasoning_content });
              }

              if (typeof delta.content === 'string' && delta.content.length > 0) {
                let chunkText = delta.content;

                // Also parse inline <think>...</think> blocks if emitted inside content
                if (chunkText.includes('<think>')) {
                  inThinkTag = true;
                  chunkText = chunkText.replace('<think>', '');
                }
                if (inThinkTag) {
                  if (chunkText.includes('</think>')) {
                    const [thinkPart, restPart] = chunkText.split('</think>');
                    if (thinkPart) sendEvent({ type: 'reasoning', text: thinkPart });
                    inThinkTag = false;
                    if (restPart) sendEvent({ type: 'content', text: restPart });
                  } else {
                    sendEvent({ type: 'reasoning', text: chunkText });
                  }
                } else {
                  sendEvent({ type: 'content', text: chunkText });
                }
              }
            } catch {
              // Ignore partial JSON lines
            }
          }
        }

        sendEvent({ type: 'done', bridgedViaGemini: false });
        res.end();
        return;
      }

      // If provider is NVIDIA but NVIDIA_API_KEY is not set and strict mode is requested
      if (provider === 'nvidia' && !hasNvidiaKey && !autoFallbackWhenKeyUnset) {
        sendEvent({
          type: 'error',
          error:
            'NVIDIA_API_KEY is not configured in server environment variables. Add NVIDIA_API_KEY in the Secrets panel (or .env file) or enable Runtime Bridge in settings.',
        });
        res.end();
        return;
      }

      // PATH B: Server-Side Google Gemini Streaming (Direct Gemini selection OR Seamless Bridge when NVIDIA_API_KEY is unset)
      const ai = getGeminiClient();
      const targetGeminiModel = modelId === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';
      const isBridged = provider === 'nvidia' && !hasNvidiaKey;

      const geminiContents = messages.map((m) => {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

        if (m.attachments && m.attachments.length > 0) {
          for (const att of m.attachments) {
            if (att.type === 'image' && att.content) {
              const base64Clean = att.content.includes(',') ? att.content.split(',')[1] : att.content;
              parts.push({
                inlineData: {
                  mimeType: att.mimeType || 'image/png',
                  data: base64Clean,
                },
              });
            }
          }
        }

        const formattedText = formatMessageTextWithAttachments(m);
        if (formattedText) {
          parts.push({ text: formattedText });
        }

        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: parts.length > 0 ? parts : [{ text: ' ' }],
        };
      });

      const needsReasoning =
        enableReasoningTrace ||
        modelId.includes('deepseek-r1') ||
        modelId.includes('nemotron');

      const effectiveSystemInstruction = needsReasoning
        ? `${systemInstruction}\n\nWhen solving the user's request, first wrap your concise step-by-step analytical reasoning inside <think> and </think> tags (2-4 sentences of key architectural/logical steps), then provide your complete final response after </think>.`
        : systemInstruction;

      const streamResponse = await ai.models.generateContentStream({
        model: targetGeminiModel,
        contents: geminiContents,
        config: {
          systemInstruction: effectiveSystemInstruction,
          temperature,
          topP,
          ...(targetGeminiModel === 'gemini-3.8-flash' && !needsReasoning
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });

      let inThinkBlock = false;
      let accumulatedRaw = '';
      let emittedLength = 0;

      for await (const chunk of streamResponse) {
        const c = chunk as GenerateContentResponse;
        const deltaText = c.text;
        if (!deltaText) continue;

        if (!needsReasoning) {
          sendEvent({ type: 'content', text: deltaText });
          continue;
        }

        accumulatedRaw += deltaText;

        // Parse <think>...</think> progressively when reasoning trace is active
        if (!inThinkBlock && accumulatedRaw.startsWith('<think>') && emittedLength === 0) {
          inThinkBlock = true;
          emittedLength = '<think>'.length;
        }

        if (inThinkBlock) {
          const closeIdx = accumulatedRaw.indexOf('</think>');
          if (closeIdx !== -1) {
            const newReasoning = accumulatedRaw.slice(emittedLength, closeIdx);
            if (newReasoning) {
              sendEvent({ type: 'reasoning', text: newReasoning });
            }
            inThinkBlock = false;
            emittedLength = closeIdx + '</think>'.length;
            const afterThink = accumulatedRaw.slice(emittedLength).replace(/^\s+/, '');
            if (afterThink) {
              sendEvent({ type: 'content', text: afterThink });
            }
            emittedLength = accumulatedRaw.length;
          } else {
            // Hold back last 8 chars in case </think> is split across chunks
            const safeEnd = Math.max(emittedLength, accumulatedRaw.length - 8);
            if (safeEnd > emittedLength) {
              const chunkReason = accumulatedRaw.slice(emittedLength, safeEnd);
              sendEvent({ type: 'reasoning', text: chunkReason });
              emittedLength = safeEnd;
            }
          }
        } else {
          // If it didn't start with <think> after 10 chars, just emit content normally
          if (emittedLength === 0 && accumulatedRaw.length < 8 && '<think>'.startsWith(accumulatedRaw)) {
            continue;
          }
          const newContent = accumulatedRaw.slice(emittedLength);
          if (newContent) {
            sendEvent({ type: 'content', text: newContent });
            emittedLength = accumulatedRaw.length;
          }
        }
      }

      // Flush any remaining held characters
      if (needsReasoning && emittedLength < accumulatedRaw.length) {
        const remainder = accumulatedRaw.slice(emittedLength).replace('</think>', '');
        if (remainder) {
          sendEvent({ type: inThinkBlock ? 'reasoning' : 'content', text: remainder });
        }
      }

      sendEvent({ type: 'done', bridgedViaGemini: isBridged });
      res.end();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unexpected inference error occurred.';
      sendEvent({ type: 'error', error: errMsg });
      res.end();
    }
  });

  // 3. Unary / Programmatic Chat Endpoint (POST /api/chat)
  app.post('/api/chat', async (req, res) => {
    const {
      messages = [],
      modelId = 'meta/llama-3.3-70b-instruct',
      provider = 'nvidia',
      systemInstruction = 'You are a helpful AI assistant.',
      temperature = 0.6,
    } = req.body;

    const nvidiaApiKey = process.env.NVIDIA_API_KEY?.trim();
    const nvidiaBaseUrl = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
    const hasNvidiaKey = isConfiguredKey(nvidiaApiKey);

    try {
      if (provider === 'nvidia' && hasNvidiaKey) {
        const response = await fetch(`${nvidiaBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${nvidiaApiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: 'system', content: systemInstruction },
              ...messages.map((m: IncomingMessage) => ({
                role: m.role,
                content: formatMessageTextWithAttachments(m),
              })),
            ],
            temperature,
            stream: false,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          res.status(response.status).json({ error: text });
          return;
        }
        const data = await response.json();
        res.json({
          provider: 'nvidia',
          model: modelId,
          content: data.choices?.[0]?.message?.content || '',
          reasoning: data.choices?.[0]?.message?.reasoning_content || undefined,
          usage: data.usage,
        });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: messages.map((m: IncomingMessage) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: formatMessageTextWithAttachments(m) }],
        })),
        config: {
          systemInstruction,
          temperature,
        },
      });

      res.json({
        provider: provider === 'nvidia' ? 'nvidia-bridged' : 'gemini',
        model: modelId,
        content: response.text || '',
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Inference request failed.';
      res.status(500).json({ error: errMsg });
    }
  });

  // 4. Smart Thread Title Summarizer Endpoint
  app.post('/api/chat/title', async (req, res) => {
    const { firstPrompt = '' } = req.body as { firstPrompt?: string };
    const cleanPrompt = String(firstPrompt).trim().slice(0, 400);
    if (!cleanPrompt) {
      res.json({ title: 'New Conversation' });
      return;
    }

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Generate a concise 3 to 5 word title for a conversation starting with this prompt. Return ONLY the title text without quotes or punctuation:\n\n"${cleanPrompt}"`,
      });
      const rawTitle = (response.text || '').replace(/["'*#]/g, '').trim();
      res.json({ title: rawTitle.slice(0, 56) || cleanPrompt.slice(0, 40) });
    } catch {
      const fallback = cleanPrompt.split(/\s+/).slice(0, 5).join(' ');
      res.json({ title: fallback.slice(0, 48) || 'New Conversation' });
    }
  });

  // Vite middleware in development, static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kinetix AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
