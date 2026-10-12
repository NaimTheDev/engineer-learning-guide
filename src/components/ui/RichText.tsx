import { Fragment, type ReactNode } from 'react';

/**
 * Renders the tiny inline syntax used in curriculum data:
 * `code`, **bold**, and [text](https://url). Everything else is plain text,
 * so content can never inject HTML.
 */
const TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const [full] = m;
    if (m[1]) {
      out.push(
        <code key={key++} className="inline-code">
          {full.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      out.push(
        <strong key={key++} className="font-semibold text-fg">
          {full.slice(2, -2)}
        </strong>,
      );
    } else if (m[3] && m[4]) {
      const label = full.slice(1, full.indexOf(']('));
      out.push(
        <a key={key++} href={m[4]} target="_blank" rel="noreferrer noopener" className="link">
          {label}
        </a>,
      );
    }
    last = idx + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  return <Fragment>{renderInline(text)}</Fragment>;
}

export function Paragraphs({ items, className }: { items: string[]; className?: string }) {
  return (
    <div className={['prose-text text-[15px] leading-[1.7] text-muted', className].filter(Boolean).join(' ')}>
      {items.map((p, i) => (
        <p key={i}>
          <RichText text={p} />
        </p>
      ))}
    </div>
  );
}

export function BulletList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={['space-y-2 text-[14.5px] leading-relaxed text-muted', className].filter(Boolean).join(' ')}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-faint" />
          <span className="min-w-0">
            <RichText text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3 text-[14.5px] leading-relaxed text-muted">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line bg-subtle font-mono text-[11px] text-faint">
            {i + 1}
          </span>
          <span className="min-w-0">
            <RichText text={item} />
          </span>
        </li>
      ))}
    </ol>
  );
}
