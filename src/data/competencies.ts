import type { Competency, CompetencyId, Profile } from './types';

/**
 * Target profiles are written from public job-posting language in general
 * terms. They are a personal planning aid, not an official Netflix rubric or
 * levelling guide.
 */
export const PROFILES: Profile[] = [
  {
    id: 'fullstack',
    name: 'Full-stack product engineer',
    level: 'Target: L4 full-stack · Aspirational: L5 Senior SWE',
    summary:
      'Owns features end to end: React and TypeScript on the client, services and APIs behind them, the data model underneath, and the production behaviour after launch.',
  },
  {
    id: 'product-ui',
    name: 'Senior product UI engineer',
    level: 'Target: L5 TV / product UI',
    summary:
      'Builds complex, high-traffic consumer interfaces with deep JavaScript and React expertise, an obsession with rendering performance and reliability, accessible interaction models, and cross-functional technical leadership.',
  },
];

export const COMPETENCIES: Competency[] = [
  {
    id: 'js-ts',
    name: 'Advanced JavaScript & TypeScript',
    description: 'Fluent with the language runtime, async model, and type system; uses types to make invalid states unrepresentable.',
    signals: [
      'Can explain the event loop, closures, and prototype chain without notes',
      'Designs discriminated unions and generic utilities that prevent real bugs',
      'Debugs async ordering issues from first principles',
    ],
    profiles: ['fullstack', 'product-ui'],
  },
  {
    id: 'react-architecture',
    name: 'React architecture',
    description: 'Structures component trees, state ownership, and data flow so features stay easy to change.',
    signals: [
      'Separates server state from client state deliberately',
      'Chooses component boundaries based on change frequency and ownership',
      'Can justify where state lives in a code review',
    ],
    profiles: ['fullstack', 'product-ui'],
  },
  {
    id: 'rendering-performance',
    name: 'Rendering performance',
    description: 'Measures before optimizing; understands React render/commit, the browser pipeline, and low-powered devices.',
    signals: [
      'Uses the React Profiler and browser Performance panel to find root causes',
      'Explains why a component re-rendered and whether it mattered',
      'Has shipped a measurable performance improvement with before/after numbers',
    ],
    profiles: ['product-ui'],
  },
  {
    id: 'ui-reliability',
    name: 'UI reliability',
    description: 'Interfaces degrade gracefully: error boundaries, loading/empty/error states, retries, and defensive data handling.',
    signals: [
      'Every async view has explicit loading, empty, error, and partial states',
      'Uses error boundaries and fallbacks deliberately',
      'Monitors client errors and acts on them',
    ],
    profiles: ['product-ui'],
  },
  {
    id: 'consumer-ui',
    name: 'Complex consumer interfaces',
    description: 'Builds rich, high-traffic consumer experiences: large lists, media, input models beyond mouse and touch.',
    signals: [
      'Has built virtualised or windowed lists',
      'Understands focus/spatial navigation for remote or keyboard input',
      'Balances visual polish against performance budgets',
    ],
    profiles: ['product-ui'],
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Ships semantic, keyboard-operable, screen-reader-friendly UI and tests it.',
    signals: [
      'Uses native semantics before ARIA',
      'Manages focus on route changes and dialogs',
      'Tests with a keyboard and a screen reader',
    ],
    profiles: ['product-ui'],
  },
  {
    id: 'api-design',
    name: 'API design',
    description: 'Designs predictable, evolvable APIs with sensible pagination, errors, idempotency, and versioning.',
    signals: [
      'Designs cursor pagination and consistent error envelopes',
      'Plans for backward-compatible evolution',
      'Writes API contracts before implementation',
    ],
    profiles: ['fullstack'],
  },
  {
    id: 'backend-services',
    name: 'Backend services',
    description: 'Builds services that handle concurrency, background work, failure, and load correctly.',
    signals: [
      'Implements idempotent background jobs with retries',
      'Understands Node.js/PHP/Java runtime trade-offs',
      'Handles timeouts and partial failures explicitly',
    ],
    profiles: ['fullstack'],
  },
  {
    id: 'databases',
    name: 'Databases & SQL',
    description: 'Models data well, reads query plans, chooses indexes, and uses transactions and locking correctly.',
    signals: [
      'Reads EXPLAIN ANALYZE output fluently',
      'Chooses isolation levels and locking strategies on purpose',
      'Has fixed a slow query with evidence',
    ],
    profiles: ['fullstack'],
  },
  {
    id: 'system-design',
    name: 'System design',
    description: 'Designs systems with explicit trade-offs around caching, queues, consistency, replication, and scale.',
    signals: [
      'Starts with requirements and numbers, not boxes',
      'Names the trade-off behind each component',
      'Can design both frontend and backend systems end to end',
    ],
    profiles: ['fullstack', 'product-ui'],
  },
  {
    id: 'production-reliability',
    name: 'Production reliability',
    description: 'Observes, debugs, and improves running systems; leads calm incident response and follow-up.',
    signals: [
      'Uses logs, metrics, and traces to form and test hypotheses',
      'Writes blameless postmortems with real follow-ups',
      'Designs for graceful degradation',
    ],
    profiles: ['fullstack', 'product-ui'],
  },
  {
    id: 'feature-ownership',
    name: 'End-to-end feature ownership',
    description: 'Takes ambiguous product problems from idea to production and beyond, across client, server, and data.',
    signals: [
      'Writes the design doc, builds it, ships it, and measures it',
      'Identifies risks and rollout strategy before coding',
      'Follows up on outcomes after launch',
    ],
    profiles: ['fullstack'],
  },
  {
    id: 'technical-communication',
    name: 'Technical communication & ownership',
    description: 'Writes clearly, reviews generously, explains trade-offs to mixed audiences, and drives cross-functional decisions.',
    signals: [
      'Writes design docs and ADRs that others act on',
      'Gives code review feedback that teaches',
      'Aligns design, product, and engineering on trade-offs',
    ],
    profiles: ['fullstack', 'product-ui'],
  },
  {
    id: 'cs-fundamentals',
    name: 'CS fundamentals',
    description: 'Practical command of data structures, algorithms, networking, memory, and concurrency.',
    signals: [
      'Chooses data structures by access pattern and complexity',
      'Explains what happens between typing a URL and seeing a page',
      'Reasons about race conditions and memory leaks',
    ],
    profiles: ['fullstack', 'product-ui'],
  },
];

const byId = new Map(COMPETENCIES.map((c) => [c.id, c]));

export function getCompetency(id: CompetencyId): Competency {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown competency: ${id}`);
  return c;
}
