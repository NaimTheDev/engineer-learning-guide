import { ArrowRight, Check, Clock, Feather, Flame, Layers, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusIcon } from '@/components/lesson/StatusIcon';
import { TrackBadge } from '@/components/lesson/TrackBadge';
import { ButtonLink, Card, ProgressBar, ProgressRing, RichText, SectionLabel } from '@/components/ui';
import { cn } from '@/lib/cn';
import { continuePath, messageFor, quarterOf } from '@/lib/curriculum';
import {
  formatMinutes,
  getCurrentLesson,
  getLessonStatus,
  getNextLesson,
  getOverallProgress,
  getRhythm,
  getUnfinishedLessons,
  getWeekPlan,
  summarizePlan,
  type WeekMode,
} from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';

const MODE_META: Record<WeekMode, { label: string; short: string; icon: typeof Clock }> = {
  light: { label: 'Light week · 30 min', short: 'Light', icon: Feather },
  standard: { label: 'Standard week · 2 h', short: 'Standard', icon: Clock },
  intensive: { label: 'Intensive week · 4 h', short: 'Intensive', icon: Zap },
};

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 5) return 'Late session';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { state, lessons } = useProgress();
  const current = getCurrentLesson(lessons, state);
  const overall = getOverallProgress(lessons, state);
  const rhythm = getRhythm(state);
  const mode = state.settings.weekMode;
  const now = new Date();

  if (!current) {
    return (
      <div className="py-10">
        <p className="text-[13px] text-faint">{greeting(now)}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">You finished the curriculum.</h1>
        <p className="mt-3 max-w-xl text-muted">
          All {overall.total} lessons are complete. Revisit your readiness notes, export a backup, and pick the weeks worth repeating
          with fresh eyes.
        </p>
        <div className="mt-6 flex gap-2">
          <ButtonLink to="/readiness" variant="primary">
            Review readiness
          </ButtonLink>
          <ButtonLink to="/curriculum">Browse curriculum</ButtonLink>
        </div>
      </div>
    );
  }

  const lp = state.lessons[current.slug];
  const plan = getWeekPlan(current, lp, mode);
  const summary = summarizePlan(plan);
  const next = getNextLesson(lessons, state, current);
  const unfinished = getUnfinishedLessons(lessons, state).filter((l) => l.slug !== current.slug);
  const status = getLessonStatus(lp);
  const ModeIcon = MODE_META[mode].icon;
  const quarter = quarterOf(current.week);
  const target = continuePath(current, lp);

  return (
    <div>
      <div className="mb-8">
        <p className="text-[13px] text-faint">
          {greeting(now)} · {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <p className="mt-2 max-w-2xl text-[19px] font-medium leading-snug tracking-tight text-fg sm:text-[21px]">
          {messageFor(current.week)}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* This week */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex-1 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-faint">
              <span className="font-medium text-muted">This week</span>
              <span aria-hidden>·</span>
              <span>
                Week {current.week} of {lessons.length}
              </span>
              <span aria-hidden>·</span>
              <span>Q{quarter.index + 1} {quarter.name}</span>
              <TrackBadge track={current.track} />
            </div>
            <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-tight text-fg sm:text-[28px]">{current.title}</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              <RichText text={current.objective} />
            </p>

            {mode === 'light' && (
              <div className="mt-5 rounded-lg border border-line bg-subtle/60 p-4">
                <div className="mb-1 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-faint">
                  <Feather className="h-3.5 w-3.5" aria-hidden /> Minimum viable task
                </div>
                <p className="text-[14.5px] leading-relaxed text-fg">
                  <RichText text={current.lightTask} />
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink to={target} variant="primary" size="lg" className="sm:w-auto">
                {status === 'not-started' ? 'Start learning' : 'Continue learning'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <Clock className="h-4 w-4 text-faint" aria-hidden />
                {summary.remainingMinutes > 0 ? (
                  <span>
                    <span className="font-medium text-fg">{formatMinutes(summary.remainingMinutes)}</span> remaining this week
                  </span>
                ) : (
                  <span className="font-medium text-success">This week’s plan is done</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-line bg-subtle/30 px-5 py-4 sm:px-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ProgressRing value={summary.percent} size={36} label={`Week ${summary.percent}% complete`} />
                <div>
                  <div className="whitespace-nowrap text-[14px] font-medium text-fg">{summary.percent}% of this week</div>
                  <div className="text-[12px] text-faint">
                    {summary.doneCount} of {summary.count} done
                  </div>
                </div>
              </div>
              <Link
                to="/settings"
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[12px] text-muted transition-colors hover:bg-subtle hover:text-fg"
              >
                <ModeIcon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{MODE_META[mode].label}</span>
                <span className="sm:hidden">{MODE_META[mode].short}</span>
              </Link>
            </div>
            <ol className="grid gap-1.5 sm:grid-cols-3">
              {plan.slice(0, mode === 'intensive' ? undefined : 3).map((item) => {
                const to = item.step ? `/lesson/${current.slug}/${item.step}` : `/lesson/${current.slug}/${item.id === 'light' ? 'learn' : 'practice'}`;
                return (
                  <li key={item.id}>
                    <Link
                      to={to}
                      className={cn(
                        'flex h-full items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-faint/50',
                        mode === 'intensive' && item.id.startsWith('extra') && 'border-dashed',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          item.done ? 'border-success bg-success text-white' : 'border-line',
                        )}
                        aria-hidden
                      >
                        {item.done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                      </span>
                      <span className="min-w-0">
                        <span className={cn('block text-[13.5px] font-medium', item.done ? 'text-muted' : 'text-fg')}>
                          <span className="line-clamp-2">
                            <RichText text={item.label} />
                          </span>
                        </span>
                        <span className="block text-[12px] text-faint">
                          {item.id.startsWith('extra') ? 'Optional · ' : ''}
                          {formatMinutes(item.minutes)}
                          <span className="sr-only">{item.done ? ', done' : ', not done'}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </Card>

        {/* Side column */}
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <SectionLabel>Overall progress</SectionLabel>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-[30px] font-semibold tracking-tight text-fg">{overall.completed}</span>
              <span className="text-[14px] text-faint">of {overall.total} lessons</span>
            </div>
            <ProgressBar value={overall.percent} label="Overall curriculum progress" tone="accent" className="mt-3" />
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
              <Layers className="h-3.5 w-3.5 text-faint" aria-hidden />
              {overall.topicsCovered} of {overall.totalTopics} topics covered
            </div>
          </Card>

          <Card className="p-5">
            <SectionLabel>Rhythm</SectionLabel>
            {rhythm.streakWeeks >= 2 ? (
              <div className="mt-3 flex items-start gap-3">
                <Flame className="mt-0.5 h-5 w-5 text-warn" aria-hidden />
                <div>
                  <div className="text-[15px] font-medium text-fg">{rhythm.streakWeeks} weeks in a row</div>
                  <p className="mt-0.5 text-[13px] text-muted">Steady beats intense. Keep the pace that fits your life.</p>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-[15px] font-medium text-fg">
                  {rhythm.recentCompletions > 0
                    ? `${rhythm.recentCompletions} lesson${rhythm.recentCompletions === 1 ? '' : 's'} in the last 4 weeks`
                    : 'Pick up whenever you’re ready'}
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  Progress follows what you finish, not the calendar. Nothing here expires.
                </p>
              </div>
            )}
          </Card>

          {next && (
            <Card className="p-5">
              <SectionLabel>Up next</SectionLabel>
              <Link to={`/lesson/${next.slug}/learn`} className="group mt-3 block">
                <div className="text-[12px] text-faint">Week {next.week}</div>
                <div className="mt-0.5 text-[15px] font-medium leading-snug text-fg group-hover:underline group-hover:decoration-faint group-hover:underline-offset-2">
                  {next.title}
                </div>
                <div className="mt-2">
                  <TrackBadge track={next.track} />
                </div>
              </Link>
            </Card>
          )}
        </div>
      </div>

      {unfinished.length > 0 && (
        <section className="mt-10">
          <SectionLabel>Also in progress</SectionLabel>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {unfinished.map((l) => (
              <li key={l.slug}>
                <Link
                  to={continuePath(l, state.lessons[l.slug])}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60"
                >
                  <StatusIcon status="in-progress" />
                  <span className="w-14 shrink-0 font-mono text-[12px] text-faint">W{String(l.week).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-fg">{l.title}</span>
                  <ArrowRight className="h-4 w-4 text-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
