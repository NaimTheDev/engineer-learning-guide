import { Search, X } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusIcon } from '@/components/lesson/StatusIcon';
import { TrackBadge } from '@/components/lesson/TrackBadge';
import { PageHeader, ProgressBar, Segmented, Select, TextInput } from '@/components/ui';
import { TRACKS } from '@/data/tracks';
import type { Lesson, TrackId } from '@/data/types';
import { continuePath, filterLessons, quarterOf, type StatusFilter } from '@/lib/curriculum';
import { getLessonStatus, getOverallProgress } from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'not-started', label: 'To do' },
  { value: 'completed', label: 'Done' },
];

const isTrack = (v: string | null): v is TrackId => TRACKS.some((t) => t.id === v);
const isStatus = (v: string | null): v is StatusFilter => STATUS_OPTIONS.some((s) => s.value === v);

export default function CurriculumPage() {
  const { state, lessons } = useProgress();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const trackParam = params.get('track');
  const statusParam = params.get('status');
  const track: TrackId | 'all' = isTrack(trackParam) ? trackParam : 'all';
  const status: StatusFilter = isStatus(statusParam) ? statusParam : 'all';

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => filterLessons(lessons, state, { query, track, status }), [lessons, state, query, track, status]);
  const overall = getOverallProgress(lessons, state);
  const filtering = Boolean(query) || track !== 'all' || status !== 'all';

  const groups = useMemo(() => {
    const map = new Map<number, Lesson[]>();
    for (const l of results) {
      const q = quarterOf(l.week).index;
      map.set(q, [...(map.get(q) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [results]);

  return (
    <div>
      <PageHeader
        eyebrow={`${overall.completed} of ${overall.total} complete`}
        title="Curriculum"
        description="52 weeks across six tracks, sequenced by prerequisites. Lessons advance when you finish them, never by date."
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <TextInput
            type="search"
            aria-label="Search lessons"
            placeholder="Search topics, titles, weeks…"
            value={query}
            onChange={(e) => update('q', e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Filter by track" value={track} onChange={(e) => update('track', e.target.value)}>
            <option value="all">All tracks</option>
            {TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.letter}. {t.name}
              </option>
            ))}
          </Select>
          <Segmented label="Filter by status" value={status} onChange={(v) => update('status', v)} options={STATUS_OPTIONS} />
        </div>
      </div>

      {filtering && (
        <div className="mb-4 flex items-center justify-between text-[13px] text-muted">
          <span aria-live="polite">
            {results.length} lesson{results.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-faint hover:bg-subtle hover:text-fg"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-fg">No lessons match.</p>
          <p className="mt-1 text-[13.5px] text-muted">Try a broader term like “cache”, “react”, or “sql”.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(([q, items]) => {
            const all = lessons.filter((l) => quarterOf(l.week).index === q);
            const done = all.filter((l) => state.lessons[l.slug]?.completedAt).length;
            return (
              <section key={q} aria-labelledby={`q-${q}`}>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 id={`q-${q}`} className="text-[15px] font-semibold text-fg">
                      Q{q + 1} · {quarterOf(q * 13 + 1).name}
                    </h2>
                    <p className="text-[12.5px] text-faint">
                      Weeks {q * 13 + 1}–{Math.min((q + 1) * 13, lessons.length)} · {done}/{all.length} done
                    </p>
                  </div>
                  <ProgressBar value={all.length ? (done / all.length) * 100 : 0} label={`Quarter ${q + 1} progress`} className="w-24" />
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {items.map((l) => {
                    const lp = state.lessons[l.slug];
                    const st = getLessonStatus(lp);
                    return (
                      <li key={l.slug}>
                        <Link
                          to={st === 'not-started' ? `/lesson/${l.slug}/learn` : continuePath(l, lp)}
                          className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-subtle/60 sm:items-center"
                        >
                          <span className="mt-0.5 sm:mt-0">
                            <StatusIcon status={st} />
                          </span>
                          <span className="w-9 shrink-0 pt-px font-mono text-[12px] text-faint sm:pt-0">
                            W{String(l.week).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14.5px] font-medium leading-snug text-fg">{l.title}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                              <TrackBadge track={l.track} />
                            </span>
                            <span className="mt-0.5 hidden truncate text-[12.5px] text-faint sm:block">{l.topics.join(' · ')}</span>
                          </span>
                          <span className="hidden shrink-0 sm:block">
                            <TrackBadge track={l.track} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <section className="mt-14">
        <h2 className="text-[15px] font-semibold text-fg">Tracks</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((t) => {
            const all = lessons.filter((l) => l.track === t.id);
            const done = all.filter((l) => state.lessons[l.slug]?.completedAt).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => update('track', t.id)}
                className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-faint/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] text-faint">Track {t.letter}</span>
                  <span className="font-mono text-[12px] text-faint">
                    {done}/{all.length}
                  </span>
                </div>
                <div className="mt-1 text-[14.5px] font-medium text-fg">{t.name}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t.description}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
