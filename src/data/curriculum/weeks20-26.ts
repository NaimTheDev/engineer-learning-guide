import type { Lesson } from '../types';

export const weeks20to26: Lesson[] = [
  // ---------------------------------------------------------------------------
  // Week 20 — Code review as a senior engineer
  // ---------------------------------------------------------------------------
  {
    week: 20,
    slug: 'senior-code-review',
    title: 'Code review as a senior engineer',
    track: 'senior',
    secondaryTracks: ['backend'],
    topics: [
      'code review',
      'review prioritisation',
      'authorization bugs',
      'race conditions',
      'SQL injection',
      'review comments',
      'conventional comments',
    ],
    objective:
      "By the end you can review a realistic pull request in a fixed order (intent, correctness, security, data, operability, tests, style), find the bugs that matter, and write comments that are prioritised, specific and kind.",
    whyItMatters:
      "Most production incidents ship through a review that approved them. The reviewer who catches a missing authorization check or a check-then-insert race before merge saves days of incident work, and the way you phrase review comments shapes how a team learns. Reviewing well, without leaning on an AI tool to tell you what is wrong, is one of the clearest signals of independent senior judgment.",
    explanation: [
      "A senior review is not a lint pass. Linters, formatters and type checkers already catch naming, spacing and many type errors; your attention is the scarcest resource in the review, so spend it on things tools cannot see. A useful mental model is to read the PR in passes, each with one question. Pass 1, intent: what is this change supposed to do, and does the description, ticket or design doc say so? You cannot judge correctness without knowing the requirement. Pass 2, correctness: does the code do that for every input, including empty, missing, duplicate and concurrent ones? Pass 3, security and privacy: who is allowed to call this, whose data does it read or return, and is any input concatenated into a query, a shell command or HTML? Pass 4, data: does the schema enforce the invariants, will the migration lock a hot table, are queries indexed? Pass 5, operability: what happens when a dependency fails halfway, can we see it in logs and metrics, can we roll it back? Pass 6, tests. Only then, style.",
      "Correctness bugs in backend PRs cluster in a few predictable places, and knowing the list lets you scan fast. Check-then-act sequences (SELECT to see if something exists, then INSERT) are races unless a unique constraint or lock backs them up; two taps on a mobile button arrive within milliseconds. Multi-step side effects (insert a row, then call another service to award points) leave the system half-done when the second step fails, and a retry may then be refused by the first step. Input that is assumed present is often `undefined`, and arithmetic on `undefined` gives `NaN`, and every comparison with `NaN` is false, so a guard like `if (distance > 200) reject` silently passes. 'Today' is ambiguous: the server's UTC date, the database session time zone and the café's local day are three different things.",
      "Security issues are usually about identity and trust boundaries rather than clever exploits. If a handler takes `userId` from the request body instead of the authenticated session, any client can act as any user; this is the single most common serious bug in CRUD endpoints. Anything interpolated into SQL must be parameterised, and identifiers that cannot be parameterised (column names in ORDER BY) must be checked against an allowlist. Also ask what the response leaks: returning `SELECT *` from a check-ins table can expose other users' precise coordinates, which for a location app is a privacy incident, not a nit.",
      "How you write the comment matters as much as what you find. Label severity so the author knows what blocks merge: a common convention ([Conventional Comments](https://conventionalcomments.org/)) uses prefixes such as `issue (blocking):`, `suggestion:`, `question:` and `nit:`. A good blocking comment states the problem, a concrete failure scenario, and a suggested direction: 'If the user double-taps, both requests pass the SELECT before either INSERTs, so they get two check-ins and 20 points. A unique index on (user_id, cafe_id, checkin_date) plus ON CONFLICT DO NOTHING makes the database the arbiter.' Ask questions when you are unsure ('Were check-ins meant to be limited to opening hours? `opens_at` is selected but unused.') rather than asserting. Comment on the code, not the person.",
      "Finally, own the scope of your review. Large PRs get worse reviews, so it is legitimate to ask for a split. Approve with comments when the remaining items are genuinely non-blocking, and say so explicitly. Summarise at the top: the two or three things that must change, what you did not review (for example 'I did not check the iOS client change'), and something specific that was done well. A reviewer who leaves forty unranked comments has transferred their prioritisation work to the author; a reviewer who leaves four ranked ones has done the job.",
    ],
    examples: [
      {
        language: 'text',
        title: 'A prioritised review summary (the shape to aim for)',
        code: `Summary: The endpoint shape is good and the distance check is a nice touch.
Three things need to change before merge; the rest are suggestions.

issue (blocking): userId comes from req.body, so any client can check in
  as any user and farm points for them. Use the authenticated user
  (req.user.id) and ignore any userId in the body.

issue (blocking): SELECT-then-INSERT is a race. Two taps 30 ms apart both
  see "no check-in today" and both insert + award points. Suggest a
  checkin_date column, UNIQUE (user_id, cafe_id, checkin_date), and
  INSERT ... ON CONFLICT DO NOTHING, with awardPoints in the same transaction.

issue (blocking): ORDER BY is built from req.query.sort -> SQL injection.
  Allowlist the sortable columns.

question: opens_at/closes_at are selected but unused. Should check-ins be
  rejected outside opening hours? If so, which time zone defines "open"?

suggestion: GET returns SELECT * including other users' lat/lng. Return
  only id, user display name and created_at, and paginate.

nit: 201 Created is more accurate than 200 for the POST.

Not reviewed: the loyalty service internals.`,
      },
      {
        language: 'ts',
        title: 'One possible fixed POST handler',
        code: `router.post('/cafes/:cafeId/checkins', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;                 // identity from the session, never the body
    const cafeId = Number(req.params.cafeId);
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isInteger(cafeId)) {
      return res.status(400).json({ error: 'cafeId, lat and lng are required numbers' });
    }

    const cafe = await db.query('SELECT id, lat, lng, timezone FROM cafes WHERE id = $1', [cafeId]);
    if (cafe.rowCount === 0) return res.status(404).json({ error: 'Cafe not found' });

    if (haversineMeters(lat, lng, cafe.rows[0].lat, cafe.rows[0].lng) > 200) {
      return res.status(422).json({ error: 'Too far from cafe' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // "Today" is the cafe's local day, computed by Postgres from its time zone.
      const inserted = await client.query(
        "INSERT INTO checkins (user_id, cafe_id, checkin_date) " +
        "VALUES ($1, $2, (now() AT TIME ZONE $3)::date) " +
        "ON CONFLICT (user_id, cafe_id, checkin_date) DO NOTHING RETURNING id, created_at",
        [userId, cafeId, cafe.rows[0].timezone]
      );
      if (inserted.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Already checked in today' });
      }
      await awardPoints(client, userId, 10, { reason: 'checkin', checkinId: inserted.rows[0].id });
      await client.query('COMMIT');
      return res.status(201).json(inserted.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err); // Express 4 does not catch rejected promises from async handlers
  }
});`,
      },
    ],
    keyTakeaways: [
      "Review in passes: intent, correctness, security/privacy, data, operability, tests, then style.",
      "Check-then-insert is a race unless a unique constraint or lock enforces the rule; let the database be the arbiter.",
      "Identity comes from the authenticated session, never from the request body.",
      "`NaN` makes every comparison false, so validation guards written as 'reject if too big' silently pass on missing input.",
      "Label severity and give a concrete failure scenario for every blocking comment.",
      "Summarise at the top: what blocks, what you did not review, what was done well.",
    ],
    prerequisites: [
      'Comfortable reading Express/Node handlers and SQL',
      'Basic understanding of transactions and unique constraints',
    ],
    prerequisiteWeeks: [3, 7, 16],
    resources: [
      {
        title: "Google Engineering Practices: How to do a code review",
        url: 'https://google.github.io/eng-practices/review/',
        kind: 'docs',
        note: "Read the reviewer guide's pages on the standard of code review, what to look for, and how to write review comments. Focus on the idea that approval means 'improves overall code health', not 'perfect'.",
        minutes: 15,
      },
      {
        title: 'Conventional Comments',
        url: 'https://conventionalcomments.org/',
        kind: 'article',
        note: 'Skim the labels (issue, suggestion, question, nit) and decorations like (blocking). You will use this format in the exercise.',
        minutes: 5,
      },
      {
        title: 'OWASP SQL Injection Prevention Cheat Sheet',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
        kind: 'docs',
        note: 'Read the sections on parameterised queries and allowlist input validation, especially the note that table/column names and sort order cannot be bound as parameters.',
        minutes: 5,
      },
      {
        title: 'PostgreSQL INSERT (ON CONFLICT clause)',
        url: 'https://www.postgresql.org/docs/current/sql-insert.html',
        kind: 'docs',
        note: 'Read the ON CONFLICT section: conflict_target, DO NOTHING vs DO UPDATE, and how RETURNING behaves when a row is skipped.',
        minutes: 5,
      },
    ],
    exercise: {
      title: 'Review a NearBrew check-in PR, then prove the race',
      scenario:
        "A teammate opened PR #318, 'Add café check-ins with loyalty points', for NearBrew. Product rule: a user can check in at a café at most once per day, must be within 200 m, and earns 10 loyalty points per check-in. The PR adds a migration and two endpoints. CI is green and the author has asked for your review before Friday's release.",
      setup: [
        'Copy the diff below into a local file `pr-318.diff` so you can annotate it with line references.',
        'For the race reproduction: `docker run --name nb-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`, then in a scratch folder `npm init -y && npm i pg`.',
      ],
      steps: [
        "Pass 1 (5 min): write one sentence stating what the PR is supposed to do and list the product rules it must enforce. Note anything in the diff that hints at an unstated requirement.",
        "Passes 2 to 5 (25 min): read the diff once per pass (correctness, security/privacy, data/schema, operability). Write each finding as a Conventional Comment with a severity label, the line it applies to, a concrete failure scenario, and a suggested direction. Aim for at least eight findings before you look at the hints.",
        "Rank the findings. Write a review summary of at most ten lines: blocking items first, then questions, then suggestions, then what you did not review and one thing done well.",
        "Reproduce the double check-in race: save the race script below as `race.mjs` and run `node race.mjs`. Record how many rows land in the table for five concurrent 'taps'.",
        "Fix the race at the database layer: add a `checkin_date date NOT NULL` column and `UNIQUE (user_id, cafe_id, checkin_date)`, change the insert to `INSERT ... ON CONFLICT DO NOTHING RETURNING id`, and treat `rowCount === 0` as the 409 case. Rerun and confirm exactly one row.",
        "Write the rewritten POST handler (or compare yours with the worked example) and check it against every blocking comment you wrote.",
      ],
      starter: [
        {
          language: 'diff',
          title: 'PR #318: Add café check-ins with loyalty points',
          code: `diff --git a/migrations/042_create_checkins.sql b/migrations/042_create_checkins.sql
new file mode 100644
--- /dev/null
+++ b/migrations/042_create_checkins.sql
@@ -0,0 +1,8 @@
+CREATE TABLE checkins (
+  id         bigserial PRIMARY KEY,
+  user_id    bigint NOT NULL,
+  cafe_id    bigint NOT NULL REFERENCES cafes(id),
+  lat        double precision,
+  lng        double precision,
+  created_at timestamptz NOT NULL DEFAULT now()
+);
diff --git a/src/routes/checkins.ts b/src/routes/checkins.ts
new file mode 100644
--- /dev/null
+++ b/src/routes/checkins.ts
@@ -0,0 +1,50 @@
+import { Router } from 'express';
+import { db } from '../db';
+import { awardPoints } from '../loyalty';
+import { haversineMeters } from '../geo';
+
+const router = Router();
+
+// POST /cafes/:cafeId/checkins   body: { userId, lat, lng }
+// One check-in per user per cafe per day; awards 10 loyalty points.
+router.post('/cafes/:cafeId/checkins', async (req, res) => {
+  const { userId, lat, lng } = req.body;
+  const cafeId = req.params.cafeId;
+
+  const cafe = await db.query(
+    'SELECT id, lat, lng, opens_at, closes_at FROM cafes WHERE id = $1',
+    [cafeId]
+  );
+
+  const distance = haversineMeters(lat, lng, cafe.rows[0].lat, cafe.rows[0].lng);
+  if (distance > 200) {
+    return res.status(400).json({ error: 'Too far from cafe' });
+  }
+
+  const today = new Date().toISOString().slice(0, 10);
+  const existing = await db.query(
+    'SELECT id FROM checkins WHERE user_id = $1 AND cafe_id = $2 AND created_at::date = $3',
+    [userId, cafeId, today]
+  );
+  if (existing.rows.length > 0) {
+    return res.status(409).json({ error: 'Already checked in today' });
+  }
+
+  const result = await db.query(
+    'INSERT INTO checkins (user_id, cafe_id, lat, lng) VALUES ($1, $2, $3, $4) RETURNING *',
+    [userId, cafeId, lat, lng]
+  );
+  await awardPoints(userId, 10);
+
+  res.status(200).json(result.rows[0]);
+});
+
+// GET /cafes/:cafeId/checkins?sort=created_at
+router.get('/cafes/:cafeId/checkins', async (req, res) => {
+  const sort = req.query.sort || 'created_at';
+  const rows = await db.query(
+    'SELECT * FROM checkins WHERE cafe_id = $1 ORDER BY ' + sort + ' DESC',
+    [req.params.cafeId]
+  );
+  res.json(rows.rows);
+});
+
+export default router;`,
        },
        {
          language: 'js',
          title: 'race.mjs: five concurrent taps against the naive logic',
          code: `import pg from 'pg';

const pool = new pg.Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });

async function checkInNaive(userId, cafeId) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await pool.query(
    'SELECT id FROM checkins WHERE user_id = $1 AND cafe_id = $2 AND created_at::date = $3',
    [userId, cafeId, today]
  );
  if (existing.rows.length > 0) return 'duplicate';
  await pool.query('INSERT INTO checkins (user_id, cafe_id) VALUES ($1, $2)', [userId, cafeId]);
  return 'inserted (+10 points)';
}

await pool.query('DROP TABLE IF EXISTS checkins');
await pool.query(
  'CREATE TABLE checkins (id bigserial PRIMARY KEY, user_id bigint NOT NULL, ' +
  'cafe_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now())'
);

const results = await Promise.all(Array.from({ length: 5 }, () => checkInNaive(1, 42)));
console.log(results);

const { rows } = await pool.query('SELECT count(*)::int AS n FROM checkins');
console.log('rows in table:', rows[0].n, '(product rule says 1)');
await pool.end();`,
        },
      ],
      expected: [
        "Your review contains at least three blocking issues: userId from the body (impersonation), the SELECT-then-INSERT race (duplicate check-ins and points), and SQL injection through `sort`.",
        "You also flag: missing café returns a 500 or hangs (`cafe.rows[0]` is undefined and the async error is unhandled in Express 4); missing lat/lng produce `NaN` so the distance guard passes; `awardPoints` runs outside any transaction; the GET leaks other users' coordinates with no pagination; the 'today' calculation mixes UTC and the DB session time zone instead of the café's local day.",
        "`node race.mjs` usually prints several 'inserted' results and a row count above 1; after the unique constraint fix it prints exactly one insert and four duplicates.",
        "Your summary is short enough to read in under a minute and makes the merge decision obvious.",
      ],
      hints: [
        "Ask of every value in the handler: where did it come from, and who controls it? `userId`, `lat`, `lng` and `sort` are all client controlled.",
        "Run `haversineMeters(undefined, undefined, 51.5, -0.1)` in your head: what is `NaN > 200`?",
        "If `awardPoints` throws after the INSERT succeeds, what does the user see, and what happens when the app retries?",
        "`opens_at` and `closes_at` are selected but never used. Is that dead code or a missing requirement? Write it as a question, not an issue.",
      ],
      verification: [
        "Compare your findings with the expected list above; for each one you missed, write one sentence on which review pass should have caught it.",
        "The race script shows 1 row after your fix, across at least three runs.",
        "Every blocking comment you wrote includes a concrete scenario a non-author could reproduce.",
      ],
    },
    successChecklist: [
      'Found the impersonation, race, and SQL injection issues without hints.',
      'Found at least two of: NaN guard bypass, missing-café crash, non-transactional points, location leak, time-zone ambiguity.',
      'Every comment has a severity label and blocking ones have a failure scenario.',
      'Reproduced the race locally and fixed it with a unique constraint plus ON CONFLICT.',
      'Wrote a ranked summary of ten lines or fewer.',
    ],
    questions: [
      {
        question:
          'Why is wrapping the SELECT and INSERT in a transaction at READ COMMITTED not enough to prevent the double check-in?',
        answer:
          "At READ COMMITTED each statement sees data committed before it started, and a plain SELECT takes no lock on rows that do not exist yet. Two transactions can both run the SELECT, both see zero rows, and both INSERT; there is no conflicting row for either to wait on. The transaction gives atomicity for each request's own steps but not mutual exclusion between requests. You need something that conflicts on the business key: a unique constraint (the database rejects the second insert), SERIALIZABLE isolation with retries, or an explicit lock such as `SELECT ... FOR UPDATE` on the user or café row or an advisory lock. The unique constraint is usually simplest because it also protects against every other code path that inserts check-ins.",
      },
      {
        question:
          'The author replies: "We validate userId on the client, so taking it from the body is fine." How do you respond?',
        answer:
          "Client validation is a usability feature, not a security control, because anyone can call the API directly with curl or a modified app. The server must derive identity from something the client cannot forge, such as a verified session or a validated token, and authorise the action for that identity. I would keep the comment blocking, give the concrete exploit (a script posting check-ins with other users' IDs to farm or grief loyalty points), and suggest using the auth middleware's `req.user.id` and ignoring any userId in the body. I would phrase it as a fact about trust boundaries rather than a judgment of the author, and offer to pair on the change if the auth middleware is unfamiliar.",
      },
      {
        question: 'When is it right to approve a PR that still has open comments?',
        answer:
          "When every remaining comment is genuinely non-blocking: style suggestions, optional refactors, or follow-ups that are tracked elsewhere, and the change improves the codebase overall. Approving with comments respects the author's time and avoids an extra review round trip for small items. You should say explicitly which comments you consider optional so the author does not have to guess. You should not approve with open correctness, security, data-integrity or migration-safety issues, or when you have not actually reviewed a risky part of the change; in that case say what you did not review so someone else can.",
      },
    ],
    explainPrompt:
      "Explain to a mid-level teammate, as if in a 1:1 after this review, how you approach reviewing a backend PR: the order you read it in, what you look for first, and how you decide what blocks the merge. Use the check-in PR as your running example.",
    rubric: [
      'Describes a deliberate order of review passes and why correctness and security come before style.',
      'Uses at least two concrete bugs from the PR with their failure scenarios.',
      'Explains a clear rule for what counts as blocking versus a suggestion or nit.',
      'Covers how to phrase comments (labels, scenarios, questions when unsure, about code not people).',
      'Mentions summarising and stating what was not reviewed.',
    ],
    referenceExplanation:
      "I read a PR in passes, each with one question, because trying to notice everything at once means you mostly notice formatting. First intent: what is this supposed to do? The check-in PR has three rules: once per user per café per day, within 200 metres, ten points each. Then correctness against those rules, including duplicate and concurrent requests. That is where the race shows up: the code SELECTs for today's check-in and then INSERTs, so a double-tap passes the check twice and awards twenty points. Then security: where does each value come from? `userId` comes from the request body, so anyone can check in as anyone, and `sort` is concatenated into ORDER BY, which is SQL injection. Then data and operability: there is no unique constraint backing the rule, and `awardPoints` runs outside a transaction, so a failure leaves a check-in without points and a retry gets a 409. Tests and style come last, because tools catch most style issues.\n\nMy rule for blocking is: would merging this create a bug, a security or privacy problem, or data that is hard to repair? If yes, it blocks, and I write the scenario so the author can see it for themselves. If it is taste, it is a suggestion or a nit, and I label it that way. When I am unsure, like the unused opening hours, I ask a question. I finish with a short summary: the three blockers, what I did not review, and one thing done well, so the author knows exactly what to do next.",
    stretch: {
      title: 'Review a migration for lock safety',
      description:
        "Write a follow-up migration that adds `checkin_date` and the unique constraint to a checkins table that already has 50 million rows in production. Research which Postgres operations take an ACCESS EXCLUSIVE lock, use `CREATE UNIQUE INDEX CONCURRENTLY` and then `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX`, and write the review comment you would leave on a naive version.",
    },
    lightTask:
      "Spend 30 minutes reviewing only the POST handler in the PR #318 diff. Write the three most important findings as Conventional Comments with a severity label and a concrete failure scenario each, plus a three-line summary.",
    intensiveExtras: [
      'Run the race script, implement the unique-constraint fix, and add a test that fires 10 concurrent check-ins and asserts exactly one row and 10 points.',
      'Pick a real merged PR from an open-source project you use, review it with the same passes, and compare your findings with the comments the maintainers actually left.',
      'Rewrite the GET endpoint with an allowlisted sort, a privacy-safe response shape, and cursor pagination from week 3.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['technical-communication', 'backend-services', 'production-reliability', 'feature-ownership'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 21 — Selective algorithms
  // ---------------------------------------------------------------------------
  {
    week: 21,
    slug: 'selective-algorithms-pointers-windows-graphs',
    title: 'Selective algorithms: two pointers, sliding window, BFS/DFS',
    track: 'interview',
    secondaryTracks: ['cs'],
    topics: [
      'two pointers',
      'sliding window',
      'BFS',
      'DFS',
      'topological sort',
      'pattern recognition',
      'NeetCode',
    ],
    objective:
      "By the end you can recognise when a problem is a two-pointer, sliding-window or graph-traversal problem, write each pattern from a template without looking it up, and connect it to product code you already write.",
    whyItMatters:
      "Coding interviews for product engineers still commonly include one or two algorithmic problems, and most of them reduce to a small set of patterns. Learning the patterns, rather than memorising hundreds of problems, gives you most of the benefit for a fraction of the time. The same patterns show up in real work: rolling windows for rate limits and spam detection, merging sorted feeds, and graph traversal for dependencies and permissions.",
    explanation: [
      "The goal this week is pattern recognition, not volume. Each pattern has a trigger (a feature of the problem statement that suggests it), an invariant (what is always true about your pointers or queue), and a template. If you can state those three things, you can solve unfamiliar problems in the family. Time-box every problem to 25 minutes: if you are stuck, read the approach (not the code), close it, and write the solution yourself. Grinding past that point teaches frustration, not patterns.",
      "Two pointers. Trigger: a sorted array or string, and you are looking for a pair, or you need to compare from both ends. Invariant: everything outside the pointers has already been ruled out. In Two Sum II on a sorted array, if `nums[l] + nums[r]` is too small, no pair using `l` with anything left of `r` can work, so `l++` is safe; that argument, not the code, is what an interviewer wants to hear. Product cousin: merging two sorted lists, such as combining 'cafés you follow' and 'cafés nearby' feeds that are each sorted by score, or checking whether two sorted booking intervals overlap.",
      "Sliding window. Trigger: 'longest/shortest/maximum contiguous subarray or substring such that...'. Invariant: the window `[left, right]` always satisfies (or is about to be repaired to satisfy) the condition, and you move `right` forward one step at a time, then move `left` forward until the window is valid again. Because each pointer only moves forward, the whole thing is O(n) even though there is a nested loop. Product cousin: 'flag a user who posts more than 5 reviews in any 60-minute window' over sorted timestamps, or a rolling 7-day check-in count. A sliding-window rate limiter (week 38) is the same idea.",
      "BFS and DFS. Trigger: a grid, a graph, a tree, 'connected', 'reachable', 'shortest number of steps', or 'order with dependencies'. BFS with a queue explores in layers, so the first time you reach a node is via the shortest path in an unweighted graph; DFS goes deep first and is natural for counting components, detecting cycles and topological order. Always track visited nodes, and mark them when you enqueue, not when you dequeue, or the same node gets queued many times. In JavaScript, `Array.prototype.shift()` is O(n), so for large BFS use a head index into an array instead. Product cousins: running database migrations or build steps in dependency order (Course Schedule is exactly cycle detection plus topological sort), 'people within two hops' features, and flood fill in canvas tools.",
      "In an interview, narrate the pattern choice before coding: restate the problem, give a brute-force complexity, name the pattern and the invariant, then code, then test with a small example and an edge case (empty input, one element, all duplicates). This is a communication exercise as much as a coding one, and it is the part that experienced product engineers often under-practise because day-to-day work rarely asks you to justify a loop out loud.",
    ],
    examples: [
      {
        language: 'js',
        title: 'Variable-size sliding window template, plus a product use',
        code: `// Template: longest window where the condition holds.
function longestValidWindow(items, isValidAfterAdding, removeLeft) {
  let left = 0;
  let best = 0;
  for (let right = 0; right < items.length; right++) {
    // 1. add items[right] to the window state
    // 2. while the window is invalid, remove items[left] and left++
    while (!isValidAfterAdding(items, left, right)) {
      removeLeft(items[left]);
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}

// Product use: does any 60-minute window contain more than 5 reviews?
// timestamps must be sorted ascending (ms).
function hasReviewBurst(timestamps, windowMs = 60 * 60 * 1000, limit = 5) {
  let left = 0;
  for (let right = 0; right < timestamps.length; right++) {
    while (timestamps[right] - timestamps[left] >= windowMs) left++;
    if (right - left + 1 > limit) return true;
  }
  return false;
}`,
      },
      {
        language: 'js',
        title: 'BFS on a grid with an index-based queue',
        code: `function shortestSteps(grid, start, goal) {
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (r, c) => r * cols + c;
  const visited = new Set([key(start[0], start[1])]);
  const queue = [[start[0], start[1], 0]];
  let head = 0;                               // avoid O(n) queue.shift()
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (head < queue.length) {
    const [r, c, dist] = queue[head++];
    if (r === goal[0] && c === goal[1]) return dist;
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      if (grid[nr][nc] === '#' || visited.has(key(nr, nc))) continue;
      visited.add(key(nr, nc));               // mark on enqueue
      queue.push([nr, nc, dist + 1]);
    }
  }
  return -1;
}`,
      },
    ],
    keyTakeaways: [
      'Learn patterns as trigger, invariant and template, not as a list of solved problems.',
      'Two pointers work because the invariant lets you discard a whole region of candidates at each step.',
      'Sliding window is O(n) because each pointer only moves forward.',
      'BFS gives shortest paths in unweighted graphs; mark visited on enqueue.',
      'Time-box problems to 25 minutes and read the approach, not the code, when stuck.',
      'Narrate: brute force, pattern, invariant, code, test.',
    ],
    prerequisites: ['Comfortable with arrays, hash maps and sets in JS/TS', 'Big-O basics'],
    prerequisiteWeeks: [14],
    resources: [
      {
        title: 'NeetCode practice',
        url: 'https://neetcode.io/practice',
        kind: 'practice',
        note: "Use the 'Two Pointers', 'Sliding Window' and 'Graphs' categories to find this week's problems by name. Watch the explanation video only after a 25-minute attempt.",
        minutes: 10,
      },
      {
        title: 'NeetCode roadmap',
        url: 'https://neetcode.io/roadmap',
        kind: 'practice',
        note: 'Look at how the categories depend on each other so you can see why arrays/hashing come before two pointers and trees before graphs. Do not start working through it.',
        minutes: 5,
        verify: true,
      },
      {
        title: 'MIT 6.006 Introduction to Algorithms (OpenCourseWare)',
        url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
        kind: 'course',
        note: 'Optional depth: read the lecture notes on breadth-first search and depth-first search for the correctness arguments behind the templates.',
        minutes: 15,
        verify: true,
      },
    ],
    exercise: {
      title: 'Three patterns, three problems, one product function',
      scenario:
        "You have 60 minutes. Instead of grinding, you will solve one problem per pattern under a time box, then apply the sliding-window pattern to a real NearBrew need: detecting review spam bursts before they reach a café's rating.",
      setup: [
        'Create a folder `algos-w21` with a file `patterns.mjs` (starter below). Run with `node patterns.mjs` (Node 18+).',
        'Open neetcode.io/practice in a browser to find the problems by name.',
      ],
      steps: [
        "Pick one problem from each group below and set a 25-minute timer for each, or 20 minutes if you want time for step 4. Two pointers: 'Valid Palindrome', 'Two Sum II - Input Array Is Sorted', 'Container With Most Water'. Sliding window: 'Best Time to Buy and Sell Stock', 'Longest Substring Without Repeating Characters'. Graphs: 'Number of Islands', 'Rotting Oranges', 'Course Schedule'.",
        "Before coding each one, write three lines as a comment: the trigger you noticed, the invariant, and the brute-force complexity versus your target complexity.",
        "Solve it locally in `patterns.mjs` first (the starter has two of them with tests), then paste into the site to run the full test suite.",
        "Implement `hasReviewBurst` from the starter without looking at the worked example, and make its tests pass.",
        "For each solved problem, write one sentence naming a place in NearBrew or a booking/SaaS product where the same pattern appears.",
      ],
      starter: [
        {
          language: 'js',
          title: 'patterns.mjs',
          code: `import assert from 'node:assert/strict';

// Sliding window: 'Longest Substring Without Repeating Characters'
// Trigger: longest contiguous substring such that ... -> window.
function lengthOfLongestSubstring(s) {
  // TODO: left pointer, Map of char -> last index (or a Set), best length
  return 0;
}

// Graph DFS/BFS: 'Number of Islands'
// grid is an array of arrays of '1' (land) and '0' (water).
function numIslands(grid) {
  // TODO: for each unvisited '1', traverse its component and count 1
  return 0;
}

// Product: any window of windowMs containing more than limit reviews?
function hasReviewBurst(sortedTimestamps, windowMs, limit) {
  // TODO
  return false;
}

assert.equal(lengthOfLongestSubstring('abcabcbb'), 3);
assert.equal(lengthOfLongestSubstring('bbbbb'), 1);
assert.equal(lengthOfLongestSubstring('pwwkew'), 3);
assert.equal(lengthOfLongestSubstring(''), 0);

assert.equal(numIslands([
  ['1', '1', '0', '0'],
  ['1', '0', '0', '1'],
  ['0', '0', '1', '1'],
]), 2);
assert.equal(numIslands([['0']]), 0);

const min = 60 * 1000;
assert.equal(hasReviewBurst([0, 1, 2, 3, 4, 5].map((m) => m * min), 60 * min, 5), true);
assert.equal(hasReviewBurst([0, 15, 30, 45, 61, 75].map((m) => m * min), 60 * min, 5), false);
assert.equal(hasReviewBurst([], 60 * min, 5), false);

console.log('all tests passed');`,
        },
      ],
      expected: [
        "`node patterns.mjs` prints 'all tests passed'.",
        'Each solution is O(n) (or O(rows x cols) for grids) and you can say why in one sentence.',
        'You have a written trigger/invariant note for each of the three problems.',
      ],
      hints: [
        "Longest substring: when you see a repeated character, jump `left` to one past its last index, but never move `left` backwards (use `Math.max`).",
        "Number of Islands: mutating the grid (set visited land to '0') is a valid visited set, but say out loud that you are doing it and that it destroys the input.",
        "Course Schedule: build an adjacency list and in-degree counts, then BFS from courses with in-degree 0 (Kahn's algorithm). If you process fewer than numCourses nodes, there is a cycle.",
        "Rotting Oranges is multi-source BFS: put every rotten orange in the queue at minute 0.",
      ],
      verification: [
        'All starter tests pass and the three NeetCode submissions are accepted.',
        'You can explain each invariant aloud in under 30 seconds without looking at your code.',
        'Each problem took 25 minutes or less, or you wrote down where you got stuck and which pattern step you missed.',
      ],
    },
    successChecklist: [
      'Solved one two-pointer, one sliding-window and one graph problem within the time box.',
      'Wrote trigger, invariant and complexity notes before coding each.',
      'Implemented `hasReviewBurst` with passing tests.',
      'Mapped each pattern to a concrete product use.',
      'Stopped and read the approach (not code) when stuck, instead of grinding.',
    ],
    questions: [
      {
        question:
          'The sliding-window solution has a `while` loop inside a `for` loop. Why is it O(n) and not O(n squared)?',
        answer:
          "Because both pointers only ever move forward. The `for` loop advances `right` n times in total, and across the entire run the inner `while` can advance `left` at most n times in total, since `left` never exceeds `right` and never moves back. So the total work is at most 2n pointer moves plus constant work per move, which is O(n). This is an amortised argument: an individual iteration of the outer loop can do a lot of inner work, but the total is bounded. Being able to state this distinguishes understanding from memorisation.",
      },
      {
        question: 'Why does BFS find the shortest path in an unweighted graph, and when does it stop being correct?',
        answer:
          "BFS processes nodes in order of distance from the start: all nodes at distance 1, then all at distance 2, and so on, because the queue is first-in first-out and each node's neighbours are enqueued one step further away. So the first time a node is reached, it is reached by a minimum-length path. This breaks when edges have different weights, because a path with more edges can be cheaper; then you need Dijkstra's algorithm with a priority queue (or 0-1 BFS for weights of only 0 and 1). It also gives wrong answers if you forget to track visited nodes, since nodes get re-expanded and the work can explode.",
      },
      {
        question: 'Give a real product feature where Course Schedule (cycle detection and topological sort) is the right tool.',
        answer:
          "Ordering anything with dependencies: running database migrations that declare which migrations they depend on, building packages in a monorepo, or scheduling onboarding steps where some require others. You model items as nodes and 'A must happen before B' as a directed edge, then use Kahn's algorithm: repeatedly take nodes with no remaining prerequisites. If some nodes never reach in-degree zero, there is a cycle and you should fail with a clear error naming the cycle rather than hanging or picking an arbitrary order. The same detection prevents a misconfigured permission inheritance graph from looping forever.",
      },
    ],
    explainPrompt:
      "Explain to an interviewer, as you would at the start of a coding round, how you recognised that 'Longest Substring Without Repeating Characters' is a sliding-window problem, what invariant your window maintains, and why your solution is O(n).",
    rubric: [
      'States the brute-force approach and its complexity before the optimised one.',
      'Names the trigger in the problem statement that suggested a sliding window.',
      'States the invariant precisely (the window contains no duplicates).',
      'Gives the amortised argument for O(n).',
      'Mentions edge cases tested (empty string, all same character).',
    ],
    referenceExplanation:
      "The brute force is to check every substring for duplicates, which is O(n squared) substrings times the check, so O(n cubed), or O(n squared) with a set. The phrase 'longest substring such that' is my cue for a sliding window: the answer is a contiguous range, and if a range is valid then any smaller range inside it is also valid, so I can grow and shrink a window instead of restarting.\n\nMy invariant is that the characters between `left` and `right` inclusive are all distinct. I move `right` one character at a time. I keep a map from each character to the last index where I saw it. If the new character was last seen at or after `left`, the window now has a duplicate, so I move `left` to one past that previous index, which restores the invariant in one step. I use `Math.max` so `left` never moves backwards for characters seen before the window. After each step I record `right - left + 1` if it is the best so far.\n\nIt is O(n) because `right` moves n times and `left` only moves forward, so the total pointer movement is at most 2n, with constant-time map operations each step. Space is O(k) for the distinct characters. I would test the empty string, which returns 0, a string of one repeated character, which returns 1, and 'pwwkew', where the answer 'wke' starts in the middle.",
    stretch: {
      title: "Minimum Window Substring under 30 minutes",
      description:
        "Attempt 'Minimum Window Substring' (a hard sliding-window problem) with a 30-minute box. It uses the same template but tracks counts of required characters and a 'formed' counter. Write the invariant first.",
    },
    lightTask:
      "Solve only 'Longest Substring Without Repeating Characters' in the starter file within 25 minutes, then write three lines: trigger, invariant, and why it is O(n).",
    intensiveExtras: [
      'Solve the remaining problems from each group with the same 25-minute boxes.',
      "Implement Course Schedule with both Kahn's algorithm and DFS with three-colour marking, and compare which you can explain more clearly.",
      'Write `mergeSortedFeeds(a, b, limit)` with two pointers for two score-sorted café lists, deduplicating by café id.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['cs-fundamentals', 'js-ts', 'technical-communication'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 22 — Java fundamentals
  // ---------------------------------------------------------------------------
  {
    week: 22,
    slug: 'java-fundamentals-for-js-php-engineers',
    title: 'Java fundamentals for JS/PHP engineers',
    track: 'backend',
    secondaryTracks: ['cs'],
    topics: [
      'Java',
      'static typing',
      'records',
      'collections',
      'generics',
      'equals and hashCode',
      'exceptions',
      'streams',
      'threads',
      'ExecutorService',
      'virtual threads',
    ],
    objective:
      "By the end you can read and write idiomatic modern Java (21): model data with records and sealed interfaces, pick the right collection, avoid the equals/hashCode trap, and explain why a shared counter needs an atomic or a lock when threads are real.",
    whyItMatters:
      "Many large backend platforms, including much of the JVM-heavy streaming and media industry, run on Java, and full-stack roles often expect you to read and change Java services even if you mostly write TypeScript. The language is not hard for a TypeScript engineer, but a few differences (real threads with shared memory, value vs reference equality, checked exceptions, primitive vs boxed types) cause real bugs if you carry JS or PHP habits over.",
    explanation: [
      "Start with what transfers. Java is statically typed like TypeScript, but the types are real at runtime: there is no `any` escape hatch that silently lets the wrong shape through, and casts are checked (a bad cast throws `ClassCastException`). Generics are erased at runtime, a bit like TypeScript types, so you cannot write `new T()` or check `instanceof List<String>`. `var` gives local type inference. There are primitive types (`int`, `long`, `double`, `boolean`) and boxed object types (`Integer`, `Long`), and the difference matters: a `Map<String, Integer>` holds objects, unboxing a `null` Integer throws `NullPointerException`, and comparing two `Integer` objects with `==` compares references, which happens to work for small cached values and fails for larger ones. Use `.equals` for objects.",
      "Modern Java models data much like TypeScript domain modelling from week 6. A `record Cafe(String id, String name, double rating) {}` gives you an immutable class with a constructor, accessors (`cafe.name()`), and correct `equals`, `hashCode` and `toString`. A compact constructor in the record can validate input. A `sealed interface CheckInResult permits Accepted, Rejected` plus records is Java's discriminated union, and since Java 21 a `switch` over it with record or type patterns is checked for exhaustiveness by the compiler, just like a TypeScript `never` check. `Optional<T>` is the conventional way to return 'maybe absent' from a method, though fields and parameters usually just use null with documentation.",
      "Collections: `List` (usually `ArrayList`), `Map` (usually `HashMap`, or `LinkedHashMap` when you need insertion order like a JS object, or `TreeMap` for sorted keys), `Set` (`HashSet`), and `Deque` (`ArrayDeque`) for stacks and queues. `List.of(...)` and `Map.of(...)` create immutable collections that throw on modification. Hash-based collections rely on `equals` and `hashCode` being consistent: if you write a class with custom equality and forget `hashCode`, or use a mutable object as a key and then change it, `map.get` returns null for a key that is visibly there. Records avoid this because they generate both from their components. Streams (`reviews.stream().collect(Collectors.groupingBy(...))`) are the equivalent of chained `map`/`filter`/`reduce`, but lazy and single-use.",
      "Exceptions: Java distinguishes checked exceptions (subclasses of `Exception` but not `RuntimeException`, such as `IOException`), which a method must declare with `throws` or catch, from unchecked ones (`RuntimeException`, such as `IllegalArgumentException`), which it need not. The compiler forces you to think about checked ones; many modern codebases wrap them into unchecked domain exceptions at boundaries. `try-with-resources` (`try (var conn = pool.getConnection()) { ... }`) closes resources automatically, playing the role of `finally { client.release() }` in Node.",
      "Concurrency is the biggest mental shift. In Node your JavaScript runs on one thread, so `count++` can never be interleaved by another request mid-operation. In Java, a server typically handles requests on many threads that share the same heap, so two threads can both read `count` as 41 and both write 42: a lost update, exactly the read-modify-write race from week 7 but in memory. The fixes are to avoid shared mutable state (prefer immutable records and local variables), use thread-safe types (`AtomicInteger`, `ConcurrentHashMap` with `merge` or `compute`), or guard a critical section with `synchronized` or a `ReentrantLock`. You rarely create raw `Thread`s; you submit tasks to an `ExecutorService`. Java 21 added virtual threads (`Executors.newVirtualThreadPerTaskExecutor()`), which are cheap enough to have one per request and let blocking code scale, but they do not remove data races: shared state still needs the same protection.",
    ],
    examples: [
      {
        language: 'java',
        title: 'TypeScript idioms and their Java equivalents',
        code: `// TS: type Review = { cafeId: string; rating: number }
record Review(String cafeId, int rating) {
    Review {                                   // compact constructor validates
        if (rating < 1 || rating > 5) throw new IllegalArgumentException("rating 1-5");
    }
}

// TS: type Result = { kind: 'ok'; points: number } | { kind: 'rejected'; reason: string }
sealed interface Result permits Ok, Rejected {}
record Ok(int points) implements Result {}
record Rejected(String reason) implements Result {}

static String describe(Result r) {
    return switch (r) {                        // compiler checks exhaustiveness
        case Ok ok -> "+" + ok.points();
        case Rejected rej -> "rejected: " + rej.reason();
    };
}

// TS: const byCafe = groupBy(reviews, r => r.cafeId)
Map<String, Double> avg = reviews.stream()
    .collect(Collectors.groupingBy(Review::cafeId, Collectors.averagingInt(Review::rating)));

// TS: counts[cafeId] = (counts[cafeId] ?? 0) + 1   (safe in Node: one thread)
ConcurrentHashMap<String, Integer> counts = new ConcurrentHashMap<>();
counts.merge(cafeId, 1, Integer::sum);         // atomic per key across threads`,
      },
    ],
    keyTakeaways: [
      'Use `.equals` for objects; `==` on boxed types compares references.',
      'Records give immutable data with correct equals/hashCode; sealed interfaces plus switch patterns give checked discriminated unions.',
      'Hash collections break if equals/hashCode are inconsistent or keys are mutated.',
      'Checked exceptions must be declared or caught; try-with-resources closes resources.',
      'Java threads share memory, so read-modify-write on shared state is a race; use atomics, concurrent collections or locks.',
      'Virtual threads make blocking cheap; they do not make shared state safe.',
    ],
    prerequisites: ['A JDK 21 or newer installed (`java -version`)', 'TypeScript domain modelling'],
    prerequisiteWeeks: [6, 14],
    resources: [
      {
        title: 'dev.java: Learn Java',
        url: 'https://dev.java/learn/',
        kind: 'docs',
        note: 'Read the tutorials on records, sealed classes, and pattern matching for switch. These are the modern features the older Oracle tutorial does not cover.',
        minutes: 12,
      },
      {
        title: 'The Java Tutorials: Collections',
        url: 'https://docs.oracle.com/javase/tutorial/collections/',
        kind: 'docs',
        note: 'Read the interfaces overview (List, Set, Map, Deque) and the Object Ordering page. The tutorial targets Java 8, so ignore older syntax where dev.java shows a newer way.',
        minutes: 8,
      },
      {
        title: 'The Java Tutorials: Concurrency',
        url: 'https://docs.oracle.com/javase/tutorial/essential/concurrency/',
        kind: 'docs',
        note: "Read 'Thread Interference', 'Memory Consistency Errors', 'Synchronized Methods' and 'Atomic Variables'. They explain exactly the lost-update bug you will reproduce.",
        minutes: 8,
      },
      {
        title: 'JEP 444: Virtual Threads',
        url: 'https://openjdk.org/jeps/444',
        kind: 'docs',
        note: 'Read the Summary, Goals and Non-Goals, and the section on the thread-per-request style to understand what virtual threads change and what they do not.',
        minutes: 5,
      },
      {
        title: 'JEP 330: Launch Single-File Source-Code Programs',
        url: 'https://openjdk.org/jeps/330',
        kind: 'docs',
        note: 'Skim the summary: this is why `java Main.java` works without a separate `javac` step or a build tool.',
        minutes: 2,
      },
    ],
    exercise: {
      title: 'NearBrew review stats and a real thread race in one Java file',
      scenario:
        "NearBrew's ratings service is being considered for a port to a JVM service. You will prototype the core in Java: compute café averages from reviews, model check-in results as a sealed type, see the equals/hashCode trap, and reproduce a lost-update race that cannot happen in single-threaded Node.",
      setup: [
        'Install a JDK 21+ (for example Eclipse Temurin or any OpenJDK build). Check with `java -version`.',
        'Create a folder `java-w22` and save the starter as `Main.java`. Run it with `java Main.java`; no build tool is needed.',
      ],
      steps: [
        'Run the starter unchanged. It should compile and throw `UnsupportedOperationException` from TODO 1. Read the stack trace: Java shows the exact line, which is worth getting used to.',
        'TODO 1: implement `averageRatings` with a stream and `Collectors.groupingBy` plus `Collectors.averagingInt`. Then implement it again with a plain `for` loop and a `HashMap` and confirm both give the same result.',
        'TODO 2: implement `topCafes` returning the n café ids with the highest average, highest first. Use `Map.Entry.comparingByValue()` reversed.',
        'TODO 3: run `equalityTrap()`. Explain in a comment why `map.get` returns null for `MutableKey`, then fix it twice: once by adding `equals` and `hashCode`, once by replacing the class with a record.',
        'TODO 4: add a third `CheckInResult` variant, `record RateLimited(int retryAfterSeconds)`, to the `permits` list. Observe that `describe` no longer compiles until you handle it. This is the exhaustiveness check.',
        "TODO 5: run `raceDemo()` several times. Note the unsafe count each time. Then add a third counter guarded by `synchronized` on a lock object and confirm it is always correct.",
        'TODO 6: swap the fixed thread pool for `Executors.newVirtualThreadPerTaskExecutor()` and rerun. Confirm the unsafe counter is still wrong.',
      ],
      starter: [
        {
          language: 'java',
          title: 'Main.java',
          code: `import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.*;

public class Main {

    record Review(String cafeId, String userId, int rating) {
        Review {
            if (rating < 1 || rating > 5) {
                throw new IllegalArgumentException("rating must be 1-5, got " + rating);
            }
        }
    }

    sealed interface CheckInResult permits Accepted, Rejected {}
    record Accepted(String cafeId, int pointsAwarded) implements CheckInResult {}
    record Rejected(String reason) implements CheckInResult {}

    // TODO 1: cafeId -> average rating
    static Map<String, Double> averageRatings(List<Review> reviews) {
        throw new UnsupportedOperationException("TODO 1");
    }

    // TODO 2: ids of the n highest-rated cafes, best first
    static List<String> topCafes(Map<String, Double> averages, int n) {
        throw new UnsupportedOperationException("TODO 2");
    }

    static String describe(CheckInResult r) {
        return switch (r) {
            case Accepted a -> "Accepted at " + a.cafeId() + " (+" + a.pointsAwarded() + " points)";
            case Rejected rej -> "Rejected: " + rej.reason();
        };
    }

    // TODO 3: why does lookup fail? Fix with equals/hashCode, then with a record.
    static class MutableKey {
        String cafeId;
        MutableKey(String cafeId) { this.cafeId = cafeId; }
    }

    static void equalityTrap() {
        Map<MutableKey, Integer> checkins = new HashMap<>();
        checkins.put(new MutableKey("cafe-1"), 3);
        System.out.println("lookup cafe-1 -> " + checkins.get(new MutableKey("cafe-1")));

        Integer a = 1000, b = 1000;
        System.out.println("1000 == 1000 ? " + (a == b) + ", equals ? " + a.equals(b));
    }

    static int unsafeCounter = 0;

    static void raceDemo() throws InterruptedException {
        unsafeCounter = 0;
        AtomicInteger atomicCounter = new AtomicInteger();
        int tasks = 100, incrementsPerTask = 10_000;

        ExecutorService pool = Executors.newFixedThreadPool(8);
        for (int t = 0; t < tasks; t++) {
            pool.submit(() -> {
                for (int i = 0; i < incrementsPerTask; i++) {
                    unsafeCounter++;                 // read, add, write: not atomic
                    atomicCounter.incrementAndGet(); // atomic
                }
            });
        }
        pool.shutdown();
        pool.awaitTermination(30, TimeUnit.SECONDS);

        System.out.println("expected=" + (tasks * incrementsPerTask)
            + " unsafe=" + unsafeCounter + " atomic=" + atomicCounter.get());
    }

    public static void main(String[] args) throws Exception {
        List<Review> reviews = List.of(
            new Review("cafe-1", "u1", 5), new Review("cafe-1", "u2", 4),
            new Review("cafe-2", "u1", 3), new Review("cafe-3", "u3", 5),
            new Review("cafe-3", "u4", 5), new Review("cafe-2", "u5", 2)
        );
        Map<String, Double> averages = averageRatings(reviews);
        System.out.println("averages: " + averages);
        System.out.println("top 2: " + topCafes(averages, 2));

        System.out.println(describe(new Accepted("cafe-1", 10)));
        System.out.println(describe(new Rejected("already checked in today")));

        equalityTrap();
        raceDemo();
    }
}`,
        },
      ],
      expected: [
        'averages prints cafe-1=4.5, cafe-2=2.5, cafe-3=5.0 (HashMap order may vary) and top 2 prints [cafe-3, cafe-1].',
        "The original `MutableKey` lookup prints null; after either fix it prints 3.",
        '`1000 == 1000` prints false for boxed Integers while `equals` prints true.',
        'The unsafe counter is usually below 1,000,000 and varies between runs; the atomic and synchronized counters are always exactly 1,000,000, with both platform and virtual threads.',
        'Adding `RateLimited` to `permits` makes `describe` fail to compile until a case is added.',
      ],
      hints: [
        "`Collectors.groupingBy(Review::cafeId, Collectors.averagingInt(Review::rating))` does TODO 1 in one expression.",
        "For TODO 2: `averages.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed()).limit(n).map(Map.Entry::getKey).toList()`. The explicit type witness is needed because inference fails through `.reversed()`.",
        "Without `equals` and `hashCode`, two `MutableKey` objects are only equal if they are the same object, so a new key with the same contents lands in a different bucket and never matches.",
        "If the unsafe counter happens to come out correct, increase `incrementsPerTask` or the pool size; races are probabilistic, which is exactly why they slip past tests.",
      ],
      verification: [
        '`java Main.java` runs to completion with no exceptions after all TODOs.',
        'You can explain, in two sentences, why `unsafeCounter++` loses updates in Java but the same line in a Node request handler would not.',
        'Your `describe` switch has no `default` branch, so the compiler is still checking exhaustiveness.',
      ],
    },
    successChecklist: [
      'Implemented averages with both streams and a loop.',
      'Fixed the HashMap key bug with equals/hashCode and with a record, and can explain the cause.',
      'Explained why boxed `==` fails for 1000.',
      'Saw the compiler enforce exhaustiveness on a sealed interface.',
      'Reproduced the lost-update race and fixed it two ways (atomic and synchronized).',
      'Confirmed that virtual threads do not fix the race.',
    ],
    questions: [
      {
        question: 'Why can `count++` lose updates in a Java service but not in a Node.js request handler?',
        answer:
          "In Java, request handlers run on multiple OS threads (or virtual threads scheduled on several carrier threads) that share the heap and run in parallel. `count++` is three steps: read, add one, write, so two threads can read the same value and both write the same incremented result, losing one update. Java's memory model also allows one thread not to see another's writes promptly without synchronisation. In Node, your JavaScript runs on a single thread and a synchronous statement like `count++` runs to completion before any other callback can start. Node can still have logical races across `await` points, where state changes between a read and a later write, but not within one synchronous expression.",
      },
      {
        question: 'What problems do records solve compared with a hand-written class, and what do they not do?',
        answer:
          "A record declares a transparent, shallowly immutable data carrier: final fields, a canonical constructor, accessor methods, and `equals`, `hashCode` and `toString` generated from all components. That eliminates the common bug of inconsistent equals/hashCode and makes records safe as map keys and set members. A compact constructor lets you validate invariants at construction. Records do not make the objects they reference immutable, so a record holding a `List` can still be mutated through that list unless you copy it with `List.copyOf`. They also cannot extend other classes, though they can implement interfaces, which is what makes them fit sealed hierarchies.",
      },
      {
        question: 'When should you use `ConcurrentHashMap.merge` instead of `get` then `put`?',
        answer:
          "Whenever multiple threads may update the same key and the new value depends on the old one, such as counting check-ins per café. A `get` followed by a `put` is a check-then-act sequence: two threads can both read 5 and both write 6. `merge(key, 1, Integer::sum)` and `compute` perform the read-modify-write atomically for that key inside the map. Even a `ConcurrentHashMap` only makes its individual operations thread-safe; composing two operations yourself reintroduces the race. Using a plain `HashMap` from multiple threads is worse, since it can corrupt its internal structure.",
      },
    ],
    explainPrompt:
      "Explain to a TypeScript-focused teammate who is about to make their first change to a Java service the three Java differences most likely to cause a bug for them, with a concrete example of each from the NearBrew prototype.",
    rubric: [
      'Picks genuinely high-risk differences (shared-memory threads, reference vs value equality, equals/hashCode, null unboxing, checked exceptions).',
      'Gives a concrete NearBrew-flavoured example for each.',
      'States the fix or idiom for each, not just the problem.',
      'Correctly contrasts with Node/TypeScript behaviour.',
      'Is accurate about what virtual threads do and do not change.',
    ],
    referenceExplanation:
      "Three things will bite you coming from TypeScript. First, threads are real. In Node, `checkinCount++` in a handler is safe because only one piece of JavaScript runs at a time. In a Java service, many requests run in parallel on threads that share memory, so that line is a read, an add and a write that can interleave and lose updates. In my prototype, 100 tasks each incrementing 10,000 times usually gave well under a million. Use `AtomicInteger`, `ConcurrentHashMap.merge`, or keep state out of shared fields entirely. Virtual threads make blocking cheaper but do not change this.\n\nSecond, `==` compares references for objects. `Integer a = 1000, b = 1000; a == b` is false, while it is true for small numbers because of caching, so tests with small IDs can pass and production fail. Use `.equals`, or primitives.\n\nThird, hash collections depend on `equals` and `hashCode`. If you use a hand-written class as a map key without both methods, `map.get(new CafeKey(\"cafe-1\"))` returns null even though you just put that key in. Mutating a key after inserting it has the same effect. Prefer records for keys and value objects: they generate both methods and are immutable.\n\nA bonus: model results as a sealed interface with records and switch over it without a `default`. The compiler will then tell you every place to update when someone adds a new variant, the same safety you get from a discriminated union and a `never` check.",
    stretch: {
      title: 'A tiny HTTP endpoint with the JDK only',
      description:
        "Use `com.sun.net.httpserver.HttpServer` (bundled with the JDK) to serve `GET /cafes/top` from your averages, with a virtual-thread executor via `server.setExecutor(Executors.newVirtualThreadPerTaskExecutor())`. Load it with a quick Node script and count check-ins in a `ConcurrentHashMap` per request.",
    },
    lightTask:
      "Save the starter as `Main.java`, implement TODO 1 with streams, and run `raceDemo()` three times with `java Main.java`. Write two sentences explaining why the unsafe counter differs from the atomic one.",
    intensiveExtras: [
      "Rewrite the race fix with a `ReentrantLock` and `try/finally`, and compare its timing with `AtomicInteger` and `LongAdder` for 8 threads.",
      'Write a method that reads reviews from a CSV file with `Files.readAllLines`, and decide whether to propagate `IOException` or wrap it in an unchecked exception. Justify the choice in a comment.',
      'Port your week 21 `hasReviewBurst` function to Java with an `ArrayDeque<Long>` and compare the code with the JavaScript version.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['backend-services', 'cs-fundamentals', 'js-ts'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 23 — Observability
  // ---------------------------------------------------------------------------
  {
    week: 23,
    slug: 'observability-slis-slos-alerting',
    title: 'Observability: logs, metrics, traces, SLIs/SLOs, alerting',
    track: 'system-design',
    secondaryTracks: ['backend'],
    topics: [
      'structured logging',
      'metrics',
      'histograms',
      'percentiles',
      'distributed tracing',
      'OpenTelemetry',
      'SLI',
      'SLO',
      'error budgets',
      'burn-rate alerting',
      'cardinality',
    ],
    objective:
      "By the end you can instrument a service with structured logs, a latency histogram and request correlation, define an SLI and SLO for a user journey, and write an alert that pages on user pain rather than on noise.",
    whyItMatters:
      "During an incident you can only answer questions your telemetry was designed to answer. Teams that log unstructured strings, alert on CPU, and average their latency spend the first hour of an outage guessing. Teams with a clear SLO know immediately whether users are hurting, how fast the error budget is burning, and which dependency the slow traces point to.",
    explanation: [
      "Each signal answers a different question. Metrics are cheap numeric aggregates over time (request count, error count, latency distribution, queue depth) and answer 'is something wrong, and since when?'. Logs are discrete events with context and answer 'what exactly happened to this request?'. Traces follow one request across services as a tree of timed spans and answer 'where did the time go?'. You want all three linked by shared identifiers: a request ID or trace ID in every log line, so you can jump from a latency spike on a dashboard to example slow traces to the log lines of one failing request. The W3C Trace Context `traceparent` header is the standard way to propagate that ID between services, and OpenTelemetry is the vendor-neutral standard for producing all three signals.",
      "Logs should be structured: one JSON object per line with consistent field names (`ts`, `level`, `msg`, `route`, `status`, `duration_ms`, `request_id`, `user_id` where privacy allows) instead of interpolated sentences. Structured logs can be filtered and aggregated ('all 5xx on /cafes/nearby for cafe 42 in the last 10 minutes') without regular expressions. Log at boundaries (request in/out, calls to dependencies, retries, decisions that reject a request) rather than every function, and never log secrets, tokens or precise user locations.",
      "Metrics come in three main types: counters (only go up: requests, errors), gauges (go up and down: in-flight requests, queue depth, pool connections in use) and histograms (counts of observations in buckets, used for latency and payload size). Never alert on average latency: an average of 80 ms can hide 5% of users waiting 2 seconds. Use percentiles (p50, p95, p99) or, better for SLOs, 'the fraction of requests faster than a threshold', which histograms compute directly from a bucket boundary. Watch cardinality: every distinct combination of label values is a separate time series, so a label like `user_id` or raw URL path with IDs in it can create millions of series and overwhelm the metrics backend. Label by route template (`/cafes/:id`), status class and method instead. Two useful checklists: the 'four golden signals' from Google's SRE book (latency, traffic, errors, saturation) and RED for request-driven services (rate, errors, duration).",
      "An SLI (service level indicator) is a measured ratio of good events to valid events for something users care about, for example 'the proportion of /cafes/nearby requests that return a non-5xx response in under 300 ms'. An SLO (objective) is a target for that ratio over a window: 99.5% over 30 days. The gap from 100% is the error budget: 0.5% of requests may be bad. Over 30 days that is roughly 216 minutes of total outage, or a much longer period of partial degradation. The budget turns reliability into a decision tool: if the budget is healthy, ship faster; if it is nearly spent, prioritise reliability work. Choose SLIs at the user journey level (search, check-in, open café page), not per host, and measure as close to the user as practical, since a server-side metric does not see a broken CDN.",
      "Alerting should page a human only when users are hurting now or soon will be, and the page should be actionable. Alerting on symptoms (SLO burn) instead of causes (high CPU, one pod restarting) cuts noise, because many causes never affect users. Burn rate is how fast you are spending the budget relative to plan: a burn rate of 1 spends exactly the whole budget in the SLO window; a burn rate of 14.4 sustained for one hour spends 2% of a 30-day budget (14.4 x 1 hour / 720 hours). A common pattern is a fast-burn page (high burn rate over a short window, confirmed over a slightly longer one) and a slow-burn ticket (low burn rate over hours or days). Cause-level signals still belong on dashboards for diagnosis. Every page should link to a runbook and a dashboard.",
    ],
    examples: [
      {
        language: 'text',
        title: 'Structured log line, metric exposition, and an SLI query',
        code: `# One structured log line per request (JSON Lines)
{"ts":"2026-10-12T09:14:03.112Z","level":"warn","msg":"request completed","route":"/cafes/nearby","status":200,"duration_ms":842,"request_id":"5b1e...","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","db_ms":801}

# Prometheus text exposition for a latency histogram (cumulative buckets, seconds)
http_request_duration_seconds_bucket{route="/cafes/nearby",le="0.1"} 812
http_request_duration_seconds_bucket{route="/cafes/nearby",le="0.3"} 951
http_request_duration_seconds_bucket{route="/cafes/nearby",le="1"} 996
http_request_duration_seconds_bucket{route="/cafes/nearby",le="+Inf"} 1000
http_request_duration_seconds_count{route="/cafes/nearby"} 1000
http_requests_total{route="/cafes/nearby",status_class="5xx"} 18

# Latency SLI over 5 minutes: fraction of requests under 300 ms (PromQL)
sum(rate(http_request_duration_seconds_bucket{route="/cafes/nearby",le="0.3"}[5m]))
/
sum(rate(http_request_duration_seconds_count{route="/cafes/nearby"}[5m]))

# Error budget arithmetic for SLO = 99.5% over 30 days
budget = 0.5% of requests  ~=  0.005 x 43,200 min  =  216 min of full outage
burn rate 14.4 for 1 h  ->  14.4 / 720 = 2% of the monthly budget gone`,
      },
    ],
    keyTakeaways: [
      'Metrics say something is wrong, traces say where, logs say exactly what; link them with a trace or request ID.',
      'Log structured JSON at boundaries, never secrets or precise locations.',
      'Use histograms and percentiles or threshold ratios, never averages, for latency.',
      'High-cardinality labels (user IDs, raw paths) can take down a metrics system.',
      'An SLI is good events over valid events; the SLO target defines an error budget that guides priorities.',
      'Page on SLO burn rate (symptoms), keep causes on dashboards, and attach a runbook to every alert.',
    ],
    prerequisites: ['Node HTTP basics', 'Incident investigation from week 9'],
    prerequisiteWeeks: [9, 17, 19],
    resources: [
      {
        title: 'Google SRE book: Monitoring Distributed Systems',
        url: 'https://sre.google/sre-book/monitoring-distributed-systems/',
        kind: 'book',
        note: "Read the sections on symptoms versus causes, the four golden signals, and 'Worrying About Your Tail'. This is the source of most modern alerting philosophy.",
        minutes: 12,
      },
      {
        title: 'Google SRE book: Service Level Objectives',
        url: 'https://sre.google/sre-book/service-level-objectives/',
        kind: 'book',
        note: 'Read the definitions of SLI, SLO and SLA, and the parts on choosing indicators and targets. Note the advice to have as few SLOs as possible.',
        minutes: 10,
      },
      {
        title: 'OpenTelemetry documentation',
        url: 'https://opentelemetry.io/docs/',
        kind: 'docs',
        note: 'Read the concepts pages on signals (traces, metrics, logs) and context propagation. Skim the JavaScript getting-started page for the stretch task.',
        minutes: 8,
      },
      {
        title: 'W3C Trace Context',
        url: 'https://www.w3.org/TR/trace-context/',
        kind: 'docs',
        note: 'Skim the traceparent header format (version, trace-id, parent-id, flags) so you recognise it in request headers.',
        minutes: 3,
      },
      {
        title: 'Prometheus: Histograms and summaries',
        url: 'https://prometheus.io/docs/practices/histograms/',
        kind: 'docs',
        note: 'Optional: read why histograms can be aggregated across instances and summaries cannot, and how to choose buckets around your SLO threshold.',
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'Instrument NearBrew nearby search and write its SLO',
      scenario:
        "Users report that 'Cafés near me' is sometimes slow, but the dashboard shows average latency at 90 ms. You will instrument a simulated `/cafes/nearby` endpoint with no dependencies, generate load, compute what users actually experience, write an SLO, and design the alert.",
      setup: [
        'Node 18+ only. Create a folder `obs-w23` with `server.mjs` and `load.mjs` from the starter.',
        'Run `node server.mjs` in one terminal and `node load.mjs` in another.',
      ],
      steps: [
        'Run the server and the load script unchanged. Note that the server prints almost nothing useful and `/metrics` only shows an average.',
        'Add one structured JSON log line per request in a `finally` block with `route`, `status`, `duration_ms` and `request_id`. Use `warn` level when duration exceeds 300 ms and `error` for 5xx. Pipe output through `node server.mjs | grep error` to see it is filterable.',
        'Propagate correlation: if the request has an `x-request-id` header, reuse it; return it in the response header. In `load.mjs`, send your own ID for one request and find that exact request in the server logs.',
        'Replace the average with a histogram: cumulative bucket counts for 50, 100, 300, 500, 1000 ms and +Inf, plus a total count and a 5xx counter, exposed on `/metrics` in Prometheus text format. Also print p50, p95 and p99 computed from the raw samples for comparison.',
        "Compute the SLI from your metrics: good = non-5xx and under 300 ms; valid = all requests to the route. Write down the value you get from 1,000 requests.",
        'Write an SLO for the route (target, window, SLI definition), its error budget in requests per 30 days at 2 million requests/month, and two alert rules: a fast-burn page and a slow-burn ticket, each with the burn rate and windows you chose and the runbook link placeholder.',
        "Change the simulation so 10% of requests are slow instead of 5% and rerun. Calculate the burn rate against your SLO and decide whether your fast-burn page would fire.",
      ],
      starter: [
        {
          language: 'js',
          title: 'server.mjs',
          code: `import http from 'node:http';
import { randomUUID } from 'node:crypto';

const SLOW_FRACTION = 0.05;
const ERROR_FRACTION = 0.02;

const samples = [];          // durations in ms for /cafes/nearby
let totalMs = 0;

function log(level, msg, fields = {}) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }) + '\\n');
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

// Simulated geo query: usually fast, sometimes slow, occasionally fails.
async function findNearby(lat, lng) {
  const slow = Math.random() < SLOW_FRACTION;
  const delay = slow ? 400 + Math.random() * 900 : 15 + Math.random() * 40;
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (Math.random() < ERROR_FRACTION) throw new Error('db timeout');
  return [{ id: 1, name: 'Bean There' }, { id: 2, name: 'Grind House' }];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/metrics') {
    const avg = samples.length ? totalMs / samples.length : 0;
    res.writeHead(200, { 'content-type': 'text/plain' });
    // TODO: replace with histogram buckets, counters, and p50/p95/p99
    res.end('avg_latency_ms ' + avg.toFixed(1) + '\\n');
    return;
  }

  if (url.pathname === '/cafes/nearby') {
    const requestId = randomUUID(); // TODO: reuse incoming x-request-id
    const start = performance.now();
    let status = 200;
    try {
      const cafes = await findNearby(Number(url.searchParams.get('lat')), Number(url.searchParams.get('lng')));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(cafes));
    } catch (err) {
      status = 503;
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'temporarily unavailable' }));
    } finally {
      const ms = performance.now() - start;
      samples.push(ms);
      totalMs += ms;
      // TODO: one structured log line per request
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3000, () => log('info', 'listening', { port: 3000 }));`,
        },
        {
          language: 'js',
          title: 'load.mjs',
          code: `const TOTAL = 1000;
const CONCURRENCY = 20;
let sent = 0;

async function worker() {
  while (sent < TOTAL) {
    sent++;
    await fetch('http://localhost:3000/cafes/nearby?lat=51.52&lng=-0.08').then((r) => r.text());
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log('sent', TOTAL, 'requests in', Date.now() - started, 'ms');
console.log(await fetch('http://localhost:3000/metrics').then((r) => r.text()));`,
        },
      ],
      expected: [
        'The starter /metrics shows an average around 80 to 100 ms, which looks healthy.',
        'After instrumenting, p50 is around 40 ms but p99 is above 1 second, and roughly 5% of requests exceed 300 ms.',
        'Your SLI comes out near 0.93 (about 5% slow plus 2% errors bad), which already violates a 99.5% SLO, showing the simulated service is badly out of budget.',
        'You can find a single request by the ID you sent in `load.mjs` in the server log output.',
        "At 2 million requests a month, a 99.5% SLO allows 10,000 bad requests; your written alert rules state concrete burn rates and windows.",
      ],
      hints: [
        "Histogram buckets are cumulative: a 120 ms request increments the 300, 500, 1000 and +Inf buckets, not just one.",
        "Burn rate = observed bad fraction / allowed bad fraction. With 7% bad and 0.5% allowed, the burn rate is 14, which would exhaust a 30-day budget in about two days.",
        "Keep `route` as a template, never `url.href`: query strings with coordinates would make every request a unique label value.",
        "Use `x-request-id` for this exercise; in a real system you would usually take the trace ID from a `traceparent` header via OpenTelemetry.",
      ],
      verification: [
        '`curl -s localhost:3000/metrics` shows bucket lines whose counts never decrease from smaller to larger `le` values, and the +Inf bucket equals the count.',
        'Filtering the logs for `duration_ms` over 300 returns roughly the same number of requests as the histogram implies.',
        'Your SLO document fits on one page and someone else could compute the SLI from your definition alone.',
      ],
    },
    successChecklist: [
      'Every request emits exactly one structured JSON log line with a request ID.',
      'An incoming request ID is propagated to logs and the response header.',
      '/metrics exposes a cumulative latency histogram and a 5xx counter with low-cardinality labels.',
      'Showed numerically why the average hid the problem.',
      'Wrote an SLI, SLO, error budget and two burn-rate alerts with runbook placeholders.',
      'Calculated a burn rate for the degraded scenario and decided whether it pages.',
    ],
    questions: [
      {
        question: 'Why is alerting on high CPU usually worse than alerting on SLO burn rate?',
        answer:
          "High CPU is a cause, and many causes never affect users: a batch job may use 95% CPU harmlessly, and autoscaling may absorb a spike. Paging on causes produces noise, and noisy pages train people to ignore alerts. Conversely, many user-facing failures (a bad deploy returning errors, a slow dependency) do not raise CPU at all, so cause-based alerts miss them. An SLO burn-rate alert measures the symptom users feel and pages in proportion to how fast the budget is being spent. CPU still belongs on a dashboard, where it helps diagnose why the SLO is burning.",
      },
      {
        question: 'A teammate adds a `user_id` label to the request latency histogram so they can debug individual users. What is the problem and what should they do instead?',
        answer:
          "Every distinct label combination is a separate time series, and a histogram already multiplies that by the number of buckets. With 100,000 users and 7 buckets, one metric becomes hundreds of thousands of series, which can exhaust memory in the metrics backend, slow queries and raise costs sharply. Metrics are for aggregates; per-user detail belongs in logs and traces, which are designed for high-cardinality fields. They should keep low-cardinality labels (route template, method, status class) on the metric and put `user_id` (where privacy allows) on log lines and span attributes, then jump from a metric anomaly to example traces or logs.",
      },
      {
        question: 'Your SLO is 99.9% of check-ins succeeding over 30 days, and you have used 80% of the error budget by day 12. What do you do?',
        answer:
          "At 80% spent after 40% of the window, the budget is burning about twice as fast as planned, so at this rate it will run out around day 15. The usual policy is to shift priority toward reliability: slow or pause risky launches for that service, investigate what consumed the budget (one incident or a steady background error rate), and fix the top contributors. If one incident caused most of it, the postmortem actions are the priority; if it is a chronic rate, there is likely a systemic issue such as a flaky dependency or missing retries. It is also worth checking whether the SLO is right: if users were not actually affected, the SLI may be measuring the wrong thing.",
      },
    ],
    explainPrompt:
      "Explain to a product manager on NearBrew what an SLO and error budget are, using nearby search as the example, and why the team will sometimes slow feature work when the budget runs low.",
    rubric: [
      'Defines SLI, SLO and error budget in plain language without jargon.',
      'Uses a concrete number for the target and what the budget means in requests or minutes.',
      'Explains why averages are misleading using a user-centred example.',
      'Connects the budget to product decisions (ship faster vs fix reliability).',
      'Mentions that alerts are based on how fast the budget is burning.',
    ],
    referenceExplanation:
      "We measure nearby search the way a user experiences it: was the result list returned successfully and in under 300 milliseconds? That percentage is our service level indicator. Our objective, the SLO, is that 99.5% of searches meet that bar over any 30 days. We deliberately do not aim for 100%, because the last fraction of reliability is extremely expensive and users do not notice the difference between 99.5% and 99.99% for a café search.\n\nThe 0.5% we allow to fail is the error budget. At about two million searches a month, that is 10,000 slow or failed searches. That budget is something we can spend: risky launches, migrations and experiments all consume a bit of it. While we have budget left, we ship features at full speed. If an incident or a slow database eats most of it early in the month, we shift engineers to reliability work until it recovers, because users are already getting a worse experience than we agreed was acceptable.\n\nThis is also why I push back when someone quotes average latency. Our average was 90 milliseconds while one search in twenty took over a second, so the people who actually felt the slowness were invisible in that number. And it is why we page someone only when the budget is burning fast, say on track to be gone in two days, rather than whenever a server looks busy. That keeps on-call focused on problems users actually feel.",
    stretch: {
      title: 'Real traces with OpenTelemetry and Jaeger',
      description:
        "Add the OpenTelemetry Node SDK with auto-instrumentation for `http`, run Jaeger all-in-one locally in Docker, and wrap `findNearby` in a manual span with attributes such as `cafe.count`. Find a slow trace and confirm the span shows where the time went. Include the trace ID in your log lines.",
    },
    lightTask:
      "Add the structured log line and the cumulative histogram to `server.mjs`, run `load.mjs`, and write down the average, p95, p99 and the fraction of requests under 300 ms. Write two sentences on why the average misled you.",
    intensiveExtras: [
      'Run Prometheus in Docker scraping your `/metrics`, write the latency SLI as a PromQL query, and graph it while toggling `SLOW_FRACTION`.',
      'Add a saturation signal (in-flight requests gauge) and a dependency metric (`db_ms` histogram), and write a one-page runbook for the fast-burn alert that uses them.',
      'Define an SLO for NearBrew check-ins (week 20) and decide what counts as a valid versus a good event, including 409 duplicates and 422 too-far responses.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['production-reliability', 'backend-services', 'system-design'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 24 — Frontend system design: feed / catalogue
  // ---------------------------------------------------------------------------
  {
    week: 24,
    slug: 'frontend-system-design-feed-catalogue',
    title: 'Frontend system design: designing a feed / catalogue UI',
    track: 'interview',
    secondaryTracks: ['frontend', 'system-design'],
    topics: [
      'frontend system design',
      'RADIO framework',
      'infinite scroll',
      'cursor pagination',
      'normalised client state',
      'virtualisation',
      'image loading',
      'optimistic updates',
    ],
    objective:
      "By the end you can run a 45-minute frontend system design conversation for a feed or catalogue UI, moving through requirements, architecture, data model, API and optimisations, and justify each trade-off out loud.",
    whyItMatters:
      "Frontend and product UI interviews increasingly include a design round where you design a client application rather than a backend. Consumer apps live or die on feeds and catalogues: scrolling must stay smooth, images must load fast without layout shift, and interactions like favouriting must feel instant. The same structured thinking is how you would write the design doc for a real NearBrew discovery feed.",
    explanation: [
      "Frontend system design differs from backend design. The interviewer is less interested in sharding and more in component architecture, client state, the API contract between client and server, rendering performance, network behaviour on slow devices, and accessibility. A common way to structure the conversation is the RADIO framework: Requirements, Architecture, Data model, Interface (API), Optimisations. It is not magic, but it stops you jumping into virtualisation details before you know whether the feed even needs filters, and it gives the interviewer clear checkpoints. A reasonable time split for 45 minutes is about 7 / 10 / 6 / 7 / 15.",
      "Requirements: split functional (what the user can do: browse a feed of nearby cafés, filter by open now and wifi, favourite a café, open details, pull to refresh) from non-functional (devices and networks, performance targets such as smooth scrolling and a fast first contentful paint, accessibility, internationalisation, offline or poor-network behaviour). Ask about scale in UI terms: how many items might a user scroll through, how big are images, how often does data change, is it personalised? Write the assumptions down; they justify every later decision.",
      "Architecture and data model: draw the client pieces and how data flows. A typical sketch has the server API, a client data layer or cache (for example TanStack Query or a normalised store), a feed controller that manages pagination and filters, and presentational components (FeedList, CafeCard, FilterBar, FavouriteButton). Store entities normalised by id (`cafesById`) and keep the feed itself as an ordered list of ids per query key; then a favourite toggle updates one entity and every list showing that café re-renders consistently. Separate server state (cafés, pages, favourite status) from client state (selected filters, scroll position, which card is expanded), as in week 15.",
      "Interface: design the API from the UI's needs. Use cursor pagination (`GET /feed?lat=..&lng=..&filters=open_now,wifi&cursor=abc&limit=20` returning `{ items, nextCursor }`) because offset pagination duplicates or skips items when the underlying list changes while the user scrolls. Return exactly the fields a card needs, including image dimensions so the client can reserve space and avoid layout shift, and multiple image sizes or a resizable image URL so the client can choose with `srcset`. Make mutations idempotent: `PUT /me/favourites/{cafeId}` and `DELETE` are safe to retry, a toggle endpoint is not.",
      "Optimisations: this is where seniority shows, and you should prioritise rather than list everything. Rendering: virtualise long lists so only visible rows exist in the DOM, give cards stable keys, memoise cards that receive stable props. Network: prefetch the next page when the user is a screen or two from the end (IntersectionObserver on a sentinel), deduplicate in-flight requests, cache pages with stale-while-revalidate. Images: lazy-load below the fold, eager-load and prioritise the first visible images, reserve space with width/height or aspect-ratio, serve responsive sizes and modern formats, and show a placeholder colour. Interactions: optimistic favourites with rollback on failure. Resilience and accessibility: skeletons, retry on page failure without losing loaded items, restore scroll position when returning from details, and make sure infinite scroll does not trap keyboard and screen-reader users (provide a real 'Load more' button as a fallback and announce new results politely).",
    ],
    examples: [
      {
        language: 'ts',
        title: 'Data model and API contract for a NearBrew discovery feed',
        code: `// API response for GET /v1/feed?lat=&lng=&filters=&cursor=&limit=20
interface FeedResponse {
  items: CafeCard[];
  nextCursor: string | null;          // opaque; null means end of feed
}

interface CafeCard {
  id: string;
  name: string;
  neighbourhood: string;
  rating: number;                     // 0-5, one decimal
  reviewCount: number;
  openNow: boolean;
  distanceMeters: number;
  isFavourite: boolean;
  heroImage: {
    url: string;                      // supports ?w= resizing on the image CDN
    width: number;                    // intrinsic size so the client reserves space
    height: number;
    dominantColor: string;            // placeholder background while loading
    alt: string;
  };
}

// Client store: normalised entities + ordered ids per query
type FeedKey = string;                // e.g. 'lat=51.52|lng=-0.08|filters=open_now,wifi'
interface FeedStore {
  cafesById: Record<string, CafeCard>;
  feeds: Record<FeedKey, {
    ids: string[];
    nextCursor: string | null;
    status: 'idle' | 'loading' | 'error';
  }>;
}

// Idempotent mutations
// PUT    /v1/me/favourites/{cafeId}   -> 204
// DELETE /v1/me/favourites/{cafeId}   -> 204`,
      },
    ],
    keyTakeaways: [
      'Use a structure such as RADIO so requirements drive every later decision.',
      'Write down non-functional requirements: devices, network, performance targets, accessibility.',
      'Normalise entities by id and keep feeds as ordered id lists per query key.',
      'Cursor pagination avoids duplicates and gaps when the list changes during scrolling.',
      'Return image dimensions and multiple sizes so the client can avoid layout shift and over-downloading.',
      'Prioritise optimisations (virtualisation, prefetching, image strategy, optimistic updates) and keep infinite scroll accessible.',
    ],
    prerequisites: ['React rendering and client state (weeks 2 and 15)', 'Cursor pagination (week 3)', 'Core Web Vitals (week 11)'],
    prerequisiteWeeks: [2, 3, 11, 15],
    resources: [
      {
        title: 'Front End System Design Playbook (RADIO framework)',
        url: 'https://www.greatfrontend.com/front-end-system-design-playbook',
        kind: 'article',
        note: 'One public write-up of the RADIO structure, a commonly used framework for frontend design interviews. Read the framework overview and the news feed example if available. Use it as a structure, not a script.',
        minutes: 12,
        verify: true,
      },
      {
        title: 'MDN: Intersection Observer API',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API',
        kind: 'docs',
        note: 'Read the concepts section, especially `root`, `rootMargin` and `threshold`, which control how early you prefetch the next page.',
        minutes: 6,
      },
      {
        title: 'web.dev: Browser-level image lazy loading',
        url: 'https://web.dev/articles/browser-level-image-lazy-loading',
        kind: 'article',
        note: "Read why `loading='lazy'` should not be used on above-the-fold images and how to avoid layout shift with dimensions.",
        minutes: 6,
        verify: true,
      },
      {
        title: 'TanStack Query: Infinite Queries',
        url: 'https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries',
        kind: 'docs',
        note: 'Skim how `getNextPageParam` maps to a cursor API and how pages are cached and refetched. Useful vocabulary for the data-layer part of the design.',
        minutes: 6,
        verify: true,
      },
    ],
    exercise: {
      title: 'Timed design: the NearBrew discovery feed, plus a sentinel prototype',
      scenario:
        "Product wants a 'Discover' tab in NearBrew: an infinitely scrolling feed of nearby cafés with photos, rating, distance and open-now status, filter chips (open now, wifi, quiet), and a heart to favourite. It must feel smooth on mid-range Android phones on patchy mobile data. You will design it in 45 minutes as if in an interview, then spend 15 minutes proving one optimisation in a plain HTML file.",
      setup: [
        'Paper or a whiteboard app, a timer, and optionally a voice recorder to capture yourself narrating.',
        'For the prototype: a single `feed.html` opened directly in a browser (no build step).',
      ],
      steps: [
        'Requirements (7 min): write functional and non-functional requirements and at least five explicit assumptions (items per page, image sizes, data freshness, target devices, accessibility needs).',
        'Architecture (10 min): draw the component tree and data flow: API, client cache/store, feed controller, FilterBar, FeedList, CafeCard, FavouriteButton, details route. Mark which state is server state and which is client state.',
        'Data model (6 min): write the client store shape (normalised entities plus feed id lists keyed by query). Explain what happens to the store when the user changes a filter and when they favourite a café that appears in two feeds.',
        'Interface (7 min): define the feed endpoint, request parameters, response shape, cursor semantics and error responses, plus the favourite mutation. Justify cursor over offset in one sentence.',
        'Optimisations (15 min): choose your top five optimisations in priority order, with the user-visible problem each one solves. Include at least one for images, one for rendering, one for network and one for accessibility.',
        'Prototype (15 min): use the `feed.html` starter. Implement the TODO so the next page loads when the sentinel comes within 600 px of the viewport, show a loading row, stop at the end, and keep the Load more button working for keyboard users.',
      ],
      starter: [
        {
          language: 'html',
          title: 'feed.html',
          code: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NearBrew Discover prototype</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 480px; padding: 16px; }
    .card { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding: 12px 0; border-bottom: 1px solid #ddd; }
    .card img { width: 96px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; }
    #status { padding: 16px; text-align: center; color: #555; }
  </style>
</head>
<body>
  <h1>Discover</h1>
  <ul id="feed" style="list-style: none; padding: 0;" aria-label="Nearby cafes"></ul>
  <div id="status" role="status" aria-live="polite"></div>
  <button id="more" type="button">Load more cafes</button>
  <div id="sentinel" aria-hidden="true"></div>

  <script>
    // Fake cursor API: 7 pages of 20, 400-900 ms latency.
    function fetchFeed(cursor) {
      const page = cursor ? Number(cursor) : 0;
      return new Promise((resolve) => setTimeout(() => {
        const items = Array.from({ length: 20 }, (_, i) => {
          const n = page * 20 + i + 1;
          return { id: 'cafe-' + n, name: 'Cafe ' + n, rating: (3 + (n % 20) / 10).toFixed(1),
                   distanceMeters: 100 + n * 35, img: 'https://picsum.photos/seed/' + n + '/192/144' };
        });
        resolve({ items, nextCursor: page < 6 ? String(page + 1) : null });
      }, 400 + Math.random() * 500));
    }

    const feed = document.getElementById('feed');
    const statusEl = document.getElementById('status');
    const moreBtn = document.getElementById('more');
    let nextCursor = '';     // '' = first page, null = end
    let loading = false;

    function render(items, isFirstPage) {
      for (const [i, cafe] of items.entries()) {
        const li = document.createElement('li');
        li.className = 'card';
        const eager = isFirstPage && i < 4;
        li.innerHTML =
          '<img width="192" height="144" alt="" src="' + cafe.img + '" loading="' + (eager ? 'eager' : 'lazy') + '">' +
          '<div><strong>' + cafe.name + '</strong><br>' + cafe.rating + ' stars - ' + cafe.distanceMeters + ' m</div>';
        feed.appendChild(li);
      }
    }

    async function loadNext() {
      if (loading || nextCursor === null) return;   // de-duplicate and stop at end
      loading = true;
      statusEl.textContent = 'Loading more cafes...';
      const isFirst = nextCursor === '';
      const res = await fetchFeed(nextCursor);
      render(res.items, isFirst);
      nextCursor = res.nextCursor;
      loading = false;
      statusEl.textContent = nextCursor === null ? 'You have reached the end.' : feed.children.length + ' cafes loaded';
      if (nextCursor === null) moreBtn.hidden = true;
    }

    moreBtn.addEventListener('click', loadNext);

    // TODO: create an IntersectionObserver on #sentinel with a rootMargin of
    // '600px 0px' that calls loadNext() when it intersects. Disconnect it at the end.
    // TODO: handle a failed fetch: show a retry message without losing loaded items.

    loadNext();
  </script>
</body>
</html>`,
        },
      ],
      expected: [
        'A one-page design with labelled R, A, D, I and O sections and explicit assumptions.',
        'The data model explains why a favourite toggle updates one entity and is reflected in every feed.',
        'The API uses an opaque cursor, returns image dimensions, and uses idempotent favourite mutations.',
        'In the prototype, the next page starts loading before the user reaches the bottom; the network panel shows only one request per page even when scrolling fast; loading stops after page 7.',
        'The Load more button still works with only the keyboard and the status region announces progress.',
      ],
      hints: [
        "Interviewers usually care more that you ask what devices and networks matter than that you know every API. Ask early and write it down.",
        "If a filter change happens while a page request is in flight, the old response can land in the new feed. Key responses by query and ignore or abort stale ones (AbortController).",
        "Virtualisation matters at hundreds of items; at 140 cards on a phone, image decoding and memory often matter more. Say which you would measure first.",
        "For accessibility, think about what a screen-reader user hears when 20 items appear, and whether focus jumps.",
      ],
      verification: [
        'Your design stayed within 45 minutes, or you noted which section overran and why.',
        'You can answer, without notes: why cursor and not offset, why normalised entities, and what your number one optimisation is and why.',
        'In DevTools with Fast 3G throttling, the prototype loads the next page before the user hits the end most of the time, and never fires duplicate requests.',
      ],
    },
    successChecklist: [
      'Wrote requirements with explicit non-functional targets and assumptions.',
      'Drew an architecture separating server state from client state.',
      'Designed a normalised store and a cursor-based API with image metadata.',
      'Ranked five optimisations by user impact, including accessibility.',
      'Built a working IntersectionObserver prefetch with de-duplication and an end state.',
      'Completed the design in about 45 minutes.',
    ],
    questions: [
      {
        question: 'Why is offset pagination a poor fit for a live discovery feed, and what does a cursor encode?',
        answer:
          "With offset pagination, page 2 means 'skip 20 items'. If a new café is inserted at the top or rankings change between requests, the list shifts, so the user sees an item twice or never sees one at all. Offsets also get slower on the database as they grow, because it still reads and discards the skipped rows. A cursor encodes a position in a stable ordering, typically the sort key and a tie-breaker id of the last item returned, often signed or encoded so the client treats it as opaque. The next request asks for items after that position, which is stable under inserts and can use an index efficiently. For a personalised ranked feed, the cursor may also encode a ranking snapshot or session id so pages come from a consistent ranking.",
      },
      {
        question: 'How would you implement an optimistic favourite, and what can go wrong?',
        answer:
          "On tap, update the café entity in the client store immediately (isFavourite true) so every card for that café shows the filled heart, then send an idempotent `PUT /me/favourites/{id}`. On success you can reconcile with the server response; on failure you roll back to the previous value and show a non-blocking message. Problems: rapid repeated taps can send PUT and DELETE out of order, so you should serialise per café or send only the latest intended state; a refetch of the feed that lands before the mutation completes can overwrite the optimistic value, so cancel or delay refetches for affected queries until it settles; and if the user is offline you need to decide whether to queue the change or fail fast. Idempotent endpoints make retries safe.",
      },
      {
        question: 'Infinite scroll is great for engagement but has accessibility and usability costs. What are they and how do you mitigate them?',
        answer:
          "Keyboard and screen-reader users may never be able to reach content after the feed, such as the footer, because it keeps moving away. New content appearing without announcement is confusing, and loading many items can make the page sluggish on low-end devices. Returning from a details page often loses the scroll position, which is very frustrating. Mitigations: provide a real 'Load more' button as an alternative trigger, announce loading and results in a polite live region without moving focus, keep important links outside the scrolling region or reachable via landmarks, restore scroll position and cached pages on back navigation, and virtualise or cap the rendered list on low-memory devices.",
      },
    ],
    explainPrompt:
      "Explain to an interviewer, in about three minutes, your design for the NearBrew Discover feed: walk through requirements, architecture, data model, API, and your top three optimisations, stating one trade-off you consciously made.",
    rubric: [
      'Follows a clear structure and signposts each section.',
      'States assumptions about devices, network and scale that drive later choices.',
      'Explains normalised client state and cursor pagination with reasons.',
      'Prioritises optimisations by user impact rather than listing techniques.',
      'Names a real trade-off and what would change the decision.',
      'Mentions accessibility as a design requirement, not an afterthought.',
    ],
    referenceExplanation:
      "I will start with requirements. Users browse nearby cafés in an endless list, filter by open now, wifi and quiet, favourite a café, and open its details. Non-functionally, I am assuming mid-range Android phones on patchy 4G, so smooth scrolling and fast first content matter more than anything else, and it must work with a screen reader. I am assuming 20 items per page and images around 200 pixels wide on the card.\n\nArchitecturally, there is a feed API, a client cache, a feed controller that owns pagination and the current filters, and presentational components: FilterBar, FeedList, CafeCard and FavouriteButton. Filters and scroll position are client state; cafés and pages are server state in the cache.\n\nIn the store I normalise cafés by id and keep each feed as an ordered list of ids keyed by its query. So favouriting a café updates one entity, and it is correct in every list.\n\nThe API is `GET /feed` with location, filters, an opaque cursor and a limit, returning items and `nextCursor`. I chose cursors because offsets duplicate or skip items when rankings change mid-scroll. Each card includes image width, height and a dominant colour, so the client can reserve space and avoid layout shift. Favourites use idempotent PUT and DELETE.\n\nMy top three optimisations: first, the image strategy, meaning eager loading for the first few images, lazy loading for the rest, responsive sizes and reserved space, because images dominate bytes and layout shift. Second, prefetching the next page with an IntersectionObserver about one screen early, with de-duplication. Third, optimistic favourites with rollback. The trade-off: I am not virtualising at first, because at a few hundred items image memory is the bigger risk. I would measure on a real device and add virtualisation if scrolling drops frames.",
    stretch: {
      title: 'Build it in React with measured virtualisation',
      description:
        "Port the prototype to a Vite React app with TanStack Query `useInfiniteQuery`, generate 2,000 items, and use the React Profiler and the Performance panel to compare scrolling with and without a virtualisation library. Record whether virtualisation was worth its complexity at 200, 500 and 2,000 items.",
    },
    lightTask:
      "Do only the 45-minute timed design on paper, following the R, A, D, I, O time boxes, and finish by writing your number one optimisation and the trade-off you made in two sentences.",
    intensiveExtras: [
      'Redo the design for a different surface: a café detail page with a photo gallery and paginated reviews. Compare which RADIO sections changed most.',
      'Add error handling and retry to the prototype, then throttle to Slow 3G and toggle offline in DevTools to test it.',
      'Record yourself giving the three-minute explanation, listen back, and cut any section that ran long without adding a decision.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['system-design', 'consumer-ui', 'rendering-performance', 'react-architecture'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 25 — Concurrency
  // ---------------------------------------------------------------------------
  {
    week: 25,
    slug: 'concurrency-races-locks-async-coordination',
    title: 'Concurrency: processes, threads, race conditions, locks, async coordination',
    track: 'cs',
    secondaryTracks: ['backend'],
    topics: [
      'processes vs threads',
      'race conditions',
      'critical sections',
      'mutex',
      'deadlock',
      'atomics',
      'SharedArrayBuffer',
      'worker threads',
      'async races',
      'concurrency limits',
    ],
    objective:
      "By the end you can explain the difference between concurrency and parallelism, find a race condition in async JavaScript, protect a critical section with a mutex, avoid deadlock with lock ordering, and bound concurrency for a batch of I/O work.",
    whyItMatters:
      "Single-threaded JavaScript does not make you immune to races: any `await` between reading state and writing it is an opening for another request to interleave. Double bookings, lost updates, duplicated jobs and stampedes on a downstream API all come from uncoordinated concurrency. Understanding the primitives lets you choose the right fix: a database constraint, an in-process lock, an atomic, or simply less shared state.",
    explanation: [
      "Concurrency means multiple tasks are in progress at overlapping times; parallelism means they are literally executing at the same instant on different cores. A process is an isolated program with its own memory space; threads are multiple execution streams inside one process that share its memory. Separate processes communicate by messages, pipes, sockets or a shared database, and are protected from each other's memory bugs. Threads communicate through shared memory, which is fast but means any shared mutable data needs coordination. Node gives you one JavaScript thread per process (concurrency through the event loop), plus `worker_threads` for parallel JavaScript and a libuv thread pool for some I/O; Java and Go give you many threads by default.",
      "A race condition is when the result depends on the timing of interleaved operations. The classic shape is read-modify-write or check-then-act: read a value, decide based on it, write. If another task can run between the read and the write, its update is lost or the decision is stale. In multithreaded code that window can be a single `count++`. In async JavaScript the window is every `await`: `const seat = await getSeat(id); if (seat.free) await reserve(id, user);` lets ten concurrent requests all see the seat as free. The code that must run without interleaving is the critical section.",
      "A mutex (mutual-exclusion lock) ensures only one task is in the critical section at a time. In Node you can build a simple async mutex out of a promise chain, and a keyed mutex (one lock per seat id) keeps unrelated work parallel. But an in-process lock only protects one process: with two server instances behind a load balancer (week 19), each has its own lock, and the race returns. For shared data, push coordination to the thing that is shared, usually the database (a unique constraint, `SELECT ... FOR UPDATE`, optimistic version checks from week 7) or a distributed lock with leases. Atomics are lock-free primitives for simple operations on shared memory: `Atomics.add` on a `SharedArrayBuffer` in JS, `AtomicInteger` in Java, or an atomic SQL `UPDATE ... SET count = count + 1`.",
      "Locks introduce their own failure: deadlock. Task A holds lock 1 and waits for lock 2; task B holds lock 2 and waits for lock 1; neither proceeds. Deadlock needs four conditions at once (mutual exclusion, hold and wait, no preemption, circular wait), so you prevent it by breaking one, most simply circular wait: always acquire multiple locks in a consistent global order, such as sorted by id. Timeouts on lock acquisition turn a silent hang into a visible error. Databases detect deadlocks between transactions and abort one of them, which is why transactional code needs retries. Other hazards: holding a lock while doing slow I/O (it serialises everything behind it) and forgetting to release on error (always release in `finally`).",
      "Async coordination is mostly about bounding and composing work. `Promise.all` starts everything at once, which is fine for five requests and a self-inflicted outage for 5,000 photo uploads or API calls; use a concurrency limit (a semaphore or worker pool of N). `Promise.allSettled` collects partial failures instead of failing fast. Deduplicate identical in-flight requests (a map of key to promise) to avoid a stampede when a cache entry expires. And prefer designs that need less coordination: immutable data, a single writer per piece of state, message queues that process one item per key in order, and idempotent operations that make retries and duplicates harmless.",
    ],
    examples: [
      {
        language: 'js',
        title: 'An async mutex and a keyed mutex from promise chains',
        code: `class Mutex {
  #tail = Promise.resolve();

  // Resolves to a release function once you hold the lock.
  lock() {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const previous = this.#tail;
    this.#tail = previous.then(() => held);   // next waiter waits for us
    return previous.then(() => release);
  }

  async run(fn) {
    const release = await this.lock();
    try {
      return await fn();
    } finally {
      release();                              // always release, even on throw
    }
  }
}

class KeyedMutex {
  #locks = new Map();
  run(key, fn) {
    if (!this.#locks.has(key)) this.#locks.set(key, new Mutex());
    return this.#locks.get(key).run(fn);      // seat A and seat B do not block each other
  }
}`,
      },
    ],
    keyTakeaways: [
      'Concurrency is overlapping progress; parallelism is simultaneous execution.',
      'Threads share memory; processes do not. Shared mutable state needs coordination.',
      'In async JS, every `await` between a read and a dependent write is a race window.',
      'In-process locks do not protect data shared across instances; use the database or a distributed lock.',
      'Prevent deadlock by acquiring locks in a consistent order and releasing in `finally`.',
      'Bound concurrency for batches, deduplicate in-flight work, and prefer designs with less shared state.',
    ],
    prerequisites: ['The event loop (week 5)', 'Transactions and locking (week 7)', 'Node internals and worker threads (week 17)'],
    prerequisiteWeeks: [5, 7, 17, 22],
    resources: [
      {
        title: 'Operating Systems: Three Easy Pieces (free online book)',
        url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
        kind: 'book',
        note: "In the Concurrency part, read the introduction chapter and the chapter on locks. They explain race conditions, critical sections and atomicity from first principles.",
        minutes: 15,
        verify: true,
      },
      {
        title: 'MDN: Atomics',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics',
        kind: 'docs',
        note: 'Read the description and the list of static methods (`add`, `load`, `store`, `compareExchange`, `wait`, `notify`). You will use `Atomics.add` in the exercise.',
        minutes: 5,
      },
      {
        title: 'Node.js: Worker threads',
        url: 'https://nodejs.org/api/worker_threads.html',
        kind: 'docs',
        note: 'Skim the introduction and the `Worker` constructor, `workerData`, and the note on sharing memory with `SharedArrayBuffer`.',
        minutes: 5,
      },
      {
        title: 'The Java Tutorials: Concurrency (Liveness and Deadlock)',
        url: 'https://docs.oracle.com/javase/tutorial/essential/concurrency/',
        kind: 'docs',
        note: "Read the 'Liveness' and 'Deadlock' pages for a short, concrete deadlock example that maps directly to the exercise.",
        minutes: 5,
      },
    ],
    exercise: {
      title: 'Break and fix seat reservations, shared counters and a photo upload batch',
      scenario:
        "A booking platform sells seats for a café's weekend latte-art workshop, and NearBrew users upload photos in batches. You will reproduce an async double booking, fix it with a keyed mutex, see a real data race across worker threads, cause and fix a deadlock, and add a concurrency limit to a photo upload batch.",
      setup: [
        'Node 18+ only. Create a folder `conc-w25` and save the starter files.',
        'Each file runs with `node <file>.mjs`.',
      ],
      steps: [
        'Run `node seats.mjs`. Observe several users told they got seat A1. Explain in a comment exactly which `await` creates the race window.',
        'Add the `KeyedMutex` from the worked example and wrap `reserveNaive` in `locks.run(seatId, ...)`. Rerun and confirm exactly one success. Then explain in a comment why this fix would not be enough with two Node processes, and what you would do in Postgres instead.',
        'Run `node counter.mjs`. Compare the plain counter with the atomic one across three runs and record the results.',
        "Implement `swapSeats(a, b)` in `seats.mjs` that locks both seats with the keyed mutex, nesting `locks.run(a, () => locks.run(b, ...))`. Call `swapSeats('A1', 'B1')` and `swapSeats('B1', 'A1')` concurrently and observe the hang. Fix it by always locking in sorted order.",
        'In `uploads.mjs`, implement `mapWithLimit(items, limit, fn)` so no more than `limit` uploads run at once. Confirm the reported peak concurrency equals the limit and total time is roughly items / limit x average duration.',
        'Add in-flight deduplication: `getCafeOnce(id)` should return the same promise for concurrent calls with the same id. Prove it with a call counter.',
      ],
      starter: [
        {
          language: 'js',
          title: 'seats.mjs',
          code: `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const seats = new Map([['A1', null], ['B1', 'user-x']]);

// Simulates read from DB, network latency, then write.
async function reserveNaive(seatId, userId) {
  const holder = seats.get(seatId);          // read
  await sleep(5 + Math.random() * 10);       // round trip to the database
  if (holder !== null) return { userId, ok: false };
  seats.set(seatId, userId);                 // write
  return { userId, ok: true };
}

const users = Array.from({ length: 5 }, (_, i) => 'user-' + i);
const results = await Promise.all(users.map((u) => reserveNaive('A1', u)));
console.log(results);
console.log('successes:', results.filter((r) => r.ok).length, 'final holder:', seats.get('A1'));

// TODO: KeyedMutex fix
// TODO: swapSeats(a, b) that locks both seats; reproduce and fix the deadlock`,
        },
        {
          language: 'js',
          title: 'counter.mjs',
          code: `import { Worker, isMainThread, workerData } from 'node:worker_threads';

const WORKERS = 4;
const INCREMENTS = 1_000_000;

if (isMainThread) {
  const shared = new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT);
  const counters = new Int32Array(shared);   // [0] plain, [1] atomic
  const workers = Array.from({ length: WORKERS }, () =>
    new Worker(new URL(import.meta.url), { workerData: shared })
  );
  await Promise.all(workers.map((w) => new Promise((resolve) => w.on('exit', resolve))));
  console.log('expected', WORKERS * INCREMENTS);
  console.log('plain   ', counters[0]);
  console.log('atomic  ', Atomics.load(counters, 1));
} else {
  const counters = new Int32Array(workerData);
  for (let i = 0; i < INCREMENTS; i++) {
    counters[0]++;                 // read-modify-write on shared memory
    Atomics.add(counters, 1, 1);   // indivisible
  }
}`,
        },
        {
          language: 'js',
          title: 'uploads.mjs',
          code: `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let inFlight = 0;
let peak = 0;

async function uploadPhoto(photo) {
  inFlight++;
  peak = Math.max(peak, inFlight);
  await sleep(100 + Math.random() * 100);   // pretend network upload
  inFlight--;
  return photo + ':ok';
}

// TODO: run fn over items with at most 'limit' in flight; preserve result order.
async function mapWithLimit(items, limit, fn) {
  return Promise.all(items.map(fn));        // naive: unbounded
}

const photos = Array.from({ length: 40 }, (_, i) => 'photo-' + i + '.jpg');
const start = Date.now();
const results = await mapWithLimit(photos, 4, uploadPhoto);
console.log(results.length, 'uploaded in', Date.now() - start, 'ms, peak concurrency', peak);

// TODO: getCafeOnce(id) - concurrent calls for the same id share one promise.`,
        },
      ],
      expected: [
        "The naive `seats.mjs` reports several successes for A1 and the final holder is whichever user wrote last.",
        'With the keyed mutex there is exactly one success and four failures.',
        'In `counter.mjs` the plain counter is very likely below 4,000,000 and differs between runs; the atomic counter is always exactly 4,000,000.',
        "The opposite-order swaps never complete; Node exits with a warning about an unsettled top-level await (exit code 13) instead of printing the result. With sorted lock order both complete.",
        '`uploads.mjs` with the limit reports peak concurrency 4 and roughly 1.5 seconds total, versus peak 40 and about 0.2 seconds for the naive version.',
      ],
      hints: [
        'The race window in `reserveNaive` is between `seats.get` and `seats.set`; the `await sleep` is where other calls run.',
        "For the deadlock, add a short `await sleep(10)` between acquiring the first and second lock so both tasks reliably grab their first lock.",
        "For `mapWithLimit`, start `limit` workers that each pull the next index from a shared counter until none remain, writing results into `results[index]`. This is safe in Node because incrementing the index is synchronous.",
        "For deduplication, store the promise in a Map before awaiting it, and delete the entry in `finally` so failures are not cached forever.",
      ],
      verification: [
        'Each script prints the expected outcome across three consecutive runs.',
        'You can point to the exact line where each race window opens.',
        'You wrote one sentence per fix stating which deadlock condition or race property it removes.',
      ],
    },
    successChecklist: [
      'Reproduced and explained an async double booking in single-threaded Node.',
      'Fixed it with a keyed mutex and explained why multiple instances need a database-level fix.',
      'Observed lost updates across worker threads and fixed them with Atomics.',
      'Caused a deadlock with opposite lock order and fixed it with consistent ordering.',
      'Implemented a concurrency limiter with order-preserving results.',
      'Implemented in-flight request deduplication.',
    ],
    questions: [
      {
        question: 'Node runs your JavaScript on one thread. How can it still have race conditions, and how are they different from races in Java?',
        answer:
          "Node interleaves many tasks on one thread, switching whenever a task awaits or yields to the event loop. If a task reads state, awaits something, and then writes based on what it read, other tasks can change that state during the await, which is a check-then-act race. The difference from Java is granularity: in Node, synchronous code between awaits runs atomically with respect to other JavaScript, so `count++` is safe, whereas in Java two threads can interleave inside `count++` and the memory model adds visibility issues. So in Node you look for awaits inside critical sections; in Java you look for any unsynchronised access to shared mutable state. Both share the bigger risk that state lives in a database shared by many processes, where only database-level coordination works.",
      },
      {
        question: 'What are the four conditions for deadlock, and which is usually easiest to break in application code?',
        answer:
          "Mutual exclusion (a resource can be held by one task), hold and wait (a task holds one resource while waiting for another), no preemption (resources cannot be forcibly taken), and circular wait (a cycle of tasks each waiting on the next). All four must hold for deadlock. Circular wait is usually easiest to break: define a global order for locks, for example by seat id or account id, and always acquire in that order, so no cycle can form. Hold and wait can also be broken by acquiring all needed locks at once or by using lock timeouts and backing off. Databases cannot prevent it in general, so they detect cycles and abort one transaction, which the application should retry.",
      },
      {
        question: 'Why is `Promise.all(photos.map(upload))` risky for 5,000 photos, and what should you use instead?',
        answer:
          "It starts all 5,000 uploads immediately. That can exhaust sockets and memory on the client, trip rate limits on the server, saturate the user's uplink so every upload is slow and some time out, and make a single failure reject the whole batch while the other uploads keep running in the background. Instead, use a concurrency limit, such as a pool of four to six workers pulling from a queue, which keeps throughput high while bounding resource use. Combine it with per-item retries with backoff, `allSettled`-style result collection so partial success is reported, and ideally idempotent upload ids so retries do not create duplicate photos.",
      },
    ],
    explainPrompt:
      "Explain to a junior teammate who says 'Node is single-threaded, so we can't have race conditions' why that is wrong, using the seat reservation example, and walk them through the fix you would choose for a single process and for a fleet of servers.",
    rubric: [
      'Correctly explains interleaving at await points in a single thread.',
      'Identifies the specific read and write that form the race window.',
      'Gives an in-process fix and explains its limit across processes.',
      'Gives a correct database-level or distributed fix.',
      'Mentions at least one related hazard (deadlock, forgetting to release, unbounded concurrency).',
    ],
    referenceExplanation:
      "Node runs our JavaScript on one thread, so two lines of synchronous code never run at the same instant. But a request handler is not one synchronous block. Every `await` hands control back to the event loop, and other requests run until the awaited thing finishes. Look at the seat code: we read who holds A1, await a database round trip, then decide. Five requests can all read 'nobody holds A1' before any of them writes, so all five are told they have the seat. That is a check-then-act race, and the window is the await between the read and the write.\n\nIn a single process, the fix is to make the check and the write one critical section per seat. A keyed mutex does this: requests for A1 queue behind each other, while requests for B1 run in parallel. It must release in a `finally`, or one error locks the seat forever.\n\nBut we run several Node instances behind a load balancer, and each has its own mutex, so the race comes back across instances. For shared data, the coordination has to live where the data lives. In Postgres I would make the database the arbiter: `UPDATE seats SET holder = $1 WHERE id = $2 AND holder IS NULL` and check that one row changed, or a unique constraint on reservations. That is atomic no matter how many servers we run.\n\nOne more trap: if an operation needs two locks, like swapping seats, always take them in the same order, for example sorted by id. Otherwise two swaps in opposite directions can each hold one lock and wait forever.",
    stretch: {
      title: 'Database-level seat reservation under load',
      description:
        "With Docker Postgres, implement seat reservation three ways: a conditional `UPDATE ... WHERE holder IS NULL`, `SELECT ... FOR UPDATE` in a transaction, and SERIALIZABLE isolation with retry on serialization failure. Fire 50 concurrent requests from two Node processes and compare correctness, latency and code complexity.",
    },
    lightTask:
      "Run `seats.mjs`, identify the exact race window, and fix it with the keyed mutex. Write three sentences: why the race happens in single-threaded Node, why your fix works, and why it would not work across two server instances.",
    intensiveExtras: [
      'Add a timeout to `Mutex.lock` that rejects after 500 ms, and use it to turn the deadlock into a visible error with useful log output.',
      'Implement a counting semaphore class and rewrite `mapWithLimit` on top of it.',
      'Port the seat race to Java with an `ExecutorService` and fix it with `synchronized`, then with `ConcurrentHashMap.putIfAbsent`, and compare with the Node version.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['cs-fundamentals', 'backend-services', 'js-ts'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 26 — Behavioural stories (STAR)
  // ---------------------------------------------------------------------------
  {
    week: 26,
    slug: 'behavioural-stories-star-evidence-bank',
    title: 'Mid-year checkpoint: behavioural stories (STAR) from real work',
    track: 'interview',
    secondaryTracks: ['senior'],
    topics: [
      'behavioural interviews',
      'STAR',
      'evidence bank',
      'ownership',
      'conflict',
      'failure stories',
      'confidentiality',
      'company values',
    ],
    objective:
      "By the end you have an evidence bank of at least six STAR stories from your own work, each safe to tell without confidential details, and you can tell any of them in two to three minutes and handle follow-up questions.",
    whyItMatters:
      "Behavioural rounds are where interviewers assess judgment, ownership, collaboration and growth, and at senior levels they often weigh as much as coding. Strong engineers frequently underperform here because they have never organised their experience into stories: they ramble, say 'we' throughout, forget the outcome, or accidentally share confidential details. Halfway through the year, it is also the best moment to capture what you have actually done before you forget it.",
    explanation: [
      "Behavioural questions ('Tell me about a time you disagreed with a technical decision') are built on the idea that past behaviour predicts future behaviour. The interviewer wants evidence of specific competencies: ownership, dealing with ambiguity, technical judgment, collaboration and conflict, handling failure, influencing without authority, giving and receiving feedback, and delivering under constraints. A vague, hypothetical answer ('I would usually...') provides no evidence. A specific story with your actions and a real result does.",
      "STAR is a simple structure for that evidence: Situation (the context, briefly), Task (what you were responsible for, or the problem to solve), Action (what you specifically did and why), Result (what happened, with numbers or concrete outcomes where you can), and many people add a final Reflection (what you learned or would do differently). Spend most of the time on Action, roughly 60%, and keep Situation and Task to two or three sentences combined. Say 'I' for your actions and 'we' for the team's; interviewers need to know what you did. Include the reasoning behind your decisions and the alternatives you rejected, because that is where judgment shows.",
      "Build an evidence bank rather than preparing answers to specific questions. Brainstorm 15 to 20 moments from the last few years: launches, incidents, migrations, disagreements, mistakes, times you mentored, times you changed your mind, things you improved that nobody asked for. Pick six to eight that are rich enough to cover multiple themes, and write each in STAR form with tags for the competencies it demonstrates. A good bank lets one story answer several questions: an incident you led can be 'a time you handled pressure', 'a time you made a mistake' and 'a time you improved a process'. Include at least one genuine failure with a real lesson; stories where you are flawless are less credible than stories where you noticed and fixed a problem you caused.",
      "Confidentiality is part of professional judgment, and interviewers notice. Do not disclose an employer's or client's trade secrets, unreleased products or features, internal codenames, non-public financial or user metrics, security vulnerabilities and incident details that are not public, customer names you are not permitted to share, or anything covered by an NDA. You can still tell a strong story: generalise ('a large B2B SaaS client', 'a payments provider'), use relative numbers you are comfortable sharing ('cut p95 latency by roughly 40%') rather than exact internal figures, and describe architecture at a level that would be public anyway. If in doubt, leave it out or ask the interviewer whether a general description is enough. Your own projects, such as NearBrew, are yours to describe fully, which makes them valuable stories, while freelance work is bound by each client agreement.",
      "Finally, research the company's stated values so you can choose relevant stories, not to recite slogans. Many companies publish them; Netflix, for example, publishes a public culture memo at jobs.netflix.com/culture. Reading it tells you what the company says it values, which can help you decide which of your stories best show judgment, candour or ownership, but it does not tell you what any particular interview will ask, so do not prepare to it like a script. Practise out loud: a story that reads well on paper often runs five minutes when spoken. Record yourself, time it, and practise answering likely follow-ups: 'What would you do differently?', 'What did you specifically do?', 'How did you know it worked?', 'What did the other person think?'.",
    ],
    examples: [
      {
        language: 'text',
        title: 'Evidence bank template (one entry per story)',
        code: `STORY: <short memorable name, e.g. "Check-in double points">
Themes:        ownership | failure | conflict | ambiguity | influence | feedback | delivery | technical judgment
Context safe?: [ ] no client/employer names  [ ] no unreleased features  [ ] no internal metrics  [ ] no codenames
When / where:  <year, type of company or project; generalised if needed>

S - Situation (1-2 sentences): what was happening and why it mattered
T - Task (1 sentence):         what you owned, or the problem you set out to solve
A - Action (4-6 bullets in your head, spoken as sentences):
    - what you did first and why
    - the key decision, alternatives you rejected, and the trade-off
    - who you had to persuade or work with, and how
    - what went wrong along the way and how you adapted
R - Result:     measurable or concrete outcome (relative numbers are fine)
Reflection:     what you learned / would do differently / what changed afterwards

Likely follow-ups and my answers:
  - What was your specific contribution?
  - What would you do differently?
  - How did you measure success?
  - What did the people who disagreed think, and were they partly right?

Length when spoken: ___ min ___ s  (target 2:00 - 3:00)`,
      },
      {
        language: 'text',
        title: 'Example story using your own project (safe to tell in full)',
        code: `STORY: "NearBrew offline favourites"
Themes: technical judgment, ambiguity, delivery

S: Beta testers of my café-discovery app said favouriting felt broken on the
   Underground: the heart spun, then reverted.
T: I owned the whole app and had two weeks before a public launch.
A: I reproduced it with network throttling and found the client waited for the
   server before updating UI. I considered a full offline sync layer but judged
   it too big for the deadline. Instead I made favourites optimistic, made the
   API idempotent (PUT/DELETE instead of a toggle), and queued failed mutations
   to retry on reconnect. I wrote down the cases I was not handling, like
   conflicting edits on two devices, so the trade-off was explicit.
R: Testers stopped reporting the issue; favourite failures shown to users went
   from frequent to near zero in the beta logs, and the launch shipped on time.
Reflection: I would have built the idempotent API from day one; the toggle
   endpoint was the real root cause, and fixing it was cheap.`,
      },
    ],
    keyTakeaways: [
      'Behavioural answers are evidence: specific past events, not hypotheticals.',
      'STAR plus Reflection; spend about 60% of the time on your Actions and reasoning.',
      "Say 'I' for what you did; name the alternatives you rejected.",
      'Build a tagged evidence bank of six to eight versatile stories, including a real failure.',
      'Never disclose confidential employer or client information; generalise names and numbers.',
      "Read a company's public values to choose relevant stories, not to script answers, and practise aloud with a timer.",
    ],
    prerequisites: ['Your own work history from the last 2 to 4 years', 'Week 13 checkpoint experience explaining your work'],
    prerequisiteWeeks: [9, 12, 13, 20],
    resources: [
      {
        title: 'Netflix Culture memo',
        url: 'https://jobs.netflix.com/culture',
        kind: 'article',
        note: "Read the whole memo once to understand the values Netflix publicly states (for example around judgment, candour and context over control). Note two or three of your stories that genuinely relate. This tells you about stated values, not interview content.",
        minutes: 15,
        verify: true,
      },
      {
        title: 'Google SRE book: Postmortem Culture: Learning from Failure',
        url: 'https://sre.google/sre-book/postmortem-culture/',
        kind: 'book',
        note: 'Read the section on blameless postmortems. It is a good model for telling failure stories: focus on systems and decisions, own your part, and show what changed.',
        minutes: 8,
      },
      {
        title: 'Tech Interview Handbook: Behavioral interviews',
        url: 'https://www.techinterviewhandbook.org/behavioral-interview/',
        kind: 'article',
        note: 'Skim the list of common behavioural questions and use it to check your evidence bank covers each theme at least once.',
        minutes: 7,
        verify: true,
      },
    ],
    exercise: {
      title: 'Build your evidence bank and pressure-test three stories',
      scenario:
        "You are halfway through the year. You will mine your real work (day job, freelance, NearBrew, and the incidents, reviews and designs from this curriculum) for stories, write the strongest six in STAR form, run a confidentiality pass, and rehearse three out loud until they fit in under three minutes.",
      setup: [
        'A document or notes app, a timer, and a voice recorder (your phone is fine).',
        'Optional: look through your old pull requests, design docs, incident notes and calendar to jog your memory. Do not copy confidential material into your notes; write from memory in generalised form.',
      ],
      steps: [
        'Brainstorm (10 min): list 15 or more moments, one line each, under prompts: a launch you are proud of, an incident, a disagreement, a mistake you made, a time you changed your mind, a time you helped someone grow, something you improved unasked, a decision with incomplete information.',
        'Select (5 min): pick six stories that together cover at least seven themes from the template. At least one must be a genuine failure, and at least one should come from NearBrew or work you fully own.',
        'Write (20 min): fill in the evidence bank template for each of the six. Keep Situation and Task to three sentences combined; write Actions as decisions with reasons.',
        "Confidentiality pass (5 min): for each story tick the four 'Context safe?' boxes. Rewrite any client names, unreleased features, internal metrics or codenames into generalised forms.",
        'Rehearse (15 min): tell three stories aloud, recording each. Time them. Listen back and count how often you say we versus I, and whether you stated a result.',
        'Follow-ups (5 min): for each of the three, answer aloud: What would you do differently? What exactly did you do? How did you know it worked?',
      ],
      starter: [
        {
          language: 'text',
          title: 'Coverage grid (fill in story names)',
          code: `Theme                       | Story 1 | Story 2 | Story 3 | Story 4 | Story 5 | Story 6
----------------------------|---------|---------|---------|---------|---------|--------
Ownership / end-to-end      |         |         |         |         |         |
Failure / mistake           |         |         |         |         |         |
Disagreement / conflict     |         |         |         |         |         |
Ambiguity / incomplete info |         |         |         |         |         |
Influence without authority |         |         |         |         |         |
Feedback (given/received)   |         |         |         |         |         |
Delivery under constraints  |         |         |         |         |         |
Technical judgment          |         |         |         |         |         |
Helping others grow         |         |         |         |         |         |`,
        },
      ],
      expected: [
        'Six written stories, each tagged with themes and passing the confidentiality checklist.',
        'A coverage grid with every theme covered at least once and most covered twice.',
        'Three recordings, each between two and three minutes, ending in a concrete result and a reflection.',
        "In the recordings, 'I' clearly identifies your actions, and the reasoning behind at least one decision per story is stated.",
      ],
      hints: [
        "If you cannot find a result, ask what changed afterwards: a metric, a process, a decision, a person's growth. 'We stopped having that class of incident' is a result.",
        "For failure stories, pick a real mistake with real consequences that you caused or could have prevented, and spend time on what you changed afterwards. Avoid disguised boasts like 'I work too hard'.",
        "For conflict stories, describe the other person's position fairly. Interviewers listen for whether you understood why they disagreed.",
        "If a story only works with confidential details, it is the wrong story. Pick another.",
      ],
      verification: [
        'Every story passes the four confidentiality checks.',
        'All three rehearsed stories are under three minutes on the recording.',
        'A friend or colleague hearing one story could say in one sentence what you did and what the result was.',
      ],
    },
    successChecklist: [
      'Brainstormed 15 or more candidate moments from real work.',
      'Wrote six STAR stories with themes, results and reflections.',
      'Included at least one genuine failure and one fully owned project story.',
      'Ran a confidentiality pass and generalised sensitive details.',
      'Recorded and timed three stories at two to three minutes each.',
      'Practised answers to at least three follow-up questions.',
    ],
    questions: [
      {
        question: 'Why should Action take up most of a STAR answer, and what makes an Action section strong?',
        answer:
          "The interviewer is assessing what you would do in their team, and the Action section is the only part that shows your behaviour and judgment; the Situation is context and the Result can depend on luck or other people. A strong Action section uses 'I' for your own contributions, explains the reasoning behind key decisions, mentions alternatives you considered and why you rejected them, and shows how you worked with others, including handling disagreement. It also includes something that went wrong along the way and how you adapted, which makes the story credible. Long Situation sections are a common failure mode, because they use time without providing evidence.",
      },
      {
        question: 'How do you tell a strong story about a project at a previous employer without leaking confidential information?',
        answer:
          "Generalise identifying details: describe the company type and scale rather than client names ('a multi-tenant B2B invoicing product'), avoid codenames and unreleased features, and use relative or rounded figures you are comfortable sharing instead of internal metrics. Describe the technical problem and your decisions at the level of common patterns (a slow join on a hot table, a cache stampede), which are not secret, rather than specific proprietary systems. Leave out security incident specifics that were not publicly disclosed. If a detail seems necessary, ask whether a general description is enough; showing that you protect confidential information is itself a positive signal. When in doubt, choose a different story.",
      },
      {
        question: "How should you use a company's published values, such as a public culture memo, when preparing?",
        answer:
          "Use them to understand what the company says it values, so you can choose which of your real stories are most relevant and make sure your evidence bank covers those themes. Read them for underlying behaviours, such as making decisions with context, giving candid feedback, or owning outcomes, and check whether you have honest examples of each. Do not memorise slogans or assume the memo tells you what will be asked; interview formats vary by team and change over time. Do not distort stories to fit; interviewers probe with follow-ups and embellished stories collapse. If a value genuinely does not match how you like to work, that is useful information for you too.",
      },
    ],
    explainPrompt:
      "Tell your strongest failure story to an interviewer as if they had just asked, 'Tell me about a time you made a mistake that affected users or your team.' Use STAR plus a reflection, and keep it under three minutes.",
    rubric: [
      'Situation and Task take no more than about 20% of the answer.',
      'The mistake is real and clearly owned, without blaming others.',
      "Actions use 'I', state reasoning, and include how you limited the impact.",
      'The Result is concrete, and the Reflection shows a lasting change in behaviour or process.',
      'No confidential names, unreleased features or internal metrics are disclosed.',
      'It fits in under three minutes when spoken.',
    ],
    referenceExplanation:
      "Last year, while building NearBrew, I shipped a loyalty feature where users earn points for checking in at a café. I owned it end to end. Within a day of launch, a tester messaged me that they had twenty points from one visit.\n\nI checked the database and found duplicate check-ins a few hundred milliseconds apart. My handler looked for an existing check-in for that day and inserted one if there was none, and a double tap meant both requests passed the check before either inserted. It was my mistake: I had tested the happy path and assumed the button would only fire once.\n\nFirst I limited the impact. I disabled the button after the first tap in the app, which stopped new duplicates within the hour. Then I fixed it properly at the database level by adding a check-in date column with a unique constraint on user, café and date, and switching the insert to ignore conflicts, so the rule held no matter what the client did. I also moved awarding points into the same transaction, because I realised a failure between the two steps could do the opposite and lose points. I wrote a script to find the existing duplicates, removed the extra points, and messaged the affected testers to explain.\n\nThe result was no further duplicates, and I added a test that fires ten concurrent check-ins and expects exactly one. The bigger change is in how I work. Whenever a business rule says 'only one', I now ask what enforces it when two requests arrive at once, and I make the database the answer. I also add a concurrency test before I ship anything that touches money or points.",
    stretch: {
      title: 'Mock behavioural round with a peer',
      description:
        "Ask a peer to run a 30-minute mock using four questions from a public behavioural question list, chosen without telling you in advance. Ask them to probe with at least two follow-ups per answer and to tell you which answer they found least convincing and why. Revise that story.",
    },
    lightTask:
      "Write two complete STAR stories in the evidence bank template, one success you owned and one genuine failure, run the confidentiality checklist on both, and tell one aloud with a timer, aiming for under three minutes.",
    intensiveExtras: [
      'Expand the bank to ten stories and fill the coverage grid so every theme has two stories.',
      "Record all six stories, transcribe one, and edit it down by a third without losing the decisions or the result.",
      'Write a 90-second answer to "Tell me about yourself" that ties your frontend/backend mix and NearBrew to the roles you are targeting.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['technical-communication', 'feature-ownership'],
    depth: 'standard',
  },
];
