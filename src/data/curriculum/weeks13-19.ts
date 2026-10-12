import type { Lesson } from '../types';

/* ------------------------------------------------------------------ */
/* Week 13 — Quarter checkpoint: practical coding + explaining it      */
/* ------------------------------------------------------------------ */

const week13: Lesson = {
  week: 13,
  slug: 'checkpoint-debounced-search',
  title: 'Quarter checkpoint: a timed practical coding exercise, explained aloud',
  track: 'interview',
  secondaryTracks: ['frontend', 'cs'],
  topics: ['practical coding', 'debounce', 'AbortController', 'race conditions', 'LRU cache', 'testing', 'thinking aloud'],
  objective:
    "By the end you can build a debounced, cancellable, cached search controller with tests in 45 minutes and explain every design decision out loud while you work.",
  whyItMatters:
    "Practical coding rounds and real feature work both reward the same thing: turning a fuzzy requirement into small, tested, correct code while narrating trade-offs. Search-as-you-type is a classic because it packs timers, cancellation, race conditions, caching and state modelling into one small surface, exactly the topics from weeks 1 to 12.",
  explanation: [
    "This week is a checkpoint, not new theory. You will solve one realistic product problem under a 45-minute timer and then explain it. Practical (non-LeetCode) coding rounds commonly look for four things: did you clarify requirements before typing, did you build in small verified increments, did you handle the edge cases a production user would hit, and could the interviewer follow your reasoning. Correctness of the final code matters, but a half-finished solution with a clear plan and passing tests for the done parts usually reads better than a complete one that nobody could follow.",
    "The problem: NearBrew's café search box calls `GET /cafes?q=...` as the user types. Naively firing a request per keystroke causes four bugs. First, load: typing 'flat white' sends ten requests. Second, out-of-order responses: the request for 'fla' can resolve after the one for 'flat', so the UI shows stale results for a query the user no longer has. Third, wasted work: in-flight requests for abandoned queries keep running. Fourth, repeated work: backspacing to a query you already searched refetches it. The fixes map one-to-one: **debounce** (wait until typing pauses), **last-request-wins** (ignore or cancel anything that is not the latest query), **AbortController** (actually cancel the fetch), and a small **cache** (serve repeats instantly).",
    "Debounce is just a timer you reset on every call: `clearTimeout(t); t = setTimeout(run, delay)`. Week 5's event loop model tells you why this works and how to test it: the callback is a macrotask scheduled for no earlier than `delay` ms, and Vitest's `vi.useFakeTimers()` replaces the clock so `vi.advanceTimersByTime(300)` runs it synchronously and deterministically. Async test code also needs to flush promise microtasks after advancing timers, which is why `await vi.advanceTimersByTimeAsync(300)` exists. If your tests are flaky, you are almost always mixing real time and fake time.",
    "Cancellation has two layers. `AbortController` gives you a `signal` you pass to `fetch`; calling `controller.abort()` rejects that fetch with a `DOMException` whose `name` is `'AbortError'`. You must treat that rejection as expected, not as an error state, otherwise every keystroke flashes an error banner. But abort alone is not enough to guarantee correctness: a fetcher you do not control may ignore the signal. So also keep a monotonically increasing request id (or compare against the latest query) and drop any result that is not for the newest request. Belt and braces: abort saves bandwidth, the id check guarantees correctness.",
    "Model the output as a discriminated union (week 6): `{ status: 'idle' } | { status: 'loading', query } | { status: 'success', query, cafes } | { status: 'error', query, message }`. This makes impossible states unrepresentable (no `isLoading: true` with `error` set) and forces every consumer to handle each case. Keep the core logic framework-free, a plain `createCafeSearch()` that takes a `fetcher`, a `delay` and a `subscribe` callback, and make the React hook a thin wrapper that calls it from an effect and cleans up on unmount. That separation is a design point worth saying aloud: the hard part is testable without rendering anything.",
    "The cache is an LRU (least recently used) of fixed capacity. In JavaScript a `Map` preserves insertion order, so `get` can delete and re-insert a key to mark it most recent, and eviction is `map.keys().next().value`, the oldest key. That is O(1) for both operations without writing a linked list. Tie it back to week 4: decide whether entries need a TTL (café opening hours change, so a 60-second TTL is reasonable) and say so even if you do not implement it. Normalise keys (`q.trim().toLowerCase()`) so 'Flat ' and 'flat' share an entry, and do not search at all below a minimum length.",
  ],
  examples: [
    {
      language: 'ts',
      title: 'LRU cache on top of Map insertion order',
      code: `export class LruCache<K, V> {
  private map = new Map<K, V>();
  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new Error('capacity must be >= 1');
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    // Re-insert to mark as most recently used.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      // First key in iteration order is the least recently used.
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
  }

  get size() {
    return this.map.size;
  }
}`,
    },
    {
      language: 'ts',
      title: 'Search state as a discriminated union',
      code: `export type Cafe = { id: string; name: string; distanceM: number };

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; cafes: Cafe[] }
  | { status: 'error'; query: string; message: string };

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}`,
    },
  ],
  keyTakeaways: [
    "Clarify requirements and edge cases out loud before coding: minimum length, delay, empty query, error display, cache size.",
    "Debounce resets a timer per call; test it with fake timers, never with real sleeps.",
    "AbortController saves wasted work, but a latest-request-id check is what guarantees stale results never render.",
    "An AbortError is expected control flow, not a user-visible error.",
    "A Map gives you an O(1) LRU: delete-and-reinsert on read, evict the first key on overflow.",
    "Keep core logic framework-free and make the React hook a thin, cleanup-correct wrapper.",
  ],
  prerequisites: [
    "Comfort with TypeScript generics and discriminated unions",
    "Understanding of timers, promises and microtasks in the event loop",
    "Basic Vitest usage",
  ],
  prerequisiteWeeks: [2, 3, 4, 5, 6],
  resources: [
    {
      title: 'MDN: AbortController',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
      kind: 'docs',
      note: "Read the overview and the fetch example; note what `abort()` does to a pending fetch promise.",
      minutes: 8,
    },
    {
      title: 'Vitest: Mocking timers',
      url: 'https://vitest.dev/guide/mocking',
      kind: 'docs',
      note: "Read the Timers section: `vi.useFakeTimers()`, `vi.advanceTimersByTime` and the async variant.",
      minutes: 8,
      verify: true,
    },
    {
      title: 'react.dev: Synchronizing with Effects',
      url: 'https://react.dev/learn/synchronizing-with-effects',
      kind: 'docs',
      note: "Re-read the section on fetching data and cleanup (the `ignore` flag pattern), which is the React version of last-request-wins.",
      minutes: 10,
    },
    {
      title: 'MDN: Map',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map',
      kind: 'docs',
      note: "Confirm that Map iterates in insertion order, which is the property the LRU relies on.",
      minutes: 4,
    },
  ],
  exercise: {
    title: '45-minute timed build: createCafeSearch + useCafeSearch',
    scenario:
      "NearBrew's search box currently fires a request per keystroke and sometimes shows results for an old query. Build a debounced, cancellable, cached search controller with a test suite, then wrap it in a React hook. Treat this like a practical interview round: timer on, talking aloud (record yourself on your phone).",
    setup: [
      "mkdir nearbrew-search && cd nearbrew-search && npm init -y",
      "npm i -D typescript vitest",
      "Create `src/search.ts`, `src/lru.ts` and `src/search.test.ts` from the starter below.",
      "Start a 45-minute timer and a voice recording before you read the steps again.",
    ],
    steps: [
      "Minutes 0 to 5: say the requirements aloud and write them as a comment at the top of `search.ts`: 300 ms debounce, minimum 2 characters, normalised keys, latest query wins, AbortError is not an error, LRU of 20 entries.",
      "Minutes 5 to 15: implement `LruCache` and make its two tests pass (eviction order, and `get` refreshing recency).",
      "Minutes 15 to 30: implement `createCafeSearch` so that the debounce, the minimum length and the abort tests pass. Pass `signal` to the fetcher and abort the previous controller whenever a new query is scheduled or `dispose()` is called.",
      "Minutes 30 to 38: make the out-of-order test pass with a request id check, then add the cache hit test (a repeated query must emit `success` without calling the fetcher).",
      "Minutes 38 to 43: write the thin `useCafeSearch(query)` hook: create the controller once with `useRef` or `useState`, call `search(query)` in an effect keyed on `query`, and call `dispose()` in the cleanup of a mount-only effect.",
      "Minutes 43 to 45: stop coding. List aloud what you would do next (TTL, error retry, telemetry) and anything you knowingly skipped.",
      "After the timer: play back the recording for 5 minutes and note every moment you went silent for more than 30 seconds or changed direction without saying why.",
    ],
    starter: [
      {
        language: 'ts',
        title: 'src/search.ts (skeleton)',
        code: `import { LruCache } from './lru';

export type Cafe = { id: string; name: string };
export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; cafes: Cafe[] }
  | { status: 'error'; query: string; message: string };

export type Fetcher = (q: string, signal: AbortSignal) => Promise<Cafe[]>;

export function createCafeSearch(opts: {
  fetcher: Fetcher;
  onChange: (s: SearchState) => void;
  delayMs?: number;
  minLength?: number;
  cacheSize?: number;
}) {
  const { fetcher, onChange, delayMs = 300, minLength = 2, cacheSize = 20 } = opts;
  const cache = new LruCache<string, Cafe[]>(cacheSize);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let latestId = 0;

  function search(raw: string) {
    // TODO: normalise, handle min length (emit idle), check cache,
    // debounce, abort previous, fetch, ignore stale + AbortError.
  }

  function dispose() {
    // TODO: clear timer, abort in-flight request.
  }

  return { search, dispose };
}`,
      },
      {
        language: 'ts',
        title: 'src/search.test.ts (make these pass, then add your own)',
        code: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCafeSearch, type Cafe, type SearchState } from './search';

const cafe = (name: string): Cafe => ({ id: name, name });

describe('createCafeSearch', () => {
  beforeEach(() => vi.useFakeTimers());

  it('debounces: only the last query within 300ms is fetched', async () => {
    const fetcher = vi.fn(async (q: string) => [cafe(q)]);
    const states: SearchState[] = [];
    const s = createCafeSearch({ fetcher, onChange: (x) => states.push(x) });
    s.search('fl'); s.search('fla'); s.search('flat');
    await vi.advanceTimersByTimeAsync(300);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe('flat');
    expect(states.at(-1)).toEqual({ status: 'success', query: 'flat', cafes: [cafe('flat')] });
  });

  it('ignores a slow response for an older query', async () => {
    const fetcher = vi.fn(
      (q: string) => new Promise<Cafe[]>((res) => setTimeout(() => res([cafe(q)]), q === 'lat' ? 1000 : 10)),
    );
    const states: SearchState[] = [];
    const s = createCafeSearch({ fetcher, onChange: (x) => states.push(x) });
    s.search('lat');
    await vi.advanceTimersByTimeAsync(300);
    s.search('latte');
    await vi.advanceTimersByTimeAsync(2000);
    expect(states.at(-1)).toMatchObject({ status: 'success', query: 'latte' });
  });

  it('aborts the in-flight request when a new query is scheduled', async () => {
    let seen: AbortSignal | undefined;
    const fetcher = vi.fn((_q: string, signal: AbortSignal) => {
      seen ??= signal;
      return new Promise<Cafe[]>(() => {});
    });
    const s = createCafeSearch({ fetcher, onChange: () => {} });
    s.search('mocha');
    await vi.advanceTimersByTimeAsync(300);
    s.search('matcha');
    expect(seen?.aborted).toBe(true);
  });

  it.todo('emits idle and does not fetch for queries shorter than 2 chars');
  it.todo('serves a repeated query from cache without calling the fetcher');
  it.todo('does not emit error for AbortError');
});`,
      },
    ],
    expected: [
      "All provided tests pass, plus at least the three `it.todo` cases you implement.",
      "No test uses real time; the whole suite runs in well under a second.",
      "A recording of 45 minutes in which you narrate requirements, plan, progress and trade-offs.",
    ],
    hints: [
      "Emit `loading` when the debounced callback fires, not on every keystroke, or the UI will flicker.",
      "Capture `const id = ++latestId` inside the debounced callback and compare `id === latestId` before emitting.",
      "In the catch block, check `isAbortError(e)` first and return silently.",
      "If you are stuck at minute 30, say so, simplify (drop the cache), and finish the correctness pieces first.",
    ],
    verification: [
      "Run `npx vitest run` and see every test green.",
      "Temporarily remove the request id check and confirm the out-of-order test fails, proving it tests what you think.",
      "Score your recording against the rubric and write down one behaviour to change at the week 26 and week 50 checkpoints.",
    ],
  },
  successChecklist: [
    "Requirements written as a comment before any implementation",
    "LRU cache with eviction and recency tests passing",
    "Debounce, abort and stale-response tests passing with fake timers",
    "AbortError never surfaces as an error state",
    "React hook disposes the controller on unmount",
    "Recording reviewed and one improvement noted",
  ],
  questions: [
    {
      question: "Why is AbortController alone not sufficient to prevent stale results from rendering?",
      answer:
        "Abort only works if the code you call honours the signal; a third-party fetcher, a cached promise or a mock might resolve anyway. There is also a window where the response has already resolved and its continuation is queued as a microtask when you abort, so the result still arrives. A latest-request id or latest-query comparison is a pure in-process check that cannot be bypassed. Abort is the efficiency mechanism; the id check is the correctness mechanism, and you want both.",
    },
    {
      question: "How does a Map let you implement an LRU cache with O(1) operations, and what would you use in a language without ordered maps?",
      answer:
        "JavaScript Maps iterate in insertion order and delete and set are O(1) on average. Re-inserting a key on read moves it to the end (most recent), and the first key from `keys()` is the least recently used, so eviction is also O(1). In a language without an ordered hash map you combine a hash map from key to node with a doubly linked list, moving nodes to the head on access and evicting from the tail. Java's `LinkedHashMap` with access order is exactly that structure built in.",
    },
    {
      question: "What should you do in the last few minutes of a timed exercise if you are not going to finish?",
      answer:
        "Stop adding features and make what exists correct and demonstrable: get the tests you have passing and say clearly which requirements are done. Then describe concretely how you would finish the rest, for example where the cache check would go and what test would cover it. Name known gaps and risks rather than hoping they are not noticed. This shows judgement and prioritisation, which is a large part of what a practical round assesses.",
    },
  ],
  explainPrompt:
    "Explain your search controller to an interviewer who has just watched you build it: the bugs it prevents, how each mechanism works, how you tested it, and what you would add for production.",
  rubric: [
    "Names the four failure modes (load, out-of-order, wasted work, repeated work) and maps each to a mechanism",
    "Distinguishes abort (efficiency) from the request id check (correctness)",
    "Explains why fake timers make the tests deterministic",
    "Justifies the state shape as a discriminated union",
    "Mentions at least two production follow-ups (TTL, retry, metrics, minimum length tuning)",
    "Stays structured: problem, approach, testing, trade-offs, next steps",
  ],
  referenceExplanation:
    "The search box had four problems: a request per keystroke, results arriving out of order so the list could show an old query, wasted in-flight requests, and refetching queries we had already seen. I addressed each one separately. A 300 ms debounce resets a timer on each call, so we only search once typing pauses. When a debounced search fires I abort the previous AbortController, which cancels the network request, and I also increment a request id and only emit a result if its id is still the latest. Abort saves bandwidth, but the id check is what guarantees correctness even if the fetcher ignores the signal. An AbortError is swallowed because it is expected, not a failure. Results go into a 20-entry LRU cache built on Map insertion order, so a repeated query renders instantly, and keys are trimmed and lowercased. State is a discriminated union of idle, loading, success and error, so the UI cannot be in a contradictory state. The core is plain TypeScript, tested with Vitest fake timers, so each test is deterministic and runs in milliseconds; I proved the stale-response test is meaningful by deleting the id check and watching it fail. The React hook is a thin wrapper that calls search in an effect and disposes on unmount. For production I would add a TTL so opening hours do not go stale, a retry with backoff for transient errors, and a metric for search latency and abort rate.",
  stretch: {
    title: 'Add stale-while-revalidate',
    description:
      "Change the cache so entries older than 60 seconds are still shown immediately but trigger a background refetch that replaces them if the query is still current. Write a test using `vi.setSystemTime` to age an entry.",
  },
  lightTask:
    "Set a 30-minute timer and implement only the LRU cache plus the debounce test from the starter, narrating aloud as you go; then write three sentences on what you would build next.",
  intensiveExtras: [
    "Repeat the exercise from a blank file a second time with a different problem: a rate-limited `useAutosave` hook for NearBrew review drafts (debounce plus flush on unmount).",
    "Build a small Vite page that uses the hook against a fake fetcher with random 50 to 800 ms latency, and type fast to watch stale results never appear.",
    "Implement the LRU with a hand-written doubly linked list and compare it to the Map version for clarity and test coverage.",
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['js-ts', 'react-architecture', 'technical-communication', 'cs-fundamentals'],
  depth: 'standard',
};

/* ------------------------------------------------------------------ */
/* Week 14 — Data structures in practice                               */
/* ------------------------------------------------------------------ */

const week14: Lesson = {
  week: 14,
  slug: 'data-structures-big-o-product-code',
  title: 'Data structures in practice: arrays, hash maps, sets, heaps and Big-O for product code',
  track: 'cs',
  secondaryTracks: ['frontend', 'backend'],
  topics: ['Big-O', 'arrays', 'Map', 'Set', 'heap', 'top-k', 'hidden quadratic', 'benchmarking'],
  objective:
    "By the end you can spot accidental O(n^2) code in a code review, pick the right built-in structure, and implement a top-k heap for a nearby-cafés feature.",
  whyItMatters:
    "Most performance bugs in product code are not exotic algorithms; they are an `includes` inside a `filter`, a spread inside a `reduce`, or a full sort to take ten items. These are invisible with 50 rows in development and painful with 50,000 rows on a low-end phone or in a request handler.",
  explanation: [
    "Big-O describes how cost grows as input grows, ignoring constants. For product code the useful mental model is: O(1) and O(log n) are free, O(n) is fine if you do it once, O(n log n) is the price of sorting, and O(n^2) is a bug waiting for real data. At n = 1,000, n^2 is a million operations, which is still fast; at n = 50,000 it is 2.5 billion, which freezes a UI thread. The danger is that tests and local seed data rarely hit the size where it matters.",
    "Arrays are contiguous lists: indexing is O(1), `push`/`pop` are amortised O(1), but `shift`/`unshift` and `splice` in the middle are O(n) because elements move. Searching an unsorted array (`includes`, `indexOf`, `find`) is O(n). That is perfect for small fixed lists and terrible inside another loop. The classic hidden quadratic is `cafes.filter(c => favouriteIds.includes(c.id))`, which is O(cafes x favourites). Building `const favs = new Set(favouriteIds)` first makes each lookup average O(1) and the whole thing O(n + m).",
    "`Map` and `Set` are hash tables: average O(1) insert, lookup and delete, iteration in insertion order. Prefer `Map` over plain objects for dynamic keys: it accepts any key type, has a real `size`, does not collide with prototype keys like `constructor`, and is optimised for frequent additions and deletions. Group-by and join operations should almost always build an index first: turning reviews into `Map<cafeId, Review[]>` in one pass, then looking up per café, is the in-memory equivalent of the hash join Postgres chose in week 1.",
    "Watch out for quadratic patterns hidden by nice syntax. `items.reduce((acc, x) => ({ ...acc, [x.id]: x }), {})` copies the accumulator on every iteration, so it is O(n^2) in time and allocation. `arr = [...arr, x]` inside a loop is the same. `array.sort()` inside a render or inside a loop multiplies O(n log n) by the loop count. And in React, an O(n) computation that runs on every render of a component that re-renders on every keystroke is effectively O(n x keystrokes); week 2's `useMemo` is the fix when the inputs are stable.",
    "A heap (priority queue) keeps the smallest (or largest) element at the root with O(log n) push and pop. JavaScript has no built-in one, but it is about 40 lines on top of an array where the children of index `i` are `2i + 1` and `2i + 2`. The product use case is top-k: 'the 10 nearest open cafés out of 50,000'. Sorting everything is O(n log n). A max-heap of size k, where you push each café and pop the farthest whenever size exceeds k, is O(n log k). With k = 10, log k is about 3, versus about 16 for log n, and you never allocate a sorted copy of the whole list.",
    "Finally, measure before and after. Big-O tells you the shape, but constants, memory allocation and JIT behaviour decide real timings, and for n below about a hundred, a simple array scan often beats a hash table. Use `performance.now()` around the operation, run it several times to let the JIT warm up, and test at realistic sizes (your production row counts, not your seed file). The senior skill is not reciting complexities; it is recognising which code paths see large n and making those linear or better.",
  ],
  examples: [
    {
      language: 'ts',
      title: 'Hidden quadratics and their linear fixes',
      code: `// O(cafes * favourites): includes is a linear scan
const favCafes = cafes.filter((c) => favouriteIds.includes(c.id));
// O(cafes + favourites)
const favSet = new Set(favouriteIds);
const favCafesFast = cafes.filter((c) => favSet.has(c.id));

// O(n^2): copies acc every iteration
const byIdSlow = cafes.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, Cafe>);
// O(n)
const byId = new Map(cafes.map((c) => [c.id, c] as const));

// Join reviews to cafes: build an index once, O(n + m)
const reviewsByCafe = new Map<string, Review[]>();
for (const r of reviews) {
  const list = reviewsByCafe.get(r.cafeId);
  if (list) list.push(r);
  else reviewsByCafe.set(r.cafeId, [r]);
}`,
    },
  ],
  keyTakeaways: [
    "An `includes`/`find`/`indexOf` inside a loop is O(n x m); build a Set or Map first.",
    "Spreading an accumulator in `reduce` is quadratic; mutate a local Map or object instead.",
    "Map beats plain objects for dynamic keys: any key type, real size, no prototype collisions.",
    "Top-k with a size-k heap is O(n log k) and avoids sorting the whole collection.",
    "Measure at production sizes; for tiny n, simple arrays are often fastest.",
  ],
  prerequisites: [
    "Comfortable with JavaScript arrays and higher-order functions",
    "Basic idea of what Big-O notation means",
  ],
  prerequisiteWeeks: [2, 5],
  resources: [
    {
      title: 'MDN: Map (including Objects vs. Maps)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map',
      kind: 'docs',
      note: "Read the 'Objects vs. Maps' comparison table and the section on key equality.",
      minutes: 8,
    },
    {
      title: 'MDN: Set',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set',
      kind: 'docs',
      note: "Skim the description and note that lookup is required to be sublinear on average.",
      minutes: 5,
    },
    {
      title: 'NeetCode roadmap',
      url: 'https://neetcode.io/roadmap',
      kind: 'practice',
      note: "Look only at the Arrays and Hashing and Heap / Priority Queue nodes to see the canonical problems; do not start grinding, just note the patterns this week covers.",
      minutes: 7,
    },
    {
      title: 'MDN: performance.now()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Performance/now',
      kind: 'docs',
      note: "Read how it differs from `Date.now()` for measuring short durations.",
      minutes: 5,
    },
    {
      title: 'Big-O Cheat Sheet',
      url: 'https://www.bigocheatsheet.com/',
      kind: 'article',
      note: "Use the 'Common Data Structure Operations' table as a lookup reference, not something to memorise.",
      minutes: 5,
      verify: true,
    },
  ],
  exercise: {
    title: 'Profile and fix NearBrew list operations at 50,000 cafés',
    scenario:
      "NearBrew is expanding to a whole country. The client-side 'favourites', 'reviews per café' and 'nearest 10' features were written for a city of 300 cafés and now stutter. You have a script that generates realistic data; find the slow paths, fix them, and prove the improvement with numbers.",
    setup: [
      "mkdir ds-practice && cd ds-practice && npm init -y && npm i -D tsx typescript",
      "Create `data.ts`, `slow.ts`, `heap.ts` and `bench.ts` from the starter.",
      "Run with `npx tsx bench.ts`.",
    ],
    steps: [
      "Read `slow.ts` and, before running anything, write the Big-O of each function as a comment, in terms of C (cafés), F (favourites) and R (reviews).",
      "Run the benchmark at C = 5,000 and then C = 50,000 and record the timings. Check whether the growth matches your predictions (10x input should mean about 10x for linear and about 100x for quadratic).",
      "Rewrite `favouriteCafes` using a Set and `indexById` using a Map, keeping the same return shapes.",
      "Rewrite `attachReviews` to build a `Map<cafeId, Review[]>` in one pass, then map over cafés.",
      "Implement `MaxHeap` in `heap.ts` (push, pop, peek, size) and use it to write `nearestK(cafes, k)` in O(n log k). Compare its output with the sort-based version for equality.",
      "Re-run the benchmark at both sizes, and put a before and after table in a comment at the top of `bench.ts`.",
      "Find one similar pattern in your real NearBrew codebase (search for `.includes(` and `.find(` inside `.map(`/`.filter(`) and decide whether n there can actually get large.",
    ],
    starter: [
      {
        language: 'ts',
        title: 'data.ts',
        code: `export type Cafe = { id: string; name: string; lat: number; lng: number };
export type Review = { id: string; cafeId: string; rating: number };

export function makeData(c: number, reviewsPerCafe = 4) {
  const cafes: Cafe[] = Array.from({ length: c }, (_, i) => ({
    id: 'cafe_' + i,
    name: 'Cafe ' + i,
    lat: 51.5 + Math.random(),
    lng: -0.1 + Math.random(),
  }));
  const reviews: Review[] = [];
  for (let i = 0; i < c * reviewsPerCafe; i++) {
    reviews.push({ id: 'r_' + i, cafeId: 'cafe_' + Math.floor(Math.random() * c), rating: 1 + Math.floor(Math.random() * 5) });
  }
  const favouriteIds = cafes.filter(() => Math.random() < 0.1).map((x) => x.id);
  return { cafes, reviews, favouriteIds };
}`,
      },
      {
        language: 'ts',
        title: 'slow.ts',
        code: `import type { Cafe, Review } from './data';

export function favouriteCafes(cafes: Cafe[], favouriteIds: string[]) {
  return cafes.filter((c) => favouriteIds.includes(c.id));
}

export function indexById(cafes: Cafe[]) {
  return cafes.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, Cafe>);
}

export function attachReviews(cafes: Cafe[], reviews: Review[]) {
  return cafes.map((c) => ({ ...c, reviews: reviews.filter((r) => r.cafeId === c.id) }));
}

const dist2 = (c: Cafe, lat: number, lng: number) => (c.lat - lat) ** 2 + (c.lng - lng) ** 2;

export function nearestKSort(cafes: Cafe[], lat: number, lng: number, k: number) {
  return [...cafes].sort((a, b) => dist2(a, lat, lng) - dist2(b, lat, lng)).slice(0, k);
}`,
      },
      {
        language: 'ts',
        title: 'heap.ts (skeleton)',
        code: `export class MaxHeap<T> {
  private items: T[] = [];
  constructor(private readonly score: (x: T) => number) {}

  get size() { return this.items.length; }
  peek(): T | undefined { return this.items[0]; }

  push(x: T) {
    this.items.push(x);
    // TODO: sift up from the last index while parent score < child score
  }

  pop(): T | undefined {
    // TODO: swap root with last, remove last, sift down from 0
    return undefined;
  }
}`,
      },
      {
        language: 'ts',
        title: 'bench.ts',
        code: `import { makeData } from './data';
import * as slow from './slow';

function time(label: string, fn: () => unknown) {
  fn(); // warm up
  const t0 = performance.now();
  fn();
  console.log(label.padEnd(24), (performance.now() - t0).toFixed(1), 'ms');
}

for (const n of [5_000, 50_000]) {
  const { cafes, reviews, favouriteIds } = makeData(n);
  console.log('--- cafes =', n);
  time('favouriteCafes', () => slow.favouriteCafes(cafes, favouriteIds));
  time('indexById', () => slow.indexById(cafes));
  time('attachReviews', () => slow.attachReviews(cafes, reviews));
  time('nearestKSort', () => slow.nearestKSort(cafes, 51.9, 0.3, 10));
}`,
      },
    ],
    expected: [
      "The slow `attachReviews` and `indexById` grow roughly 100x from 5k to 50k cafés; `indexById` may take seconds at 50k.",
      "The fixed versions grow roughly 10x and finish in single or low double-digit milliseconds at 50k.",
      "`nearestK` with the heap returns the same 10 cafés as the sort version (order aside) and is measurably faster at 50k.",
    ],
    hints: [
      "In a max-heap the parent of index i is `Math.floor((i - 1) / 2)`.",
      "For top-k nearest, keep a max-heap by distance; when size exceeds k, pop, which removes the farthest of the current candidates.",
      "Pop the heap into an array and reverse it to get nearest-first order.",
      "If `attachReviews` at 50k takes too long to wait for, benchmark the slow version at 20k instead and extrapolate.",
    ],
    verification: [
      "Write a quick assertion that the slow and fast versions return equal results (compare sorted ids) for C = 2,000.",
      "Your before and after table shows linear growth for every fixed function.",
      "You can state the Big-O of each original and fixed function without looking.",
    ],
  },
  successChecklist: [
    "Big-O written for each slow function before running it",
    "Timings recorded at two sizes, confirming the predicted growth",
    "Set, Map and index-then-join rewrites with equal outputs",
    "Working MaxHeap and an O(n log k) nearestK",
    "One real pattern from your own codebase assessed",
  ],
  questions: [
    {
      question: "Why is `reduce` with an object spread accumulator quadratic, and what is the linear alternative?",
      answer:
        "Each iteration creates a new object and copies every key accumulated so far, so iteration i costs O(i), and summing over n iterations gives O(n^2) time plus O(n^2) garbage. The fix is to mutate a single accumulator you own, either a local object or, better, a Map, which is O(1) per insertion. Mutation is perfectly safe here because the accumulator never escapes until the function returns. `Object.fromEntries` or `new Map(array.map(...))` are clean one-pass alternatives.",
    },
    {
      question: "When would you not bother replacing an array scan with a Set?",
      answer:
        "When n is small and bounded, such as a list of five filter chips or the days of the week, because a linear scan over a handful of items is extremely fast and building a Set has its own allocation cost. It also does not matter if the code runs once rather than inside a loop or a frequent render. The question to ask is whether either collection can grow with user data or business growth. If yes, or if the code is inside another loop, index it.",
    },
    {
      question: "Explain why top-k with a heap of size k is O(n log k) and when sorting is still fine.",
      answer:
        "You visit each of the n items once, and each push or pop on a heap holding at most k + 1 items costs O(log k), giving O(n log k). Sorting the whole array costs O(n log n) and allocates a full copy. When k is close to n, or n is a few hundred, the difference is negligible and a sort is simpler and easier to read. A heap pays off when n is large and k is small, for example the 10 nearest out of tens of thousands, or a server streaming items it cannot hold in memory.",
    },
  ],
  explainPrompt:
    "Explain to a mid-level teammate in a code review why their `filter` plus `includes` and their `reduce` with spread will hurt at scale, and how to fix them without making the code harder to read.",
  rubric: [
    "Gives the Big-O of the original code in terms of the actual inputs",
    "Uses concrete numbers to show when it becomes a problem",
    "Proposes the Set/Map fix with a short code example",
    "Acknowledges when the original would be fine (small, bounded n)",
    "Suggests how to verify with a measurement",
  ],
  referenceExplanation:
    "Both of these work today because our test city has a few hundred cafés, but they grow quadratically. The `filter` with `favouriteIds.includes` scans the whole favourites array for every café, so it is cafés times favourites. With 50,000 cafés and 5,000 favourites that is 250 million comparisons, on the UI thread. If we build `const favSet = new Set(favouriteIds)` once, each lookup is constant time on average and the total is cafés plus favourites, so the same data takes a few milliseconds. The `reduce` that spreads the accumulator is subtler: every iteration copies every key added so far, so the cost is one plus two plus three, up to n, which is n squared, and it creates a lot of garbage for the GC. Building a `Map` with `new Map(cafes.map(c => [c.id, c]))` is one pass and reads just as clearly; the Map also gives us a real `size` and avoids prototype key collisions. I measured both with the country-sized dataset: the index went from about four seconds to about five milliseconds. If these lists were capped at, say, ten items, I would not ask you to change anything, but both grow with our user base, so I would rather fix them now while the code is fresh.",
  stretch: {
    title: 'Streaming top-k on the server',
    description:
      "Write a Node script that reads a 1-million-line NDJSON file of check-ins line by line and maintains the top 20 cafés by check-in count using a Map of counts plus a final heap, keeping memory flat. Compare memory with loading the file and sorting.",
  },
  lightTask:
    "Take the `slow.ts` starter, write the Big-O of each function, then fix `favouriteCafes` and `indexById` and measure both at 50,000 cafés.",
  intensiveExtras: [
    "Solve two NeetCode Arrays and Hashing problems (for example Two Sum and Group Anagrams) and relate each to a product scenario.",
    "Implement a min-heap based scheduler that pops the next café to re-sync opening hours by `nextSyncAt`.",
    "Profile one real NearBrew screen with the React Profiler and look for an O(n) computation that runs on every render.",
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['cs-fundamentals', 'js-ts', 'rendering-performance'],
  depth: 'standard',
};

/* ------------------------------------------------------------------ */
/* Week 15 — React state architecture                                  */
/* ------------------------------------------------------------------ */

const week15: Lesson = {
  week: 15,
  slug: 'react-server-vs-client-state',
  title: 'React state architecture: server vs client state, data fetching and client caching',
  track: 'frontend',
  topics: ['server state', 'client state', 'URL state', 'TanStack Query', 'query keys', 'staleTime', 'optimistic updates', 'derived state'],
  objective:
    "By the end you can classify every piece of state in a screen, move server state into a query cache with sensible staleness and invalidation, and implement an optimistic mutation with rollback.",
  whyItMatters:
    "Most React state bugs come from treating a copy of server data as if the client owned it: duplicated fetches, stale lists after a mutation, spinners on every navigation, and race conditions in hand-written `useEffect` fetching. A clear state taxonomy shrinks code and removes whole classes of bugs.",
  explanation: [
    "Start by classifying state. **Server state** is owned by the backend and you only hold a cached snapshot: cafés, reviews, the user's favourites. It can change without you knowing, it is shared across components, and it needs fetching, caching, deduplication, refetching and invalidation. **Client state** is owned by the UI: whether a sheet is open, the draft text of a review, the selected tab. **URL state** is client state that should survive reloads and be shareable: search query, filters, the selected café id. **Derived state** is anything computable from the others, such as 'open now' cafés from the list plus the current time; it should be computed during render, not stored.",
    "The common anti-pattern is fetching in `useEffect` and copying the result into `useState`, then into a global store. Each copy can drift. You have to handle loading, errors, race conditions (week 13), deduplication when two components need the same data, and refetching when the user returns to the tab. A server-state library such as TanStack Query centralises that: data lives in a cache keyed by a **query key**, components subscribe with `useQuery({ queryKey, queryFn })`, and the library dedupes concurrent requests, caches results, and refetches on configurable triggers.",
    "Query keys are the core design decision. They should be arrays that contain every input the request depends on, for example `['cafes', 'list', { q, openNow, near }]` and `['cafes', 'detail', cafeId]`. Because the key includes the filters, changing a filter is a new cache entry, and going back to a previous filter is instant. Hierarchical keys let you invalidate broadly: `queryClient.invalidateQueries({ queryKey: ['cafes'] })` marks every café query stale. A good habit is a small key factory object so keys are not hand-typed in ten places.",
    "Two timers matter in TanStack Query v5. `staleTime` (default 0) is how long data is considered fresh; fresh data is served from cache with no refetch. Stale data is still shown immediately, but a background refetch happens on triggers such as mount, window focus and reconnect. `gcTime` (default five minutes, called `cacheTime` before v5) is how long an unused entry stays in memory after the last subscriber unmounts. This is week 4's caching trade-off on the client: café details can have a `staleTime` of a minute or more; a booking slot availability list should be near zero.",
    "Mutations change server state, so after one succeeds you either invalidate the affected queries (simple, always correct, costs a refetch) or write the new data into the cache with `setQueryData` (faster, but you must get the shape right). For a snappy favourite toggle, use an **optimistic update**: in `onMutate`, cancel in-flight queries for that key, snapshot the previous value, write the optimistic value, and return the snapshot; in `onError`, restore it; in `onSettled`, invalidate to reconcile with the server. That ordering matters: without cancelling, an in-flight refetch can land after your optimistic write and overwrite it with old data.",
    "What remains is small. Client state usually fits in `useState` or `useReducer` close to where it is used, lifted only as far as needed; a global store is justified for genuinely app-wide UI state such as auth session or theme, not for server data. URL state belongs in the router's search params so back/forward and sharing work. A quick audit question for any `useState`: who owns this data, and could it be computed from something else? If the server owns it, it belongs in the query cache; if it can be computed, compute it.",
  ],
  examples: [
    {
      language: 'tsx',
      title: 'Query key factory and an optimistic favourite toggle (TanStack Query v5)',
      code: `import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const cafeKeys = {
  all: ['cafes'] as const,
  list: (f: { q: string; openNow: boolean }) => [...cafeKeys.all, 'list', f] as const,
  favourites: () => [...cafeKeys.all, 'favourites'] as const,
};

export function useFavourites() {
  return useQuery({
    queryKey: cafeKeys.favourites(),
    queryFn: () => api.getFavouriteIds(),
    staleTime: 60_000,
  });
}

export function useToggleFavourite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cafeId: string) => api.toggleFavourite(cafeId),
    onMutate: async (cafeId) => {
      await qc.cancelQueries({ queryKey: cafeKeys.favourites() });
      const previous = qc.getQueryData<string[]>(cafeKeys.favourites());
      qc.setQueryData<string[]>(cafeKeys.favourites(), (old = []) =>
        old.includes(cafeId) ? old.filter((id) => id !== cafeId) : [...old, cafeId],
      );
      return { previous };
    },
    onError: (_err, _cafeId, ctx) => {
      if (ctx?.previous) qc.setQueryData(cafeKeys.favourites(), ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: cafeKeys.favourites() }),
  });
}`,
    },
  ],
  keyTakeaways: [
    "Classify state: server, client, URL, derived. Each has a different home.",
    "Server state is a cache of someone else's data; let a query cache own it rather than copying it into useState or a global store.",
    "Query keys must include every input; hierarchical keys enable broad invalidation.",
    "`staleTime` controls refetching, `gcTime` controls memory retention; tune per data type.",
    "Optimistic updates: cancel, snapshot, write, roll back on error, invalidate on settle.",
    "Derived state is computed during render, never stored and synchronised.",
  ],
  prerequisites: [
    "Solid React hooks knowledge",
    "Understanding of HTTP caching and invalidation trade-offs",
  ],
  prerequisiteWeeks: [2, 4, 6, 13],
  resources: [
    {
      title: 'react.dev: Choosing the State Structure',
      url: 'https://react.dev/learn/choosing-the-state-structure',
      kind: 'docs',
      note: "Read the principles, especially 'avoid redundant state' and 'avoid duplication in state'.",
      minutes: 8,
    },
    {
      title: 'react.dev: You Might Not Need an Effect',
      url: 'https://react.dev/learn/you-might-not-need-an-effect',
      kind: 'docs',
      note: "Read the sections on computing derived data during render and on fetching data.",
      minutes: 8,
    },
    {
      title: 'TanStack Query: Overview (React)',
      url: 'https://tanstack.com/query/latest/docs/framework/react/overview',
      kind: 'docs',
      note: "Read Overview, then the guides on Query Keys, Important Defaults and Optimistic Updates.",
      minutes: 12,
      verify: true,
    },
    {
      title: 'TkDodo: Practical React Query (blog series)',
      url: 'https://tkdodo.eu/blog/practical-react-query',
      kind: 'article',
      note: "Read the first post; the series by a TanStack Query maintainer covers query key factories and status checks in depth.",
      minutes: 10,
      verify: true,
    },
  ],
  exercise: {
    title: 'Refactor a NearBrew screen from useEffect fetching to a query cache',
    scenario:
      "The NearBrew web companion has a café list with search and an 'open now' filter, a detail panel, and a favourite heart. It fetches with `useEffect`, stores results in `useState`, and duplicates favourites in a context. After favouriting, the list heart and the detail heart disagree, and revisiting a filter shows a spinner every time.",
    setup: [
      "npm create vite@latest nearbrew-state -- --template react-ts && cd nearbrew-state && npm i @tanstack/react-query",
      "Add `src/api.ts` from the starter: an in-memory fake API with 300 to 900 ms latency and a 20% failure rate on `toggleFavourite`.",
      "Wrap the app in `QueryClientProvider` with a `new QueryClient()`.",
    ],
    steps: [
      "Write the 'before' version quickly: a `CafeList` that fetches in `useEffect` on `[q, openNow]`, and a `Detail` that fetches the selected café. Note every bug you can trigger by typing fast and toggling favourites.",
      "Make a state inventory: list every `useState` and context value and label it server, client, URL or derived.",
      "Create the `cafeKeys` factory and replace the list and detail fetching with `useQuery`. Set `staleTime` for the list to 30 seconds and for details to 5 minutes, and write one sentence justifying each.",
      "Move `q` and `openNow` into URL search params (`URLSearchParams` and `history.replaceState` is enough without a router) so reload and sharing work.",
      "Delete the favourites context. Implement `useFavourites` and `useToggleFavourite` with an optimistic update and rollback as in the example.",
      "Use `placeholderData: keepPreviousData` (imported from `@tanstack/react-query`) on the list query so changing filters keeps the old list visible with a subtle loading indicator instead of a blank spinner.",
      "Install `@tanstack/react-query-devtools`, add it, and watch entries go fresh, stale and inactive as you navigate.",
    ],
    starter: [
      {
        language: 'ts',
        title: 'src/api.ts (fake backend)',
        code: `export type Cafe = { id: string; name: string; openNow: boolean };

const CAFES: Cafe[] = Array.from({ length: 40 }, (_, i) => ({
  id: String(i),
  name: ['Flat', 'Bean', 'Roast', 'Crema', 'Drip'][i % 5] + ' ' + i,
  openNow: i % 3 !== 0,
}));
let favourites = new Set<string>(['1', '4']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => sleep(300 + Math.random() * 600);

export const api = {
  async listCafes(f: { q: string; openNow: boolean }): Promise<Cafe[]> {
    await latency();
    const q = f.q.trim().toLowerCase();
    return CAFES.filter((c) => c.name.toLowerCase().includes(q) && (!f.openNow || c.openNow));
  },
  async getCafe(id: string): Promise<Cafe> {
    await latency();
    const cafe = CAFES.find((c) => c.id === id);
    if (!cafe) throw new Error('Not found');
    return cafe;
  },
  async getFavouriteIds(): Promise<string[]> {
    await latency();
    return [...favourites];
  },
  async toggleFavourite(id: string): Promise<void> {
    await latency();
    if (Math.random() < 0.2) throw new Error('Network error');
    favourites = new Set(favourites);
    if (favourites.has(id)) favourites.delete(id);
    else favourites.add(id);
  },
};`,
      },
    ],
    expected: [
      "Revisiting a previous filter within 30 seconds renders instantly from cache with no spinner.",
      "The heart toggles instantly in both list and detail; on a simulated failure it flips back and you show a toast.",
      "Fast typing never shows results for an older query.",
      "Devtools show one network request when two components use the same favourites query.",
    ],
    hints: [
      "Pass the whole filter object into the key; TanStack Query hashes keys deterministically, so object property order does not matter.",
      "TanStack Query does not debounce for you; debounce the value that feeds the key (week 13).",
      "If the optimistic heart flickers back briefly, you probably forgot `cancelQueries` in `onMutate`.",
      "Show `isFetching` (background refresh) differently from `isPending` (no data yet).",
    ],
    verification: [
      "Your state inventory has no server data left in `useState` or context.",
      "Force `toggleFavourite` to always fail and confirm rollback works for both hearts.",
      "Reload with `?q=flat&openNow=1` in the URL and the filtered list appears.",
      "Line count of the data layer is lower than the 'before' version.",
    ],
  },
  successChecklist: [
    "State inventory labelled server, client, URL, derived",
    "Key factory used everywhere; no hand-typed keys",
    "Justified staleTime values per query",
    "Optimistic toggle with rollback and settle invalidation",
    "Filters live in the URL",
    "Previous data kept visible while filters change",
  ],
  questions: [
    {
      question: "What is the difference between staleTime and gcTime, and how would you set them for café details vs booking slot availability?",
      answer:
        "`staleTime` is how long cached data is treated as fresh; while fresh, mounting a component or refocusing the window does not trigger a refetch. `gcTime` is how long a cache entry with no subscribers is kept in memory before being garbage collected. Café details change rarely, so a staleTime of several minutes avoids needless requests while still showing data instantly. Slot availability changes constantly and showing stale slots causes failed bookings, so staleTime should be zero or a few seconds, and the server must still reject conflicting bookings because the client cache can never be authoritative.",
    },
    {
      question: "Why do you call cancelQueries in onMutate during an optimistic update?",
      answer:
        "There may be a refetch in flight for the same key, started before the user clicked. If it resolves after you write the optimistic value, it overwrites the cache with server data from before the mutation, and the UI flips back incorrectly. Cancelling those queries first ensures your optimistic value stays until the mutation settles. The final `invalidateQueries` in `onSettled` then fetches the true state once the server has applied the change.",
    },
    {
      question: "Why is storing derived state, such as a filtered list, in useState a problem?",
      answer:
        "It creates two sources of truth that must be kept in sync, usually by an effect that runs after render, which causes an extra render with stale values and bugs when one input changes but the effect's dependencies miss it. Computing the filtered list during render from the source data and the filter is always consistent by construction. If the computation is expensive, wrap it in `useMemo` keyed on its inputs rather than storing it. The rule is to store the minimal state and derive everything else.",
    },
  ],
  explainPrompt:
    "Explain to a new frontend teammate joining the NearBrew web project how state is organised, where a new piece of state should go, and why we do not put API responses in a global store.",
  rubric: [
    "Defines server, client, URL and derived state with NearBrew examples",
    "Explains what the query cache gives you (dedupe, caching, background refetch, invalidation)",
    "Explains query keys and staleTime choices",
    "Describes the optimistic update sequence and why each step exists",
    "Gives a simple decision rule for new state",
  ],
  referenceExplanation:
    "We split state by who owns it. Cafés, reviews and your favourites are server state: the backend owns them, and we only hold a cached copy that can go out of date. That lives in TanStack Query, keyed by arrays from our `cafeKeys` factory, such as the list key with the current filters. The cache dedupes requests when two components need the same data, shows cached data instantly, and refetches in the background when it is stale. We set staleTime per data type: café details for five minutes because they rarely change, the list for thirty seconds. Filters and the selected café are URL state, kept in search params so reload, back and sharing work. UI-only things such as whether the review sheet is open are client state in useState next to the component. Anything we can compute, like 'open now' from the list and the clock, we compute during render. We do not copy API responses into a global store because then there are two sources of truth and we have to rebuild caching, invalidation and race handling by hand. Mutations either invalidate the affected keys or, for the favourite heart, do an optimistic update: cancel in-flight queries, snapshot, write the new value, roll back on error, and invalidate when settled. So for new state, ask: does the server own it? Query cache. Should it survive a reload? URL. Can it be computed? Compute it. Otherwise, local state.",
  stretch: {
    title: 'Prefetch on intent',
    description:
      "Prefetch café details on hover or focus of a list row using `queryClient.prefetchQuery`, and measure how often the detail panel opens with data already cached. Discuss the bandwidth trade-off on mobile.",
  },
  lightTask:
    "Make a state inventory of one real NearBrew screen, labelling each piece of state server, client, URL or derived, and write the query key and staleTime you would use for each server-state item.",
  intensiveExtras: [
    "Add infinite scrolling to the list with `useInfiniteQuery` and a cursor from week 3's pagination design.",
    "Write a Vitest plus Testing Library test for the optimistic toggle that forces an API failure and asserts the rollback.",
    "Implement the same favourites feature with `useSyncExternalStore` and a tiny hand-written cache to understand what the library does for you.",
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['react-architecture', 'consumer-ui', 'ui-reliability'],
  depth: 'standard',
};

/* ------------------------------------------------------------------ */
/* Week 16 — SQL query optimization                                    */
/* ------------------------------------------------------------------ */

const week16: Lesson = {
  week: 16,
  slug: 'sql-query-optimization-joins-n-plus-one',
  title: 'SQL query optimization: joins, N+1, composite and partial indexes, pagination queries',
  track: 'backend',
  topics: ['N+1 queries', 'join algorithms', 'composite indexes', 'partial indexes', 'covering indexes', 'keyset pagination', 'LATERAL', 'EXPLAIN ANALYZE'],
  objective:
    "By the end you can detect and remove N+1 queries, design composite and partial indexes from a query's WHERE and ORDER BY, and replace OFFSET pagination with keyset pagination, proving each change with EXPLAIN ANALYZE.",
  whyItMatters:
    "Slow endpoints in production are dominated by a few patterns: hundreds of tiny queries from a loop, an index whose column order does not match the query, and deep OFFSET pages that scan and discard thousands of rows. Fixing these is usually a one-line change once you can read the plan.",
  explanation: [
    "The **N+1** problem is one query for a list, then one query per row for related data: load 50 cafés, then run `SELECT ... FROM reviews WHERE cafe_id = $1` 50 times. Each query might take 1 ms in the database, but every round trip also pays network latency, connection-pool contention and driver overhead, so a page that should take 10 ms takes 150 ms and degrades badly under load. It hides behind ORMs (lazy-loaded relations) and GraphQL resolvers. The fixes are to fetch the related rows in one query with `WHERE cafe_id = ANY($1)` and group them in application code (the batching pattern behind DataLoader), or to do the work in SQL with a join or aggregate.",
    "Postgres has three join algorithms and the planner picks by estimated row counts. A **nested loop** runs the inner side once per outer row; it is excellent when the outer side is small and the inner side has an index on the join key. A **hash join** builds a hash table on the smaller input and probes it with the larger; it is good for large unsorted inputs without useful indexes. A **merge join** walks two inputs already sorted on the join key. When a plan is bad, it is usually because estimates are wrong (compare `rows=` estimated versus actual in `EXPLAIN ANALYZE`), often fixed by `ANALYZE` on the table, or because an index the nested loop needs is missing.",
    "A **composite index** on `(a, b, c)` is sorted by a, then b within a, then c. It can serve a query that filters on a leading prefix of the columns. The practical rule: put columns tested with equality first, then the column used for a range or for ORDER BY. For 'the latest reviews of café X', `WHERE cafe_id = $1 ORDER BY created_at DESC LIMIT 20`, the index `(cafe_id, created_at DESC)` lets Postgres jump to café X and read 20 entries already in order, with no sort. An index on `(created_at, cafe_id)` cannot do that, because rows for café X are scattered throughout it. Postgres can scan a b-tree backwards, so `(cafe_id, created_at)` also works for DESC; explicit direction matters when you mix directions across columns.",
    "A **partial index** indexes only rows matching a predicate: `CREATE INDEX ... ON reviews (cafe_id, created_at) WHERE deleted_at IS NULL`. If 30% of rows are soft-deleted or 95% of bookings are in the past, a partial index is smaller, faster to scan and cheaper to maintain, and the planner will use it when the query's WHERE clause implies the index predicate. A **covering index** adds non-key columns with `INCLUDE (rating)` so the query can be answered from the index alone; look for `Index Only Scan` and a low `Heap Fetches` count (which depends on the visibility map being up to date after VACUUM).",
    "OFFSET pagination (`ORDER BY created_at DESC LIMIT 20 OFFSET 10000`) must produce and discard 10,000 rows before returning 20, so cost grows with page depth, and rows shift between pages when new data arrives. **Keyset pagination** (week 3's cursor) remembers the last row's sort key and asks for the rows after it: `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20`. With an index on `(created_at DESC, id DESC)`, every page is an index seek plus 20 entries, regardless of depth. The `id` tiebreaker makes the ordering total so no row is skipped or duplicated when timestamps collide; Postgres row comparison handles the compound comparison correctly.",
    "For 'top N per group' queries, such as the three latest reviews for each of 50 cafés on a list page, a `LATERAL` join runs a small indexed subquery per outer row: `FROM cafes c CROSS JOIN LATERAL (SELECT ... FROM reviews r WHERE r.cafe_id = c.id ORDER BY created_at DESC LIMIT 3) r`. It looks like N+1 but executes inside one query as a nested loop of index seeks, with no network round trips. The workflow is always the same as week 1: capture the real query, run `EXPLAIN (ANALYZE, BUFFERS)`, form a hypothesis, change one thing, and compare actual time and buffers.",
  ],
  examples: [
    {
      language: 'sql',
      title: 'Composite, partial and keyset patterns for NearBrew reviews',
      code: `-- Latest reviews for one cafe, skipping soft-deleted rows
CREATE INDEX reviews_cafe_recent_live
  ON reviews (cafe_id, created_at DESC, id DESC)
  INCLUDE (rating)
  WHERE deleted_at IS NULL;

-- Page 1
SELECT id, rating, created_at
FROM reviews
WHERE cafe_id = 42 AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Next page: pass the last row's (created_at, id) as the cursor
SELECT id, rating, created_at
FROM reviews
WHERE cafe_id = 42 AND deleted_at IS NULL
  AND (created_at, id) < ('2026-03-01 10:15:00+00', 918273)
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Three latest reviews for each cafe on a list page, in one query
SELECT c.id, c.name, r.id AS review_id, r.rating
FROM cafes c
CROSS JOIN LATERAL (
  SELECT id, rating FROM reviews
  WHERE cafe_id = c.id AND deleted_at IS NULL
  ORDER BY created_at DESC, id DESC
  LIMIT 3
) r
WHERE c.city = 'London'
ORDER BY c.id;`,
    },
  ],
  keyTakeaways: [
    "N+1 cost is dominated by round trips; batch with `= ANY($1)` or push the work into one SQL query.",
    "Composite index order: equality columns first, then the range or ORDER BY column.",
    "Partial indexes shrink the index to the rows queries actually touch, such as non-deleted or upcoming rows.",
    "INCLUDE columns enable index-only scans; check Heap Fetches.",
    "Keyset pagination with a unique tiebreaker is constant cost per page; OFFSET grows with depth.",
    "Wrong row estimates cause bad join choices; compare estimated and actual rows.",
  ],
  prerequisites: [
    "Reading EXPLAIN ANALYZE output",
    "B-tree index basics",
    "Cursor-based pagination at the API level",
  ],
  prerequisiteWeeks: [1, 3],
  resources: [
    {
      title: 'PostgreSQL docs: Multicolumn Indexes',
      url: 'https://www.postgresql.org/docs/current/indexes-multicolumn.html',
      kind: 'docs',
      note: "Read the whole page, focusing on which leading-column constraints make the index usable.",
      minutes: 6,
    },
    {
      title: 'PostgreSQL docs: Partial Indexes',
      url: 'https://www.postgresql.org/docs/current/indexes-partial.html',
      kind: 'docs',
      note: "Read the examples, especially the note on when the planner can prove a query matches the predicate.",
      minutes: 6,
    },
    {
      title: 'PostgreSQL docs: Index-Only Scans and Covering Indexes',
      url: 'https://www.postgresql.org/docs/current/indexes-index-only-scans.html',
      kind: 'docs',
      note: "Read the explanation of the visibility map and the INCLUDE clause.",
      minutes: 6,
    },
    {
      title: 'PostgreSQL docs: Using EXPLAIN',
      url: 'https://www.postgresql.org/docs/current/using-explain.html',
      kind: 'docs',
      note: "Re-read the parts on nested loop, hash join and merge join plan nodes.",
      minutes: 6,
    },
    {
      title: 'Use The Index, Luke: paging through results',
      url: 'https://use-the-index-luke.com/no-offset',
      kind: 'article',
      note: "Read the argument against OFFSET and the keyset ('seek method') examples.",
      minutes: 6,
      verify: true,
    },
  ],
  exercise: {
    title: 'Speed up the NearBrew café list and review feed',
    scenario:
      "The NearBrew API's `GET /cafes?city=London` returns 50 cafés each with their three latest reviews and average rating, and `GET /cafes/:id/reviews?page=N` uses OFFSET. Both are slow on a seeded database with 20,000 cafés and 2 million reviews. Find and fix the problems, measuring each step.",
    setup: [
      "docker run --name pg16 -e POSTGRES_PASSWORD=pg -p 5432:5432 -d postgres:16",
      "Save the starter as `seed.sql` and run `docker exec -i pg16 psql -U postgres < seed.sql` (takes a minute or two).",
      "mkdir n1 && cd n1 && npm init -y && npm i pg && create `list.mjs` from the starter.",
    ],
    steps: [
      "Run `node list.mjs` and record the number of queries and total time. Enable `log_min_duration_statement = 0` in your session or watch `pg_stat_statements` if you have it, and confirm the N+1 pattern.",
      "Rewrite `list.mjs` to fetch reviews for all 50 cafés with one `WHERE cafe_id = ANY($1)` query, grouping in JavaScript. Record time and query count again.",
      "Write a single SQL version with `CROSS JOIN LATERAL` (three latest reviews) and a correlated or joined aggregate for the average. Run `EXPLAIN (ANALYZE, BUFFERS)` on it without any review index and note the plan.",
      "Create the composite partial index from the example and rerun EXPLAIN. Identify the node that changed and the drop in buffers read.",
      "For the review feed, run the OFFSET query at OFFSET 0, 1,000 and 50,000 for one popular café and record times. Then implement the keyset version and run it for the equivalent deep page.",
      "Try a deliberately wrong index, `(created_at, cafe_id)`, drop the good one, and explain from the plan why it is not used effectively.",
      "Write a short before and after table for each endpoint in a comment at the top of your SQL file.",
    ],
    starter: [
      {
        language: 'sql',
        title: 'seed.sql',
        code: `CREATE TABLE cafes (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL
);
CREATE TABLE reviews (
  id bigserial PRIMARY KEY,
  cafe_id bigint NOT NULL REFERENCES cafes(id),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  created_at timestamptz NOT NULL,
  deleted_at timestamptz
);

INSERT INTO cafes (name, city)
SELECT 'Cafe ' || g, (ARRAY['London','Leeds','Bristol','Glasgow'])[1 + g % 4]
FROM generate_series(1, 20000) g;

-- Skewed: low ids get many more reviews (popular cafes)
INSERT INTO reviews (cafe_id, rating, body, created_at, deleted_at)
SELECT 1 + floor(random() * random() * 20000)::int,
       1 + floor(random() * 5)::int,
       'Nice flat white',
       now() - random() * interval '3 years',
       CASE WHEN random() < 0.25 THEN now() END
FROM generate_series(1, 2000000);

ANALYZE;`,
      },
      {
        language: 'js',
        title: 'list.mjs (the N+1 version)',
        code: `import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgres://postgres:pg@localhost:5432/postgres' });

let queries = 0;
const q = (text, params) => { queries++; return pool.query(text, params); };

const t0 = performance.now();
const { rows: cafes } = await q(
  "SELECT id, name FROM cafes WHERE city = $1 ORDER BY id LIMIT 50", ['London']);
for (const cafe of cafes) {
  const { rows } = await q(
    'SELECT id, rating FROM reviews WHERE cafe_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 3',
    [cafe.id]);
  const avg = await q(
    'SELECT avg(rating) AS avg FROM reviews WHERE cafe_id = $1 AND deleted_at IS NULL', [cafe.id]);
  cafe.reviews = rows;
  cafe.avgRating = Number(avg.rows[0].avg);
}
console.log({ queries, ms: Math.round(performance.now() - t0) });
await pool.end();`,
      },
    ],
    expected: [
      "The N+1 version issues 101 queries; the batched version issues 2 or 3; the LATERAL version issues 1.",
      "Without a review index the per-café queries do sequential scans of reviews and are very slow; with the composite partial index they become index scans reading a handful of buffers.",
      "OFFSET time grows with page depth; keyset time stays roughly flat.",
      "The `(created_at, cafe_id)` index is either ignored or used as a much less efficient full index scan.",
    ],
    hints: [
      "Pass a JavaScript array as the parameter for `= ANY($1)`; node-postgres converts it to a Postgres array.",
      "The average does not need the LIMIT, so the composite index still helps it by narrowing to one café; consider whether INCLUDE (rating) enables an index-only scan.",
      "If the planner ignores your partial index, check that the query repeats `deleted_at IS NULL` literally.",
      "Run each query twice and compare the second run, so you are measuring warm cache behaviour consistently.",
    ],
    verification: [
      "Each change has an EXPLAIN (ANALYZE, BUFFERS) before and after saved in your notes.",
      "You can point to the plan node that proves the index is used (Index Scan or Index Only Scan with the index name).",
      "The keyset page returns exactly the rows that OFFSET returns for the same position.",
    ],
  },
  successChecklist: [
    "N+1 measured and removed, with query counts before and after",
    "LATERAL top-N-per-group query working",
    "Composite partial index created and proven in a plan",
    "Keyset pagination implemented with a unique tiebreaker",
    "Bad column order demonstrated and explained",
  ],
  questions: [
    {
      question: "Why does a query with `WHERE cafe_id = $1 ORDER BY created_at DESC LIMIT 20` benefit from `(cafe_id, created_at)` but not `(created_at, cafe_id)`?",
      answer:
        "A b-tree on `(cafe_id, created_at)` groups all entries for one café together, already sorted by time, so Postgres seeks to that café and reads the first 20 entries backwards with no sort. In `(created_at, cafe_id)` the entries are ordered by time across all cafés, so one café's rows are scattered; Postgres would have to scan the index in time order filtering for the café, possibly reading most of it, or ignore it and sort. The rule is equality columns first, then the sort or range column. Leading-column order is what makes an index usable for a given query.",
    },
    {
      question: "Why does keyset pagination need a tiebreaker column, and what does the row comparison do?",
      answer:
        "If two reviews share the same `created_at`, a cursor of just the timestamp cannot say which of them was already shown, so rows can be skipped or duplicated across pages. Adding the unique `id` makes the sort order total. The row comparison `(created_at, id) < ($1, $2)` is lexicographic: it is true when created_at is earlier, or equal with a smaller id. Postgres can use an index on `(created_at, id)` in matching direction for this comparison directly.",
    },
    {
      question: "A LATERAL subquery runs once per outer row, like the N+1 loop. Why is it still much faster?",
      answer:
        "The repetition happens inside the database executor as a nested loop, so there are no network round trips, no per-query parse and plan overhead from the driver, and no connection pool contention. Each inner execution is an index seek returning a few rows, which costs microseconds. The N+1 loop pays milliseconds of latency per query, multiplied by the number of rows, and serialises them if awaited one by one. Both do similar work in the storage layer; the difference is the overhead around each unit of work.",
    },
  ],
  explainPrompt:
    "Explain to a backend teammate in a code review why their new reviews endpoint is slow (N+1 plus OFFSET) and walk them through the index and query you propose, using the EXPLAIN output as evidence.",
  rubric: [
    "Identifies the N+1 pattern and quantifies its cost in round trips",
    "Justifies composite index column order from the query shape",
    "Explains when and why a partial index is used",
    "Explains OFFSET cost and the keyset alternative with a tiebreaker",
    "Uses concrete plan evidence (node types, buffers, rows) rather than guesses",
  ],
  referenceExplanation:
    "The endpoint issues one query for the 50 cafés and then two per café, so 101 round trips per request. Each one is quick in Postgres, but we pay network latency and pool checkout every time, and under load that is what makes p95 climb. I would fetch the reviews for all 50 cafés in one query, either with `cafe_id = ANY($1)` and grouping in code, or with a LATERAL join that takes the three newest per café inside the database. Both are one or two round trips. The second issue is the index. Our query filters on `cafe_id`, excludes soft-deleted rows and sorts by `created_at`, so the index should be `(cafe_id, created_at DESC, id DESC)` with `WHERE deleted_at IS NULL`. Equality column first means Postgres jumps straight to one café's rows, already sorted, and the partial predicate leaves out the quarter of rows that are deleted, so the index is smaller. In the plan, the sequential scan on reviews became an Index Scan on that index, and shared buffers read went from tens of thousands to a few dozen. Finally, the feed uses OFFSET, which reads and throws away every row before the page, so page 500 is far slower than page 1. Switching to a keyset cursor on `(created_at, id)` makes every page an index seek. The `id` tiebreaker matters because timestamps can collide, and without it we would skip or repeat reviews.",
  stretch: {
    title: 'Diagnose a bad estimate',
    description:
      "Create a correlated-columns situation (for example most London cafés having a specific tag), observe a misestimated row count leading to a poor join choice, and try `CREATE STATISTICS` with dependencies to fix the estimate.",
  },
  lightTask:
    "Run the seed, run the N+1 script, then replace it with one `= ANY($1)` batched query and record the query count and time before and after.",
  intensiveExtras: [
    "Add `pg_stat_statements` to the container (via `shared_preload_libraries`) and find the top queries by total time after running both versions of the list endpoint.",
    "Build a partial index for upcoming bookings in a booking table (`WHERE starts_at > ...` is not immutable, so design around a status column instead) and explain why.",
    "Reproduce an N+1 in a GraphQL-style resolver and fix it with a small DataLoader-style batching function.",
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['databases', 'backend-services', 'api-design'],
  depth: 'standard',
};

/* ------------------------------------------------------------------ */
/* Week 17 — Node.js internals                                         */
/* ------------------------------------------------------------------ */

const week17: Lesson = {
  week: 17,
  slug: 'nodejs-event-loop-streams-workers',
  title: 'Node.js internals: event loop phases, streams, backpressure and worker threads',
  track: 'backend',
  secondaryTracks: ['cs'],
  topics: ['libuv', 'event loop phases', 'process.nextTick', 'setImmediate', 'streams', 'backpressure', 'pipeline', 'worker_threads', 'threadpool'],
  objective:
    "By the end you can predict callback ordering across Node's event loop phases, stream large data with bounded memory using pipeline and backpressure, and move CPU-bound work off the main thread with worker threads.",
  whyItMatters:
    "A Node service has one JavaScript thread per process. A single synchronous hash, a giant JSON.stringify, or an export that buffers a whole table in memory stalls every other request or crashes the process. Knowing how the loop, streams and the threadpool work is how you keep a Node API fast and stable.",
  explanation: [
    "Week 5 covered the browser-style model of tasks and microtasks. Node's loop, implemented by libuv, has named **phases** run in order on each iteration: **timers** (expired `setTimeout`/`setInterval` callbacks), **pending callbacks** (some deferred system callbacks), idle/prepare (internal), **poll** (retrieve new I/O events and run their callbacks; the loop may block here waiting for I/O), **check** (`setImmediate` callbacks), and **close callbacks** (such as a socket's `'close'`). Each phase has a queue; the loop drains it (up to a limit) and moves on. If nothing is pending, the process exits.",
    "Between individual callbacks, Node drains two higher-priority queues: first the `process.nextTick` queue, then the promise microtask queue. So `nextTick` runs before promise callbacks, and both run before the loop moves to the next macrotask. Recursive `nextTick` or endless promise chains can starve I/O entirely. A classic ordering puzzle: in the main module, `setTimeout(fn, 0)` versus `setImmediate(fn)` is non-deterministic because it depends on whether 1 ms has passed when the loop starts; inside an I/O callback, `setImmediate` always runs first because the check phase comes right after poll.",
    "Not all asynchronous work is equal. Network I/O uses the operating system's non-blocking mechanisms (epoll, kqueue, IOCP) and scales to many connections on the one thread. But file system operations, `dns.lookup`, and CPU-heavy built-ins such as `crypto.pbkdf2`, `crypto.scrypt` and asynchronous `zlib` run on the **libuv threadpool**, which has 4 threads by default (`UV_THREADPOOL_SIZE` changes it, set before the pool is first used). Five concurrent password hashes on a default pool means one waits. Synchronous variants like `pbkdf2Sync` or `readFileSync` run on the main thread and block everything.",
    "**Streams** process data in chunks so memory stays bounded. A readable stream produces chunks; a writable consumes them; a transform does both. Each stream has a `highWaterMark` buffer threshold (16 objects in object mode; for byte streams it was 16 KiB for many years and newer Node releases raised the default, so check the docs for your version). When a writable's buffer is full, `write()` returns `false`: that is **backpressure**, the consumer telling the producer to stop. Correct code stops writing and waits for the `'drain'` event. Ignoring the return value means Node buffers everything in memory, so exporting a million rows to a slow client can consume gigabytes.",
    "You rarely need to manage drain by hand. `pipeline()` from `node:stream/promises` connects streams, propagates backpressure, forwards errors from any stage, and destroys all streams on failure so file handles and sockets are not leaked. The older `.pipe()` handles backpressure but not error propagation or cleanup. Async generators work as pipeline stages too, so a transform can be `async function* (source) { for await (const row of source) yield toCsv(row); }`, and `for await` on a readable naturally pauses the source while your loop body awaits.",
    "For CPU-bound JavaScript, such as resizing image metadata, computing a recommendation score over thousands of cafés, or parsing a huge file, use **worker_threads**. A worker is a separate V8 isolate with its own event loop, communicating by message passing (`postMessage`, structured clone) or shared memory (`SharedArrayBuffer`). Workers are not free to start, so use a small pool for repeated tasks. Measure first: `perf_hooks.monitorEventLoopDelay()` shows how long the loop is blocked, and a p99 of hundreds of milliseconds tells you some synchronous work is starving requests. Clustering or multiple processes behind a load balancer (week 19) scale throughput; workers keep a single process responsive.",
  ],
  examples: [
    {
      language: 'js',
      title: 'Ordering puzzle: predict, then run',
      code: `import { readFile } from 'node:fs';

console.log('1 sync');
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));

