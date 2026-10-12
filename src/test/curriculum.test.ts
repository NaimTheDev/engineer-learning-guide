import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/data/competencies';
import { CURRICULUM } from '@/data/curriculum';
import { TRACKS } from '@/data/tracks';
import { filterLessons, getAdjacentLessons } from '@/lib/curriculum';
import { createInitialState, progressReducer } from '@/lib/progress';
import { FIXTURE_LESSONS } from './fixtures';

describe('curriculum data integrity', () => {
  it('has 52 sequential weeks', () => {
    expect(CURRICULUM.map((l) => l.week)).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
  });

  it('has unique, URL-safe slugs', () => {
    const slugs = CURRICULUM.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('uses only known tracks and competencies', () => {
    const tracks = new Set(TRACKS.map((t) => t.id));
    const comps = new Set(COMPETENCIES.map((c) => c.id));
    for (const l of CURRICULUM) {
      expect(tracks.has(l.track)).toBe(true);
      l.secondaryTracks?.forEach((t) => expect(tracks.has(t)).toBe(true));
      expect(l.competencies.length).toBeGreaterThan(0);
      l.competencies.forEach((c) => expect(comps.has(c)).toBe(true));
    }
  });

  it('only references earlier weeks as prerequisites', () => {
    for (const l of CURRICULUM) for (const w of l.prerequisiteWeeks ?? []) expect(w).toBeLessThan(l.week);
  });

  it('gives every lesson the full lesson structure', () => {
    for (const l of CURRICULUM) {
      const where = `week ${l.week}`;
      expect(l.questions, where).toHaveLength(3);
      expect(l.explanation.length, where).toBeGreaterThanOrEqual(3);
      expect(l.resources.length, where).toBeGreaterThanOrEqual(2);
      expect(l.exercise.steps.length, where).toBeGreaterThanOrEqual(3);
      expect(l.successChecklist.length, where).toBeGreaterThanOrEqual(3);
      expect(l.rubric.length, where).toBeGreaterThanOrEqual(3);
      expect(l.lightTask.trim(), where).not.toBe('');
      expect(l.referenceExplanation.length, where).toBeGreaterThan(200);
      for (const r of l.resources) expect(r.url, `${where}: ${r.title}`).toMatch(/^https:\/\//);
    }
  });

  it('marks the first 12 weeks as detailed', () => {
    expect(CURRICULUM.slice(0, 12).every((l) => l.depth === 'detailed')).toBe(true);
  });

  it('covers every competency with at least one lesson', () => {
    for (const c of COMPETENCIES) expect(CURRICULUM.some((l) => l.competencies.includes(c.id)), c.id).toBe(true);
  });

  it('covers all six tracks', () => {
    for (const t of TRACKS) expect(CURRICULUM.some((l) => l.track === t.id), t.id).toBe(true);
  });
});

describe('filtering', () => {
  const state = createInitialState();
  it('matches multiple terms across title and topics', () => {
    expect(filterLessons(FIXTURE_LESSONS, state, { query: 'react profiling', track: 'all', status: 'all' }).map((l) => l.week)).toEqual([2]);
    expect(filterLessons(FIXTURE_LESSONS, state, { query: 'week 3', track: 'all', status: 'all' }).map((l) => l.week)).toEqual([3]);
  });

  it('filters by track and status', () => {
    expect(filterLessons(FIXTURE_LESSONS, state, { query: '', track: 'frontend', status: 'all' })).toHaveLength(1);
    const s = progressReducer(state, { type: 'setLessonComplete', slug: 'lesson-1', complete: true });
    expect(filterLessons(FIXTURE_LESSONS, s, { query: '', track: 'all', status: 'completed' }).map((l) => l.week)).toEqual([1]);
    expect(filterLessons(FIXTURE_LESSONS, s, { query: '', track: 'all', status: 'not-started' })).toHaveLength(2);
  });

  it('finds adjacent lessons', () => {
    const { prev, next } = getAdjacentLessons(FIXTURE_LESSONS, FIXTURE_LESSONS[0]!);
    expect(prev).toBeUndefined();
    expect(next?.week).toBe(2);
  });
});
