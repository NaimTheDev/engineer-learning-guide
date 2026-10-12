import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { STATUS_LABELS, type LessonStatus } from '@/lib/progress';

export function StatusIcon({ status, className = 'h-4 w-4' }: { status: LessonStatus; className?: string }) {
  const label = STATUS_LABELS[status];
  if (status === 'completed') return <CheckCircle2 className={`${className} text-success`} aria-label={label} role="img" />;
  if (status === 'in-progress') return <CircleDot className={`${className} text-accent`} aria-label={label} role="img" />;
  return <Circle className={`${className} text-faint/70`} aria-label={label} role="img" />;
}

