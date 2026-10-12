import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'block w-full resize-y rounded-lg border border-line bg-surface px-3.5 py-3 text-[14.5px] leading-relaxed text-fg placeholder:text-faint',
        'focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10',
        className,
      )}
      {...rest}
    />
  );
});

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'block h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-faint',
        'focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10',
        className,
      )}
      {...rest}
    />
  );
}

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'block h-9 rounded-lg border border-line bg-surface px-2.5 pr-8 text-sm text-fg',
        'focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10',
        className,
      )}
      {...rest}
    />
  );
}
