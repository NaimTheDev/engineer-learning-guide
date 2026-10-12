import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CodeSnippet } from '@/data/types';

export function CodeBlock({ snippet }: { snippet: CodeSnippet }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable (insecure context); selection still works.
    }
  };

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-subtle/60">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <span className="truncate text-[12px] text-muted">
          {snippet.title ?? 'Snippet'}
          <span className="ml-2 font-mono text-[11px] uppercase text-faint">{snippet.language}</span>
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-6 items-center gap-1.5 rounded px-1.5 text-[12px] text-faint transition-colors hover:bg-surface hover:text-fg"
          aria-label={copied ? 'Copied' : `Copy ${snippet.title ?? 'code'}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </figcaption>
      <pre className="scrollbar-thin max-h-[32rem] overflow-auto p-4 font-mono text-[12.5px] leading-[1.65] text-fg">
        <code>{snippet.code.replace(/^\n+|\s+$/g, '')}</code>
      </pre>
    </figure>
  );
}
