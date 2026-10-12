import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warn';

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-subtle text-muted',
  accent: 'border-accent/25 bg-accent/10 text-accent',
  success: 'border-success/25 bg-success/10 text-success',
  warn: 'border-warn/25 bg-warn/10 text-warn',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium leading-4',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
