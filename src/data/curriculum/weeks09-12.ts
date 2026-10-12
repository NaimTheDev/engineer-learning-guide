import type { Lesson } from '../types';

const week09: Lesson = {
  week: 9,
  slug: 'incident-investigation-simulated-slowdown',
  title: 'Incident investigation: debugging a simulated production slowdown',
  track: 'senior',
  secondaryTracks: ['backend', 'system-design'],
  topics: [
    'incident response',
    'mitigation and rollback',
    'hypothesis-driven debugging',
    'USE method',
    'RED method',
    'N+1 queries',
    'query plans',
    'status updates',
    'root cause analysis',
  ],
  objective:
    "By the end you can work a production slowdown methodically: stabilise first, bisect by time and deploy, test hypotheses against evidence, and write a clear status update and root-cause summary.",
  whyItMatters:
    "Senior engineers are judged less by whether they know the answer and more by how they behave when nobody does. In an incident, the expensive mistakes are not slow diagnosis but chasing the wrong hypothesis for an hour while users suffer, or 'fixing' a symptom and declaring victory. A repeatable method (mitigate, observe, hypothesise, test, communicate) turns a stressful hour into a predictable process and is exactly the independent judgment that AI tools cannot exercise for you, because they cannot see your dashboards or decide when to roll back.",
  explanation: [
    "The first rule of incident work is **stabilise before you understand**. Your goal in the first 10 minutes is not root cause; it is reducing user impact. If a slowdown began right after a deploy, rolling back (or turning off the feature flag) is usually the cheapest, most reversible action available, and it doubles as an experiment: if latency recovers after rollback, you have strong evidence the deploy was involved. Engineers often resist rolling back because they 'almost understand' the bug. That instinct is wrong. You can keep debugging on staging or with the bad build's logs once users are no longer affected.",
    "Second, establish the shape of the problem with three questions: **what changed, when did it start, and what is affected?** 'What changed' covers deploys, config changes, feature flag flips, traffic shifts (a push notification campaign), dependency upgrades, data growth, and infrastructure events. 'When' should be precise to the minute, read from a latency graph rather than from someone's memory. 'What is affected' means scoping: is it one endpoint or all of them, one region or all, all users or only logged-in ones? An incident that affects only `GET /cafes/:id` but not `GET /cafes/nearby` already rules out 'the database is down' and points to something specific to that code path.",
    "Third, **bisect**. Debugging is a search problem, and binary search beats intuition. Bisect by time (line up the latency inflection against the deploy log to the minute), by deploy (did v2.31.0 contain one change or twelve?), by component (is the time spent in the app, the database, the cache, or an upstream?), and by request (is every request slow, or only cafés with many check-ins?). Distributed tracing makes component bisection easy; without it, structured logs with per-request timings for each dependency call do the same job. The SRE book's chapter on Effective Troubleshooting describes this as repeatedly splitting the system and checking which half contains the fault.",
    "Two complementary checklists help you look at the right numbers. The **RED method** is for services: Rate (requests per second), Errors (error rate), Duration (latency distribution, especially p95/p99). It tells you *which service* is unhealthy from the user's point of view. The **USE method**, from Brendan Gregg, is for resources: for every resource (CPU, memory, disk, network, connection pool, thread pool) check Utilisation, Saturation (queueing, waiting), and Errors. It tells you *where the bottleneck lives*. A classic pattern: RED shows p95 up 13x on one endpoint; USE shows the database connection pool saturated with 40 waiters while database CPU sits at 88%. Saturation is the signal people miss: a pool at 100% utilisation with a queue converts a 5ms query into a 500ms wait.",
    "Form hypotheses explicitly and write them down, each with the **evidence that would confirm or refute it**. 'H1: the new recent check-ins section issues one query per check-in (N+1). Prediction: queries per request jumped from about 1 to about 20 at 14:02. H2: the push campaign at 14:10 overloaded us. Prediction: latency rose at 14:10, not 14:02, and other endpoints are slow too.' Then go look. Good hypotheses are falsifiable and cheap to test; prefer the test you can run in two minutes from a dashboard over the one that needs a new build. Keep a running incident log with timestamps, because memory under stress is unreliable and the log becomes your postmortem timeline.",
    "Be ruthless about **correlation versus causation**. During an incident everything looks suspicious: a traffic bump, a database CPU alarm, a noisy error in the logs that has actually been there for months. Ask of each signal: did it start *before* or *after* the symptom? Is it a cause or a consequence? High database CPU is often a consequence of an application change that sends more or worse queries. A 30% traffic bump cannot by itself explain a 13x latency increase unless something is already saturated. Compare against a baseline (same hour last week) and check whether the 'suspicious' log line also appears on a healthy day.",
    "Performance incidents frequently have **multiple contributing factors** rather than a single root cause. A typical shape: a code change adds an N+1 query pattern; the new query hits a table without a suitable index so each call does a sequential scan; and a cache key change means the cache that used to hide all of this now misses almost every time. Each factor alone might be tolerable; together they saturate the database, and the saturation then makes every other endpoint slower too. A good root-cause summary names the trigger, the contributing factors, and why existing safeguards (tests, load tests, alerts, code review) did not catch it.",
    "Communication is half the job. Status updates should be **regular, factual, and short**: what is impacted, what users experience, what you have done, what you are doing next, and when the next update will come. Avoid speculation presented as fact ('the database is broken'), avoid jargon for non-technical audiences, and always include the time of the next update even if nothing has changed. The SRE book's Managing Incidents chapter recommends separating roles: an incident commander who coordinates and communicates, and operational responders who change things. Even on a small team like NearBrew, explicitly saying 'I'm coordinating, you're investigating' prevents two people rolling back and forward at the same time.",
    "Finally, close the loop. Once mitigated, confirm recovery with the same metric that defined the incident (p95 back to about 180ms, not 'seems fine'). Then fix forward properly: batch the query, add the index with `CREATE INDEX CONCURRENTLY`, fix the cache key, and add a guardrail such as a test that asserts the number of queries per request, or an alert on queries-per-request. The root-cause summary is not about blame; it is about making the same class of failure less likely and faster to detect next time.",
  ],
  examples: [
    {
      language: 'text',
      title: 'A hypothesis log written during the incident',
      code: `14:31  Symptom: GET /cafes/:id p95 180ms -> 2.4s. Started 14:02-14:03 (latency graph).
14:32  Other endpoints: /cafes/nearby p95 120ms -> 410ms (started ~14:06, later than detail).
14:33  Changes in window: deploy v2.31.0 at 14:02; push campaign at 14:10.

H1  New code in v2.31.0 makes café detail slower.
    Predicts: inflection at 14:02, before the push. Detail affected first.
    Evidence: CONFIRMED by graph timing. -> Mitigate: roll back v2.31.0.
H2  Push campaign traffic overloaded the API.
    Predicts: inflection at 14:10; all endpoints degrade together.
    Evidence: REFUTED as trigger (started 8 min earlier). Possible amplifier.
H3  DB is the bottleneck (USE): CPU 88%, pool waiting 40.
    Consequence or cause? Queries/request rose 1.3 -> 23 at 14:02 => consequence of H1.

14:38  Rolled back to v2.30.4. 14:44 p95 = 195ms. Monitoring.`,
    },
    {
      language: 'ts',
      title: 'The N+1 shape and its batched fix',
      code: `// N+1: one query for the list, then one query per item.
const checkins = await db.query(
  'SELECT id, user_id, created_at FROM checkins WHERE cafe_id = $1 ORDER BY created_at DESC LIMIT 20',
  [cafeId],
);
for (const c of checkins.rows) {
  // 20 more round trips, each waiting for a pooled connection
  c.user = (await db.query('SELECT id, name, avatar_url FROM users WHERE id = $1', [c.user_id])).rows[0];
}

// Batched: two queries total, regardless of list size.
const userIds = [...new Set(checkins.rows.map((c) => c.user_id))];
const users = await db.query('SELECT id, name, avatar_url FROM users WHERE id = ANY($1)', [userIds]);
const byId = new Map(users.rows.map((u) => [u.id, u]));
const withUsers = checkins.rows.map((c) => ({ ...c, user: byId.get(c.user_id) }));`,
    },
    {
      language: 'text',
      title: 'A good status update (internal, every 20 minutes)',
      code: `[14:40] INCIDENT: Slow café pages (SEV-2) — update #2
Impact: Café detail screen loading slowly (2-3s instead of <0.3s) for all users since 14:02.
        Nearby search also degraded since ~14:06. No errors or data loss.
Actions: Identified the 14:02 release (v2.31.0) as the likely trigger. Rolled back at 14:38.
Current: Early signs of recovery (p95 now 600ms and falling).
Next: Confirm full recovery; investigate root cause on the rolled-back build.
Next update: 15:00 or sooner if anything changes. IC: Priya. Investigating: Sam.`,
    },
  ],
  keyTakeaways: [
    "Mitigate first (rollback, flag off, scale up); root cause comes after users stop hurting.",
    "Ask what changed, when exactly it started, and what is and is not affected, then bisect.",
    "RED tells you which service is unhealthy; USE tells you which resource is the bottleneck. Look for saturation, not just utilisation.",
    "Write hypotheses with predictions that would refute them, and check timing to separate causes from consequences.",
    "Performance incidents usually have a trigger plus contributing factors; name all of them and why safeguards missed them.",
    "Status updates: impact, actions, current state, next step, next update time. No speculation stated as fact.",
  ],
  prerequisites: [
    'Reading EXPLAIN ANALYZE output and knowing when an index helps (week 1)',
    'REST endpoint structure and request lifecycles (week 3)',
    'Caching, cache keys, and hit rates (week 4)',
  ],
  prerequisiteWeeks: [1, 3, 4],
  resources: [
    {
      title: 'Google SRE Book: Effective Troubleshooting',
      url: 'https://sre.google/sre-book/effective-troubleshooting/',
      kind: 'book',
      note: "Read the troubleshooting process model and the sections on triage, examining the system, diagnosis, and testing/treatment. Pay attention to the 'common pitfalls' list (confusing correlation with causation, latching on to past causes).",
      minutes: 15,
    },
    {
      title: 'Google SRE Book: Managing Incidents',
      url: 'https://sre.google/sre-book/managing-incidents/',
      kind: 'book',
      note: 'Skim the unmanaged-incident story, then read the elements of incident management (roles, command post, live incident state document) and when to declare an incident.',
      minutes: 10,
    },
    {
      title: 'The USE Method (Brendan Gregg)',
      url: 'https://www.brendangregg.com/usemethod.html',
      kind: 'article',
      note: 'Read the summary and the resource list. Translate it to app resources you own: DB connection pool, Node event loop, worker concurrency.',
      minutes: 5,
    },
    {
      title: 'Google SRE Book: Monitoring Distributed Systems',
      url: 'https://sre.google/sre-book/monitoring-distributed-systems/',
      kind: 'book',
      note: "Read 'The Four Golden Signals' (latency, traffic, errors, saturation); it overlaps with RED and USE and is a good mental checklist for dashboards.",
      minutes: 5,
    },
    {
      title: 'PostgreSQL docs: Using EXPLAIN',
      url: 'https://www.postgresql.org/docs/current/using-explain.html',
      kind: 'docs',
      note: 'Refresher for the query plan in the incident pack: Seq Scan vs Index Scan, rows removed by filter, and actual time.',
      minutes: 5,
    },
  ],
  exercise: {
    title: 'Work the NearBrew café detail incident',
    scenario:
      "It is Tuesday 14:25. An alert fires: NearBrew's `GET /v1/cafes/:id` p95 went from 180ms to 2.4s after Tuesday's deploy. You are on call. The incident pack below contains the timeline, log excerpts, a metrics table, the relevant diff, and a slow query plan. Work it as if it were live: mitigate, diagnose, communicate, then write the root-cause summary. Then run a small Node script that reproduces why N+1 queries get dramatically worse under load.",
    setup: [
      'Create a folder `incident-w09` with a `notes.md` (or paper) for your incident log.',
      'Copy the incident pack into `incident-pack.txt` so you can annotate it.',
      'For the reproduction, you only need Node 18+ (no database): save `n-plus-one.mjs` from the starter.',
      'Optional: if you still have the week 1 Docker Postgres running, you can recreate the checkins table to test the index fix.',
    ],
    steps: [
      "Set a 5-minute timer and do triage only: from the pack, write down what changed, when it started (to the minute), and what is and is not affected. Decide on a mitigation and write the exact action you would take and why it is safe (for example 'roll back to v2.30.4; it has no schema migrations, so rollback is reversible').",
      'Write status update #1 for the internal #incidents channel using the structure: impact, actions, current state, next step, next update time. Keep it under 80 words.',
      'Apply RED to the endpoints in the metrics table and USE to the resources (DB CPU, connection pool, cache). Note which signals are causes and which are consequences, using timing to justify each.',
      'Write at least three hypotheses with a prediction that would refute each one (include the push campaign and the database itself). Mark each confirmed, refuted, or contributing based on the pack.',
      'Read the diff carefully and identify every problem it introduces. There are three distinct issues; for each, point to the line and to the metric or log line that proves it matters.',
      'Read the query plan and explain in two sentences why it is slow and what index would fix it. Write the exact `CREATE INDEX CONCURRENTLY` statement.',
      'Run `node n-plus-one.mjs` and record the timings for sequential single requests and for 50 concurrent requests. Explain why the absolute gap between N+1 and batched widens under concurrency (hint: once the pool saturates, every extra query becomes queueing time for every request, including other endpoints).',
      'Write the root-cause summary (200 to 350 words): summary, impact (duration, users affected), trigger, contributing factors, why safeguards did not catch it, mitigation, and 3 to 5 follow-up actions with owners as roles.',
      'Write the final status update announcing resolution, written for a non-technical audience (for example the NearBrew founder or support team).',
    ],
    starter: [
      {
        language: 'text',
        title: 'incident-pack.txt — timeline, logs, metrics',
        code: `=== TIMELINE (Tuesday, all times UTC) ===
13:55  CI green for api v2.31.0 ("Café detail: recent check-ins + favourited flag")
14:02  Deploy v2.31.0 to production (rolling, 3 pods, complete 14:03). No migrations.
14:10  Marketing push campaign "Try a new café this week" sent to 120k users
14:18  PagerDuty: DB CPU > 80% for 5m
14:25  Alert: GET /v1/cafes/:id p95 > 1s for 10m
14:26  Support: "Café pages spinning forever on Android" (3 tickets)

=== LOG EXCERPTS (api, structured, abbreviated) ===
14:01:12 info  GET /v1/cafes/4821 200 dur=152ms db_queries=1 db_ms=8 cache=hit
14:01:13 info  GET /v1/cafes/77 200 dur=41ms db_queries=0 db_ms=0 cache=hit
14:04:40 info  GET /v1/cafes/4821 200 dur=1870ms db_queries=22 db_ms=1790 cache=miss pool_wait_ms=1210
14:04:41 info  GET /v1/cafes/77 200 dur=990ms db_queries=22 db_ms=930 cache=miss pool_wait_ms=610
14:05:02 warn  slow query 431ms: SELECT id, user_id, created_at FROM checkins WHERE cafe_id = $1 ORDER BY created_at DESC LIMIT 20
14:05:03 info  GET /v1/cafes/4821 200 dur=2210ms db_queries=22 db_ms=2150 cache=miss pool_wait_ms=1500
14:06:30 info  GET /v1/cafes/nearby 200 dur=380ms db_queries=1 db_ms=360 pool_wait_ms=330
14:12:09 error Failed to send analytics batch: ECONNRESET (retrying)   <- also seen daily
14:20:44 info  GET /v1/cafes/4821 200 dur=2630ms db_queries=22 db_ms=2580 cache=miss pool_wait_ms=1900

=== METRICS (5-minute averages) ===
window          | detail p95 | nearby p95 | total rps | cache hit | queries/req (detail) | DB CPU | pool in-use/size | pool waiting
Mon 14:00-14:05 |   180ms    |   120ms    |   220     |   94%     |   1.3                |  22%   |   6/20           |   0
Tue 13:55-14:00 |   175ms    |   118ms    |   225     |   94%     |   1.3                |  21%   |   6/20           |   0
Tue 14:03-14:08 |  1900ms    |   300ms    |   230     |    5%     |  22.0                |  71%   |  20/20           |  28
Tue 14:10-14:15 |  2300ms    |   390ms    |   295     |    4%     |  22.1                |  86%   |  20/20           |  37
Tue 14:20-14:25 |  2400ms    |   410ms    |   300     |    4%     |  22.0                |  88%   |  20/20           |  40
Error rate stayed below 0.3% throughout (same as Monday).`,
      },
      {
        language: 'ts',
        title: 'incident-pack.txt — diff in v2.31.0 (src/routes/cafeDetail.ts)',
        code: `   export async function getCafeDetail(req: Request, res: Response) {
     const cafeId = Number(req.params.id);
-    const cacheKey = 'cafe:' + cafeId + ':v3';
+    const cacheKey = 'cafe:' + cafeId + ':user:' + req.user.id + ':v4';
     const cached = await cache.get(cacheKey);
     if (cached) return res.json(cached);

     const cafe = await db.one('SELECT * FROM cafes WHERE id = $1', [cafeId]);
+    const recent = await db.many(
+      'SELECT id, user_id, created_at FROM checkins WHERE cafe_id = $1 ORDER BY created_at DESC LIMIT 20',
+      [cafeId],
+    );
+    for (const c of recent) {
+      c.user = await db.one('SELECT id, name, avatar_url FROM users WHERE id = $1', [c.user_id]);
+    }
+    const isFavourited = await favourites.has(req.user.id, cafeId);
-    const body = { cafe };
+    const body = { cafe, recentCheckins: recent, isFavourited };
     await cache.set(cacheKey, body, { ttlSeconds: 300 });
     res.json(body);
   }`,
      },
      {
        language: 'text',
        title: 'incident-pack.txt — slow query plan (captured 14:30 on a replica)',
        code: `EXPLAIN (ANALYZE, BUFFERS)
SELECT id, user_id, created_at FROM checkins
WHERE cafe_id = 4821 ORDER BY created_at DESC LIMIT 20;

Limit  (cost=148210.33..148212.66 rows=20 width=20) (actual time=418.902..421.517 rows=20 loops=1)
  ->  Gather Merge  (cost=148210.33..148288.12 rows=667 width=20) (actual time=418.900..421.510 rows=20 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        ->  Sort  (cost=147210.31..147211.14 rows=333 width=20) (actual time=411.020..411.024 rows=15 loops=3)
              Sort Key: created_at DESC
              Sort Method: top-N heapsort  Memory: 26kB
              ->  Parallel Seq Scan on checkins  (cost=0.00..147201.45 rows=333 width=20) (actual time=3.114..410.640 rows=63 loops=3)
                    Filter: (cafe_id = 4821)
                    Rows Removed by Filter: 2699937
                    Buffers: shared hit=1932 read=81204
Planning Time: 0.142 ms
Execution Time: 421.601 ms

\\d checkins
 id bigint PK | user_id bigint | cafe_id bigint | created_at timestamptz
Indexes: "checkins_pkey" PRIMARY KEY (id), "checkins_user_id_idx" (user_id)`,
      },
      {
        language: 'js',
        title: 'n-plus-one.mjs — reproduces N+1 vs batched under a connection pool',
        code: `// Run: node n-plus-one.mjs
// Simulates a DB with a fixed-size connection pool. Each query holds a
// connection for QUERY_MS. No real database needed.
const POOL_SIZE = 10;
const QUERY_MS = 4;
const CHECKINS = 20;

let inUse = 0;
const waiters = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquire() {
  if (inUse < POOL_SIZE) { inUse++; return; }
  await new Promise((resolve) => waiters.push(resolve));
  inUse++;
}
function release() {
  inUse--;
  const next = waiters.shift();
  if (next) next();
}
let queryCount = 0;
async function query() {
  await acquire();
  try { queryCount++; await sleep(QUERY_MS); return {}; }
  finally { release(); }
}

async function detailNPlusOne() {
  await query(); // cafe
  await query(); // recent checkins
  for (let i = 0; i < CHECKINS; i++) await query(); // one per check-in user
}
async function detailBatched() {
  await query(); // cafe
  await query(); // recent checkins
  await query(); // users WHERE id = ANY($1)
}

async function measure(label, fn, concurrency) {
  queryCount = 0;
  const durations = [];
  const t0 = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    const s = performance.now();
    await fn();
    durations.push(performance.now() - s);
  }));
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95) - 1] ?? durations[durations.length - 1];
  console.log(
    label.padEnd(28),
    'concurrency=' + String(concurrency).padEnd(4),
    'queries=' + String(queryCount).padEnd(6),
    'p95=' + p95.toFixed(0) + 'ms',
    'wall=' + (performance.now() - t0).toFixed(0) + 'ms',
  );
}

for (const c of [1, 10, 50]) {
  await measure('N+1', detailNPlusOne, c);
  await measure('batched', detailBatched, c);
}
// Things to try: set CHECKINS = 50 (a popular café), or POOL_SIZE = 5.`,
      },
    ],
    expected: [
      'Triage identifies the 14:02 deploy as the trigger because detail latency and queries/request inflect at 14:03, eight minutes before the push campaign.',
      'Mitigation is a rollback (or disabling the feature), chosen within the first few minutes, justified as reversible because v2.31.0 has no migrations.',
      'You find three problems in the diff: the N+1 user lookup in the loop, the new checkins query that sequential-scans because there is no index on cafe_id, and the cache key now including the user id, which collapses the hit rate from 94% to about 4% and also means the shared café data is re-fetched per user.',
      'You classify DB CPU, pool saturation, and the slower nearby endpoint as consequences, the push campaign as an amplifier rather than the trigger, and the ECONNRESET analytics error as noise (it appears daily).',
      'The Node script shows the N+1 path roughly 7x slower at concurrency 1 (about 90ms vs 12ms). At concurrency 50 both paths queue for the 10 connections, and the absolute gap grows to hundreds of milliseconds (about 460ms vs 60ms), because 22 queries per request means 7x more time waiting in the pool queue.',
      'Your root-cause summary names a trigger, contributing factors, why tests and review missed it, and concrete follow-ups.',
    ],
    hints: [
      "Line up three columns: deploy time, detail p95 inflection, push time. Whatever happens first cannot be caused by what happens later.",
      "The cache key change is easy to miss because it looks harmless. Ask: how many distinct keys exist now for one café? Personalised fields like `isFavourited` should be fetched separately from the shared, cacheable café payload.",
      'In the query plan, `Rows Removed by Filter` multiplied by `loops=3` tells you roughly how many rows were scanned to return 20. A composite index on `(cafe_id, created_at DESC)` lets Postgres read the newest 20 rows directly.',
      "In the log lines, `pool_wait_ms` is most of `db_ms`. That is saturation (USE), and it explains why an unrelated endpoint like nearby search also slowed down.",
    ],
    verification: [
      'Your incident log has timestamps, at least three hypotheses with refuting predictions, and a status for each.',
      'Your mitigation decision is written before your diagnosis, not after.',
      'Your index statement is `CREATE INDEX CONCURRENTLY checkins_cafe_created_idx ON checkins (cafe_id, created_at DESC);` or equivalent, and you can explain why CONCURRENTLY matters in production.',
      'You recorded actual numbers from `n-plus-one.mjs` at concurrency 1, 10, and 50 for both variants.',
      'A non-technical reader could understand your final status update without asking what p95 or N+1 means.',
      'Optional: in week 1 Docker Postgres, load about 1M fake check-ins, run the query plan before and after the index, and confirm it switches from a Seq Scan to an Index Scan.',
    ],
  },
  successChecklist: [
    'I chose and justified a mitigation within the first 5 minutes of triage.',
    'I identified all three problems in the diff and tied each to a specific metric or log line.',
    'I separated trigger, contributing factors, amplifiers, consequences, and noise using timing evidence.',
    'I wrote the correct composite index and explained the query plan.',
    'I ran the N+1 script and can explain why concurrency widens the gap.',
    'I wrote two status updates (technical and non-technical) and a root-cause summary with follow-ups.',
  ],
  questions: [
    {
      question:
        'Why should you usually roll back a suspicious deploy before you fully understand the bug, and when might rollback not be the right mitigation?',
      answer:
        "Rollback is typically the fastest, most reversible way to reduce user impact, and it doubles as an experiment: if metrics recover, the deploy was involved. Understanding can continue afterwards using logs, staging, or the bad build, so delaying mitigation to finish diagnosis trades user pain for engineer convenience. Rollback is not right when the deploy included an irreversible change such as a destructive schema migration, when the old version is incompatible with data the new version already wrote, or when evidence clearly points elsewhere (for example the slowdown started before the deploy). In those cases prefer a feature flag off, a targeted hotfix, shedding load, or scaling the saturated resource while you keep investigating.",
    },
    {
      question:
        'In the NearBrew incident, DB CPU hit 88% and nearby search also slowed down. Why are these consequences rather than causes, and how would you prove it?',
      answer:
        "Both started after the café detail regression: queries per request on detail jumped from 1.3 to 22 at 14:03, the connection pool saturated at 20/20 with waiters, and only then did nearby search latency rise (around 14:06). Nearby search issues one query, but its log line shows most of its time was `pool_wait_ms`, meaning it waited behind detail requests for a connection rather than running a slower query. To prove it, check that rollback of the detail change restores both DB CPU and nearby latency without any database change, and compare nearby's query execution time in the database (for example via `pg_stat_statements`) before and during the incident; it should be unchanged while wall time grew.",
    },
    {
      question: 'What is the difference between the RED and USE methods, and how would you apply each to NearBrew?',
      answer:
        "RED (Rate, Errors, Duration) describes a service from the caller's point of view, so you apply it per endpoint: requests per second, error rate, and latency percentiles for `GET /cafes/:id`, `GET /cafes/nearby`, check-in creation, and so on. USE (Utilisation, Saturation, Errors) describes resources, so you apply it to the DB connection pool, database CPU and I/O, the Node event loop, cache memory, and worker concurrency. RED tells you which user-facing thing is broken; USE tells you which resource is the bottleneck. Saturation is the key USE signal for latency incidents because queueing turns small per-operation costs into large waits.",
    },
  ],
  explainPrompt:
    "Explain to a mid-level teammate who has just joined the NearBrew on-call rotation how you would approach a 'the app is slow' alert in the first 30 minutes. Use the café detail incident as your worked example.",
  rubric: [
    'Puts mitigation before diagnosis and explains why that is safe and reversible.',
    'Describes bisecting by time, deploy, component, and request, with concrete examples.',
    'Uses RED for services and USE for resources, and calls out saturation.',
    'Distinguishes trigger, contributing factors, and consequences using timing evidence.',
    'Covers communication: roles, regular status updates with a next-update time.',
    'Mentions closing the loop: confirm recovery with the defining metric and add guardrails.',
  ],
  referenceExplanation:
    "When an alert says something is slow, my first job is to reduce impact, not to be clever. I check three things: what changed (deploys, flags, config, traffic), when the symptom started to the minute, and what is and is not affected. In the café detail incident, p95 jumped at 14:03, one minute after v2.31.0 finished deploying and eight minutes before the push campaign, and only detail was slow at first. That made rollback the obvious mitigation, and since the release had no migrations it was reversible. I would announce in the channel that I am incident commander, ask someone else to do the rollback, and post an update with impact, actions, and when the next update is due. Then I bisect. RED on the endpoints shows which one is unhealthy; USE on resources shows where time goes. Here the pool was 20/20 with 40 waiters and queries per request went from 1.3 to 22, so the database was saturated by our own change. DB CPU and the slower nearby endpoint were consequences, the push was an amplifier, and the analytics ECONNRESET was daily noise. I write hypotheses with predictions that could refute them so I do not chase whatever looks scariest. The diff had three problems: an N+1 user lookup, a checkins query with no `(cafe_id, created_at)` index, and a cache key that included the user id, which dropped hit rate from 94% to 4%. After recovery is confirmed on the same p95 metric, the follow-ups are batching, the index, splitting personalised fields out of the cached payload, and a test or alert on queries per request.",
  stretch: {
    title: 'Add a query-count guardrail',
    description:
      'In any Node or PHP API you own, add middleware that counts DB queries per request and logs `db_queries` and `db_ms`, plus a test helper `expectMaxQueries(n)` that fails a route test if it exceeds a budget. Write the café detail route with the N+1 and prove the test catches it.',
  },
  lightTask:
    'Read the incident pack only and spend 30 minutes writing: (1) the mitigation you would choose and why, (2) the three problems in the diff with the metric that proves each, and (3) a 5-sentence non-technical resolution update.',
  intensiveExtras: [
    'Reproduce the slow query in Docker Postgres: generate 1M+ check-ins across 10k cafés with `generate_series`, capture EXPLAIN ANALYZE before and after `CREATE INDEX CONCURRENTLY`, and compare buffers read.',
    'Refactor the diff into a correct version: cache the shared café payload by `cafe:{id}`, batch user lookups with `ANY($1)`, and fetch `isFavourited` separately per user. Explain the cache invalidation story for new check-ins.',
    'Write a one-page incident runbook for NearBrew: who to page, where dashboards are, how to roll back, status update template, and when to declare SEV-1 vs SEV-2.',
    'Extend `n-plus-one.mjs` to model a cache with a 94% vs 4% hit rate and show how the cache masked the N+1 before the key change.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['production-reliability', 'databases', 'technical-communication', 'feature-ownership'],
  depth: 'detailed',
};

const week10: Lesson = {
  week: 10,
  slug: 'background-jobs-queues-retries-idempotency',
  title: 'Background jobs and queues: a simple queue worker, retries, idempotency, dead letters',
  track: 'system-design',
  secondaryTracks: ['backend'],
  topics: [
    'background jobs',
    'at-least-once delivery',
    'idempotency',
    'visibility timeout',
    'acknowledgement',
    'exponential backoff',
    'jitter',
    'dead-letter queue',
    'poison messages',
    'FOR UPDATE SKIP LOCKED',
    'message ordering',
  ],
  objective:
    'By the end you can build and reason about a Postgres-backed job queue with leases, retries using exponential backoff and jitter, a dead-letter table, and idempotent handlers that are safe under at-least-once delivery.',
  whyItMatters:
    "Almost every product feature eventually needs work that should not happen inside the request: sending emails, generating thumbnails, syncing to a third party, recalculating rewards. Moving work to a queue makes requests fast and resilient, but it introduces a new failure model: jobs run more than once, run out of order, or fail forever. Engineers who understand delivery guarantees and idempotency build features that survive crashes and retries; engineers who do not ship duplicate emails, double rewards, and silent backlogs.",
  explanation: [
    "Why go async at all? A request handler should do the minimum needed to give the user a correct answer and hand the rest to a background worker. When a NearBrew user checks in at a café, the request must record the check-in. Sending a reward email, generating a thumbnail for the attached photo, and updating the café's trending score can all happen a few seconds later. Doing them inline makes the request slow (email providers can take 500ms or more), fragile (if the email provider is down, should the check-in fail?), and hard to scale (a burst of check-ins becomes a burst of outbound calls). A queue decouples **accepting work** from **doing work**, smooths bursts, and lets you retry failures without the user waiting.",
    "The core contract of almost every practical queue is **at-least-once delivery**. A worker takes a job, does the work, and then acknowledges it. If the worker crashes after doing the work but before acknowledging, the queue cannot tell the difference between 'never ran' and 'ran but did not report', so it delivers the job again. 'Exactly-once' delivery across a network is not something you can get from the queue alone; what you can build is **exactly-once effects** by combining at-least-once delivery with idempotent handlers. This is the single most important idea of the week: assume every job will sometimes run twice, and design so that running twice is harmless.",
    "How does the queue know a worker died? Through a **lease**, which SQS calls a visibility timeout. When a worker claims a job, the job becomes invisible to other workers until a deadline (say 30 seconds). If the worker acknowledges before the deadline, the job is done. If the deadline passes, the job becomes visible again and another worker can take it. This is why the timeout must be longer than the job's normal processing time: set it to 10 seconds for a job that takes 20, and every job will be processed twice in parallel. Long jobs can extend their lease with a heartbeat. In our Postgres queue a lease is simply a `locked_until` timestamp on the row.",
    "Postgres can be a perfectly good queue for small to medium workloads, thanks to `SELECT ... FOR UPDATE SKIP LOCKED`. `FOR UPDATE` locks the selected rows; `SKIP LOCKED` tells other transactions to skip rows that are already locked instead of waiting for them. So ten workers running the same 'claim the next job' query each get a *different* job without blocking each other. You can use the lock in two ways. Lock-for-duration: open a transaction, claim with `FOR UPDATE SKIP LOCKED`, do the work, then mark done and commit; if the worker dies, the connection drops, the transaction rolls back, and the job is automatically available again. This is simple, but holds a transaction open for the whole job. Lease: claim and set `locked_until` in one short statement, commit immediately, do the work outside any transaction, then mark done. This keeps transactions short and is closer to how SQS behaves, at the cost of handling expired leases yourself. This week uses the lease model.",
    "**Idempotency** means applying an operation twice has the same effect as applying it once. Some operations are naturally idempotent: 'generate a 400px thumbnail of photo 123 and write it to `thumbs/123_400.webp`' produces the same file however many times it runs. Others are not: 'send a reward email' or 'add 10 points to the user's balance'. To make those safe, record that the effect happened using a unique key derived from the job, for example `UNIQUE (checkin_id, kind)` on an `email_sends` table, and check or insert it in the same transaction as the effect where possible. When the effect is an external call (an email API), you cannot put it in your transaction, so you have a window: send succeeds, then you crash before recording it. Narrow it by recording intent first (status `sending`), passing an idempotency key to the provider if it supports one, and reconciling ambiguous states. Be honest in design reviews about which window remains.",
    "Failures need **retries with exponential backoff and jitter**. Transient failures (a provider timeout, a deadlock, a 503) usually succeed if you try again later, but retrying immediately and in lockstep makes things worse: if the email provider has a blip, a thousand jobs all retry one second later, then two, then four, as a synchronised thundering herd. Exponential backoff spaces attempts out (base times 2 to the power of attempt, capped), and **jitter** randomises each delay so retries spread over time. The 'full jitter' strategy, popularised by an AWS Architecture Blog post, picks a random delay between zero and the capped exponential value. Also classify errors: a 400 'invalid email address' will never succeed, so retrying it five times only wastes work.",
    "Some jobs fail every time: a payload referencing a deleted user, a corrupt image, a bug in the handler. These are **poison messages**. Without a limit, a poison job retries forever, consuming worker time, and in queues that preserve order it can block everything behind it. The standard answer is a **dead-letter queue (DLQ)**: after `max_attempts`, move the job to a separate place with its last error, stop retrying, and alert when the DLQ is non-empty. A DLQ is a to-do list for humans, not a trash can: you need a way to inspect, fix the cause, and re-enqueue (redrive) dead jobs. A growing DLQ that nobody looks at is a silent outage.",
    "**Ordering** is the guarantee people assume and rarely get. With multiple workers, retries, and backoff, job B can complete before job A even if A was enqueued first. Usually that is fine: thumbnails and emails do not care. When it matters (for example 'user favourited then unfavourited a café'), prefer designs that do not depend on order: include a version or timestamp and have the handler ignore stale updates ('last write wins by version'), or make the job carry 'recompute current state' rather than 'apply this delta'. Strict per-key ordering is possible (one worker per partition key, like Kafka partitions or SQS FIFO message groups) but it costs throughput and lets one poison message block its key.",
    "Finally, operate the queue. The metrics that matter are **queue depth** (jobs ready but not running), **age of the oldest ready job** (the best single signal of user-visible delay), processing duration, failure and retry rates, and DLQ size. Alert on oldest-job age and DLQ size rather than raw depth, since depth naturally spikes during bursts. A Postgres queue also needs housekeeping: index the claim query (a partial index on `run_at` where status is queued), delete or archive completed jobs, and watch for table bloat. When you outgrow it (very high throughput, fan-out to many consumers, cross-service events), that is the time to evaluate SQS, RabbitMQ, or Kafka, and week 41 revisits this with the transactional outbox pattern.",
  ],
  examples: [
    {
      language: 'sql',
      title: 'Claiming a job with a lease using FOR UPDATE SKIP LOCKED',
      code: `-- One short statement: pick the next runnable job, lock it so other workers
-- skip it, and set a lease. Commit immediately; do the work outside the txn.
UPDATE jobs
SET status = 'running',
    locked_until = now() + interval '30 seconds',
    attempts = attempts + 1,
    updated_at = now()
WHERE id = (
  SELECT id FROM jobs
  WHERE (status = 'queued' AND run_at <= now())
     OR (status = 'running' AND locked_until < now())   -- expired lease: worker died
  ORDER BY run_at, id
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, kind, payload, attempts, max_attempts;`,
    },
    {
      language: 'ts',
      title: 'Exponential backoff with full jitter',
      code: `// attempt is 1-based (the attempt that just failed)
function backoffMs(attempt: number, baseMs = 1_000, capMs = 5 * 60_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp); // full jitter: uniform in [0, exp)
}
// attempt 1 -> 0..1s, 2 -> 0..2s, 3 -> 0..4s, ... capped at 0..5min
// Without jitter, 1,000 jobs failing at the same moment retry at the same moment.`,
    },
    {
      language: 'sql',
      title: 'Idempotency: make the effect unique per job, not per attempt',
      code: `CREATE TABLE email_sends (
  checkin_id bigint NOT NULL,
  kind       text   NOT NULL,          -- 'checkin_reward'
  status     text   NOT NULL DEFAULT 'sending',  -- sending | sent
  sent_at    timestamptz,
  PRIMARY KEY (checkin_id, kind)
);

-- Handler step 1: claim the right to send. Zero rows returned means
-- another attempt already claimed it: check status and skip if 'sent'.
INSERT INTO email_sends (checkin_id, kind) VALUES ($1, 'checkin_reward')
ON CONFLICT (checkin_id, kind) DO NOTHING
RETURNING checkin_id;`,
    },
  ],
  keyTakeaways: [
    'Queues decouple accepting work from doing work: faster requests, smoothed bursts, retries without the user waiting.',
    'Delivery is at-least-once; build exactly-once effects with idempotent handlers keyed on the job, not the attempt.',
    'A lease (visibility timeout) detects dead workers; it must exceed normal processing time or jobs run twice in parallel.',
    '`FOR UPDATE SKIP LOCKED` lets many workers claim different rows without blocking each other.',
    'Retry transient errors with exponential backoff plus jitter; do not retry permanent errors.',
    'Cap attempts and dead-letter poison jobs, alert on DLQ size and oldest-job age, and design handlers not to depend on ordering.',
  ],
  prerequisites: [
    'Transactions, row locks, and isolation levels (week 7)',
    'Comfortable with SQL and the Postgres CLI in Docker (week 1)',
    'Basic async/await in Node',
  ],
  prerequisiteWeeks: [4, 7],
  resources: [
    {
      title: 'PostgreSQL docs: SELECT, The Locking Clause',
      url: 'https://www.postgresql.org/docs/current/sql-select.html',
      kind: 'docs',
      note: "Scroll to 'The Locking Clause' and read the paragraphs on FOR UPDATE, NOWAIT, and SKIP LOCKED, including the warning that SKIP LOCKED gives an inconsistent view and is intended for queue-like tables.",
      minutes: 8,
    },
    {
      title: 'PostgreSQL docs: Explicit Locking',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
      kind: 'docs',
      note: 'Read the row-level locks section to understand what FOR UPDATE actually takes and what it conflicts with.',
      minutes: 5,
    },
    {
      title: 'AWS Architecture Blog: Exponential Backoff And Jitter',
      url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
      kind: 'article',
      note: "Read the whole post; focus on the comparison of 'full jitter', 'equal jitter', and 'decorrelated jitter' and why no jitter performs worst.",
      minutes: 8,
      verify: true,
    },
    {
      title: 'Amazon SQS Developer Guide: Visibility timeout',
      url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html',
      kind: 'docs',
      note: 'Read as a reference model for leases: in-flight messages, choosing the timeout, and extending it for long jobs. Then skim the linked dead-letter queue page.',
      minutes: 6,
      verify: true,
    },
    {
      title: 'Designing Data-Intensive Applications (Martin Kleppmann)',
      url: 'https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/',
      kind: 'book',
      note: 'Optional depth: the stream processing chapter, specifically the sections on message brokers, acknowledgements and redelivery, and fault tolerance/idempotence.',
      minutes: 15,
      verify: true,
    },
  ],
  exercise: {
    title: 'Build a Postgres-backed job queue for NearBrew check-in rewards and photo thumbnails',
    scenario:
      "When a NearBrew user checks in, the API inserts the check-in and enqueues two jobs in the same transaction: `send_checkin_reward_email` and, if a photo was attached, `generate_photo_thumbnail`. You will build the worker: concurrent claiming with `FOR UPDATE SKIP LOCKED`, leases that recover from crashed workers, retries with exponential backoff and jitter, a dead-letter table for poison jobs, and an idempotency check so a retried email job never sends two emails.",
    setup: [
      'Start Postgres: `docker run --name nb-queue -e POSTGRES_PASSWORD=pg -p 5433:5432 -d postgres:16`',
      'Create a project: `mkdir nb-queue && cd nb-queue && npm init -y && npm i pg`, and set `"type": "module"` in package.json.',
      'Load the schema: `docker exec -i nb-queue psql -U postgres < schema.sql`',
      'Use `DATABASE_URL=postgres://postgres:pg@localhost:5433/postgres` for all scripts.',
    ],
    steps: [
      'Create `schema.sql` from the starter and load it. Read the partial index and explain to yourself which query it serves.',
      'Run `node enqueue.mjs 200` to create 200 check-ins with jobs. Note that the check-in and its jobs are inserted in one transaction, so you never get a check-in without its email job (or a job for a check-in that rolled back).',
      'Complete `worker.mjs`: implement `claimJob` using the claim query from the examples, and `completeJob`, which sets status to done. Run two workers in separate terminals and confirm with `SELECT locked_by, count(*) FROM jobs GROUP BY 1` that they processed different jobs and none twice.',
      'Implement `failJob`: if `attempts >= max_attempts`, insert into `dead_jobs` with the last error and delete from `jobs` in one transaction; otherwise set status back to queued with `run_at = now() + backoff` using full jitter. Log each retry with the delay chosen.',
      "Implement the idempotent email handler: insert into `email_sends` with `ON CONFLICT DO NOTHING`; if a row already exists with status sent, return early; otherwise call the fake sender, then mark it sent. The fake sender fails 20% of the time to exercise retries.",
      'Poison test: `node enqueue.mjs --poison` enqueues a reward job for a check-in whose user has no email. Classify that error as permanent (no retries) and dead-letter it immediately; confirm it lands in `dead_jobs` after 1 attempt, not 5.',
      'Crash test: start a worker, kill it with Ctrl+C while it is sleeping inside a slow thumbnail job (set `SLOW_MS=20000`), start another worker, and confirm the job is reclaimed only after the 30-second lease expires and then completes exactly once.',
      'Duplicate-effect test: run `node enqueue.mjs --duplicate 42` to enqueue a second reward job for check-in 42 (simulating a redelivery). Confirm `fake-outbox.log` has exactly one email for check-in 42.',
      'Write `stats.sql` with queue depth by status, the age of the oldest ready job, attempts distribution, and DLQ count. Run it during a 500-job burst with 3 workers.',
    ],
    starter: [
      {
        language: 'sql',
        title: 'schema.sql',
        code: `CREATE TABLE users (id bigserial PRIMARY KEY, email text);
CREATE TABLE checkins (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id),
  cafe_id bigint NOT NULL,
  photo_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
  id           bigserial PRIMARY KEY,
  kind         text NOT NULL,
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'queued',   -- queued | running | done
  attempts     int  NOT NULL DEFAULT 0,
  max_attempts int  NOT NULL DEFAULT 5,
  run_at       timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  locked_by    text,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Serves the claim query: only queued/running rows, ordered by run_at.
CREATE INDEX jobs_claim_idx ON jobs (run_at, id) WHERE status IN ('queued', 'running');

CREATE TABLE dead_jobs (
  id         bigint PRIMARY KEY,
  kind       text NOT NULL,
  payload    jsonb NOT NULL,
  attempts   int NOT NULL,
  last_error text,
  died_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_sends (
  checkin_id bigint NOT NULL,
  kind       text   NOT NULL,
  status     text   NOT NULL DEFAULT 'sending',
  sent_at    timestamptz,
  PRIMARY KEY (checkin_id, kind)
);`,
      },
      {
        language: 'js',
        title: 'enqueue.mjs',
        code: `import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const args = process.argv.slice(2);

async function createCheckin(client, { email, withPhoto }) {
  const u = await client.query('INSERT INTO users (email) VALUES ($1) RETURNING id', [email]);
  const c = await client.query(
    'INSERT INTO checkins (user_id, cafe_id, photo_key) VALUES ($1, $2, $3) RETURNING id',
    [u.rows[0].id, 1 + Math.floor(Math.random() * 50), withPhoto ? 'photos/' + Date.now() + '.jpg' : null],
  );
  return c.rows[0].id;
}

async function enqueue(client, kind, payload) {
  await client.query('INSERT INTO jobs (kind, payload) VALUES ($1, $2)', [kind, payload]);
}

const client = await pool.connect();
try {
  if (args[0] === '--duplicate') {
    await enqueue(client, 'send_checkin_reward_email', { checkinId: Number(args[1]) });
  } else {
    const n = args[0] === '--poison' ? 1 : Number(args[0] ?? 10);
    for (let i = 0; i < n; i++) {
      await client.query('BEGIN');
      const email = args[0] === '--poison' ? null : 'user' + i + '@example.com';
      const withPhoto = Math.random() < 0.5;
      const checkinId = await createCheckin(client, { email, withPhoto });
      await enqueue(client, 'send_checkin_reward_email', { checkinId });
      if (withPhoto) await enqueue(client, 'generate_photo_thumbnail', { checkinId, sizes: [200, 800] });
      await client.query('COMMIT');
    }
  }
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}`,
      },
      {
        language: 'js',
        title: 'worker.mjs (complete the TODOs)',
        code: `import pg from 'pg';
import { appendFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const WORKER_ID = 'w-' + randomUUID().slice(0, 6);
const LEASE_SECONDS = 30;
const SLOW_MS = Number(process.env.SLOW_MS ?? 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class PermanentError extends Error {}

async function claimJob() {
  // TODO: run the claim UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)
  // Also set locked_by = WORKER_ID. Return the row or null.
}

async function completeJob(id) {
  // TODO: UPDATE jobs SET status = 'done', locked_until = NULL, updated_at = now() WHERE id = $1
}

function backoffMs(attempt, baseMs = 1000, capMs = 60000) {
  // TODO: full jitter
}

async function failJob(job, err) {
  // TODO: if err is PermanentError or job.attempts >= job.max_attempts:
  //   in ONE transaction: INSERT INTO dead_jobs (...) SELECT ... ; DELETE FROM jobs WHERE id = $1
  // else: UPDATE jobs SET status = 'queued', run_at = now() + make_interval(secs => $2::float8 / 1000),
  //   last_error = $3, locked_until = NULL WHERE id = $1
}

async function fakeSendEmail(to, subject) {
  await sleep(50);
  if (Math.random() < 0.2) throw new Error('provider timeout (transient)');
  await appendFile('fake-outbox.log', new Date().toISOString() + ' ' + to + ' ' + subject + '\\n');
}

const handlers = {
  async send_checkin_reward_email({ checkinId }) {
    const { rows } = await pool.query(
      'SELECT u.email FROM checkins c JOIN users u ON u.id = c.user_id WHERE c.id = $1',
      [checkinId],
    );
    if (!rows[0]?.email) throw new PermanentError('no email for checkin ' + checkinId);
    // TODO: idempotency check against email_sends (INSERT ... ON CONFLICT DO NOTHING),
    // skip if already 'sent', otherwise send then mark 'sent'.
    await fakeSendEmail(rows[0].email, 'You earned 10 beans at checkin ' + checkinId);
  },
  async generate_photo_thumbnail({ checkinId, sizes }) {
    // Naturally idempotent: deterministic output path, overwrite is harmless.
    await sleep(SLOW_MS);
    console.log(WORKER_ID, 'thumbnails', sizes.map((s) => 'thumbs/' + checkinId + '_' + s + '.webp').join(', '));
  },
};

let running = true;
process.on('SIGINT', () => { running = false; });

while (running) {
  const job = await claimJob();
  if (!job) { await sleep(500); continue; }
  try {
    const handler = handlers[job.kind];
    if (!handler) throw new PermanentError('unknown job kind ' + job.kind);
    await handler(job.payload);
    await completeJob(job.id);
  } catch (err) {
    console.warn(WORKER_ID, 'job', job.id, 'attempt', job.attempts, 'failed:', err.message);
    await failJob(job, err);
  }
}
await pool.end();`,
      },
      {
        language: 'sql',
        title: 'stats.sql (starting point)',
        code: `SELECT status, count(*) FROM jobs GROUP BY status;
SELECT now() - min(run_at) AS oldest_ready_age
FROM jobs WHERE status = 'queued' AND run_at <= now();
SELECT attempts, count(*) FROM jobs WHERE status = 'done' GROUP BY attempts ORDER BY attempts;
SELECT count(*) AS dlq_size FROM dead_jobs;`,
      },
    ],
    expected: [
      'Two or three workers process disjoint sets of jobs concurrently; no job is completed by two workers.',
      'About 20% of email jobs fail on first attempt and succeed on a retry, with visibly randomised delays in the logs.',
      'The poison job lands in `dead_jobs` after exactly one attempt with a clear `last_error`.',
      'A job held by a killed worker becomes claimable again only after its 30-second lease expires.',
      '`fake-outbox.log` contains exactly one line per check-in, even after the duplicate enqueue and after retries.',
      '`stats.sql` shows oldest-ready age rising during the burst and falling back to zero as workers drain the queue.',
    ],
    hints: [
      "Put `FOR UPDATE SKIP LOCKED` inside the subquery, after `LIMIT 1`, and let the outer `UPDATE ... RETURNING` set the lease. Running the claim as a single autocommit statement keeps the lock window tiny.",
      "If two workers ever process the same job, check that the subquery also filters on status and that the lease is set in the same statement as the lock.",
      "For the email idempotency check, think about the crash window: if you mark 'sent' before calling the provider, a crash loses an email; if you mark it after, a crash can send twice. Pick one deliberately and write down which failure you are accepting and why.",
      "To make the failure log readable, print `attempt`, the chosen delay in ms, and the error message. Full jitter means some delays will be near zero; that is expected.",
    ],
    verification: [
      "Run `SELECT payload->>'checkinId' AS c, count(*) FROM jobs WHERE kind = 'send_checkin_reward_email' GROUP BY 1 HAVING count(*) > 1;` after the duplicate test, then confirm `fake-outbox.log` still has one line for that check-in.",
      "Confirm `SELECT count(*) FROM email_sends WHERE status = 'sent'` equals the number of distinct check-ins with an email.",
      'Confirm `dead_jobs` contains the poison job and nothing else (unless a transient error exhausted 5 attempts, which should be rare at 20% failure).',
      'Run `EXPLAIN` on your claim subquery and confirm it uses `jobs_claim_idx` once the table has a few thousand rows.',
      'Explain out loud what happens if the lease were 1 second while thumbnails take 20 seconds, then test it by setting `LEASE_SECONDS = 1`.',
    ],
  },
  successChecklist: [
    'Concurrent workers claim disjoint jobs using `FOR UPDATE SKIP LOCKED`.',
    'Expired leases are reclaimed after a worker crash; the job completes exactly once.',
    'Transient failures retry with exponential backoff and full jitter; permanent failures do not retry.',
    'Poison and exhausted jobs move to `dead_jobs` atomically with their last error.',
    'Duplicate deliveries of the reward job produce one email.',
    'I can name the remaining crash window in my email handler and justify the trade-off.',
  ],
  questions: [
    {
      question: 'Why can a queue not give you exactly-once delivery, and how do you get exactly-once effects anyway?',
      answer:
        "The worker acknowledges a job after doing the work, so a crash or network failure between 'work done' and 'ack received' leaves the queue unable to know whether the work happened. Its only safe choice is to redeliver, which gives at-least-once delivery; if it instead dropped unacknowledged jobs you would get at-most-once and lose work. Exactly-once effects come from making handlers idempotent: derive a key from the job (such as `checkin_id` plus the email kind), record the effect under a unique constraint, and skip if it already exists. When the effect lives in the same database you can record it in the same transaction and close the gap completely; for external side effects you narrow it with provider idempotency keys and reconciliation.",
    },
    {
      question: 'What does SKIP LOCKED do in the claim query, and what would happen without it?',
      answer:
        "`FOR UPDATE` locks the selected row so no other transaction can claim or modify it until the locker commits. `SKIP LOCKED` makes other transactions skip rows that are already locked instead of waiting. Without `SKIP LOCKED`, all workers' subqueries would pick the same oldest row and every worker except one would block on that row's lock, serialising the workers; with `NOWAIT` they would error instead. With it, each worker gets the next unlocked row, so N workers claim N different jobs in parallel. The trade-off documented by Postgres is that SKIP LOCKED gives an inconsistent view of the table, which is fine for a queue but wrong for general queries.",
    },
    {
      question:
        'A third-party email provider has a 2-minute outage. Describe what happens to your NearBrew queue with and without jitter, and what you would alert on.',
      answer:
        "Every email job that runs during the outage fails and is rescheduled. Without jitter, jobs that failed together retry together at 1s, 2s, 4s and so on, so the provider receives synchronised spikes exactly as it recovers, which can prolong the outage and burn through attempts. With full jitter the retries spread uniformly over each backoff window, so load on recovery is smooth and most jobs succeed within a few attempts; a cap on the backoff and enough `max_attempts` to cover a few minutes keeps them out of the DLQ. I would alert on the age of the oldest ready job (users are not getting reward emails promptly) and on the DLQ being non-empty, rather than on raw queue depth, which spikes harmlessly during bursts.",
    },
  ],
  explainPrompt:
    "Explain to a product-focused frontend teammate why the NearBrew check-in reward email is sent from a background job, and why 'the job might run twice' changes how the handler must be written.",
  rubric: [
    'Explains why the work leaves the request path (latency, resilience to provider outages, burst smoothing).',
    'Explains at-least-once delivery with a concrete crash-before-ack example.',
    'Describes the idempotency key and where it is enforced (unique constraint).',
    'Covers retries with backoff and jitter, and permanent vs transient errors.',
    'Mentions dead-letter handling and what the team does with dead jobs.',
    'Uses plain language suitable for a frontend-focused audience.',
  ],
  referenceExplanation:
    "When you check in, the API only does what's needed to give you a correct answer: save the check-in. In the same database transaction it adds a row to a jobs table saying 'send the reward email for check-in 42'. A worker process picks that up a moment later. That keeps check-ins fast and means an email provider outage doesn't break check-ins; the email just goes out a bit later. The catch is that the worker might run the same job twice. Picture it: the worker sends the email, then crashes before marking the job done. The queue can't tell whether the email went out, so after the job's lease expires another worker runs it again. That's called at-least-once delivery, and it's the normal guarantee for queues. If the handler naively sends an email every time, users get duplicates; if it adds reward points, they get double points. So the handler is idempotent: running it twice has the same effect as once. Before sending, it inserts a row into `email_sends` keyed on `(checkin_id, 'checkin_reward')`. The primary key means only one row can ever exist, so a second attempt sees the row is already marked sent and stops. There's still a tiny window (sent, then crashed before marking), which we accept for an email, but for points we'd do it in the same transaction so there's no window at all. Failures retry with growing, randomised delays so we don't hammer a struggling provider, and jobs that can never succeed, like a user with no email, go to a dead-letter table that we alert on and review.",
  stretch: {
    title: 'Lease heartbeats and LISTEN/NOTIFY',
    description:
      'Add a heartbeat that extends `locked_until` every 10 seconds for long thumbnail jobs, and only completes if `locked_by` still matches (fencing against a worker that lost its lease). Then replace the 500ms polling sleep with Postgres `LISTEN`/`NOTIFY` so idle workers wake as soon as a job is enqueued.',
  },
  lightTask:
    'Implement only `claimJob` and `completeJob`, run two workers against 100 jobs, and verify they never process the same job. Then write five sentences on why the reward email handler must be idempotent.',
  intensiveExtras: [
    'Write a `redrive.mjs` script that moves selected rows from `dead_jobs` back into `jobs` with attempts reset, and document when redriving is safe.',
    'Re-implement the worker in the lock-for-duration style (transaction held during the job) and compare: crash recovery behaviour, connection usage, and what happens with a 5-minute job.',
    'Add per-user ordering for a `favourite_changed` job using a version number so stale jobs are ignored, and test by enqueueing favourite and unfavourite in reverse order.',
    'Load test: enqueue 20,000 jobs, run 1 vs 4 vs 8 workers, and chart throughput and oldest-ready age. Find the point where Postgres or the pool becomes the bottleneck.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['backend-services', 'system-design', 'databases', 'production-reliability'],
  depth: 'detailed',
};

const week11: Lesson = {
  week: 11,
  slug: 'browser-rendering-core-web-vitals',
  title: 'Browser rendering pipeline and Core Web Vitals',
  track: 'frontend',
  topics: [
    'critical rendering path',
    'DOM and CSSOM',
    'style, layout, paint, composite',
    'reflow vs repaint',
    'layout thrashing',
    'compositor-only animation',
    'LCP',
    'INP',
    'CLS',
    'PerformanceObserver',
    'DevTools Performance panel',
  ],
  objective:
    'By the end you can explain what the browser does between receiving HTML and showing pixels, diagnose layout thrashing, janky animation, layout shifts and slow interactions in the Performance panel, and measure the fix with LCP, INP and CLS.',
  whyItMatters:
    "Users do not experience your React component tree; they experience frames. A page can have perfect component memoisation and still feel broken because a loop forces 400 synchronous layouts, an animation runs on the main thread, or a late banner shoves the button the user was about to tap. Core Web Vitals give these problems names and thresholds that product teams track, and the rendering pipeline is the mental model that tells you which fix actually helps. This matters even more on low-power devices such as TVs, set-top boxes and budget phones, where a 16ms frame budget is easy to blow.",
  explanation: [
    "Start with the pipeline. The browser receives HTML bytes and **parses** them into tokens and then into the DOM tree, incrementally, as bytes arrive. CSS is parsed into the CSSOM. CSS is **render-blocking**: the browser will not paint until it has the stylesheets in the head, because painting unstyled content and then restyling would be worse. Classic scripts without `defer` or `async` are **parser-blocking**: the parser stops, fetches and runs the script (which might call `document.write` or read styles), then continues. A preload scanner looks ahead for resources like images and stylesheets so they can start downloading early, which is why an image in the HTML is discovered far sooner than one injected later by JavaScript.",
    "Next comes **style**: for every element the browser matches selectors and computes final style values. Then **layout** (also called reflow) computes geometry: where every box is and how big it is. Layout is inherently relational; the width of a paragraph depends on its container, its height depends on text wrapping, and its height pushes down everything after it. That is why a change in one place can force layout work across a large part of the page. Elements with `display: none` are not laid out at all.",
    "After layout, the browser **paints**: it records drawing commands (text, borders, backgrounds, images) for each layer. Finally it **composites**: layers are rasterised (often on the GPU) and combined into the final frame, in the right order and with transforms and opacity applied. Crucially, compositing can happen on the **compositor thread**, separate from the main thread where JavaScript, style and layout run. That separation is what makes some animations smooth even while JavaScript is busy.",
    "This gives a cost hierarchy you should know by heart. Changing a geometric property such as `width`, `height`, `top`, `left`, `margin` or font size triggers **layout, then paint, then composite**. Changing a paint-only property such as `color`, `background-color` or `box-shadow` skips layout but still needs **paint and composite**. Changing `transform` or `opacity` on an element that has its own compositor layer can skip straight to **composite**, and can run on the compositor thread. So to move a 'now open' badge, animate `transform: translateX()` rather than `left`; to fade a card, animate `opacity` rather than `visibility` or `background`. `will-change: transform` hints the browser to promote an element to its own layer ahead of time, but every layer costs GPU memory, so apply it to the few elements that actually animate, not to everything.",
    "**Layout thrashing**, also called forced synchronous layout, is the most common self-inflicted main-thread problem. Browsers normally batch style and layout work and do it once per frame. But if your JavaScript *writes* a style (invalidating layout) and then *reads* a geometric value such as `offsetHeight`, `getBoundingClientRect()` or `scrollTop`, the browser must run layout immediately to give you a correct answer. Do that inside a loop over 400 cards and you run layout 400 times in one frame. The fix is to batch: do all reads first, then all writes, or schedule writes in `requestAnimationFrame`. In the Performance panel this shows up as many purple Layout blocks inside one task, flagged with a 'Forced reflow' warning.",
    "Think in **frame budgets**. On a 60Hz display a frame is about 16.7ms, and the browser needs part of that for its own work, so your JavaScript gets less. Any task over 50ms is a **long task**: during it the main thread cannot respond to input, run style or layout, or produce a new frame. Rendering performance is therefore mostly about keeping main-thread tasks short, avoiding unnecessary layout, and moving visual changes to the compositor. On low-power devices with slow CPUs, the same code can take 4 to 10 times longer, which is why you should profile with CPU throttling enabled.",
    "**Core Web Vitals** turn these ideas into user-centred metrics, each assessed at the 75th percentile of real page loads. **LCP (Largest Contentful Paint)** measures loading: when the largest image or text block in the viewport rendered. Good is 2.5 seconds or less; poor is over 4 seconds. **INP (Interaction to Next Paint)** measures responsiveness: for clicks, taps and key presses during the visit, how long until the next frame was painted, reporting roughly the worst interaction. Good is 200ms or less; poor is over 500ms. INP replaced First Input Delay as a Core Web Vital in March 2024, because FID only measured the input delay of the first interaction. **CLS (Cumulative Layout Shift)** measures visual stability: how much visible content moves unexpectedly. Good is 0.1 or less; poor is over 0.25.",
    "Each metric decomposes into parts you can fix. **LCP** splits into time to first byte, resource load delay (how late the browser discovered the LCP image), resource load duration, and element render delay. The usual wins are making the LCP image discoverable in the HTML (not injected by JavaScript), adding `fetchpriority=\"high\"`, not lazy-loading it, and serving appropriately sized images. **INP** splits into input delay (main thread busy when the user tapped), processing time (your handlers), and presentation delay (style, layout and paint for the resulting frame). Wins come from breaking long tasks, yielding to the main thread before heavy work, giving immediate visual feedback, and reducing DOM size. **CLS** is computed from layout shifts grouped in session windows (shifts less than 1 second apart, up to 5 seconds per window, with the largest window reported). Shifts within 500ms of user input are excluded, since the user expects things to move. Wins are `width` and `height` attributes or `aspect-ratio` on images and embeds, reserving space for late content such as banners and ads, and careful web font loading.",
    "Finally, distinguish **lab** from **field** data. The Performance panel and Lighthouse give lab data: one device, one network, reproducible, great for diagnosis. Field data comes from real users (the Chrome UX Report, or your own RUM using the `web-vitals` library or `PerformanceObserver`) and is what the thresholds are judged on. INP in particular needs real interactions, so lab tools can only approximate it. The workflow this week: record a trace in the Performance panel with 4x CPU throttling, find the long tasks, forced reflows and layout shifts, fix one thing at a time, and confirm the improvement with both the trace and logged metric values.",
  ],
  examples: [
    {
      language: 'js',
      title: 'Layout thrashing and the batched fix',
      code: `// BAD: write, then read, inside the loop -> one forced layout per card
for (const card of cards) {
  card.style.height = card.offsetHeight + 4 + 'px';
}

// GOOD: all reads first, then all writes -> one layout
const heights = Array.from(cards, (card) => card.offsetHeight);
cards.forEach((card, i) => {
  card.style.height = heights[i] + 4 + 'px';
});
// Even better: ask whether CSS (grid, align-items: stretch) can do this with no JS at all.`,
    },
    {
      language: 'css',
      title: 'Main-thread animation vs compositor-only animation',
      code: `/* Triggers layout + paint every frame, on the main thread */
@keyframes slide-bad { from { left: 0; } to { left: 200px; } }
.badge-bad { position: relative; animation: slide-bad 1s infinite alternate; }

/* Composite only; can stay smooth while JS is busy */
@keyframes slide-good { from { transform: translateX(0); } to { transform: translateX(200px); } }
.badge-good { animation: slide-good 1s infinite alternate; will-change: transform; }

/* Prevent CLS: reserve space for images and late content */
.hero img { width: 100%; height: auto; aspect-ratio: 12 / 5; }
#promo-slot { min-height: 72px; }`,
    },
    {
      language: 'js',
      title: 'Improving INP by giving feedback first and yielding',
      code: `const yieldToMain = () =>
  globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0));

sortButton.addEventListener('click', async () => {
  sortButton.textContent = 'Sorting…';     // cheap visual feedback
  sortButton.setAttribute('aria-busy', 'true');
  await yieldToMain();                      // let the browser paint that frame now
  const sorted = [...cafes].sort((a, b) => b.rating - a.rating);
  await yieldToMain();                      // break the work into smaller tasks
  renderList(sorted);
  sortButton.textContent = 'Sort by rating';
  sortButton.removeAttribute('aria-busy');
});`,
    },
  ],
  keyTakeaways: [
    'Pipeline: parse HTML and CSS into DOM and CSSOM, then style, layout, paint, composite. CSS blocks rendering; classic scripts block parsing.',
    'Geometry changes cost layout + paint + composite; colour changes cost paint + composite; transform and opacity can be composite-only.',
    'Reading layout after writing styles forces synchronous layout; batch reads before writes.',
    'Keep main-thread tasks short; anything over 50ms is a long task that blocks input and frames.',
    'LCP <= 2.5s, INP <= 200ms, CLS <= 0.1, judged at the 75th percentile of field data.',
    'Diagnose in the lab (Performance panel with CPU throttling), confirm in the field (web-vitals / PerformanceObserver).',
  ],
  prerequisites: [
    'How React renders and commits, and using the React Profiler (week 2)',
    'Event loop, tasks, microtasks and requestAnimationFrame (week 5)',
    'Comfortable with Chrome DevTools basics',
  ],
  prerequisiteWeeks: [2, 5],
  resources: [
    {
      title: 'web.dev: Web Vitals',
      url: 'https://web.dev/articles/vitals',
      kind: 'article',
      note: 'Read the Core Web Vitals section: the three metrics, the thresholds, and why the 75th percentile is used. Skim the tooling section for lab vs field.',
      minutes: 6,
    },
    {
      title: 'web.dev: Largest Contentful Paint (LCP)',
      url: 'https://web.dev/articles/lcp',
      kind: 'article',
      note: 'Read what elements are considered and how LCP is determined; follow the link to the LCP optimisation guide for the four-part breakdown if time allows.',
      minutes: 6,
    },
    {
      title: 'web.dev: Interaction to Next Paint (INP)',
      url: 'https://web.dev/articles/inp',
      kind: 'article',
      note: 'Read what is measured (input delay, processing, presentation delay), which interactions count, and how the reported value is chosen.',
      minutes: 6,
    },
    {
      title: 'web.dev: Cumulative Layout Shift (CLS)',
      url: 'https://web.dev/articles/cls',
      kind: 'article',
      note: 'Read the layout shift score (impact fraction times distance fraction), session windows, and the expected vs unexpected shifts section.',
      minutes: 6,
    },
    {
      title: 'Chrome DevTools: Performance panel',
      url: 'https://developer.chrome.com/docs/devtools/performance',
      kind: 'docs',
      note: 'Skim how to record, enable CPU throttling, read the Main track flame chart, and find Layout Shifts and Interactions tracks.',
      minutes: 4,
      verify: true,
    },
    {
      title: 'web-vitals library (GoogleChrome/web-vitals)',
      url: 'https://github.com/GoogleChrome/web-vitals',
      kind: 'tool',
      note: 'Read the README usage section (onLCP, onINP, onCLS) and the attribution build, which tells you which element or interaction caused a poor score.',
      minutes: 2,
    },
  ],
  exercise: {
    title: 'Fix the janky NearBrew café list page',
    scenario:
      "NearBrew's web café list (used for shared links and the marketing site) gets complaints: the page jumps around while loading, the 'Open now' badges stutter, and tapping 'Sort by rating' freezes the page. You get a deliberately janky single-file reproduction. Measure it, find each problem in the Performance panel, fix them one at a time, and prove each fix with numbers.",
    setup: [
      'Create a folder `janky-w11` and save `index.html` and `vitals.js` from the starter.',
      'Serve it locally (needed for module scripts and realistic loading): `npx serve .` or `python3 -m http.server 8080`.',
      'Open in Chrome, DevTools > Performance, set CPU throttling to 4x slowdown. Keep the Console open to see metric logs.',
    ],
    steps: [
      'Baseline: load the page with the Console open and record the logged LCP time, each layout shift and the running CLS. Click Sort three times and record each interaction duration. Write all numbers in a table.',
      'Record a Performance trace of a reload. Find the layout shifts in the Layout Shifts track and identify which elements moved and why (hover them). Find the LCP marker and note what element it is and when it was discovered.',
      "Record a trace while clicking Sort. Find the long task, expand it, and identify the 250ms busy loop, the render, and the many purple Layout blocks with 'Forced reflow' warnings. Note which function they come from.",
      'Fix layout thrashing: rewrite `equaliseHeights` to batch reads before writes (or remove it in favour of CSS). Re-record and compare the number of Layout events and the task duration.',
      'Fix the animation: change the badge keyframes from `left` to `transform`. Use the Rendering tab (Paint flashing) to confirm badges no longer repaint every frame.',
      'Fix CLS: give the hero image `width`/`height` attributes (or `aspect-ratio`) and reserve space for the promo slot with `min-height`. Move the hero image `src` into the HTML with `fetchpriority="high"` instead of setting it from a timer. Re-measure CLS and LCP.',
      'Fix INP: give immediate feedback on click, yield before the heavy work, and replace the busy loop with something cheaper (or split it into chunks with yields). Re-measure the interaction durations.',
      'Fill in an after column in your table for LCP, CLS and INP-like interaction durations, and the number of forced layouts per click. Write one sentence per fix explaining which pipeline stage it removed work from.',
    ],
    starter: [
      {
        language: 'html',
        title: 'index.html (deliberately janky)',
        code: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NearBrew cafés (janky)</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #3b2f2f; color: #fff; }
    .hero img { width: 100%; display: block; }            /* BUG: no dimensions -> shift when it loads */
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; padding: 16px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; overflow: hidden; }
    .badge { position: relative; display: inline-block; background: #ffd34d; padding: 2px 6px; border-radius: 4px; }
    @keyframes slide { from { left: 0; } to { left: 60px; } }   /* BUG: animates a layout property */
    .badge { animation: slide 0.8s ease-in-out infinite alternate; }
  </style>
  <script type="module" src="./vitals.js"></script>
</head>
<body>
  <header><strong>NearBrew</strong><button id="sort">Sort by rating</button></header>
  <div id="promo-slot"></div>                               <!-- BUG: content injected later, no reserved space -->
  <section class="hero"><img id="hero" alt="Featured café: Bean There" /></section>
  <main class="list" id="list"></main>
  <script>
    const cafes = Array.from({ length: 400 }, (_, i) => ({
      id: i, name: 'Café ' + (i + 1), rating: Number((Math.random() * 5).toFixed(1)),
    }));
    const list = document.getElementById('list');

    function render() {
      list.innerHTML = '';
      for (const c of cafes) {
        const el = document.createElement('article');
        el.className = 'card';
        el.innerHTML = '<h3>' + c.name + '</h3><p>Rating ' + c.rating + '</p><span class="badge">Open now</span>';
        list.appendChild(el);
      }
    }

    // BUG: layout thrashing (write then read in a loop)
    function equaliseHeights() {
      for (const card of list.querySelectorAll('.card')) {
        card.style.height = 'auto';
        const h = card.offsetHeight;          // forced synchronous layout
        card.style.height = (h + 4) + 'px';
      }
    }

    render();
    equaliseHeights();

    // BUG: LCP image discovered late (set from JS) and has no reserved size
    setTimeout(() => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500">' +
        '<rect width="100%" height="100%" fill="#c8a27a"/>' +
        '<text x="50%" y="50%" font-size="72" text-anchor="middle" fill="#3b2f2f">Bean There</text></svg>';
      document.getElementById('hero').src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }, 1200);

    // BUG: promo banner pushes everything down
    setTimeout(() => {
      document.getElementById('promo-slot').innerHTML =
        '<div style="padding:24px;background:#ffe9a8">Free pastry with your 5th check-in!</div>';
    }, 2000);

    // BUG: long task in the click handler -> poor INP
    document.getElementById('sort').addEventListener('click', () => {
      cafes.sort((a, b) => b.rating - a.rating);
      const start = performance.now();
      while (performance.now() - start < 250) { /* pretend expensive work */ }
      render();
      equaliseHeights();
    });
  </script>
</body>
</html>`,
      },
      {
        language: 'js',
        title: 'vitals.js (no network needed)',
        code: `// LCP: the last candidate before user input is the reported value.
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    console.log('[LCP candidate]', Math.round(e.startTime) + 'ms', e.element);
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });

// CLS: simple running sum (the real metric uses session windows; the
// web-vitals library implements that properly).
let cls = 0;
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (e.hadRecentInput) continue;
    cls += e.value;
    console.log('[layout shift]', e.value.toFixed(4), 'running CLS', cls.toFixed(4),
      (e.sources || []).map((s) => s.node));
  }
}).observe({ type: 'layout-shift', buffered: true });

