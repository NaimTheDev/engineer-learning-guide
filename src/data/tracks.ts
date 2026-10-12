import type { Track, TrackId } from './types';

export const TRACKS: Track[] = [
  {
    id: 'frontend',
    letter: 'A',
    name: 'Frontend & JavaScript',
    short: 'Frontend',
    description:
      'JavaScript, TypeScript, React, browser internals, frontend architecture, rendering, profiling, and performance.',
  },
  {
    id: 'backend',
    letter: 'B',
    name: 'Backend Engineering',
    short: 'Backend',
    description:
      'API design, Node.js concepts, PHP backend patterns, Java fundamentals, SQL, PostgreSQL, indexes, transactions, and query optimization.',
  },
  {
    id: 'cs',
    letter: 'C',
    name: 'Computer Science',
    short: 'CS',
    description:
      'Data structures, algorithms, networking, operating systems, memory, concurrency, and asynchronous programming.',
  },
  {
    id: 'system-design',
    letter: 'D',
    name: 'System Design',
    short: 'Systems',
    description:
      'Caching, queues, load balancing, distributed systems, consistency, replication, reliability, observability, and scalability.',
  },
  {
    id: 'senior',
    letter: 'E',
    name: 'Senior Engineering',
    short: 'Senior',
    description:
      'Technical design documents, trade-off analysis, code reviews, incident investigation, maintainability, mentoring, and technical communication.',
  },
  {
    id: 'interview',
    letter: 'F',
    name: 'Interview Preparation',
    short: 'Interview',
    description:
      'Practical coding exercises, frontend and backend system design, behavioral stories, and selective algorithm practice.',
  },
];

const byId = new Map(TRACKS.map((t) => [t.id, t]));

export function getTrack(id: TrackId): Track {
  const track = byId.get(id);
  if (!track) throw new Error(`Unknown track: ${id}`);
  return track;
}
