import React, { useState } from 'react';
import { Check, Copy, Eye, Code2, Download } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const normalizedLang = (language || 'text').toLowerCase().trim();
  const isPreviewable =
    normalizedLang === 'html' ||
    normalizedLang === 'svg' ||
    (normalizedLang === 'xml' && code.trim().startsWith('<svg'));

  const lines = code.replace(/\n$/, '').split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard fallback ignored
    }
  };

  const handleDownload = () => {
    const extMap: Record<string, string> = {
      typescript: 'ts',
      ts: 'ts',
      tsx: 'tsx',
      javascript: 'js',
      js: 'js',
      python: 'py',
      py: 'py',
      rust: 'rs',
      sql: 'sql',
      json: 'json',
      html: 'html',
      css: 'css',
      bash: 'sh',
      sh: 'sh',
      cuda: 'cu',
      cpp: 'cpp',
    };
    const ext = extMap[normalizedLang] || 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippet-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-4 rounded-lg border border-slate-800/90 bg-[#070A10] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0D131F] border-b border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span className="text-slate-200 font-medium">{normalizedLang}</span>
          <span aria-hidden="true">·</span>
          <span>{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
        </div>

        <div className="flex items-center gap-2">
          {isPreviewable && (
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap"
            >
              {showPreview ? <Code2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? 'Source' : 'Preview'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            title="Download snippet"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap"
          >
            {copied ? (
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
        </div>
      </div>

      {showPreview && isPreviewable ? (
        <div className="p-4 bg-white text-slate-900 min-h-[160px] max-h-[420px] overflow-auto">
          <iframe
            title="Artifact Preview"
            srcDoc={code}
            sandbox="allow-scripts"
            className="w-full h-64 border-0"
          />
        </div>
      ) : (
        <div className="overflow-x-auto py-3 px-3.5 font-mono text-[13px] leading-relaxed text-slate-200">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-900/50">
                  <td className="select-none pr-4 text-right text-slate-600 tabular-nums w-8 align-top">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre text-slate-200 align-top">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Split by inline code `...` first
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-slate-800/90 text-emerald-300 border border-slate-700/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Parse **bold** and *italic* and [label](url)
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={idx}>
        {boldParts.map((bPart, bIdx) => {
          if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
            return (
              <strong key={bIdx} className="font-semibold text-white">
                {bPart.slice(2, -2)}
              </strong>
            );
          }
          return bPart;
        })}
      </React.Fragment>
    );
  });
}

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split by fenced code blocks ```lang ... ```
  const blocks: Array<{ type: 'code' | 'prose'; lang?: string; text: string }> = [];
  const codeRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: 'prose',
        text: content.slice(lastIndex, match.index),
      });
    }
    blocks.push({
      type: 'code',
      lang: match[1] || 'text',
      text: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    // Check if there's an unclosed streaming code block at the end
    const unclosedMatch = remaining.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*)$/);
    if (unclosedMatch && unclosedMatch.index !== undefined) {
      if (unclosedMatch.index > 0) {
        blocks.push({
          type: 'prose',
          text: remaining.slice(0, unclosedMatch.index),
        });
      }
      blocks.push({
        type: 'code',
        lang: unclosedMatch[1] || 'text',
        text: unclosedMatch[2],
      });
    } else {
      blocks.push({
        type: 'prose',
        text: remaining,
      });
    }
  }

  const renderProse = (proseText: string, blockKey: number) => {
    const lines = proseText.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Markdown table detection
      if (
        trimmed.startsWith('|') &&
        trimmed.endsWith('|') &&
        i + 1 < lines.length &&
        lines[i + 1].trim().includes('---')
      ) {
        const headerCells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        i += 2; // skip header and separator
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const rowCells = lines[i]
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim());
          rows.push(rowCells);
          i++;
        }
        elements.push(
          <div key={`tbl-${blockKey}-${i}`} className="my-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-300">
                  {headerCells.map((cell, cIdx) => (
                    <th key={cIdx} className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                      {renderInlineFormatting(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-900/40">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3.5 text-slate-300 tabular-nums">
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${blockKey}-${i}`} className="text-base font-semibold text-white mt-5 mb-2 tracking-tight">
            {renderInlineFormatting(trimmed.slice(4))}
          </h3>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${blockKey}-${i}`} className="text-lg font-semibold text-white mt-6 mb-2.5 tracking-tight">
            {renderInlineFormatting(trimmed.slice(3))}
          </h2>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${blockKey}-${i}`} className="text-xl font-bold text-white mt-6 mb-3 tracking-tight">
            {renderInlineFormatting(trimmed.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`bq-${blockKey}-${i}`}
            className="my-3 pl-4 border-l-2 border-emerald-500/60 text-slate-300 italic"
          >
            {renderInlineFormatting(trimmed.slice(2))}
          </blockquote>
        );
        i++;
        continue;
      }

      // Unordered list
      if (/^[-*]\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
          i++;
        }
        elements.push(
          <ul key={`ul-${blockKey}-${i}`} className="my-2.5 pl-5 list-disc space-y-1.5 text-slate-200">
            {items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInlineFormatting(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        elements.push(
          <ol key={`ol-${blockKey}-${i}`} className="my-2.5 pl-5 list-decimal space-y-1.5 text-slate-200">
            {items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInlineFormatting(item)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Horizontal Rule
      if (trimmed === '---' || trimmed === '***') {
        elements.push(<hr key={`hr-${blockKey}-${i}`} className="my-5 border-slate-800" />);
        i++;
        continue;
      }

      // Standard paragraph
      elements.push(
        <p key={`p-${blockKey}-${i}`} className="my-2.5 leading-[1.68] text-[15px] text-slate-200 max-w-[74ch]">
          {renderInlineFormatting(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return (
    <div className="space-y-1">
      {blocks.map((block, idx) =>
        block.type === 'code' ? (
          <CodeBlock key={idx} language={block.lang || 'text'} code={block.text} />
        ) : (
          <React.Fragment key={idx}>{renderProse(block.text, idx)}</React.Fragment>
        )
      )}
    </div>
  );
};