// Interactions: duration is input delay + processing + presentation delay.
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (!e.interactionId) continue;
    console.log('[interaction]', e.name, Math.round(e.duration) + 'ms', {
      inputDelay: Math.round(e.processingStart - e.startTime),
      processing: Math.round(e.processingEnd - e.processingStart),
      presentation: Math.round(e.startTime + e.duration - e.processingEnd),
    });
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 16 });

// Optional, if you have network access: the official library.
// import { onLCP, onINP, onCLS } from 'https://unpkg.com/web-vitals@4?module';
// onLCP(console.log); onINP(console.log, { reportAllChanges: true }); onCLS(console.log, { reportAllChanges: true });`,
      },
    ],
    expected: [
      'Baseline shows at least two layout shifts (hero image around 1.2s, promo around 2s) with a running CLS well above 0.1, and an LCP that is the hero image at roughly 1.2s or later.',
      'Each Sort click logs an interaction of several hundred ms with 4x throttling; the trace shows a long task with many forced reflows.',
      'After the thrashing fix, the click task contains one or two Layout events instead of hundreds, and processing time drops noticeably.',
      'After the animation fix, Paint flashing no longer highlights the badges on every frame.',
      'After the CLS fixes, logged layout shifts are near zero and LCP occurs earlier because the image is discovered in the HTML.',
      'After the INP fix, the button text updates immediately and logged interaction durations fall toward or below 200ms.',
    ],
    hints: [
      "If you cannot find forced reflows, click a purple Layout block in the flame chart; the Summary shows a 'Layout forced' stack trace pointing at the line that read `offsetHeight`.",
      'Setting `card.style.height = auto` and then reading is a write followed by a read. A CSS grid with `align-items: stretch` already equalises heights within a row; you may not need the function at all.',
      'Hover entries in the Layout Shifts track to highlight the shifted nodes. Shifts happen to the elements that *move*, not the element that was inserted.',
      "INP is measured to the next paint, so the fastest win is often letting the browser paint feedback before the heavy work. Yielding via `setTimeout(0)` or `scheduler.yield()` (available in recent Chromium) splits one long task into several shorter ones.",
    ],
    verification: [
      'Your before/after table shows numbers for LCP, CLS, interaction duration, and forced layouts per click.',
      'Total CLS after fixes is below 0.1 on a fresh load with the Console logging.',
      'A trace of a Sort click shows no task longer than about 100ms at 4x throttling (or you can explain the remaining cost).',
      'Paint flashing shows the badges animating without repaint.',
      'You can point at each fix and name the pipeline stage it avoids (layout, paint) or the metric part it improves (resource load delay, input delay, processing, presentation).',
    ],
  },
  successChecklist: [
    'I can draw the pipeline from bytes to pixels and mark where CSS and scripts block.',
    'I found and fixed layout thrashing using evidence from the Performance panel.',
    'I converted a layout-property animation to a compositor-only one and verified with Paint flashing.',
    'I eliminated the layout shifts and explained each source.',
    'I improved the click interaction and measured it with PerformanceObserver.',
    'I can state the Good thresholds for LCP, INP and CLS and that they are judged at p75 in the field.',
  ],
  questions: [
    {
      question: "Why does animating `left` cause jank under load while animating `transform` usually stays smooth?",
      answer:
        "`left` is a geometric property, so changing it every frame invalidates layout, which then requires paint and composite, and all of that runs on the main thread. If JavaScript is busy (a long task, a React render), those frames are delayed or dropped and the animation stutters. `transform` does not affect layout of other elements; for an element on its own compositor layer the browser can apply the transform at the composite stage, often on the compositor thread and GPU, without re-running style, layout or paint. That is why `transform` and `opacity` animations can remain smooth even while the main thread is blocked, though each promoted layer does cost memory.",
    },
    {
      question: 'What is layout thrashing, and how do you detect and fix it?',
      answer:
        "Layout thrashing happens when code interleaves style writes and layout reads, for example setting a height and then reading `offsetHeight`, so the browser must run a synchronous layout for each read instead of once per frame. In a loop over many elements this multiplies layout cost by the number of iterations and creates long tasks. In the DevTools Performance panel it appears as many purple Layout blocks inside one task with 'Forced reflow' warnings, and the summary links to the offending line. The fix is to batch all reads before all writes, defer writes to `requestAnimationFrame`, cache measurements, or replace the JavaScript with CSS layout that achieves the same result.",
    },
    {
      question:
        'A NearBrew café page has good LCP and CLS in Lighthouse, but field data shows INP of 450ms on Android. Why the discrepancy, and how would you investigate?',
      answer:
        "Lighthouse runs a page load without real user interactions, so it cannot measure INP directly; it can only show proxies like Total Blocking Time. Field INP reflects real taps on real, often slower Android devices, during the whole visit, including interactions after hydration or after the list has grown. To investigate, collect INP with the `web-vitals` attribution build so you learn which element, interaction type and phase (input delay, processing, presentation) dominate, then reproduce that interaction in the Performance panel with CPU throttling. Typical fixes are breaking up long handlers, yielding before heavy work, reducing re-render scope in React, deferring non-urgent work, and shrinking DOM size so style and layout for the next frame are cheaper.",
    },
  ],
  explainPrompt:
    "Explain to a backend-leaning teammate who has to review your PR why your three CSS/JS changes to the NearBrew café list page (batching reads and writes, transform instead of left, reserved image space) improved the page, using the rendering pipeline and Core Web Vitals.",
  rubric: [
    'Describes the pipeline stages accurately and in order.',
    'Explains why each fix removes work from a specific stage (layout, paint) or moves it off the main thread.',
    'Connects fixes to the right metric (CLS for reserved space, INP for long tasks, LCP for early discovery).',
    'Uses measured before/after numbers rather than vague claims.',
    'Mentions lab vs field data and the p75 thresholds.',
  ],
  referenceExplanation:
    "The browser turns HTML and CSS into a DOM and CSSOM, computes styles, runs layout to work out where every box goes, paints the boxes into layers, and composites the layers into a frame. Layout and paint run on the main thread alongside our JavaScript, so anything that makes them run more often, or makes our JavaScript run longer, costs frames and responsiveness. First, `equaliseHeights` set a height and then read `offsetHeight` for each of 400 cards. Every read after a write forces the browser to redo layout immediately, so one click ran layout hundreds of times. Reading all heights first and writing them afterwards means one layout. That cut the Sort click from about 900ms to about 300ms at 4x CPU throttling, and yielding after giving the button feedback brought the logged interaction under 200ms, which is the INP 'good' threshold. Second, the 'Open now' badge animated `left`, a layout property, so every frame triggered layout and paint on the main thread and stuttered when JavaScript was busy. `transform: translateX` can be applied at the compositing stage, often on a separate thread, so it stays smooth; Paint flashing confirms the badges no longer repaint. Third, the hero image had no dimensions and the promo banner had no reserved space, so both pushed content down when they arrived. Adding `aspect-ratio` and a `min-height` dropped CLS from about 0.4 to near zero. Putting the image in the HTML with high fetch priority also moved LCP earlier because the browser discovers it immediately. Lab numbers prove the mechanism; we will confirm with field p75 data from web-vitals.",
  stretch: {
    title: 'Port it to React and add RUM',
    description:
      'Rebuild the café list in a Vite React app with the same bugs, then fix them the React way (useLayoutEffect for measure-then-mutate, CSS-only equal heights, startTransition for the sort). Report LCP, INP and CLS with the web-vitals attribution build to a tiny local endpoint and log which element caused each poor value.',
  },
  lightTask:
    'Load the janky page with 4x CPU throttling, record one Performance trace of a Sort click, and fix only the layout thrashing. Write down the number of Layout events and the click duration before and after, and one paragraph explaining forced synchronous layout.',
  intensiveExtras: [
    'Add a web font with a slow `@font-face` swap and measure the CLS it causes; fix it with `font-display` choices and size-adjusted fallbacks.',
    'Virtualise the 400-card list (render only visible rows) and compare INP and memory to the batched-but-full version.',
    'Use the Rendering tab: enable Layout Shift Regions and Layer borders, and write down which elements get their own compositor layer before and after `will-change`.',
    'Profile the same page on a real low-end Android phone via remote debugging and compare with 4x throttling on your laptop.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['rendering-performance', 'consumer-ui', 'js-ts'],
  depth: 'detailed',
};

