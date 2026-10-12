import type { Lesson } from '../types';

const week27: Lesson = {
  week: 27,
  slug: 'replication-consistency-models',
  title: 'Replication and consistency models',
  track: 'system-design',
  secondaryTracks: ['backend'],
  topics: [
    'replication',
    'read replicas',
    'replication lag',
    'read-your-writes',
    'monotonic reads',
    'eventual consistency',
    'streaming replication',
  ],
  objective:
    'By the end you can explain how leader/follower replication works, predict the user-visible bugs replication lag causes, and implement read-your-writes and monotonic-read guarantees in application code.',
  whyItMatters:
    'Almost every production system that outgrows one database adds read replicas, and the first bug report is always some version of "I saved it and it disappeared". Engineers who understand lag and consistency guarantees route reads deliberately instead of sprinkling `sleep()` calls and retries, and can tell product which screens can tolerate stale data.',
  explanation: [
    'In **leader/follower** (primary/replica) replication, every write goes to one node, the primary. The primary records each change in a log (in PostgreSQL, the write-ahead log, or WAL) and replicas continuously fetch and replay that log. With PostgreSQL **streaming replication**, a replica connects to the primary, receives WAL records as they are produced, and applies them in order. A replica running as a **hot standby** accepts read-only queries while it replays. The key mental model: a replica is the primary as it was some moments ago. It is never wrong in a made-up way; it is just behind.',
    'That gap is **replication lag**. Under normal load it might be milliseconds; under a bulk import, a long-running query on the replica that conflicts with replay, a network blip, or a replica that is simply under-provisioned, it can be seconds or minutes. Replication is usually **asynchronous** by default: the primary acknowledges the commit to the client before any replica has the change. **Synchronous** replication (in PostgreSQL, `synchronous_commit` together with `synchronous_standby_names`) makes the primary wait for a standby to confirm, which trades write latency and availability (if the sync standby is down, commits block) for durability. Note that even synchronous modes differ: waiting for the standby to have *flushed* WAL is not the same as waiting for it to have *applied* it (`remote_apply`), and only the latter guarantees a read on that standby sees the write.',
    'Lag turns into specific anomalies that have names, which is useful because each name has a known fix. **Read-your-writes** (read-after-write) is violated when a user saves a review on NearBrew, the app redirects to the café page, and that page reads from a replica that has not applied the insert yet, so the review is missing. **Monotonic reads** is violated when two successive reads hit different replicas with different lag, so a check-in count goes 41, then 40, then 41: time appears to go backwards. **Consistent prefix** is violated when causally related writes are observed out of order, for example a reply visible before the question it answers; this mostly bites in partitioned or multi-leader systems. **Eventual consistency** only promises that if writes stop, replicas converge. It says nothing about how long, which is why it is a weak guarantee to build UX on.',
    'Applications usually get the guarantees they need with routing rules rather than heavier databases. For read-your-writes: read the user\'s own recently modified data from the primary (for example, for N seconds after that user writes, or always for "my profile" style pages); or record the primary\'s log position after the write (in PostgreSQL, `pg_current_wal_lsn()`) and only serve that user from a replica whose replay position (`pg_last_wal_replay_lsn()`) has reached it. For monotonic reads: pin a user or session to one replica (hash the user id), so they may see old data but never older data than before. For critical invariants, such as "this seat is still available" in a booking flow, read from the primary inside the same transaction that writes, because a replica can never be trusted for a check-then-act decision.',
    'Replication also matters for failure, not just scale. If the primary dies and an asynchronous replica is promoted, any commits it had not yet received are **lost**, even though clients were told they succeeded. That is why the choice between async and sync replication is really a business question: how much acknowledged data can we lose on failover (RPO), and how much write latency will we pay to avoid it? A senior engineer frames it that way to product and ops instead of saying "we use replicas".',
    'The general lesson extends beyond Postgres: caches (week 4), search indexes fed by change streams, and CDN edges are all replicas with lag. The same three questions apply to each: who is allowed to read stale data, how stale is acceptable, and what does the user see when the copy is behind?',
  ],
  examples: [
    {
      language: 'ts',
      title: 'Read-your-writes routing with an LSN token (PostgreSQL)',
      code: `// After a write on the primary, capture its WAL position.
const { rows } = await primary.query('SELECT pg_current_wal_lsn() AS lsn');
session.minLsn = rows[0].lsn; // e.g. '0/3000148', store per user/session

// On a later read, only use a replica that has replayed past that position.
async function pickReader(session: { minLsn?: string }) {
  if (!session.minLsn) return replica;
  const r = await replica.query(
    "SELECT pg_wal_lsn_diff(pg_last_wal_replay_lsn(), $1) >= 0 AS caught_up",
    [session.minLsn],
  );
  return r.rows[0].caught_up ? replica : primary; // fall back to primary
}`,
    },
    {
      language: 'sql',
      title: 'Observing lag (run on primary, then on replica)',
      code: `-- On the primary: one row per connected standby
SELECT client_addr, state, sent_lsn, replay_lsn, replay_lag
FROM pg_stat_replication;

-- On a replica: am I a standby, and how far behind in wall time?
SELECT pg_is_in_recovery(),
       now() - pg_last_xact_replay_timestamp() AS approx_lag;`,
    },
  ],
  keyTakeaways: [
    'A replica is the primary as of some time ago; lag is normal, unbounded under stress, and must be designed for.',
    'Name the anomaly (read-your-writes, monotonic reads, consistent prefix) and you get the fix.',
    'Read-your-writes: route the writer to the primary for a window, or gate replica reads on a log position.',
    'Monotonic reads: pin a session to one replica.',
    'Check-then-act decisions (availability, balances) always read from the primary inside the write transaction.',
    'Async replication can lose acknowledged writes on failover; sync replication costs latency and availability.',
  ],
  prerequisites: [
    'Comfortable with SQL transactions and isolation basics',
    'Understand caching and stale data trade-offs',
  ],
  prerequisiteWeeks: [4, 7, 19],
  resources: [
    {
      title: 'PostgreSQL docs: Log-Shipping Standby Servers (streaming replication)',
      url: 'https://www.postgresql.org/docs/current/warm-standby.html',
      kind: 'docs',
      note: 'Read the overview and the "Streaming Replication" and "Synchronous Replication" subsections to see what the primary waits for and when.',
      minutes: 12,
    },
    {
      title: 'PostgreSQL docs: Hot Standby',
      url: 'https://www.postgresql.org/docs/current/hot-standby.html',
      kind: 'docs',
      note: 'Skim the user overview and "Handling Query Conflicts" to understand why long replica queries and replay fight each other.',
      minutes: 8,
    },
    {
      title: 'Designing Data-Intensive Applications (Martin Kleppmann)',
      url: 'https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/',
      kind: 'book',
      note: 'Read the chapter on replication, specifically the section on problems with replication lag (read-your-writes, monotonic reads, consistent prefix reads). Best single treatment of this topic.',
      minutes: 25,
      verify: true,
    },
    {
      title: 'Jepsen: Consistency Models',
      url: 'https://jepsen.io/consistency',
      kind: 'article',
      note: 'Look at the map of consistency models and click into "read your writes" and "monotonic reads" for precise definitions.',
      minutes: 10,
      verify: true,
    },
  ],
  exercise: {
    title: 'Reproduce and fix "my review disappeared" with a simulated lagging replica',
    scenario:
      'NearBrew is adding a read replica to offload the café detail page. QA reports that after posting a review and being redirected, the review is sometimes missing, and the review count occasionally goes down on refresh. You will reproduce both bugs deterministically in-process, then fix them with routing rules.',
    setup: [
      'Node 18+ only. Create a folder `replication-lab`, run `npm init -y`, and save the starter as `lab.mjs`.',
      'Optional (after the in-process version works): run a single Postgres with `docker run --rm -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16` and run the observation queries from the examples against it (`pg_is_in_recovery()` returns false on a primary). Setting up a real streaming replica is a stretch goal, not required.',
    ],
    steps: [
      'Read the starter. `Primary` applies writes immediately and appends each to a log with an increasing `lsn`. Each `Replica` replays log entries only once they are older than its `lagMs`.',
      'Run `node lab.mjs`. Scenario A writes a review then immediately reads via `naiveRouter`, which always uses a random replica. Note how often the review is missing.',
      'Scenario B reads the review count three times in a row through `naiveRouter`. Find a run where the count goes backwards and explain why (two replicas, different lag).',
      'Implement `rywRouter(session)`: after a write, store `session.minLsn = primary.lsn`. On read, use a replica only if `replica.appliedLsn >= session.minLsn`; otherwise read from the primary. Re-run scenario A; it must never miss.',
      'Implement `stickyRouter(session)`: choose the replica by hashing `session.userId` so a user always hits the same replica. Combine it with `rywRouter`. Re-run scenario B; counts must never decrease for that user.',
      'Add a scenario C: a booking check "is table 4 free at 19:00?" read from a replica, then insert. Show two concurrent bookings both succeeding. Fix it by making the check and the write go to the primary (in real SQL you would also need a constraint or lock, see week 7).',
      'Write three sentences in a `NOTES.md`: for NearBrew\'s café page, review form, favourites list and check-in counter, which may read from a replica and why.',
    ],
    starter: [
      {
        language: 'js',
        title: 'lab.mjs',
        code: `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Primary {
  constructor() { this.lsn = 0; this.log = []; this.reviews = []; }
  write(review) {
    this.lsn += 1;
    this.reviews.push(review);
    this.log.push({ lsn: this.lsn, at: Date.now(), review });
    return this.lsn;
  }
  read() { return [...this.reviews]; }
}

class Replica {
  constructor(name, primary, lagMs) {
    Object.assign(this, { name, primary, lagMs, appliedLsn: 0, reviews: [] });
  }
  replay() {
    const cutoff = Date.now() - this.lagMs;
    for (const e of this.primary.log) {
      if (e.lsn > this.appliedLsn && e.at <= cutoff) {
        this.reviews.push(e.review);
        this.appliedLsn = e.lsn;
      }
    }
  }
  read() { this.replay(); return [...this.reviews]; }
}

const primary = new Primary();
const replicas = [new Replica('r1', primary, 30), new Replica('r2', primary, 250)];

function naiveRouter() {
  return replicas[Math.floor(Math.random() * replicas.length)];
}

// TODO: function rywRouter(session) { ... }
// TODO: function stickyRouter(session) { ... }

async function scenarioA() {
  let missing = 0;
  for (let i = 0; i < 50; i++) {
    const id = 'rev-' + i;
    primary.write({ id, cafe: 'bean-there', stars: 5 });
    await sleep(5); // redirect latency
    const seen = naiveRouter().read().some((r) => r.id === id);
    if (!seen) missing++;
  }
  console.log('A: missing own review', missing, 'of 50');
}

async function scenarioB() {
  for (let i = 0; i < 5; i++) {
    primary.write({ id: 'b-' + i, cafe: 'bean-there', stars: 4 });
    const counts = [];
    for (let j = 0; j < 3; j++) { counts.push(naiveRouter().read().length); await sleep(20); }
    console.log('B: counts', counts.join(' -> '));
  }
}

await scenarioA();
await scenarioB();`,
      },
    ],
    expected: [
      'With `naiveRouter`, scenario A misses the just-written review in a large share of iterations (roughly the share that hit the 250 ms replica).',
      'Scenario B prints at least one sequence where a count decreases, e.g. `12 -> 11 -> 12`.',
      'With `rywRouter`, scenario A reports 0 missing; reads fall back to the primary only while replicas are behind.',
      'With sticky plus RYW routing, counts for one user never decrease across reads.',
    ],
    hints: [
      'The LSN comparison is the whole trick: a replica that has applied position N has applied everything before N, because the log is replayed in order.',
      'For stickiness, a simple hash is enough: sum the char codes of the userId modulo the replica count.',
      'Count how many reads in scenario A went to the primary after your fix; that number is the load cost of the guarantee.',
      'Scenario C is not fixed by routing alone in a real database; two transactions on the primary still need a unique constraint or a lock.',
    ],
    verification: [
      'Scenario A prints `missing own review 0 of 50` with `rywRouter`, and you can state how many reads hit the primary.',
      'You can point to the exact line where monotonic reads was violated before stickiness.',
      'Your NOTES.md classifies each NearBrew screen with a one-line reason.',
    ],
  },
  successChecklist: [
    'Reproduced a read-your-writes violation and a monotonic-reads violation deterministically',
    'Implemented LSN-gated replica selection with primary fallback',
    'Implemented session-sticky replica routing',
    'Demonstrated that a replica-based check-then-act booking check is unsafe',
    'Can explain async vs sync replication in terms of data loss on failover and write latency',
    'Classified real NearBrew screens by acceptable staleness',
  ],
  questions: [
    {
      question:
        'A user updates their NearBrew display name and immediately sees the old one on their profile. List two fixes and the cost of each.',
      answer:
        'This is a read-your-writes violation caused by reading from a lagging replica. Fix one: route that user\'s reads of their own profile to the primary, either always or for a time window after they write (say 10 seconds); the cost is extra primary load and a time window that is a guess, so very large lag can still break it. Fix two: record the primary WAL position after the write and only serve the user from a replica that has replayed past it, falling back to the primary otherwise; this is precise but requires carrying a token per session and querying replica replay position. A client-side optimistic update can hide the problem for the user who wrote, but other devices of the same user would still see stale data, so it is not a complete fix.',
    },
    {
      question: 'What is the difference between monotonic reads and read-your-writes? Give an example where you have one but not the other.',
      answer:
        'Read-your-writes says that after you write, your subsequent reads reflect that write. Monotonic reads says that once you have seen some state, you never later see an older state; it is about not going backwards, regardless of who wrote. Pinning a session to one lagging replica gives monotonic reads (that replica only moves forward) but not read-your-writes (it might not have your write yet). Conversely, reading your own writes from the primary but other data from random replicas gives read-your-writes for your data but can still make a café\'s review count bounce up and down.',
    },
    {
      question: 'Why can promoting an asynchronous replica after a primary crash lose data that the client was told was committed?',
      answer:
        'With asynchronous replication the primary acknowledges a commit once it is durable locally, before any replica has received it. If the primary crashes in that window, the WAL records for the most recent commits exist only on the dead machine. When a replica is promoted it becomes the new source of truth at its own, older log position, so those acknowledged transactions are gone. Synchronous replication closes this window by waiting for at least one standby to confirm, at the price of higher commit latency and blocked writes if the synchronous standby is unavailable. The acceptable loss window (RPO) should be an explicit product and ops decision.',
    },
  ],
  explainPrompt:
    'Explain to a product manager on NearBrew why adding a read replica caused "my review vanished" bugs, and what the team will do about it. Avoid jargon unless you define it.',
  rubric: [
    'Uses a clear mental model (the replica is the database as of a moment ago)',
    'Names the specific anomaly and connects it to the user-visible symptom',
    'Proposes a concrete fix and states its cost (load, complexity)',
    'Distinguishes screens that can tolerate staleness from those that cannot',
    'Mentions failover data loss as a separate, business-level decision',
  ],
  referenceExplanation:
    'We added a second copy of the database, a replica, so the busy café pages stop overloading the main one. Every change is written to the main database first and then copied to the replica, usually within milliseconds but sometimes, under load, a few seconds later. You can think of the replica as the database as it looked a moment ago. The bug happens because after you post a review we send you back to the café page, and that page reads from the replica. If the copy has not caught up yet, your review is not there; refresh a second later and it appears. Engineers call the guarantee we broke "read your own writes". The fix is a routing rule: right after you change something, we read your data from the main database until we know the replica has caught up. We do this by remembering a position marker from the write and checking the replica has passed it. This costs a little extra load on the main database, only for people who just wrote something. Not every screen needs this. A café\'s total review count being a second out of date is fine; your own review, your favourites, and especially seat or table availability in bookings are not, and availability checks will always use the main database. Separately, there is a business question for us: if the main database crashes, the replica might be missing the last second of changes. We can make writes wait for the replica to avoid that, but checkout and posting would get slower, so we should decide how much loss is acceptable.',
  stretch: {
    title: 'Real streaming replica with Docker Compose',
    description:
      'Using the official `postgres:16` image, run a primary with `wal_level=replica` and a replication role allowed in `pg_hba.conf`, then create a second container whose data directory is initialised with `pg_basebackup -h primary -U replicator -D /var/lib/postgresql/data -R` (the `-R` flag writes `standby.signal` and connection settings). Confirm with `pg_stat_replication` on the primary and `pg_is_in_recovery()` on the replica, then insert rows in a loop and measure lag with `now() - pg_last_xact_replay_timestamp()`. Expect to iterate on entrypoint scripts; this is the realistic part.',
  },
  lightTask:
    'Run the starter, reproduce the missing-review bug, implement `rywRouter` with the LSN check, and write two sentences explaining why it works.',
  intensiveExtras: [
    'Add a third replica with 2 s lag and measure what share of reads fall back to the primary under the RYW router as write frequency rises.',
    'Implement a time-window RYW variant (primary for 1 s after a write) and find the lag value at which it starts failing.',
    'Write a one-page runbook entry: what to check when replica lag alerts fire, using `pg_stat_replication` columns.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['databases', 'system-design', 'production-reliability'],
  depth: 'standard',
};

const week28: Lesson = {
  week: 28,
  slug: 'php-layering-dependency-injection',
  title: 'PHP backend patterns: layering, dependency injection, testable services',
  track: 'backend',
  topics: [
    'layered architecture',
    'dependency injection',
    'interfaces',
    'service layer',
    'repositories',
    'PHPUnit',
    'test doubles',
    'clock injection',
  ],
  objective:
    'By the end you can refactor a fat PHP controller into a thin HTTP layer, a domain service, and injected infrastructure ports, and unit-test the business rules without a database or web server.',
  whyItMatters:
    'Most legacy PHP code mixes `$_POST`, SQL, business rules and output in one file, which makes every change risky and every bug hard to reproduce. Clear layering with injected dependencies is the cheapest way to make code testable and to let a team change storage, frameworks, or third-party APIs without rewriting business logic. The same ideas apply directly to Node, Java and frontend code.',
  explanation: [
    'A useful layering for request-driven backends has three bands. The **HTTP layer** (controllers, routes) parses input, authenticates, calls one use case, and maps the result to a response and status code. The **application/domain layer** (services, entities, value objects) holds the rules: "a user can check in to a café at most once per hour", "a booking cannot overlap another". The **infrastructure layer** (repositories, mailers, payment clients, the clock) talks to the outside world. Dependencies point inward: controllers know services, services know interfaces, and infrastructure implements those interfaces. The domain never includes `PDO`, `$_SERVER`, or `curl`.',
    '**Dependency injection** simply means an object receives its collaborators instead of constructing or fetching them. Constructor injection is the default in PHP: `public function __construct(private CheckInRepository $checkIns, private Clock $clock) {}` (constructor property promotion, PHP 8.0+). Compare that with calling `new PdoCheckInRepository()` or `date()` inside the method: those hidden dependencies make the code impossible to test without a real database and a real time. A **DI container** (PSR-11 defines a common `ContainerInterface`; Symfony and Laravel ship containers with autowiring) is just a factory that builds the object graph at the edge of the app. The pattern works without any container; start by wiring by hand in `index.php`, which is often clearer for small services.',
    'Interfaces are the seams. Define them from the domain\'s point of view and name them for what the domain needs, not the technology: `CheckInRepository::lastCheckInFor(int $userId, int $cafeId): ?DateTimeImmutable`, not `MysqlHelper::query()`. This is the "ports and adapters" idea: the domain declares a port, infrastructure supplies an adapter. Keep the interface small; a repository with 30 methods leaks every query the UI ever needed into the domain. Time deserves its own port: a `Clock` interface with `now(): DateTimeImmutable` makes time-based rules (opening hours, rate limits, expiry) testable at exact boundaries.',
    'Testing follows the layers. Domain services get fast unit tests with **test doubles**: hand-written **fakes** (an in-memory repository backed by an array) are often clearer than mock libraries, because they behave like the real thing and the test reads as a story. Use mocks (PHPUnit `createMock`) when what you are verifying is an interaction, such as "the mailer was called once". Repositories get a few **integration tests** against a real database (a Docker Postgres or SQLite) to prove the SQL is right. Controllers get a small number of HTTP-level tests. If a business rule can only be tested through HTTP, it is in the wrong layer.',
    'Watch for the common failure modes. **Anemic over-layering**: five pass-through classes per endpoint with no rules in any of them adds cost without benefit; layering earns its keep where real rules live. **Service locator**: passing the container into classes and calling `$container->get()` inside methods reintroduces hidden dependencies. **Static calls and globals** (`DB::table()`, `Carbon::now()`, `$_SESSION`) inside domain code are the same problem with nicer syntax. A practical heuristic: if you cannot write the unit test in under ten lines of arrange code, the class has too many or too hidden dependencies.',
  ],
  examples: [
    {
      language: 'php',
      title: 'A domain service with injected ports',
      code: `<?php
declare(strict_types=1);

interface Clock { public function now(): DateTimeImmutable; }

interface CheckInRepository {
    public function lastCheckInFor(int $userId, int $cafeId): ?DateTimeImmutable;
    public function save(int $userId, int $cafeId, DateTimeImmutable $at): void;
}

final class CheckInTooSoon extends DomainException {}

final class CheckInService {
    public function __construct(
        private CheckInRepository $checkIns,
        private Clock $clock,
        private int $cooldownMinutes = 60,
    ) {}

    public function checkIn(int $userId, int $cafeId): DateTimeImmutable {
        $now  = $this->clock->now();
        $last = $this->checkIns->lastCheckInFor($userId, $cafeId);
        if ($last !== null && $last > $now->modify("-{$this->cooldownMinutes} minutes")) {
            throw new CheckInTooSoon('Already checked in recently');
        }
        $this->checkIns->save($userId, $cafeId, $now);
        return $now;
    }
}`,
    },
  ],
  keyTakeaways: [
    'Controllers translate HTTP; services hold rules; infrastructure implements domain-owned interfaces.',
    'Constructor injection makes dependencies explicit; a container is optional wiring, not the pattern itself.',
    'Inject the clock: time-based rules are otherwise untestable at their boundaries.',
    'Prefer simple in-memory fakes for repositories; use mocks to verify interactions.',
    'Service locators, statics and globals in domain code are hidden dependencies.',
    'Only layer where there are real rules; pass-through layers are cost without benefit.',
  ],
  prerequisites: ['Working PHP 8 knowledge', 'Basic REST API design', 'Some familiarity with classes and interfaces'],
  prerequisiteWeeks: [3, 22],
  resources: [
    {
      title: 'Martin Fowler: Inversion of Control Containers and the Dependency Injection pattern',
      url: 'https://martinfowler.com/articles/injection.html',
      kind: 'article',
      note: 'Read the sections on constructor injection and "Service Locator vs Dependency Injection". Older examples are Java but the reasoning is timeless.',
      minutes: 15,
    },
    {
      title: 'PHP manual: Object Interfaces',
      url: 'https://www.php.net/manual/en/language.oop5.interfaces.php',
      kind: 'docs',
      note: 'Quick refresher on interface syntax and constants; then read the constructor promotion part of the Constructors page linked from the OOP section.',
      minutes: 5,
    },
    {
      title: 'PSR-11: Container interface',
      url: 'https://www.php-fig.org/psr/psr-11/',
      kind: 'docs',
      note: 'Skim to see how small the standard container contract is (`get`, `has`), and read the note discouraging passing the container into objects.',
      minutes: 5,
    },
    {
      title: 'PHPUnit documentation: Test Doubles',
      url: 'https://docs.phpunit.de/',
      kind: 'docs',
      note: 'Open the current version and read the "Test Doubles" chapter on stubs vs mocks.',
      minutes: 8,
      verify: true,
    },
  ],
  exercise: {
    title: 'Refactor a fat check-in endpoint into testable layers',
    scenario:
      'NearBrew\'s web API has a legacy `checkin.php` that reads `$_POST`, queries PDO directly, checks the one-hour cooldown with `time()`, inserts the row and echoes JSON. A bug report says users can check in twice at 59 minutes and 59 seconds. You will extract the rule into a service, test the boundary, and keep the endpoint working.',
    setup: [
      'PHP 8.1+ and Composer. `mkdir checkin-lab && cd checkin-lab && composer init -n && composer require --dev phpunit/phpunit`.',
      'Add PSR-4 autoload to composer.json: `"autoload": {"psr-4": {"App\\\\": "src/"}}` then `composer dump-autoload`.',
      'Use SQLite via PDO (`new PDO("sqlite:" . __DIR__ . "/app.db")`) so no database server is needed. Serve with `php -S localhost:8000 -t public`.',
    ],
    steps: [
      'Save the legacy starter as `public/checkin.php`, create the table, and confirm it works with `curl -X POST -d "user_id=1&cafe_id=7" localhost:8000/checkin.php`.',
      'Write down every dependency hidden in the file: superglobals, PDO, `time()`, `echo`/`header`. Each becomes a parameter, a port, or stays in the HTTP layer.',
      'Create `src/Clock.php`, `src/SystemClock.php`, `src/CheckInRepository.php`, and `src/CheckInService.php` following the example. The service must not reference PDO or superglobals.',
      'Create `src/PdoCheckInRepository.php` implementing the interface with prepared statements.',
      'Create `tests/InMemoryCheckInRepository.php` (array-backed fake) and `tests/FixedClock.php` (returns a time you set).',
      'Write `tests/CheckInServiceTest.php` covering: first check-in succeeds; check-in at 59m59s throws `CheckInTooSoon`; check-in at exactly 60m succeeds; a different café is independent. Decide and document whether exactly 60 minutes is allowed.',
      'Rewrite `public/checkin.php` as a thin controller: parse and validate input, build the service (manual wiring is fine), call it, map `CheckInTooSoon` to HTTP 429 or 409 with a JSON error, success to 201.',
      'Add one integration test for `PdoCheckInRepository` using an in-memory SQLite database (`sqlite::memory:`).',
    ],
    starter: [
      {
        language: 'php',
        title: 'public/checkin.php (legacy, before refactor)',
        code: `<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/../app.db');
$pdo->exec('CREATE TABLE IF NOT EXISTS checkins (user_id INT, cafe_id INT, at INT)');
$user = (int)($_POST['user_id'] ?? 0);
$cafe = (int)($_POST['cafe_id'] ?? 0);

$stmt = $pdo->prepare('SELECT MAX(at) FROM checkins WHERE user_id = ? AND cafe_id = ?');
$stmt->execute([$user, $cafe]);
$last = $stmt->fetchColumn();

header('Content-Type: application/json');
if ($last && (time() - (int)$last) < 3600 - 1) { // off-by-one hides here
    http_response_code(429);
    echo json_encode(['error' => 'too soon']);
    exit;
}
$pdo->prepare('INSERT INTO checkins VALUES (?, ?, ?)')->execute([$user, $cafe, time()]);
http_response_code(201);
echo json_encode(['ok' => true]);`,
      },
      {
        language: 'php',
        title: 'tests/CheckInServiceTest.php (skeleton)',
        code: `<?php
use PHPUnit\\Framework\\TestCase;

final class CheckInServiceTest extends TestCase {
    public function test_rejects_check_in_one_second_before_cooldown_ends(): void {
        $clock = new FixedClock(new DateTimeImmutable('2026-03-01 10:00:00'));
        $repo  = new InMemoryCheckInRepository();
        $svc   = new CheckInService($repo, $clock);

        $svc->checkIn(1, 7);
        $clock->set(new DateTimeImmutable('2026-03-01 10:59:59'));

        $this->expectException(CheckInTooSoon::class);
        $svc->checkIn(1, 7);
    }
    // TODO: exactly 60 minutes, different cafe, first check-in
}`,
      },
    ],
    expected: [
      'The service tests run in milliseconds with `vendor/bin/phpunit tests` and need no database or server.',
      'The 59m59s test fails against a port of the legacy logic and passes after the fix, proving the off-by-one.',
      'The controller file is short: input parsing, one service call, response mapping.',
      'curl requests behave as before, with a clear JSON error and status for a too-soon check-in.',
    ],
    hints: [
      'Use `DateTimeImmutable` everywhere so `modify()` returns new objects instead of mutating shared state.',
      'If your test needs more than a few lines of setup, a dependency is still hidden.',
      'Decide the boundary explicitly (`>` vs `>=`) and name the test after the rule, not the implementation.',
      'In tests, require the test helper classes via the `autoload-dev` section or a simple `require` in a bootstrap file.',
    ],
    verification: [
      'All service tests pass and you can explain which line of the legacy code caused the bug.',
      'grep shows no `PDO`, `$_POST`, or `time(` in `src/CheckInService.php`.',
      'The PDO repository integration test passes against `sqlite::memory:`.',
    ],
  },
  successChecklist: [
    'Listed every hidden dependency in the legacy endpoint',
    'Domain service depends only on interfaces it owns',
    'Clock is injected and the cooldown boundary is tested at the second',
    'In-memory fake repository used for unit tests; one integration test for the PDO adapter',
    'Controller maps domain exceptions to specific HTTP status codes',
    'Can explain why passing a container into a class is a service locator',
  ],
  questions: [
    {
      question: 'What is the difference between dependency injection and using a DI container? Can you have one without the other?',
      answer:
        'Dependency injection is a design choice: a class receives its collaborators through its constructor (or parameters) instead of creating or looking them up. A DI container is a tool that builds those object graphs automatically, often via autowiring from type hints. You can do DI with no container by wiring objects by hand in a bootstrap file, which is common and clear in small services. You can also misuse a container without doing DI, by injecting the container itself and calling `get()` inside methods, which hides dependencies again (the service locator pattern).',
    },
    {
      question: 'When would you choose a hand-written fake over a PHPUnit mock for a repository?',
      answer:
        'A fake is a working, simplified implementation, such as an array-backed repository; it suits tests about outcomes, where you want to call the service several times and check the resulting state or behaviour. It keeps tests readable and less coupled to which methods the service happens to call. A mock is better when the interaction itself is what you are verifying, for example that a payment gateway is charged exactly once or a mailer is not called on failure. Overusing mocks for repositories tends to produce brittle tests that break on harmless refactors because they assert on call sequences rather than behaviour.',
    },
    {
      question: 'Why should a domain service not throw HTTP-specific exceptions or return response objects?',
      answer:
        'The service expresses business rules, and the same rule may be invoked from an HTTP endpoint, a CLI command, a queue worker, or a test. If it throws an `HttpException(429)` it has baked in one delivery mechanism and its status code semantics, which may be wrong in other contexts. Throwing a domain exception like `CheckInTooSoon` keeps the rule reusable and lets each adapter decide how to present it: 429 or 409 for HTTP, a retry delay for a worker, a message for a CLI. It also keeps unit tests free of HTTP concerns.',
    },
  ],
  explainPrompt:
    'In a code review, explain to a mid-level teammate why you split their 80-line `checkin.php` into a controller, a service and a repository, and why the clock is an interface. Make the case without sounding dogmatic.',
  rubric: [
    'Ties the refactor to a concrete benefit (the boundary bug became testable)',
    'Explains dependency direction: domain owns interfaces, infrastructure implements them',
    'Justifies the clock port with a specific test',
    'Acknowledges when layering is overkill',
    'Distinguishes DI from using a container',
  ],
  referenceExplanation:
    'The original file worked, and I am not splitting it for the sake of a pattern. The trigger was the double check-in bug: the rule lived next to `$_POST`, PDO and `time()`, so the only way to test "59 minutes 59 seconds is too soon" was to hit a real endpoint and wait an hour or hack the database. Now the rule lives in `CheckInService`, which receives a `CheckInRepository` and a `Clock` through its constructor. Both are small interfaces the service defines in its own terms. The PDO repository implements one; an array-backed fake implements it in tests. The clock matters because time is an input to this rule just like the user id; with a `FixedClock` I can test the exact second where the cooldown ends, which is how I found the off-by-one. The controller now only parses input, calls the service, and maps `CheckInTooSoon` to a 429. If we later trigger check-ins from a QR scanner via a queue, the worker reuses the same service. We are not using a container here; the wiring is four lines in the entry file, which is easier to read. I would not do this for an endpoint with no rules, like a health check, where extra layers would just be ceremony. The rule of thumb I use: if testing a business rule needs a web server or a database, the rule is in the wrong place.',
  stretch: {
    title: 'Add a second adapter without touching the service',
    description:
      'Add a `CachedCheckInRepository` decorator that wraps the PDO repository and caches `lastCheckInFor` in an array (or APCu), and a `NotifyingCheckInService` decorator that sends a "first visit" event. Wire both in the entry file. Prove with tests that the core service and its tests are unchanged.',
  },
  lightTask:
    'Extract the cooldown rule from the legacy snippet into a `CheckInService` with injected `Clock` and repository interfaces, and write the 59m59s unit test with a fixed clock and in-memory fake.',
  intensiveExtras: [
    'Port the same service to TypeScript with constructor injection and Vitest, and compare how the seams look.',
    'Wire the app with a container (for example PHP-DI or Symfony DependencyInjection) and compare readability with manual wiring.',
    'Add input validation as a separate value object (`CafeId`, `UserId`) that rejects non-positive ids, with tests.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['backend-services', 'api-design', 'technical-communication'],
  depth: 'standard',
};

const week29: Lesson = {
  week: 29,
  slug: 'memory-gc-js-leaks',
  title: 'Memory: stack vs heap, garbage collection, and finding leaks in JS apps',
  track: 'cs',
  secondaryTracks: ['frontend'],
  topics: [
    'stack vs heap',
    'garbage collection',
    'reachability',
    'generational GC',
    'memory leaks',
    'heap snapshots',
    'detached DOM',
    'React effect cleanup',
  ],
  objective:
    'By the end you can explain how JavaScript engines allocate and reclaim memory, recognise the common leak patterns in React apps, and prove and fix a leak using Chrome DevTools heap snapshots and allocation timelines.',
  whyItMatters:
    'Leaks rarely crash a short page visit, but they do crash long-running sessions: dashboards left open all day, single-page apps that never reload, and apps on memory-constrained devices such as TVs and low-end phones. Fixing them requires evidence, not guesswork, and the tooling is free in every Chromium browser.',
  explanation: [
    'Conceptually, a running program has a **stack** and a **heap**. The stack holds call frames: local variables, arguments and return addresses for the functions currently executing; it is fast, ordered, and freed automatically when a function returns. The heap holds things whose lifetime is not tied to one call: objects, arrays, closures, strings. In JavaScript you never free heap memory yourself. (Engines are free to optimise where values physically live, so treat this as a mental model, not a guarantee about every value.)',
    'JavaScript uses **tracing garbage collection** based on **reachability**. Starting from roots (the global object, the current call stack, active handles such as timers and event listeners registered with the browser), the collector marks everything reachable by following references; anything unmarked is garbage. The consequence is crucial: a **leak in JS is memory that is still reachable but no longer needed**. The GC is not failing; your code is still holding a reference. V8 (Chrome, Node) uses a generational design: most objects die young, so new objects go in a small young generation collected frequently and cheaply, and survivors are promoted to an old generation collected less often with mark-sweep/mark-compact, much of it concurrently or incrementally to reduce pauses.',
    'The common leak patterns in front-end code are all "something long-lived points at something that should have died". **Uncleared timers**: `setInterval` callbacks are roots until cleared, and their closures keep component state and props alive. **Forgotten listeners**: `window.addEventListener("resize", handler)` without removal keeps `handler` and everything it closes over. **Subscriptions** to stores, WebSockets or observables that are never unsubscribed. **Module-level caches** (a `Map` keyed by id that only grows). **Detached DOM**: nodes removed from the document but still referenced from JS, often via an array or closure, which keep whole subtrees alive. In React, the rule is that any effect that registers something with the outside world must return a cleanup function; Strict Mode in development deliberately mounts, unmounts and remounts components to expose missing cleanups.',
    'Finding leaks is a measurement exercise with Chrome DevTools. The **Performance** panel with the Memory checkbox shows JS heap, nodes and listeners over time; a sawtooth that returns to baseline is healthy, a staircase that keeps rising after forcing GC (the trash-can button) is suspicious. The **Memory** panel offers **heap snapshots** (a full graph at one moment), **allocation instrumentation on timeline** (which allocations survive over time), and **allocation sampling** (low-overhead, by function). The most reliable technique is the **three-snapshot method**: take a baseline snapshot, perform the suspect action (open and close a screen) several times, force GC, snapshot again, and use the Comparison view or filter "Objects allocated between snapshots". Look for counts that scale with how many times you repeated the action. Then select a leaked object and read its **Retainers** path: it tells you exactly which reference chain keeps it alive, often ending in `setInterval` or an event listener.',
    'Two distinctions keep diagnosis honest. **Shallow size** is the memory of the object itself; **retained size** is what would be freed if it were collected, including everything only it keeps alive. Sort by retained size to find the anchor of a leak. And **high memory is not a leak**: a big cache that stays flat is a sizing decision, while a steady rise across repeated identical actions is a leak. Tools like `WeakMap`, `WeakRef` and `FinalizationRegistry` exist, but the fix for most app leaks is boring: clean up what you register, and bound what you cache.',
  ],
  examples: [
    {
      language: 'tsx',
      title: 'Leaky vs correct effect',
      code: `// Leaky: every mount adds an interval and a listener that are never removed.
function LiveOccupancy({ cafeId }: { cafeId: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setInterval(() => fetchOccupancy(cafeId).then(setCount), 2000);
    window.addEventListener('focus', () => fetchOccupancy(cafeId).then(setCount));
  }, [cafeId]);
  return <span>{count} people here</span>;
}

// Fixed: everything registered is unregistered; stale responses are ignored.
function LiveOccupancyFixed({ cafeId }: { cafeId: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => fetchOccupancy(cafeId).then((n) => { if (active) setCount(n); });
    const id = setInterval(refresh, 2000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener('focus', refresh);
    };
  }, [cafeId]);
  return <span>{count} people here</span>;
}`,
    },
  ],
  keyTakeaways: [
    'JS memory is reclaimed by reachability; a leak is something still reachable that you no longer need.',
    'Timers, listeners, subscriptions, unbounded caches and detached DOM are the usual retainers.',
    'Every React effect that registers with the outside world returns a cleanup that undoes it.',
    'Use the three-snapshot method and the Retainers panel to prove a leak and find its anchor.',
    'Retained size finds the root of a leak; shallow size rarely does.',
    'Flat-but-high memory is a sizing question; rising-after-GC across repeated actions is a leak.',
  ],
  prerequisites: ['React hooks, especially useEffect', 'Basic understanding of closures and the event loop'],
  prerequisiteWeeks: [2, 5],
  resources: [
    {
      title: 'Chrome DevTools: Fix memory problems',
      url: 'https://developer.chrome.com/docs/devtools/memory-problems',
      kind: 'docs',
      note: 'Read the overview page, then follow its links to the heap snapshot and allocation timeline guides. Focus on detached DOM and the Comparison view.',
      minutes: 15,
      verify: true,
    },
    {
      title: 'MDN: Memory management',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management',
      kind: 'docs',
      note: 'Read the sections on garbage collection and mark-and-sweep, plus the WeakMap/WeakRef section.',
      minutes: 10,
    },
    {
      title: 'React: useEffect reference',
      url: 'https://react.dev/reference/react/useEffect',
      kind: 'docs',
      note: 'Read "Connecting to an external system" and the troubleshooting note about effects running twice in development.',
      minutes: 8,
    },
    {
      title: 'V8 blog: Trash talk, the Orinoco garbage collector',
      url: 'https://v8.dev/blog/trash-talk',
      kind: 'article',
      note: 'Optional depth: generational layout, scavenging, and concurrent marking.',
      minutes: 10,
      verify: true,
    },
  ],
  exercise: {
    title: 'Prove and fix a leak in a NearBrew live-occupancy widget',
    scenario:
      'NearBrew\'s web dashboard for café owners shows a list of cafés; clicking one opens a detail panel with a live occupancy widget that polls every second and reacts to window resize. Owners leave it open all day and report the tab getting sluggish. You will reproduce the leak, measure it, and fix it.',
    setup: [
      '`npm create vite@latest leak-lab -- --template react-ts`, `cd leak-lab`, `npm install`.',
      'Replace `src/App.tsx` with the starter. Remove `<StrictMode>` from `main.tsx` for the measurement phase so the counts are easy to read (add it back at the end).',
      'Use Chrome or another Chromium browser. Run `npm run build && npm run preview` for measurement so dev-only overhead does not muddy the numbers.',
    ],
    steps: [
      'Run the app. Click "Toggle panel" about 20 times. Watch the "active intervals" counter in the console logs grow.',
      'Open DevTools, Performance panel, tick Memory. Record while toggling 20 more times, click the garbage-collect button, then stop. Note whether JS heap and listener count return to baseline.',
      'Memory panel: take snapshot 1. Toggle 10 times, collect garbage, take snapshot 2. Toggle 10 more, collect, snapshot 3. In snapshot 3 choose "Objects allocated between snapshot 1 and 2".',
      'Filter for `OccupancyPanel` related objects and for "Detached" in the class filter. Select one leaked item and read the Retainers section. Write down the retaining chain (expect a timer or a listener).',
      'Fix all three leaks in the starter: the interval, the resize listener, and the module-level `history` array that grows forever (bound it to the last 60 readings).',
      'Repeat the three-snapshot method. Counts that scaled with toggles should now be flat.',
      'Re-enable `<StrictMode>` and confirm in dev that the effect setup/cleanup pairs log correctly (setup, cleanup, setup on mount).',
    ],
    starter: [
      {
        language: 'tsx',
        title: 'src/App.tsx',
        code: `import { useEffect, useState } from 'react';

let activeIntervals = 0;
const history: { at: number; value: number; panel: HTMLElement | null }[] = [];

function OccupancyPanel({ cafe }: { cafe: string }) {
  const [value, setValue] = useState(0);
  const [width, setWidth] = useState(window.innerWidth);
  const big = new Array(50_000).fill(cafe); // makes leaks visible in snapshots

  useEffect(() => {
    activeIntervals++;
    console.log('active intervals', activeIntervals);
    setInterval(() => {
      const v = Math.round(Math.random() * 40);
      history.push({ at: Date.now(), value: v, panel: document.getElementById('panel') });
      setValue(v + big.length * 0);
    }, 1000);
    window.addEventListener('resize', () => setWidth(window.innerWidth));
  }, []);

  return (
    <div id="panel">
      <h2>{cafe}</h2>
      <p>{value} people here (viewport {width}px)</p>
    </div>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button onClick={() => setOpen((o) => !o)}>Toggle panel</button>
      {open && <OccupancyPanel cafe="Bean There" />}
    </main>
  );
}`,
      },
    ],
    expected: [
      'Before the fix, "active intervals" increases on every open and never decreases; the console shows React warnings-free but CPU usage creeps up.',
      'The snapshot comparison shows arrays of 50,000 strings and detached `HTMLDivElement` nodes whose count scales with the number of toggles.',
      'The Retainers path for a leaked array runs through a closure created in the effect and retained by a timer or a listener.',
      'After the fix, repeated toggles plus forced GC return heap size and node counts to near baseline.',
    ],
    hints: [
      'Detached nodes here are retained by `history` entries holding `panel` references; store plain numbers instead.',
      'Keep a reference to the resize handler so you can pass the same function to `removeEventListener`.',
      'Decrement `activeIntervals` in cleanup so your own counter proves the fix.',
      'If snapshots are noisy, increase the toggle count; leaks scale linearly with repetitions, noise does not.',
    ],
    verification: [
      'You have a screenshot or note of the Retainers chain before the fix.',
      'After the fix, "active intervals" never exceeds 1 (or 2 briefly in Strict Mode dev).',
      'Snapshot 3 vs 1 shows no growth in the 50,000-element arrays or detached divs after 20 toggles.',
    ],
  },
  successChecklist: [
    'Explained reachability-based GC and why JS leaks are retained references',
    'Ran the three-snapshot method and read a Retainers path',
    'Identified timer, listener and unbounded cache leaks and fixed each',
    'Found and eliminated detached DOM nodes',
    'Distinguished shallow from retained size when choosing what to investigate',
    'Confirmed effect setup/cleanup symmetry under Strict Mode',
  ],
  questions: [
    {
      question: 'If JavaScript is garbage-collected, how can it leak memory at all?',
      answer:
        'The collector frees only objects that are unreachable from roots such as globals, the stack, and handles held by the runtime (timers, event listeners, pending promises tied to I/O). A leak happens when code keeps a reference to something it no longer needs: an interval that was never cleared keeps its callback and the closure scope alive, which can include component state, props and large data. The GC is correct to keep it, because from its point of view the program might still use it. So JS leaks are logic bugs about lifetimes, not allocator bugs, and the fix is to remove the reference.',
    },
    {
      question: 'Describe the three-snapshot technique and why it is better than looking at one heap snapshot.',
      answer:
        'You take a baseline snapshot, repeat the suspect action several times, force GC and take a second snapshot, then repeat the action again and take a third. Filtering the third snapshot to objects allocated between the first and second shows things created during the action that survived a full GC and another round of activity. A single snapshot shows everything in memory, most of which is legitimately long-lived, so it is hard to tell leaked from normal. Comparing across repetitions also lets you see whether counts scale with the number of actions, which is the signature of a leak.',
    },
    {
      question: 'What is a detached DOM node and how does it typically get retained in a React app?',
      answer:
        'A detached node is an element that has been removed from the document tree but is still referenced from JavaScript, so it and its subtree cannot be collected. In React apps it usually happens when code outside React\'s ownership keeps a reference: a ref stored in a module-level array or cache, a third-party library instance attached to a node and never destroyed, or a listener closure capturing an element. React itself releases nodes it unmounts, so the retainer is almost always your code or a library. DevTools heap snapshots let you filter by "Detached" and follow Retainers back to the holder.',
    },
  ],
  explainPrompt:
    'Explain to an interviewer how you would investigate a report that a long-running React dashboard gets slower over a workday, from first hypothesis to verified fix.',
  rubric: [
    'Starts with reproducing and measuring rather than guessing',
    'Explains reachability and why a leak is a retained reference',
    'Describes the three-snapshot method and Retainers path concretely',
    'Names likely culprits (timers, listeners, subscriptions, caches, detached DOM)',
    'Verifies the fix with the same measurement',
    'Distinguishes a leak from legitimately high but stable memory',
  ],
  referenceExplanation:
    'First I would make it reproducible: find the action users repeat all day, such as opening and closing café detail panels, and script or perform it twenty times. I would record in the Performance panel with memory enabled and force a garbage collection at the end. A healthy app shows a sawtooth that returns to baseline; a leak shows heap, DOM nodes or listener counts stepping up with each repetition even after GC. Memory in JavaScript is reclaimed by reachability, so a leak means something long-lived still references objects we no longer need. To find what, I would use heap snapshots: a baseline, then after repeating the action and collecting garbage, then again. Filtering to objects allocated between the first two snapshots, and checking which counts scale with the number of repetitions, isolates the leaked objects. Sorting by retained size shows which object anchors the most memory, and the Retainers panel shows the exact chain, which in React apps usually ends at a `setInterval`, a window event listener, a store subscription, an ever-growing module-level cache, or detached DOM held in an array. The fix is usually a missing effect cleanup or a bounded cache. Then I re-run exactly the same measurement to prove the counts are flat, and I would add the leaked pattern to code review guidance. I would also be careful not to call stable high memory a leak; that is a separate sizing conversation.',
  stretch: {
    title: 'Leak hunt in Node',
    description:
      'Write a small Node HTTP server that caches responses in a `Map` keyed by full URL including query strings. Hit it with varied query strings, start it with `node --inspect`, attach Chrome DevTools via `chrome://inspect`, and use heap snapshots to prove the cache is the culprit. Fix it with an LRU bound and verify.',
  },
  lightTask:
    'Run the starter, take two heap snapshots around 10 panel toggles, find the retained 50,000-element arrays and their Retainers path, then add effect cleanup and confirm the count stops growing.',
  intensiveExtras: [
    'Add a WebSocket-style subscription using a fake event emitter and leak it, then fix it with an unsubscribe in cleanup.',
    'Use "Allocation instrumentation on timeline" instead of snapshots for the same leak and compare which you find faster.',
    'Write a Vitest test that mounts and unmounts the component 50 times and asserts `activeIntervals === 0` using fake timers.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['cs-fundamentals', 'rendering-performance', 'ui-reliability'],
  depth: 'standard',
};

const week30: Lesson = {
  week: 30,
  slug: 'react-performance-at-scale',
  title: 'React performance at scale: virtualisation, code-splitting, Suspense, transitions',
  track: 'frontend',
  topics: [
    'virtualisation',
    'windowing',
    'code-splitting',
    'React.lazy',
    'Suspense',
    'useTransition',
    'useDeferredValue',
    'bundle size',
  ],
  objective:
    'By the end you can choose between virtualisation, code-splitting, transitions and deferred values for a given slowness, implement each in a React app, and verify the improvement with the React Profiler and DevTools.',
  whyItMatters:
    'Product UIs grow: catalogues reach thousands of items, dashboards gain heavy charts, and search boxes filter large lists on every keystroke. Each technique here fixes a different kind of slowness (too much DOM, too much JavaScript up front, too much render work on urgent updates), and applying the wrong one adds complexity without improving what users feel.',
  explanation: [
    'Start by naming the cost. **Too many DOM nodes** (a 5,000-row café list) makes initial render, layout and memory expensive regardless of how cleverly React diffs. **Too much JavaScript at startup** (a map library, a chart library, an admin panel bundled into the first load) delays interactivity for everyone, even users who never open those screens. **Expensive renders on urgent input** (filtering a big list on every keystroke) makes typing lag because React must finish rendering before the browser can paint the next character. Profile first (week 2): the React Profiler shows render cost; the Performance panel shows long tasks, layout and script evaluation; the network panel and a bundle analyser show what ships.',
    '**Virtualisation** (windowing) renders only the rows near the viewport plus a small overscan, positioning them inside a container whose total height matches the full list so the scrollbar behaves normally. The DOM stays at maybe 30 rows instead of 5,000. Fixed-height rows are simple: `startIndex = Math.floor(scrollTop / rowHeight)`. Variable heights need measurement and estimation, which is where libraries such as TanStack Virtual or react-window earn their keep. Costs: in-page find (Ctrl+F) cannot see unrendered rows, screen readers see only rendered items unless you expose `aria-rowcount`/`aria-setsize` and positions, and focus inside a row that scrolls out of the window is lost unless you manage it.',
    '**Code-splitting** defers JavaScript until it is needed. `const Map = lazy(() => import("./CafeMap"))` creates a component whose code is a separate chunk loaded on first render. A `lazy` component must be rendered inside a `<Suspense fallback={...}>` boundary, which shows the fallback while the chunk (or other Suspense-enabled data) loads. Declare `lazy` at module top level, not inside a component, or its state resets on every render. Split along routes and heavy, rarely used features; splitting tiny components just adds network round trips. Prefetch on intent (hover, idle time) by calling the same `import()` early so the chunk is cached.',
    '**Transitions** tell React which updates are urgent. `const [isPending, startTransition] = useTransition()` lets you wrap a state update in `startTransition(() => setTab("map"))`; React renders it in the background, keeps the current UI interactive, can interrupt it if a more urgent update (typing, clicking) arrives, and gives you `isPending` to show subtle feedback. Transitions also stop an already-revealed Suspense boundary from flashing back to its fallback when a navigation suspends; React keeps showing the old content instead. `useDeferredValue(value)` is the counterpart when you do not own the state update: render the input with the urgent `query`, and render the expensive list with `deferredQuery`, which lags behind during fast typing. Neither makes rendering cheaper; the expensive component should usually be wrapped in `memo` so React can skip it when its deferred prop has not changed yet. Neither replaces debouncing network calls: they schedule rendering, not fetching.',
    'These compose in realistic screens. A NearBrew café search page might virtualise the result list, defer the filter value so typing stays responsive, lazy-load the map view behind a tab switched with a transition, and wrap that tab in a Suspense boundary with a skeleton. The senior skill is matching technique to measured cost and checking the trade-offs: accessibility for virtual lists, waterfall loading for over-split bundles, and stale-looking UI for deferred values (consider dimming the list while `query !== deferredQuery`).',
  ],
  examples: [
    {
      language: 'tsx',
      title: 'Deferred filtering plus a lazy, transition-driven tab',
      code: `import { lazy, memo, Suspense, useDeferredValue, useState, useTransition } from 'react';

const CafeMap = lazy(() => import('./CafeMap')); // separate chunk

const ResultList = memo(function ResultList({ query }: { query: string }) {
  const items = filterCafes(ALL_CAFES, query); // expensive on 10k items
  return <VirtualList items={items} rowHeight={56} height={600} />;
});

export function SearchPage() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const [isPending, startTransition] = useTransition();
  const stale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <button onClick={() => startTransition(() => setTab(tab === 'list' ? 'map' : 'list'))}>
        {isPending ? 'Loading…' : 'Switch view'}
      </button>
      <div style={{ opacity: stale ? 0.6 : 1 }}>
        {tab === 'list' ? (
          <ResultList query={deferredQuery} />
        ) : (
          <Suspense fallback={<p>Loading map…</p>}>
            <CafeMap query={deferredQuery} />
          </Suspense>
        )}
      </div>
    </>
  );
}`,
    },
  ],
  keyTakeaways: [
    'Diagnose first: too much DOM, too much startup JS, or expensive renders on urgent input each need a different fix.',
    'Virtualisation bounds DOM size; it costs find-in-page, needs ARIA set-size work, and complicates focus.',
    '`lazy` plus `Suspense` defers code; declare lazy at module scope and split along routes and heavy features.',
    '`useTransition` marks your own updates as non-urgent and interruptible; `useDeferredValue` lags a value you receive.',
    'Pair deferred values with `memo` on the expensive child, and show staleness visually.',
    'Transitions schedule rendering; they do not debounce fetches or make renders cheaper.',
  ],
  prerequisites: ['React rendering and profiling', 'Client-side state and data fetching', 'Browser rendering pipeline basics'],
  prerequisiteWeeks: [2, 11, 15],
  resources: [
    {
      title: 'React: lazy',
      url: 'https://react.dev/reference/react/lazy',
      kind: 'docs',
      note: 'Read Usage and the pitfall about declaring lazy components inside other components.',
      minutes: 6,
    },
    {
      title: 'React: Suspense',
      url: 'https://react.dev/reference/react/Suspense',
      kind: 'docs',
      note: 'Read "Revealing content together", "Showing stale content while fresh content is loading" and "Preventing already revealed content from hiding".',
      minutes: 10,
    },
    {
      title: 'React: useTransition',
      url: 'https://react.dev/reference/react/useTransition',
      kind: 'docs',
      note: 'Read "Marking a state update as a non-blocking Transition" and the troubleshooting section on why text inputs cannot be controlled by a transition.',
      minutes: 7,
    },
    {
      title: 'React: useDeferredValue',
      url: 'https://react.dev/reference/react/useDeferredValue',
      kind: 'docs',
      note: 'Read "Deferring re-rendering for a part of the UI" and "How is deferring a value different from debouncing and throttling?".',
      minutes: 7,
    },
    {
      title: 'TanStack Virtual',
      url: 'https://tanstack.com/virtual/latest',
      kind: 'tool',
      note: 'Skim the introduction and the fixed vs dynamic size examples after writing your own windowing.',
      minutes: 5,
      verify: true,
    },
  ],
  exercise: {
    title: 'Make a 10,000-café search page feel instant',
    scenario:
      'NearBrew\'s web catalogue for a city lists 10,000 cafés with a text filter and a heavy map view. Typing in the filter lags, the first load ships the map library to everyone, and scrolling stutters. You will fix each with the right technique and measure each fix.',
    setup: [
      '`npm create vite@latest perf-lab -- --template react-ts`, `cd perf-lab`, `npm install`.',
      'Generate data in `src/data.ts` with the starter; create a fake heavy `src/CafeMap.tsx` (starter) to stand in for a map library.',
      'Install the React Developer Tools browser extension for the Profiler.',
    ],
    steps: [
      'Build the naive page: an input that filters all 10,000 cafés with `filterCafes` and renders every result as a `<li>`. Profile typing five characters; record commit durations and look for long tasks in the Performance panel.',
      'Write your own `VirtualList` with fixed 56px rows: a scroll container with `height: 600px; overflow: auto`, an inner spacer of `items.length * 56`px, and absolutely positioned rows for indices from `floor(scrollTop/56) - 5` to `ceil((scrollTop+600)/56) + 5`. Count DOM `<li>` nodes before and after.',
      'Add `aria-setsize` and `aria-posinset` to each row (or use `role="list"` semantics appropriately) and note what screen readers lose.',
      'Profile typing again. The DOM is small now, but filtering is still expensive. Apply `useDeferredValue` to the query and `memo` to `ResultList`. Show a dimmed state while stale. Use DevTools CPU throttling (4x or 6x) to make the difference visible.',
      'Run `npm run build` and note the bundle sizes printed. Change the map to `lazy(() => import("./CafeMap"))` wrapped in `Suspense` and rebuild; confirm a separate chunk appears and the main chunk shrank.',
      'Switch tabs with `startTransition` and show `isPending` on the button. Compare with a plain `setTab`: with the plain version, the Suspense fallback replaces the list; with the transition, the old view stays until the map is ready (after the first load, when it would otherwise re-suspend).',
      'Add prefetching: call `import("./CafeMap")` on button hover. Confirm in the network panel that the chunk downloads before the click.',
    ],
    starter: [
      {
        language: 'ts',
        title: 'src/data.ts',
        code: `export type Cafe = { id: number; name: string; area: string; rating: number };

const areas = ['Shoreditch', 'Hackney', 'Camden', 'Peckham', 'Brixton', 'Islington'];
export const ALL_CAFES: Cafe[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i,
  name: 'Cafe ' + i.toString(36).toUpperCase(),
  area: areas[i % areas.length]!,
  rating: Math.round((3 + (i % 20) / 10) * 10) / 10,
}));

// Deliberately slow, to simulate realistic scoring/highlighting work.
export function filterCafes(cafes: Cafe[], q: string): Cafe[] {
  const needle = q.trim().toLowerCase();
  const start = performance.now();
  while (performance.now() - start < 30) { /* burn ~30ms */ }
  return needle ? cafes.filter((c) => (c.name + ' ' + c.area).toLowerCase().includes(needle)) : cafes;
}`,
      },
      {
        language: 'tsx',
        title: 'src/CafeMap.tsx (stand-in for a heavy library)',
        code: `const HUGE_TABLE = Array.from({ length: 200_000 }, (_, i) => 'tile-' + i); // inflates the chunk at runtime only
export default function CafeMap({ query }: { query: string }) {
  return <div style={{ height: 600, background: '#cde' }}>Map for "{query}" ({HUGE_TABLE.length} tiles)</div>;
}`,
      },
    ],
    expected: [
      'Naive version: each keystroke commit takes well over 100 ms under CPU throttling and typing visibly lags.',
      'With virtualisation, the DOM holds roughly 20 to 30 rows regardless of result count, and scrolling is smooth.',
      'With `useDeferredValue` and `memo`, characters appear immediately while the list catches up dimmed.',
      'The build output shows a separate `CafeMap` chunk; the main bundle no longer includes it.',
      'With `startTransition`, switching to an already-loaded-once view keeps the old content visible and shows a pending label instead of flashing the fallback.',
    ],
    hints: [
      'The stand-in map does not add real bytes to the bundle; to see a real size difference, import a sizeable library in it (any charting or date library you have) or add a large static JSON import.',
      'Wrapping `setQuery` in `startTransition` breaks controlled inputs; that is why the input uses urgent state and the list uses the deferred value.',
      '`memo` matters: without it, the parent re-render on each keystroke re-renders `ResultList` with the old deferred query anyway.',
      'For the virtual list, use `onScroll` to store `scrollTop` in state and compute the window from it.',
    ],
    verification: [
      'You have before/after numbers for commit duration while typing (Profiler) and DOM node count.',
      'You can show the separate chunk in the build output and in the network panel loading on demand.',
      'You can explain, for each technique, which cost it addressed and what trade-off it introduced.',
    ],
  },
  successChecklist: [
    'Profiled and named the cost before applying each fix',
    'Implemented fixed-height windowing by hand and understood the scroll maths',
    'Used useDeferredValue with memo and visible stale state',
    'Split a heavy view with lazy and Suspense and verified the chunk',
    'Used startTransition with isPending for a tab switch',
    'Listed accessibility and find-in-page trade-offs of virtualisation',
  ],
  questions: [
    {
      question: 'When would you use useDeferredValue instead of useTransition?',
      answer:
        '`useTransition` wraps a state update you control, marking it non-urgent, and gives you `isPending`. `useDeferredValue` is for when you receive a value, such as a prop or state you must keep urgent (a controlled input), and want a lagging copy for an expensive part of the tree. A search box is the classic case: the input must update immediately, so its state cannot be in a transition, but the results list can render from a deferred version of the query. Both rely on React\'s concurrent rendering to interrupt background work, and the expensive child should be memoised to benefit.',
    },
    {
      question: 'What are the costs and pitfalls of virtualising a long list?',
      answer:
        'Rows outside the window do not exist in the DOM, so browser find-in-page cannot locate them, and assistive technology only sees the rendered rows unless you expose total size and positions with attributes like `aria-setsize` and `aria-posinset`. Focus is lost if a focused row scrolls out and unmounts, so keyboard navigation needs explicit management. Variable-height rows require measurement and can cause scroll jumps when estimates are wrong. It also adds code complexity, so for a few hundred simple rows, plain rendering with `content-visibility` or pagination may be simpler.',
    },
    {
      question: 'Why must lazy components be declared at module top level, and what does Suspense have to do with them?',
      answer:
        'Calling `lazy()` creates a new component type. If you call it inside a component, every render creates a new type, so React unmounts and remounts the subtree, losing state and re-triggering loading. Declaring it once at module scope keeps a stable type and caches the loaded module. A lazy component suspends while its code chunk loads, and React needs a `Suspense` boundary above it to know what fallback to show; boundary placement decides how much of the page is replaced by the fallback, and transitions can keep already visible content on screen instead.',
    },
  ],
  explainPrompt:
    'Explain to a mid-level teammate in a design review how you would decide between virtualisation, code-splitting and transitions for a slow catalogue page, using what you measured this week.',
  rubric: [
    'Starts from measurement and names the specific cost observed',
    'Maps each technique to the cost it addresses',
    'Explains the urgent vs non-urgent update model accurately',
    'States trade-offs, especially accessibility and focus for virtual lists',
    'Uses concrete numbers or observations from the exercise',
  ],
  referenceExplanation:
    'I would not pick a technique until I knew which cost we were paying, because each one fixes something different. On our catalogue I measured three. First, rendering 10,000 list items meant tens of thousands of DOM nodes; initial render and scrolling were slow because of the DOM itself. Virtualisation fixes that by rendering only the 20 to 30 rows in view inside a spacer of the full height, which took our node count from thousands to dozens. The cost is that unrendered rows are invisible to find-in-page and to screen readers, so we add set-size and position attributes and manage focus. Second, typing in the filter lagged because each keystroke re-filtered and re-rendered synchronously. A smaller DOM did not fix that. Here I used `useDeferredValue`: the input renders with the latest text immediately, and the memoised results list renders with a deferred copy that React can interrupt when another keystroke arrives. We dim the list while it is stale so users understand. Third, the first load shipped the map code to every user although most never open it. `lazy` with a Suspense boundary moved it into its own chunk, and switching to the map inside `startTransition` keeps the list visible with a pending label instead of flashing a spinner. None of these made the filtering function itself faster; if profiling showed that dominating, I would optimise or move it to a worker next.',
  stretch: {
    title: 'Variable-height rows and keyboard focus',
    description:
      'Change rows to variable heights (some cafés have a second line for opening hours). Implement measurement with a `ResizeObserver` and an estimated height, or adopt TanStack Virtual. Then add arrow-key navigation that keeps focus on the active row even when it scrolls out of the rendered window (scroll it into view before focusing).',
  },
  lightTask:
    'Take the starter data, render the naive list, then add `useDeferredValue` plus `memo` to the results and record before/after Profiler commit times while typing with CPU throttling on.',
  intensiveExtras: [
    'Move `filterCafes` into a Web Worker and compare responsiveness with the deferred-value approach.',
    'Add a route-level split with React Router (or a simple hash router) and measure first-load JS before and after.',
    'Run Lighthouse on the built app before and after code-splitting and compare Total Blocking Time.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['rendering-performance', 'react-architecture', 'consumer-ui'],
  depth: 'standard',
};

const week31: Lesson = {
  week: 31,
  slug: 'tv-ui-spatial-navigation',
  title: '10-foot / TV UI engineering: spatial navigation, focus management, low-power devices',
  track: 'frontend',
  topics: [
    '10-foot UI',
    'spatial navigation',
    'D-pad input',
    'roving focus',
    'focus memory',
    'key handling',
    'low-power devices',
    'focus scrolling',
  ],
  objective:
    'By the end you can build a React grid of horizontally scrolling rows navigable with arrow keys, with one focusable item at a time, per-row focus memory, focus restoration after navigation, and rendering choices suited to low-powered devices.',
  whyItMatters:
    'On TVs, set-top boxes and game consoles there is no mouse or touch: the user drives the whole UI with a remote D-pad from across the room. Focus is the cursor, so a lost, invisible or jumpy focus is a broken product, and the hardware is often far weaker than a laptop. These skills also transfer directly to keyboard accessibility on the web.',
  explanation: [
    'A **10-foot UI** is designed for a screen viewed from a sofa with a remote. That changes the basics: text and targets are large, layouts are simple and predictable, important content stays inside a safe area away from the screen edges (older TVs overscan), and there are few input actions: up, down, left, right, select, back, and sometimes a few media keys. Because input is directional, the core interaction model is **spatial navigation**: pressing right moves focus to the nearest focusable item in that direction. Users cannot "point"; every extra key press is friction, so navigation paths must be short and unsurprising.',
    'There are two broad implementations. **Geometric** navigation finds the best candidate by measuring element rectangles (`getBoundingClientRect`) and scoring distance and alignment in the pressed direction; it is general but can pick surprising targets in irregular layouts and costs layout reads. **Logical/structural** navigation models the screen as data, for example a list of rows each holding items, and moves by index: right is `col + 1`, down is `row + 1`. Most row-based home screens benefit from the structural model because it is predictable, cheap, and testable without a DOM. Hybrid approaches use structure within a component and geometry between distinct regions such as a side menu and the content grid.',
    'Focus management patterns from web accessibility apply directly. **Roving focus** (roving tabindex) keeps exactly one item in a group focusable (`tabIndex={0}`) and the rest `tabIndex={-1}`, moving real DOM focus with `element.focus()` on arrow keys, so the browser\'s focus, `:focus-visible` styles and screen readers all agree. **Focus memory** means each row remembers its last focused column: if you move down from row 1 column 5 and later come back up, you land on column 5 again, not column 0. A common policy is to remember per row and clamp to the row length. **Focus restoration** means after a detail page or modal closes (Back key), focus returns to the item that opened it; that requires storing an identity (row id plus item id, not just indices, since data can change) before navigating away. Never let focus fall to `body`; on TV that is the user losing their cursor.',
    'Key handling needs care. Arrow keys arrive as `keydown` events with `event.key` values `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, and `Enter` for select. Back and media keys vary by platform and are often exposed with platform-specific key names or codes, so put key mapping behind one small module. Call `preventDefault()` on handled arrow keys to stop the browser scrolling the page. Remotes auto-repeat when held, so the handler must be cheap; heavy work per key press shows up as input lag. Scrolling the focused item into view should be deliberate: for rows, translate the row container so the focused item sits at a consistent position rather than relying on `scrollIntoView` defaults, and use `focus({ preventScroll: true })` when you own the scrolling.',
    '**Low-powered devices** shape everything. TV system-on-chips commonly have slow CPUs, limited memory, and long-lived browser engines that may lag current desktop versions, so feature-detect and test on the oldest target. Practical rules: keep the DOM small (render only rows near the viewport, and only a window of items within each row); animate only `transform` and `opacity` so the compositor can do it without layout or paint; avoid large box-shadows, blur filters and many simultaneous animations; size images to the tile resolution; and make a focus change update as few components as possible. In React, that means focus state should not live at the top of the tree in a way that re-renders every row on each key press: keep it in a ref or a small store, memoise rows, and let only the previously and newly focused tiles re-render. Measure with the Performance panel under CPU throttling as a proxy, but treat a real device as the source of truth.',
  ],
  examples: [
    {
      language: 'ts',
      title: 'Structural navigation with per-row focus memory (pure, testable)',
      code: `export type FocusPos = { row: number; col: number };
export type NavState = { pos: FocusPos; memory: Record<number, number> };

export function move(state: NavState, key: string, rowLengths: number[]): NavState {
  const { row, col } = state.pos;
  const memory = { ...state.memory, [row]: col }; // remember where we left this row
  switch (key) {
    case 'ArrowLeft':  return { pos: { row, col: Math.max(0, col - 1) }, memory };
    case 'ArrowRight': return { pos: { row, col: Math.min(rowLengths[row]! - 1, col + 1) }, memory };
    case 'ArrowUp':
    case 'ArrowDown': {
      const next = key === 'ArrowUp' ? row - 1 : row + 1;
      if (next < 0 || next >= rowLengths.length) return state;
      const remembered = memory[next] ?? 0;
      return { pos: { row: next, col: Math.min(remembered, rowLengths[next]! - 1) }, memory };
    }
    default: return state;
  }
}`,
    },
  ],
  keyTakeaways: [
    'On TV, focus is the cursor: it must always exist, be clearly visible, and move predictably.',
    'Structural (index-based) navigation suits row grids; geometric navigation suits irregular layouts.',
    'Use roving focus so DOM focus, focus styles and assistive tech agree.',
    'Remember the last column per row and restore focus by item identity after Back.',
    'Handle keys cheaply, call preventDefault on handled arrows, and centralise platform key mapping.',
    'On low-power devices: small DOM, transform/opacity animations, minimal re-renders per key press.',
  ],
  prerequisites: ['Accessibility engineering: keyboard and focus management', 'React rendering and performance'],
  prerequisiteWeeks: [2, 18, 30],
  resources: [
    {
      title: 'WAI-ARIA Authoring Practices: Developing a Keyboard Interface',
      url: 'https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/',
      kind: 'docs',
      note: 'Read the section on managing focus within composite components, especially roving tabindex vs aria-activedescendant.',
      minutes: 12,
      verify: true,
    },
    {
      title: 'MDN: HTMLElement.focus()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus',
      kind: 'docs',
      note: 'Read about the `preventScroll` and `focusVisible` options.',
      minutes: 4,
    },
    {
      title: 'Android Developers: Design for TV',
      url: 'https://developer.android.com/design/ui/tv',
      kind: 'docs',
      note: 'Skim the guidance on focus, navigation and layout for TV as a platform-neutral reference for 10-foot principles.',
      minutes: 8,
      verify: true,
    },
    {
      title: 'web.dev: Stick to compositor-only properties and manage layer count',
      url: 'https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count',
      kind: 'article',
      note: 'Why transform and opacity animate cheaply, and why too many layers hurt memory on weak devices.',
      minutes: 6,
      verify: true,
    },
    {
      title: 'Netflix Technology Blog',
      url: 'https://netflixtechblog.com/',
      kind: 'article',
      note: 'Optional general reading: search the blog for posts about TV or device UI engineering and performance. Read for ideas, not as a description of current practice.',
      minutes: 5,
      verify: true,
    },
  ],
  exercise: {
    title: 'Build a D-pad navigable home screen grid with focus memory and restoration',
    scenario:
      'NearBrew is prototyping a TV app for cafés with in-store screens: a home screen with rows ("Near you", "Top rated", "New this week", "Open late") of café tiles. Users navigate with a remote; Enter opens a café detail view; Back returns to the grid exactly where they were.',
    setup: [
      '`npm create vite@latest tv-lab -- --template react-ts`, `cd tv-lab`, `npm install`, `npm install -D vitest`.',
      'Put the `move` function from the example in `src/nav.ts`. Generate four rows of 20 tiles each with stable ids.',
      'Use only the keyboard while testing. Unplug or ignore the mouse; that is the point.',
    ],
    steps: [
      'Write Vitest unit tests for `move`: clamping at row ends, top and bottom rows, memory restored when returning to a row, memory clamped when a row is shorter.',
      'Render the grid. Each tile is a `<button>` with `tabIndex={isFocused ? 0 : -1}` and a ref registered in a `Map` keyed by `rowId:itemId`. Give tiles a large, high-contrast `:focus-visible` style using `transform: scale(1.08)` and an outline, not a box-shadow animation.',
      'Attach one `keydown` handler at the grid container. For arrow keys, call `preventDefault()`, compute the next state with `move`, and call `.focus({ preventScroll: true })` on the new tile via its ref in an effect or directly after updating state.',
      'Keep each row horizontally scrolled so the focused tile stays visible: apply `transform: translateX(...)` to the row track based on the focused column, with a CSS transition on `transform`. Vertically, scroll the page so the focused row is in a consistent position.',
      'On Enter, store `{ rowId, itemId }` of the focused tile and show a detail view (replace the grid). On Escape or Backspace (stand-ins for Back), return to the grid and restore focus by looking up that identity, falling back to the nearest valid position if the item is gone.',
      'Performance pass: open the React Profiler and press Right 10 times. Ensure only the two affected tiles re-render per press (memoise `Tile`, pass `isFocused` as a boolean, keep handlers stable). Throttle CPU 6x and hold the right arrow; movement should keep up.',
      'Render only rows within one row of the viewport and only tiles within a window of the focused column in each row; confirm the DOM tile count stays small.',
    ],
    starter: [
      {
        language: 'tsx',
        title: 'src/Tile.tsx',
        code: `import { memo, forwardRef } from 'react';

type Props = { title: string; isFocused: boolean; onSelect: () => void };

export const Tile = memo(
  forwardRef<HTMLButtonElement, Props>(function Tile({ title, isFocused, onSelect }, ref) {
    return (
      <button
        ref={ref}
        className="tile"
        tabIndex={isFocused ? 0 : -1}
        aria-current={isFocused ? 'true' : undefined}
        onClick={onSelect}
      >
        {title}
      </button>
    );
  }),
);`,
      },
      {
        language: 'css',
        title: 'src/tv.css',
        code: `body { background: #111; color: #eee; font-size: 28px; margin: 0; }
.safe-area { padding: 5vh 5vw; }               /* keep content off the edges */
.row-track { display: flex; gap: 24px; transition: transform 200ms ease-out; will-change: transform; }
.tile { flex: 0 0 280px; height: 160px; border-radius: 8px; border: 0;
        background: #2a2a2a; color: inherit; font-size: inherit;
        transition: transform 150ms ease-out; }
.tile:focus-visible { outline: 4px solid #fff; outline-offset: 4px; transform: scale(1.08); }`,
      },
    ],
    expected: [
      'All `move` tests pass, including memory and clamping cases.',
      'Arrow keys move one clear focus indicator; the page never scrolls on its own and focus never lands on `body`.',
      'Moving down then back up returns to the column you left in the original row.',
      'Back from the detail view returns focus to the exact tile that was selected.',
      'The Profiler shows two tile renders per arrow press, and held arrow keys remain responsive under CPU throttling.',
    ],
    hints: [
      'Keep the canonical focus state in a reducer or ref; derive `isFocused` per tile as a boolean so memoised tiles skip renders.',
      'Focus after render: set state, then in a `useLayoutEffect` keyed on the position, call `focus({ preventScroll: true })` on the ref.',
      'For translateX, compute `-(col * (tileWidth + gap))` and clamp so the last tiles do not leave empty space.',
      'If the focused item disappears after returning (data refreshed), fall back to the same row and nearest column; never to nothing.',
    ],
    verification: [
      'You can complete a full navigation journey (down three rows, right five, Enter, Back, up one) without touching the mouse, and focus is where you expect at each step.',
      'Unit tests document the navigation policy.',
      'A Profiler screenshot or note shows per-press render counts.',
    ],
  },
  successChecklist: [
    'Navigation logic is a pure function with unit tests',
    'Roving focus: exactly one tile has tabIndex 0 and real DOM focus',
    'Per-row focus memory works and is clamped to row length',
    'Focus is restored by identity after Back, with a sensible fallback',
    'Handled arrow keys call preventDefault and the page never scrolls unexpectedly',
    'Only affected tiles re-render per key press; animations use transform and opacity',
    'Only nearby rows and tiles are in the DOM',
  ],
  questions: [
    {
      question: 'Why use roving focus with real DOM focus rather than just highlighting a "selected" tile with a CSS class?',
      answer:
        'With roving focus, the element the user is on is the actual focused element, so `:focus-visible` styling, keyboard events, and assistive technology (screen readers that platforms often provide on TVs too) all agree about where the user is. A purely visual highlight leaves DOM focus somewhere else, often on `body`, so Enter may activate nothing, screen readers announce the wrong thing, and any other focusable element can steal input. Roving focus also gives a single, predictable entry point when focus moves into a group, because only one item has `tabIndex={0}`. The cost is calling `focus()` and managing refs, which is small.',
    },
    {
      question: 'Explain focus memory and focus restoration and how you would implement each robustly.',
      answer:
        'Focus memory is remembering, per row (or region), the last focused position so returning to that row lands where the user left it rather than at the start. Implement it as a map from row id to the last column, update it when leaving a row, and clamp it when the row has fewer items. Focus restoration is returning focus to the originating element after a modal or detail page closes. Store an identity such as row id plus item id before leaving, because indices can shift if data refreshes, and on return look up the element, falling back to the nearest valid tile in the same row if it is gone. Both should be tested as pure logic separate from rendering.',
    },
    {
      question: 'What makes a focus change expensive on a low-powered TV device, and how do you keep it cheap?',
      answer:
        'Each key press can trigger a React render, DOM updates, style recalculation, layout, paint and compositing. It gets expensive when focus state sits high in the tree and re-renders every row, when the focus effect animates layout-affecting properties like width or margin, when heavy effects like large shadows or blurs must be repainted, and when the DOM is large. Keep it cheap by making only the old and new tiles re-render (memoised tiles with boolean props), animating `transform` and `opacity`, rendering only nearby rows and tiles, using appropriately sized images, and doing no data work in the key handler. Hold-to-repeat makes these costs add up quickly, so test with CPU throttling and on the slowest real device.',
    },
  ],
  explainPrompt:
    'Explain to an interviewer for a TV/product UI role how you designed focus management for a row-based home screen and how you kept it fast on weak hardware. Be specific about the policies you chose.',
  rubric: [
    'Explains why focus is the primary interaction model on TV',
    'Justifies structural vs geometric navigation for this layout',
    'Describes roving focus, per-row memory and identity-based restoration precisely',
    'Covers key handling details (preventDefault, repeat, platform key mapping)',
    'Gives concrete low-power performance measures and how they were measured',
    'Avoids unverified claims about any specific company\'s implementation',
  ],
  referenceExplanation:
    'On a TV there is no pointer, so focus is the user\'s cursor: it must always exist, be obvious from across the room, and move predictably. For a home screen of rows I chose structural navigation: the screen is modelled as rows of items, and a pure `move` function maps the current position and a key to the next position. That makes behaviour predictable and unit-testable, unlike geometric scoring, which I would reserve for jumping between irregular regions such as a side menu and the grid. I use roving focus, so exactly one tile is focusable and actually holds DOM focus, which keeps focus styles, Enter handling and screen readers in sync. Each row remembers its last column, so going down and back up returns you to where you were, clamped if a row is shorter. Before opening a detail page I store the row and item ids, not indices, and on Back I restore focus to that tile, falling back to the nearest one if data changed. Keys go through one handler: arrows call `preventDefault` so the browser does not scroll, and a small mapping module handles platform-specific Back keys. For performance, the main risk is that each press re-renders the whole screen. Tiles are memoised with a boolean `isFocused`, so only two re-render per press; rows move with `transform` so animation stays on the compositor; and only nearby rows and tiles are in the DOM. I verified with the React Profiler and by holding an arrow key under 6x CPU throttling, and I would confirm on the slowest real device.',
  stretch: {
    title: 'Geometric navigation between regions',
    description:
      'Add a left-hand vertical menu. Implement a small geometric resolver: on ArrowLeft from column 0, find the menu item whose vertical centre is closest to the focused tile using `getBoundingClientRect`, and on ArrowRight from the menu, return to the remembered tile. Compare predictability with the structural model and write down when each is the right choice.',
  },
  lightTask:
    'Implement and unit-test the pure `move` function with per-row memory and clamping, then render a minimal two-row grid where arrow keys move real DOM focus with roving tabIndex.',
  intensiveExtras: [
    'Add long-press acceleration: when an arrow is held, move faster after 500 ms and verify it stays smooth under CPU throttling.',
    'Add a hero area above the rows that previews the focused café, updated with a short delay so rapid navigation does not trigger work on every press.',
    'Test the grid with a screen reader (VoiceOver or NVDA) and adjust labels so each tile announces row name, position and café name.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['consumer-ui', 'accessibility', 'rendering-performance'],
  depth: 'standard',
};

const week32: Lesson = {
  week: 32,
  slug: 'api-evolution-versioning-deprecation',
  title: 'API evolution: versioning, backward compatibility, contracts, deprecation',
  track: 'backend',
  topics: [
    'backward compatibility',
    'breaking changes',
    'API versioning',
    'tolerant reader',
    'expand and contract',
    'consumer-driven contracts',
    'deprecation',
    'Sunset header',
  ],
  objective:
    'By the end you can classify API changes as breaking or compatible, evolve a live API with expand-and-contract instead of a big-bang version, protect consumers with contract tests, and run a measured deprecation.',
  whyItMatters:
    'Once an API has consumers you do not deploy in lockstep with, such as mobile apps that users update weeks later, partner integrations, or other teams\' services, every change is a negotiation with code you cannot see. Mobile is especially unforgiving: an old NearBrew app version may call your API for months. Teams that evolve APIs safely ship faster because they rarely need coordinated releases.',
  explanation: [
    'A change is **backward compatible** if every existing, correctly written client keeps working without changes. Typically safe: adding a new endpoint, adding an optional request field, adding a response field, adding a new optional query parameter. Typically **breaking**: removing or renaming a field, changing a type (`price: 4.5` to `price: "4.50"`), making an optional field required, changing meaning (a `distance` that switches from miles to km is breaking even though the schema is identical), changing default sort or pagination behaviour, tightening validation, and changing error codes clients branch on. Adding an enum value is the subtle one: it is compatible only if clients handle unknown values, which many generated clients and `switch` statements do not.',
    'Compatibility is a two-sided contract. Servers should follow **"be conservative in what you send"**; clients should be **tolerant readers**: ignore unknown fields, treat unknown enum values with a sensible default, and only depend on the fields they use. On the server side, the default evolution technique is **expand and contract** (also called parallel change): first add the new shape alongside the old (expand), migrate consumers, measure that the old shape is unused, then remove it (contract). For a rename from `opening_hours` (a string) to `openingHours` (structured), you ship both for a period, write both, read the new one, and track usage of the old.',
    '**Versioning** is the escape hatch when a change cannot be made compatibly. Common strategies are a URL prefix (`/v2/cafes`), a header or media type (`Accept: application/vnd.nearbrew.v2+json`), or date-based versions pinned per client (an approach some well-known public APIs use, where each account is pinned to the version current when it integrated and the server translates responses through a chain of version transforms). URL versions are easy to see, route and cache; header versions keep URLs stable but are less visible. Whichever you choose, every version is a product you must run, test and secure, so the goal is to version rarely and evolve compatibly most of the time. Versioning the whole API for one field change is usually a mistake; a new field or a new endpoint is cheaper.',
    '**Contracts** make compatibility testable. An OpenAPI schema documents the shape, and a diff tool in CI can flag removed fields or changed types. **Consumer-driven contract testing** goes further: each consumer records the requests it makes and the fields it relies on, and the provider\'s CI verifies it still satisfies every consumer\'s contract (Pact is the well-known tool). This catches the breaking change before deploy, and it tells you who depends on a field, which schema diffs cannot.',
    '**Deprecation** is a process, not a comment. Announce the change with a timeline, mark it in docs and the schema (`deprecated: true` in OpenAPI), signal it at runtime (the `Sunset` HTTP header from RFC 8594 communicates the planned removal date; a `Deprecation` header has also been standardised by the IETF), and most importantly **measure usage** per client and app version through logs or metrics. Remove only when usage is at or near zero, or when the remaining clients have been contacted. For mobile, pair this with a minimum-supported-version mechanism: the API can return a specific error that tells old app versions to prompt for update, which is better than them breaking in confusing ways.',
  ],
  examples: [
    {
      language: 'json',
      title: 'Expand phase: old and new fields served side by side',
      code: `{
  "id": "cafe_812",
  "name": "Bean There",
  "opening_hours": "Mon-Fri 07:00-18:00",
  "openingHours": [
    { "day": "mon", "opens": "07:00", "closes": "18:00" },
    { "day": "tue", "opens": "07:00", "closes": "18:00" }
  ],
  "status": "open"
}`,
    },
    {
      language: 'http',
      title: 'Signalling deprecation at runtime',
      code: `HTTP/1.1 200 OK
Content-Type: application/json
Sunset: Sat, 31 Jan 2027 23:59:59 GMT
Link: <https://api.nearbrew.example/docs/migrations/opening-hours>; rel="sunset"`,
    },
  ],
  keyTakeaways: [
    'Breaking means an existing correct client stops working; semantic changes count even if the schema is unchanged.',
    'New enum values break clients that are not tolerant readers; design clients to handle unknowns.',
    'Default to expand and contract; version only when compatibility is impossible.',
    'Every version is a product to run; avoid versioning the whole API for one change.',
    'Consumer-driven contracts catch breaks before deploy and tell you who depends on what.',
    'Deprecate with dates, runtime signals and usage metrics; remove when usage is gone.',
  ],
  prerequisites: ['REST API design', 'TypeScript for domain modelling (handling unknown at boundaries)'],
  prerequisiteWeeks: [3, 6],
  resources: [
    {
      title: 'Martin Fowler: Parallel Change',
      url: 'https://martinfowler.com/bliki/ParallelChange.html',
      kind: 'article',
      note: 'Short piece describing expand, migrate and contract. Read it fully.',
      minutes: 5,
    },
    {
      title: 'Ian Robinson: Consumer-Driven Contracts (on martinfowler.com)',
      url: 'https://martinfowler.com/articles/consumerDrivenContracts.html',
      kind: 'article',
      note: 'Read the sections on provider contracts vs consumer contracts and the tolerant reader idea.',
      minutes: 15,
    },
    {
      title: 'RFC 8594: The Sunset HTTP Header Field',
      url: 'https://datatracker.ietf.org/doc/html/rfc8594',
      kind: 'docs',
      note: 'Skim the introduction and the header definition; note it signals a resource becoming unresponsive at a date.',
      minutes: 5,
    },
    {
      title: 'Stripe blog: APIs as infrastructure, future-proofing Stripe with versioning',
      url: 'https://stripe.com/blog/api-versioning',
      kind: 'article',
      note: 'A detailed public example of date-based versioning with per-account pinning and version transformation layers.',
      minutes: 12,
      verify: true,
    },
    {
      title: 'Pact documentation',
      url: 'https://docs.pact.io/',
      kind: 'docs',
      note: 'Read the introduction and "How Pact works" to see the consumer/provider verification flow.',
      minutes: 8,
      verify: true,
    },
  ],
  exercise: {
    title: 'Evolve the NearBrew café API without breaking old app versions',
    scenario:
      'The NearBrew mobile app v1 reads `opening_hours` as a free-text string and a `status` enum of `open | closed`. Product wants structured opening hours and a new status `closing_soon`. Analytics show 30% of users are still on v1 and will be for months. You will ship the change compatibly, prove it with a contract test, and plan the deprecation.',
    setup: [
      'Node 18+. `mkdir api-evolution && cd api-evolution && npm init -y && npm install express && npm install -D typescript tsx vitest @types/express`.',
      'Save the server starter as `server.ts` and run it with `npx tsx server.ts`.',
    ],
    steps: [
      'Classify each proposed change on paper as compatible or breaking, with a reason: replacing `opening_hours` with an array; adding `openingHours`; adding `closing_soon` to `status`; renaming `rating` to `averageRating`; changing default sort from distance to rating.',
      'Write `clientV1.ts`: a strict v1 client that parses the response and throws on an unknown `status` (simulate a naive generated client). Write `clientV2.ts` as a tolerant reader that maps unknown statuses to `unknown`.',
      'Expand: add `openingHours` alongside `opening_hours`. For `status`, keep returning `open` to clients that do not declare support and return `closing_soon` only when the request sends a capability, for example `?statusVersion=2` or an `X-Client-Capabilities: status-v2` header. Explain why you did not just add the enum value.',
      'Write a consumer contract test in Vitest for v1: start the server, call `/cafes/812`, and assert only on the fields and values v1 relies on (`opening_hours` is a string, `status` is one of the v1 values). Run it in CI style (`npx vitest run`) against your expanded server; it must pass.',
      'Add usage tracking: log a counter of requests that read the legacy shape, keyed by `User-Agent` app version (e.g. `NearBrew/1.4.2`). Add `Sunset` and `Link` headers to responses served in the legacy mode.',
      'Write a deprecation plan in `DEPRECATION.md`: announcement date, sunset date, the metric threshold for removal, the minimum-supported-version error the API will return after the sunset, and who signs off.',
      'Contract: on a branch, remove `opening_hours` and run the v1 contract test to see it fail. That failure is what prevents an accidental early removal.',
    ],
    starter: [
      {
        language: 'ts',
        title: 'server.ts',
        code: `import express from 'express';

const app = express();

type Hours = { day: string; opens: string; closes: string }[];
const cafe = {
  id: 'cafe_812',
  name: 'Bean There',
  hours: [
    { day: 'mon', opens: '07:00', closes: '18:00' },
    { day: 'tue', opens: '07:00', closes: '18:00' },
  ] as Hours,
  closesInMinutes: 20,
  rating: 4.6,
};

function legacyHours(h: Hours): string {
  return h.map((d) => d.day + ' ' + d.opens + '-' + d.closes).join(', ');
}

app.get('/cafes/:id', (req, res) => {
  const supportsStatusV2 = req.get('X-Client-Capabilities')?.includes('status-v2') ?? false;
  const status = cafe.closesInMinutes <= 30 && supportsStatusV2 ? 'closing_soon' : 'open';
  // TODO: add openingHours, Sunset/Link headers for legacy clients, usage logging by User-Agent
  res.json({
    id: cafe.id,
    name: cafe.name,
    opening_hours: legacyHours(cafe.hours),
    status,
    rating: cafe.rating,
  });
});

app.listen(3000, () => console.log('API on http://localhost:3000'));`,
      },
    ],
    expected: [
      'Your classification marks the enum addition and default sort change as breaking for strict clients, and the new field as compatible.',
      'The strict v1 client keeps working against the expanded server; the tolerant v2 client receives `closing_soon` when it sends the capability.',
      'The v1 contract test passes with the expanded server and fails when `opening_hours` is removed.',
      'Logs show legacy-shape usage counts per app version, and legacy responses carry a `Sunset` header.',
    ],
    hints: [
      'A semantic change with the same schema (default sort) is breaking because client behaviour depends on it.',
      'Assert only on what the consumer uses; contract tests that assert on every field make every addition look breaking.',
      'Express exposes headers through `req.get()`; set response headers with `res.set()` before `res.json()`.',
      'For removal criteria, use both a threshold and a date; a threshold alone may never be reached.',
    ],
    verification: [
      'Both clients run successfully against the server and you can show the different `status` values each receives.',
      'You have a failing contract test run captured from the removal branch.',
      'Your deprecation plan names a metric, a threshold, dates, and a fallback for remaining old clients.',
    ],
  },
  successChecklist: [
    'Classified changes, including semantic and enum changes, as breaking or compatible with reasons',
    'Shipped an expand phase serving old and new shapes',
    'Gated a new enum value behind a client capability',
    'Wrote a consumer contract test that fails on a real breaking change',
    'Added Sunset headers and per-version usage metrics',
    'Wrote a dated deprecation plan with removal criteria',
  ],
  questions: [
    {
      question: 'Is adding a new value to a response enum a breaking change? How would you roll it out?',
      answer:
        'It depends on the clients. If every consumer is a tolerant reader that maps unknown values to a default, it is compatible; but many generated clients, exhaustive `switch` statements, and strict validation throw or misbehave on unknown values, so for those it is breaking. For clients you cannot update quickly, such as old mobile app versions, gate the new value behind a capability the client declares (a header, query parameter, or API version) and keep sending a legacy-compatible value otherwise. Going forward, make tolerant handling of unknown enum values a rule in client code and document that enums may grow.',
    },
    {
      question: 'Compare URL versioning with expand-and-contract. When is a new version justified?',
      answer:
        'URL versioning (`/v2/...`) creates a parallel API surface that must be maintained, tested, secured and documented alongside the old one, often for years; it is easy to route and see but expensive. Expand and contract evolves a single API by adding the new shape next to the old, migrating consumers, and removing the old once unused, which avoids parallel surfaces for most changes. A new version is justified when a change cannot be made compatibly across many endpoints at once, for example a fundamental change to the resource model, authentication scheme, or error format, so that per-field evolution would be messier than a clean break.',
    },
    {
      question: 'What do consumer-driven contract tests give you that an OpenAPI schema diff does not?',
      answer:
        'A schema diff tells you the shape changed, but not whether anyone cares; it flags removing an unused field just as loudly as removing a critical one, and it misses semantic changes that keep the schema identical. Consumer-driven contracts encode what each real consumer actually requests and relies on, and the provider verifies them in CI, so a change that breaks a specific consumer fails before deploy and names that consumer. They also document dependencies, which is exactly what you need when deciding whether a field can be removed. They do require consumers to maintain their contracts and a way to share them, such as a broker.',
    },
  ],
  explainPrompt:
    'Explain to a mobile engineer on the NearBrew team why the backend will not simply rename `opening_hours` next sprint, and walk them through the plan and what you need from them.',
  rubric: [
    'Explains why old app versions make breaking changes dangerous',
    'Describes expand and contract concretely for this field',
    'Explains tolerant reader expectations for the mobile client (unknown fields and enum values)',
    'Mentions contract tests and usage metrics as gates for removal',
    'Gives a timeline with a clear ask of the mobile team',
  ],
  referenceExplanation:
    'If we renamed `opening_hours` next sprint, every user still on an app version that reads it would see broken café pages, and we cannot force those users to update. About 30% are on v1 today. So we will use expand and contract. In the next release the API returns both: the old `opening_hours` string, unchanged, and a new structured `openingHours` array. Nothing breaks, and you can move the app to the new field whenever it suits your release. For the new `closing_soon` status we are being more careful, because the v1 app throws on unknown status values; we will only send it when the app includes a capability header, which we need you to add in the next app version, along with handling any unknown status as a neutral default so future values never crash the app. To make sure nobody removes the old field early, we have a contract test that encodes exactly what v1 reads; deleting the field fails CI. We are also logging which app versions still read the old shape and adding a Sunset header with a date. When usage of the legacy shape drops below an agreed threshold and the sunset date has passed, we will remove it, and old versions will get a clear "please update" error via the minimum-version check instead of a broken screen. What I need from you: adopt `openingHours`, send the capability header, make enum handling tolerant, and tell us the app version that ships it so we can track adoption.',
  stretch: {
    title: 'Date-pinned versions with transformers',
    description:
      'Implement a tiny version-transform chain: the server produces the latest response shape, and a list of `{ version, downgrade(response) }` transforms is applied in reverse order until reaching the client\'s pinned version (from a header). Add two historical changes and test that each pinned version receives its original shape.',
  },
  lightTask:
    'Classify the five proposed changes as breaking or compatible with one-line reasons, then add `openingHours` alongside `opening_hours` in the starter and write the v1 contract test that asserts only on fields v1 uses.',
  intensiveExtras: [
    'Write an OpenAPI 3 spec for the endpoint, mark `opening_hours` as `deprecated: true`, and run an OpenAPI diff tool between the two specs.',
    'Set up Pact (JS) for the v1 client and verify the provider against the generated pact file.',
    'Implement a minimum-supported-version middleware that returns a specific error code and update URL for app versions below a threshold.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['api-design', 'backend-services', 'feature-ownership'],
  depth: 'standard',
};

const week33: Lesson = {
  week: 33,
  slug: 'trade-offs-architecture-decision-records',
  title: 'Trade-off analysis and Architecture Decision Records',
  track: 'senior',
  secondaryTracks: ['system-design'],
  topics: [
    'trade-off analysis',
    'architecture decision records',
    'ADR',
    'decision criteria',
    'reversibility',
    'options analysis',
    'consequences',
  ],
  objective:
    'By the end you can frame a technical decision with explicit criteria and options, evaluate trade-offs honestly including reversibility and cost, and record the outcome in a concise ADR that a future teammate can understand.',
  whyItMatters:
    'Senior engineers are trusted with decisions whose consequences last years: which database, whether to add a cache, sync vs async integration. The value is not always in picking the perfect option but in making the reasoning visible, so others can challenge it now and understand it later. Teams without decision records relitigate the same debates and cannot tell intentional constraints from accidents.',
  explanation: [
    'Every meaningful technical choice trades something for something else: latency for consistency, flexibility for simplicity, speed of delivery for operational cost. Saying "there are trade-offs" is not analysis. Analysis means stating the **decision** precisely, the **drivers** (the requirements and constraints that matter here, ideally with numbers: "p95 nearby search under 300 ms", "two backend engineers", "must run on our existing Postgres"), at least two real **options** including "do nothing" or "the simplest thing", and how each option scores against the drivers, with the **consequences** you will live with.',
    'A useful lens is **reversibility**. Some decisions are cheap to undo (a library behind an interface, a feature flag, a config value); others are expensive (a primary datastore, a public API shape, a data model with millions of rows). Spend analysis effort in proportion to the cost of being wrong times the cost of reversing. For reversible decisions, pick quickly, time-box, and set a review trigger. For one-way doors, prototype the riskiest assumption first, for example load-test the query that would justify a new datastore, before writing the comparison table.',
    'Common analysis traps: comparing a polished favourite against a straw-man alternative; listing pros and cons without weighting them by the drivers; ignoring operational cost (on-call, upgrades, backups, skills on the team); ignoring the cost of integration and migration; and **résumé-driven** choices that optimise for novelty. A strong analysis is honest about what the chosen option makes worse. If your write-up has no meaningful negative consequences, you have not looked hard enough.',
    'An **Architecture Decision Record** captures one decision in a short document stored with the code (often `docs/adr/0007-use-postgres-for-nearby-search.md`). Michael Nygard\'s widely used format, from his 2011 post that popularised the practice, has a title, **Status** (proposed, accepted, deprecated, superseded), **Context** (the forces at play, stated neutrally), **Decision** (in active voice: "We will…"), and **Consequences** (good, bad, and neutral, all of them). ADRs are short, typically one or two pages, numbered sequentially, and immutable once accepted: if you change your mind, write a new ADR that supersedes the old one and update the old one\'s status. That history is the point: it shows what the team knew at the time.',
    'ADRs are not design docs. A design doc (week 12) explores a feature broadly and may contain several decisions; an ADR records one decision and why. In practice a design doc review often produces two or three ADRs. Keep the bar low enough that people write them: record decisions that are costly to reverse, that someone might reasonably question later ("why are we not using Elasticsearch?"), or that constrain other teams. Review them like code, in pull requests, which gives a natural place for challenge and an audit trail.',
  ],
  examples: [
    {
      language: 'text',
      title: 'ADR in the Nygard format (abbreviated)',
      code: `ADR 0007: Use PostgreSQL with PostGIS for nearby café search

Status: Accepted (2026-05-04)

Context
NearBrew needs "cafés within 2 km, open now, sorted by distance" for ~40k cafés,
p95 under 300 ms at launch traffic (~50 req/s peak). We run Postgres 16 already.
Two backend engineers; no one has operated Elasticsearch in production.
Options considered: (1) PostGIS GiST index on location, (2) Elasticsearch geo
queries synced from Postgres, (3) geohash prefix column with a B-tree index.

Decision
We will use PostGIS geography columns with a GiST index and ST_DWithin queries,
filtering opening hours in SQL. A prototype on 40k rows measured p95 of 38 ms.

Consequences
+ No new datastore to run, back up, or keep in sync.
+ Search results are transactionally consistent with café edits.
- Full-text relevance ranking is weaker than a search engine; revisit if
  product adds free-text search (trigger: search requirement or >500 req/s).
- Adds the PostGIS extension to our upgrade checklist.
Supersedes: none.`,
    },
  ],
  keyTakeaways: [
    'Analysis = decision, drivers with numbers, real options (including the simplest), scored consequences.',
    'Scale effort to cost of being wrong times cost of reversing; prototype the riskiest assumption for one-way doors.',
    'Include operational and migration costs, and be honest about what your choice makes worse.',
    'An ADR records one decision: Title, Status, Context, Decision, Consequences.',
    'ADRs are immutable once accepted; supersede rather than edit.',
    'Write ADRs for costly-to-reverse or likely-to-be-questioned decisions, and review them in PRs.',
  ],
  prerequisites: ['Writing a technical design document', 'Code review as a senior engineer'],
  prerequisiteWeeks: [12, 20],
  resources: [
    {
      title: 'Michael Nygard: Documenting Architecture Decisions',
      url: 'https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions',
      kind: 'article',
      note: 'The original post that defined the lightweight ADR format. Read all of it; it is short.',
      minutes: 8,
      verify: true,
    },
    {
      title: 'adr.github.io: Architectural Decision Records',
      url: 'https://adr.github.io/',
      kind: 'docs',
      note: 'Overview of ADR practice, templates (including MADR) and tooling. Compare one alternative template with Nygard\'s.',
      minutes: 8,
      verify: true,
    },
    {
      title: 'Martin Fowler: Architecture Decision Record (bliki)',
      url: 'https://martinfowler.com/bliki/ArchitectureDecisionRecord.html',
      kind: 'article',
      note: 'Short summary of what goes in an ADR and how teams use them alongside code.',
      minutes: 5,
      verify: true,
    },
    {
      title: 'Joel Parker Henderson: architecture-decision-record (examples and templates)',
      url: 'https://github.com/joelparkerhenderson/architecture-decision-record',
      kind: 'docs',
      note: 'Browse two or three example ADRs to calibrate length and tone.',
      minutes: 9,
      verify: true,
    },
  ],
  exercise: {
    title: 'Decide and record: how should NearBrew deliver "café is getting busy" updates?',
    scenario:
      'Product wants the NearBrew app to show live busyness for a café a user is viewing, updated within about 30 seconds. Options on the table are client polling every 15 s, Server-Sent Events, WebSockets, or push notifications. The team is small, the API runs behind a standard load balancer, and the mobile app is React Native. You will run a structured trade-off analysis and write ADRs.',
    setup: [
      'Paper, a whiteboard, or a Markdown file in a scratch repo. Create `docs/adr/` and copy the Nygard template from the example.',
      'Optional: Node 18+ to prototype the riskiest assumption.',
    ],
    steps: [
      'Write the decision as one question, then list 4 to 6 drivers with numbers where possible: freshness (30 s), expected concurrent viewers (assume 2,000 at peak), battery and data impact on mobile, infrastructure you already run (load balancer idle timeouts, stateless API instances from week 19), team skills, and cost.',
      'List options: polling, SSE, WebSockets, push notifications, and "do nothing / show last-updated time". For each, write one line on how it would work in NearBrew\'s stack.',
      'Build a comparison table: rows are options, columns are drivers. Fill each cell with a short, specific statement, not a score alone (e.g. "2,000 viewers × 1 req/15 s ≈ 133 req/s, cacheable for 10 s at the edge").',
      'Mark each option\'s reversibility and its riskiest assumption. Pick the assumption that would most change the decision and test or estimate it (for example: compute polling load and cache hit ratio, or check how your load balancer handles long-lived connections).',
      'Choose. Write ADR 0001 in Nygard format, at most one page. Consequences must include at least two negatives and a revisit trigger.',
      'Write ADR 0002 for a smaller follow-on decision the first one forced (for example, the cache TTL for the busyness endpoint, or how the app pauses updates when backgrounded).',
      'Swap roles: write three hard review comments on your own ADR 0001 as a sceptical reviewer would, then answer or amend.',
    ],
    starter: [
      {
        language: 'text',
        title: 'docs/adr/template.md',
        code: `ADR NNNN: <short noun phrase of the decision>

Status: Proposed | Accepted (date) | Superseded by ADR NNNN

Context
<Forces at play, stated neutrally. Requirements with numbers. Constraints.
Options considered, one line each.>

Decision
We will <decision in active voice>, because <the deciding drivers>.

Consequences
+ <what gets easier>
- <what gets harder or riskier>
~ <neutral changes, follow-on decisions>
Revisit if: <specific, observable trigger>`,
      },
    ],
    expected: [
      'A comparison table where every cell says something specific to NearBrew\'s context, with at least one quantified estimate.',
      'A clearly stated riskiest assumption with the result of testing or estimating it.',
      'ADR 0001 under one page, with a decision in active voice and at least two honest negative consequences and a revisit trigger.',
      'ADR 0002 that is clearly scoped to one smaller decision.',
      'Three review comments with responses, showing the reasoning survived challenge or was improved.',
    ],
    hints: [
      'With a 30 s freshness requirement, simple polling with HTTP caching is a serious option; do not dismiss it because it is unglamorous.',
      'Long-lived connections interact with load balancer idle timeouts, deploys (connection draining) and horizontal scaling; include these in the WebSocket and SSE cells.',
      'Push notifications are for users not looking at the screen; ask whether they meet this requirement at all.',
      'If you cannot name a negative consequence, ask "what will on-call hate about this?"',
    ],
    verification: [
      'A teammate (or you, a week from now) can read ADR 0001 in three minutes and explain why the other options lost.',
      'Every driver in the context section is addressed in the decision or consequences.',
      'The ADR states when it should be revisited, in observable terms.',
    ],
  },
  successChecklist: [
    'Stated the decision as a single question with quantified drivers',
    'Compared at least four options including the simplest one',
    'Identified and tested or estimated the riskiest assumption',
    'Wrote an ADR in Nygard format with honest negative consequences',
    'Included a concrete revisit trigger',
    'Responded to self-review challenges',
  ],
  questions: [
    {
      question: 'What belongs in the Context section of an ADR, and what is a common mistake there?',
      answer:
        'Context describes the forces that shape the decision: requirements, constraints, team and operational realities, and the options considered, stated as neutrally and factually as possible, with numbers where available. A future reader should be able to understand the situation without having been in the meeting. The common mistake is writing the context to justify a decision already made, framing the alternatives as obviously bad or omitting the drivers that favour them. Another mistake is omitting constraints that seem obvious today, like team size or existing infrastructure, which are exactly what a future reader will not know.',
    },
    {
      question: 'Why are accepted ADRs treated as immutable, and how do you handle changing your mind?',
      answer:
        'The value of an ADR log is a truthful history of what was decided, when, and with what knowledge. If accepted ADRs are edited, the record silently rewrites the past and readers cannot tell whether a decision was a mistake, a reasonable call that became outdated, or never made. When the decision changes, you write a new ADR with its own context explaining what changed, mark it as superseding the old one, and update the old ADR\'s status to "Superseded by ADR N". Small clarifications like typo fixes are fine; changes to the substance are not.',
    },
    {
      question: 'How should reversibility change how much analysis you do before a decision?',
      answer:
        'Effort should scale with the cost of being wrong and the cost of undoing the choice. A reversible decision, like a library behind an interface or a feature-flagged behaviour, should be made quickly, with a time-box and a review trigger, because learning from production is cheaper than analysis. An expensive-to-reverse decision, like a primary datastore, a public API contract, or a data model, deserves more options, explicit criteria, and a prototype of the riskiest assumption before committing. Recognising which type you face also lets you make one-way doors more reversible, for example by putting an adapter in front of a new dependency.',
    },
  ],
  explainPrompt:
    'Explain to your engineering manager, in a one-on-one, why the team should start writing ADRs and how you would keep it lightweight, using the busyness-updates decision as your example.',
  rubric: [
    'States the concrete problem ADRs solve (relitigated debates, lost reasoning)',
    'Describes the format briefly and correctly (Status, Context, Decision, Consequences)',
    'Explains when to write one and when not to',
    'Uses the worked example to show honest trade-offs and a revisit trigger',
    'Proposes a lightweight adoption process (in-repo, reviewed in PRs, immutable)',
  ],
  referenceExplanation:
    'Twice this quarter we spent a meeting re-debating something we had already decided, once on why we do not use Elasticsearch and once on polling versus WebSockets, because nobody could find the original reasoning. ADRs fix that cheaply. An ADR is a one-page Markdown file in the repo with a title, status, context, decision and consequences. Context captures the forces at the time: requirements with numbers, constraints like team size, and the options we looked at. The decision is one sentence in active voice. Consequences list what gets better and, honestly, what gets worse. For live busyness, we need updates within 30 seconds for about 2,000 concurrent viewers. I compared polling, SSE, WebSockets and push. Polling every 15 seconds is about 133 requests per second, and with a 10-second cache it is cheap, works with our stateless servers and load balancer, and needs no new infrastructure. WebSockets give fresher data but add long-lived connections, deploy draining and scaling work we have not done before. So the ADR says we will poll with caching, records that it wastes some requests and is not suitable for sub-second freshness, and says we revisit if product needs updates under five seconds or concurrent viewers pass 20,000. To keep it lightweight: only for decisions that are costly to reverse or likely to be questioned, one page maximum, reviewed in the same PR as the code, and never edited after acceptance; we supersede instead. I expect two or three a month, each taking under an hour.',
  stretch: {
    title: 'Retro-ADRs for an existing system',
    description:
      'Pick three decisions already embedded in NearBrew or a work codebase (for example the state management library, the auth approach, the database). Write retrospective ADRs from what you can reconstruct, mark unknowns explicitly, and note any decision whose context no longer holds and that deserves a new superseding ADR.',
  },
  lightTask:
    'Write a single one-page ADR in Nygard format for the busyness-updates decision, with a comparison of polling vs WebSockets against three quantified drivers and at least two negative consequences.',
  intensiveExtras: [
    'Rewrite ADR 0001 using the MADR template from adr.github.io and compare which format your team would actually use.',
    'Prototype the polling option in Node with an in-memory cache and measure request rate and cache hit ratio for 2,000 simulated clients.',
    'Write an ADR that supersedes ADR 0001 under a changed requirement (5-second freshness) and update the old one\'s status.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['technical-communication', 'system-design', 'feature-ownership'],
  depth: 'standard',
};

export const weeks27to33: Lesson[] = [week27, week28, week29, week30, week31, week32, week33];
