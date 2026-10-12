import type { Lesson } from '../types';

export const weeks34to39: Lesson[] = [
  // ---------------------------------------------------------------------------
  // Week 34
  // ---------------------------------------------------------------------------
  {
    week: 34,
    slug: 'timeouts-retries-backoff-circuit-breakers',
    title: 'Distributed systems failure: timeouts, retries, backoff with jitter, circuit breakers',
    track: 'system-design',
    secondaryTracks: ['backend'],
    topics: [
      'timeouts',
      'AbortController',
      'retries',
      'exponential backoff',
      'jitter',
      'retry budget',
      'idempotency',
      'circuit breaker',
    ],
    objective:
      'By the end you can build and justify a client that calls a flaky dependency safely: a hard timeout, retries only on retryable failures, exponential backoff with full jitter, a retry budget, and a circuit breaker.',
    whyItMatters:
      'Most production outages that spread are not caused by the first failure but by how callers react to it. A dependency that slows down from 50 ms to 5 s will exhaust your connection pool, your event loop and your users’ patience unless you time out; naive retries then multiply load on the struggling service and turn a blip into a meltdown. The patterns in this week are the difference between "the photo service was slow for two minutes" and "NearBrew was down for an hour".',
    explanation: [
      'Start with the uncomfortable truth: in a networked call you cannot distinguish "slow" from "dead" from "succeeded but the response was lost". The only tool you have is a **timeout**, which converts an unbounded wait into a bounded, explicit failure. Without one, a single slow dependency holds sockets, memory and request handlers open until something else gives way. In Node and the browser, `fetch` has no default timeout you should rely on; you pass an `AbortSignal` (from `AbortController`, or `AbortSignal.timeout(ms)` in modern runtimes) and the request rejects with an `AbortError`/`TimeoutError` when it fires. Pick the timeout from data: a little above the dependency’s observed p99, and always smaller than the time budget of the request that is calling it, otherwise your caller has already given up while you are still waiting.',
      'A **retry** is a bet that the failure was transient. That bet is only safe under two conditions. First, the failure must be the retryable kind: connection reset, timeout, 502/503/504, or 429 with a `Retry-After` header. A 400, 401, 404 or 422 will fail identically on the next attempt, so retrying just wastes capacity. Second, the operation must be **idempotent** or made idempotent. A GET is naturally safe; a POST that creates a check-in or charges a card is not, because a timeout may mean "the server did it and the reply got lost". The standard fix, which you built in week 10 for the queue worker, is an idempotency key sent by the client and stored by the server so the second attempt returns the first result instead of doing the work twice.',
      'How long to wait between attempts matters as much as whether to retry. Retrying immediately hammers a service exactly when it is weakest. **Exponential backoff** spaces attempts out: `base * 2^attempt`, capped at some maximum. But pure exponential backoff has a nasty property: if 10,000 clients all failed at the same instant (because the service blipped), they all retry at the same instants too, producing synchronized waves of load. **Jitter** randomizes the wait to spread those waves out. The AWS Architecture Blog post "Exponential Backoff And Jitter" simulated several strategies and found **full jitter**, `sleep = random(0, min(cap, base * 2^attempt))`, gives a good balance of low total work and fast completion. The mental model: backoff decides the size of the window, jitter decides where in the window each client lands.',
      'Retries multiply. If your API retries 3 times, and the service it calls also retries 3 times against its database, one user request can become 16 database attempts during an incident, precisely when the database is overloaded. Two defences: retry at **one layer only** (usually the one closest to the user that knows the overall deadline), and use a **retry budget**. A budget caps retries as a fraction of normal traffic, for example "retries may be at most 10% of requests in the last 10 seconds". When the dependency is healthy, almost no retries happen and the budget is irrelevant; when it is failing broadly, the budget stops retries from tripling load. Also carry a **deadline** through the call: once the overall budget is spent, stop retrying even if attempts remain.',
      'A **circuit breaker** handles the case where the dependency is not blipping but down. It watches recent outcomes and has three states. **Closed**: calls go through, failures are counted. When failures cross a threshold (say 5 consecutive, or 50% of the last 20), it trips to **Open**: calls fail immediately without touching the network, which protects the dependency and gives your users a fast fallback instead of a 5-second spinner. After a cooldown it moves to **Half-open** and lets a single probe through; success closes the circuit, failure reopens it. The breaker’s value is in fast failure plus a planned fallback: NearBrew can show cached café photos or a placeholder rather than an error page. Martin Fowler’s "CircuitBreaker" article is the classic short description.',
      'These pieces compose in a specific order, from the outside in: deadline for the whole operation, circuit breaker check, then per-attempt timeout, then classify the result, then if retryable and budget allows, sleep with full jitter and loop. Getting the order wrong creates real bugs: a breaker inside the retry loop will be hit once per attempt and trip faster than intended; a per-attempt timeout larger than the overall deadline means the deadline is fiction. In interviews and design reviews, being able to say "we time out at 800 ms because the p99 is 300 ms and our endpoint budget is 2 s, we retry twice with full jitter only on 503/timeout, writes carry an idempotency key, and a breaker serves cached data when the service is down" is a strong senior signal.',
    ],
    examples: [
      {
        language: 'ts',
        title: 'Full jitter backoff: the whole formula',
        code: `// attempt is 0-based: first retry uses attempt = 0
export function fullJitterDelay(attempt: number, baseMs = 100, capMs = 5_000): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.random() * ceiling; // anywhere in [0, ceiling)
}

// attempt 0 -> 0..100ms, 1 -> 0..200ms, 2 -> 0..400ms ... capped at 0..5000ms`,
      },
      {
        language: 'ts',
        title: 'Classifying failures before retrying',
        code: `export function isRetryable(err: unknown, res?: Response): boolean {
  if (res) {
    return res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
  }
  // fetch rejects with TypeError for network failures, and with
  // an AbortError / TimeoutError DOMException when the signal fires
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException) return err.name === 'AbortError' || err.name === 'TimeoutError';
  return false;
}`,
      },
    ],
    keyTakeaways: [
      'Every network call needs a timeout derived from the dependency’s latency and smaller than the caller’s own budget.',
      'Retry only transient failures (timeouts, resets, 429/502/503/504), and only idempotent operations or ones protected by an idempotency key.',
      'Use exponential backoff with full jitter to avoid synchronized retry storms.',
      'Retries multiply across layers; retry at one layer and enforce a retry budget and an overall deadline.',
      'A circuit breaker turns a dead dependency into fast failure plus a fallback, and probes for recovery in half-open state.',
    ],
    prerequisites: [
      'Comfortable with async/await and Promises in TypeScript',
      'Understands HTTP status codes and idempotent methods',
      'Has seen idempotency keys in the context of job retries',
    ],
    prerequisiteWeeks: [5, 8, 10, 17, 23],
    resources: [
      {
        title: 'Exponential Backoff And Jitter (AWS Architecture Blog)',
        url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
        kind: 'article',
        note: 'Read the whole post, focusing on the comparison of "Full Jitter", "Equal Jitter" and "Decorrelated Jitter" and the graphs of total calls vs completion time.',
        minutes: 12,
        verify: true,
      },
      {
        title: 'CircuitBreaker (Martin Fowler)',
        url: 'https://martinfowler.com/bliki/CircuitBreaker.html',
        kind: 'article',
        note: 'Read the state-machine description (closed, open, half-open) and the discussion of what to do when the breaker is open.',
        minutes: 8,
      },
      {
        title: 'AbortController (MDN)',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
        kind: 'docs',
        note: 'Read the overview and the fetch example; then skim AbortSignal.timeout() and AbortSignal.any() on the linked AbortSignal page.',
        minutes: 6,
      },
      {
        title: 'Site Reliability Engineering book: Addressing Cascading Failures',
        url: 'https://sre.google/sre-book/addressing-cascading-failures/',
        kind: 'book',
        note: 'Skim the sections on retries and latency/deadlines; notice how retries amplify load during overload.',
        minutes: 10,
        verify: true,
      },
    ],
    exercise: {
      title: 'Build fetchWithRetry against a deliberately flaky server',
      scenario:
        'NearBrew’s café detail screen calls an internal "photos" service that is known to be flaky: sometimes it returns 503, sometimes it hangs, occasionally it 404s for a café with no photos. You will write a small, dependency-free `fetchWithRetry` and circuit breaker in TypeScript, then run it against a local flaky Node server and watch its behaviour in the logs.',
      setup: [
        'Node 20 or newer (for global fetch and AbortSignal.timeout). Check with `node --version`.',
        'Create a folder `resilience-lab`, run `npm init -y` and `npm i -D tsx typescript @types/node`.',
        'Create `flaky-server.ts` and `client.ts` from the starter code below.',
        'In one terminal: `npx tsx flaky-server.ts`. In another you will run `npx tsx client.ts`.',
      ],
      steps: [
        'Start the flaky server and hit it a few times with `curl -i localhost:4000/photos/42` to see the mix of 200, 503, slow responses and the 404 for `/photos/0`.',
        'Implement `fetchOnce(url, timeoutMs)` using `AbortSignal.timeout(timeoutMs)` (or an AbortController plus setTimeout with clearTimeout in a finally). Confirm a hung request now rejects in ~timeoutMs instead of 10 seconds.',
        'Implement `isRetryable` for responses and errors. Make sure 404 is NOT retried and 503/timeout ARE retried.',
        'Implement the retry loop with full jitter: `maxAttempts`, `baseMs`, `capMs`, and an overall `deadlineMs`. Before sleeping, check that `now + delay` is still within the deadline; if not, give up. Honour `Retry-After` (seconds) on 429/503 if present by using it as the minimum delay.',
        'Add a retry budget: a sliding 10-second record of total requests and retries; allow a retry only if retries are under 20% of requests (with a small floor, e.g. always allow when fewer than 10 requests total).',
        'Implement `CircuitBreaker` with states closed/open/half-open, a consecutive-failure threshold of 5 and a cooldown of 3 seconds. Wrap the WHOLE retry operation in the breaker (one logical call = one breaker outcome), not each attempt.',
        'In `client.ts`, fire 50 calls with a small concurrency (e.g. 5 at a time) and log per call: attempts, total ms, final status, breaker state. Then flip the server into "down" mode (`curl -X POST localhost:4000/mode/down`) mid-run and watch the breaker open and calls fail fast. Flip back with `/mode/flaky` and watch half-open recover.',
        'Add a fallback: when the breaker is open, return `{ photos: [], fromFallback: true }` instead of throwing, and log that the UI would show a placeholder.',
      ],
      starter: [
        {
          language: 'ts',
          title: 'flaky-server.ts',
          code: `import { createServer } from 'node:http';

let mode: 'flaky' | 'down' | 'healthy' = 'flaky';

createServer((req, res) => {
  const url = req.url ?? '/';
  if (req.method === 'POST' && url.startsWith('/mode/')) {
    mode = url.slice('/mode/'.length) as typeof mode;
    res.end('mode=' + mode + '\\n');
    return;
  }
  if (url === '/photos/0') {
    res.writeHead(404).end('{"error":"no photos"}');
    return;
  }
  if (mode === 'down') {
    res.writeHead(503, { 'Retry-After': '1' }).end('{"error":"down"}');
    return;
  }
  const r = Math.random();
  if (mode === 'flaky' && r < 0.3) {
    res.writeHead(503).end('{"error":"try again"}');
  } else if (mode === 'flaky' && r < 0.4) {
    setTimeout(() => res.end('{"photos":["late.jpg"]}'), 10_000); // hang
  } else {
    setTimeout(() => res.end('{"photos":["a.jpg","b.jpg"]}'), 20 + Math.random() * 80);
  }
}).listen(4000, () => console.log('flaky server on :4000'));`,
        },
        {
          language: 'ts',
          title: 'client.ts (skeleton)',
          code: `type BreakerState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  constructor(private threshold = 5, private cooldownMs = 3_000) {}

  canRequest(now = Date.now()): boolean {
    // TODO: if open and cooldown elapsed -> half-open and allow ONE probe
    return this.state !== 'open';
  }
  onSuccess(): void { /* TODO: reset failures, close */ }
  onFailure(now = Date.now()): void { /* TODO: count, trip to open, record openedAt */ }
}

export interface RetryOptions {
  maxAttempts: number; // total attempts including the first
  baseMs: number;
  capMs: number;
  attemptTimeoutMs: number;
  deadlineMs: number;  // budget for the whole call
}

export async function fetchWithRetry(url: string, opts: RetryOptions): Promise<Response> {
  const start = Date.now();
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    // TODO: fetch with AbortSignal.timeout(opts.attemptTimeoutMs)
    // TODO: return on success or non-retryable response
    // TODO: compute full-jitter delay, respect Retry-After, deadline and retry budget
  }
  throw new Error('exhausted');
}`,
        },
      ],
      expected: [
        'Hung requests fail at roughly the attempt timeout, never at 10 seconds.',
        'Requests to `/photos/0` make exactly one attempt and surface the 404.',
        'In flaky mode most calls succeed within 1–3 attempts, and retry delays in the log vary randomly rather than lining up at 100/200/400 ms.',
        'After switching to down mode, the breaker opens after about 5 failed logical calls and subsequent calls return the fallback in under a few milliseconds.',
        'After switching back, a single half-open probe succeeds and the breaker closes.',
      ],
      hints: [
        'Use `AbortSignal.any([AbortSignal.timeout(attemptMs), deadlineSignal])` if your Node version supports it, so a single signal enforces both limits.',
        'Write the sleep as `await new Promise(r => setTimeout(r, ms))` and log the chosen delay so you can see the jitter.',
        'Remember to consume or cancel the body of a failed Response (`await res.body?.cancel()`) so sockets are released.',
        'Inject `now` and `random` as parameters to make the breaker and backoff unit-testable without real time.',
      ],
      verification: [
        'Run the 50-call script three times and note: median attempts, max total ms, and how many calls exceeded the deadline (should be zero).',
        'Temporarily disable jitter and compare the logged delays: they should align exactly, demonstrating the synchronization problem.',
        'Write two tiny assertions: 404 → attempts === 1; breaker after 5 failures → `canRequest()` is false until cooldown passes.',
      ],
    },
    successChecklist: [
      'Every attempt has a timeout and the whole call has a deadline smaller than the caller’s budget.',
      'Non-retryable statuses (400, 401, 404, 422) are never retried.',
      'Backoff uses full jitter with a cap and respects Retry-After.',
      'A retry budget limits retries to a fraction of recent traffic.',
      'The circuit breaker wraps the logical call, opens on sustained failure, and recovers through half-open.',
      'An open breaker returns a useful fallback instead of an error.',
    ],
    questions: [
      {
        question: 'Why is retrying a POST that creates a NearBrew check-in dangerous after a timeout, and how do you make it safe?',
        answer:
          'A timeout tells you only that you did not receive a reply in time; the server may have processed the request and the response was lost or slow. Retrying blindly can therefore create two check-ins (or two charges). To make it safe, the client generates an idempotency key per logical operation and sends it on every attempt; the server stores the key with the result in the same transaction as the write, and on a repeat key returns the stored result instead of writing again. Alternatively design the operation to be naturally idempotent, for example a PUT keyed by a client-generated id. Without one of these, the operation should not be retried automatically.',
      },
      {
        question: 'What problem does jitter solve that exponential backoff alone does not?',
        answer:
          'Exponential backoff reduces how often each client retries, but if many clients failed at the same moment they will all compute the same delays and retry in synchronized waves at t+100, t+300, t+700 ms and so on. Each wave is a spike that can knock the recovering service over again. Jitter randomizes each client’s delay within the backoff window so the retries are spread roughly evenly over time. Full jitter (random between zero and the exponential ceiling) was shown in the AWS analysis to minimise total work while still completing quickly.',
      },
      {
        question: 'Why should a circuit breaker wrap the whole retrying operation rather than each individual attempt, and what does half-open protect against?',
        answer:
          'If the breaker records each attempt, one logical user request with three attempts counts as three failures, so the breaker trips three times faster than the threshold you designed, and attempts may continue inside the loop even after it has opened. Wrapping the logical operation means one request equals one outcome and an open breaker short-circuits before any network work. Half-open protects the recovering dependency from a thundering herd: instead of every caller resuming at once when the cooldown ends, only a single probe (or a small number) is allowed, and the circuit closes only if it succeeds.',
      },
    ],
    explainPrompt:
      'Explain to a mid-level teammate in a code review why their PR’s `retry(3)` around the photos API call is not enough, and walk through what you would change: timeouts, which errors to retry, backoff with jitter, retry budgets and a circuit breaker.',
    rubric: [
      'Explains that timeouts are mandatory and how to choose the value from latency data and caller budget.',
      'Distinguishes retryable from non-retryable failures and mentions idempotency for writes.',
      'Explains why jitter is needed, not just that it exists.',
      'Describes retry amplification across layers and a mitigation (single layer, budget, deadline).',
      'Describes circuit breaker states and the user-facing fallback.',
      'Keeps the tone constructive and specific to the PR rather than lecturing.',
    ],
    referenceExplanation:
      'Thanks for adding resilience here; a few things would make `retry(3)` actually safe. First, there is no timeout, so when the photos service hangs we wait until the socket gives up, which can be tens of seconds while the user stares at a spinner. Let’s pass `AbortSignal.timeout(800)`: their p99 is around 300 ms and our endpoint budget is 2 s, so we can afford two attempts plus waits inside an overall deadline. Second, the retry fires on any error, including 404 for cafés with no photos and 400s from bad input. Those will fail the same way every time, so we should only retry timeouts, network errors and 429/502/503/504, honouring Retry-After. Third, the retries are immediate. If the service blips, every client retries at the same instant and we hit it hardest when it is weakest. Exponential backoff with full jitter, random between zero and min(cap, base·2^n), spreads that load out. Fourth, the API layer and the photos client both retry today, so one user request can become nine calls; let’s keep retries only here and add a small retry budget so retries can never exceed about 20% of traffic. Finally, when the service is fully down, a circuit breaker should fail fast after a handful of failures and return cached or placeholder photos, then probe with a single half-open request. The page degrades gracefully instead of timing out.',
    stretch: {
      title: 'Hedged requests and decorrelated jitter',
      description:
        'Implement a hedged GET: if the first attempt has not answered by the p95 latency, send a second in parallel and take whichever returns first, cancelling the other with AbortController. Compare tail latency and total request count against plain retries. Then implement the "decorrelated jitter" variant from the AWS post and compare delay distributions.',
    },
    lightTask:
      'Write only `fetchOnce` with `AbortSignal.timeout` plus a three-attempt retry loop using full jitter that skips 4xx responses, run it against the flaky server for 20 calls, and note how many attempts each call took.',
    intensiveExtras: [
      'Add idempotency keys: make the flaky server accept `POST /checkins` with an `Idempotency-Key` header, randomly drop the response after writing, and prove retries create exactly one check-in.',
      'Write property-style tests for `fullJitterDelay` with an injected random function: delays are always within [0, min(cap, base·2^n)).',
      'Turn the breaker into a rolling-window failure-rate breaker (e.g. trip at 50% failures over the last 20 calls, minimum 10 calls) and compare behaviour with the consecutive-failure version.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['production-reliability', 'system-design', 'backend-services', 'js-ts'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 35
  // ---------------------------------------------------------------------------
  {
    week: 35,
    slug: 'testing-strategy-what-to-test',
    title: 'Testing strategy: unit, integration, end-to-end, contract tests, and what to test',
    track: 'senior',
    secondaryTracks: ['frontend', 'backend'],
    topics: [
      'testing pyramid',
      'testing trophy',
      'unit tests',
      'integration tests',
      'end-to-end tests',
      'contract tests',
      'test doubles',
      'flaky tests',
    ],
    objective:
      'By the end you can design a test plan for a real feature that puts each risk at the cheapest test level that can catch it, and explain why you did not test some things.',
    whyItMatters:
      'Teams rarely fail from having too few tests; they fail from having the wrong ones: slow, flaky end-to-end suites nobody trusts, unit tests that mirror implementation and break on every refactor, and no coverage at the seams where bugs actually live (database queries, API contracts, auth). A senior engineer is expected to decide what to test and at what level, and to defend that choice in a design doc or review.',
    explanation: [
      'Think of a test as an instrument for a specific risk, with a cost. Its cost is how long it takes to write, how long it takes to run, how often it fails for reasons unrelated to bugs (flakiness), and how often it must be rewritten when the code is refactored but behaviour is unchanged. Its value is the probability it catches a real defect before a user does, and how precisely it tells you where. The classic **test pyramid** (many unit, fewer integration, very few end-to-end) is a heuristic about that cost curve; Martin Fowler’s "The Practical Test Pyramid" explains it well. Kent C. Dodds’ "testing trophy" shifts the weight toward integration tests for UI code, because in a React app most bugs live in how components, hooks and data fetching fit together, not inside one pure function.',
      '**Unit tests** shine for logic with many branches and no I/O: price calculations, opening-hours parsing ("is this café open at 23:30 on a Sunday in a different timezone?"), the full-jitter function from week 34, reducers, validation. They run in milliseconds and pinpoint failures. They become a liability when they test implementation details: asserting that a private method was called, or snapshotting a large component tree. A useful rule: test through the public interface, and assert on outputs and observable effects, so the test survives refactoring.',
      '**Integration tests** exercise a real seam: your repository code against a real Postgres (Docker, or Testcontainers), your API handler through HTTP with a real router and serialization, a React screen with React Testing Library and a mocked network layer (for example MSW) rather than mocked hooks. These catch the bugs unit tests cannot: a wrong SQL join, a missing index that makes a query time out, a column renamed in a migration, an `undefined` that serializes differently. In backend code, "don’t mock the database" is usually correct advice now that spinning up Postgres in a container takes seconds.',
      '**End-to-end tests** drive the real system the way a user does (Playwright or Cypress in a browser, Detox or Maestro on mobile). They are the only tests that prove the critical journeys work: sign up, search nearby cafés, check in, book a slot, pay. They are also the slowest and flakiest because they include timing, network and environment. Keep them few and focused on revenue- or trust-critical paths, make them deterministic (seeded data, no sleeping for fixed times, wait for UI state instead), and quarantine and fix flaky tests quickly, because a suite that is "usually red" teaches everyone to ignore red.',
      '**Contract tests** protect the boundary between independently deployed services or between a mobile app and its API. Instead of spinning up both sides, the consumer records the requests it makes and the response shapes it relies on (consumer-driven contracts, as popularised by Pact), and the provider’s CI verifies it still satisfies them. This connects directly to week 32’s API evolution: a contract test is how you know a "harmless" field rename would break the NearBrew iOS build that is still in users’ pockets. A lighter-weight version is validating responses against an OpenAPI or JSON Schema in the provider’s tests.',
      'The output of this week is a habit: for each feature, list the risks, then place each at the cheapest level that can catch it, and write down what you are deliberately not testing and why. "We don’t E2E-test the café photo carousel because a regression is low impact and visible in QA; we do integration-test the booking query because a double booking is a support incident and a refund." That sentence is what reviewers and interviewers want to hear. Coverage percentage is a weak proxy; mutation testing or "would this test fail if I broke the line?" is a much better question.',
    ],
    examples: [
      {
        language: 'text',
        title: 'Risk-to-level test plan for NearBrew "favourite a café"',
        code: `Risk                                         Level         Why there
--------------------------------------------------------------------------------
Toggle logic: optimistic UI rolls back on 500  Integration   RTL + MSW, real hooks/cache
Duplicate favourite rows on double tap          Integration   Real Postgres unique constraint
Favourites list sorted by most recent           Unit          Pure function, many cases
API response shape used by iOS v3.2             Contract      Old app versions in the wild
Signed-in user can favourite and see it         E2E (1 test)  Critical journey smoke test
Heart icon animation timing                     Not tested    Low impact, visual QA`,
      },
    ],
    keyTakeaways: [
      'Each test is an instrument for a specific risk with a cost: runtime, flakiness and maintenance.',
      'Unit-test branchy pure logic through public interfaces; avoid asserting implementation details.',
      'Integration tests at real seams (real database, real HTTP, RTL with mocked network) catch most real bugs.',
      'Keep E2E tests few, deterministic, and focused on critical journeys; fix or quarantine flakes fast.',
      'Contract tests protect independently deployed consumers, especially mobile apps on old versions.',
      'Write down what you deliberately are not testing and why.',
    ],
    prerequisites: [
      'Has written Jest/Vitest tests and used React Testing Library',
      'Can run Postgres in Docker',
    ],
    prerequisiteWeeks: [1, 3, 15, 28, 32, 34],
    resources: [
      {
        title: 'The Practical Test Pyramid (martinfowler.com)',
        url: 'https://martinfowler.com/articles/practical-test-pyramid.html',
        kind: 'article',
        note: 'Read the sections on unit tests, integration tests, contract tests and "Avoid Test Duplication". Skim the Java-specific code.',
        minutes: 15,
      },
      {
        title: 'Testing Library: Guiding Principles',
        url: 'https://testing-library.com/docs/guiding-principles',
        kind: 'docs',
        note: 'Short page: why tests should resemble how software is used.',
        minutes: 4,
        verify: true,
      },
      {
        title: 'Vitest Guide',
        url: 'https://vitest.dev/guide/',
        kind: 'docs',
        note: 'Skim getting started and mocking if you have not used Vitest before.',
        minutes: 5,
      },
      {
        title: 'Playwright: Best Practices',
        url: 'https://playwright.dev/docs/best-practices',
        kind: 'docs',
        note: 'Read the sections on testing user-visible behaviour, isolation and locators; these are the main defences against flakiness.',
        minutes: 6,
        verify: true,
      },
    ],
    exercise: {
      title: 'Write a test plan, then implement its three most valuable tests',
      scenario:
        'NearBrew is adding "Reserve a table" for partner cafés: a user picks a 30-minute slot, the API creates a reservation, and the café dashboard shows it. You own the test strategy.',
      setup: [
        'A Vite + React + TS project with Vitest and React Testing Library (`npm create vite@latest`, then `npm i -D vitest @testing-library/react @testing-library/user-event jsdom msw`).',
        'Postgres in Docker: `docker run --rm -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16`.',
      ],
      steps: [
        'List at least 8 risks for the feature (e.g. two users reserve the same slot, timezone mismatch between café and user, slot list shows past times, API returns 409 and UI shows nothing, iOS app depends on `slot.startsAt` being ISO-8601).',
        'For each risk, assign a test level (unit, integration, contract, E2E, or explicitly not tested) and a one-line reason. Keep this as a table in a `TEST_PLAN.txt`.',
        'Implement a unit test suite for `availableSlots(openingHours, existingReservations, now, tz)` covering at least: past slots excluded, closed days, a slot overlapping an existing reservation, a DST boundary.',
        'Implement an integration test against real Postgres: two concurrent inserts for the same `(cafe_id, starts_at)` and assert exactly one succeeds (a unique constraint or exclusion constraint; reuse your week 7 work).',
        'Implement a React Testing Library test with MSW: clicking a slot when the API returns 409 shows "That slot was just taken" and refreshes the list. Query by role and text, not by test ids or class names.',
        'Pick ONE end-to-end journey you would automate and write it as Playwright pseudo-code or real code if you have time. Justify why only one.',
      ],
      starter: [
        {
          language: 'ts',
          title: 'slots.ts (implement me)',
          code: `export interface OpeningHours { [weekday: number]: { open: string; close: string } | null } // 0 = Sunday, 'HH:MM'
export interface Reservation { startsAt: string } // ISO-8601 UTC

/** Returns ISO-8601 UTC start times of free 30-minute slots for the café's local date. */
export function availableSlots(
  hours: OpeningHours,
  existing: Reservation[],
  localDate: string, // 'YYYY-MM-DD' in the café timezone
  tz: string,        // e.g. 'Europe/London'
  now: Date,
): string[] {
  throw new Error('TODO');
}`,
        },
        {
          language: 'sql',
          title: 'Integration test schema',
          code: `CREATE TABLE reservations (
  id bigserial PRIMARY KEY,
  cafe_id bigint NOT NULL,
  starts_at timestamptz NOT NULL,
  user_id bigint NOT NULL,
  UNIQUE (cafe_id, starts_at)
);`,
        },
      ],
      expected: [
        'A written plan where every risk has a level and reason, including at least one "not tested" with justification.',
        'Unit tests run in well under a second and fail when you deliberately break the overlap check.',
        'The concurrency integration test reliably shows one success and one unique-violation error (SQLSTATE 23505).',
        'The RTL test passes without referencing implementation details and fails if the error message is removed.',
      ],
      hints: [
        'Inject `now` into `availableSlots` so tests are deterministic; never call `new Date()` inside it.',
        'For the concurrency test, use two separate `pg` clients and `Promise.allSettled` on the two inserts.',
        'For DST, pick a date when Europe/London changes clocks; the number of slots between open and close may change if you compute in UTC naively.',
      ],
      verification: [
        'Break each piece of code on purpose (remove the overlap check, drop the unique constraint, delete the 409 handler) and confirm a test fails each time and points to the right place.',
        'Time the whole suite; note which test level dominates runtime.',
        'Have someone (or your future self tomorrow) read TEST_PLAN.txt and check they could tell why each level was chosen.',
      ],
    },
    successChecklist: [
      'A risk-based test plan with level and reason for every row.',
      'At least one deliberate "not tested" decision with a justification.',
      'Unit tests for slot logic including a timezone/DST case.',
      'A real-database integration test proving double booking is prevented.',
      'An RTL + MSW test for the 409 conflict UX that queries by role or text.',
      'Each test fails when the code it protects is broken.',
    ],
    questions: [
      {
        question: 'When is mocking the database in a backend test a mistake, and when is it reasonable?',
        answer:
          'It is a mistake when the behaviour you care about lives in the database: SQL correctness, constraints, transactions, isolation and index-dependent performance. A mock will happily return whatever you told it, so a broken join or a missing unique constraint passes. Since Postgres in Docker starts in seconds, those tests should hit a real instance. Mocking a repository interface is reasonable when testing business logic above it, for example a pricing service that only needs "here are the reservations", where the database is incidental and you want fast, branch-heavy tests.',
      },
      {
        question: 'What makes end-to-end tests flaky, and what are three concrete defences?',
        answer:
          'Flakiness comes from nondeterminism: timing (animations, network latency, debounces), shared or leftover data between tests, external services, and environment differences. Defences: wait for user-visible state rather than sleeping fixed times (Playwright’s auto-waiting locators and web-first assertions), isolate data by seeding per-test fixtures or unique users, and stub third parties at the network boundary. Operationally, track flake rates and quarantine a flaky test immediately with an owner and a deadline, because a suite people expect to be red stops protecting anything.',
      },
      {
        question: 'What does a consumer-driven contract test protect that an OpenAPI spec alone does not?',
        answer:
          'An OpenAPI spec says what the provider promises, but not which parts each consumer actually relies on, and it can drift from the implementation if not validated. A consumer-driven contract records the specific interactions and fields a consumer uses, and the provider’s CI verifies the real implementation against them on every change. That tells the provider exactly which consumer would break, including old mobile app versions, before deploying. It also lets the provider safely change things no consumer uses.',
      },
    ],
    explainPrompt:
      'Explain to your engineering manager, who has asked "should we just aim for 90% coverage?", how you decided what to test for the table reservation feature and why coverage is not the goal.',
    rubric: [
      'Frames testing as risk reduction with costs, not a coverage number.',
      'Maps specific risks to specific test levels with reasons.',
      'Mentions at least one thing deliberately not tested and why.',
      'Addresses flakiness and suite speed as real costs.',
      'Avoids jargon the manager would not know, or explains it.',
    ],
    referenceExplanation:
      'Coverage tells us which lines ran during tests, not whether any test would notice if those lines were wrong, so I’d rather we aim at the risks that would hurt us. For table reservations, the worst outcome is two people booked into the same slot: that is a support ticket, an awkward moment in a café and a partner who loses trust. So that has a test against a real Postgres database firing two simultaneous bookings and proving only one succeeds; a mocked database could never catch it. The next riskiest thing is time: slots across timezones and daylight-saving changes. That logic is pure and branchy, so it gets fast unit tests with a fixed clock. On the UI, the important behaviour is what happens when a slot is taken while you are looking at it; one integration test renders the real screen with a fake network that returns a conflict and checks the user sees a clear message. Because older iOS versions stay installed for months, a contract test pins the response fields the app depends on. We have exactly one end-to-end test for the happy path, because browser tests are slow and flaky and we want the suite trusted. We are not testing animations or the visual layout of the slot grid; that is cheap to fix and visible in QA. Our coverage will probably land around 70–80%, but every test there earns its keep.',
    stretch: {
      title: 'Mutation testing',
      description:
        'Run Stryker (stryker-mutator.io) against `slots.ts` and look at surviving mutants. Each survivor is a line your tests execute but do not really check. Add or tighten tests until the mutation score is high, and compare that experience with line coverage.',
    },
    lightTask:
      'Write the risk-to-level test plan table for the reservation feature (8 risks, level, reason, at least one "not tested"), and implement only the real-Postgres double-booking integration test.',
    intensiveExtras: [
      'Add a contract check: validate the reservation API response against a JSON Schema in the provider test, then rename a field and watch it fail.',
      'Write the Playwright happy-path test for real against your local Vite app and measure its runtime vs the rest of the suite.',
      'Find a test in your own work codebase that asserts implementation details and rewrite it to test behaviour.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['ui-reliability', 'feature-ownership', 'technical-communication', 'backend-services'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 36
  // ---------------------------------------------------------------------------
  {
    week: 36,
    slug: 'operating-systems-shell-processes-signals',
    title: 'Operating systems for app engineers: processes, file descriptors, signals, and the shell',
    track: 'cs',
    secondaryTracks: ['backend'],
    topics: [
      'processes',
      'file descriptors',
      'pipes and redirection',
      'signals',
      'SIGTERM vs SIGKILL',
      'graceful shutdown',
      'exit codes',
      'job control',
      'MIT Missing Semester',
    ],
    objective:
      'By the end you can explain what a process, file descriptor and signal are, use the shell to inspect a running Node service, and implement a graceful shutdown that behaves correctly when a container orchestrator stops it.',
    whyItMatters:
      'Many confusing production behaviours are operating system behaviours: a deploy that drops in-flight requests because the process ignored SIGTERM, "EMFILE: too many open files" under load, a script that hangs because a pipe was never closed, a CI step that "passed" because a pipeline swallowed a non-zero exit code. Knowing the OS model lets you debug these with a few shell commands instead of guessing.',
    explanation: [
      'A **process** is a running program with its own memory, a process id (PID), a parent (PPID), an environment, a current directory, and a table of open **file descriptors**. When you run `node server.js` from a shell, the shell forks a child and execs Node in it; the child inherits the environment and the three standard descriptors: 0 (stdin), 1 (stdout), 2 (stderr). Every process ends with an **exit code**: 0 means success, anything else is failure, and a process killed by a signal is reported by shells as 128 plus the signal number (so 137 is 128 + 9, SIGKILL, a classic sign of being OOM-killed in a container).',
      'A **file descriptor** is just a small integer index into the process’s table of open things, and on Unix "things" include files, pipes, TCP sockets and terminals. That uniformity is why the shell is so powerful: `>` redirects fd 1 to a file, `2>&1` makes fd 2 point at whatever fd 1 points at, and `|` connects one process’s stdout to the next process’s stdin through a pipe. It is also why "too many open files" happens to a web server that never opens a file: every socket counts against the per-process limit you can see with `ulimit -n`, and leaked HTTP connections or unclosed streams exhaust it. `lsof -p <pid>` lists them.',
      '**Signals** are asynchronous notifications the kernel delivers to a process. The ones you will meet constantly: SIGINT (Ctrl-C), SIGTERM ("please shut down", the default for `kill` and what Docker and Kubernetes send on stop), SIGKILL (cannot be caught; the process is gone), SIGHUP (terminal closed; often repurposed as "reload config"), and SIGCHLD (a child changed state). A process can install handlers for most signals. In Node, `process.on("SIGTERM", ...)` lets you stop accepting new connections, finish in-flight requests, flush logs and close the database pool, then exit. If you do nothing, Node exits immediately on SIGTERM and drops in-flight requests; if your handler never exits, the orchestrator waits its grace period and sends SIGKILL anyway.',
      'Containers add one subtle trap. The first process in a container is **PID 1**, which the kernel treats specially: signals with no installed handler are ignored for PID 1 rather than taking their default action. If your Dockerfile uses `CMD npm start`, npm (or a shell) may be PID 1 and may not forward SIGTERM to Node, so the container sits until the grace period ends and is SIGKILLed: deploys get slow and requests get cut off. Fixes are running node directly in exec form (`CMD ["node", "server.js"]`), using `docker run --init` or tini, and always having a SIGTERM handler.',
      'The **MIT Missing Semester** course is the best free tour of this material from a working engineer’s point of view. The "Shell Tools and Scripting" and "Command-line Environment" lectures cover pipes, redirection, job control (`Ctrl-Z`, `bg`, `fg`, `jobs`), signals and `kill`, and process inspection. Treat the shell not as a toolbox of memorised commands but as a composition language over processes and file descriptors: small programs that read stdin and write stdout, glued with pipes. One more trap to remember: in bash, a pipeline’s exit status is that of the last command, so `npm test | tee log.txt` reports success even if tests fail unless you `set -o pipefail`.',
    ],
    examples: [
      {
        language: 'bash',
        title: 'Inspecting a running service',
        code: `pgrep -fl "node server"              # find the PID
ps -o pid,ppid,stat,rss,command -p 12345
lsof -p 12345 | wc -l                 # how many fds are open
lsof -p 12345 -iTCP -sTCP:LISTEN      # what is it listening on
kill -TERM 12345                      # polite stop
echo $?                               # exit status of the last command`,
      },
      {
        language: 'ts',
        title: 'Graceful shutdown in Node',
        code: `import { createServer } from 'node:http';

const server = createServer(async (_req, res) => {
  await new Promise((r) => setTimeout(r, 3000)); // slow request
  res.end('done\\n');
}).listen(3000);

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error('received ' + signal + ', draining');
  server.close(() => {            // stops accepting, waits for in-flight
    console.error('drained, exiting');
    process.exit(0);
  });
  server.closeIdleConnections();  // drop idle keep-alive sockets (Node 18.2+)
  setTimeout(() => process.exit(1), 10_000).unref(); // hard deadline
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));`,
      },
    ],
    keyTakeaways: [
      'A process has a PID, parent, environment, and a file descriptor table; exit code 0 means success and 128+N means killed by signal N.',
      'Files, pipes and sockets are all file descriptors, which is why sockets count toward "too many open files".',
      'SIGTERM is a request you should handle by draining; SIGKILL cannot be caught.',
      'PID 1 in a container ignores unhandled signals; use exec-form CMD, --init/tini and an explicit handler.',
      'Shell pipelines report the last command’s exit status unless pipefail is set.',
    ],
    prerequisites: [
      'Can use a terminal and run Node scripts',
      'Has run a container with Docker',
    ],
    prerequisiteWeeks: [5, 9, 17, 25],
    resources: [
      {
        title: 'MIT Missing Semester: Shell Tools and Scripting',
        url: 'https://missing.csail.mit.edu/2020/shell-tools/',
        kind: 'course',
        note: 'Read the scripting half: exit codes, `&&`/`||`, command substitution, and the tools section on finding files and history.',
        minutes: 10,
      },
      {
        title: 'MIT Missing Semester: Command-line Environment',
        url: 'https://missing.csail.mit.edu/2020/command-line/',
        kind: 'course',
        note: 'Read the "Job Control" section closely (signals, kill, Ctrl-Z, bg/fg, nohup), then skim terminal multiplexers and dotfiles.',
        minutes: 12,
      },
      {
        title: 'MIT Missing Semester: course index',
        url: 'https://missing.csail.mit.edu/',
        kind: 'course',
        note: 'Bookmark it; the "Debugging and Profiling" lecture is a good follow-up for intensive weeks.',
        minutes: 2,
      },
      {
        title: 'Node.js docs: Process signal events',
        url: 'https://nodejs.org/api/process.html#signal-events',
        kind: 'docs',
        note: 'Read the signal events section, especially the notes on SIGTERM/SIGINT default behaviour and what cannot be caught.',
        minutes: 6,
        verify: true,
      },
    ],
    exercise: {
      title: 'Make a NearBrew API container shut down without dropping requests',
      scenario:
        'Every time NearBrew deploys, a few users get "connection reset" errors on the reviews endpoint and the deploy takes 30 seconds longer than expected per instance. You suspect signal handling. You will reproduce it locally with plain processes and then with Docker.',
      setup: [
        'Node 20+, a terminal with `ps`, `kill`, `lsof` (macOS/Linux; on Windows use WSL).',
        'Docker for the container part (optional but recommended).',
        'Save the graceful shutdown example above as `server.ts` but comment out the two `process.on` lines for now; run with `npx tsx server.ts` or compile to `server.js`.',
      ],
      steps: [
        'Start the server. In a second terminal run `curl -s localhost:3000 & sleep 1; kill -TERM $(pgrep -f "server")`. Observe the curl fails (connection reset / empty reply) because Node exits immediately on unhandled SIGTERM.',
        'Re-enable the handlers. Repeat: the in-flight curl now completes with "done" and the process exits 0. Check `echo $?` in the server terminal.',
        'Run `lsof -p <pid>` while the server is idle, then while running 50 parallel curls (`for i in $(seq 50); do curl -s localhost:3000 >/dev/null & done`). Watch the count of descriptors rise with sockets.',
        'Practise job control: start the server in the foreground, press Ctrl-Z, run `jobs`, `bg`, `fg`, and finally Ctrl-C. Note which signal each action sends (SIGTSTP, SIGCONT, SIGINT).',
        'Write a Dockerfile with `CMD npm start` (where the start script runs node server.js). Build and run, start a slow curl, then `time docker stop <container>`. Note how long it takes and whether the curl survives.',
        'Change to exec form `CMD ["node", "server.js"]` and repeat; then try `docker run --init`. Record the `docker stop` duration and exit code (`docker inspect -f "{{.State.ExitCode}}"`) for each variant.',
        'Finally, show the pipefail trap: `node -e "process.exit(3)" | cat; echo $?` vs `set -o pipefail; node -e "process.exit(3)" | cat; echo $?`.',
      ],
      starter: [
        {
          language: 'text',
          title: 'Dockerfile (variant A: the trap)',
          code: `FROM node:20-slim
WORKDIR /app
COPY package.json server.js ./
CMD npm start`,
        },
      ],
      expected: [
        'Without handlers, SIGTERM kills in-flight requests; with handlers, they complete and exit code is 0.',
        'The open descriptor count grows with concurrent connections and returns to baseline after.',
        'With the shell-form CMD, `docker stop` may take about 10 seconds (the default grace period) and end with exit 137, depending on whether your npm version forwards signals; with exec form plus a handler it stops in about the time of the in-flight request with exit 0.',
        'The pipeline returns 0 without pipefail and 3 with it.',
      ],
      hints: [
        'Check who is PID 1 inside the container with `docker exec <id> ps -o pid,command` (install procps in slim images, or read /proc/1/cmdline).',
        'Remember `server.close()` waits for keep-alive connections too; that is why `closeIdleConnections()` matters.',
        'If behaviour differs from the expected output, write down what you saw: npm’s signal forwarding has changed across versions, which is exactly why you should not rely on it.',
      ],
      verification: [
        'You have a short table: variant, docker stop duration, exit code, did the in-flight request complete.',
        'You can explain exit code 137 and 143 without looking it up.',
        'Your final Dockerfile and server pass a deploy simulation where 20 slow requests are in flight during `docker stop` and none fail.',
      ],
    },
    successChecklist: [
      'Reproduced a dropped request on SIGTERM without a handler.',
      'Implemented a graceful shutdown with a drain and a hard deadline.',
      'Inspected open file descriptors of a live process with lsof.',
      'Compared shell-form vs exec-form CMD and --init in Docker with measured results.',
      'Demonstrated and fixed the pipeline exit code trap with pipefail.',
    ],
    questions: [
      {
        question: 'A container exits with code 137 under load. What does that tell you and how would you investigate?',
        answer:
          '137 is 128 + 9, meaning the process was killed by SIGKILL, which it cannot catch. In containers the most common sources are the kernel OOM killer when the memory limit is exceeded and an orchestrator escalating to SIGKILL after the stop grace period. Check `docker inspect` for `OOMKilled: true` or Kubernetes pod status for "OOMKilled", look at memory metrics leading up to the kill, and check whether a deploy or scale-down was happening at the time. If it is OOM, investigate a leak or raise the limit (week 29); if it is grace-period escalation, fix signal handling.',
      },
      {
        question: 'Why can a Node web server hit "EMFILE: too many open files" when it never calls fs.open?',
        answer:
          'On Unix every TCP socket is a file descriptor, as are pipes and some internal handles, and each process has a descriptor limit (`ulimit -n`). A server with many concurrent clients, many outbound keep-alive connections, or leaked sockets and streams that are never closed will consume descriptors until it hits the limit. Investigate with `lsof -p <pid>` to see what kinds of descriptors dominate, then fix the leak (close response bodies, reuse agents with bounded pools) before raising the limit.',
      },
      {
        question: 'What should a SIGTERM handler in an API server do, and in what order?',
        answer:
          'First mark the instance as shutting down so its readiness check fails and the load balancer stops routing new traffic to it. Then stop accepting new connections (`server.close()`), close idle keep-alive connections, and let in-flight requests finish. After that, stop background work such as queue consumers, flush logs and metrics, and close database pools. Finally exit with code 0, and set a hard deadline shorter than the orchestrator’s grace period that exits non-zero if draining hangs, so you control the outcome instead of being SIGKILLed.',
      },
    ],
    explainPrompt:
      'Explain to a frontend-focused teammate who just joined on-call why the deploy was dropping requests and taking 30 seconds per instance, using the ideas of processes, signals and PID 1, and what you changed.',
    rubric: [
      'Explains SIGTERM vs SIGKILL and the grace period clearly.',
      'Explains the PID 1 / shell-form CMD trap in plain language.',
      'Describes the graceful shutdown sequence and why order matters.',
      'Uses evidence from the experiment (timings, exit codes).',
      'Avoids unexplained jargon for a frontend audience.',
    ],
    referenceExplanation:
      'When Docker or Kubernetes wants to stop a container, it sends the main process a signal called SIGTERM, which means "please shut down". It then waits a grace period, about 10 seconds by default in Docker, and if the process is still alive it sends SIGKILL, which cannot be ignored and ends it instantly. We had two problems. First, our container started with `npm start` written in shell form, so the first process in the container, PID 1, was a shell or npm rather than Node. PID 1 is special: signals it has no handler for are ignored, and our wrapper was not forwarding SIGTERM to Node. So Node never heard the polite request, the container sat for the full grace period, and then everything was SIGKILLed mid-request. That is where the extra time per instance and the connection resets came from; exit code 137, which is 128 plus signal 9, confirmed it. Second, even when Node did receive SIGTERM, it had no handler, and Node’s default is to exit immediately, dropping in-flight requests. The fix: run node directly with the exec-form CMD so it is the process receiving signals, and add a SIGTERM handler that fails readiness, stops accepting connections, lets in-flight requests finish, closes the database pool and exits 0, with a hard deadline as a safety net. Locally, docker stop went from about 10 seconds with exit 137 to about 3 seconds with exit 0, and no curls failed.',
    stretch: {
      title: 'Write a tiny process supervisor',
      description:
        'Write a Node script that spawns your server as a child process with `child_process.spawn`, pipes its stdout/stderr with a prefix, forwards SIGTERM and SIGINT to it, restarts it with backoff (week 34) if it crashes, and exits with the child’s exit code on shutdown. This is roughly what tini, nodemon and pm2 do.',
    },
    lightTask:
      'Run the graceful shutdown example twice, once without the SIGTERM handler and once with it, sending `kill -TERM` during a slow curl, and write two sentences on what changed and why.',
    intensiveExtras: [
      'Work through the MIT Missing Semester "Debugging and Profiling" lecture and use `strace` (Linux) or `dtruss`/Instruments (macOS) to watch the system calls your server makes on one request.',
      'Write a bash script with `set -euo pipefail` that seeds a NearBrew dev database, and deliberately trigger each of the three options to see what they catch.',
      'Lower `ulimit -n` to 64 in a shell, start the server there, and load it until you reproduce EMFILE; then fix it with a bounded connection pool on the client side.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['cs-fundamentals', 'production-reliability', 'backend-services'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 37
  // ---------------------------------------------------------------------------
  {
    week: 37,
    slug: 'system-design-booking-reservation',
    title: 'Backend system design: design a booking/reservation system',
    track: 'interview',
    secondaryTracks: ['system-design', 'backend'],
    topics: [
      'requirements',
      'capacity estimation',
      'data model',
      'double booking',
      'exclusion constraints',
      'holds with expiry',
      'payments',
      'idempotency',
      'notifications',
    ],
    objective:
      'By the end you can run a 45-minute system design conversation for a reservation system, from requirements and back-of-envelope numbers to a data model that makes double booking impossible, temporary holds, payment integration and notifications.',
    whyItMatters:
      'Booking systems are a favourite design problem because they force correctness under concurrency, a state machine that spans an external payment provider, and clear trade-offs between strong consistency (the seat) and eventual consistency (search results, emails). Every piece reuses something from earlier weeks: transactions and locking (week 7), queues and idempotency (week 10), and timeouts and retries (week 34).',
    explanation: [
      'Start with **requirements**, and say them out loud. Functional: a user searches availability for a resource (a café table, a hair appointment, a concert seat), places a temporary hold, pays, receives a confirmation, and can cancel; the venue sees bookings and manages inventory. Non-functional: **never double-book** (correctness beats availability for the booking write path), search can be slightly stale, confirmation latency under a couple of seconds, survive a payment provider being slow, and handle spikes (a popular event goes on sale). Clarifying whether inventory is "N interchangeable units" (20 tables of 2) or "specific items" (seat 14C) changes the data model, so ask.',
      'Then **capacity estimates**, quick and rounded. Suppose 5,000 partner venues, an average of 200 bookable slots per day each: 1 million slots a day. If 10% get booked, that is 100,000 bookings a day, about 1.2 per second on average; assume a 10x peak in evening hours and 100x for a hot drop, so design the write path for roughly 100 bookings per second, which a single well-indexed Postgres primary handles comfortably. Reads (availability views) might be 50–100x writes, so a few thousand per second at peak: that is the part that needs caching or read replicas (weeks 4 and 27). Storage is small: 100k rows a day at about 1 KB is roughly 36 GB a year. The point of the numbers is to justify **not** sharding yet and to show where load really is.',
      'The **data model** centres on making the invariant structural. For specific-item inventory, a `slots` table (`id`, `venue_id`, `starts_at`, `ends_at`, `resource_id`) and a `bookings` table with a status (`held`, `confirmed`, `cancelled`, `expired`) and `hold_expires_at`. The no-double-booking rule then becomes a database constraint, not application code: a partial unique index `UNIQUE (slot_id) WHERE status IN (\'held\', \'confirmed\')`, or for arbitrary time ranges a Postgres **exclusion constraint** using `tstzrange` and `&&` (overlaps) with `btree_gist`. Constraints hold even under concurrent transactions at READ COMMITTED; the losing insert gets a unique or exclusion violation you translate to a 409. For counted inventory (20 identical tables), use a conditional update, `UPDATE inventory SET held = held + 1 WHERE id = $1 AND held + booked < capacity`, and check the affected row count; this is the optimistic approach from week 7 with the database doing the compare-and-set.',
      '**Holds with expiry** protect the user while they type card details without locking inventory forever. Creating a hold inserts a `held` booking with `hold_expires_at = now() + interval \'10 minutes\'`. Two complementary mechanisms release it: availability queries treat a hold as active only while `now() < hold_expires_at` (so correctness does not depend on a background job running on time), and a background sweeper (week 10’s worker) periodically marks expired holds as `expired` and emits events. Be careful with the constraint: index and constraint predicates must be immutable, so they cannot mention `now()`. A predicate on `status IN (\'held\', \'confirmed\')` therefore still counts an expired-but-not-yet-swept hold and blocks the slot, so the booking path should first expire stale holds for that slot inside the same transaction, or the sweeper must run often. Saying this subtlety out loud is a strong signal.',
      '**Payments** are where distributed failure bites. Never hold a database transaction open while calling the payment provider. Instead: create the hold and a `payment_intent` row in one transaction; call the provider with an **idempotency key** derived from the booking id, a timeout and limited retries with jitter (week 34); and treat the provider’s webhook as the source of truth for success. When the webhook says "succeeded", a transaction moves the booking from `held` to `confirmed` only if it is still held (a conditional update). If the hold expired meanwhile and someone else took the slot, you must refund automatically; design for this race rather than pretending it cannot happen. Model the booking as an explicit **state machine** and reject illegal transitions.',
      '**Notifications** and other side effects (confirmation email, push, venue dashboard update, calendar invite) must not be part of the booking transaction, and must not be lost. Write an event row in the same transaction as the state change (the transactional outbox, previewed here and covered in week 41), and let a queue worker deliver notifications with retries and idempotency, so a slow email provider never fails a booking. Finish the design by naming trade-offs: strong consistency on one Postgres primary for bookings vs eventually consistent cached availability; queue-based admission ("virtual waiting room") for flash sales; and how you would shard by `venue_id` later if one primary is no longer enough (week 40).',
    ],
    examples: [
      {
        language: 'sql',
        title: 'Making double booking structurally impossible (time ranges)',
        code: `CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
  id               bigserial PRIMARY KEY,
  resource_id      bigint      NOT NULL,          -- a specific table / chair / seat
  during           tstzrange   NOT NULL,
  status           text        NOT NULL CHECK (status IN ('held','confirmed','cancelled','expired')),
  hold_expires_at  timestamptz,
  user_id          bigint      NOT NULL,
  idempotency_key  text        UNIQUE,
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
    WHERE (status IN ('held','confirmed'))
);

-- Two concurrent inserts for overlapping ranges: one commits, the other fails
-- with SQLSTATE 23P01 (exclusion_violation) -> respond 409 Conflict.`,
      },
      {
        language: 'text',
        title: 'Booking state machine',
        code: `            create hold               payment webhook: succeeded
  (none) ------------------> HELD -------------------------------> CONFIRMED
                              |  \\                                    |
            hold_expires_at   |   \\ user cancels                     | user/venue cancels
            passes (sweeper)  v    v                                  v
                          EXPIRED  CANCELLED <----------------------- CANCELLED (+ refund)

  Late webhook on EXPIRED and slot taken -> automatic refund + "sorry" notification`,
      },
    ],
    keyTakeaways: [
      'Clarify inventory type (counted vs specific items) and state that booking writes need strong consistency while search can be stale.',
      'Back-of-envelope numbers usually show the write path fits one Postgres primary; reads are where caching helps.',
      'Enforce no double booking with a database constraint (partial unique index or exclusion constraint) or a conditional update, not app-level checks.',
      'Holds expire by time; correctness must not depend on the sweeper running on time.',
      'Never call payment providers inside a DB transaction; use idempotency keys, webhooks as truth, and handle the late-payment race with refunds.',
      'Notifications go through an outbox and queue, outside the booking transaction.',
    ],
    prerequisites: [
      'Transactions, isolation levels and locking strategies',
      'Background job queues with retries and idempotency',
      'Timeouts, retries and backoff',
    ],
    prerequisiteWeeks: [4, 7, 10, 23, 27, 34],
    resources: [
      {
        title: 'PostgreSQL docs: Exclusion Constraints (CREATE TABLE)',
        url: 'https://www.postgresql.org/docs/current/sql-createtable.html',
        kind: 'docs',
        note: 'Search the page for "EXCLUDE" and read that parameter description, including the WHERE predicate form.',
        minutes: 6,
      },
      {
        title: 'PostgreSQL docs: Range Types',
        url: 'https://www.postgresql.org/docs/current/rangetypes.html',
        kind: 'docs',
        note: 'Read the overview, the inclusive/exclusive bounds section, and the "Constraints on Ranges" section, which shows exactly the room-reservation exclusion constraint.',
        minutes: 8,
      },
      {
        title: 'System Design Interview, Volume 2 (Alex Xu and Sahn Lam) - the hotel reservation chapter',
        url: 'https://bytebytego.com/',
        kind: 'book',
        note: 'If you own it, read the hotel reservation system chapter for its treatment of concurrency and inventory; compare its approach with yours.',
        minutes: 15,
        verify: true,
      },
      {
        title: 'Designing Data-Intensive Applications (Martin Kleppmann) - the chapter on transactions',
        url: 'https://dataintensive.net/',
        kind: 'book',
        note: 'Re-read the discussion of write skew and phantoms, using the meeting-room booking example, if you have the book.',
        minutes: 10,
        verify: true,
      },
    ],
    exercise: {
      title: 'Whiteboard the design, then prove the core invariant in Postgres',
      scenario:
        'NearBrew wants to let partner cafés take table reservations and paid "cupping class" bookings (limited seats, paid upfront). Design the backend in a timed 45-minute mock, then spend the rest proving the hardest part works.',
      setup: [
        'Paper, a whiteboard, or excalidraw.com; a 45-minute timer.',
        'Postgres in Docker: `docker run --rm -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16`, plus `psql`.',
        'For the concurrency script: a folder with `npm init -y`, `"type": "module"` in package.json (the starter uses top-level await), and `npm i pg @types/pg tsx`.',
      ],
      steps: [
        '(5 min) Write functional and non-functional requirements. Explicitly decide: table reservations are specific resources with time ranges; cupping classes are counted inventory (12 seats).',
        '(5 min) Capacity estimates: number of cafés, slots per day, booking rate, read:write ratio, peak multiplier, storage per year. Conclude what does and does not need scaling.',
        '(10 min) Data model: tables, keys, statuses, the constraint that prevents double booking for each inventory type, and the indexes availability queries need.',
        '(10 min) API and flow: `GET /venues/:id/availability`, `POST /holds` (with Idempotency-Key), `POST /holds/:id/pay`, payment webhook, `DELETE /bookings/:id`. Draw the state machine.',
        '(10 min) Failure walk-through: payment provider times out; webhook arrives after hold expiry; user double-clicks Pay; email provider is down; a hot class goes on sale with 5,000 users.',
        '(5 min) Trade-offs and future scaling (caching availability, read replicas, sharding by venue).',
        'Now in Postgres: create the `bookings` table from the example and, in two psql sessions with `BEGIN`, insert overlapping holds for the same resource. Observe the second session block, then fail with 23P01 when the first commits.',
        'Implement counted inventory: `classes(id, capacity, taken)` and the conditional `UPDATE ... WHERE taken < capacity RETURNING taken`. Run 20 concurrent bookings against a capacity of 12 (a small Node script with `pg` and `Promise.allSettled`) and verify exactly 12 succeed.',
      ],
      starter: [
        {
          language: 'ts',
          title: 'concurrent-class-bookings.ts',
          code: `import pg from 'pg';

const pool = new pg.Pool({ connectionString: 'postgres://postgres:pw@localhost:5432/postgres', max: 20 });

async function bookSeat(classId: number, userId: number): Promise<boolean> {
  const res = await pool.query(
    'UPDATE classes SET taken = taken + 1 WHERE id = $1 AND taken < capacity RETURNING taken',
    [classId],
  );
  return res.rowCount === 1; // TODO: also insert a class_bookings row in the same transaction
}

const results = await Promise.allSettled(
  Array.from({ length: 20 }, (_, i) => bookSeat(1, i + 1)),
);
const ok = results.filter((r) => r.status === 'fulfilled' && r.value).length;
console.log('succeeded:', ok); // expect 12
await pool.end();`,
        },
      ],
      expected: [
        'A one-page design covering requirements, numbers, data model, API, state machine, failure handling and trade-offs.',
        'The overlapping insert fails with exclusion_violation (23P01) while non-overlapping ones succeed.',
        'Exactly 12 of 20 concurrent class bookings succeed, every run.',
      ],
      hints: [
        'Use half-open ranges `[start, end)` so back-to-back bookings 10:00–10:30 and 10:30–11:00 do not overlap.',
        'For the double-click case, the Idempotency-Key unique column returns the existing hold instead of creating a second.',
        'For the late webhook: the confirm statement is `UPDATE bookings SET status = \'confirmed\' WHERE id = $1 AND status = \'held\'`; zero rows updated means trigger the refund path.',
        'For the flash sale, think admission control: a queue or waiting room that admits users at a rate the write path can handle (week 38).',
      ],
      verification: [
        'Record yourself (or talk aloud) doing the 45-minute walk-through and check you covered every section without running over.',
        'Run the concurrency script five times; the count must be 12 each time.',
        'Explain, without notes, why a SELECT-then-INSERT availability check in application code fails under concurrency at READ COMMITTED.',
      ],
    },
    successChecklist: [
      'Requirements distinguish strongly consistent booking writes from eventually consistent availability reads.',
      'Capacity estimates are written down and used to justify the architecture.',
      'Double booking is prevented by a database-level constraint or conditional update, demonstrated locally.',
      'Holds expire without depending on a background job for correctness.',
      'Payment flow uses idempotency keys, webhooks and handles the late-payment race.',
      'Notifications are decoupled via outbox and queue.',
    ],
    questions: [
      {
        question: 'Why is "SELECT to check availability, then INSERT if free" in application code not enough, even inside a transaction?',
        answer:
          'At READ COMMITTED (Postgres’ default), two transactions can both run the SELECT, both see the slot as free because neither has committed, and both INSERT, producing a double booking. This is a write-skew/phantom problem: no row they both read is modified, so ordinary row locks do not help. Fixes are a constraint the database enforces at write time (unique or exclusion constraint), a conditional update on a counter row, locking a parent row with SELECT ... FOR UPDATE to serialize bookings per resource, or running at SERIALIZABLE and retrying on serialization failures. The constraint is usually the simplest and most robust.',
      },
      {
        question: 'How do you design holds so that a stuck background sweeper cannot permanently block inventory?',
        answer:
          'Make expiry a property of the data, not of the job: store `hold_expires_at` and have availability queries treat a hold as active only while `now() < hold_expires_at`. In the booking path, before inserting, expire stale holds for that resource in the same transaction (an UPDATE setting status to expired where the time has passed), so the constraint sees the slot as free. The sweeper then becomes housekeeping that emits "hold expired" events and keeps the table tidy, and if it stops for an hour, correctness is unaffected, only cleanliness.',
      },
      {
        question: 'The payment provider confirms a payment after the hold expired and another user booked the slot. What should the system do?',
        answer:
          'Treat it as an expected race, not an error. The confirm step is a conditional update that only moves a booking from held to confirmed; it updates zero rows because the booking is expired, so the system records the payment against the expired booking, issues an automatic refund through the provider using an idempotency key, and notifies the user with an apology and alternative slots. This logic must be idempotent because webhooks can be delivered more than once. To make the race rarer, the hold can be extended when the user starts payment and the provider’s checkout session can be given a shorter expiry than the hold.',
      },
    ],
    explainPrompt:
      'You are in a system design interview. Explain to the interviewer, in about five minutes, how your reservation design guarantees no double booking and what happens across the hold, payment and confirmation steps when things fail.',
    rubric: [
      'States the invariant and where it is enforced (database constraint or conditional update) with reasons.',
      'Explains the hold lifecycle and why correctness does not rely on the sweeper.',
      'Describes payment with idempotency, webhooks and the late-payment race.',
      'Decouples notifications via outbox and queue.',
      'Uses capacity numbers to justify a single primary for writes.',
      'Communicates trade-offs clearly and invites follow-up questions.',
    ],
    referenceExplanation:
      'The core invariant is that a resource can have at most one active booking for any moment in time, and I enforce it in Postgres rather than in application code, because a check-then-insert in the app races at READ COMMITTED. Each booking stores a tstzrange and a status, and an exclusion constraint forbids two overlapping ranges on the same resource while status is held or confirmed; the losing transaction gets an exclusion violation, which the API turns into a 409 with fresh availability. For counted inventory like a 12-seat class, I use a conditional UPDATE that increments taken only while it is below capacity. Our estimates put peak writes around 100 per second, so one primary is comfortable and keeps this strongly consistent; availability reads are cached briefly and can be slightly stale because the constraint is the final word. When a user picks a slot, we create a held booking with a ten-minute expiry. Queries treat expired holds as free, and the booking path expires stale holds in the same transaction, so a stuck sweeper can never block inventory. Payment happens outside any transaction: we call the provider with an idempotency key from the booking id, a timeout and jittered retries, and treat its webhook as truth. Confirmation is a conditional update from held to confirmed; if it updates nothing because the hold expired and someone else took the slot, we refund automatically and apologise. Emails, push and the venue dashboard update come from an outbox event processed by a queue worker, so a slow email provider never fails a booking.',
    stretch: {
      title: 'Flash-sale admission control',
      description:
        'Extend the design for a 500-seat event with 50,000 users arriving at 10:00. Design a waiting room: tokens issued in arrival order, admission at a fixed rate using a token bucket (week 38), and holds only for admitted users. Estimate how long the last user waits and what you show them.',
    },
    lightTask:
      'Create the `bookings` table with the exclusion constraint, prove in two psql sessions that overlapping holds cannot both commit, and write five sentences explaining the hold-to-confirm flow including the late-payment race.',
    intensiveExtras: [
      'Implement `POST /holds` and the payment webhook in a small Node or PHP service with idempotency keys, and simulate duplicate webhook deliveries.',
      'Implement the same counted-inventory booking with SELECT ... FOR UPDATE and with SERIALIZABLE plus retry, and compare throughput and code complexity against the conditional UPDATE.',
      'Do a second timed mock on a different variant: airline seat selection, where specific seats and fares interact.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['system-design', 'databases', 'backend-services', 'technical-communication'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 38
  // ---------------------------------------------------------------------------
  {
    week: 38,
    slug: 'rate-limiting-token-bucket-sliding-window',
    title: 'Rate limiting and backpressure: token bucket and sliding window',
    track: 'system-design',
    secondaryTracks: ['backend', 'cs'],
    topics: [
      'rate limiting',
      'token bucket',
      'sliding window log',
      'sliding window counter',
      'fixed window',
      '429 Too Many Requests',
      'Retry-After',
      'backpressure',
      'load shedding',
    ],
    objective:
      'By the end you can implement and test a token bucket and a sliding-window-log limiter in TypeScript, explain their trade-offs, and choose where rate limiting and backpressure belong in a real system.',
    whyItMatters:
      'Without limits, one buggy client in a retry loop, a scraper, or a marketing push can consume all of a shared service’s capacity and take it down for everyone. Rate limiting protects fairness and cost per client; backpressure and load shedding protect the service itself when total demand exceeds capacity. Both are standard parts of public APIs and of the internal services behind consumer apps.',
    explanation: [
      'Separate two goals that are often blurred. **Rate limiting** is a policy per client or key: "each NearBrew user may post 10 reviews per hour", "each API key may make 100 requests per second". It is about fairness, abuse and cost. **Backpressure** and **load shedding** are about the server’s own capacity regardless of who is asking: when queues grow or latency climbs, reject or delay work early and cheaply rather than accepting it and failing slowly. A service usually needs both: limits per key at the edge, and a concurrency or queue-depth limit inside.',
      'The **fixed window** counter is the simplest: count requests per key in the current minute and reject above N. It is cheap, but it allows bursts of up to 2N around window boundaries (N at 12:00:59 and N again at 12:01:00). The **sliding window log** fixes this exactly: store the timestamp of each accepted request, drop timestamps older than the window, and accept only if fewer than N remain. It is precise, but memory is O(N) per key, which matters at high limits. The **sliding window counter** approximates the log by weighting the previous fixed window’s count by how much of it still overlaps the sliding window; it is O(1) memory and accurate enough for most APIs.',
      'The **token bucket** models capacity differently: a bucket holds up to `capacity` tokens and refills at `rate` tokens per second; each request takes a token (or several, for expensive operations) and is rejected if the bucket is empty. It permits short bursts up to `capacity` while enforcing a long-run average of `rate`, which matches how real clients behave (a phone app opening and firing six requests at once, then idling). You do not need a timer to refill: store `tokens` and `lastRefill`, and on each request add `(now - lastRefill) * rate`, capped at capacity. That lazy refill makes the algorithm O(1) in time and memory. The related **leaky bucket** smooths output to a constant rate by queueing, which is more of a traffic-shaping tool.',
      'In a distributed deployment, limits must be shared across instances or they multiply by the instance count. The common approach is keeping limiter state in Redis and updating it atomically (a Lua script or a single atomic command sequence), so read-modify-write races cannot let extra requests through. Trade-offs: an extra network hop on every request, and a decision about **failing open** (allow traffic if Redis is down, prioritising availability) or **failing closed** (reject, prioritising protection). Local in-memory limiters per instance with limits divided by instance count are a cheaper, approximate alternative. Choose the key carefully: user id for signed-in actions, API key for partners, IP only as a fallback, since many users can share one IP behind carrier NAT.',
      'Good limiters communicate. Respond with **429 Too Many Requests** and a `Retry-After` header so well-behaved clients (like the `fetchWithRetry` you wrote in week 34) back off for the right time instead of guessing; many APIs also expose remaining quota headers. On the client side, rate limiting has a mirror image: debounce search-as-you-type in the NearBrew nearby search, cap concurrent image downloads, and treat 429 as retryable only after the indicated delay. Inside the server, backpressure looks like bounded queues, connection pool limits, and a concurrency limiter that returns 503 immediately when in-flight work exceeds a threshold, which is far better than letting latency grow until everything times out.',
    ],
    examples: [
      {
        language: 'ts',
        title: 'Token bucket with lazy refill and an injectable clock',
        code: `export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  tryRemove(cost = 1): boolean {
    const t = this.now();
    const elapsedSec = (t - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSec);
    this.last = t;
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  /** ms until 'cost' tokens are available: use for Retry-After */
  msUntil(cost = 1): number {
    const missing = Math.max(0, cost - this.tokens);
    return Math.ceil((missing / this.refillPerSec) * 1000);
  }
}`,
      },
    ],
    keyTakeaways: [
      'Rate limiting enforces per-key fairness; backpressure and load shedding protect total capacity.',
      'Fixed windows allow 2N bursts at boundaries; sliding window log is exact but O(N) memory; sliding window counter is a cheap approximation.',
      'Token buckets allow bursts up to capacity with a long-run average rate, using lazy O(1) refill.',
      'Distributed limits need shared atomic state (e.g. Redis) and a deliberate fail-open or fail-closed choice.',
      'Return 429 with Retry-After so clients back off correctly.',
    ],
    prerequisites: [
      'Comfortable writing TypeScript classes and unit tests',
      'Understands retries and backoff from week 34',
    ],
    prerequisiteWeeks: [14, 17, 19, 34],
    resources: [
      {
        title: 'MDN: 429 Too Many Requests',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429',
        kind: 'docs',
        note: 'Short page: semantics of 429 and the Retry-After example.',
        minutes: 3,
      },
      {
        title: 'MDN: Retry-After header',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After',
        kind: 'docs',
        note: 'Note the two formats (seconds or HTTP date) your client must handle.',
        minutes: 3,
      },
      {
        title: 'Cloudflare blog: How we built rate limiting capable of scaling to millions of domains',
        url: 'https://blog.cloudflare.com/counting-things-a-lot-of-different-things/',
        kind: 'article',
        note: 'Read the explanation of the sliding window counter approximation and its measured error rate.',
        minutes: 12,
        verify: true,
      },
      {
        title: 'Site Reliability Engineering book: Handling Overload',
        url: 'https://sre.google/sre-book/handling-overload/',
        kind: 'book',
        note: 'Read the sections on per-customer limits and client-side throttling; it complements the per-key algorithms with a capacity view.',
        minutes: 12,
        verify: true,
      },
    ],
    exercise: {
      title: 'Implement and test two limiters, then put one in front of an API',
      scenario:
        'NearBrew’s review endpoint is being hammered by a buggy Android build that retries `POST /reviews` in a tight loop. You will implement a token bucket and a sliding-window-log limiter with deterministic tests, then add per-user limiting with 429 + Retry-After to a small Node HTTP server.',
      setup: [
        'Folder `rate-limit-lab`, `npm init -y`, `npm i -D vitest typescript tsx @types/node`.',
        'Add `"test": "vitest"` to package.json scripts.',
      ],
      steps: [
        'Implement `TokenBucket` (from the example or your own) with an injectable clock.',
        'Implement `SlidingWindowLog` from the starter: `tryAcquire()` drops timestamps older than `windowMs` and accepts if fewer than `limit` remain. Also implement `retryAfterMs()` based on the oldest timestamp in the window.',
        'Write tests with a fake clock (a mutable `let t = 0; const now = () => t;`). Token bucket: a burst of `capacity` succeeds and the next fails; after advancing time by 1/rate seconds exactly one more succeeds; tokens never exceed capacity after a long idle.',
        'Sliding window log tests: `limit` requests at t=0 succeed, the next fails; at t=windowMs-1 still fails; at t=windowMs succeeds. Then write the boundary test that shows a naive fixed-window limiter would allow 2x the limit across a boundary while your log does not.',
        'Build a `KeyedLimiter` that holds one limiter per key in a Map and evicts idle keys (e.g. buckets that are full and unused for longer than the time to refill), so memory does not grow forever.',
        'Wire it into a `node:http` server: key by an `x-user-id` header, allow 5 reviews per minute with bursts of 3 (token bucket: capacity 3, refill 5/60 per second), return 429 with `Retry-After` in whole seconds.',
        'Hit it with a loop of curls and then with your week 34 `fetchWithRetry`; confirm the client waits for Retry-After rather than spinning.',
      ],
      starter: [
        {
          language: 'ts',
          title: 'sliding-window-log.ts',
          code: `export class SlidingWindowLog {
  private stamps: number[] = []; // ascending timestamps of accepted requests

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryAcquire(): boolean {
    const t = this.now();
    // TODO: drop stamps where stamp <= t - windowMs (consider a head index instead of shift())
    // TODO: if stamps.length < limit, push t and return true
    return false;
  }

  /** ms until the next request would be accepted (0 if now) */
  retryAfterMs(): number {
    // TODO: oldest stamp + windowMs - now
    return 0;
  }
}`,
        },
        {
          language: 'ts',
          title: 'token-bucket.test.ts (start here)',
          code: `import { describe, it, expect } from 'vitest';
import { TokenBucket } from './token-bucket';

describe('TokenBucket', () => {
  it('allows a burst up to capacity, then rejects', () => {
    let t = 0;
    const b = new TokenBucket(3, 1, () => t);
    expect([b.tryRemove(), b.tryRemove(), b.tryRemove()]).toEqual([true, true, true]);
    expect(b.tryRemove()).toBe(false);
  });

  it('refills lazily at the configured rate', () => {
    let t = 0;
    const b = new TokenBucket(3, 1, () => t);
    for (let i = 0; i < 3; i++) b.tryRemove();
    t += 1000;
    expect(b.tryRemove()).toBe(true);
    expect(b.tryRemove()).toBe(false);
  });

  // TODO: never exceeds capacity after a long idle
  // TODO: msUntil() matches the time to the next successful tryRemove()
});`,
        },
      ],
      expected: [
        'All limiter tests pass deterministically with no real sleeps.',
        'The boundary test demonstrates the fixed-window 2x burst problem and that the sliding log prevents it.',
        'The server allows 3 rapid reviews, then returns 429 with a sensible Retry-After, then allows roughly one every 12 seconds.',
        'Different `x-user-id` values are limited independently.',
      ],
      hints: [
        'Floating-point refill can leave 0.9999 tokens; compare with a small epsilon or keep tokens in integer milli-tokens.',
        'Removing from the front of an array with shift() is O(n); a head index or ring buffer keeps the log efficient.',
        'Round Retry-After up (`Math.ceil(ms / 1000)`) so clients never retry slightly too early.',
        'Make sure the clock is monotonic for real use: `performance.now()` does not jump when the system clock is adjusted.',
      ],
      verification: [
        'Run `npx vitest run` and see all tests green, then break the refill cap and confirm a test fails.',
        'Use a curl loop to send 10 requests and confirm exactly 3 succeed and the rest are 429 with Retry-After.',
        'Leave the server idle, check the KeyedLimiter map size drops back after eviction.',
      ],
    },
    successChecklist: [
      'Token bucket with lazy refill, capacity cap and an injectable clock.',
      'Sliding window log with correct boundary behaviour and retryAfterMs.',
      'Deterministic unit tests for both, including a fixed-window comparison.',
      'Per-key limiter with eviction to bound memory.',
      'HTTP server returning 429 with Retry-After, verified with a client that respects it.',
    ],
    questions: [
      {
        question: 'When would you choose a token bucket over a sliding window log, and vice versa?',
        answer:
          'Choose a token bucket when you want to allow natural bursts while enforcing an average rate, and you need O(1) memory per key at high limits, which suits most API and per-user request limits. Choose a sliding window log when the limit must be exact over a rolling window and the limit is small, for example "5 password reset emails per hour" or "10 reviews per day", where storing a handful of timestamps is cheap and a burst policy would be confusing. For large limits needing near-exactness, the sliding window counter approximation is the usual compromise.',
      },
      {
        question: 'You run 8 instances of an API, each with an in-memory limiter of 100 req/s per key. What is the effective limit and how would you fix it?',
        answer:
          'Requests for a key may land on any instance, so the effective limit is up to 800 req/s, and it varies with load-balancer behaviour and instance count changes. Fixes: keep limiter state in a shared store like Redis and update it atomically (Lua script) so all instances see the same bucket; or divide the local limit by the instance count and accept approximation; or route each key consistently to one instance, which couples limiting to routing. With shared state you must also decide whether to fail open or closed if the store is unavailable.',
      },
      {
        question: 'How is load shedding different from per-client rate limiting, and why might a system need both?',
        answer:
          'Per-client rate limiting enforces a policy for each key, but if many well-behaved clients all arrive at once, total demand can still exceed capacity, and per-key limits will not notice. Load shedding looks at the server’s own state, such as in-flight requests, queue depth or latency, and rejects work early (often 503) when the service is saturated, preferably dropping lower-priority traffic first. Rate limits keep one client from starving others; load shedding keeps the service from collapsing for everyone. Together they keep latency bounded under both abuse and genuine spikes.',
      },
    ],
    explainPrompt:
      'Explain to a product manager why the buggy Android build took down reviews for everyone, and how the rate limiter and 429 responses you added prevent that, including why some legitimate users might briefly see "slow down" messages.',
    rubric: [
      'Explains shared capacity and how one client can starve others, in non-technical terms.',
      'Describes the chosen algorithm intuitively (e.g. bucket of tokens refilling over time).',
      'Explains why limits are per user and how bursts are accommodated.',
      'Mentions 429 and Retry-After as the way clients learn to back off.',
      'Is honest about the trade-off: some legitimate heavy use will be throttled.',
    ],
    referenceExplanation:
      'All NearBrew users share the same review service, which can handle a certain number of requests per second. A bug in one Android build made the app resend a review over and over without waiting, so a few thousand phones were each sending dozens of requests a second. That used up the service’s capacity, and everyone else’s reviews started timing out, even though they were behaving normally. The fix gives every user their own small allowance, like a bucket of tokens. Each review attempt uses a token, the bucket holds three so you can post a few in quick succession, and it refills at about one token every twelve seconds. A normal person never notices. A phone stuck in a loop empties its bucket instantly, and after that its extra requests are turned away cheaply before they reach the database, so they cannot crowd out anyone else. When we turn a request away we reply with a standard "too many requests" response that says how long to wait, and the fixed app versions read it and wait instead of hammering. The trade-off is that a genuinely enthusiastic user posting lots of reviews in a minute will briefly see a "slow down" message. We chose limits well above what our data shows real users do, and we can raise them per account for trusted reviewers.',
    stretch: {
      title: 'Distributed token bucket in Redis',
      description:
        'Run Redis locally in Docker and implement the token bucket as a Lua script (`EVAL`) that reads tokens and timestamp, refills, decrements and writes back atomically, with a TTL so idle keys expire. Run two Node instances behind a simple round-robin proxy and prove the limit holds globally. Decide and document your fail-open/closed behaviour.',
    },
    lightTask:
      'Implement only the token bucket with an injectable clock and write the three core tests (burst, refill, cap after idle); all must pass with `npx vitest run`.',
    intensiveExtras: [
      'Implement the sliding window counter approximation and measure its error against the exact log on a random traffic trace.',
      'Add a server-side concurrency limiter (max 20 in-flight requests, else 503) and load test with `npx autocannon` to compare latency with and without it.',
      'Add client-side throttling to a NearBrew search input: debounce plus a max of 2 in-flight requests, cancelling stale ones with AbortController.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['system-design', 'production-reliability', 'backend-services', 'cs-fundamentals'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 39
  // ---------------------------------------------------------------------------
  {
    week: 39,
    slug: 'blameless-postmortem-checkpoint',
    title: 'Quarter checkpoint: writing a blameless postmortem',
    track: 'senior',
    secondaryTracks: ['system-design'],
    topics: [
      'postmortems',
      'blameless culture',
      'incident timeline',
      'impact',
      'contributing factors',
      'action items',
      'detection and mitigation',
    ],
    objective:
      'By the end you can write a complete blameless postmortem for a realistic incident, with a precise timeline, quantified impact, contributing factors rather than a single root cause, and owned, verifiable action items.',
    whyItMatters:
      'Incidents are the most expensive lessons a team pays for; a postmortem is how you collect on them. Good ones change systems so the same class of failure becomes impossible or cheap; bad ones assign blame, produce vague actions like "be more careful", and teach people to hide mistakes. Writing clear postmortems is a highly visible senior skill and a rich source of behavioural interview stories.',
    explanation: [
      'A **blameless** postmortem assumes that people made reasonable decisions given the information, tools and pressure they had at the time, and asks why the system made the bad outcome easy. This is not about being nice; it is about getting accurate information. If engineers expect blame, they omit the embarrassing details that explain what happened, and the organisation learns nothing. The Google SRE book chapter "Postmortem Culture: Learning from Failure" describes this and when to write one: user-visible downtime or degradation beyond a threshold, data loss, on-call intervention such as a rollback, or a resolution time above a threshold. Blameless does not mean accountability-free: owners are accountable for the action items.',
      'The **timeline** is the backbone. Record timestamps (with timezone) for: when the triggering change happened, when the problem began affecting users, when it was detected and how (alert, customer report, a colleague noticing), key investigation steps including dead ends, mitigation, and full resolution. From the timeline you derive the numbers that matter: time to detect, time to mitigate, time to resolve. A timeline that shows "users affected 14:02, alert fired 14:31" points directly at a monitoring gap, which is often a more valuable fix than the code bug itself.',
      '**Impact** must be quantified in user and business terms, not just technical ones: "p95 latency of the nearby search endpoint rose from 180 ms to 4.2 s for 47 minutes; roughly 18% of searches in that window timed out on the client; about 3,100 users saw an error state; no data was lost." Use the SLIs and SLOs from week 23 and state how much error budget was consumed. Vague impact statements make it impossible to prioritise follow-ups.',
      'Avoid stopping at a single **root cause**. Complex failures usually require several things to line up: a query that lost its index after a migration, a code review that did not include the query plan, a staging dataset too small to show the slowdown, an alert on average latency instead of p95, and a runbook that did not mention checking slow-query logs. List these as **contributing factors** and, for each, ask what would have prevented, detected or limited it. "Five whys" can help, but follow multiple branches rather than a single chain, and stop when you reach something the team can actually change.',
      '**Action items** are where postmortems succeed or fail. Each should be specific, owned by a named person, have a priority and a due date, and be verifiable: "Add a CI check that runs EXPLAIN on the top 20 queries against a production-sized fixture and fails on sequential scans over 100k rows" rather than "improve query performance". Balance them across prevent, detect and mitigate. Then actually track them; an unfinished action list is the most common way postmortems fail. Finally, share the document widely and invite comments: a postmortem read by other teams prevents their version of the same incident.',
      'This week is a checkpoint, so you will turn the simulated production slowdown you investigated in week 9 into a full postmortem. That exercise already gave you the raw materials: a symptom, the evidence you gathered (metrics, logs, EXPLAIN plans), the fix, and the moments you went down the wrong path. Writing it up in this format consolidates the quarter: observability (week 23), timeouts and retries that may have amplified the problem (week 34), and testing gaps that let it ship (week 35) all show up as contributing factors.',
    ],
    examples: [
      {
        language: 'text',
        title: 'Postmortem template',
        code: `Title: <service> <symptom> on <date>
Status: Draft | In review | Final        Authors:        Reviewers:
Summary (3 sentences): what happened, impact, how it was resolved
Impact: users affected, duration, SLO / error budget consumed, revenue/support cost, data loss
Trigger: the change or event that started it
Detection: how and when we found out; time to detect
Timeline (UTC): timestamp | event | source of evidence
Contributing factors: each with "how it contributed"
What went well / What went poorly / Where we got lucky
Action items: action | type (prevent/detect/mitigate) | owner | priority | due | ticket
Lessons learned: 2-4 sentences other teams can use`,
      },
      {
        language: 'text',
        title: 'Blameful vs blameless phrasing',
        code: `Blameful:  "Sam deployed a migration that dropped the index without checking."
Blameless: "The migration recreated the reviews table without the (cafe_id, created_at)
            index. Our migration review checklist does not include comparing indexes
            before and after, and the staging dataset (2k rows) is too small for the
            missing index to change query latency noticeably."`,
      },
    ],
    keyTakeaways: [
      'Blameless means focusing on how the system made the failure easy, which produces accurate information.',
      'A timestamped timeline yields time to detect, mitigate and resolve, and exposes monitoring gaps.',
      'Quantify impact in user terms and against SLOs.',
      'List multiple contributing factors instead of a single root cause.',
      'Action items must be specific, owned, dated, verifiable and balanced across prevent, detect and mitigate.',
    ],
    prerequisites: [
      'Completed the week 9 incident investigation (or have notes from a real incident)',
      'Familiar with SLIs/SLOs and alerting basics',
    ],
    prerequisiteWeeks: [9, 12, 23, 33, 34, 35],
    resources: [
      {
        title: 'Site Reliability Engineering book: Postmortem Culture: Learning from Failure',
        url: 'https://sre.google/sre-book/postmortem-culture/',
        kind: 'book',
        note: 'Read the whole chapter: when to write a postmortem, what blameless means, and the practices for reviewing and sharing them.',
        minutes: 15,
      },
      {
        title: 'Site Reliability Engineering book: Example Postmortem (appendix)',
        url: 'https://sre.google/sre-book/example-postmortem/',
        kind: 'book',
        note: 'Study the structure: summary, impact, root causes, trigger, detection, action items table, lessons, timeline. Use it as a model for yours.',
        minutes: 10,
        verify: true,
      },
      {
        title: 'Site Reliability Engineering book: Managing Incidents',
        url: 'https://sre.google/sre-book/managing-incidents/',
        kind: 'book',
        note: 'Skim the roles (incident commander, ops, communications) so your timeline can describe who did what.',
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'Write the postmortem for your week 9 slowdown',
      scenario:
        'In week 9 you investigated a simulated production slowdown. Treat it as a real NearBrew incident: the café search or reviews API slowed down badly after a change, users saw spinners and errors, and you diagnosed and fixed it. Now write the postmortem your team and other teams would read. If you no longer have your week 9 notes, use this stand-in: a migration recreated the `reviews` table without its `(cafe_id, created_at)` index, the café detail endpoint’s p95 rose from 150 ms to 3.8 s, the mobile client’s retries tripled traffic, and the alert fired 25 minutes after users were affected.',
      setup: [
        'Your week 9 notes, terminal history, EXPLAIN output and any graphs or screenshots.',
        'A plain document (any editor) using the template from the examples.',
      ],
      steps: [
        'Reconstruct a timeline with at least 10 timestamped entries, each with its evidence source (graph, log line, commit, chat message). Include at least one dead end you explored.',
        'Compute time to detect, time to mitigate and time to resolve from the timeline.',
        'Write the impact section with numbers: affected endpoint(s), latency/error rates, duration, estimated users affected, SLO budget consumed. Where you must estimate, say how.',
        'List at least four contributing factors across code, process, testing, monitoring and client behaviour (for example, retries without jitter or budget, from week 34).',
        'Write 5–8 action items in a table with type (prevent/detect/mitigate), owner (use roles if solo), priority and a verifiable definition of done.',
        'Write "what went well", "what went poorly" and "where we got lucky".',
        'Do a blameless pass: search your draft for names attached to mistakes, "should have", "careless", "forgot", and rewrite each in terms of the system and its affordances.',
        'Write the three-sentence summary last, then read the whole thing as if you were a different team: is it clear what happened and what changes?',
      ],
      expected: [
        'A 2–4 page postmortem that someone outside the team could understand without asking you questions.',
        'Quantified impact and detection/mitigation/resolution times derived from the timeline.',
        'Multiple contributing factors and no language that assigns personal blame.',
        'Action items that a reviewer could verify as done or not done.',
      ],
      hints: [
        'Use UTC throughout the timeline and say so.',
        'If an action item contains "improve", "better" or "be careful", rewrite it until you could write a test or checklist for it.',
        'At least one action should target detection: a p95 alert on the endpoint, or a slow-query log alert.',
        'The "where we got lucky" section often reveals the next incident.',
      ],
      verification: [
        'Score the draft against the rubric below and fix the weakest criterion.',
        'Check every action item has owner, priority, due date and type.',
        'Ask: if every action item were done, would this incident have been prevented, detected sooner or shorter? Write which items address which.',
      ],
    },
    successChecklist: [
      'Timeline with 10+ timestamped, sourced entries including a dead end.',
      'Time to detect, mitigate and resolve stated.',
      'Impact quantified in user terms and against an SLO.',
      'At least four contributing factors, no single "root cause" blame.',
      'Owned, dated, verifiable action items across prevent, detect and mitigate.',
      'A blameless language pass completed.',
    ],
    questions: [
      {
        question: 'What does "blameless" mean in practice, and why does it lead to better engineering outcomes?',
        answer:
          'In practice it means describing actions and decisions in terms of the information, tools, incentives and time pressure people had, and asking how the system allowed or encouraged the failure, rather than naming who made a mistake. It leads to better outcomes because people share full, honest details, including their own errors and confusion, which are exactly what explain the incident. It also shifts fixes toward guardrails, automation and better signals, which protect everyone, rather than "be more careful", which protects no one. Accountability remains, but it is attached to completing the follow-up actions.',
      },
      {
        question: 'Why is a single "root cause" often misleading, and what do you write instead?',
        answer:
          'Most production incidents require several conditions at once: a triggering change, missing safeguards in review or testing, a monitoring gap that delayed detection, and sometimes a behaviour such as aggressive retries that amplified impact. Naming only the trigger suggests fixing that one bug is enough, leaving the other conditions in place for the next trigger. Instead, list contributing factors with how each contributed, and for each consider prevent, detect and mitigate actions. The trigger is still recorded, but as one factor among several.',
      },
      {
        question: 'What makes an action item good, and why do postmortem action items so often fail?',
        answer:
          'A good action item is specific enough that two people would agree whether it is done, has a named owner, a priority and due date, a link to a tracked ticket, and a clear connection to a contributing factor. They often fail because they are vague ("improve monitoring"), too large to ever finish ("rewrite the search service"), unowned, or never prioritised against feature work once the urgency fades. Teams that succeed review open postmortem actions regularly and prefer several small, high-leverage actions over one big one.',
      },
    ],
    explainPrompt:
      'Present your postmortem to a cross-team incident review meeting in about five minutes: what happened, the impact, the contributing factors, and the three action items you think matter most and why.',
    rubric: [
      'Opens with a crisp summary and quantified impact.',
      'Walks through the timeline highlighting detection and mitigation gaps.',
      'Presents multiple contributing factors in blameless language.',
      'Prioritises action items with reasons tied to contributing factors.',
      'Shares a lesson other teams can apply.',
      'Stays within time and invites questions.',
    ],
    referenceExplanation:
      'On the afternoon of the incident, the NearBrew café detail page became very slow for 47 minutes. p95 latency on the reviews endpoint went from about 150 ms to 3.8 s, roughly one in five café page loads showed an error on mobile, and we estimate around 3,000 users were affected. That used about 40% of the month’s latency error budget. No data was lost. The trigger was a migration that rebuilt the reviews table but did not recreate the index on cafe_id and created_at, so every café page did a sequential scan. Several factors let that trigger become an incident. Our migration checklist does not compare indexes before and after. Staging has two thousand reviews, so the slow query looked fine there. Our alert watched average latency, which stayed within its threshold for 25 minutes while p95 climbed. And the mobile client retries immediately without jitter, which tripled traffic to an already struggling database. Once we saw the plan with EXPLAIN, recreating the index concurrently fixed it in minutes. Three actions matter most. First, a CI step that runs EXPLAIN on our top queries against a production-sized fixture, which prevents the whole class. Second, p95 alerts on user-facing endpoints, which would have cut detection from 25 minutes to about 3. Third, backoff with full jitter and a retry budget in the mobile client, which limits how much any future slowdown amplifies. The lesson for other teams: if your staging data is small, your performance testing is not telling you much.',
    stretch: {
      title: 'Run a postmortem review',
      description:
        'Share your postmortem with a colleague or peer (or a friend in engineering) and run a 20-minute review: they question the timeline and push on whether action items are sufficient. Record their questions and revise. Then turn the incident into a STAR story (week 26) of under two minutes for behavioural interviews.',
    },
    lightTask:
      'Write only the summary, the quantified impact, a 6-entry timeline and three owned, verifiable action items for your week 9 incident (or the stand-in), then do one blameless language pass.',
    intensiveExtras: [
      'Write a second, shorter postmortem for a real incident or bug you experienced at work or on NearBrew, removing confidential details.',
      'Write the runbook entry that would have shortened this incident: symptoms, the dashboards to check, the queries to run, and the mitigation steps.',
      'Do a quarter retrospective: list which skills from weeks 27–38 showed up in your postmortem, and pick one weak area to revisit in Q4.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['production-reliability', 'technical-communication', 'feature-ownership'],
    depth: 'standard',
  },
];
