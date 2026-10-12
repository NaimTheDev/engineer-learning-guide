import type { Lesson } from '@/data/types';

export function makeLesson(week: number, overrides: Partial<Lesson> = {}): Lesson {
  return {
    week,
    slug: `lesson-${week}`,
    title: `Lesson ${week} title`,
    track: 'backend',
    topics: [`topic-${week}`, week % 2 ? 'odd' : 'even'],
    objective: `Objective for lesson ${week}.`,
    whyItMatters: 'It matters.',
    explanation: ['Paragraph one with `code`.', 'Paragraph two with **bold**.'],
    keyTakeaways: ['Takeaway'],
    prerequisites: ['None'],
    resources: [{ title: 'Docs', url: 'https://example.com', kind: 'docs' }],
    exercise: {
      title: `Exercise ${week}`,
      scenario: 'Scenario',
      steps: ['Step 1', 'Step 2'],
      expected: ['Works'],
      hints: ['Hint'],
      verification: ['Verify'],
    },
    successChecklist: ['Checklist A', 'Checklist B'],
    questions: [
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
      { question: 'Q3?', answer: 'A3' },
    ],
    explainPrompt: 'Explain it.',
    rubric: ['Criterion A', 'Criterion B'],
    referenceExplanation: 'Reference explanation text.',
    lightTask: `Light task for ${week}.`,
    intensiveExtras: ['Extra A', 'Extra B'],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['databases'],
    depth: 'standard',
    ...overrides,
  };
}

export const FIXTURE_LESSONS: Lesson[] = [
  makeLesson(1, { title: 'Postgres indexes', topics: ['sql', 'indexes'] }),
  makeLesson(2, { title: 'React rendering', track: 'frontend', topics: ['react', 'profiling'], competencies: ['rendering-performance'] }),
  makeLesson(3, { title: 'API pagination', topics: ['api', 'pagination'], competencies: ['api-design'] }),
];
