/**
 * Typed curriculum contract. Every lesson in `src/data/curriculum` must satisfy
 * `Lesson`. Text fields support a tiny inline syntax rendered by
 * `<RichText>`: `inline code`, **bold**, and [link text](https://url).
 */

export type TrackId = 'frontend' | 'backend' | 'cs' | 'system-design' | 'senior' | 'interview';

export type CompetencyId =
  | 'js-ts'
  | 'react-architecture'
  | 'rendering-performance'
  | 'ui-reliability'
  | 'consumer-ui'
  | 'accessibility'
  | 'api-design'
  | 'backend-services'
  | 'databases'
  | 'system-design'
  | 'production-reliability'
  | 'feature-ownership'
  | 'technical-communication'
  | 'cs-fundamentals';

export type ResourceKind = 'docs' | 'article' | 'book' | 'video' | 'course' | 'practice' | 'tool';

export interface Resource {
  title: string;
  url: string;
  kind: ResourceKind;
  /** What to read/watch and why. Keep it specific ("Read sections X and Y"). */
  note?: string;
  /** Rough time to spend on it inside the Learn step. */
  minutes?: number;
  /**
   * True when the exact URL, edition, or chapter should be checked manually
   * (books, paid content, deep links that may move).
   */
  verify?: boolean;
}

export interface CodeSnippet {
  /** e.g. 'sql', 'tsx', 'ts', 'js', 'php', 'java', 'bash', 'http', 'json', 'text' */
  language: string;
  title?: string;
  code: string;
}

export interface Exercise {
  title: string;
  /** The realistic scenario framing the work (NearBrew, booking platform, SaaS). */
  scenario: string;
  /** Local setup steps. Must not require paid or heavy infrastructure. */
  setup?: string[];
  /** Ordered, concrete steps. */
  steps: string[];
  starter?: CodeSnippet[];
  /** What you should observe when it works. */
  expected: string[];
  hints: string[];
  /** How to prove to yourself you're done. */
  verification: string[];
}

export interface ComprehensionQuestion {
  question: string;
  /** Reference answer, revealed on demand. */
  answer: string;
}

export interface Lesson {
  /** 1–52, unique, defines sequence. */
  week: number;
  /** URL-safe, unique. */
  slug: string;
  title: string;
  track: TrackId;
  secondaryTracks?: TrackId[];
  /** Short tags used for search and the "topics covered" count. */
  topics: string[];
  /** One sentence: "By the end you can …" */
  objective: string;
  /** Why the concept matters in production. */
  whyItMatters: string;
  /** Plain-English explanation, one string per paragraph. */
  explanation: string[];
  /** Worked examples shown in the Learn step. */
  examples?: CodeSnippet[];
  keyTakeaways: string[];
  /** Human-readable prerequisites. */
  prerequisites: string[];
  /** Earlier weeks that this lesson builds on. */
  prerequisiteWeeks?: number[];
  resources: Resource[];
  exercise: Exercise;
  successChecklist: string[];
  /** Exactly three comprehension questions. */
  questions: [ComprehensionQuestion, ComprehensionQuestion, ComprehensionQuestion];
  /** Prompt for the Explain step. */
  explainPrompt: string;
  /** Self-assessment criteria for the explanation. */
  rubric: string[];
  /** A strong model explanation, revealed after writing your own. */
  referenceExplanation: string;
  stretch?: { title: string; description: string };
  /** The minimum viable task for a 30-minute light week. */
  lightTask: string;
  /** Optional extra practice for a 4-hour intensive week. */
  intensiveExtras: string[];
  minutes: { learn: number; practice: number; explain: number };
  competencies: CompetencyId[];
  /** 'detailed' lessons were authored with extra depth (weeks 1–12). */
  depth: 'detailed' | 'standard';
}

export interface Track {
  id: TrackId;
  letter: string;
  name: string;
  short: string;
  description: string;
}

export type ProfileId = 'fullstack' | 'product-ui';

export interface Competency {
  id: CompetencyId;
  name: string;
  description: string;
  /** Observable behaviours that count as evidence. */
  signals: string[];
  profiles: ProfileId[];
}

export interface Profile {
  id: ProfileId;
  name: string;
  level: string;
  summary: string;
}
