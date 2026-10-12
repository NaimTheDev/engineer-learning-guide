import { COMPETENCIES } from '@/data/competencies';
import type { CompetencyId } from '@/data/types';
import {
  PROGRESS_VERSION,
  STEPS,
  type EvidenceItem,
  type LessonProgress,
  type ProgressState,
  type ReadinessEntry,
  type ReadinessLevel,
  type StepId,
  type WeekMode,
} from './progress';

export const BACKUP_APP_ID = 'engineeros';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  progress: ProgressState;
}

export function createBackup(state: ProgressState, now = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, version: PROGRESS_VERSION, exportedAt: now.toISOString(), progress: state };
}

export function backupFileName(now = new Date()): string {
  return `engineeros-progress-${now.toISOString().slice(0, 10)}.json`;
}

export type ParseResult =
  | { ok: true; state: ProgressState; summary: { lessons: number; completed: number; evidence: number } }
  | { ok: false; error: string };

class ValidationError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(msg: string): never {
  throw new ValidationError(msg);
}

function str(v: unknown, path: string, fallback?: string): string {
  if (typeof v === 'string') return v;
  if (v === undefined && fallback !== undefined) return fallback;
  return fail(`${path} must be a string`);
}

function optIso(v: unknown, path: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) fail(`${path} must be an ISO date string`);
  return v;
}

function indexList(v: unknown, path: string): number[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail(`${path} must be an array`);
  const out = new Set<number>();
  v.forEach((n, i) => {
    if (!Number.isInteger(n) || (n as number) < 0) fail(`${path}[${i}] must be a non-negative integer`);
    out.add(n as number);
  });
  return [...out].sort((a, b) => a - b);
}

const MAX_TEXT = 200_000;

function text(v: unknown, path: string): string {
  const s = str(v, path, '');
  if (s.length > MAX_TEXT) fail(`${path} is too long`);
  return s;
}

function parseLesson(v: unknown, path: string): LessonProgress {
  if (!isObject(v)) fail(`${path} must be an object`);
  const stepsRaw = v.steps === undefined ? {} : v.steps;
  if (!isObject(stepsRaw)) fail(`${path}.steps must be an object`);
  const steps = {} as Record<StepId, boolean>;
  for (const s of STEPS) {
    const val = stepsRaw[s];
    if (val !== undefined && typeof val !== 'boolean') fail(`${path}.steps.${s} must be a boolean`);
    steps[s] = Boolean(val);
  }
  const lastStep = v.lastStep === undefined ? 'learn' : v.lastStep;
  if (!STEPS.includes(lastStep as StepId)) fail(`${path}.lastStep must be one of ${STEPS.join(', ')}`);
  if (v.lightTaskDone !== undefined && typeof v.lightTaskDone !== 'boolean')
    fail(`${path}.lightTaskDone must be a boolean`);
  return {
    steps,
    checklist: indexList(v.checklist, `${path}.checklist`),
    rubric: indexList(v.rubric, `${path}.rubric`),
    extras: indexList(v.extras, `${path}.extras`),
    lightTaskDone: Boolean(v.lightTaskDone),
    exerciseNotes: text(v.exerciseNotes, `${path}.exerciseNotes`),
    explanation: text(v.explanation, `${path}.explanation`),
    explanationSubmittedAt: optIso(v.explanationSubmittedAt, `${path}.explanationSubmittedAt`),
    lastStep: lastStep as StepId,
    startedAt: optIso(v.startedAt, `${path}.startedAt`),
    completedAt: optIso(v.completedAt, `${path}.completedAt`),
    updatedAt: optIso(v.updatedAt, `${path}.updatedAt`),
  };
}

const COMPETENCY_IDS = new Set<string>(COMPETENCIES.map((c) => c.id));
const SOURCES = new Set(['work', 'personal', 'learning']);
const MODES: WeekMode[] = ['light', 'standard', 'intensive'];

