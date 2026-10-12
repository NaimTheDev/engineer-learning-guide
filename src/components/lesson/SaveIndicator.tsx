import { Check } from 'lucide-react';

export function SaveIndicator({ updatedAt }: { updatedAt?: string }) {
  if (!updatedAt) return <span className="text-[12px] text-faint">Saved locally as you type</span>;
  const t = new Date(updatedAt);
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-faint" aria-live="polite">
      <Check className="h-3 w-3" aria-hidden /> Saved {t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
    </span>
  );
}
