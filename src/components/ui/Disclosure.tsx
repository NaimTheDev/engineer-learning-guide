import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn('rounded-lg border border-line', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-[14px] font-medium text-fg transition-colors hover:bg-subtle/60"
      >
        <ChevronRight aria-hidden className={cn('h-4 w-4 shrink-0 text-faint transition-transform', open && 'rotate-90')} />
        <span className="min-w-0 flex-1">{summary}</span>
      </button>
      {open && (
        <div id={id} className="border-t border-line px-3.5 py-3">
          {children}
        </div>
      )}
    </div>
  );
}
