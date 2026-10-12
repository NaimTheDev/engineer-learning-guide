import type { CompetencyId, Lesson } from '@/data/types';

export const PROGRESS_VERSION = 1;

export type StepId = 'learn' | 'practice' | 'explain';
export const STEPS: StepId[] = ['learn', 'practice', 'explain'];

export type WeekMode = 'light' | 'standard' | 'intensive';
export type LessonStatus = 'not-started' | 'in-progress' | 'completed';

export const STATUS_LABELS: Record<LessonStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Completed',
};

export interface LessonProgress {
  steps: Record<StepId, boolean>;
  /** Indices of ticked success-checklist items. */
  checklist: number[];
  /** Indices of ticked explanation rubric items. */
  rubric: number[];
  /** Indices of ticked intensive-week extras. */
  extras: number[];
  lightTaskDone: boolean;
  exerciseNotes: string;
  explanation: string;
  explanationSubmittedAt?: string;
  lastStep: StepId;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export type ReadinessLevel = 0 | 1 | 2 | 3;

export const READINESS_LEVELS: { value: ReadinessLevel; label: string; description: string }[] = [
  { value: 0, label: 'Not yet', description: 'Little hands-on experience so far.' },
  { value: 1, label: 'Developing', description: 'Done it with guidance or in small scope.' },
  { value: 2, label: 'Capable', description: 'Do it independently in real work.' },
  { value: 3, label: 'Strong', description: 'Could teach it and defend trade-offs under questioning.' },
];

export type EvidenceSource = 'work' | 'personal' | 'learning';

export interface EvidenceItem {
  id: string;
  title: string;
  source: EvidenceSource;
  description: string;
  createdAt: string;
}

export interface ReadinessEntry {
  level?: ReadinessLevel;
  notes: string;
  evidence: EvidenceItem[];
  updatedAt?: string;
}

export interface Settings {
  weekMode: WeekMode;
}

export interface ProgressState {
  version: typeof PROGRESS_VERSION;
  lessons: Record<string, LessonProgress>;
  readiness: Partial<Record<CompetencyId, ReadinessEntry>>;
  settings: Settings;
  createdAt: string;
  /** Last local edit. Unset on a fresh state so any synced copy wins over it. */
  updatedAt?: string;
}

export function createInitialState(now = new Date()): ProgressState {
  return {
    version: PROGRESS_VERSION,
    lessons: {},
    readiness: {},
    settings: { weekMode: 'standard' },
    createdAt: now.toISOString(),
  };
}

/** True when `a` holds newer edits than `b`. A state that has never been edited is oldest. */
export function isNewer(a: ProgressState, b: ProgressState): boolean {
  return (a.updatedAt ?? '') > (b.updatedAt ?? '');
}

export function emptyLessonProgress(): LessonProgress {
  return {
    steps: { learn: false, practice: false, explain: false },
    checklist: [],
    rubric: [],
    extras: [],
    lightTaskDone: false,
    exerciseNotes: '',
    explanation: '',
    lastStep: 'learn',
  };
}

export function emptyReadinessEntry(): ReadinessEntry {
  return { notes: '', evidence: [] };
}

// ---------------------------------------------------------------------------
// Actions & reducer
// ---------------------------------------------------------------------------

type ListField = 'checklist' | 'rubric' | 'extras';
type TextField = 'exerciseNotes' | 'explanation';

export type ProgressAction =
  | { type: 'setStepDone'; slug: string; step: StepId; done: boolean }
  | { type: 'visitStep'; slug: string; step: StepId }
  | { type: 'toggleListItem'; slug: string; field: ListField; index: number }
  | { type: 'setText'; slug: string; field: TextField; value: string }
  | { type: 'submitExplanation'; slug: string }
  | { type: 'setLightTaskDone'; slug: string; done: boolean }
  | { type: 'setLessonComplete'; slug: string; complete: boolean }
  | { type: 'setWeekMode'; mode: WeekMode }
  | { type: 'setReadinessLevel'; competency: CompetencyId; level: ReadinessLevel | undefined }
  | { type: 'setReadinessNotes'; competency: CompetencyId; notes: string }
  | { type: 'addEvidence'; competency: CompetencyId; item: EvidenceItem }
  | { type: 'removeEvidence'; competency: CompetencyId; id: string }
  /** `external` marks state arriving from another tab or device, which keeps its own `updatedAt`. */
  | { type: 'replaceState'; state: ProgressState; external?: boolean }
  | { type: 'reset' };

function updateLesson(
  state: ProgressState,
  slug: string,
  now: string,
  fn: (lp: LessonProgress) => LessonProgress,
): ProgressState {
  const prev = state.lessons[slug] ?? emptyLessonProgress();
  const next = fn(prev);
  return {
    ...state,
    lessons: {
      ...state.lessons,
      [slug]: { ...next, startedAt: next.startedAt ?? now, updatedAt: now },
    },
  };
}

function updateReadiness(
  state: ProgressState,
  id: CompetencyId,
  now: string,
  fn: (r: ReadinessEntry) => ReadinessEntry,
): ProgressState {
  const prev = state.readiness[id] ?? emptyReadinessEntry();
  return { ...state, readiness: { ...state.readiness, [id]: { ...fn(prev), updatedAt: now } } };
}

function toggle(list: number[], index: number): number[] {
  return list.includes(index) ? list.filter((i) => i !== index) : [...list, index].sort((a, b) => a - b);
}

export function progressReducer(
  state: ProgressState,
  action: ProgressAction,
  now: Date = new Date(),
): ProgressState {
  const next = applyAction(state, action, now);
  if (next === state || (action.type === 'replaceState' && action.external)) return next;
  return { ...next, updatedAt: now.toISOString() };
}

function applyAction(state: ProgressState, action: ProgressAction, now: Date): ProgressState {
  const ts = now.toISOString();
  switch (action.type) {
    case 'setStepDone':
      return updateLesson(state, action.slug, ts, (lp) => ({
        ...lp,
        steps: { ...lp.steps, [action.step]: action.done },
      }));
    case 'visitStep': {
      const existing = state.lessons[action.slug];
      // Visiting a step of a never-touched lesson shouldn't mark it started.
      if (!existing) return state;
      if (existing.lastStep === action.step) return state;
      return {
        ...state,
        lessons: { ...state.lessons, [action.slug]: { ...existing, lastStep: action.step } },
      };
    }
    case 'toggleListItem':
      return updateLesson(state, action.slug, ts, (lp) => ({
        ...lp,
        [action.field]: toggle(lp[action.field], action.index),
      }));
    case 'setText':
      return updateLesson(state, action.slug, ts, (lp) => ({ ...lp, [action.field]: action.value }));
    case 'submitExplanation':
      return updateLesson(state, action.slug, ts, (lp) => ({
        ...lp,
        explanationSubmittedAt: lp.explanationSubmittedAt ?? ts,
      }));
    case 'setLightTaskDone':
      return updateLesson(state, action.slug, ts, (lp) => ({ ...lp, lightTaskDone: action.done }));
    case 'setLessonComplete':
      return updateLesson(state, action.slug, ts, (lp) =>
        action.complete
          ? { ...lp, completedAt: lp.completedAt ?? ts }
          : { ...lp, completedAt: undefined },
      );
    case 'setWeekMode':
      return { ...state, settings: { ...state.settings, weekMode: action.mode } };
    case 'setReadinessLevel':
      return updateReadiness(state, action.competency, ts, (r) => ({ ...r, level: action.level }));
    case 'setReadinessNotes':
      return updateReadiness(state, action.competency, ts, (r) => ({ ...r, notes: action.notes }));
    case 'addEvidence':
      return updateReadiness(state, action.competency, ts, (r) => ({
        ...r,
        evidence: [...r.evidence, action.item],
      }));
    case 'removeEvidence':
      return updateReadiness(state, action.competency, ts, (r) => ({
        ...r,
        evidence: r.evidence.filter((e) => e.id !== action.id),
      }));
    case 'replaceState':
      return action.state;
    case 'reset':
      return createInitialState(now);
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function getLessonStatus(lp: LessonProgress | undefined): LessonStatus {
  if (!lp) return 'not-started';
  if (lp.completedAt) return 'completed';
  return 'in-progress';
}

export function isComplete(state: ProgressState, slug: string): boolean {
  return Boolean(state.lessons[slug]?.completedAt);
}

/**
 * The lesson to work on now. Progress is completion-driven, never
 * calendar-driven: missed weeks never put you "behind".
 *
 * 1. The most recently touched unfinished lesson (resume where you stopped).
 * 2. Otherwise the first incomplete lesson in sequence.
 * 3. Otherwise undefined (curriculum finished).
 */
export function getCurrentLesson(
  lessons: readonly Lesson[],
  state: ProgressState,
): Lesson | undefined {
  let resume: { lesson: Lesson; at: string } | undefined;
  for (const lesson of lessons) {
    const lp = state.lessons[lesson.slug];
    if (!lp || lp.completedAt || !lp.updatedAt) continue;
    if (!resume || lp.updatedAt > resume.at) resume = { lesson, at: lp.updatedAt };
  }
  if (resume) return resume.lesson;
  return lessons.find((l) => !isComplete(state, l.slug));
}

/** The next incomplete lesson in sequence after `current`. */
export function getNextLesson(
  lessons: readonly Lesson[],
  state: ProgressState,
  current: Lesson | undefined,
): Lesson | undefined {
  if (!current) return undefined;
  return lessons.find((l) => l.week > current.week && !isComplete(state, l.slug));
}

export function getUnfinishedLessons(lessons: readonly Lesson[], state: ProgressState): Lesson[] {
  return lessons.filter((l) => getLessonStatus(state.lessons[l.slug]) === 'in-progress');
}

export interface OverallProgress {
  completed: number;
  total: number;
  percent: number;
  topicsCovered: number;
  totalTopics: number;
}

export function getOverallProgress(lessons: readonly Lesson[], state: ProgressState): OverallProgress {
  const done = lessons.filter((l) => isComplete(state, l.slug));
  const allTopics = new Set(lessons.flatMap((l) => l.topics.map((t) => t.toLowerCase())));
  const covered = new Set(done.flatMap((l) => l.topics.map((t) => t.toLowerCase())));
  return {
    completed: done.length,
    total: lessons.length,
    percent: lessons.length ? Math.round((done.length / lessons.length) * 100) : 0,
    topicsCovered: covered.size,
    totalTopics: allTopics.size,
  };
}

export interface WeekPlanItem {
  id: string;
  label: string;
  minutes: number;
  done: boolean;
  step?: StepId;
}

/** The checklist of work for the current lesson in the chosen weekly mode. */
export function getWeekPlan(lesson: Lesson, lp: LessonProgress | undefined, mode: WeekMode): WeekPlanItem[] {
  const p = lp ?? emptyLessonProgress();
  if (mode === 'light') {
    return [{ id: 'light', label: 'Minimum viable task', minutes: 30, done: p.lightTaskDone || Boolean(p.completedAt) }];
  }
  const core: WeekPlanItem[] = [
    { id: 'learn', step: 'learn', label: 'Learn', minutes: lesson.minutes.learn, done: p.steps.learn },
    { id: 'practice', step: 'practice', label: 'Practice', minutes: lesson.minutes.practice, done: p.steps.practice },
    { id: 'explain', step: 'explain', label: 'Explain', minutes: lesson.minutes.explain, done: p.steps.explain },
  ];
  if (mode === 'standard') return core;
  const extrasMinutes = 120;
  const perExtra = lesson.intensiveExtras.length ? Math.round(extrasMinutes / lesson.intensiveExtras.length) : 0;
  return [
    ...core,
    ...lesson.intensiveExtras.map((label, i) => ({
      id: `extra-${i}`,
      label,
      minutes: perExtra,
      done: p.extras.includes(i),
    })),
  ];
}

export function summarizePlan(items: WeekPlanItem[]) {
  const total = items.reduce((s, i) => s + i.minutes, 0);
  const remaining = items.filter((i) => !i.done).reduce((s, i) => s + i.minutes, 0);
  const done = items.filter((i) => i.done).length;
  return {
    totalMinutes: total,
    remainingMinutes: remaining,
    doneCount: done,
    count: items.length,
    percent: total ? Math.round(((total - remaining) / total) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Rhythm (a gentle streak)
// ---------------------------------------------------------------------------

/** Monday-based week index since the Unix epoch, in local time. */
export function weekIndex(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return Math.round(d.getTime() / (7 * 24 * 60 * 60 * 1000));
}

export interface Rhythm {
  /** Consecutive calendar weeks with at least one completed lesson, ending this or last week. */
  streakWeeks: number;
  /** Lessons completed in the last four calendar weeks (including this one). */
  recentCompletions: number;
  completedThisWeek: number;
}

export function getRhythm(state: ProgressState, now = new Date()): Rhythm {
  const weeks = new Map<number, number>();
  for (const lp of Object.values(state.lessons)) {
    if (!lp.completedAt) continue;
    const w = weekIndex(new Date(lp.completedAt));
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  const thisWeek = weekIndex(now);
  let start = weeks.has(thisWeek) ? thisWeek : thisWeek - 1;
  let streak = 0;
  while (weeks.has(start)) {
    streak++;
    start--;
  }
  let recent = 0;
  for (let w = thisWeek - 3; w <= thisWeek; w++) recent += weeks.get(w) ?? 0;
  return { streakWeeks: streak, recentCompletions: recent, completedThisWeek: weeks.get(thisWeek) ?? 0 };
}

export function formatMinutes(min: number): string {
  if (min <= 0) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
