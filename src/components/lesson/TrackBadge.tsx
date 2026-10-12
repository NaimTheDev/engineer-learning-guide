import { getTrack } from '@/data/tracks';
import type { TrackId } from '@/data/types';
import { Badge } from '@/components/ui';

export function TrackBadge({ track }: { track: TrackId }) {
  const t = getTrack(track);
  return (
    <Badge>
      <span className="font-mono text-faint">{t.letter}</span>
      {t.short}
    </Badge>
  );
}
