import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  label,
  className,
  tone = 'fg',
}: {
  value: number;
  label: string;
  className?: string;
  tone?: 'fg' | 'accent' | 'success';
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-subtle', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'fg' && 'bg-fg',
          tone === 'accent' && 'bg-accent',
          tone === 'success' && 'bg-success',
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 44, label }: { value: number; size?: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-subtle" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (v / 100) * c}
        className="stroke-accent transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}
