import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Feather, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ExplainStep } from '@/components/lesson/ExplainStep';
import { LearnStep } from '@/components/lesson/LearnStep';
import { PracticeStep } from '@/components/lesson/PracticeStep';
import { StatusIcon } from '@/components/lesson/StatusIcon';
import { TrackBadge } from '@/components/lesson/TrackBadge';
import { Badge, Button, ButtonLink, Card, CheckItem, ProgressBar, RichText, SectionLabel } from '@/components/ui';
import { getCompetency } from '@/data/competencies';
import type { Lesson } from '@/data/types';
import { cn } from '@/lib/cn';
import { getAdjacentLessons, getLessonBySlug } from '@/lib/curriculum';
import {
  emptyLessonProgress,
  formatMinutes,
  getLessonStatus,
  getNextLesson,
  getWeekPlan,
  STATUS_LABELS,
  STEPS,
  summarizePlan,
  type StepId,
} from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';

const STEP_META: Record<StepId, { label: string; verb: string }> = {
  learn: { label: 'Learn', verb: 'Understand the concept' },
  practice: { label: 'Practice', verb: 'Build and measure' },
  explain: { label: 'Explain', verb: 'Teach it back' },
};

function isStep(s: string | undefined): s is StepId {
  return s === 'learn' || s === 'practice' || s === 'explain';
}

export default function LessonPage() {
  const { slug, step } = useParams();
  const { lessons } = useProgress();
  const lesson = getLessonBySlug(lessons, slug);

  if (!lesson) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Lesson not found</h1>
        <p className="mt-2 text-muted">It may have been renamed. Your progress for other lessons is unaffected.</p>
        <ButtonLink to="/curriculum" className="mt-6">
          Browse curriculum
        </ButtonLink>
      </div>
    );
  }
  if (!isStep(step)) return <Navigate to={`/lesson/${lesson.slug}/learn`} replace />;
  return <LessonView lesson={lesson} step={step} />;
}