readFile(new URL(import.meta.url), () => {
  console.log('io callback');
  setTimeout(() => console.log('io -> timeout'), 0);
  setImmediate(() => console.log('io -> immediate'));
  process.nextTick(() => console.log('io -> nextTick'));
});
console.log('2 sync');

// Deterministic: 1 sync, 2 sync, nextTick, promise
// Then 'timeout' and 'immediate' in either order (main module race),
// and later, once the file read completes:
// Inside the I/O callback: io callback, io -> nextTick, io -> immediate, io -> timeout`,
    },
    {
      language: 'js',
      title: 'Streaming a large export with pipeline',
      code: `import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function* checkIns(n) {
  for (let i = 0; i < n; i++) {
    yield { id: i, cafeId: i % 5000, at: new Date(1_700_000_000_000 + i * 1000).toISOString() };
  }
}

async function* toCsv(source) {
  yield 'id,cafe_id,at\\n';
  for await (const r of source) yield r.id + ',' + r.cafeId + ',' + r.at + '\\n';
}

await pipeline(Readable.from(checkIns(1_000_000)), toCsv, createWriteStream('checkins.csv'));
console.log('rss MB', Math.round(process.memoryUsage().rss / 1e6));`,
    },
  ],
  keyTakeaways: [
    "Loop phases: timers, pending callbacks, poll, check (setImmediate), close; nextTick then promises drain between callbacks.",
    "setTimeout 0 vs setImmediate is racy in the main module but setImmediate wins inside an I/O callback.",
    "fs, dns.lookup, crypto.pbkdf2/scrypt and zlib use the 4-thread libuv pool by default; Sync variants block the main thread.",
    "`write()` returning false is backpressure; wait for 'drain' or let pipeline handle it.",
    "Prefer `pipeline` from `node:stream/promises` over `.pipe()` for error propagation and cleanup.",
    "Use worker_threads for CPU-bound JS and measure event loop delay to find blocking.",
  ],
  prerequisites: [
    "The event loop, tasks and microtasks",
    "Async/await and promises",
    "Basic background job concepts",
  ],
  prerequisiteWeeks: [5, 10],
  resources: [
    {
      title: 'Node.js Learn: The Node.js Event Loop, Timers, and process.nextTick()',
      url: 'https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick',
      kind: 'docs',
      note: "Read the phases overview, the setImmediate vs setTimeout section and the process.nextTick section.",
      minutes: 12,
      verify: true,
    },
    {
      title: "Node.js Learn: Don't Block the Event Loop (or the Worker Pool)",
      url: 'https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop',
      kind: 'docs',
      note: "Read the sections on which APIs use the worker pool and on partitioning or offloading CPU work.",
      minutes: 8,
      verify: true,
    },
    {
      title: 'Node.js Learn: Backpressuring in Streams',
      url: 'https://nodejs.org/en/learn/modules/backpressuring-in-streams',
      kind: 'docs',
      note: "Read 'The Problem With Data Handling', the section on what happens when backpressure is ignored, and the rules for implementing writable streams.",
      minutes: 8,
      verify: true,
    },
    {
      title: 'Node.js API: Stream',
      url: 'https://nodejs.org/api/stream.html',
      kind: 'docs',
      note: "Look up `stream.pipeline`, `writable.write()` return value and the `'drain'` event; use as reference.",
      minutes: 4,
    },
    {
      title: 'Node.js API: Worker threads',
      url: 'https://nodejs.org/api/worker_threads.html',
      kind: 'docs',
      note: "Read the introductory example with `Worker`, `parentPort` and `workerData`.",
      minutes: 4,
    },
  ],
  exercise: {
    title: 'Keep the NearBrew API responsive: ordering, streaming export, and a worker',
    scenario:
      "NearBrew's Node API has two incidents: the admin 'export all check-ins as CSV' endpoint pushes the process to over 1 GB of memory, and the 'recompute café trending scores' endpoint makes every other request slow while it runs. Reproduce both locally and fix them.",
    setup: [
      "Node 20 or newer. mkdir node-internals && cd node-internals && npm init -y and set `\"type\": \"module\"` in package.json.",
      "Create `order.mjs` (the ordering puzzle example), `server.mjs` from the starter and `trending-worker.mjs`.",
      "Have `curl` available; optionally `npx autocannon` for load.",
    ],
    steps: [
      "Write your predicted output for `order.mjs` on paper, run it five times with `node order.mjs`, and explain every line, including why the main-module timeout/immediate order can vary.",
      "Start `server.mjs` and hit `/export-bad` with `curl -s localhost:3000/export-bad --limit-rate 200k -o /dev/null`. Watch the logged RSS climb.",
      "Implement `/export-good` with `pipeline` from an async generator through a CSV transform into `res`. Repeat the slow curl and confirm RSS stays flat.",
      "In another terminal, while running `curl localhost:3000/health` in a loop, call `/trending-bad`. Note the health latency and the logged event loop delay p99.",
      "Move the scoring loop into `trending-worker.mjs`, start it with `new Worker(new URL('./trending-worker.mjs', import.meta.url), { workerData })`, and resolve the response when the worker posts its result. Repeat the measurement.",
      "Fire five concurrent requests to `/hash` (async `crypto.pbkdf2`) and time them. Restart with `UV_THREADPOOL_SIZE=8 node server.mjs` and compare. Explain the result in terms of the threadpool.",
    ],
    starter: [
      {
        language: 'js',
        title: 'server.mjs',
        code: `import http from 'node:http';
import { pbkdf2 } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();
setInterval(() => {
  console.log('rss MB', Math.round(process.memoryUsage().rss / 1e6),
    '| loop p99 ms', Math.round(h.percentile(99) / 1e6));
  h.reset();
}, 1000);

function makeRow(i) {
  return { id: i, cafeId: i % 5000, at: new Date(1_700_000_000_000 + i * 1000).toISOString() };
}

function scoreAll(n) {
  // CPU-bound: pretend trending computation
  let acc = 0;
  for (let i = 0; i < n; i++) acc += Math.sqrt(i) * Math.sin(i);
  return acc;
}

http.createServer((req, res) => {
  if (req.url === '/health') return res.end('ok');

  if (req.url === '/export-bad') {
    // Builds the whole CSV in memory, then writes it.
    let csv = 'id,cafe_id,at\\n';
    for (let i = 0; i < 3_000_000; i++) {
      const r = makeRow(i);
      csv += r.id + ',' + r.cafeId + ',' + r.at + '\\n';
    }
    return res.end(csv);
  }

  if (req.url === '/export-good') {
    // TODO: pipeline(Readable.from(rows()), toCsv, res)
  }

  if (req.url === '/trending-bad') {
    return res.end(String(scoreAll(2e9)));
  }

  if (req.url === '/trending-good') {
    // TODO: run scoreAll in a Worker and respond when it posts back
  }

  if (req.url === '/hash') {
    const t0 = Date.now();
    return pbkdf2('secret', 'salt', 300_000, 64, 'sha512', () => res.end(String(Date.now() - t0) + 'ms'));
  }

  res.statusCode = 404;
  res.end();
}).listen(3000, () => console.log('listening on :3000'));`,
      },
    ],
    expected: [
      "`/export-bad` raises RSS by hundreds of megabytes; `/export-good` keeps RSS roughly constant even with a rate-limited client.",
      "During `/trending-bad`, `/health` stalls for seconds and loop p99 spikes; with the worker, `/health` stays fast and p99 stays low.",
      "With the default pool, the fifth `/hash` request takes noticeably longer than the first four; with 8 threads (on a machine with enough cores) all five finish in about the same time.",
    ],
    hints: [
      "An HTTP `ServerResponse` is a writable stream, so it can be the last stage of `pipeline`.",
      "Handle the pipeline promise rejection (for example the client disconnecting) with a catch that logs, otherwise you get an unhandled rejection.",
      "In the worker file, import `{ parentPort, workerData }` from `node:worker_threads` and call `parentPort.postMessage(result)`.",
      "If `scoreAll(2e9)` is too slow or too fast on your machine, tune n so it takes about 3 to 5 seconds.",
    ],
    verification: [
      "You can write the phase list from memory and place nextTick and promise microtasks correctly.",
      "Logged RSS and loop p99 numbers for bad and good versions are recorded side by side.",
      "Killing curl mid-download on `/export-good` does not crash the server or leak (pipeline rejects and cleans up).",
    ],
  },
  successChecklist: [
    "Ordering puzzle predicted and explained, including the non-deterministic pair",
    "Streaming export with flat memory under a slow client",
    "Worker-based trending endpoint keeps /health responsive",
    "Threadpool saturation demonstrated and explained",
    "Event loop delay measured before and after",
  ],
  questions: [
    {
      question: "What does it mean when `writable.write()` returns false, and what goes wrong if you ignore it?",
      answer:
        "It means the writable's internal buffer has reached its `highWaterMark`, so the consumer is not keeping up. The data you passed is still accepted and buffered, so nothing is lost immediately, but you are expected to stop writing until `'drain'` fires. If you keep writing, everything accumulates in memory: a fast database cursor feeding a slow mobile client can buffer the whole export, increasing GC pressure and potentially crashing the process. `pipeline` and `for await` handle this pause and resume automatically.",
    },
    {
      question: "Why can five concurrent async `crypto.pbkdf2` calls be slower than four, even though they are asynchronous?",
      answer:
        "Asynchronous pbkdf2 does not run on the main thread, but it does run on the libuv threadpool, which has 4 threads by default. Four hashes run in parallel and the fifth waits in the queue until a thread frees, so its latency is roughly double. The same pool also serves file system calls and `dns.lookup`, so heavy hashing can slow unrelated file reads. You can raise `UV_THREADPOOL_SIZE`, but it helps only up to the number of available CPU cores for CPU-bound work.",
    },
    {
      question: "When would you choose worker_threads versus running more Node processes behind a load balancer?",
      answer:
        "More processes (cluster or multiple containers) increase overall throughput and isolate crashes, but a single long CPU task still blocks the process handling it and every request queued on that process. Worker threads move that specific CPU-heavy task off the main loop so the process keeps serving other requests, and they can share memory with SharedArrayBuffer when needed. Typically you use both: horizontal scaling for capacity, and a small worker pool or a separate job queue for heavy computations. For very long work, a background job (week 10) is often better than either.",
    },
  ],
  explainPrompt:
    "Explain to an interviewer what happens inside a Node process when one request runs a 3-second CPU loop and another request streams a large CSV, and how you would make both behave well.",
  rubric: [
    "Describes the single JS thread and the event loop phases accurately",
    "Distinguishes OS-level async network I/O from the libuv threadpool",
    "Explains backpressure and the role of pipeline",
    "Proposes worker threads (or a job queue) for CPU work with a reason",
    "Mentions how to measure (event loop delay, RSS) rather than guessing",
  ],
  referenceExplanation:
    "A Node process runs all JavaScript on one thread, driven by libuv's event loop. Each iteration goes through timers, pending callbacks, poll for I/O, check for setImmediate, and close callbacks, and between every callback Node drains the nextTick queue and then promise microtasks. Network sockets are non-blocking at the OS level, so one thread can juggle thousands of connections, as long as no callback runs for long. A 3-second CPU loop in a request handler is one very long callback: nothing else runs, timers fire late, and every other request, including health checks, waits. I would confirm it with monitorEventLoopDelay and then move the work to a worker thread, which has its own isolate and event loop, and reply when it posts the result back, or push it to a background job if it is long or can be precomputed. The CSV export is a memory problem rather than a CPU one. If you build the whole string, or call write without checking its return value, Node buffers everything in memory while the client downloads slowly. With streams, write returning false is backpressure, a signal to pause until drain. Using pipeline from node:stream/promises, with an async generator reading rows in batches and a CSV transform into the response, propagates that backpressure all the way back to the database cursor and cleans up if the client disconnects. Memory stays flat no matter how big the export is. I would also remember that crypto and fs work share a four-thread pool by default.",
  stretch: {
    title: 'Stream from Postgres',
    description:
      "Replace the synthetic generator with a real `pg-cursor` or `pg-query-stream` read from the week 16 reviews table, and confirm backpressure reaches the database by watching the cursor fetch batches only as the client consumes.",
  },
  lightTask:
    "Predict and then run the ordering puzzle, and convert `/export-bad` into a `pipeline`-based `/export-good`, recording RSS for both.",
  intensiveExtras: [
    "Build a fixed-size worker pool (two workers, a task queue, round-robin dispatch) and load test it with autocannon.",
    "Write a custom Writable that simulates a slow disk and log each time `write()` returns false and 'drain' fires.",
    "Use `node --cpu-prof` on `/trending-bad` and open the profile in Chrome DevTools to find the hot function.",
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['backend-services', 'production-reliability', 'cs-fundamentals', 'js-ts'],
  depth: 'standard',
};

