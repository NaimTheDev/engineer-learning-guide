import type { Lesson } from '../types';

export const weeks40to45: Lesson[] = [
  // ---------------------------------------------------------------------------
  // Week 40 — Partitioning and sharding databases
  // ---------------------------------------------------------------------------
  {
    week: 40,
    slug: 'postgres-partitioning-sharding',
    title: 'Partitioning and sharding databases',
    track: 'system-design',
    secondaryTracks: ['backend'],
    topics: [
      'declarative partitioning',
      'range / list / hash partitions',
      'partition pruning',
      'retention via DETACH',
      'sharding',
      'shard key choice',
      'multi-tenant SaaS',
      'hot tenants',
    ],
    objective:
      "By the end you can partition a large Postgres table so that EXPLAIN proves only the relevant partitions are scanned, and you can defend a shard key for a multi-tenant SaaS in terms of locality, balance and resharding cost.",
    whyItMatters:
      "Tables that only ever grow (check-ins, audit logs, events, invoices) eventually make every vacuum, index rebuild and retention DELETE painful. Partitioning is the first, cheap tool: same database, smaller physical pieces, and old data drops in milliseconds. Sharding is the expensive tool you reach for when one machine is no longer enough, and the shard key you pick is one of the hardest decisions to undo in a whole system.",
    explanation: [
      "**Partitioning** splits one logical table into several physical tables inside the same database. Since PostgreSQL 10 this is declarative: you create a parent with `PARTITION BY RANGE (created_at)`, `LIST (region)` or `HASH (tenant_id)`, then attach child tables that each own a slice of the key space. Queries and inserts go to the parent; Postgres routes rows to the right child and, crucially, can skip children that cannot contain matching rows. The parent itself stores no data. A useful mental model: a partitioned table is a view over a UNION ALL of its children, plus a router for writes, plus a planner that knows which children to ignore.",
      "**Partition pruning** is where the performance win comes from, and it only works when the query constrains the partition key in a form the planner can reason about. `WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01'` prunes to one monthly partition at plan time. `WHERE date_trunc('month', created_at) = '2026-03-01'` does not prune at all, because the planner cannot invert an arbitrary function over the key. Values only known at execution time (a prepared-statement parameter, `now()`) can still be pruned at executor startup; EXPLAIN ANALYZE then reports `Subplans Removed: N`. A query that filters only on a non-key column (`cafe_id = 42` on a table partitioned by time) must visit every partition, so partitioning can make that query slightly slower, not faster.",
      "Partitioning has real constraints you should know before proposing it. A primary key or unique constraint on a partitioned table must include every partition-key column, so `PRIMARY KEY (id)` becomes `PRIMARY KEY (id, created_at)`, and global uniqueness of `id` alone is no longer enforced by the database. Indexes created on the parent are created on each partition. Too many partitions (thousands) slow planning and use memory; monthly or weekly partitions for a few years of data is a common sweet spot. The operational superpower is retention: `ALTER TABLE ... DETACH PARTITION` then `DROP TABLE` removes a month of data almost instantly, with no giant DELETE, no bloat and no long vacuum afterwards.",
      "**Sharding** is partitioning across machines: each shard is a separate database server holding a subset of rows, and something (the application, a proxy, or an extension such as Citus) routes each query to the right shard. You gain write throughput and storage beyond one node, but you lose things you took for granted: cross-shard joins, cross-shard transactions, globally unique sequences and simple ad-hoc queries. A senior answer treats sharding as the last resort after indexes, read replicas (week 27), caching (week 4), partitioning and vertical scaling have been exhausted, because it permanently raises the cost of every feature.",
      "The **shard key** decides everything. For a multi-tenant SaaS (invoices, dashboards, audit logs) `tenant_id` is usually the right key: nearly every query is scoped to one tenant, so it hits one shard, joins between a tenant's invoices and customers stay local, and per-tenant transactions remain ordinary ACID transactions. The cost is skew: one 'whale' tenant can be 30% of all data and traffic. Mitigations are a **directory** (a lookup table mapping tenant to shard, so a whale can be moved to a dedicated shard) rather than pure `hash(tenant_id) % N`, and designing the schema so every tenant-owned table carries `tenant_id` from day one. Pure modulo hashing is the trap: changing N remaps almost every key, whereas a directory or a large fixed number of virtual buckets mapped onto physical shards lets you move buckets one at a time.",
      "For a consumer app like NearBrew the choice is less obvious, which makes it good interview material. Sharding check-ins by `user_id` makes 'my history' a single-shard query but turns 'recent check-ins at this café' into a scatter-gather across all shards. Sharding by `cafe_id` flips that. The usual resolution is to pick the key that serves the hottest, latency-sensitive path and serve the other access pattern from a secondary, denormalised copy (for example a per-café feed table maintained asynchronously, which is next week's topic). Say the trade-off out loud: which query becomes single-shard, which becomes fan-out, what happens to hot keys, and how you would add shards later.",
    ],
    examples: [
      {
        language: 'sql',
        title: 'Range by time for check-ins, hash by tenant for SaaS invoices',
        code: `-- Time-series data: range partitions, retention by dropping old months
CREATE TABLE check_ins (
  id         bigserial,
  user_id    bigint      NOT NULL,
  cafe_id    bigint      NOT NULL,
  created_at timestamptz NOT NULL,
  note       text,
  PRIMARY KEY (id, created_at)          -- must include the partition key
) PARTITION BY RANGE (created_at);

CREATE TABLE check_ins_2026_03 PARTITION OF check_ins
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');   -- upper bound is exclusive

-- Multi-tenant data: hash partitions spread tenants evenly
CREATE TABLE invoices (
  tenant_id bigint NOT NULL,
  id        bigserial,
  total_pence integer NOT NULL,
  PRIMARY KEY (tenant_id, id)
) PARTITION BY HASH (tenant_id);

CREATE TABLE invoices_p0 PARTITION OF invoices FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE invoices_p1 PARTITION OF invoices FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE invoices_p2 PARTITION OF invoices FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE invoices_p3 PARTITION OF invoices FOR VALUES WITH (MODULUS 4, REMAINDER 3);`,
      },
      {
        language: 'ts',
        title: 'Directory-based shard routing (application side)',
        code: `// tenant -> bucket is fixed forever; bucket -> shard is a small, editable table.
const BUCKETS = 1024;

function bucketFor(tenantId: number): number {
  return tenantId % BUCKETS; // stable: never changes when shards are added
}

// Loaded from a config table and cached; moving bucket 17 to a new shard is a
// data copy plus one row update here, not a full reshuffle.
const bucketToShard = new Map<number, string>([[17, 'shard-whale-1']]);
const DEFAULT_SHARDS = ['shard-a', 'shard-b', 'shard-c'];

export function shardFor(tenantId: number): string {
  const bucket = bucketFor(tenantId);
  return bucketToShard.get(bucket) ?? DEFAULT_SHARDS[bucket % DEFAULT_SHARDS.length]!;
}`,
      },
    ],
    keyTakeaways: [
      'Partitioning splits a table inside one database; sharding splits data across servers. Reach for partitioning first.',
      'Pruning only happens when the query constrains the partition key directly; wrapping the key in a function disables it.',
      'Unique constraints on a partitioned table must include the partition key.',
      'Dropping or detaching a partition is the fastest, bloat-free way to enforce retention.',
      'For multi-tenant SaaS, tenant_id is usually the shard key; plan for whale tenants with a directory or virtual buckets, not hash modulo N.',
      'Every shard key makes some queries single-shard and others scatter-gather; name both explicitly.',
    ],
    prerequisites: [
      'Reading EXPLAIN output and understanding index scans',
      'Comfort with Docker and psql',
      'Basic understanding of replication and why it does not scale writes',
    ],
    prerequisiteWeeks: [1, 16, 27],
    resources: [
      {
        title: 'PostgreSQL docs: Table Partitioning',
        url: 'https://www.postgresql.org/docs/current/ddl-partitioning.html',
        kind: 'docs',
        note: 'Read the overview, Declarative Partitioning (including its limitations list) and the Partition Pruning section. Skim the inheritance-based section; you will not need it.',
        minutes: 20,
      },
      {
        title: 'PostgreSQL docs: Using EXPLAIN',
        url: 'https://www.postgresql.org/docs/current/using-explain.html',
        kind: 'docs',
        note: 'Refresher for reading plans; look for Append / Merge Append nodes and the Subplans Removed line in the exercise.',
        minutes: 5,
      },
      {
        title: 'PostgreSQL docs: CREATE TABLE (PARTITION OF / FOR VALUES)',
        url: 'https://www.postgresql.org/docs/current/sql-createtable.html',
        kind: 'docs',
        note: 'Reference for the partition_bound_spec syntax for range, list and hash partitions. Use while doing the exercise, not as reading.',
        minutes: 5,
      },
      {
        title: 'Designing Data-Intensive Applications (Martin Kleppmann)',
        url: 'https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/',
        kind: 'book',
        note: 'The chapter on partitioning (sharding): key-range vs hash partitioning, skewed workloads and hot spots, secondary indexes, and rebalancing. Read the rebalancing part if short on time.',
        minutes: 30,
        verify: true,
      },
    ],
    exercise: {
      title: 'Partition NearBrew check-ins and prove pruning with EXPLAIN',
      scenario:
        "NearBrew's check_ins table will grow by millions of rows a month. Product wants 'check-ins this month' stats to stay fast, and legal wants raw check-ins older than 12 months removed. You will build a monthly-partitioned table, load a year of fake data, and use EXPLAIN to see exactly when Postgres prunes partitions and when it cannot. Then you will sketch the shard key decision for a multi-tenant invoices table.",
      setup: [
        'docker run --name pg-part -e POSTGRES_PASSWORD=pg -p 5433:5432 -d postgres:17',
        'docker exec -it pg-part psql -U postgres',
        'Keep a scratch file `notes.md` next to you for plan observations.',
      ],
      steps: [
        'Create the partitioned `check_ins` table from the starter, then run the DO block to create twelve monthly partitions for 2026 and a DEFAULT partition. Run `\\d+ check_ins` and confirm the partitions are listed.',
        'Load one million rows with the generate_series insert, create the `(cafe_id, created_at)` index on the parent, and run `ANALYZE check_ins`. Run `\\di check_ins*` and note that an index exists on every partition.',
        'Run query A (a March date range) with `EXPLAIN`. Confirm only `check_ins_2026_03` appears. Then run with `EXPLAIN (ANALYZE, BUFFERS)` and record the buffers read.',
        "Run query B (the same intent written with `date_trunc`). Confirm every partition appears in the plan. Write one sentence in notes.md explaining why.",
        'Run query C (latest 20 check-ins for one café). Observe it touches every partition, typically via a Merge Append over per-partition index scans. Note whether this is acceptable and what would change if the table were partitioned by cafe_id instead.',
        'Run the prepared-statement experiment with `plan_cache_mode = force_generic_plan` and `EXPLAIN (ANALYZE) EXECUTE`. Find the `Subplans Removed` line: this is runtime pruning.',
        'Retention: detach and drop January. Time it with `\\timing on`. Then, for comparison, time a `DELETE FROM check_ins WHERE created_at < ...` on February and compare.',
        'Insert a row dated 2027-02-10 and check which partition received it (`SELECT tableoid::regclass, * FROM check_ins WHERE created_at > ...`). Explain why the DEFAULT partition is a safety net and also a trap.',
        'Paper exercise (15 min): for a multi-tenant SaaS with invoices, customers and audit_logs, write down your shard key, how routing works, what happens when one tenant becomes 30% of traffic, and which two queries become cross-shard.',
      ],
      starter: [
        {
          language: 'sql',
          title: 'schema-and-data.sql',
          code: `CREATE TABLE check_ins (
  id         bigserial,
  user_id    bigint      NOT NULL,
  cafe_id    bigint      NOT NULL,
  created_at timestamptz NOT NULL,
  note       text,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $$
DECLARE m date := date '2026-01-01';
BEGIN
  WHILE m < date '2027-01-01' LOOP
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF check_ins FOR VALUES FROM (%L) TO (%L)',
      'check_ins_' || to_char(m, 'YYYY_MM'), m, (m + interval '1 month')::date);
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;

CREATE TABLE check_ins_default PARTITION OF check_ins DEFAULT;

INSERT INTO check_ins (user_id, cafe_id, created_at, note)
SELECT (random() * 50000)::int + 1,
       (random() * 2000)::int + 1,
       timestamptz '2026-01-01' + random() * interval '364 days',
       'seed'
FROM generate_series(1, 1000000);

CREATE INDEX ON check_ins (cafe_id, created_at);
ANALYZE check_ins;`,
        },
        {
          language: 'sql',
          title: 'queries.sql',
          code: `-- A: prunes at plan time
EXPLAIN SELECT count(*) FROM check_ins
WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';

-- B: same intent, no pruning (function over the key)
EXPLAIN SELECT count(*) FROM check_ins
WHERE date_trunc('month', created_at) = '2026-03-01';

-- C: filter on a non-key column, visits every partition
EXPLAIN SELECT * FROM check_ins
WHERE cafe_id = 42 ORDER BY created_at DESC LIMIT 20;

-- D: runtime pruning with a generic plan
SET plan_cache_mode = force_generic_plan;
PREPARE week_count(timestamptz) AS
  SELECT count(*) FROM check_ins
  WHERE created_at >= $1 AND created_at < $1 + interval '7 days';
EXPLAIN (ANALYZE) EXECUTE week_count('2026-03-05');

-- Retention
\\timing on
ALTER TABLE check_ins DETACH PARTITION check_ins_2026_01;
DROP TABLE check_ins_2026_01;
DELETE FROM check_ins WHERE created_at < '2026-03-01';  -- compare the time`,
        },
      ],
      expected: [
        'Query A shows a single scan on check_ins_2026_03 (no Append over twelve children).',
        'Query B shows an Append over every partition, including the default.',
        'Query C shows per-partition index scans combined by a Merge Append (or similar) across all partitions.',
        'Query D shows an Append with a line like `Subplans Removed: 11` (the exact number depends on how many partitions the week overlaps).',
        'DETACH + DROP completes in milliseconds; the DELETE of a month takes noticeably longer and leaves dead tuples behind.',
        'The 2027 row lands in check_ins_default.',
      ],
      hints: [
        "If query A still shows every partition, check `SHOW enable_partition_pruning;` and make sure your literal bounds match the key's type.",
        'A week that crosses a month boundary will keep two partitions, so Subplans Removed may be 11 rather than 12.',
        "Rows sitting in the DEFAULT partition block creating a new partition whose range overlaps them; you would have to move them first. That is the 'trap'.",
        'For the paper exercise, think about which table lacks tenant_id today and what that costs you when sharding.',
      ],
      verification: [
        'notes.md contains the plan shape for A, B, C and D and one sentence explaining each.',
        'You can rewrite query B so it prunes, and EXPLAIN confirms it.',
        'You have a written shard-key decision for the SaaS scenario naming a whale-tenant mitigation and two cross-shard queries.',
      ],
    },
    successChecklist: [
      'Created a monthly range-partitioned table with a default partition',
      'Showed plan-time pruning and runtime pruning (Subplans Removed) in EXPLAIN',
      'Demonstrated a query shape that defeats pruning and fixed it',
      'Compared DETACH/DROP retention with a bulk DELETE',
      'Wrote a shard key decision for multi-tenant SaaS covering locality, skew and resharding',
      'Can explain why a partitioned table needs the partition key in its primary key',
    ],
    questions: [
      {
        question:
          'Your teammate partitions a 200M-row audit_logs table by month, and the dashboard query `WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50` gets slower. Why, and what would you suggest?',
        answer:
          "The query does not constrain created_at, so the planner cannot prune and must probe every monthly partition's index and merge the results; more partitions means more index probes and more planning work than one big index would need. Partitioning only helps queries that filter on the partition key, plus maintenance tasks like retention. Options: add a time bound the product can live with (for example the last 90 days) so most partitions are pruned; ensure each partition has a `(tenant_id, created_at)` index so each probe is cheap and a Merge Append can stop early; or reconsider the scheme, such as hash by tenant_id with time-based retention handled differently. The right fix comes from the access pattern, so first list the top queries and check which ones the key serves.",
      },
      {
        question: 'Why is `hash(tenant_id) % number_of_shards` a poor long-term routing scheme, and what do teams use instead?',
        answer:
          'When you go from N to N+1 shards, the modulo changes for almost every key, so nearly all data has to move at once, which is slow, risky and hard to do online. It also gives you no way to isolate a single huge tenant, because placement is purely mathematical. Teams instead hash into a large, fixed number of virtual buckets (say 1024) and keep a small mapping from bucket to physical shard, or keep an explicit directory table from tenant to shard. Adding capacity then means moving some buckets or tenants one at a time, and a whale tenant can be given its own shard by changing one mapping entry. The mapping must be highly available and cached, since every request depends on it.',
      },
      {
        question: 'For NearBrew, compare sharding check-ins by user_id versus cafe_id.',
        answer:
          "By user_id, a user's own history, streaks and favourites are single-shard and writes are spread evenly because there are many users with modest activity. But 'recent check-ins at this café' becomes a scatter-gather across all shards, which gets slower and less reliable as shard count grows. By cafe_id, café feeds and café stats are single-shard, but a viral café becomes a hot shard and a user's history becomes fan-out. A common answer is to shard by the key that serves the most frequent, latency-sensitive read (often user_id for a personal app) and maintain a denormalised per-café feed asynchronously, accepting slight staleness. The important part is naming which path becomes fan-out and how you handle hot keys.",
      },
    ],
    explainPrompt:
      "Explain to a mid-level teammate who just proposed 'let's shard the database' for your multi-tenant SaaS why you would first try partitioning, what partition pruning needs from their queries, and how you would choose a shard key if sharding does become necessary.",
    rubric: [
      'Clearly distinguishes partitioning (one database) from sharding (many servers) and their costs',
      'Explains pruning with a concrete query that prunes and one that does not',
      'Mentions the primary key / unique constraint requirement and retention by dropping partitions',
      'Justifies tenant_id as shard key and addresses skew with a directory or virtual buckets',
      'Names at least one query that becomes cross-shard and what it costs',
    ],
    referenceExplanation:
      "Before we shard, let's be clear about what problem we have. Sharding means multiple database servers, application-level routing, no cross-shard joins or transactions, and a permanent tax on every feature. If the pain is a huge audit_logs or invoices table that is slow to vacuum and impossible to clean up, partitioning inside our one Postgres is the cheaper fix. We'd partition audit_logs by month: each month is its own physical table, retention becomes DETACH and DROP instead of a multi-hour DELETE, and queries that filter on created_at only touch the months they need. That last part only works if the query constrains the partition key directly. `created_at >= '2026-03-01' AND created_at < '2026-04-01'` prunes; `date_trunc('month', created_at) = ...` scans every partition, and a query with no time filter gets a bit slower, so we'd check our top queries first. We also have to include created_at in the primary key. If we genuinely outgrow one primary for writes, the shard key should be tenant_id: almost every query is tenant-scoped, so each request hits one shard and our joins and transactions stay local. The risk is a whale tenant, so I'd route through virtual buckets or a tenant-to-shard directory rather than hash modulo N, which lets us move one tenant without reshuffling everything. The cost to accept is that cross-tenant admin reports become scatter-gather, which we'd serve from an analytics copy instead.",
    stretch: {
      title: 'Automate partition creation and test the default-partition trap',
      description:
        "Write a SQL function `ensure_check_in_partitions(months_ahead int)` that creates any missing future monthly partitions idempotently, and call it from a cron-like loop. Then put a row in the DEFAULT partition for a future month and try to create that month's partition; record the error and write the safe procedure for moving the rows out first.",
    },
    lightTask:
      'Spin up Postgres in Docker, create the partitioned check_ins table with three monthly partitions, insert 30,000 rows with generate_series, and capture EXPLAIN output for one query that prunes to a single partition and one that uses date_trunc and does not. Write two sentences explaining the difference.',
    intensiveExtras: [
      'Repeat the exercise with LIST partitioning by city for NearBrew and see how a query filtering on two cities prunes.',
      'Create the hash-partitioned invoices table, load 100 tenants with one tenant holding 40% of rows, and measure partition sizes with `pg_total_relation_size` to see skew in practice.',
      'Write a one-page ADR (week 33 format) choosing between partitioning and read replicas for a slow reporting dashboard.',
      'Benchmark `DETACH PARTITION ... CONCURRENTLY` (read the docs for its restrictions, including the default partition one) against a plain DETACH while a pgbench-style insert loop runs.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['databases', 'system-design', 'backend-services'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 41 — Event-driven architecture and the transactional outbox
  // ---------------------------------------------------------------------------
  {
    week: 41,
    slug: 'transactional-outbox-at-least-once',
    title: 'Event-driven architecture: at-least-once delivery and the transactional outbox',
    track: 'system-design',
    secondaryTracks: ['backend'],
    topics: [
      'dual-write problem',
      'transactional outbox',
      'message relay / polling publisher',
      'at-least-once delivery',
      'idempotent consumers',
      'inbox / processed messages table',
      'FOR UPDATE SKIP LOCKED',
      'event ordering',
    ],
    objective:
      'By the end you can explain why writing to a database and publishing a message is unsafe without an outbox, build a working outbox relay in Postgres and Node, and make its consumer safe under duplicate delivery.',
    whyItMatters:
      "Almost every product eventually needs 'when X happens, also do Y somewhere else': send a notification after a check-in, update a search index after a review, email an invoice after payment. The naive code works in demos and silently loses or duplicates events in production whenever a process crashes or a broker hiccups. The outbox plus idempotent consumers is the standard, boring, correct answer, and being able to build it from scratch is a strong backend signal.",
    explanation: [
      "Start with the **dual-write problem**. A NearBrew handler inserts a check-in into Postgres and then publishes `CheckInCreated` to a queue so the notifications service can tell friends. Those are two different systems with no shared transaction. If the process crashes after the commit but before the publish, the check-in exists and no one is ever told. If you publish first and the commit then fails, friends get notified about a check-in that does not exist. Retrying does not fix this, because the crash can happen between any two lines. You cannot make two independent systems commit atomically with ordinary code, so you need to change the shape of the problem.",
      "The **transactional outbox** changes the shape: instead of publishing directly, the handler inserts the event into an `outbox` table in the **same database transaction** as the business write. Either both rows commit or neither does, which Postgres guarantees. A separate **relay** (also called a message relay or polling publisher) reads unpublished outbox rows, publishes them to the broker or calls the consumer, and marks them published. The only thing that must be atomic, business state plus 'an event is owed', now lives in one database. Some teams replace the polling relay with change data capture, which tails the database's write-ahead log (Debezium is a well-known tool for this), but the idea is identical.",
      "The relay itself can crash between publishing and marking the row as published. When it restarts it publishes that row again. This is not a bug you can engineer away; it is the definition of **at-least-once delivery**. The only alternatives are at-most-once (mark first, publish second, and lose messages on crash) or a distributed transaction protocol, which most brokers and teams avoid. So you accept duplicates and make them harmless. Each outbox row carries a stable `message_id` (a UUID generated when the row is inserted), and the relay sends it with every attempt.",
      "An **idempotent consumer** processes each message_id at most once in terms of effects. The robust pattern is an **inbox** (processed-messages) table with a unique constraint on message_id, written **in the same transaction** as the consumer's side effect: `INSERT INTO processed_messages (message_id) VALUES ($1) ON CONFLICT DO NOTHING`, and if zero rows were inserted, this is a duplicate, so commit and acknowledge without doing the work again. Checking 'have I seen this?' in a separate step before doing the work is racy: two deliveries can both pass the check. Where the side effect is external and cannot share your transaction (sending a push notification via a provider), pass the message_id as the provider's idempotency key if it supports one, and otherwise accept a small duplicate window and document it.",
      "Concurrency and ordering need explicit decisions. Running several relay instances is safe if each claims a batch with `SELECT ... FOR UPDATE SKIP LOCKED`, so they never pick the same rows. But parallel relays, retries and consumer concurrency all break global ordering. Most systems only need **per-aggregate ordering** (events for one check-in or one invoice in order), which you get by partitioning work by aggregate id or by having consumers tolerate out-of-order events with version numbers, ignoring an event older than the state they already have. The other operational details: index `WHERE published_at IS NULL` so polling stays cheap, delete or archive published rows on a schedule, alert on outbox lag (age of the oldest unpublished row), and decide what happens to a message that keeps failing (a dead-letter state, as in week 10).",
      "Polling every 500 ms adds latency and a small constant load; Postgres `LISTEN/NOTIFY` can wake the relay immediately after a commit, with polling kept as a fallback because notifications are not durable. A final design note: hold the claiming transaction open only as long as necessary. The simple relay in this week's exercise keeps the row lock while it calls the consumer, which is easy to reason about but ties up a connection during slow calls; a more scalable version claims rows by setting a `claimed_until` lease, commits, publishes, then marks them published.",
    ],
    examples: [
      {
        language: 'ts',
        title: 'Business write and outbox insert in one transaction',
        code: `import type { PoolClient } from 'pg';

export async function createCheckIn(client: PoolClient, userId: number, cafeId: number) {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query(
      'INSERT INTO check_ins (user_id, cafe_id) VALUES ($1, $2) RETURNING id',
      [userId, cafeId],
    );
    const checkInId = rows[0].id;
    await client.query(
      "INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload) VALUES ('check_in', $1, 'CheckInCreated', $2)",
      [checkInId, JSON.stringify({ checkInId, userId, cafeId })],
    );
    await client.query('COMMIT'); // both rows, or neither
    return checkInId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}`,
      },
    ],
    keyTakeaways: [
      'Writing to a database and publishing to a broker are two commits; a crash between them loses or invents events.',
      'The outbox makes the event part of the business transaction; a relay delivers it afterwards.',
      'Relays deliver at-least-once by nature, so consumers must be idempotent.',
      'Idempotency belongs in the same transaction as the side effect, enforced by a unique constraint on message_id.',
      'SKIP LOCKED lets multiple relays share work; ordering guarantees are per aggregate at best.',
      'Monitor outbox lag and clean up published rows.',
    ],
    prerequisites: [
      'Database transactions and isolation levels',
      'Background jobs, retries and dead letters',
      'Basic Node.js async/await and the `pg` client',
    ],
    prerequisiteWeeks: [7, 10, 34],
    resources: [
      {
        title: 'microservices.io: Pattern — Transactional outbox',
        url: 'https://microservices.io/patterns/data/transactional-outbox.html',
        kind: 'article',
        note: "Read the problem, forces and solution sections, and the 'related patterns' list (polling publisher, transaction log tailing, idempotent consumer).",
        minutes: 10,
        verify: true,
      },
      {
        title: 'PostgreSQL docs: SELECT (The Locking Clause)',
        url: 'https://www.postgresql.org/docs/current/sql-select.html',
        kind: 'docs',
        note: 'Find the Locking Clause section and read what FOR UPDATE, NOWAIT and SKIP LOCKED do, including the note that SKIP LOCKED gives an inconsistent view and is meant for queue-like tables.',
        minutes: 8,
      },
      {
        title: 'PostgreSQL docs: NOTIFY',
        url: 'https://www.postgresql.org/docs/current/sql-notify.html',
        kind: 'docs',
        note: 'Read how notifications are delivered only at commit and are not stored for listeners that are offline, which is why polling stays as a fallback.',
        minutes: 5,
      },
      {
        title: 'Designing Data-Intensive Applications (Martin Kleppmann)',
        url: 'https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/',
        kind: 'book',
        note: 'The chapter on stream processing: the parts on keeping systems in sync, change data capture and the dual-write problem.',
        minutes: 15,
        verify: true,
      },
    ],
    exercise: {
      title: 'Build an outbox relay for NearBrew check-in notifications, then break it',
      scenario:
        "When a NearBrew user checks in, a notification row should be created for them by a separate 'notifications' service. You will write check-ins plus outbox events transactionally, run a Node relay that delivers events over HTTP to a consumer, inject crashes and failures, observe duplicates, and then make the consumer idempotent so the final state is exactly one notification per check-in.",
      setup: [
        'docker run --name pg-outbox -e POSTGRES_PASSWORD=pg -p 5434:5432 -d postgres:17',
        'mkdir outbox-lab && cd outbox-lab && npm init -y && npm i pg',
        'Set `"type": "module"` in package.json.',
        'export DATABASE_URL=postgres://postgres:pg@localhost:5434/postgres',
        'Run schema.sql: `docker exec -i pg-outbox psql -U postgres < schema.sql`',
      ],
      steps: [
        'Create the schema from the starter. Note the partial index on unpublished rows and the unique primary key on processed_messages.message_id.',
        'Start the consumer with `FAIL_RATE=0 node consumer.mjs`, then the relay with `node relay.mjs`. Run `node api.mjs 50` to create 50 check-ins. Confirm 50 outbox rows become published and 50 notifications exist.',
        'Inject consumer failures: restart the consumer with `FAIL_RATE=0.3`. Create 50 more check-ins. Watch the relay log errors and retry. Confirm all 100 events eventually publish.',
        'Inject the dangerous crash: run the relay with `CRASH_AFTER_PUBLISH=1`, create 5 check-ins, then restart the relay normally. Count notifications per check-in: `SELECT text, count(*) FROM notifications GROUP BY text HAVING count(*) > 1;`. You should find a duplicate.',
        'Explain in one sentence, in a comment at the top of relay.mjs, why that duplicate is unavoidable on the producer side.',
        'Make the consumer idempotent: inside its transaction, insert the messageId into processed_messages with ON CONFLICT DO NOTHING, and skip the notification insert if rowCount is 0. Still respond 200 for duplicates.',
        'Truncate notifications, processed_messages and reset outbox (`UPDATE outbox SET published_at = NULL`) to replay everything. Run the relay and confirm exactly one notification per check-in, even though every message was delivered again.',
        'Run two relays at once (two terminals) and create 200 check-ins. Confirm no message is processed twice by checking processed_messages count equals outbox count, and observe that FOR UPDATE SKIP LOCKED splits the work.',
        'Add an outbox lag query (age of the oldest unpublished row) and print it from the relay every 10 seconds. Stop the consumer and watch lag grow.',
      ],
      starter: [
        {
          language: 'sql',
          title: 'schema.sql',
          code: `CREATE TABLE check_ins (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL,
  cafe_id    bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
  seq            bigserial PRIMARY KEY,                    -- delivery order
  message_id     uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  aggregate_type text NOT NULL,
  aggregate_id   bigint NOT NULL,
  event_type     text NOT NULL,
  payload        jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz,
  attempts       int NOT NULL DEFAULT 0
);
CREATE INDEX outbox_unpublished ON outbox (seq) WHERE published_at IS NULL;

-- Owned by the "notifications service" (same DB here for simplicity)
CREATE TABLE notifications (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE processed_messages (
  message_id   uuid PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);`,
        },
        {
          language: 'js',
          title: 'api.mjs (creates N check-ins with outbox events)',
          code: `import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function createCheckIn(userId, cafeId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO check_ins (user_id, cafe_id) VALUES ($1, $2) RETURNING id', [userId, cafeId]);
    const checkInId = rows[0].id;
    await client.query(
      "INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload) VALUES ('check_in', $1, 'CheckInCreated', $2)",
      [checkInId, JSON.stringify({ checkInId, userId, cafeId })]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const n = Number(process.argv[2] || 10);
for (let i = 0; i < n; i++) {
  await createCheckIn(1 + (i % 20), 100 + i);
}
console.log('created', n, 'check-ins');
await pool.end();`,
        },
        {
          language: 'js',
          title: 'relay.mjs (polling publisher)',
          code: `import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const CONSUMER_URL = 'http://localhost:4001/events';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tick() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT seq, message_id, event_type, payload FROM outbox ' +
      'WHERE published_at IS NULL ORDER BY seq LIMIT 10 FOR UPDATE SKIP LOCKED');
    for (const row of rows) {
      const res = await fetch(CONSUMER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId: row.message_id, type: row.event_type, payload: row.payload }),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) throw new Error('consumer returned ' + res.status + ' for seq ' + row.seq);
      if (process.env.CRASH_AFTER_PUBLISH === '1') {
        console.log('simulated crash after publishing seq', row.seq);
        process.exit(1); // the UPDATE below never runs; the transaction is rolled back
      }
      await client.query('UPDATE outbox SET published_at = now() WHERE seq = $1', [row.seq]);
    }
    await client.query('COMMIT');
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

for (;;) {
  try {
    const n = await tick();
    if (n === 0) await sleep(500);
  } catch (err) {
    console.error('relay error:', err.message);
    await sleep(1000); // TODO: exponential backoff + attempts counter + dead-letter state
  }
}`,
        },
        {
          language: 'js',
          title: 'consumer.mjs (notifications service, NOT yet idempotent)',
          code: `import http from 'node:http';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const FAIL_RATE = Number(process.env.FAIL_RATE || 0);

http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/events') { res.writeHead(404).end(); return; }
  let body = '';
  for await (const chunk of req) body += chunk;
  const msg = JSON.parse(body);

  if (Math.random() < FAIL_RATE) { res.writeHead(503).end('flaky'); return; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // TODO(step 6): record msg.messageId in processed_messages in THIS transaction
    // and skip the insert below if it was already there.
    await client.query('INSERT INTO notifications (user_id, text) VALUES ($1, $2)',
      [msg.payload.userId, 'Checked in: check-in ' + msg.payload.checkInId]);
    await client.query('COMMIT');
    res.writeHead(200).end('ok');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.writeHead(500).end('error');
  } finally {
    client.release();
  }
}).listen(4001, () => console.log('consumer on :4001'));`,
        },
      ],
      expected: [
        'With no failures, outbox rows, check-ins and notifications counts all match.',
        'With FAIL_RATE=0.3 the relay logs errors but every outbox row is eventually published (the batch rolls back and is retried).',
        'After CRASH_AFTER_PUBLISH, the non-idempotent consumer has at least one duplicated notification.',
        'After the idempotency fix and a full replay, there is exactly one notification per check-in.',
        'Two relays running together never deliver the same row concurrently, and processed_messages count equals outbox count.',
        'The lag metric grows while the consumer is down and returns to zero after it comes back.',
      ],
      hints: [
        "In node-postgres, `result.rowCount` tells you whether `INSERT ... ON CONFLICT DO NOTHING` inserted a row.",
        'Notice that when one message in a batch fails, the whole batch rolls back and earlier messages in it get redelivered. That is another source of duplicates, and another reason idempotency is mandatory.',
        'Lag query: `SELECT now() - min(created_at) AS lag FROM outbox WHERE published_at IS NULL;`',
        'If the relay hangs, check that the consumer is listening on port 4001 and that the 2-second timeout is firing.',
      ],
      verification: [
        '`SELECT count(*) FROM notifications` equals `SELECT count(*) FROM check_ins` after a crash-and-replay run.',
        '`SELECT count(*) FROM processed_messages` equals `SELECT count(*) FROM outbox`.',
        'You can point to the exact line where a crash would cause a duplicate and explain why moving the UPDATE earlier would instead cause message loss.',
      ],
    },
    successChecklist: [
      'Business row and outbox row are written in one transaction',
      'Relay claims rows with FOR UPDATE SKIP LOCKED and marks them published',
      'Reproduced a duplicate delivery via an injected crash',
      'Consumer deduplicates using a unique message_id inside its own transaction',
      'Ran two relays concurrently without double processing',
      'Added an outbox lag measurement',
    ],
    questions: [
      {
        question: 'Why not just publish to the queue inside the database transaction, before COMMIT?',
        answer:
          "Publishing before COMMIT means the message can go out and then the commit can fail (constraint violation, deadlock, connection drop), so consumers act on a check-in that never existed. Publishing after COMMIT means a crash between the two loses the message forever. Wrapping both in one try/catch does not help, because the problem is a process dying, not an exception being thrown. Unless the database and the broker share a distributed transaction protocol, which most setups avoid for complexity and availability reasons, there is no ordering of the two calls that is safe. The outbox works because it turns the publish into a row in the same database transaction, and the actual delivery becomes a retryable background job.",
      },
      {
        question: 'A consumer does `SELECT 1 FROM processed_messages WHERE message_id = $1`, and if nothing is found, sends the notification and then inserts the id. What can go wrong?',
        answer:
          "Two deliveries of the same message can arrive concurrently (two relays, a retry after a timeout where the first attempt was actually still running). Both run the SELECT, both see nothing, both send the notification, and the second INSERT fails or succeeds depending on constraints, but the side effect already happened twice. It is a classic check-then-act race. The fix is to make the unique constraint the arbiter: insert the message_id first with ON CONFLICT DO NOTHING in the same transaction as the side effect, and only do the work if the insert actually created a row. Concurrent duplicates then block on the unique index until the first transaction commits, and see the conflict.",
      },
      {
        question: 'Your NearBrew consumer must process CheckInCreated then CheckInDeleted for the same check-in. With two relays and retries, they might arrive out of order. How do you handle it?',
        answer:
          "First decide what ordering you actually need: here it is per check-in, not global. One option is to route all events for one aggregate through the same relay worker or broker partition (keyed by aggregate_id), which preserves order for that key while still allowing parallelism across keys. Another is to make the consumer order-tolerant: include an aggregate version or sequence number in each event and have the consumer store the last version applied per aggregate, ignoring older events, or treat a delete as a tombstone so a late create for a deleted check-in is discarded. Many real systems combine both, because retries can reorder even within a partition. Document the guarantee so downstream teams don't assume global ordering.",
      },
    ],
    explainPrompt:
      "Explain to an interviewer, as if answering 'how do you reliably send a notification when a booking is created?', what the dual-write problem is, how the transactional outbox solves it, and why the consumer still has to be idempotent.",
    rubric: [
      'States the dual-write problem with a specific crash point',
      'Describes the outbox insert in the same transaction and the relay as separate steps',
      'Explains why delivery is at-least-once and where duplicates come from',
      'Describes an idempotent consumer using a unique message_id inside the side-effect transaction',
      'Mentions an operational concern: lag monitoring, cleanup, poison messages or ordering',
    ],
    referenceExplanation:
      "The naive version inserts the booking, commits, then publishes BookingCreated to a queue. That's two separate systems, so a crash between commit and publish leaves a booking that nobody is ever notified about, and publishing first risks notifying about a booking whose commit then fails. No ordering of those two calls is safe. With the transactional outbox, the handler inserts the booking and a row in an outbox table in the same Postgres transaction, so the database guarantees we have either both or neither. A separate relay polls unpublished outbox rows, claiming them with FOR UPDATE SKIP LOCKED so several relays can run, sends each to the broker or consumer, and marks it published. The relay can still crash after sending but before marking, so on restart it sends that event again. That makes delivery at-least-once, and the alternative is losing messages, so we accept duplicates and make them harmless. Each event has a UUID message_id. The notification consumer, in the same transaction as creating the notification, inserts that id into a processed_messages table with a unique key and ON CONFLICT DO NOTHING; if nothing was inserted it's a duplicate, so it acknowledges without acting. For the actual push send, I'd pass the message_id as an idempotency key if the provider supports one. Operationally, I'd alert on outbox lag, meaning the age of the oldest unpublished row, clean up published rows on a schedule, and move messages that keep failing to a dead-letter state so they don't block the rest.",
    stretch: {
      title: 'Lease-based claiming and LISTEN/NOTIFY',
      description:
        "Refactor the relay so it does not hold row locks during HTTP calls: claim a batch by setting `claimed_until = now() + interval '30 seconds'` and committing, deliver, then mark published. Add an exponential backoff with attempts and a dead-letter state after 5 failures. Then add a trigger that runs `pg_notify('outbox', '')` on insert and have the relay LISTEN so latency drops from ~500 ms to near zero, keeping polling as the fallback.",
    },
    lightTask:
      'Create the outbox and processed_messages tables, then write (on paper or in a file) the consumer transaction that inserts the message_id with ON CONFLICT DO NOTHING and only creates a notification if a row was inserted. Annotate the relay starter code with the exact line where a crash causes a duplicate.',
    intensiveExtras: [
      'Add a retention job that deletes published outbox rows older than 7 days in batches of 1,000 and measure its effect on the partial index size.',
      'Swap the HTTP consumer for a second Postgres table acting as a "broker" and repeat the crash experiment to confirm the guarantees do not depend on transport.',
      'Write a short design note comparing a polling relay with change data capture (log tailing): latency, operational burden, schema coupling.',
      'Add per-aggregate ordering by having each relay worker only claim rows where `aggregate_id % workers = worker_index`.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['system-design', 'backend-services', 'production-reliability'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 42 — UI reliability
  // ---------------------------------------------------------------------------
  {
    week: 42,
    slug: 'ui-reliability-error-boundaries-flags',
    title: 'UI reliability: error boundaries, graceful degradation, feature flags, client monitoring',
    track: 'frontend',
    topics: [
      'error boundaries',
      'getDerivedStateFromError',
      'componentDidCatch',
      'graceful degradation',
      'section-level fallbacks',
      'timeouts and retries',
      'feature flags / kill switches',
      'client error monitoring',
    ],
    objective:
      'By the end you can design a home screen where any single section can fail, by API error, slow response or a render crash, without taking down the rest, and you can explain which failures error boundaries catch and which they do not.',
    whyItMatters:
      "A home screen is usually stitched together from several independent APIs. If one of them returns a 500 or a malformed payload and the whole screen goes white, every user loses the product, not just the feature. Senior UI engineers design the failure modes on purpose: what the user sees when each piece fails, how the team turns a broken feature off without a deploy, and how they find out it broke before users complain.",
    explanation: [
      "An **error boundary** is a class component that implements `static getDerivedStateFromError(error)` (return state that switches to a fallback UI) and usually `componentDidCatch(error, info)` (side effects such as reporting, with `info.componentStack`). When any component below it throws **during rendering, in a lifecycle method, or in a constructor**, React unmounts the broken subtree and renders the boundary's fallback instead. Without any boundary, an uncaught render error unmounts the whole root, which is why a single `review.author.name` on an undefined author can blank an entire app. There is no hook equivalent for defining a boundary; you write one small class (or use a well-known community package such as react-error-boundary) and reuse it.",
      "Know precisely what boundaries do **not** catch: errors in event handlers, in async code (a rejected promise in `useEffect`, a `setTimeout` callback), errors thrown in the boundary itself, and errors during server rendering. A failed `fetch` inside `useEffect` never reaches a boundary on its own. You either handle it as state (`status: 'error'`) and render an inline error, or deliberately rethrow it during render so the nearest boundary handles it. Data libraries and Suspense-based fetching often offer an option to throw fetch errors into boundaries. Pick one convention per codebase, because a mix is how errors end up handled twice or not at all. React 19's `createRoot` also accepts root-level callbacks such as `onCaughtError` and `onUncaughtError`, which are a convenient single place to report.",
      "**Granularity** is the design decision. One boundary at the root is a last resort that shows a friendly 'something went wrong, reload' page. Boundaries around each independent section of a screen (NearBrew's Nearby cafés, Your favourites, Recent reviews, a promo banner) mean one failure costs one section. Too fine (a boundary per card) adds noise and can leave a screen of tiny error boxes. Decide per section what the fallback is: a compact retry message for core content, **hiding** non-essential content entirely (a broken promo should just disappear), or showing **stale cached data** with a subtle 'may be out of date' note. A boundary needs a way to recover: reset its error state on a retry click or when a key such as the user id or route changes.",
      "**Graceful degradation** covers failures that are not exceptions. A slow API is worse than a failed one if the UI waits forever, so give each section its own timeout (`AbortSignal.timeout(3000)`), render a skeleton while loading, and never let one slow section block the others (fetch in parallel, render each when ready). Validate payloads at the boundary between network and UI (week 6: `unknown` at the edges) so a malformed response becomes a handled error state rather than a render crash deep in the tree. Retry with backoff for idempotent GETs, but cap retries so a broken backend is not hammered by every client at once (week 34).",
      "**Feature flags** separate deploy from release. Pete Hodgson's taxonomy is useful: release toggles (hide unfinished work, short-lived), experiment toggles (A/B tests), ops toggles (kill switches to disable an expensive or broken feature in production) and permission toggles (features for some users). For reliability the ops toggle matters most: if the new 'Trending near you' row starts crashing, you flip it off without a deploy or app-store review, which for a mobile app like NearBrew can take days. Rules that keep flags safe: a hard-coded safe default when the flag service is unreachable, evaluate once per session or screen so the UI does not flicker mid-use, and delete release flags promptly because every flag doubles a code path you must test.",
      "**Client monitoring** closes the loop. Report from `componentDidCatch` or root error callbacks, and also listen to `window` `error` and `unhandledrejection` events for errors outside React. Every report should include the release version, route, a component stack where available, and a few breadcrumbs (last actions or requests), while scrubbing personal data such as emails and tokens. Sample high-volume errors, group by fingerprint, and alert on rate changes after a release rather than on single events. The goal is that a section-level fallback rendering in production shows up on a dashboard within minutes.",
    ],
    examples: [
      {
        language: 'tsx',
        title: 'A reusable section boundary with reset and reporting',
        code: `import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  name: string;                       // used in reports and logs
  fallback: (reset: () => void) => ReactNode;
  resetKey?: unknown;                 // e.g. userId: changing it clears the error
  children: ReactNode;
};
type State = { error: Error | null; prevResetKey: unknown };

export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null, prevResetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };                 // render the fallback on the next pass
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.prevResetKey
      ? { error: null, prevResetKey: props.resetKey }
      : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError({ section: this.props.name, message: error.message, stack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    return this.state.error ? this.props.fallback(this.reset) : this.props.children;
  }
}

declare function reportError(e: { section: string; message: string; stack?: string | null }): void;`,
      },
    ],
    keyTakeaways: [
      'Error boundaries catch render, lifecycle and constructor errors in their subtree, not event handler or async errors.',
      'Place boundaries per independent section; decide per section whether to show a retry, hide, or show stale data.',
      'Handle fetch failures and timeouts as explicit state, and validate payloads so bad data does not become a render crash.',
      'Ops feature flags are kill switches; always have a safe default when the flag service is down.',
      'Report errors with release, route and component stack, scrub PII, and alert on rate changes.',
    ],
    prerequisites: [
      'React components, hooks and rendering',
      'Client-side data fetching and caching patterns',
      'Basic observability vocabulary (metrics, alerts)',
    ],
    prerequisiteWeeks: [2, 6, 15, 23],
    resources: [
      {
        title: 'react.dev: Catching rendering errors with an error boundary',
        url: 'https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary',
        kind: 'docs',
        note: 'Read this section plus the static getDerivedStateFromError and componentDidCatch reference entries on the same page.',
        minutes: 12,
      },
      {
        title: 'react.dev: createRoot',
        url: 'https://react.dev/reference/react-dom/client/createRoot',
        kind: 'docs',
        note: 'Read the options (onCaughtError, onUncaughtError, onRecoverableError) and the examples showing how to report errors centrally.',
        minutes: 5,
      },
      {
        title: 'Feature Toggles (aka Feature Flags) — Pete Hodgson on martinfowler.com',
        url: 'https://martinfowler.com/articles/feature-toggles.html',
        kind: 'article',
        note: 'Read the categories of toggles (release, experiment, ops, permissioning) and the section on managing toggle debt. Skim the implementation techniques.',
        minutes: 15,
      },
      {
        title: 'MDN: Window unhandledrejection event',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event',
        kind: 'docs',
        note: 'How to catch promise rejections nobody handled; pair with the Window error event for a minimal global reporter.',
        minutes: 3,
      },
    ],
    exercise: {
      title: 'Make the NearBrew home screen survive any one section failing',
      scenario:
        "NearBrew's web home screen has four sections: Nearby cafés, Your favourites, Recent reviews and a 'Try our seasonal menu' promo behind a feature flag. Each calls its own (mock) API. Today, any error blanks the page. You will add failure injection, section boundaries, explicit loading and error states, a timeout, and a kill switch, then prove each failure mode leaves the other sections usable.",
      setup: [
        'npm create vite@latest nearbrew-home -- --template react-ts && cd nearbrew-home && npm install',
        'Replace src/App.tsx with the starter and add src/api.ts.',
        'npm run dev, then open the URL with query params such as `?fail=nearby` or `?malformed=reviews` or `?slow=favourites`.',
      ],
      steps: [
        'Run the starter with no params and confirm all four sections render. Then try `?malformed=reviews`: the whole page goes blank and the console shows an uncaught error. This is the baseline problem.',
        'Add the SectionBoundary from the worked example (with a console.log based reportError). Wrap each section. Re-test `?malformed=reviews`: only Recent reviews shows a fallback.',
        'Try `?fail=nearby`. Notice the boundary does NOT catch it (the rejection happens inside useEffect). Extend `useSection` to expose `status: \'loading\' | \'error\' | \'ready\'` and a `retry` function, and render an inline error with a Retry button for Nearby.',
        "Try `?slow=favourites` (the mock never resolves for 20 seconds). Add a 3-second timeout with `AbortSignal.timeout(3000)` passed to the mock and show 'Taking longer than usual' plus Retry.",
        "Decide each section's fallback policy and implement it: Nearby (core) shows retry; Favourites shows the last cached value from localStorage if available, wrapped in try/catch; Reviews shows retry; Promo is hidden entirely on any failure.",
        'Add a flag object loaded from `/flags.json` in public/, with a hard-coded safe default `{ promo: false }` if the fetch fails. Set promo true in the file, then simulate an incident by setting it to false and reloading: the promo disappears without a code change.',
        "Add a global reporter: `window.addEventListener('error', ...)` and `unhandledrejection`, logging release version and route. Trigger one via a button whose click handler throws, and confirm the boundary does not catch it but the global reporter does.",
        'Combine failures: `?fail=nearby&malformed=reviews&slow=favourites`. The header, promo and any healthy sections must still render and remain interactive.',
      ],
      starter: [
        {
          language: 'ts',
          title: 'src/api.ts (mock APIs with failure injection)',
          code: `const params = new URLSearchParams(window.location.search);
const has = (key: string, section: string) => (params.get(key) ?? '').split(',').includes(section);

function mock<T>(section: string, good: T, malformed: unknown, signal?: AbortSignal): Promise<T> {
  const delay = has('slow', section) ? 20000 : 300 + Math.random() * 400;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      if (has('fail', section)) reject(new Error(section + ' API returned 503'));
      else resolve((has('malformed', section) ? malformed : good) as T);
    }, delay);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); });
  });
}

export type Cafe = { id: string; name: string; distanceM: number };
export type Review = { id: string; text: string; author: { name: string } };

export const api = {
  nearby: (s?: AbortSignal) => mock<Cafe[]>('nearby',
    [{ id: 'c1', name: 'Flat White Lab', distanceM: 120 }, { id: 'c2', name: 'Bean There', distanceM: 340 }], null, s),
  favourites: (s?: AbortSignal) => mock<Cafe[]>('favourites',
    [{ id: 'c9', name: 'Ritual Roasters', distanceM: 2100 }], [], s),
  reviews: (s?: AbortSignal) => mock<Review[]>('reviews',
    [{ id: 'r1', text: 'Great oat flat white', author: { name: 'Sam' } }],
    [{ id: 'r1', text: 'Great oat flat white' }], s), // author missing -> render crash
};`,
        },
        {
          language: 'tsx',
          title: 'src/App.tsx (starter: fragile on purpose)',
          code: `import { useEffect, useState } from 'react';
import { api, type Cafe, type Review } from './api';

function useSection<T>(load: (s?: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    load().then(setData); // TODO: status, error, timeout, retry
  }, [load]);
  return data;
}

function Nearby() {
  const cafes = useSection<Cafe[]>(api.nearby);
  if (!cafes) return <p>Loading nearby...</p>;
  return <ul>{cafes.map((c) => <li key={c.id}>{c.name} · {c.distanceM} m</li>)}</ul>;
}

function Favourites() {
  const cafes = useSection<Cafe[]>(api.favourites);
  if (!cafes) return <p>Loading favourites...</p>;
  return <ul>{cafes.map((c) => <li key={c.id}>{c.name}</li>)}</ul>;
}

function Reviews() {
  const reviews = useSection<Review[]>(api.reviews);
  if (!reviews) return <p>Loading reviews...</p>;
  return <ul>{reviews.map((r) => <li key={r.id}>{r.text} by {r.author.name}</li>)}</ul>;
}

function Promo() {
  return <aside>Try our seasonal menu</aside>; // TODO: behind flags.promo
}

export default function App() {
  return (
    <main>
      <h1>NearBrew</h1>
      <Promo />
      <section><h2>Nearby</h2><Nearby /></section>
      <section><h2>Your favourites</h2><Favourites /></section>
      <section><h2>Recent reviews</h2><Reviews /></section>
    </main>
  );
}`,
        },
      ],
      expected: [
        'With `?malformed=reviews`, only the reviews section shows its fallback and a report is logged with the component stack.',
        'With `?fail=nearby`, Nearby shows an inline error and Retry; clicking Retry with the param removed (or after a successful attempt) recovers.',
        'With `?slow=favourites`, Favourites shows a timeout message after about 3 seconds instead of loading forever.',
        'Setting promo false in flags.json hides the promo on reload; deleting flags.json also hides it (safe default).',
        'A throwing click handler is caught by the global error listener, not by any boundary.',
        'With all failures combined, the page header and healthy sections remain interactive.',
      ],
      hints: [
        'Pass a stable function to useSection (module-level api functions are stable) or the effect will refire every render.',
        'For retry, keep an `attempt` counter in state and include it in the effect dependencies.',
        'In React dev mode, errors caught by a boundary are still logged to the console; that is expected.',
        'Use a type guard to validate reviews (every item has author.name) and you can turn the malformed case into a handled error instead of a crash; try both approaches and decide which you prefer.',
      ],
      verification: [
        'Run each failure query param individually and combined, and screenshot or note the result for each.',
        'Write a four-row table (section, failure, user sees, reported?) in your notes.',
        'Explain to yourself why the fetch rejection in step 3 bypassed the boundary.',
      ],
    },
    successChecklist: [
      'Every independent section is wrapped in its own error boundary with a defined fallback',
      'Fetch errors and timeouts are handled as explicit state with retry',
      'At least one section degrades by hiding and one by showing stale data',
      'A feature flag acts as a kill switch with a safe default',
      'Global error and unhandledrejection reporting is in place',
      'Can state exactly which error types boundaries do and do not catch',
    ],
    questions: [
      {
        question: 'A teammate wraps the app in one error boundary and says reliability is handled. What is missing?',
        answer:
          "A single root boundary prevents a white screen but turns any section's failure into a whole-app failure, because the entire tree is replaced by the fallback. Section-level boundaries contain the blast radius so one broken row costs one row. It also does nothing for errors boundaries never see: fetch rejections in effects, event handler errors, timeouts and slow responses. Those need explicit loading, error and timeout states, plus global error and unhandledrejection listeners for reporting. Finally, there is no recovery path or monitoring story, such as resetting on retry or route change and reporting with release and route so the team notices.",
      },
      {
        question: 'Why should a kill-switch flag default to off when the flag service is unreachable, and when might that be the wrong default?',
        answer:
          "If the flag service is down and the default is 'on', a feature you disabled during an incident comes back exactly when your infrastructure is already struggling, which defeats the kill switch. Defaulting to the conservative state, usually 'feature off' and the old code path, means flag-service outages degrade to known-safe behaviour. The exception is when 'off' is the risky path, for example a flag that enables a fix or routes traffic away from a failing dependency, where the safe default is 'on'. The real rule is to choose, per flag, the default that is safe under failure, and to cache the last known values so a brief outage changes nothing.",
      },
      {
        question: 'In the NearBrew home screen, should a malformed reviews payload be caught by an error boundary or by validation in the data layer?',
        answer:
          'Ideally by validation at the network boundary: parse the response as unknown, check its shape, and turn invalid data into an error state with a clear message such as \'reviews payload invalid\', reported with the endpoint and release. That gives you a precise error report and lets you decide policy, perhaps dropping only the invalid items and rendering the rest. The error boundary remains the safety net for anything validation misses, such as bugs in rendering logic itself. Relying only on the boundary works, but the report will be a vague TypeError deep in a component, and the entire section is lost even if only one item was bad. Defence in depth is the senior answer.',
      },
    ],
    explainPrompt:
      "Explain to a product manager and a junior engineer together how the NearBrew home screen behaves when one of its APIs fails, and why, covering error boundaries, explicit error states, feature-flag kill switches and how the team gets alerted.",
    rubric: [
      'Explains failure isolation per section in user-visible terms',
      'Correctly states what error boundaries catch and what needs explicit state handling',
      'Describes at least two different degradation choices (retry, hide, stale data) and why each fits its section',
      'Explains a kill switch and its safe default',
      'Describes monitoring that would reveal a fallback rendering in production',
    ],
    referenceExplanation:
      "The home screen is four independent pieces, Nearby, Favourites, Recent reviews and a promo, each from its own API. We've designed it so any one of them can fail without breaking the others. In code, each section sits inside its own error boundary: if a section's rendering code crashes, for example because the reviews API sends a review without an author, React swaps just that section for a small fallback, and the rest of the page keeps working. Boundaries only catch crashes during rendering, though. A failed or slow network call isn't a crash, so each section also tracks loading, error and ready states, gives up after three seconds, and shows a Retry button. We chose a different fallback per section based on value: Nearby is the core of the app, so it shows retry; Favourites shows the last list we saved, marked as possibly out of date; the promo simply disappears, because a missing banner is better than an error box. The promo is also behind a feature flag. If it misbehaves in production, we switch it off from config without shipping an app update, and if the flag service itself is down we default to off. Finally, every fallback and every uncaught error is reported with the app version and screen, minus personal data, so a spike after a release shows up on a dashboard and alerts us before the support tickets do.",
    stretch: {
      title: 'Throw-to-boundary data fetching with Suspense',
      description:
        "Rewrite one section to fetch with React's `use` hook (or a data library's Suspense mode) so loading is handled by a Suspense fallback and errors propagate to the boundary. Compare the code size and the error-handling flow with the explicit-state version, and write down which you would standardise on for a team and why.",
    },
    lightTask:
      'Take the starter, add one SectionBoundary around Recent reviews, and confirm `?malformed=reviews` no longer blanks the page. Then write three sentences on why `?fail=nearby` still is not handled by that boundary and what you would do about it.',
    intensiveExtras: [
      'Add a tiny report queue that batches error reports and sends them with `navigator.sendBeacon` on page hide, with a sampling rate.',
      'Write Vitest + Testing Library tests that render the home screen with a throwing child and assert the other sections are still present.',
      'Implement a percentage-rollout flag (hash userId into 0–99) and show the same user always gets the same variant.',
      'Draft a one-page runbook: "Home screen section failing in production" covering where to look, which flag to flip, and how to verify recovery.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['ui-reliability', 'react-architecture', 'production-reliability', 'feature-ownership'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 43 — Web security for full-stack engineers
  // ---------------------------------------------------------------------------
  {
    week: 43,
    slug: 'web-security-xss-csrf-injection-idor',
    title: 'Web security for full-stack engineers: authn/authz, sessions vs tokens, XSS, CSRF, injection',
    track: 'backend',
    secondaryTracks: ['frontend'],
    topics: [
      'OWASP Top 10',
      'authentication vs authorization',
      'broken access control / IDOR',
      'sessions vs tokens',
      'XSS and output encoding',
      'CSP',
      'CSRF and SameSite cookies',
      'SQL injection and parameterised queries',
    ],
    objective:
      'By the end you can find and fix XSS, SQL injection, IDOR and CSRF in a small PHP app, explain each attack in one sentence, and choose between server sessions and tokens with clear trade-offs.',
    whyItMatters:
      "Full-stack engineers write the code where most real vulnerabilities live: a query built with string concatenation, a template that echoes user input, an endpoint that checks you are logged in but not that the record is yours. These are not exotic; they appear consistently in the OWASP Top 10, and reviewers expect a senior engineer to spot them in a diff without a security team in the room.",
    explanation: [
      "Separate **authentication** (who are you?) from **authorization** (are you allowed to do this to this specific thing?). Most serious bugs in product code are authorization bugs: **broken access control**, which sits at the top of the OWASP Top 10 2021 list. The classic form is an **IDOR** (insecure direct object reference): `GET /invoices?id=1043` checks that the user is logged in, then loads invoice 1043 without checking it belongs to their tenant. Changing the number reveals someone else's data. The fix is structural, not cosmetic: scope every query by the owner (`WHERE id = ? AND tenant_id = ?`), return 404 rather than 403 to avoid confirming existence, and centralise the check so a new endpoint cannot forget it. Unguessable UUIDs reduce enumeration but are not authorization.",
      "**Sessions vs tokens.** A server-side session stores state on the server and gives the browser an opaque random id in a cookie; revoking access is deleting a row, and the cookie should be `HttpOnly`, `Secure` and `SameSite=Lax` or `Strict`. A self-contained token such as a JWT carries signed claims and needs no lookup, which suits service-to-service calls and some mobile APIs, but it cannot be revoked before expiry without adding back a server-side denylist, so you pair short-lived access tokens with refresh tokens. Where the token lives matters more than its format: anything JavaScript can read (localStorage) is stolen by any XSS, while an HttpOnly cookie is not readable by script but is sent automatically, which brings CSRF into play. For a typical web app, an HttpOnly session cookie plus CSRF protection is the simpler, safer default. Always regenerate the session id at login to prevent session fixation.",
      "**Cross-site scripting (XSS)** happens when untrusted data is interpreted as code in the victim's browser: reflected (from the URL), stored (a malicious café review shown to every visitor) or DOM-based (client code writing `location.hash` into `innerHTML`). The core defence is **contextual output encoding**: encode for HTML body text, attribute values, URLs and JavaScript contexts differently. In PHP that means `htmlspecialchars($s, ENT_QUOTES, 'UTF-8')` on output, not on input. React escapes text by default, so React XSS usually comes from `dangerouslySetInnerHTML`, `href={userUrl}` with a `javascript:` URL, or server-rendered state embedded unsafely. A **Content Security Policy** that disallows inline scripts is defence in depth: it turns many XSS bugs from account takeover into a blocked script and a report.",
      "**Cross-site request forgery (CSRF)** abuses the browser automatically attaching cookies. A page the attacker controls submits a form to `/review/delete` on your site; the browser includes the victim's session cookie, and the server sees a legitimate-looking, authenticated request. Defences: a per-session (or per-request) **synchronizer token** in every state-changing form, checked on the server with a constant-time comparison; **SameSite** cookies, which stop the browser sending the cookie on most cross-site requests; and verifying the `Origin` header. SameSite is about *sites* (scheme plus registrable domain), not origins, so `localhost:9000` attacking `localhost:8000`, or a compromised sibling subdomain, is same-site and not stopped by it. That is why tokens remain the primary defence. Never change state on GET.",
      "**SQL injection** happens when input is concatenated into a query so that data becomes syntax: a search box receiving `' UNION SELECT email, password_hash FROM users --` turns a café search into a credential dump. The fix is **parameterised queries** (PDO prepared statements in PHP, `$1` placeholders with node-postgres), where the query structure is fixed before data arrives. Escaping functions are a weaker substitute. Parameters cannot be used for identifiers like column names in ORDER BY, so map user choices through an allowlist (`{ 'rating': 'avg_rating', 'distance': 'distance_m' }`). Least-privilege database users limit the damage if something slips through.",
      "Use the **OWASP Cheat Sheet Series** as your working reference: it is concrete, language-agnostic guidance for exactly these issues (XSS prevention, SQL injection prevention, CSRF prevention, authorization, session management, password storage). A good habit for code review: for every endpoint ask 'who can call this, on whose data, with what input, and what does it output where?' Those four questions find most of what this week covers.",
    ],
    examples: [
      {
        language: 'php',
        title: 'Vulnerable vs fixed: the same endpoint',
        code: `<?php
// VULNERABLE: injection, IDOR, reflected XSS in one function
function showCheckins_bad(PDO $db) {
  $userId = $_GET['user_id'];                                  // trusts the client
  $rows = $db->query("SELECT note FROM checkins WHERE user_id = $userId")->fetchAll();
  foreach ($rows as $r) echo "<li>" . $r['note'] . "</li>";    // raw output
}

// FIXED
function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function showCheckins(PDO $db) {
  $userId = $_SESSION['user_id'] ?? null;                      // identity from the session
  if ($userId === null) { http_response_code(401); return; }
  $stmt = $db->prepare('SELECT note FROM checkins WHERE user_id = ?');
  $stmt->execute([$userId]);
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) echo '<li>' . e($r['note']) . '</li>';
}`,
      },
    ],
    keyTakeaways: [
      'Authorization means checking ownership of the specific object on every request; scope queries by owner.',
      'Prefer HttpOnly, Secure, SameSite session cookies for web apps; regenerate the session id at login.',
      'Encode output for its context; React is safe by default until you bypass it.',
      'CSRF needs tokens (plus SameSite and Origin checks); SameSite alone does not cover same-site attackers.',
      'Parameterise every query; allowlist identifiers that cannot be parameters.',
      'CSP and least-privilege database users are defence in depth, not substitutes.',
    ],
    prerequisites: [
      'HTTP requests, cookies and forms',
      'PHP with PDO, or Node with a SQL client',
      'REST endpoint design',
    ],
    prerequisiteWeeks: [3, 8, 28],
    resources: [
      {
        title: 'OWASP Top 10',
        url: 'https://owasp.org/www-project-top-ten/',
        kind: 'docs',
        note: 'Read the list and the pages for Broken Access Control and Injection. Note which categories map to this week (access control, injection including XSS, authentication failures).',
        minutes: 10,
      },
      {
        title: 'OWASP Cheat Sheet Series',
        url: 'https://cheatsheetseries.owasp.org/',
        kind: 'docs',
        note: 'Use the index to open the Cross Site Scripting Prevention, SQL Injection Prevention and Cross-Site Request Forgery Prevention cheat sheets. Read the primary defences in each.',
        minutes: 15,
      },
      {
        title: 'OWASP Cheat Sheet: Authorization',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
        kind: 'docs',
        note: 'Read the recommendations on enforcing least privilege, denying by default and validating permissions on every request (IDOR).',
        minutes: 5,
        verify: true,
      },
      {
        title: 'MDN: Set-Cookie header',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie',
        kind: 'docs',
        note: 'Read the HttpOnly, Secure and SameSite attribute descriptions, including what Lax allows.',
        minutes: 5,
      },
      {
        title: 'PHP manual: PDO prepared statements',
        url: 'https://www.php.net/manual/en/pdo.prepared-statements.php',
        kind: 'docs',
        note: 'Quick refresher on placeholders and why prepared statements prevent injection.',
        minutes: 5,
      },
    ],
    exercise: {
      title: 'Break and fix a deliberately vulnerable NearBrew mini-app',
      scenario:
        "A contractor built a tiny NearBrew admin-ish web app in plain PHP with SQLite: café search, reviews, deleting your own review, and viewing your check-ins. It works, and it contains at least one each of SQL injection, reflected XSS, stored XSS, IDOR and CSRF (plus a session fixation bonus). You will exploit each one locally, fix it, and re-run the exploit to prove the fix.",
      setup: [
        'Requires PHP 8 with pdo_sqlite (check `php -m | grep -i sqlite`).',
        'mkdir vuln-nearbrew && cd vuln-nearbrew, save seed.php and app.php from the starter.',
        'php seed.php (creates nearbrew.db with users alice@example.com and bob@example.com, password `password`).',
        'php -S localhost:8000 app.php',
        'For CSRF: mkdir evil && save evil/index.html, then in another terminal `php -S localhost:9000 -t evil`.',
        'Never deploy this app or expose it beyond localhost.',
      ],
      steps: [
        "SQL injection: in the search box, enter `' UNION SELECT id, email || ':' || password_hash FROM users --`. Confirm user emails and hashes appear as 'cafés'. Fix with a prepared statement using `LIKE ?` and bind `'%' . $q . '%'`. Re-run the payload: it should now just return no cafés.",
        "Reflected XSS: search for `<img src=x onerror=alert(document.cookie)>`. Note that the 'Results for' line runs it. Add an `e()` helper using htmlspecialchars with ENT_QUOTES and UTF-8, and use it on every echo of user-controlled data.",
        "Stored XSS: log in as bob, post a review on café 1 containing `<script>alert('stored')</script>`. Log in as alice and view café 1. Fix by encoding on output (not by stripping on input) and confirm the script text is shown literally.",
        'IDOR: log in as alice and visit `/checkins?user_id=2`. You see bob\'s check-ins. Fix by ignoring the parameter and using the session user id. Then find the second IDOR: alice can delete bob\'s review via `/review/delete`. Fix with `DELETE ... WHERE id = ? AND user_id = ?` and return 404 when no row was affected.',
        "CSRF: logged in as bob, open `http://localhost:9000`. The page auto-submits a form that deletes review 1. Confirm it worked. Add a CSRF token: generate with `bin2hex(random_bytes(32))` into the session, include it as a hidden input in every POST form, and reject POSTs where `hash_equals` fails. Re-run the evil page: it should get 403.",
        'Note that localhost:9000 and localhost:8000 are the same site, so SameSite cookies would not have stopped this attack. Write that down; it is the key insight about SameSite.',
        'Session hardening: call `session_regenerate_id(true)` after successful login, and set cookie params (HttpOnly, SameSite=Lax; Secure in production) before `session_start()`.',
        "Defence in depth: send `Content-Security-Policy: default-src 'self'; script-src 'self'` and confirm, by temporarily removing one e() call, that the inline payload is now blocked and reported in the console.",
      ],
      starter: [
        {
          language: 'php',
          title: 'seed.php',
          code: `<?php
$db = new PDO('sqlite:' . __DIR__ . '/nearbrew.db');
$db->exec('DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS cafes; DROP TABLE IF EXISTS reviews; DROP TABLE IF EXISTS checkins;');
$db->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT)');
$db->exec('CREATE TABLE cafes (id INTEGER PRIMARY KEY, name TEXT)');
$db->exec('CREATE TABLE reviews (id INTEGER PRIMARY KEY, cafe_id INT, user_id INT, body TEXT)');
$db->exec('CREATE TABLE checkins (id INTEGER PRIMARY KEY, user_id INT, cafe_id INT, note TEXT)');
$hash = password_hash('password', PASSWORD_DEFAULT);
$u = $db->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
$u->execute(['alice@example.com', $hash]);
$u->execute(['bob@example.com', $hash]);
foreach (['Flat White Lab', 'Bean There', 'Ritual Roasters'] as $name) {
  $db->prepare('INSERT INTO cafes (name) VALUES (?)')->execute([$name]);
}
$db->exec("INSERT INTO reviews (cafe_id, user_id, body) VALUES (1, 2, 'Lovely cortado')");
$db->exec("INSERT INTO checkins (user_id, cafe_id, note) VALUES (1, 1, 'alice morning'), (2, 2, 'bob secret meeting')");
echo "seeded\\n";`,
        },
        {
          language: 'php',
          title: 'app.php (deliberately vulnerable: run only on localhost)',
          code: `<?php
session_start();
$db = new PDO('sqlite:' . __DIR__ . '/nearbrew.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$me = $_SESSION['user_id'] ?? null;

function page(string $body): void {
  echo '<!doctype html><meta charset="utf-8"><title>NearBrew</title>' . $body;
}

if ($path === '/login' && $method === 'POST') {
  $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE email = ?');
  $stmt->execute([$_POST['email'] ?? '']);
  $u = $stmt->fetch(PDO::FETCH_ASSOC);
  if ($u && password_verify($_POST['password'] ?? '', $u['password_hash'])) {
    $_SESSION['user_id'] = (int) $u['id'];          // BUG: no session_regenerate_id
    header('Location: /'); exit;
  }
  http_response_code(401); exit('Bad login');
}

if ($path === '/search') {
  $q = $_GET['q'] ?? '';
  $rows = $db->query("SELECT id, name FROM cafes WHERE name LIKE '%$q%'")->fetchAll();  // BUG
  $html = "<p>Results for $q</p><ul>";                                                  // BUG
  foreach ($rows as $r) $html .= '<li><a href="/cafe?id=' . $r[0] . '">' . $r[1] . '</a></li>';
  page($html . '</ul><a href="/">Home</a>'); exit;
}

if ($path === '/cafe') {
  $id = (int) ($_GET['id'] ?? 0);
  $stmt = $db->prepare('SELECT id, user_id, body FROM reviews WHERE cafe_id = ?');
  $stmt->execute([$id]);
  $html = '<h1>Cafe ' . $id . '</h1><ul>';
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $html .= '<li>#' . $r['id'] . ' ' . $r['body'] . '</li>';                         // BUG
  }
  $html .= '</ul><form method="post" action="/review"><input type="hidden" name="cafe_id" value="' . $id . '">'
         . '<textarea name="body"></textarea><button>Post review</button></form>';
  page($html); exit;
}

if ($path === '/review' && $method === 'POST' && $me) {                               // BUG: no CSRF token
  $db->prepare('INSERT INTO reviews (cafe_id, user_id, body) VALUES (?, ?, ?)')
     ->execute([(int) $_POST['cafe_id'], $me, $_POST['body'] ?? '']);
  header('Location: /cafe?id=' . (int) $_POST['cafe_id']); exit;
}

if ($path === '/review/delete' && $method === 'POST' && $me) {                        // BUG: CSRF + IDOR
  $db->prepare('DELETE FROM reviews WHERE id = ?')->execute([(int) $_POST['id']]);
  header('Location: /'); exit;
}

if ($path === '/checkins' && $me) {
  $uid = $_GET['user_id'] ?? $me;                                                      // BUG: IDOR
  $stmt = $db->prepare('SELECT note FROM checkins WHERE user_id = ?');
  $stmt->execute([$uid]);
  $html = '<ul>';
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) $html .= '<li>' . $r['note'] . '</li>';
  page($html . '</ul>'); exit;
}

page(($me ? '<p>Logged in as user ' . $me . ' · <a href="/checkins">My check-ins</a></p>' : '')
  . '<form method="post" action="/login"><input name="email"><input name="password" type="password"><button>Log in</button></form>'
  . '<form action="/search"><input name="q" placeholder="Search cafés"><button>Search</button></form>'
  . '<p><a href="/cafe?id=1">Cafe 1 reviews</a></p>');`,
        },
        {
          language: 'html',
          title: 'evil/index.html (served from localhost:9000)',
          code: `<!doctype html>
<meta charset="utf-8">
<h1>Win a free coffee!</h1>
<form id="f" method="post" action="http://localhost:8000/review/delete">
  <input type="hidden" name="id" value="1">
</form>
<script>document.getElementById('f').submit();</script>`,
        },
      ],
      expected: [
        'Before fixes: the UNION payload lists user emails and password hashes; both XSS payloads fire alerts; alice reads bob\'s check-ins and deletes his review; the evil page deletes a review.',
        'After fixes: the UNION payload returns zero cafés; XSS payloads appear as literal text; `/checkins?user_id=2` shows only alice\'s own check-ins; deleting someone else\'s review returns 404; the evil page receives 403.',
        'After login, the session cookie value changes (session regenerated).',
        'With CSP enabled and one encoding call removed, the browser console reports a blocked inline script.',
      ],
      hints: [
        'In SQLite, `||` concatenates strings; the UNION must select the same number of columns (two) as the original query.',
        'Encode at output time, as late as possible, for the specific context. Storing encoded HTML in the database leads to double-encoding and bugs in non-HTML outputs such as JSON APIs.',
        'For the CSRF token, also add it to the review form on the café page, or your own legitimate posts will be rejected.',
        'Use `$stmt->rowCount()` after the scoped DELETE to decide between redirect and 404.',
      ],
      verification: [
        'Keep a table of each vulnerability: payload used, observed impact, fix applied, payload re-run result.',
        'Grep app.php for `echo`, `page(` and `->query(` and confirm every user-controlled value is encoded or parameterised.',
        'Confirm every POST handler checks both the CSRF token and object ownership where relevant.',
      ],
    },
    successChecklist: [
      'Exploited and fixed SQL injection with a prepared statement',
      'Exploited and fixed reflected and stored XSS with contextual output encoding',
      'Exploited and fixed two IDORs by scoping queries to the session user',
      'Exploited and fixed CSRF with a synchronizer token and hash_equals',
      'Regenerated the session id at login and set cookie flags',
      'Added a CSP and observed it blocking an inline payload',
      'Can explain why SameSite did not stop the localhost:9000 attack',
    ],
    questions: [
      {
        question: 'Your React SPA stores a JWT in localStorage and sends it in an Authorization header. A teammate says "we are immune to CSRF, so we are secure." Evaluate that.',
        answer:
          "They are mostly right about CSRF: browsers do not automatically attach localStorage values to cross-site requests, so a forged form cannot carry the token. But the trade-off is XSS exposure: any script that runs on the page, from an XSS bug or a compromised third-party script, can read localStorage and exfiltrate the token, which works from anywhere until it expires. An HttpOnly cookie cannot be read by script, so XSS can still act as the user while they have the page open but cannot steal a long-lived credential. Also, JWTs are hard to revoke, so a stolen one stays valid. A reasonable answer is an HttpOnly, Secure, SameSite session or short-lived token cookie with CSRF tokens, plus a strict CSP, rather than declaring victory on CSRF alone.",
      },
      {
        question: "Why is 'use UUIDs instead of incrementing ids' not a fix for IDOR?",
        answer:
          "UUIDs make ids hard to guess, which slows down enumeration, but they are still references that leak: in URLs, logs, shared links, browser history, referrer headers and API responses that list related objects. Once an attacker has a valid id from any of those sources, an endpoint without an ownership check will happily return or modify the object. IDOR is a missing authorization check, so the fix is to verify on every request that the authenticated principal may access that specific object, typically by scoping the query to the user or tenant. UUIDs are a fine additional layer, but security must not depend on secrecy of ids.",
      },
      {
        question: 'A sort parameter is used as `ORDER BY $sort` in a query. Prepared statements do not help. What do you do?',
        answer:
          "Placeholders bind values, not identifiers or keywords, so you cannot parameterise a column name or ASC/DESC. Instead, map the user's choice through a fixed allowlist, for example `{ rating: 'avg_rating', distance: 'distance_m', newest: 'created_at' }`, default to a safe value when the input is not in the map, and do the same for direction with only 'ASC' or 'DESC' allowed. The user's raw string never reaches the SQL. This also gives you a natural place to make sure each sortable column is indexed. Some query builders provide identifier quoting, but an allowlist is clearer and safer.",
      },
    ],
    explainPrompt:
      'Explain to a mid-level teammate in a code review why their new endpoint `POST /tenants/:tenantId/invoices/:id/void` needs more than a logged-in check, and walk through the IDOR, CSRF and injection questions you would ask about it.',
    rubric: [
      'Distinguishes authentication from authorization with the specific endpoint',
      'Proposes an ownership-scoped query and 404 behaviour',
      'Explains CSRF risk for cookie-authenticated POSTs and the token defence',
      'Checks for parameterised queries and output encoding where relevant',
      'Tone is constructive and gives a concrete fix, not just a warning',
    ],
    referenceExplanation:
      "The endpoint checks that someone is logged in, but it never checks that this user is allowed to void this invoice. Right now, a user of tenant 12 can call /tenants/34/invoices/1043/void and, as long as they're authenticated, invoice 1043 gets voided. That's an IDOR, which is a broken access control bug, and it's the most common serious bug class in apps like ours. The fix is to take the tenant from the session, not trust the URL alone, and scope the update: UPDATE invoices SET status = 'void' WHERE id = ? AND tenant_id = ? AND status = 'open'. If no row is affected, return 404, so we don't reveal that the invoice exists. I'd also check the user's role, since voiding is probably admin-only, and put both checks in our shared policy helper so the next endpoint can't forget them. Second, CSRF. We authenticate with a session cookie, so the browser will attach it to a POST from any page the user visits, including a malicious one. Please make sure this route goes through the CSRF middleware and that the frontend sends the token. SameSite helps, but it doesn't cover same-site attackers, so it's not enough on its own. Third, injection. I can see the id comes in as a route parameter; let's make sure it's bound as a placeholder, not interpolated, and that the void reason is encoded wherever we render it in the audit log UI. Finally, let's add a test where a user from another tenant gets a 404.",
    stretch: {
      title: 'Port the fixed app to Node and compare',
      description:
        'Rebuild the fixed app in Node using node:http (or Express) with better-sqlite3 or node-postgres, a CSRF token middleware, and HTML escaping. Then write a short note on which defences the framework gave you for free and which you still had to remember, and add one automated test per vulnerability that fails against the vulnerable version.',
    },
    lightTask:
      'Run the vulnerable app, exploit only the SQL injection and the check-ins IDOR, and fix both (prepared statement with LIKE ?, and using the session user id). Re-run each exploit to confirm it fails and write one sentence per bug describing the root cause.',
    intensiveExtras: [
      'Add a login rate limiter (week 38) and a generic error message so the login form does not reveal which emails exist.',
      'Write a short threat model for NearBrew photo uploads: file type checks, size limits, storage outside the web root, and serving with the correct Content-Type.',
      'Audit one real endpoint from your own work against the four review questions (who, whose data, what input, what output) and record findings privately.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['backend-services', 'api-design', 'feature-ownership'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 44 — Frontend system design II: media browsing home screen
  // ---------------------------------------------------------------------------
  {
    week: 44,
    slug: 'frontend-system-design-media-rows',
    title: 'Frontend system design II: a media browsing home screen with rows of content',
    track: 'interview',
    secondaryTracks: ['frontend', 'system-design'],
    topics: [
      'frontend system design',
      'row-based layouts',
      'normalised client data model',
      'per-row cursor pagination',
      'image loading and aspect-ratio boxes',
      'prefetching',
      '2D virtualisation',
      'focus memory and spatial navigation',
      'performance budgets',
      'per-row error states',
    ],
    objective:
      'By the end you can whiteboard a complete, defensible design for a home screen of horizontally scrolling content rows that works with mouse, keyboard and TV remote, and implement its focus-navigation core as a tested pure function.',
    whyItMatters:
      "Rows of artwork tiles are the dominant layout for consumer media and catalogue apps on web, mobile and TV. Designing one well touches almost every frontend skill at once: data modelling, API shape, rendering performance, memory on weak devices, input handling and resilience. It is a natural frontend system design prompt precisely because there is no single right answer, only trade-offs you can explain.",
    explanation: [
      "Start an answer the way you would a backend design: **clarify requirements and constraints** before drawing boxes. Which platforms (desktop web, mobile web, TV), and the weakest target device? How many rows (say 20–40) and items per row (say up to 75)? Is the order personalised per user? Is input pointer, touch, keyboard, remote D-pad, or all of them? What are the targets: time until the first row is usable, smooth scrolling, memory ceiling? Write down 3–5 non-functional requirements explicitly; they drive every later decision and show the interviewer you design for constraints, not for a generic laptop.",
      "**Data model and API.** Separate the *layout* from the *entities*. The home response is a list of row descriptors: `{ rowId, title, kind, itemIds or first page of items, nextCursor }`. Items (titles, cafés, products) live in a **normalised cache keyed by id**, because the same item often appears in several rows and an update such as 'added to my list' should change it everywhere. Load the page **vertically in pages of rows** (first 6–8 rows with their first page of items in the initial response), and **horizontally per row with its own cursor** when the user scrolls or focuses near the end of that row. Cursor pagination (week 3) suits personalised, changing lists better than offsets. Keep artwork URLs, aspect ratio and a placeholder colour in each item so layout never waits on images.",
      "**Images dominate bytes and memory.** Reserve space with a fixed aspect ratio (`aspect-ratio` CSS or width/height attributes) so loading never shifts layout. Ask the image service for the right size for the tile (`srcset`/`sizes`, or explicit width parameters), never full-resolution artwork. Load images for visible tiles first, mark the first row's first few images as high priority, and lazy-load the rest with the `loading` attribute or an IntersectionObserver with a generous root margin so images arrive just before they scroll in. Show a dominant-colour or blurred placeholder. On constrained devices, decoded images are the real memory cost, roughly width times height times 4 bytes each, so a 400x225 tile is about 360 KB decoded regardless of its compressed size; that is why off-screen images must be released.",
      "**Virtualisation** keeps DOM and memory bounded. 30 rows times 50 tiles is 1,500 tiles, each with an image, which is too much for weak devices. Virtualise in two dimensions: only rows within one or two screen-heights of the viewport are mounted, and within each mounted row only tiles within a window around the visible range (plus a small overscan). Keep each row's horizontal scroll position and each tile's size fixed or known, so the virtualiser can compute positions without measuring. The catch is focus: if the focused tile is unmounted, focus falls to `body`, so either never unmount the focused tile or track focus in your own state and restore it on remount.",
      "**Input and focus.** With a mouse, rows scroll on hover arrows or drag; with a keyboard or remote, arrow keys move focus. Spatial navigation (week 31) for a row layout is simpler than a free-form grid: left/right moves within a row, up/down moves between rows, and each row should **remember its last focused column** so going down and back up returns you where you were, not to column 0. Moving down to a shorter row clamps to its last item. Keep focus state in a model (row index, per-row column) rather than reading it from the DOM, so virtualisation, data refreshes and back navigation can restore it. For accessibility, expose rows as labelled groups or lists, use roving tabindex so Tab moves between rows rather than through 1,500 tiles, and keep focus visibly obvious, since on a TV the focus ring is the only cursor.",
      "**Prefetching, budgets and failure.** Prefetch the next horizontal page when focus is within a few items of the end of the loaded range, the next vertical page of rows when the user nears the bottom, and detail-page data when a tile has been focused or hovered for a short dwell time. Do this with low priority and cancellation, so prefetches never compete with what is on screen. Set explicit **performance budgets**, for example a JS bundle limit for the home route, a maximum time to first interactive row on the reference device, under about 100 ms from keypress to visible focus change, and a cap on mounted tiles. Treat these as team numbers to measure against, not universal truths. Finally, **error states per row**: a failed row page shows an inline retry tile or the row is hidden if it is non-essential, a failed image shows the placeholder plus title text, and the home response itself can fall back to cached rows (week 42).",
    ],
    examples: [
      {
        language: 'ts',
        title: 'Client data model for a row-based home screen',
        code: `type ItemId = string;
type RowId = string;

interface Item {
  id: ItemId;
  title: string;
  artwork: { url: string; aspect: '16:9' | '2:3'; placeholderColor: string };
}

interface Row {
  id: RowId;
  title: string;                 // e.g. 'Cafés near you', 'Because you liked Ritual Roasters'
  itemIds: ItemId[];             // loaded so far, in order
  nextCursor: string | null;     // null = end of row
  status: 'idle' | 'loading-more' | 'error';
}

interface HomeState {
  rowOrder: RowId[];
  rows: Record<RowId, Row>;
  items: Record<ItemId, Item>;   // normalised: one copy per item across all rows
  nextRowsCursor: string | null; // vertical pagination of rows
  focus: { row: number; colByRow: Record<RowId, number> }; // remembered column per row
}`,
      },
    ],
    keyTakeaways: [
      'Clarify devices, scale, input methods and budgets before designing.',
      'Model layout (row descriptors) separately from a normalised item cache.',
      'Paginate rows vertically and each row horizontally with its own cursor.',
      'Reserve image space, request tile-sized images, prioritise the first visible images, and release off-screen ones.',
      'Virtualise in two dimensions but never lose the focused element.',
      'Keep focus as state with a remembered column per row; set and measure explicit budgets; fail per row.',
    ],
    prerequisites: [
      'Frontend system design basics (feed/catalogue UI)',
      'Virtualisation and code-splitting in React',
      'TV / spatial navigation and focus management',
      'Accessibility fundamentals for keyboard users',
    ],
    prerequisiteWeeks: [18, 24, 30, 31],
    resources: [
      {
        title: 'MDN: Intersection Observer API',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API',
        kind: 'docs',
        note: 'Read the concepts section, especially rootMargin and thresholds, which you will use for lazy images and near-end-of-row prefetching.',
        minutes: 8,
      },
      {
        title: 'MDN: The Image Embed element (img)',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img',
        kind: 'docs',
        note: 'Read the loading, decoding, fetchpriority, srcset and sizes attributes, and the note on width/height for preventing layout shift.',
        minutes: 8,
      },
      {
        title: 'web.dev: Browser-level image lazy loading',
        url: 'https://web.dev/articles/browser-level-image-lazy-loading',
        kind: 'article',
        note: 'Read the sections on distance-from-viewport thresholds and why you should not lazy-load images in the initial viewport.',
        minutes: 6,
        verify: true,
      },
      {
        title: 'WAI-ARIA Authoring Practices Guide',
        url: 'https://www.w3.org/WAI/ARIA/apg/',
        kind: 'docs',
        note: "Find the 'Developing a Keyboard Interface' practice and read the roving tabindex section; that is the keyboard model for rows of tiles.",
        minutes: 8,
      },
    ],
    exercise: {
      title: 'Design a home screen of rows, then implement its focus model',
      scenario:
        "Imagine NearBrew grows a 'Discover' tab (also shipped to a TV-style kiosk in partner cafés) with 25 rows such as 'Open now near you', 'Top rated flat whites' and 'New this week', each with up to 60 café tiles with photos. The kiosk is a low-power device driven by arrow keys only. You will produce a one-page design under interview-style time pressure, then implement and test the pure focus-navigation reducer that the design depends on.",
      setup: [
        'Paper or a whiteboard tool for part one.',
        'Node 20+ for part two: mkdir rows-focus && cd rows-focus, save focus.mjs and focus.test.mjs from the starter.',
        'Run tests with `node --test`.',
      ],
      steps: [
        'Timebox 5 minutes: write requirements and constraints (devices, scale, input, 3–5 budgets you choose and justify).',
        'Timebox 10 minutes: draw the component tree (HomeScreen, RowList virtualiser, Row, Tile, FocusManager) and the client state shape. Use the worked example as a reference but write your own.',
        'Timebox 5 minutes: specify the API: home endpoint (first N rows with first page of items), row-page endpoint with cursor, and what each item includes for layout without waiting on images.',
        "Timebox 10 minutes: describe image loading, prefetching (what triggers each prefetch, priority, cancellation) and virtualisation (windows, overscan, focused-tile rule). Calculate the decoded image memory for 3 visible rows x 7 tiles at 320x180, and for everything if nothing were virtualised (25 x 60 tiles).",
        'Timebox 5 minutes: list error states: home call fails, one row page fails, image fails, empty row. Write what the user sees for each.',
        'Part two (25 minutes): implement `moveFocus(state, key, rowLengths)` in focus.mjs so all tests pass: left/right within a row with clamping, up/down between rows restoring the destination row\'s remembered column (clamped if that row now has fewer items), and no movement past edges.',
        'Add a test of your own: when the row the user moves to has zero items (still loading), focus should skip it and land on the next non-empty row. Implement it.',
        'Write a 5-line note: how the virtualiser uses this focus state to keep the focused tile mounted and to restore focus after returning from a detail page.',
      ],
      starter: [
        {
          language: 'js',
          title: 'focus.mjs',
          code: `// state: { row: number, colByRow: number[] }
// key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
// rowLengths: number[]  (items loaded in each row)
// Returns a NEW state; never mutates the input.
export function moveFocus(state, key, rowLengths) {
  const { row, colByRow } = state;
  // TODO: implement
  return { row, colByRow: [...colByRow] };
}

export function initialFocus(rowCount) {
  return { row: 0, colByRow: Array(rowCount).fill(0) };
}`,
        },
        {
          language: 'js',
          title: 'focus.test.mjs',
          code: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveFocus, initialFocus } from './focus.mjs';

const lengths = [10, 3, 8];

test('right moves within the row and stops at the end', () => {
  let s = initialFocus(3);
  for (let i = 0; i < 15; i++) s = moveFocus(s, 'ArrowRight', lengths);
  assert.equal(s.row, 0);
  assert.equal(s.colByRow[0], 9);
});

test('left at column 0 does nothing', () => {
  const s = moveFocus(initialFocus(3), 'ArrowLeft', lengths);
  assert.deepEqual(s, initialFocus(3));
});

test('up and down restore the remembered column of the destination row', () => {
  let s = initialFocus(3);
  for (let i = 0; i < 6; i++) s = moveFocus(s, 'ArrowRight', lengths); // row 0, col 6
  s = moveFocus(s, 'ArrowDown', lengths);                               // row 1, never visited
  assert.equal(s.row, 1);
  assert.equal(s.colByRow[1], 0);
  s = moveFocus(s, 'ArrowRight', lengths);
  s = moveFocus(s, 'ArrowRight', lengths);                              // row 1, col 2
  s = moveFocus(s, 'ArrowUp', lengths);
  assert.equal(s.row, 0);
  assert.equal(s.colByRow[0], 6);
  s = moveFocus(s, 'ArrowDown', lengths);
  assert.equal(s.colByRow[1], 2);
});

test('clamps a remembered column when the row now has fewer items', () => {
  let s = { row: 0, colByRow: [0, 7, 0] };    // row 1 remembered col 7, but holds 3 items now
  s = moveFocus(s, 'ArrowDown', lengths);
  assert.equal(s.row, 1);
  assert.equal(s.colByRow[1], 2);
});

test('each row remembers its own column', () => {
  let s = initialFocus(3);
  s = moveFocus(s, 'ArrowDown', lengths);
  s = moveFocus(s, 'ArrowDown', lengths);                               // row 2
  for (let i = 0; i < 4; i++) s = moveFocus(s, 'ArrowRight', lengths);  // row 2, col 4
  s = moveFocus(s, 'ArrowUp', lengths);
  s = moveFocus(s, 'ArrowUp', lengths);
  s = moveFocus(s, 'ArrowDown', lengths);
  s = moveFocus(s, 'ArrowDown', lengths);
  assert.equal(s.row, 2);
  assert.equal(s.colByRow[2], 4);
});

test('does not mutate the input state', () => {
  const s = initialFocus(3);
  const frozen = structuredClone(s);
  moveFocus(s, 'ArrowRight', lengths);
  assert.deepEqual(s, frozen);
});`,
        },
      ],
      expected: [
        'A one-page design covering requirements, component tree, state, API, images, prefetch, virtualisation, focus, budgets and error states.',
        'A memory calculation showing why virtualisation matters: 21 visible tiles at 320x180 is about 4.8 MB decoded, while 1,500 tiles would be about 345 MB.',
        'All provided tests pass with `node --test`, plus your empty-row test.',
        'A short written explanation of how focus state and virtualisation interact.',
      ],
      hints: [
        'Clamp with `Math.min(remembered, length - 1)` when moving into a row. Many TV UIs instead use the source column on the first visit to a row; that is a valid alternative, but the provided tests use per-row memory, so document the choice.',
        'Treat ArrowDown on the last row and ArrowUp on the first row as no-ops; a real app might move focus to a navigation bar instead.',
        'For the prefetch trigger, a rule like "focused column >= loaded length - 5 and nextCursor not null and not already loading" is easy to test.',
        "Don't forget the vertical pagination of rows themselves when the user nears the last loaded row.",
      ],
      verification: [
        'Explain your design aloud in under 10 minutes using only the one-pager.',
        '`node --test` reports all tests passing.',
        'Every budget you set has a stated way to measure it (profiler, lab test on a reference device, bundle analyser, RUM metric).',
      ],
    },
    successChecklist: [
      'Stated requirements, constraints and explicit budgets before designing',
      'Separated row layout from a normalised item cache with per-row cursors',
      'Specified image sizing, priority, lazy loading and placeholder strategy',
      'Designed 2D virtualisation that never unmounts the focused tile',
      'Implemented a tested focus reducer with remembered column per row',
      'Defined user-visible error states for home, row, image and empty cases',
    ],
    questions: [
      {
        question: 'Why normalise items into a cache keyed by id instead of storing full item objects inside each row?',
        answer:
          "The same item frequently appears in multiple rows (a café in both 'Open now' and 'Top rated'), so storing copies means an update, such as toggling a favourite or fixing a title, must find and patch every copy or the UI shows inconsistent state. A normalised cache makes each item a single source of truth and rows become ordered lists of ids. It also reduces memory and makes it cheap to merge new pages: you upsert items and append ids. The cost is an indirection on read, which is negligible, and the need to garbage-collect items no row references any more on long sessions.",
      },
      {
        question: 'Your virtualised row unmounts tiles that scroll out of view. A keyboard user presses Back from a detail page and focus ends up on the page body. What went wrong and how do you fix it?',
        answer:
          "Focus lived only in the DOM: when the detail page replaced the home screen, or when virtualisation unmounted the tile, the focused element disappeared and the browser moved focus to body. On return, nothing restored it. The fix is to keep focus as application state (row index plus per-row column), preserve it across navigation, and on mount have the virtualiser ensure the focused row and column are inside the rendered window, scroll them into view, then call focus on that element. While browsing, the virtualiser should always include the focused tile in its window even if it is just outside the overscan. Test this explicitly, because it fails silently for mouse users.",
      },
      {
        question: 'An interviewer asks for your performance budget for the home screen on a low-end TV-class device. How do you answer without making up universal numbers?',
        answer:
          "Explain that budgets are team decisions anchored to a reference device and user expectations, then propose concrete starting values and how you would validate them. For example: the first row interactive within a few seconds of launch on the reference device, focus visibly moving within about 100 ms of a key press, a JavaScript budget for the home route enforced in CI, a cap on mounted tiles and decoded image memory, and no long tasks during focus movement. Say how each is measured: lab runs on the actual device, a bundle-size check, in-app timing marks reported as real-user metrics. Being explicit that these are proposals to calibrate against measurements is more credible than quoting a number as if it were a standard.",
      },
    ],
    explainPrompt:
      "You are in a frontend system design interview and have been asked: 'Design the home screen of a media browsing app with rows of content that must work on web and on a TV with a remote.' Explain your design out loud, in order, as you would to the interviewer.",
    rubric: [
      'Opens with clarifying requirements, constraints and budgets',
      'Describes data model and API with per-row pagination',
      'Covers images, virtualisation and memory with at least one concrete number',
      'Explains input and focus model including remembered column and focus restoration',
      'Addresses prefetching and per-row error states',
      'Names trade-offs rather than presenting one true answer',
    ],
    referenceExplanation:
      "I'd first pin down constraints: web plus a low-power TV, around 25 rows with up to 60 tiles each, personalised ordering, and remote-only input on TV. I'd propose budgets: first row interactive within a few seconds on the reference TV, under 100 ms from key press to visible focus move, a cap on mounted tiles, and a JS budget for the home route. For data, the home endpoint returns the first six to eight row descriptors, each with its first page of items and a cursor. Items go into a normalised cache by id, because the same title appears in several rows; rows hold ordered id lists. More rows load vertically by cursor, and each row loads more horizontally with its own cursor. Each item carries artwork URL, aspect ratio and a placeholder colour, so layout never waits on images. For images, tiles have a fixed aspect ratio so nothing shifts. I'd request tile-sized images, give the first row's visible images high priority, and lazy-load the rest with an IntersectionObserver margin. Decoded images cost about width times height times four bytes, so 1,500 tiles at 320 by 180 would be over 300 MB, which is why I virtualise both directions: only nearby rows are mounted, and only a window of tiles within each, and the focused tile is never unmounted. Focus is state, not DOM: a current row plus a remembered column per row, so up and down return you where you were, with clamping for shorter rows, and it's restored after Back. I'd prefetch the next page when focus is within five tiles of the end. Failed rows show a retry tile or hide, and failed images show the placeholder plus the title.",
    stretch: {
      title: 'Build a minimal virtualised row in React',
      description:
        'In a Vite React app, render 25 rows x 60 tiles with your focus reducer driving arrow-key navigation, a horizontal window of visible tiles plus overscan per row, and vertical windowing of rows. Use the Performance panel to compare DOM node count and memory with and without virtualisation, and verify focus survives scrolling far away and back.',
    },
    lightTask:
      'Implement moveFocus in focus.mjs until the provided tests pass, then write five bullet points on paper (as notes, not code) describing the API shape, per-row pagination, image strategy, virtualisation and one error state for the rows home screen.',
    intensiveExtras: [
      'Write the prefetch trigger as a pure function with tests: given focus, loaded lengths, cursors and in-flight requests, return which row pages to fetch.',
      'Do a second 35-minute timed design of the same screen for mobile touch only and list what changes (gestures, image sizes, no focus model, scroll snapping).',
      'Record yourself explaining the design and check it against the rubric, noting where you rambled or skipped trade-offs.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['consumer-ui', 'rendering-performance', 'system-design', 'accessibility'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 45 — Maintainability (A Philosophy of Software Design)
  // ---------------------------------------------------------------------------
  {
    week: 45,
    slug: 'deep-modules-information-hiding',
    title: 'Maintainability: complexity, deep modules, information hiding',
    track: 'senior',
    secondaryTracks: ['cs'],
    topics: [
      'complexity',
      'change amplification',
      'cognitive load',
      'unknown unknowns',
      'deep vs shallow modules',
      'information hiding and leakage',
      'define errors out of existence',
      'strategic vs tactical programming',
    ],
    objective:
      'By the end you can recognise shallow modules and information leakage in real code, refactor a cluster of shallow functions into one deep module with a smaller interface, and justify the change using precise vocabulary rather than taste.',
    whyItMatters:
      "Most of a senior engineer's influence on a codebase is not clever algorithms but whether the next ten features are easy or painful. Code review arguments about 'clean code' often stall because they are about taste. John Ousterhout's vocabulary gives you a sharper test: does this change reduce the amount a future developer must know and change? That is a judgment you can explain, defend and teach.",
    explanation: [
      "Ousterhout defines **complexity** as anything about a system's structure that makes it hard to understand and modify. It shows up as three symptoms. **Change amplification**: a simple change requires edits in many places (changing how opening hours handle holidays means touching six files). **Cognitive load**: how much a developer must hold in their head to make a change safely (remember to call `validateRow` before `isWithin`, and convert timezone first). **Unknown unknowns**: it is not obvious what you need to know at all, which is the worst, because nothing tells you that you missed something. Complexity comes from **dependencies** (code that cannot be understood or changed in isolation) and **obscurity** (important information that is not obvious). It accumulates in small increments, which is why 'it's only one more special case' is how codebases rot.",
      "A module (a class, a function, a service, an API) has an **interface** (what callers must know) and an **implementation** (what it does). A **deep module** offers powerful functionality behind a simple interface; Ousterhout's favourite example is Unix file I/O, where five or so calls hide disks, caching, permissions and file systems. A **shallow module** has an interface nearly as complex as what it does: a class that wraps a Map with `get` and `set`, or a function that only renames another. Shallow modules do not remove complexity; they move it to every caller, and each adds an interface to learn. This challenges the instinct, common in JS and PHP codebases, that more, smaller functions and classes are always better. 'Classitis', in his terms, is the disease of many tiny classes that each do almost nothing.",
      "**Information hiding** is the main tool for making modules deep: each module should encapsulate design decisions (a data format, an algorithm, a timezone rule) so that only it needs to change when the decision changes. **Information leakage** is when one decision is reflected in several modules, for example both the search filter and the café card know that hours are stored as `'HH:MM'` strings and must be parsed and validated in a specific order. A common cause is **temporal decomposition**: structuring code by the order things happen (parse, then validate, then convert, then check) rather than by the knowledge each piece encapsulates. The result is a pipeline of shallow steps whose ordering every caller must reproduce.",
      "**Define errors out of existence.** Exceptions and error codes are part of a module's interface, and every one you throw becomes work for every caller. Often you can redefine the operation's semantics so the error cannot happen. Ousterhout's examples include deleting a file that does not exist and Java's `substring` being stricter than it needs to be. Applied to product code: 'remove from favourites' should be idempotent (ensure the café is not a favourite) rather than throwing NOT_FOUND; opening hours where close is earlier than open should mean 'crosses midnight', not throw CLOSE_BEFORE_OPEN. Related techniques are masking errors at a low level (retry inside the module) and aggregating many error cases into one handler. This is not swallowing real failures: corrupted input should still surface; you only remove errors that exist because the interface was defined too narrowly.",
      "Two more ideas tie it together. **Pull complexity downwards**: when complexity is unavoidable, it is better for the module's implementer to suffer it once than for every caller to suffer it, so a slightly more complex implementation with a simpler interface is usually the right trade. And **strategic vs tactical programming**: tactical programming optimises for getting the current feature working; strategic programming invests a little time in each change (Ousterhout suggests something like 10–20%) to improve the design. A practical code review question that captures all of this: after this change, how much does the next person need to know, and how many places would they need to edit, to change this behaviour?",
    ],
    examples: [
      {
        language: 'ts',
        title: 'Shallow interface vs deep interface for the same capability',
        code: `// Shallow: callers must know the storage format, validation rules,
// timezone conversion and the order to call things in.
//   const rows = store.get(cafe.id);
//   rows.forEach(validateRow);
//   const { day, minutes } = toLocalParts(now, cafe.timezone);
//   const open = rows.filter(r => r.day === day).some(r => isWithin(r, minutes));

// Deep: one concept, one small interface, all decisions hidden.
interface OpeningHours {
  isOpenAt(instant: Date): boolean;
  status(instant: Date): { open: boolean; label: string }; // 'Open until 18:00', 'Opens 07:30'
}
declare function openingHoursFor(cafe: { id: string; timezone: string }): OpeningHours;

// Define errors out of existence: idempotent by definition.
// removeFavourite(userId, cafeId) means 'ensure it is not a favourite'.
// It never throws NOT_FOUND, so no caller needs a try/catch for it.`,
      },
    ],
    keyTakeaways: [
      'Complexity shows up as change amplification, cognitive load and unknown unknowns.',
      'Judge modules by depth: functionality provided relative to interface size.',
      'Hide design decisions inside one module; leakage means several modules share one decision.',
      'Temporal decomposition produces shallow pipelines; decompose by knowledge instead.',
      'Redefine operations so common errors cannot happen, but keep real failures visible.',
      'Pull complexity downwards and invest a little in design with every change.',
    ],
    prerequisites: [
      'Layering and dependency injection in a backend codebase',
      'Writing trade-off arguments and ADRs',
      'Reviewing code as a senior engineer',
    ],
    prerequisiteWeeks: [20, 28, 33],
    resources: [
      {
        title: 'A Philosophy of Software Design (John Ousterhout)',
        url: 'https://web.stanford.edu/~ouster/cgi-bin/book.php',
        kind: 'book',
        note: "Read the chapters titled 'The Nature of Complexity', 'Modules Should Be Deep', 'Information Hiding (and Leakage)' and 'Define Errors Out of Existence'. If short on time, read the deep modules chapter first. Check the edition you have; the second edition added material.",
        minutes: 30,
        verify: true,
      },
      {
        title: 'Martin Fowler: Refactoring (book page)',
        url: 'https://martinfowler.com/books/refactoring.html',
        kind: 'book',
        note: 'Optional contrast: Fowler favours small functions more than Ousterhout does. Skim the page to see the catalogue of refactorings and think about where the two views disagree.',
        minutes: 5,
        verify: true,
      },
      {
        title: 'MDN: Intl.DateTimeFormat formatToParts',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts',
        kind: 'docs',
        note: 'Reference for the timezone conversion used inside the exercise code; you will hide it inside the deep module.',
        minutes: 5,
      },
    ],
    exercise: {
      title: 'Refactor NearBrew opening-hours code from shallow pieces into a deep module',
      scenario:
        "NearBrew's opening-hours logic grew tactically: a store wrapper, a time parser, a validator, a timezone helper and a range check, all exported, with two callers (the café card badge and the 'open now' search filter) that each reproduce the steps in order. A late-night café opening 18:00–02:00 breaks both, because the validator throws CLOSE_BEFORE_OPEN, and the card and filter handle that error differently. You will measure the shallowness, then replace it with one deep module and delete the errors that should not exist.",
      setup: [
        'Node 20+. mkdir hours-refactor && cd hours-refactor and save the three starter files.',
        'Run `node --test` and confirm the tests currently fail for the overnight café.',
      ],
      steps: [
        'Read the starter and list, for each caller, every fact it must know to be correct (storage format, validation order, timezone step, day filtering, error handling). Count them. This is cognitive load made visible.',
        'Identify the leaked decisions: which facts appear in both callers? Write them down as "decisions that should live in one place."',
        'Write the new interface first, before any implementation: `createOpeningHours(rows, timezone)` returning `{ isOpenAt(date), status(date) }`. Keep it to two methods. Write a one-line comment for each describing behaviour, including overnight ranges.',
        "Implement it in hours.mjs. Define CLOSE_BEFORE_OPEN out of existence: a row whose close is at or before open means it crosses midnight, so at 01:00 on Saturday, Friday's 18:00–02:00 row applies. Malformed time strings are real errors: decide whether to throw once at construction or ignore the bad row and log, and document why.",
        'Rewrite both callers to use only the new interface. Each should shrink to a few lines and contain no knowledge of formats or timezones.',
        "Make `removeFavourite` idempotent: it should succeed whether or not the café was a favourite, and delete the try/catch in the caller.",
        'Run `node --test` until all tests pass, including the overnight cases and the idempotent favourite test. Delete the old shallow module file entirely.',
        'Write a 6-line commit message explaining the refactor in terms of change amplification, cognitive load, information hiding and errors defined out of existence.',
      ],
      starter: [
        {
          language: 'js',
          title: 'hours-shallow.mjs (the existing shallow modules)',
          code: `export class HoursStore {
  constructor() { this.rows = new Map(); }
  get(cafeId) { return this.rows.get(cafeId); }
  set(cafeId, rows) { this.rows.set(cafeId, rows); }
}

// "07:30" -> 450
export function parseTime(s) {
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error('BAD_TIME');
  return h * 60 + m;
}

// row: { day: 0-6 (Sun-Sat), open: 'HH:MM', close: 'HH:MM' }
export function validateRow(row) {
  if (row.day < 0 || row.day > 6) throw new Error('BAD_DAY');
  if (parseTime(row.close) <= parseTime(row.open)) throw new Error('CLOSE_BEFORE_OPEN');
}

export function toLocalParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function isWithin(row, minutes) {
  return minutes >= parseTime(row.open) && minutes < parseTime(row.close);
}

export function removeFavourite(favs, cafeId) {
  if (!favs.has(cafeId)) throw new Error('NOT_FOUND');
  favs.delete(cafeId);
}`,
        },
        {
          language: 'js',
          title: 'callers.mjs (two callers reproducing the same steps)',
          code: `import { validateRow, toLocalParts, isWithin, removeFavourite } from './hours-shallow.mjs';

export function cafeCardBadge(store, cafe, now) {
  const rows = store.get(cafe.id);
  if (!rows) return 'Hours unknown';
  try { rows.forEach(validateRow); } catch (e) { return 'Hours unavailable'; }
  const { day, minutes } = toLocalParts(now, cafe.timezone);
  return rows.filter((r) => r.day === day).some((r) => isWithin(r, minutes)) ? 'Open' : 'Closed';
}

export function searchFilterOpenNow(store, cafes, now) {
  return cafes.filter((c) => {
    const rows = store.get(c.id) || [];
    try { rows.forEach(validateRow); } catch { return false; }  // silently hides late-night cafés
    const { day, minutes } = toLocalParts(now, c.timezone);
    return rows.filter((r) => r.day === day).some((r) => isWithin(r, minutes));
  });
}

export function unfavourite(favs, cafeId) {
  try { removeFavourite(favs, cafeId); } catch (e) { if (e.message !== 'NOT_FOUND') throw e; }
}`,
        },
        {
          language: 'js',
          title: 'hours.test.mjs (target behaviour for your deep module)',
          code: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningHours, removeFavourite } from './hours.mjs';

const TZ = 'Europe/London';
const dayCafe = createOpeningHours([{ day: 5, open: '07:30', close: '17:00' }], TZ);   // Fri
const lateBar = createOpeningHours([{ day: 5, open: '18:00', close: '02:00' }], TZ);   // Fri night

// 2026-10-16 is a Friday; BST (UTC+1) applies on these dates.
test('day cafe open at Fri 09:00 local', () => {
  assert.equal(dayCafe.isOpenAt(new Date('2026-10-16T08:00:00Z')), true);
});
test('day cafe closed at Fri 17:00 local (close is exclusive)', () => {
  assert.equal(dayCafe.isOpenAt(new Date('2026-10-16T16:00:00Z')), false);
});
test('overnight: open Fri 23:00 local', () => {
  assert.equal(lateBar.isOpenAt(new Date('2026-10-16T22:00:00Z')), true);
});
test('overnight: still open Sat 01:00 local', () => {
  assert.equal(lateBar.isOpenAt(new Date('2026-10-17T00:00:00Z')), true);
});
test('overnight: closed Sat 03:00 local', () => {
  assert.equal(lateBar.isOpenAt(new Date('2026-10-17T02:00:00Z')), false);
});
test('status gives a human label', () => {
  assert.match(dayCafe.status(new Date('2026-10-16T08:00:00Z')).label, /17:00/);
});
test('removeFavourite is idempotent', () => {
  const favs = new Set(['c1']);
  removeFavourite(favs, 'c1');
  removeFavourite(favs, 'c1'); // must not throw
  assert.equal(favs.has('c1'), false);
});`,
        },
      ],
      expected: [
        'Your list shows each caller needing roughly five or more separate facts about hours handling, most of them duplicated.',
        'The new module exposes two methods and hides parsing, validation, timezone conversion and overnight logic.',
        'Both callers shrink to a few lines and contain no try/catch for hours.',
        'All tests in hours.test.mjs pass, including the three overnight cases.',
        'The old hours-shallow.mjs is deleted and nothing imports it.',
      ],
      hints: [
        'Overnight check: a row applies if (today is row.day and minutes >= open and (close > open ? minutes < close : true)) or (yesterday was row.day, close <= open, and minutes < close).',
        'Yesterday is `(day + 6) % 7`.',
        'Parse rows once in createOpeningHours, not on every isOpenAt call. That is also where you decide what to do with malformed rows.',
        "For status(), you only need 'Open until HH:MM' or 'Closed' to pass the test; 'Opens at HH:MM' for the next opening is a good stretch.",
      ],
      verification: [
        '`node --test` passes with the old module deleted.',
        'You can state the new interface from memory in one sentence per method.',
        'Your commit message uses at least three of the vocabulary terms correctly and names the specific decisions now hidden.',
      ],
    },
    successChecklist: [
      'Listed the knowledge each caller needed before the refactor',
      'Identified at least two leaked design decisions',
      'Designed the interface before implementing it',
      'Overnight hours work without a CLOSE_BEFORE_OPEN error',
      'removeFavourite is idempotent and the caller lost its try/catch',
      'Wrote a commit message justifying the change in Ousterhout terms',
    ],
    questions: [
      {
        question: "A teammate splits a 60-line `InvoiceService.issue()` method into eight exported one-line helpers so 'each does one thing'. When is that an improvement and when does it make the code worse?",
        answer:
          "It helps if the helpers are private implementation details that make the method easier to read, and the public interface stays one call: `issue(invoice)`. It makes things worse if the helpers become the interface, because now callers must know there are eight steps, their order and their preconditions, which is a shallow, temporally decomposed design with information leakage. The question to ask is whether the number of things a caller must know went down or up. Ousterhout also warns that splitting tightly related code across many functions can force readers to jump around to understand one idea, so shorter is not automatically simpler.",
      },
      {
        question: "Is 'define errors out of existence' just a fancy name for swallowing exceptions?",
        answer:
          "No. Swallowing an exception hides a real failure, so the caller believes something worked when it did not. Defining an error out of existence changes the operation's specification so that the situation is no longer an error: 'remove this favourite' becomes 'ensure this is not a favourite', so an already-missing favourite is a successful outcome, not a hidden failure. It applies when the error exists only because the interface was defined too narrowly. Genuinely exceptional conditions, like a corrupt record, a failed write or a permission violation, must still be reported. A good test: would any caller ever handle this error differently from success? If not, it probably should not be an error.",
      },
      {
        question: 'How would you spot information leakage in a code review?',
        answer:
          "Look for one design decision appearing in more than one place: the same string format parsed in two modules, two callers that must call functions in the same order, constants or magic values duplicated across files, or a change in one module's internals that forces a change in its callers in the same PR. Another strong signal is change amplification in history: a git log where small feature changes keep touching the same set of files together. Comments like 'remember to call X before Y' are leakage written down. The fix is usually to merge the pieces that share knowledge into one module, or to pull the decision into a module that the others call.",
      },
    ],
    explainPrompt:
      "Explain to a mid-level teammate in a code review why you are asking them to merge their five new exported opening-hours helpers into one module with a two-method interface, using the ideas of complexity, deep modules, information hiding and defining errors out of existence, without making it sound like personal taste.",
    rubric: [
      'Uses complexity symptoms (change amplification, cognitive load, unknown unknowns) with concrete examples from the code',
      'Explains deep vs shallow modules in terms of interface vs functionality',
      'Identifies a specific leaked decision',
      'Explains a specific error defined out of existence and why it is not swallowing',
      'Frames the request as reducing future cost, with a concrete suggested interface',
    ],
    referenceExplanation:
      "The logic itself is correct. My concern is how much every caller has to know to use it. Right now, to answer 'is this café open?', a caller has to fetch the rows, run validateRow on each, convert the time to the café's timezone, filter by day, and then call isWithin, in that order. Both the card and the search filter do exactly that, and they handle the validation error differently. Those are leaked design decisions: the 'HH:MM' storage format, the timezone step and the validation rules all live in the callers as well as in the helpers. That causes change amplification: when we add holiday hours, we'll have to edit every caller, and a new caller can easily miss a step. Ousterhout would call these shallow modules, because each helper's interface is almost as big as what it does. I'm suggesting one deep module, createOpeningHours(rows, timezone), with isOpenAt(date) and status(date). All the knowledge moves inside it, and callers drop to one line. While we're there, CLOSE_BEFORE_OPEN shouldn't be an error at all. A café open 18:00 to 02:00 is normal, so if close is at or before open we treat the hours as crossing midnight. That removes the bug where late-night cafés vanish from 'open now', and it removes the try/catch from both callers. This isn't hiding failures: malformed time strings still get reported, once, when the module is built. The test I'm using is that after this change, the next person to touch hours only needs to read one file.",
    stretch: {
      title: 'Apply the lens to your own code',
      description:
        "Pick a module from NearBrew or a freelance project that you touch often. Write its current interface on one side of a page and the facts a caller must know on the other. Propose a deeper interface, implement it behind the old one (so callers can migrate gradually), and write a short ADR recording the decision and the measured reduction in call-site code.",
    },
    lightTask:
      'Read the starter callers.mjs and write down every fact each caller must know to work correctly. Then write, without implementing, the two-method interface you would replace it with and one sentence explaining how overnight hours stop being an error.',
    intensiveExtras: [
      "Implement status() fully, including 'Opens at HH:MM' for the next opening across days, and add tests for Sunday-to-Monday wraparound.",
      'Run `git log --name-only` on a real project and find a set of files that always change together; write a paragraph on what decision they are leaking.',
      "Write a short comparison of Ousterhout's and Fowler's views on function size, with one example where you agree with each.",
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['js-ts', 'feature-ownership', 'technical-communication'],
    depth: 'standard',
  },
];