const week12: Lesson = {
  week: 12,
  slug: 'technical-design-document-nearbrew',
  title: 'Writing a technical design document (NearBrew feature)',
  track: 'senior',
  secondaryTracks: ['system-design'],
  topics: [
    'design docs',
    'goals and non-goals',
    'alternatives considered',
    'trade-offs',
    'risks and mitigations',
    'rollout plans',
    'observability',
    'writing for reviewers',
    'scoping',
  ],
  objective:
    'By the end you can write a concise 1 to 2 page design doc for a real feature that states the problem, scopes it with goals and non-goals, compares genuine alternatives, and lays out risks, rollout and observability so reviewers can make a decision quickly.',
  whyItMatters:
    "As you move from implementing tickets to owning features, the hardest part stops being the code and becomes deciding what to build and getting agreement before you build it. A design doc is the cheapest place to find out you are wrong: changing a paragraph costs minutes, changing a shipped data model costs weeks. It is also where senior judgment becomes visible to others. Reviewers, managers and interviewers learn how you think from how you frame a problem, which trade-offs you see, and what you deliberately leave out. Writing it yourself, before asking any tool or colleague for answers, is how you build that independent judgment.",
  explanation: [
    "A design doc has three jobs: help **you** think, help the **team** align and make a decision, and leave a **record** of why things are the way they are. It is not a full specification and not documentation of the final code. The best docs are written early enough that the design can still change, and short enough that reviewers actually read them. Google's design-doc culture, described in an essay by Malte Ubl, frames the doc as the place to capture trade-offs; if there were no trade-offs to discuss, you probably did not need a doc.",
    "**Context** comes first and is usually under-written. Explain the problem from the user's and the business's point of view, with numbers where you have them: 'Users favourite cafés to find them later, 38% of NearBrew sessions start with no connectivity or a weak signal in basements and transit, and favourites currently fail to load offline.' Then state the current system briefly: what exists, what constraints you inherit. A reviewer who has never seen the code should understand why this matters and what makes it hard after one or two paragraphs.",
    "**Goals and non-goals** are the most powerful scoping tool you have. Goals should be specific and ideally measurable ('a user can view and edit saved lists with no network; changes sync within 30 seconds of reconnecting'). Non-goals are things a reasonable person might expect the project to do that it deliberately will not ('no collaborative lists shared between users in v1', 'no offline café search'). Non-goals are not 'bad ideas'; they are explicit decisions to defer. They prevent scope creep during review and give you something to point at when someone asks 'could it also…?'",
    "The **proposal** section describes the design at the level reviewers need to evaluate it: components and their responsibilities, the data model, API changes, key flows, and the parts that are genuinely tricky (for offline favourites, that is sync and conflict resolution; for check-in rewards, that is fraud, idempotency and double-awarding). A small diagram, a schema snippet and a sequence of steps for the main flow are worth more than pages of prose. Skip details any competent engineer would get right during implementation, and spend your words on the decisions that would be expensive to reverse.",
    "**Alternatives considered** is where reviewers check your judgment. Include at least two real alternatives, plus 'do nothing' or 'the simplest thing' when it is a credible option, and explain why you rejected each in terms of the goals. A doc that presents one option is asking for approval, not review. A useful format is a small comparison across the criteria that matter (complexity, latency, offline behaviour, cost, migration risk), followed by the decision. Be fair to the alternatives; strawmen erode trust in the rest of the doc.",
    "Make **trade-offs** explicit, because every design has them. 'Last-write-wins per (user, café) is simple and good enough for a single user on two devices, but if the same user unfavourites on their phone and favourites on their tablet while both are offline, the later timestamp wins and the other action is silently lost. We accept this because it is rare and low-stakes.' Naming the downside and the reason you accept it is far more convincing than pretending there isn't one. Pair this with **risks and mitigations**: what could go wrong in production (data loss on migration, abuse of rewards, storage limits on old phones, battery drain from sync) and what you will do about each.",
    "**Rollout** and **observability** show you have shipped software before. Rollout covers feature flags, staged percentages, data migrations and backfills, backward compatibility with older app versions still in the wild (mobile apps cannot force everyone to upgrade), and how to roll back. Observability covers how you will know it works and when it breaks: the success metric from your goals, the health metrics (sync error rate, queue lag, reward job DLQ size), dashboards and alerts. If you cannot say what you will measure, you cannot say whether the project succeeded.",
    "End with **open questions**, the things you genuinely do not know and need reviewers' help with. This is a sign of strength, not weakness: it directs review effort to where it is most useful. When you send the doc, say what you need and by when: 'Looking for a decision on sync approach (section 4) by Thursday; please focus on the conflict resolution and the migration.' Reviewers' time is the scarce resource, so open with a three-sentence summary, keep it to one or two pages for a feature of this size, and move detail into an appendix.",
    "Finally, know when to write one. A two-day change with no trade-offs needs a good PR description, not a design doc. A feature that touches the data model, crosses client and server, has a migration, or affects other teams usually deserves one. After the decision, keep the doc as a historical record and note the outcome; for individual decisions that are smaller than a feature, an Architecture Decision Record (week 33) is the lighter-weight format. In interviews, the same structure (context, goals, options, trade-offs, rollout, metrics) is a strong way to answer open-ended design and 'tell me about a project' questions.",
  ],
  examples: [
    {
      language: 'text',
      title: 'Goals and non-goals for "Saved lists & offline favourites"',
      code: `Goals
G1  A user can view saved lists and favourited cafés with no network, on app launch, in < 1s.
G2  A user can create, rename, delete lists and add/remove cafés while offline.
G3  Offline changes sync automatically within 30s of regaining connectivity; no user action needed.
G4  The same user on two devices converges to the same state after both sync.

Non-goals (v1)
N1  Sharing or collaborating on lists with other users.
N2  Offline café search or nearby results (only saved cafés are cached).
N3  Caching full photo galleries offline (only one thumbnail per saved café).
N4  Perfect merge of concurrent edits to the same item on two offline devices (last-write-wins, see Trade-offs).`,
    },
    {
      language: 'text',
      title: 'Alternatives considered (compact comparison)',
      code: `Option                         | Offline edits | Conflict handling      | Server work | Complexity
A  Cache last API response       | No (read only)| n/a                    | none        | Low
B  Local store + op log + LWW    | Yes           | Per-item last-write-wins| sync endpoint | Medium
C  CRDT library (full sync)      | Yes           | Automatic merge        | new infra   | High

Decision: B. A fails G2. C solves N4, which is a non-goal, at a cost we do not need for single-user lists.
Revisit C if collaborative lists (N1) move into scope.`,
    },
    {
      language: 'text',
      title: 'Rollout and observability excerpt',
      code: `Rollout
1. Ship server sync endpoint (POST /v1/me/list-ops) behind flag; old clients unaffected.
2. App release N: local store + op log, flag off. Backfill local store from GET /v1/me/lists on first launch.
3. Enable for internal users, then 5% -> 25% -> 100% over two weeks, watching metrics below.
Rollback: flag off reverts to online-only reads; queued ops remain on device and sync when re-enabled.

Observability
Success: % of saved-list views served offline; 7-day retention of users with >= 1 list.
Health: sync request error rate (< 1%), p95 time from reconnect to synced (< 30s),
        ops rejected as invalid, conflicts resolved by LWW per day, local store size p95.`,
    },
  ],
  keyTakeaways: [
    'A design doc exists to think, align, decide and record; write it while the design can still change.',
    'Lead with context and numbers; a reviewer new to the code should understand why it matters in two paragraphs.',
    'Goals should be measurable; non-goals are explicit deferrals that control scope.',
    'Present real alternatives and say why you rejected each against the goals.',
    'Name trade-offs and risks honestly with mitigations; cover rollout, rollback, backward compatibility and observability.',
    'Close with open questions and tell reviewers what decision you need, by when.',
  ],
  prerequisites: [
    'REST API design and pagination (week 3)',
    'Caching and stale data trade-offs (week 4)',
    'Transactions and preventing double-writes (week 7)',
    'Background jobs, retries and idempotency (week 10)',
  ],
  prerequisiteWeeks: [3, 4, 7, 10],
  resources: [
    {
      title: 'Design Docs at Google (Malte Ubl, Industrial Empathy)',
      url: 'https://www.industrialempathy.com/posts/design-docs-at-google/',
      kind: 'article',
      note: 'Read in full: the anatomy of a design doc (context and scope, goals and non-goals, the actual design, alternatives considered, cross-cutting concerns), length guidance, and when not to write one.',
      minutes: 15,
      verify: true,
    },
    {
      title: 'Companies Using RFCs or Design Docs (The Pragmatic Engineer)',
      url: 'https://blog.pragmaticengineer.com/rfcs-and-design-docs/',
      kind: 'article',
      note: 'Skim the examples of templates from different companies and compare their section lists to the one in this lesson.',
      minutes: 8,
      verify: true,
    },
    {
      title: 'Documenting Architecture Decisions (Michael Nygard)',
      url: 'https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions',
      kind: 'article',
      note: 'Short read on the lightweight ADR format (context, decision, status, consequences); useful contrast with a full design doc and a preview of week 33.',
      minutes: 4,
      verify: true,
    },
    {
      title: 'Google SRE Book: Reliable Product Launches at Scale',
      url: 'https://sre.google/sre-book/reliable-product-launches/',
      kind: 'book',
      note: "Skim the launch checklist section for rollout, capacity, and failure-mode questions to borrow for your doc's Risks and Rollout sections.",
      minutes: 5,
      verify: true,
    },
    {
      title: 'MDN: IndexedDB API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
      kind: 'docs',
      note: 'Only if you choose the offline favourites feature and want a concrete web storage reference; skim the key concepts page. Mobile equivalents are SQLite or a key-value store.',
      minutes: 3,
    },
  ],
  exercise: {
    title: 'Write a 1 to 2 page design doc for a NearBrew feature',
    scenario:
      "NearBrew's next milestone includes one of two features. Pick one. (A) Saved lists & offline favourites: users can organise favourited cafés into named lists and view and edit them with no connectivity, syncing later across devices. (B) Café check-ins with rewards: users check in at a café (location-verified) and earn beans; every 5th check-in at the same café unlocks a reward, announced by email and push. Write the design doc you would send to the team (a backend engineer, a mobile engineer and the founder as reviewers) before writing any code.",
    setup: [
      'Paper, a markdown file, or any doc tool. Timebox: 10 min outline, 40 min writing, 10 min self-review.',
      'Copy the template starter below into `design-doc.md`.',
      'Do not ask an AI assistant or colleague for the design before your first draft; the point is to exercise your own judgment. You may use one for critique after step 8.',
    ],
    steps: [
      'Pick the feature. In 5 minutes, list the 3 hardest questions it raises (for A: sync, conflicts, storage and old app versions; for B: location fraud, double-awarding under retries and concurrency, reward rules changing over time).',
      'Write a three-sentence summary at the top: the problem, the proposed approach, and the decision you need from reviewers.',
      'Write Context with at least two concrete numbers (real or clearly labelled estimates) and a sentence on current system constraints.',
      'Write 3 to 5 measurable goals and 3 to 5 non-goals. For each non-goal, make sure a reasonable reviewer might have assumed it was in scope.',
      'Write the Proposal: components, data model (a schema snippet), API changes, and a numbered main flow. For B, show how weeks 7 and 10 apply: a unique constraint or transaction preventing double rewards, and an idempotent reward email job.',
      'Write Alternatives considered with at least two real alternatives plus the simplest option, and a comparison against your goals.',
      'Write Trade-offs and Risks with mitigations (at least three risks), then Rollout (flags, stages, migration or backfill, old clients, rollback) and Observability (one success metric, three health metrics, one alert).',
      'Write Open questions (at least two) and a line telling reviewers what to focus on and by when.',
      'Self-review against the rubric: cut anything that does not help a reviewer decide, check it fits in 2 pages, and make sure every goal is addressed by the proposal and measured in observability.',
      'Optional: send it to a colleague or ask an AI tool to act as a sceptical reviewer, then record which objections you had already anticipated and which you missed.',
    ],
    starter: [
      {
        language: 'text',
        title: 'design-doc.md template',
        code: `Title: <Feature name>            Author: <you>      Status: Draft | In review | Approved
Reviewers: <backend>, <mobile>, <founder>        Decision needed by: <date>

Summary (3 sentences)
<Problem.> <Proposed approach.> <What you need from reviewers.>

1. Context
- Who is affected and how (with numbers):
- What exists today and its constraints:
- Why now:

2. Goals
G1
G2
G3

3. Non-goals
N1
N2

4. Proposal
4.1 Overview (components and responsibilities; small diagram if useful)
4.2 Data model (schema snippet)
4.3 API changes (endpoints, request/response shape, compatibility)
4.4 Main flow (numbered steps)
4.5 The tricky part (sync/conflicts OR fraud/double-awarding) in detail

5. Alternatives considered
Option | criteria... | Decision and why

6. Trade-offs
<What we give up, why we accept it.>

7. Risks and mitigations
Risk | Likelihood | Impact | Mitigation

8. Rollout and rollback
<Flags, stages, migrations/backfill, old app versions, rollback plan.>

9. Observability
Success metric:
Health metrics:
Alerts:

10. Open questions
Q1
Q2

Appendix (optional): detailed schemas, payload examples, estimates.`,
      },
      {
        language: 'sql',
        title: 'Starting point for feature B: preventing double rewards',
        code: `-- One row per (user, cafe, reward cycle). The unique key makes double-awarding
-- impossible even if two check-in requests or two job attempts race.
CREATE TABLE rewards (
  id           bigserial PRIMARY KEY,
  user_id      bigint NOT NULL,
  cafe_id      bigint NOT NULL,
  cycle        int    NOT NULL,          -- 1 for check-ins 1-5, 2 for 6-10, ...
  checkin_id   bigint NOT NULL,          -- the check-in that unlocked it
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cafe_id, cycle)
);
-- Question for your doc: compute 'cycle' inside the same transaction as the
-- check-in insert? What isolation level or lock do you need (week 7)?`,
      },
    ],
    expected: [
      'A doc of roughly 1 to 2 pages (about 600 to 1,200 words plus small snippets) that a reviewer could read in 10 minutes.',
      'Every goal is concrete enough to test, and every non-goal is something a reviewer could plausibly have expected.',
      'At least two real alternatives with reasons for rejection tied to the goals.',
      'The tricky part of the feature is addressed in detail (conflict resolution or double-award prevention), with an honest trade-off.',
      'Rollout covers old app versions and rollback; observability includes a success metric tied to a goal.',
      'Open questions are genuine and the summary says what decision is needed.',
    ],
    hints: [
      "If your proposal section is longer than everything else combined, you are probably describing implementation details; keep only decisions that would be expensive to reverse.",
      "For offline favourites, think in operations ('add café 42 to list 7 at time T') rather than full-state snapshots; ops are easier to sync, replay and deduplicate (an op id makes them idempotent).",
      "For check-in rewards, separate the decision 'this check-in unlocked a reward' (a database transaction with a unique constraint) from the side effects 'send email and push' (an idempotent background job).",
      "Write the non-goals before the proposal. They will make the proposal shorter.",
    ],
    verification: [
      'Read only your summary and goals: could a reviewer say yes or no to the direction from those alone?',
      'Trace each goal to the proposal section that delivers it and the metric that measures it.',
      'Check the alternatives section contains no strawmen: would a fan of each rejected option agree with how you described it?',
      'Confirm length: two pages or fewer, with detail in an appendix.',
      'Score yourself against the rubric and revise the weakest section once.',
    ],
  },
  successChecklist: [
    'My doc opens with a 3-sentence summary stating the decision needed.',
    'Context includes at least two concrete numbers or labelled estimates.',
    'Goals are measurable and non-goals explicitly limit scope.',
    'I compared at least two real alternatives against the goals.',
    'I named trade-offs and at least three risks with mitigations.',
    'Rollout handles old app versions and rollback; observability ties back to the goals.',
    'The doc fits in two pages.',
  ],
  questions: [
    {
      question: 'Why are non-goals so important in a design doc, and what makes a good one?',
      answer:
        "Non-goals make scope explicit, which prevents the design from growing during review and lets reviewers evaluate the proposal against what it is actually trying to do. A good non-goal is something a reasonable reader might assume is included, such as collaborative lists for a saved-lists feature, so stating it removes ambiguity; 'we will not rewrite the app in Rust' is not useful because nobody expected it. Non-goals also justify simpler designs: if concurrent multi-device edits are a non-goal, last-write-wins is acceptable and a CRDT is unnecessary. They create a natural place to revisit later, since moving a non-goal into scope is a clear signal to revisit the design.",
    },
    {
      question:
        'For "Café check-ins with rewards", how would you prevent a user from receiving the same reward twice, and how would you explain that in the doc?',
      answer:
        "Separate the reward decision from its side effects. The decision is made in the same database transaction as the check-in insert: count the user's check-ins at that café (with a lock on the user-café row or at a suitable isolation level so concurrent check-ins cannot both see the same count), and insert a reward row with a unique constraint on `(user_id, cafe_id, cycle)` so a race or retry fails safely instead of creating a duplicate. The email and push are then enqueued as background jobs keyed on the reward id, and the handlers are idempotent so at-least-once delivery cannot send two notifications. In the doc, state this as a correctness guarantee in the proposal, mention the residual risk (for example a notification sent twice in a rare crash window) in trade-offs, and add a metric such as duplicate-reward constraint violations per day to observability.",
    },
    {
      question: 'What should the rollout section of a mobile feature design doc cover that a web-only feature might not?',
      answer:
        "Mobile apps cannot be force-updated instantly, so the doc must cover backward compatibility: old app versions will keep calling existing endpoints for months, and the server must accept both old and new request shapes. It should describe the order of releases (server first, behind a flag; then the app with the feature dark; then gradual enablement), and how client-side data migrations or backfills run on first launch after upgrade. Rollback is harder because you cannot roll back installed binaries, so it usually relies on remote feature flags and on the server tolerating whatever state new clients created. It should also mention app store review lead time and staged rollouts, plus observability segmented by app version.",
    },
  ],
  explainPrompt:
    "Explain to an interviewer how you wrote the design doc for your chosen NearBrew feature: how you scoped it, which alternative you rejected and why, the main trade-off you accepted, and how you planned to roll it out and measure success.",
  rubric: [
    'Frames the problem with user impact and numbers before describing the solution.',
    'Shows deliberate scoping through goals and non-goals.',
    'Presents a real alternative and rejects it against the goals, not on taste.',
    'Names a concrete trade-off and why it is acceptable.',
    'Covers rollout (including old clients and rollback) and a success metric tied to a goal.',
    'Is concise and structured, as if speaking to a busy reviewer.',
  ],
  referenceExplanation:
    "I wrote a design doc for saved lists and offline favourites in NearBrew. The context was that users favourite cafés to find them later, but a large share of sessions start on a poor connection, in basements or on transit, and favourites simply failed to load. I set four goals: view lists offline in under a second, edit them offline, sync automatically within 30 seconds of reconnecting, and converge across a user's devices. Equally important were the non-goals: no shared or collaborative lists, no offline search, and no perfect merge of simultaneous offline edits on two devices. Those non-goals shaped the design. I proposed a local store on the device plus an operation log: each change is recorded as an op with a unique id, sent to a sync endpoint when online, and applied idempotently on the server, with last-write-wins per user and café. I compared it with caching the last API response, which is simpler but fails the offline editing goal, and with a CRDT library, which merges concurrent edits automatically but adds infrastructure to solve a problem I had explicitly scoped out. The trade-off I accepted is that if the same user edits the same café on two offline devices, the later timestamp wins; it's rare and low-stakes for a single-user list, and I said we would revisit if collaboration came into scope. For rollout I shipped the server endpoint first behind a flag, because old app versions stay in the wild, then the client with the feature dark, then 5%, 25% and 100%. Rollback is a remote flag back to online-only reads. Success was the share of list views served offline, with health metrics on sync errors, time to sync, and conflict counts.",
  stretch: {
    title: 'Write the second doc and run a review',
    description:
      'Write the doc for the feature you did not pick, then run a 30-minute review with a colleague (or role-play it): they read for 10 minutes, list their top three concerns, and you update the doc and record decisions and remaining open questions in a short changelog at the bottom.',
  },
  lightTask:
    'Write only the summary, context, goals, non-goals and alternatives (with a decision) for one of the two NearBrew features, on one page, in 30 minutes.',
  intensiveExtras: [
    'Draw the main sequence diagram (client, local store, sync endpoint, database, job queue) for your design on paper or in a diagram tool and add it to the doc.',
    'Write a one-page ADR for the single most important decision in your doc (for example last-write-wins vs CRDT) and compare what each format captures.',
    'Take a past project from work and write a retroactive design doc for it in 45 minutes; note which sections would have changed the outcome had they existed beforehand.',
    'Estimate capacity for your feature: requests per second for the sync or check-in endpoint at 10x current users, storage per user, and job queue throughput, and add it to the appendix.',
  ],
  minutes: { learn: 30, practice: 60, explain: 30 },
  competencies: ['technical-communication', 'system-design', 'feature-ownership'],
  depth: 'detailed',
};

export const weeks09to12: Lesson[] = [week09, week10, week11, week12];