function LessonView({ lesson, step }: { lesson: Lesson; step: StepId }) {
  const { state, dispatch, lessons } = useProgress();
  const navigate = useNavigate();
  const lp = state.lessons[lesson.slug];
  const p = lp ?? emptyLessonProgress();
  const status = getLessonStatus(lp);
  const mode = state.settings.weekMode;
  const plan = summarizePlan(getWeekPlan(lesson, lp, mode));
  const { prev, next } = getAdjacentLessons(lessons, lesson);
  const nextIncomplete = getNextLesson(lessons, state, lesson);
  const stepIndex = STEPS.indexOf(step);
  const nextStep = STEPS[stepIndex + 1];
  const totalMinutes = lesson.minutes.learn + lesson.minutes.practice + lesson.minutes.explain;

  useEffect(() => {
    dispatch({ type: 'visitStep', slug: lesson.slug, step });
  }, [dispatch, lesson.slug, step]);

  const completeStepAndContinue = () => {
    dispatch({ type: 'setStepDone', slug: lesson.slug, step, done: true });
    if (nextStep) navigate(`/lesson/${lesson.slug}/${nextStep}`);
  };

  const completeLesson = () => {
    dispatch({ type: 'setStepDone', slug: lesson.slug, step: 'explain', done: true });
    dispatch({ type: 'setLessonComplete', slug: lesson.slug, complete: true });
  };

  return (
    <article>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link to="/curriculum" className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Curriculum
        </Link>
        <div className="flex items-center gap-1">
          {prev && (
            <Link
              to={`/lesson/${prev.slug}/learn`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-subtle hover:text-fg"
              aria-label={`Previous lesson: Week ${prev.week}, ${prev.title}`}
              title={`Week ${prev.week}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
          {next && (
            <Link
              to={`/lesson/${next.slug}/learn`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-subtle hover:text-fg"
              aria-label={`Next lesson: Week ${next.week}, ${next.title}`}
              title={`Week ${next.week}`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-faint">
          <span className="font-medium text-muted">Week {lesson.week}</span>
          <TrackBadge track={lesson.track} />
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {formatMinutes(totalMinutes)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusIcon status={status} className="h-3.5 w-3.5" /> {STATUS_LABELS[status]}
          </span>
        </div>
        <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[32px]">{lesson.title}</h1>
        <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-muted">
          <RichText text={lesson.objective} />
        </p>
      </header>

      {mode === 'light' && status !== 'completed' && (
        <Card className="mb-8 p-5">
          <div className="flex items-center gap-2">
            <Feather className="h-4 w-4 text-accent" aria-hidden />
            <SectionLabel>Light week · the one thing to do</SectionLabel>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-fg">
            <RichText text={lesson.lightTask} />
          </p>
          <div className="mt-3">
            <CheckItem
              checked={p.lightTaskDone}
              onChange={(done) => dispatch({ type: 'setLightTaskDone', slug: lesson.slug, done })}
            >
              Done for this week. I’ll continue the full lesson when I have time.
            </CheckItem>
          </div>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          {/* Step navigation */}
          <nav aria-label="Lesson steps" className="sticky top-14 z-20 -mx-4 mb-8 border-b border-line bg-canvas/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:px-0">
            <ol className="flex gap-1 overflow-x-auto">
              {STEPS.map((s, i) => {
                const active = s === step;
                const done = p.steps[s];
                return (
                  <li key={s} className="shrink-0">
                    <Link
                      to={`/lesson/${lesson.slug}/${s}`}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'relative flex h-12 items-center gap-2 px-3 text-[14px] transition-colors',
                        active ? 'font-medium text-fg' : 'text-muted hover:text-fg',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[11px]',
                          done ? 'border-success bg-success text-white' : active ? 'border-fg text-fg' : 'border-line text-faint',
                        )}
                        aria-hidden
                      >
                        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                      </span>
                      {STEP_META[s].label}
                      <span className="hidden text-[12px] font-normal text-faint sm:inline">{lesson.minutes[s]} min</span>
                      {done && <span className="sr-only">(done)</span>}
                      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-fg" aria-hidden />}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          {step === 'learn' && <LearnStep lesson={lesson} />}
          {step === 'practice' && <PracticeStep lesson={lesson} mode={mode} />}
          {step === 'explain' && <ExplainStep lesson={lesson} />}

          {/* Step footer */}
          <div className="mt-12 border-t border-line pt-6">
            {nextStep ? (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                {p.steps[step] ? (
                  <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'setStepDone', slug: lesson.slug, step, done: false })}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Mark {STEP_META[step].label.toLowerCase()} as not done
                  </Button>
                ) : (
                  <span className="text-[13px] text-faint">{STEP_META[step].verb}, then move on.</span>
                )}
                <Button variant="primary" size="lg" onClick={completeStepAndContinue}>
                  {p.steps[step] ? 'Continue' : `Finish ${STEP_META[step].label.toLowerCase()}`} to {STEP_META[nextStep].label}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : status === 'completed' ? (
              <div className="rounded-xl border border-success/30 bg-success/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[16px] font-semibold text-fg">Lesson complete</h2>
                    <p className="mt-1 text-[14px] text-muted">
                      Finished {new Date(p.completedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.
                      Your notes and explanation stay here for review.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {nextIncomplete && (
                        <ButtonLink to={`/lesson/${nextIncomplete.slug}/learn`} variant="primary">
                          Next: Week {nextIncomplete.week} <ArrowRight className="h-4 w-4" aria-hidden />
                        </ButtonLink>
                      )}
                      <ButtonLink to="/">Back to Today</ButtonLink>
                      <Button
                        variant="ghost"
                        onClick={() => dispatch({ type: 'setLessonComplete', slug: lesson.slug, complete: false })}
                      >
                        Mark incomplete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px] text-faint">
                  Completing moves you to the next lesson. You can always come back.
                </span>
                <Button variant="primary" size="lg" onClick={completeLesson}>
                  <Check className="h-4 w-4" aria-hidden /> Complete lesson
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Lesson sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-10 lg:self-start">
          <Card className="p-4">
            <SectionLabel>This lesson</SectionLabel>
            <div className="mt-3 flex items-baseline justify-between text-[13px]">
              <span className="text-muted">{mode === 'light' ? 'Light week' : mode === 'intensive' ? 'Intensive week' : 'Standard week'}</span>
              <span className="font-mono text-faint">{plan.percent}%</span>
            </div>
            <ProgressBar value={plan.percent} label="Lesson progress this week" tone="accent" className="mt-2" />
            <p className="mt-2 text-[12px] text-faint">
              {plan.remainingMinutes > 0 ? `${formatMinutes(plan.remainingMinutes)} remaining` : 'Planned work done'}
            </p>
            <div className="mt-4 border-t border-line pt-3">
              {status === 'completed' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2"
                  onClick={() => dispatch({ type: 'setLessonComplete', slug: lesson.slug, complete: false })}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Mark incomplete
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="-ml-2" onClick={completeLesson}>
                  <Check className="h-3.5 w-3.5" aria-hidden /> Mark complete
                </Button>
              )}
            </div>
          </Card>

          <div>
            <SectionLabel>Builds competencies</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lesson.competencies.map((c) => (
                <Link key={c} to={`/readiness#${c}`}>
                  <Badge className="transition-colors hover:border-faint/50 hover:text-fg">{getCompetency(c).name}</Badge>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Topics</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lesson.topics.map((t) => (
                <Link key={t} to={`/curriculum?q=${encodeURIComponent(t)}`}>
                  <Badge className="transition-colors hover:border-faint/50 hover:text-fg">{t}</Badge>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