function parseEvidence(v: unknown, path: string): EvidenceItem {
  if (!isObject(v)) fail(`${path} must be an object`);
  const source = str(v.source, `${path}.source`);
  if (!SOURCES.has(source)) fail(`${path}.source must be work, personal, or learning`);
  return {
    id: str(v.id, `${path}.id`),
    title: text(v.title, `${path}.title`),
    source: source as EvidenceItem['source'],
    description: text(v.description, `${path}.description`),
    createdAt: optIso(v.createdAt, `${path}.createdAt`) ?? new Date(0).toISOString(),
  };
}

function parseReadiness(v: unknown, path: string): ReadinessEntry {
  if (!isObject(v)) fail(`${path} must be an object`);
  let level: ReadinessLevel | undefined;
  if (v.level !== undefined && v.level !== null) {
    if (![0, 1, 2, 3].includes(v.level as number)) fail(`${path}.level must be 0, 1, 2, or 3`);
    level = v.level as ReadinessLevel;
  }
  const evidence = v.evidence === undefined ? [] : v.evidence;
  if (!Array.isArray(evidence)) fail(`${path}.evidence must be an array`);
  return {
    level,
    notes: text(v.notes, `${path}.notes`),
    evidence: evidence.map((e, i) => parseEvidence(e, `${path}.evidence[${i}]`)),
    updatedAt: optIso(v.updatedAt, `${path}.updatedAt`),
  };
}

/** Validate a parsed progress object (not the backup envelope). */
export function validateProgress(v: unknown): ProgressState {
  if (!isObject(v)) fail('progress must be an object');
  if (v.version !== PROGRESS_VERSION) fail(`Unsupported progress version: ${String(v.version)}`);
  if (!isObject(v.lessons)) fail('progress.lessons must be an object');
  const lessons: Record<string, LessonProgress> = {};
  for (const [slug, lp] of Object.entries(v.lessons)) {
    lessons[slug] = parseLesson(lp, `lessons["${slug}"]`);
  }
  const readinessRaw = v.readiness === undefined ? {} : v.readiness;
  if (!isObject(readinessRaw)) fail('progress.readiness must be an object');
  const readiness: Partial<Record<CompetencyId, ReadinessEntry>> = {};
  for (const [id, entry] of Object.entries(readinessRaw)) {
    // Unknown competencies (e.g. from a future version) are dropped, not fatal.
    if (!COMPETENCY_IDS.has(id)) continue;
    readiness[id as CompetencyId] = parseReadiness(entry, `readiness.${id}`);
  }
  const settingsRaw = v.settings === undefined ? {} : v.settings;
  if (!isObject(settingsRaw)) fail('progress.settings must be an object');
  const weekMode = settingsRaw.weekMode ?? 'standard';
  if (!MODES.includes(weekMode as WeekMode)) fail('settings.weekMode must be light, standard, or intensive');
  return {
    version: PROGRESS_VERSION,
    lessons,
    readiness,
    settings: { weekMode: weekMode as WeekMode },
    createdAt: optIso(v.createdAt, 'createdAt') ?? new Date().toISOString(),
    updatedAt: optIso(v.updatedAt, 'updatedAt'),
  };
}

/** Parse and validate an exported backup file's text. Never throws. */
export function parseBackup(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  try {
    if (!isObject(data)) fail('Backup must be a JSON object.');
    if (data.app !== BACKUP_APP_ID) fail('This does not look like an EngineerOS backup file.');
    const state = validateProgress(data.progress);
    const all = Object.values(state.lessons);
    return {
      ok: true,
      state,
      summary: {
        lessons: all.length,
        completed: all.filter((l) => l.completedAt).length,
        evidence: Object.values(state.readiness).reduce((n, r) => n + (r?.evidence.length ?? 0), 0),
      },
    };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    return { ok: false, error: 'Could not read this backup.' };
  }
}

/** Load stored progress, falling back to a fresh state if it's missing or corrupt. */
export function loadProgress(raw: unknown, fallback: () => ProgressState): ProgressState {
  if (raw === undefined) return fallback();
  try {
    return validateProgress(raw);
  } catch {
    return fallback();
  }
}
