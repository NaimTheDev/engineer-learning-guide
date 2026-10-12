import { describe, expect, it } from 'vitest';
import { createBackup, loadProgress, parseBackup } from '@/lib/backup';
import { createInitialState, progressReducer, type ProgressState } from '@/lib/progress';

function sampleState(): ProgressState {
  let s = createInitialState(new Date('2026-01-01T00:00:00Z'));
  s = progressReducer(s, { type: 'setStepDone', slug: 'lesson-1', step: 'learn', done: true });
  s = progressReducer(s, { type: 'setText', slug: 'lesson-1', field: 'explanation', value: 'An index is a sorted structure…' });
  s = progressReducer(s, { type: 'toggleListItem', slug: 'lesson-1', field: 'checklist', index: 2 });
  s = progressReducer(s, { type: 'setLessonComplete', slug: 'lesson-1', complete: true });
  s = progressReducer(s, { type: 'setWeekMode', mode: 'intensive' });
  s = progressReducer(s, { type: 'setReadinessLevel', competency: 'databases', level: 2 });
  s = progressReducer(s, {
    type: 'addEvidence',
    competency: 'databases',
    item: { id: 'e1', title: 'Fixed slow query', source: 'personal', description: 'NearBrew', createdAt: '2026-01-02T00:00:00.000Z' },
  });
  return s;
}

describe('export/import', () => {
  it('round-trips a full backup', () => {
    const state = sampleState();
    const result = parseBackup(JSON.stringify(createBackup(state)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(state);
    expect(result.summary).toEqual({ lessons: 1, completed: 1, evidence: 1 });
  });

  it('rejects invalid JSON', () => {
    const r = parseBackup('{not json');
    expect(r).toEqual({ ok: false, error: 'This file is not valid JSON.' });
  });

  it('rejects files from other apps', () => {
    const r = parseBackup(JSON.stringify({ app: 'something-else', progress: {} }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/EngineerOS backup/);
  });

  it('rejects unsupported versions', () => {
    const backup = createBackup(sampleState());
    const r = parseBackup(JSON.stringify({ ...backup, progress: { ...backup.progress, version: 99 } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/version/);
  });

  it.each([
    ['a non-boolean step', { steps: { learn: 'yes' } }, /steps.learn/],
    ['negative checklist indices', { checklist: [-1] }, /checklist\[0\]/],
    ['a bad date', { completedAt: 'yesterday' }, /completedAt/],
    ['an unknown step', { lastStep: 'sleep' }, /lastStep/],
  ])('rejects lesson progress with %s', (_label, lesson, pattern) => {
    const backup = createBackup(createInitialState());
    const r = parseBackup(JSON.stringify({ ...backup, progress: { ...backup.progress, lessons: { x: lesson } } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(pattern);
  });

  it('rejects an invalid week mode and readiness level', () => {
    const backup = createBackup(createInitialState());
    const badMode = parseBackup(JSON.stringify({ ...backup, progress: { ...backup.progress, settings: { weekMode: 'turbo' } } }));
    expect(badMode.ok).toBe(false);
    const badLevel = parseBackup(
      JSON.stringify({ ...backup, progress: { ...backup.progress, readiness: { databases: { level: 9, notes: '', evidence: [] } } } }),
    );
    expect(badLevel.ok).toBe(false);
  });

  it('fills defaults for missing optional fields and drops unknown competencies', () => {
    const r = parseBackup(
      JSON.stringify({
        app: 'engineeros',
        version: 1,
        progress: {
          version: 1,
          lessons: { 'lesson-1': { completedAt: '2026-01-01T00:00:00.000Z' } },
          readiness: { 'not-a-competency': { notes: '' } },
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.lessons['lesson-1']?.steps).toEqual({ learn: false, practice: false, explain: false });
    expect(r.state.settings.weekMode).toBe('standard');
    expect(r.state.readiness).toEqual({});
  });
});

describe('loadProgress', () => {
  it('falls back for missing or corrupt stored data', () => {
    const fresh = createInitialState();
    expect(loadProgress(undefined, () => fresh)).toBe(fresh);
    expect(loadProgress({ version: 1, lessons: 'nope' }, () => fresh)).toBe(fresh);
  });
});
