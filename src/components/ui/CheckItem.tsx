import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A large, accessible checkbox row built on a native input. */
export function CheckItem({
  checked,
  onChange,
  children,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-subtle/70',
        className,
      )}
    >
      <span className="relative mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[5px] border border-line bg-surface transition-colors checked:border-accent checked:bg-accent"
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none relative h-3 w-3 text-accent-fg opacity-0 transition-opacity peer-checked:opacity-100"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[14.5px] text-fg transition-colors', checked && 'text-muted line-through decoration-faint/60')}>
          {children}
        </span>
        {description && <span className="mt-0.5 block text-[13px] text-faint">{description}</span>}
      </span>
    </label>
  );
}
