import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  getCurrentLesson,
  getNextLesson,
  getOverallProgress,
  getRhythm,
  getUnfinishedLessons,
  getWeekPlan,
  isNewer,
  progressReducer,
  summarizePlan,
  type ProgressAction,
  type ProgressState,
} from '@/lib/progress';
import { FIXTURE_LESSONS } from './fixtures';

const at = (iso: string) => new Date(iso);

function apply(state: ProgressState, ...steps: [ProgressAction, string][]): ProgressState {
  return steps.reduce((s, [a, t]) => progressReducer(s, a, at(t)), state);
}

describe('lesson completion', () => {
  it('marks a lesson complete and incomplete', () => {
    let s = createInitialState();
    s = progressReducer(s, { type: 'setLessonComplete', slug: 'lesson-1', complete: true }, at('2026-01-05T10:00:00Z'));
    expect(s.lessons['lesson-1']?.completedAt).toBe('2026-01-05T10:00:00.000Z');
    expect(getOverallProgress(FIXTURE_LESSONS, s).completed).toBe(1);

    s = progressReducer(s, { type: 'setLessonComplete', slug: 'lesson-1', complete: false });
    expect(s.lessons['lesson-1']?.completedAt).toBeUndefined();
    expect(getOverallProgress(FIXTURE_LESSONS, s).completed).toBe(0);
  });

  it('keeps notes and explanation when toggling completion', () => {
    let s = createInitialState();
    s = progressReducer(s, { type: 'setText', slug: 'lesson-1', field: 'exerciseNotes', value: 'Seq scan 840ms' });
    s = progressReducer(s, { type: 'setLessonComplete', slug: 'lesson-1', complete: true });
    s = progressReducer(s, { type: 'setLessonComplete', slug: 'lesson-1', complete: false });
    expect(s.lessons['lesson-1']?.exerciseNotes).toBe('Seq scan 840ms');
  });

  it('toggles checklist items without duplicates', () => {
    let s = createInitialState();
    const t = { type: 'toggleListItem', slug: 'lesson-1', field: 'checklist' } as const;
    s = progressReducer(s, { ...t, index: 1 });
    s = progressReducer(s, { ...t, index: 0 });
    expect(s.lessons['lesson-1']?.checklist).toEqual([0, 1]);
    s = progressReducer(s, { ...t, index: 1 });
    expect(s.lessons['lesson-1']?.checklist).toEqual([0]);
  });

  it('records the first explanation submission time only once', () => {
    const s = apply(
      createInitialState(),
      [{ type: 'submitExplanation', slug: 'lesson-1' }, '2026-01-01T00:00:00Z'],
      [{ type: 'submitExplanation', slug: 'lesson-1' }, '2026-02-01T00:00:00Z'],
    );
    expect(s.lessons['lesson-1']?.explanationSubmittedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not create progress just by visiting a step', () => {
    const s = progressReducer(createInitialState(), { type: 'visitStep', slug: 'lesson-2', step: 'practice' });
    expect(s.lessons['lesson-2']).toBeUndefined();
  });
});

describe('curriculum navigation', () => {
  it('starts at week 1 and advances only on completion', () => {
    let s = createInitialState();
    expect(getCurrentLesson(FIXTURE_LESSONS, s)?.week).toBe(1);
    s = progressReducer(s, { type: 'setStepDone', slug: 'lesson-1', step: 'learn', done: true });
    expect(getCurrentLesson(FIXTURE_LESSONS, s)?.week).toBe(1);
    s = progressReducer(s, { type: 'setLessonComplete', slug: 'lesson-1', complete: true });
    expect(getCurrentLesson(FIXTURE_LESSONS, s)?.week).toBe(2);
  });

  it('is not affected by elapsed calendar time', () => {
    const s = apply(createInitialState(), [{ type: 'setLessonComplete', slug: 'lesson-1', complete: true }, '2020-01-01T00:00:00Z']);
    // Years later you are still on week 2, not "behind".
    expect(getCurrentLesson(FIXTURE_LESSONS, s)?.week).toBe(2);
  });

  it('resumes the most recently touched unfinished lesson', () => {
    const s = apply(
      createInitialState(),
      [{ type: 'setStepDone', slug: 'lesson-1', step: 'learn', done: true }, '2026-01-01T00:00:00Z'],
      [{ type: 'setStepDone', slug: 'lesson-3', step: 'learn', done: true }, '2026-01-02T00:00:00Z'],
    );
    expect(getCurrentLesson(FIXTURE_LESSONS, s)?.slug).toBe('lesson-3');
    expect(getUnfinishedLessons(FIXTURE_LESSONS, s).map((l) => l.week)).toEqual([1, 3]);
  });

  it('skips completed lessons when finding the next lesson', () => {
    const s = apply(createInitialState(), [{ type: 'setLessonComplete', slug: 'lesson-2', complete: true }, '2026-01-01T00:00:00Z']);
    expect(getNextLesson(FIXTURE_LESSONS, s, FIXTURE_LESSONS[0])?.week).toBe(3);
  });

  it('returns undefined when everything is complete', () => {
    let s = createInitialState();
    for (const l of FIXTURE_LESSONS) s = progressReducer(s, { type: 'setLessonComplete', slug: l.slug, complete: true });
    expect(getCurrentLesson(FIXTURE_LESSONS, s)).toBeUndefined();
    expect(getOverallProgress(FIXTURE_LESSONS, s).percent).toBe(100);
  });
});

describe('weekly plan', () => {
  const lesson = FIXTURE_LESSONS[0]!;

  it('standard week is 2 hours across three steps', () => {
    const plan = summarizePlan(getWeekPlan(lesson, undefined, 'standard'));
    expect(plan.totalMinutes).toBe(120);
    expect(plan.count).toBe(3);
  });

  it('light week is a single 30-minute task', () => {
    const s = progressReducer(createInitialState(), { type: 'setLightTaskDone', slug: lesson.slug, done: true });
    const plan = summarizePlan(getWeekPlan(lesson, s.lessons[lesson.slug], 'light'));
    expect(plan.totalMinutes).toBe(30);
    expect(plan.percent).toBe(100);
  });

  it('intensive week adds optional extras on top of the standard path', () => {
    const plan = getWeekPlan(lesson, undefined, 'intensive');
    expect(summarizePlan(plan).totalMinutes).toBe(240);
    expect(plan.slice(0, 3).map((p) => p.id)).toEqual(['learn', 'practice', 'explain']);
  });

  it('remaining time drops as steps finish', () => {
    const s = progressReducer(createInitialState(), { type: 'setStepDone', slug: lesson.slug, step: 'practice', done: true });
    expect(summarizePlan(getWeekPlan(lesson, s.lessons[lesson.slug], 'standard')).remainingMinutes).toBe(60);
  });
});

describe('rhythm', () => {
  it('counts consecutive weeks and tolerates a quiet current week', () => {
    const s = apply(
      createInitialState(),
      [{ type: 'setLessonComplete', slug: 'lesson-1', complete: true }, '2026-03-02T12:00:00'],
      [{ type: 'setLessonComplete', slug: 'lesson-2', complete: true }, '2026-03-09T12:00:00'],
    );
    // Wednesday of the following week, nothing done yet this week.
    const r = getRhythm(s, new Date('2026-03-18T12:00:00'));
    expect(r.streakWeeks).toBe(2);
    expect(r.completedThisWeek).toBe(0);
  });

  it('reports zero without a gap penalty', () => {
    expect(getRhythm(createInitialState()).streakWeeks).toBe(0);
  });
});

describe('sync timestamps', () => {
  it('leaves a fresh state unstamped so any synced copy wins', () => {
    const fresh = createInitialState();
    expect(fresh.updatedAt).toBeUndefined();
    const edited = apply(fresh, [{ type: 'setWeekMode', mode: 'light' }, '2026-01-05T10:00:00Z']);
    expect(isNewer(edited, fresh)).toBe(true);
    expect(isNewer(fresh, edited)).toBe(false);
  });

  it('stamps local edits, including imports and resets', () => {
    const t = '2026-01-05T10:00:00Z';
    const s = createInitialState();
    expect(apply(s, [{ type: 'setText', slug: 'lesson-1', field: 'explanation', value: 'x' }, t]).updatedAt).toBe(
      '2026-01-05T10:00:00.000Z',
    );
    expect(apply(s, [{ type: 'replaceState', state: { ...s } }, t]).updatedAt).toBe('2026-01-05T10:00:00.000Z');
    expect(apply(s, [{ type: 'reset' }, t]).updatedAt).toBe('2026-01-05T10:00:00.000Z');
  });

  it('keeps the timestamp of state from another tab or device', () => {
    const remote = { ...createInitialState(), updatedAt: '2026-01-01T00:00:00.000Z' };
    const s = apply(createInitialState(), [{ type: 'replaceState', state: remote, external: true }, '2026-02-01T00:00:00Z']);
    expect(s.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not stamp no-op actions', () => {
    const s = createInitialState();
    expect(apply(s, [{ type: 'visitStep', slug: 'lesson-1', step: 'practice' }, '2026-01-05T10:00:00Z'])).toBe(s);
  });
});
