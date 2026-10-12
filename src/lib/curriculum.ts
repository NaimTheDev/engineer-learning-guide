import type { CompetencyId, Lesson, TrackId } from '@/data/types';
import type { LessonProgress, LessonStatus, ProgressState } from './progress';
import { getLessonStatus, STEPS } from './progress';

export function getLessonBySlug(lessons: readonly Lesson[], slug: string | undefined): Lesson | undefined {
  if (!slug) return undefined;
  return lessons.find((l) => l.slug === slug);
}

export function getAdjacentLessons(lessons: readonly Lesson[], lesson: Lesson) {
  const i = lessons.findIndex((l) => l.slug === lesson.slug);
  return { prev: i > 0 ? lessons[i - 1] : undefined, next: i >= 0 ? lessons[i + 1] : undefined };
}

export type StatusFilter = 'all' | LessonStatus;

export interface CurriculumFilter {
  query: string;
  track: TrackId | 'all';
  status: StatusFilter;
}

function haystack(lesson: Lesson): string {
  return [
    `week ${lesson.week}`,
    lesson.title,
    lesson.objective,
    lesson.topics.join(' '),
    lesson.track,
    lesson.exercise.title,
  ]
    .join(' ')
    .toLowerCase();
}

export function filterLessons(
  lessons: readonly Lesson[],
  state: ProgressState,
  filter: CurriculumFilter,
): Lesson[] {
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return lessons.filter((l) => {
    if (filter.track !== 'all' && l.track !== filter.track && !l.secondaryTracks?.includes(filter.track)) return false;
    if (filter.status !== 'all' && getLessonStatus(state.lessons[l.slug]) !== filter.status) return false;
    if (!terms.length) return true;
    const h = haystack(l);
    return terms.every((t) => h.includes(t));
  });
}

export function lessonsForCompetency(lessons: readonly Lesson[], id: CompetencyId): Lesson[] {
  return lessons.filter((l) => l.competencies.includes(id));
}

export function quarterOf(week: number): { index: number; name: string } {
  const quarters = ['Foundations', 'Depth', 'Systems', 'Integration'];
  const index = Math.min(3, Math.floor((week - 1) / 13));
  return { index, name: quarters[index] ?? 'Foundations' };
}

const MESSAGES = [
  'Depth compounds. Two focused hours a week is a year of real expertise.',
  'You are not behind. The curriculum waits for you, not the calendar.',
  'Understanding beats coverage. Finish one thing properly.',
  'Explaining it plainly is the test. If you can teach it, you own it.',
  'Measure first, then change one thing. That habit is the senior skill.',
  'Small, steady reps build judgment faster than heroic weekends.',
  'Good engineers know answers. Great ones know trade-offs.',
  'Leave this week a little sharper than you arrived.',
  'Your future self will read the notes you write today. Make them useful.',
  'Curiosity is the work. Follow the "why" one level deeper than usual.',
];

/** A calm, deterministic message for the given lesson week. */
export function messageFor(week: number): string {
  return MESSAGES[(week - 1 + MESSAGES.length) % MESSAGES.length] ?? MESSAGES[0]!;
}

/** Where "Continue" should take you: the first unfinished step, else the last visited. */
export function continuePath(lesson: Lesson, lp: LessonProgress | undefined): string {
  if (!lp) return `/lesson/${lesson.slug}/learn`;
  const firstUndone = STEPS.find((s) => !lp.steps[s]);
  return `/lesson/${lesson.slug}/${firstUndone ?? lp.lastStep}`;
}