/* ------------------------------------------------------------------ */
/* Week 18 — Accessibility engineering                                 */
/* ------------------------------------------------------------------ */

const week18: Lesson = {
  week: 18,
  slug: 'accessibility-semantics-keyboard-focus-aria',
  title: 'Accessibility engineering: semantics, keyboard, focus management, ARIA and testing',
  track: 'frontend',
  topics: ['semantic HTML', 'accessible name', 'keyboard navigation', 'focus management', 'dialog', 'roving tabindex', 'live regions', 'ARIA', 'axe', 'screen readers'],
  objective:
    "By the end you can audit a UI with keyboard, automated tools and a screen reader, fix the common failures with native semantics first, and implement correct focus management for dialogs and dynamic content.",
  whyItMatters:
    "Accessibility bugs exclude real users and are frequently legal and contractual requirements for consumer products. They are also a strong signal of engineering quality: keyboard and focus correctness overlaps directly with remote-control and TV-style navigation (week 31), and semantic markup makes components easier to test with role-based queries.",
  explanation: [
    "Assistive technologies do not see your pixels; they read the **accessibility tree**, which the browser builds from the DOM. Each node has a role (button, link, heading, checkbox), an accessible name (what a screen reader announces), a state (pressed, expanded, checked) and sometimes a value. Native HTML elements come with all of this for free: a `<button>` has the button role, is focusable, activates with Enter and Space, and takes its name from its text. A `<div onClick>` has none of that. The first rule of accessibility engineering is to use the native element that matches the behaviour, and the WAI-ARIA guidance itself says no ARIA is better than bad ARIA.",
    "The **accessible name** is computed from, in rough priority order, `aria-labelledby`, `aria-label`, the associated `<label>` (for form controls), the element's text content (for roles like button and link), and `title` as a last resort. Icon-only buttons are the most common failure: a heart icon with no text has no name, so a screen reader says 'button'. Fix it with visually hidden text or `aria-label=\"Add Flat White Co to favourites\"`, and expose the toggle state with `aria-pressed`. Names should be unique and specific in context: twenty 'View' links are useless when a screen reader user lists all links.",
    "**Keyboard** support means every interactive element is reachable with Tab in a logical order, operable with the expected keys, and has a visible focus indicator. Do not remove outlines without a replacement; `:focus-visible` lets you show a ring for keyboard users without showing it on mouse click. Avoid positive `tabindex` values, which create a tab order that diverges from the visual order. For composite widgets such as a tab list, a toolbar or a grid of café filter chips, the APG pattern is usually one Tab stop for the whole widget with arrow keys moving inside it, implemented with **roving tabindex** (the active item has `tabindex=\"0\"`, the rest `-1`) or `aria-activedescendant`.",
    "**Focus management** is about where focus goes when the UI changes. Opening a modal must move focus into it, keep Tab within it, close on Escape, and return focus to the element that opened it. The native `<dialog>` element opened with `showModal()` gives you much of this: the rest of the page becomes inert, Escape closes it, and focus moves inside. Restoring focus to the trigger on close is now handled by modern browsers, but test it and restore it explicitly if your support matrix needs it. On client-side route changes, move focus to the new page's main heading (with `tabindex=\"-1\"`) or announce the change, otherwise a screen reader user hears nothing after clicking a link.",
    "Dynamic content needs announcing. When NearBrew's search updates to '12 cafés found', a sighted user sees it but a screen reader user does not, unless the text is inside a **live region**: an element with `role=\"status\"` (implicitly `aria-live=\"polite\"`) or `aria-live=\"polite\"`. The region must exist in the DOM before its content changes; inserting a new element that already contains the message is often not announced. Use `assertive` only for urgent errors. Similarly, form errors should be linked to their inputs with `aria-describedby` and indicated with `aria-invalid`, and focus should move to the first invalid field on submit.",
    "Testing is layered. Automated checkers such as axe (DevTools extension, or `axe-core` in tests) and the Lighthouse accessibility audit catch missing names, contrast failures, invalid ARIA and duplicate ids, but only a portion of real issues. Then do a keyboard-only pass: unplug the mouse, Tab through every flow, and check order, visibility and traps. Then a short screen reader pass: VoiceOver on macOS (Cmd+F5) or iOS, NVDA on Windows (free), TalkBack on Android. In unit tests, Testing Library's `getByRole('button', { name: /add .* to favourites/i })` doubles as an accessibility assertion: if you cannot query it by role and name, neither can assistive technology.",
  ],
  examples: [
    {
      language: 'html',
      title: 'Before and after: café card favourite button and results count',
      code: `<!-- Before: not focusable, no role, no name, no state -->
<div class="fav" onclick="toggleFav(42)"><svg>...</svg></div>
<p id="count">12 cafes found</p>

<!-- After: native button, specific name, toggle state, decorative icon hidden -->
<button type="button" class="fav" aria-pressed="false"
        aria-label="Add Flat White Co to favourites">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>

<!-- Live region present on page load; only its text changes -->
<p id="count" role="status">12 cafes found</p>`,
    },
    {
      language: 'js',
      title: 'Opening a filter dialog with native <dialog> and restoring focus',
      code: `const dialog = document.querySelector('#filters');
const openBtn = document.querySelector('#open-filters');
let opener = null;

openBtn.addEventListener('click', () => {
  opener = document.activeElement;
  dialog.showModal(); // page becomes inert, Escape closes, focus moves inside
});

dialog.addEventListener('close', () => {
  // Modern browsers restore focus, but be explicit for older targets.
  if (opener instanceof HTMLElement) opener.focus();
});`,
    },
  ],
  keyTakeaways: [
    "Use the native element first: button, a, label, input, dialog, headings and landmarks give roles, focus and keys for free.",
    "Every interactive element needs a specific accessible name; icon-only buttons are the top failure.",
    "Keyboard: logical Tab order, visible focus with :focus-visible, arrow keys inside composite widgets.",
    "Dialogs move focus in, contain it, close on Escape, and return focus to the trigger.",
    "Announce async changes through a live region that already exists in the DOM.",
    "Automated tools catch only part of the issues; add keyboard and screen reader passes.",
  ],
  prerequisites: [
    "HTML and DOM basics",
    "React component rendering",
    "Browser DevTools familiarity",
  ],
  prerequisiteWeeks: [2, 11],
  resources: [
    {
      title: 'WAI-ARIA Authoring Practices Guide (APG)',
      url: 'https://www.w3.org/WAI/ARIA/apg/',
      kind: 'docs',
      note: "Read 'Read Me First' (especially 'No ARIA is better than bad ARIA'), then the Dialog (Modal) pattern and the keyboard interface practice on roving tabindex.",
      minutes: 12,
    },
    {
      title: 'APG: Dialog (Modal) Pattern',
      url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/',
      kind: 'docs',
      note: "Read the Keyboard Interaction and WAI-ARIA Roles, States and Properties sections.",
      minutes: 6,
      verify: true,
    },
    {
      title: 'MDN: Accessibility',
      url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility',
      kind: 'docs',
      note: "Use as the hub; read the pages on the accessibility tree and on ARIA live regions.",
      minutes: 6,
    },
    {
      title: 'MDN: The dialog element',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog',
      kind: 'docs',
      note: "Read the accessibility considerations and the difference between `show()` and `showModal()`.",
      minutes: 4,
      verify: true,
    },
    {
      title: 'Testing Library: Which query should I use?',
      url: 'https://testing-library.com/docs/queries/about/#priority',
      kind: 'docs',
      note: "Read the priority list and why `getByRole` comes first.",
      minutes: 3,
      verify: true,
    },
  ],
  exercise: {
    title: 'Audit and fix the NearBrew café finder page',
    scenario:
      "The NearBrew marketing site has a café finder: a search box, a 'Filters' button opening a custom modal, a grid of café cards that are clickable divs, heart icons for favourites, and a results count that updates as you type. A user emailed to say they cannot use it with a keyboard. Audit it and fix it with semantics first.",
    setup: [
      "mkdir a11y-finder && cd a11y-finder and create `index.html` from the starter.",
      "Serve it with `npx serve .` (or `python3 -m http.server`) and open it in Chrome or Firefox.",
      "Install the free axe DevTools browser extension; enable VoiceOver (Cmd+F5) on macOS or install NVDA on Windows.",
    ],
    steps: [
      "Before fixing anything, run axe and Lighthouse (Accessibility category) and save the list of issues.",
      "Do a keyboard-only pass with Tab, Shift+Tab, Enter, Space and Escape. Write down every element you cannot reach or operate and where focus gets lost.",
      "Do a two-minute screen reader pass: list headings and buttons using the screen reader's rotor or elements list, and note what is announced for each card and heart.",
      "Fix the cards: make the café name a real link (or the card's primary action a button) and keep the heart as a separate `<button>` with a specific `aria-label` and `aria-pressed`.",
      "Replace the custom modal with a native `<dialog>` opened by `showModal()`. Give it a heading referenced by `aria-labelledby`, and verify focus moves in, Escape closes it, and focus returns to the Filters button.",
      "Make the results count a live region with `role=\"status\"` that exists on load, and confirm the screen reader announces new counts after typing pauses.",
      "Add a visible `:focus-visible` style and a 'Skip to results' link. Re-run axe and the keyboard pass and compare with your first list.",
    ],
    starter: [
      {
        language: 'html',
        title: 'index.html (deliberately inaccessible)',
        code: `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Find a cafe</title>
  <style>
    * { outline: none; }
    .card { border: 1px solid #ccc; padding: 12px; margin: 8px; cursor: pointer; }
    .fav { display: inline-block; width: 24px; height: 24px; cursor: pointer; }
    .modal-bg { display: none; position: fixed; inset: 0; background: #0008; }
    .modal { background: #fff; margin: 10% auto; padding: 16px; width: 300px; }
    .hint { color: #bbb; }
  </style>
</head>
<body>
  <div class="logo">NearBrew</div>
  <input id="q" placeholder="Search cafes" />
  <div class="btn" id="open">Filters</div>
  <div id="count" class="hint"></div>
  <div id="grid"></div>

  <div class="modal-bg" id="bg">
    <div class="modal">
      <div style="font-weight:bold">Filters</div>
      <input type="checkbox" id="open-now" /> Open now
      <div class="btn" id="close">X</div>
    </div>
  </div>

  <script>
    const cafes = ['Flat White Co', 'Bean There', 'Roast House', 'Crema Corner', 'Drip Lab'];
    const favs = new Set();
    const grid = document.getElementById('grid');
    function render() {
      const q = document.getElementById('q').value.toLowerCase();
      const list = cafes.filter((c) => c.toLowerCase().includes(q));
      document.getElementById('count').textContent = list.length + ' cafes found';
      grid.innerHTML = list.map((c) =>
        '<div class="card" onclick="location.hash=\\'' + c + '\\'">' +
        '<div style="font-size:20px">' + c + '</div>' +
        '<div class="fav" onclick="event.stopPropagation(); toggle(\\'' + c + '\\')">' +
        (favs.has(c) ? '♥' : '♡') + '</div></div>').join('');
    }
    function toggle(c) { favs.has(c) ? favs.delete(c) : favs.add(c); render(); }
    document.getElementById('q').addEventListener('input', render);
    document.getElementById('open').onclick = () => (document.getElementById('bg').style.display = 'block');
    document.getElementById('close').onclick = () => (document.getElementById('bg').style.display = 'none');
    render();
  </script>
</body>
</html>`,
      },
    ],
    expected: [
      "Initial audit flags: missing input label, low-contrast hint text, no page heading or landmarks, and keyboard pass reveals unreachable cards, hearts, Filters and X.",
      "After fixes, every control is reachable and operable by keyboard with a visible focus ring.",
      "The screen reader announces hearts as, for example, 'Add Bean There to favourites, toggle button, not pressed'.",
      "Opening Filters moves focus into the dialog, Tab stays inside, Escape closes it and focus returns to the Filters button.",
      "Typing in search causes the new count to be announced politely without moving focus.",
    ],
    hints: [
      "A `placeholder` is not a label; add a `<label for=\"q\">` (it can be visually hidden).",
      "Wrap the page in `<header>`, `<main>` and give it an `<h1>`, so screen reader users can navigate by landmark and heading.",
      "Use `aria-label` on the heart rather than `title`; `title` is not reliably announced and shows a tooltip only on hover.",
      "If the live region is not announced, check it is not being re-created by `innerHTML` on the parent each render.",
    ],
    verification: [
      "axe reports zero critical or serious issues.",
      "You can complete 'search, open filters, enable open now, close, favourite a café, open a café' using only the keyboard.",
      "The screen reader elements list shows unique, descriptive names for every button and link.",
      "Your before and after issue list is saved for your portfolio (week 51).",
    ],
  },
  successChecklist: [
    "Baseline axe and Lighthouse results recorded",
    "Keyboard-only pass completed before and after",
    "Cards and hearts use native link and button semantics with specific names and state",
    "Native dialog with correct focus in, containment, Escape and focus return",
    "Results count announced via a pre-existing live region",
    "Visible focus style and skip link added",
  ],
  questions: [
    {
      question: "Why is `<div role=\"button\" onclick=...>` worse than `<button>`, even with the role?",
      answer:
        "The role only changes what assistive technology is told the element is; it does not add behaviour. The div is still not focusable without `tabindex=\"0\"`, does not activate on Enter or Space unless you add key handlers, does not participate in form submission or `disabled` semantics, and has no default focus styling. You end up re-implementing what the browser gives a button for free, and usually miss something. Native elements are also more robust across browsers and assistive technologies.",
    },
    {
      question: "What must happen to focus when a modal dialog opens and closes, and why?",
      answer:
        "On open, focus should move into the dialog, typically to the first focusable control or the heading, so keyboard and screen reader users are where the content is. While open, Tab and Shift+Tab should cycle within the dialog and the background should be inert, so focus does not wander to content hidden behind an overlay. Escape should close it. On close, focus should return to the element that opened it, otherwise it falls to the document body and the user has to start navigating from the top of the page.",
    },
    {
      question: "Why might a live region fail to announce, and how do you make it reliable?",
      answer:
        "Screen readers observe changes to regions they already know about; if you insert a brand new element that already contains the text, many combinations of browser and screen reader do not announce it. Re-rendering the region's parent with `innerHTML` can recreate it and cause the same problem. Render the region once on page load, empty or with initial text, and change only its text content. Debounce updates so rapid typing does not produce a stream of announcements, and use polite rather than assertive for non-urgent updates.",
    },
  ],
  explainPrompt:
    "Explain to a product manager and a mid-level frontend engineer together why the café finder failed for keyboard and screen reader users and what engineering practices will stop it from regressing.",
  rubric: [
    "Explains the accessibility tree and why semantics matter in plain language",
    "Covers names, keyboard operation, focus management and announcements with concrete examples",
    "Prefers native elements and justifies when ARIA is needed",
    "Describes a layered testing approach and what each layer catches",
    "Proposes regression prevention (role-based tests, axe in CI, review checklist)",
  ],
  referenceExplanation:
    "Screen readers and keyboard users do not interact with what the page looks like; they use the accessibility tree the browser builds from our HTML. Our café cards and hearts were plain divs with click handlers, so they had no role, could not be reached with Tab, and had no names. A screen reader user heard nothing useful and a keyboard user could not favourite anything. We fixed that by using real elements: the café name is a link, and the heart is a button labelled 'Add Bean There to favourites' with aria-pressed showing its state. The Filters modal was a styled div, so focus stayed behind it. We replaced it with the native dialog element, which makes the page behind it inert, closes on Escape and moves focus inside, and we make sure focus returns to the Filters button afterwards. The results count changed visually but was never announced, so we made it a status live region that exists from page load. The general rule is to use native HTML first and add ARIA only to describe state or patterns HTML lacks, because wrong ARIA is worse than none. To stop regressions, our component tests query by role and accessible name, which fails if a control loses its semantics; we run axe in CI to catch missing labels and contrast issues; and before releasing a new flow we do a quick keyboard-only pass, since automated tools catch only part of the real problems.",
  stretch: {
    title: 'Roving tabindex filter chips',
    description:
      "Build a React toolbar of NearBrew filter chips (Open now, Wi-Fi, Oat milk, Outdoor seating) following the APG toolbar pattern: one Tab stop, arrow keys move between chips, Home and End jump, Space toggles. Test it with Testing Library and `user-event` keyboard interactions.",
  },
  lightTask:
    "Run axe on the starter page, do a five-minute keyboard-only pass, then fix just the heart buttons (native button, specific aria-label, aria-pressed) and the missing search label.",
  intensiveExtras: [
    "Audit one real NearBrew screen (web or React Native with the platform screen reader) and file three prioritised issues with reproduction steps.",
    "Add `vitest-axe` or `jest-axe` to a component test suite and fail the test on violations.",
    "Implement focus management on client-side route changes in a small React Router app and test it with a screen reader.",
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['accessibility', 'consumer-ui', 'ui-reliability'],
  depth: 'standard',
};

/* ------------------------------------------------------------------ */
/* Week 19 — Load balancing and horizontal scaling                     */
/* ------------------------------------------------------------------ */

const week19: Lesson = {
  week: 19,
  slug: 'load-balancing-horizontal-scaling',
  title: 'Load balancing and horizontal scaling: stateless services, health checks, sticky sessions',
  track: 'system-design',
  secondaryTracks: ['backend'],
  topics: ['load balancer', 'L4 vs L7', 'round robin', 'least connections', 'stateless services', 'session storage', 'health checks', 'readiness', 'graceful shutdown', 'sticky sessions'],
  objective:
    "By the end you can run a service behind a load balancer locally, make it stateless, design liveness and readiness checks, shut it down gracefully during deploys, and argue for or against sticky sessions.",
  whyItMatters:
    "Horizontal scaling only works if any instance can serve any request and instances can come and go without users noticing. The bugs here (users logged out at random, errors during every deploy, a slow dependency taking the whole fleet out via health checks) are common, user-visible and easy to prevent once you see the mechanics.",
  explanation: [
    "Vertical scaling means a bigger machine; horizontal scaling means more instances behind a **load balancer** that spreads requests across them. Horizontal scaling also gives redundancy: losing one instance out of four loses a quarter of capacity rather than the service. A **layer 4** balancer routes TCP or UDP connections by address and port without looking at content; it is fast and protocol-agnostic. A **layer 7** balancer understands HTTP, so it can route by path or header, terminate TLS, retry idempotent requests on another instance, and add headers like `X-Forwarded-For`. Most web APIs sit behind an L7 proxy such as nginx, Envoy, HAProxy or a cloud application load balancer.",
    "Balancing algorithms trade simplicity against awareness of load. **Round robin** sends requests in turn and works when requests cost about the same. **Least connections** sends to the instance with the fewest active requests and handles mixed fast and slow requests better. **Power of two random choices** (pick two instances at random, send to the less loaded) gets most of the benefit of least-connections with less coordination, which matters when there are many balancers. **Hash-based** routing (by client IP or a key) sends the same client or key to the same instance, which is how sticky sessions and cache affinity are done; consistent hashing limits how many keys move when instances are added or removed.",
    "The prerequisite for all of this is a **stateless** service: no request depends on in-memory state left by a previous request on the same instance. Typical violations are sessions in a process-local Map, an in-memory rate limiter, uploaded files on local disk, and in-process caches treated as the source of truth. Move session and shared state to a store all instances can reach (Redis, Postgres), or into a signed token the client carries, put files in object storage, and treat in-process caches as disposable (week 4). This is the 'processes are stateless and share-nothing' principle from the Twelve-Factor App.",
    "Health checks decide which instances receive traffic, and getting them wrong can cause outages. A **liveness** check answers 'is this process hopelessly stuck, so restart it?' and should be shallow: if it checks the database and the database is slow, the orchestrator restarts every healthy instance at once. A **readiness** check answers 'should I receive traffic right now?' and is false during startup (warming caches, running migrations) and during shutdown. Be careful making readiness depend on a shared dependency: if every instance reports not ready when the database blips, the balancer has nowhere to send traffic and turns a partial degradation into a full outage. Load balancers also do passive checking: open-source nginx marks an upstream as failed after `max_fails` errors within `fail_timeout`, while active HTTP health probes are a feature of NGINX Plus, Envoy, HAProxy and cloud balancers.",
    "Deploys replace instances, so **graceful shutdown** is part of scaling. On SIGTERM, an instance should mark itself not ready, keep serving in-flight requests while the balancer stops routing to it, stop accepting new connections (`server.close()`), close keep-alive connections, and exit before the orchestrator's kill timeout. Without this, every deploy causes a burst of 502s. In containers, run Node in exec form (`CMD [\"node\", \"server.js\"]`) so it receives the signal directly; with the shell form, the shell may not forward it. Node running as PID 1 also ignores signals it has no handler for, which is another reason to install a SIGTERM handler or use an init process (`init: true` in Compose).",
    "**Sticky sessions** (session affinity) route a client to the same instance every time, usually with a cookie or IP hash. They paper over in-memory sessions and can be useful for WebSocket connections or expensive per-user in-memory state. The costs: load becomes uneven (one heavy user or a corporate NAT behind one IP pins a lot of traffic to one instance), scaling out does not rebalance existing users, and when an instance dies all its users lose their state anyway. Treat stickiness as a performance optimisation layered on a stateless design, never as the thing that makes correctness work.",
  ],
  examples: [
    {
      language: 'text',
      title: 'nginx.conf: round robin with passive failure detection',
      code: `events {}
http {
  upstream nearbrew_api {
    # least_conn;              # try this instead of default round robin
    # hash $cookie_sid consistent;  # sticky by session cookie
    server app1:3000 max_fails=2 fail_timeout=10s;
    server app2:3000 max_fails=2 fail_timeout=10s;
    server app3:3000 max_fails=2 fail_timeout=10s;
  }
  server {
    listen 80;
    location / {
      proxy_pass http://nearbrew_api;
      proxy_next_upstream error timeout http_502 http_503;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
}`,
    },
  ],
  keyTakeaways: [
    "Horizontal scaling requires statelessness: any instance must be able to serve any request.",
    "Move sessions, rate-limit counters and uploads to shared stores or signed tokens; in-process caches are disposable.",
    "Liveness is shallow ('restart me?'); readiness is 'send me traffic?' and goes false on startup and shutdown.",
    "Readiness tied to a shared dependency can turn a partial failure into a total outage.",
    "Graceful shutdown on SIGTERM prevents 502s on every deploy; mind PID 1 and exec-form CMD.",
    "Sticky sessions are an optimisation with real costs, not a substitute for shared state.",
  ],
  prerequisites: [
    "HTTP basics and REST API design",
    "Caching concepts",
    "Docker basics",
  ],
  prerequisiteWeeks: [3, 4, 8, 10],
  resources: [
    {
      title: 'nginx docs: Using nginx as HTTP load balancer',
      url: 'https://nginx.org/en/docs/http/load_balancing.html',
      kind: 'docs',
      note: "Read the whole page: methods (round robin, least connected, ip-hash), weights and health checks.",
      minutes: 8,
    },
    {
      title: 'The Twelve-Factor App: Processes',
      url: 'https://12factor.net/processes',
      kind: 'article',
      note: "Short page on stateless, share-nothing processes and why sticky sessions are discouraged. Also skim the Disposability factor.",
      minutes: 5,
    },
    {
      title: 'Kubernetes: Configure Liveness, Readiness and Startup Probes',
      url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/',
      kind: 'docs',
      note: "Read the introduction explaining what each probe type is for; skip the YAML details.",
      minutes: 7,
    },
    {
      title: 'Google SRE book: Load Balancing in the Datacenter',
      url: 'https://sre.google/sre-book/load-balancing-datacenter/',
      kind: 'book',
      note: "Read the sections on identifying bad tasks (flow control, lame duck state) and the policies comparison (round robin, least-loaded, weighted).",
      minutes: 10,
      verify: true,
    },
    {
      title: 'Designing Data-Intensive Applications (Martin Kleppmann)',
      url: 'https://dataintensive.net/',
      kind: 'book',
      note: "Optional: the opening chapter's discussion of scalability, describing load and scaling up versus scaling out.",
      minutes: 10,
      verify: true,
    },
  ],
  exercise: {
    title: 'Scale the NearBrew API to three instances and survive a deploy',
    scenario:
      "NearBrew is adding instances behind a load balancer before a launch campaign. The API keeps login sessions in a process-local Map. Run three instances behind nginx with Docker Compose, observe the session bug, fix it with Redis, add health checks and graceful shutdown, and simulate a rolling restart under load.",
    setup: [
      "Docker Desktop or Docker Engine with Compose. mkdir lb && cd lb.",
      "Create `server.js`, `package.json` (with `\"type\": \"module\"` and dependency `redis`), `Dockerfile`, `nginx.conf` (from the example) and `docker-compose.yml` from the starter.",
      "Run `docker compose up --build` and confirm `curl localhost:8080/whoami` returns different hostnames on repeated calls.",
    ],
    steps: [
      "Log in with `curl -c jar -b jar -X POST localhost:8080/login` then call `curl -b jar localhost:8080/me` six times. Observe that you are 'logged out' on two out of three instances.",
      "Enable sticky routing temporarily with `hash $cookie_sid consistent;` in the upstream, reload, and confirm `/me` works. Then stop the instance your session lives on (`docker compose stop app2`) and observe the logout. Write down the trade-offs you just saw.",
      "Remove the hash line and move sessions into Redis (`SET sess:<id> ... EX 3600`, `GET` on each request). Confirm `/me` works on every instance and after restarting any of them.",
      "Implement `/healthz` (shallow liveness) and `/readyz` (false during a simulated 3-second startup and after SIGTERM). Add a Compose `healthcheck` using `/readyz` and explain why nginx open source does not consult it.",
      "Implement graceful shutdown: on SIGTERM set ready false, wait 2 seconds for the balancer to stop sending new requests, call `server.close()`, and exit when in-flight requests finish (with a 10-second hard timeout).",
      "Run a loop of requests to `/slow` (1-second responses) and do a rolling restart (`docker compose restart app1`, wait, then app2, then app3). Count failed responses with and without the graceful shutdown code and with and without `proxy_next_upstream`.",
      "Switch the upstream to `least_conn` and send a mix of `/slow` and `/whoami` requests; compare the per-instance distribution with round robin by grepping the logs.",
    ],
    starter: [
      {
        language: 'js',
        title: 'server.js (stateful version to start from)',
        code: `import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';

const sessions = new Map(); // BUG: local to this instance
let ready = false;
setTimeout(() => { ready = true; }, 3000); // simulated warm-up

function sid(req) {
  const m = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie ?? '');
  return m ? m[1] : null;
}

const server = http.createServer((req, res) => {
  const host = os.hostname();
  if (req.url === '/healthz') return res.end('ok');
  if (req.url === '/readyz') { res.statusCode = ready ? 200 : 503; return res.end(); }
  if (req.url === '/whoami') return res.end(host + '\\n');

  if (req.url === '/login' && req.method === 'POST') {
    const id = crypto.randomUUID();
    sessions.set(id, { user: 'ana' });
    res.setHeader('Set-Cookie', 'sid=' + id + '; HttpOnly; Path=/');
    return res.end('logged in on ' + host + '\\n');
  }

  if (req.url === '/me') {
    const s = sessions.get(sid(req));
    res.statusCode = s ? 200 : 401;
    return res.end((s ? 'hello ' + s.user : 'not logged in') + ' (served by ' + host + ')\\n');
  }

  if (req.url === '/slow') return setTimeout(() => res.end('slow ok ' + host + '\\n'), 1000);

  res.statusCode = 404;
  res.end();
});

server.listen(3000, () => console.log(host, 'listening'));

// TODO: process.on('SIGTERM', ...) graceful shutdown`,
      },
      {
        language: 'yaml',
        title: 'docker-compose.yml and Dockerfile',
        code: `# docker-compose.yml
services:
  app1: &app
    build: .
    init: true
    environment: { REDIS_URL: "redis://redis:6379" }
    depends_on: [redis]
  app2: *app
  app3: *app
  redis:
    image: redis:7
  lb:
    image: nginx:1.27
    ports: ["8080:80"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [app1, app2, app3]

# Dockerfile (separate file)
# FROM node:20-alpine
# WORKDIR /app
# COPY package.json .
# RUN npm install
# COPY server.js .
# CMD ["node", "server.js"]`,
      },
    ],
    expected: [
      "With in-memory sessions and round robin, `/me` succeeds on roughly one call in three.",
      "With sticky hashing, `/me` works until the owning instance stops, then the session is lost.",
      "With Redis sessions, `/me` works on every instance and survives restarts.",
      "Without graceful shutdown, a rolling restart produces a handful of errors or resets in the request loop; with it (and `proxy_next_upstream`), close to zero.",
      "least_conn spreads slow requests more evenly than round robin under mixed load.",
    ],
    hints: [
      "Reload nginx after editing its config with `docker compose exec lb nginx -s reload`.",
      "A simple load loop: `while true; do curl -s -o /dev/null -w '%{http_code}\\n' localhost:8080/slow; done | sort | uniq -c` (stop with Ctrl+C).",
      "Track in-flight requests with a counter incremented on request and decremented on the response 'finish' or 'close' event.",
      "`server.close()` stops accepting new connections but keep-alive sockets stay open; Node 18.2+ has `server.closeIdleConnections()` to help.",
    ],
    verification: [
      "You can reproduce and explain each of the three session behaviours (local, sticky, shared).",
      "Your error counts for the rolling restart, with and without graceful shutdown, are recorded.",
      "You can explain why `/healthz` must not check Redis while `/readyz` might, and the risk if it does.",
    ],
  },
  successChecklist: [
    "Three instances running behind nginx locally",
    "Session bug reproduced, sticky workaround tried, and trade-offs written down",
    "Sessions moved to Redis and verified across restarts",
    "Separate liveness and readiness endpoints with a written rationale",
    "Graceful shutdown measurably reduces errors during a rolling restart",
    "Round robin vs least_conn distribution compared",
  ],
  questions: [
    {
      question: "Why should a liveness check not depend on the database, and what can go wrong with readiness that does?",
      answer:
        "Liveness failures cause the orchestrator to restart the instance. If liveness checks the database and the database slows down, every instance fails at once and gets restarted, which adds cold starts and connection storms on top of a database problem without fixing it. Readiness failures remove the instance from the balancer instead. If readiness depends on a shared dependency, a brief blip marks every instance not ready, so the balancer has no healthy targets and the service returns errors for requests that could have succeeded, such as cached reads. Readiness should reflect this instance's ability to serve, and dependency failures are usually better handled with timeouts and degraded responses.",
    },
    {
      question: "What are the steps of a graceful shutdown behind a load balancer, and why is the delay before closing needed?",
      answer:
        "On SIGTERM the instance marks itself not ready, keeps accepting and serving requests for a short period, then stops accepting new connections, closes idle keep-alive connections, waits for in-flight requests to finish, and exits before a hard timeout. The delay exists because the balancer and service discovery take time to notice the instance is draining; if you close the listener immediately, requests already routed to it get connection refused or resets. The hard timeout prevents a stuck request from blocking the deploy forever. Together these make deploys invisible to users.",
    },
    {
      question: "When are sticky sessions a reasonable choice, and what must still be true for correctness?",
      answer:
        "They are reasonable as an optimisation, for example to keep a WebSocket or long-polling client on the instance that holds its connection, or to improve hit rates of a per-user in-process cache. They make load less even and do not rebalance when you scale out, and many clients behind one NAT IP can overload an instance with IP-based hashing. For correctness, the system must still work when the instance disappears: the state must be recoverable from a shared store or the client, and reconnect logic must handle moving instances. If losing an instance logs users out or loses data, stickiness is hiding a statefulness bug.",
    },
  ],
  explainPrompt:
    "Explain to an interviewer in a system design round how you would take the NearBrew API from one server to many: what has to change in the service, how the load balancer decides where to send traffic, and how deploys avoid errors.",
  rubric: [
    "States statelessness as the prerequisite and lists concrete state to move",
    "Compares at least two balancing algorithms with when each fits",
    "Separates liveness and readiness correctly and names the cascading-failure risk",
    "Describes graceful shutdown steps in order",
    "Gives a balanced view of sticky sessions",
    "Uses numbers or observations from the exercise where possible",
  ],
  referenceExplanation:
    "First I would make the API stateless, because a load balancer can only spread traffic if any instance can serve any request. Today login sessions live in a Map in the process, so with three instances you are logged in on only one of them. I would move sessions to Redis, keep uploads in object storage, move rate-limit counters to Redis, and treat in-process caches as disposable. Then I put an L7 balancer in front, nginx or a cloud application load balancer, which terminates TLS and spreads requests. Round robin is fine when requests cost about the same; for a mix of quick reads and slow searches I would use least connections so slow requests do not pile up on one instance. Health checks come in two kinds. Liveness is shallow, just 'the process responds', so the orchestrator only restarts truly stuck instances. Readiness says whether this instance should get traffic; it is false while warming up and while shutting down. I would avoid making readiness depend on the shared database, because a database blip would mark every instance unready and turn a partial problem into a full outage. For deploys, each instance handles SIGTERM by going unready, waiting a couple of seconds for the balancer to notice, closing the listener, finishing in-flight requests and exiting before a timeout. In my local test this took a rolling restart from a burst of errors to essentially none. Sticky sessions I would only use as an optimisation, for example for WebSockets, never to make logins work.",
  stretch: {
    title: 'Autoscaling signal',
    description:
      "Add a `/metrics` endpoint exposing in-flight requests and event loop delay (week 17), and write a short design note on which signal you would autoscale on (CPU, concurrency, latency) for the NearBrew API and why.",
  },
  lightTask:
    "Run the three-instance Compose setup, reproduce the in-memory session bug with curl, and write a paragraph explaining why it happens and the two possible fixes (sticky sessions vs shared store) with their trade-offs.",
  intensiveExtras: [
    "Replace nginx with HAProxy and configure an active HTTP health check against `/readyz`, then kill an instance and watch it drain.",
    "Add WebSocket support for live check-in counts and design how reconnects should behave when an instance goes away.",
    "Load test with `npx autocannon -c 50 -d 20 http://localhost:8080/whoami` while scaling from 1 to 3 instances and record throughput and p99.",
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['system-design', 'backend-services', 'production-reliability'],
  depth: 'standard',
};

export const weeks13to19: Lesson[] = [week13, week14, week15, week16, week17, week18, week19];
