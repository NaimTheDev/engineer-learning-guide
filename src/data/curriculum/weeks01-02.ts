import type { Lesson } from '../types';

/* ------------------------------------------------------------------ */
/* Week 1 code snippets                                                */
/* ------------------------------------------------------------------ */

const W1_SEED_SQL = `-- NearBrew seed: ~200k cafés, ~1M check-ins, ~300k reviews.
-- Run from your host:  docker exec -i pg psql -U postgres -d nearbrew < seed.sql
-- Takes roughly 15-60 seconds depending on your machine.

DROP TABLE IF EXISTS reviews, check_ins, cafes CASCADE;

CREATE TABLE cafes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text         NOT NULL,
  city        text         NOT NULL,
  rating      numeric(2,1) NOT NULL,
  price_level smallint     NOT NULL,
  is_open     boolean      NOT NULL,  -- 'open right now', refreshed by a background job
  created_at  timestamptz  NOT NULL
);

-- City distribution is deliberately skewed so you can see selectivity at work:
--   'St Davids'  = 200 rows (rare)
--   'London'     = ~40%     (very common)
--   'Manchester' = ~15%     (common)
--   18 others    = ~2.5% each (medium)
INSERT INTO cafes (name, city, rating, price_level, is_open, created_at)
SELECT
  (ARRAY['Bean','Brew','Roast','Crema','Drip','Ember','Grind','Kettle','Oat','Press'])[1 + floor(random() * 10)::int]
    || ' ' ||
  (ARRAY['House','Lab','Corner','Collective','Bar','Room','Works','Club','Yard','Society'])[1 + floor(random() * 10)::int]
    || ' ' || g,
  CASE
    WHEN g % 1000 = 0    THEN 'St Davids'
    WHEN random() < 0.40 THEN 'London'
    WHEN random() < 0.25 THEN 'Manchester'
    ELSE (ARRAY['Bristol','Leeds','Glasgow','Edinburgh','Cardiff','Belfast','Brighton','Oxford',
                "Cambridge','York','Bath','Norwich','Exeter','Sheffield','Liverpool','Nottingham",
                'Leicester','Aberdeen'])[1 + floor(random() * 18)::int]
  END,
  round((1 + random() * 4)::numeric, 1),
  1 + floor(random() * 4)::int,
  random() < 0.20,                       -- ~20% of cafés are open right now
  now() - random() * interval '5 years'
FROM generate_series(1, 200000) AS g;

CREATE TABLE check_ins (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id    bigint      NOT NULL REFERENCES cafes (id),
  user_id    bigint      NOT NULL,
  created_at timestamptz NOT NULL,
  note       text
);

-- 20% of check-ins go to 100 'hot' cafés (ids 1-100, ~2,000 check-ins each).
-- The rest are spread evenly (~4-5 check-ins per café).
INSERT INTO check_ins (cafe_id, user_id, created_at, note)
SELECT
  CASE WHEN random() < 0.20 THEN 1 + floor(random() * 100)::bigint
       ELSE 1 + floor(random() * 200000)::bigint END,
  1 + floor(random() * 50000)::bigint,
  now() - random() * interval '365 days',
  CASE WHEN random() < 0.10 THEN 'Great flat white' END
FROM generate_series(1, 1000000);

CREATE TABLE reviews (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id    bigint      NOT NULL REFERENCES cafes (id),
  user_id    bigint      NOT NULL,
  stars      smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body       text        NOT NULL,
  created_at timestamptz NOT NULL
);

INSERT INTO reviews (cafe_id, user_id, stars, body, created_at)
SELECT
  1 + floor(random() * 200000)::bigint,
  1 + floor(random() * 50000)::bigint,
  1 + floor(random() * 5)::int,
  (ARRAY['Lovely staff','Too loud to work','Best cortado nearby','Slow wifi','Great pastries'])[1 + floor(random() * 5)::int],
  now() - random() * interval '2 years'
FROM generate_series(1, 300000);

-- Build planner statistics AND the visibility map (index-only scans depend on it).
VACUUM ANALYZE;

SELECT 'cafes' AS table_name, count(*) FROM cafes
UNION ALL SELECT 'check_ins', count(*) FROM check_ins
UNION ALL SELECT 'reviews',   count(*) FROM reviews;

SELECT relname,
       pg_size_pretty(pg_relation_size(relid))       AS heap,
       pg_size_pretty(pg_indexes_size(relid))        AS indexes
FROM pg_stat_user_tables
ORDER BY relname;`;

const W1_WORKBOOK_SQL = `-- NearBrew EXPLAIN workbook (queries.sql).
-- Open psql:  docker exec -it pg psql -U postgres -d nearbrew
-- Then run blocks one at a time (copy/paste) and record results in results.txt.
\\pset pager off
\\timing on
-- Optional: simpler plans while learning. Turn back on later to compare.
-- SET max_parallel_workers_per_gather = 0;

-- Q1  'Recent visitors' feed for a HOT café (~2,000 check-ins)
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, created_at
FROM check_ins
WHERE cafe_id = 42
ORDER BY created_at DESC
LIMIT 20;

-- Q1b Same query for a QUIET café (~5 check-ins)
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, created_at
FROM check_ins
WHERE cafe_id = 4242
ORDER BY created_at DESC
LIMIT 20;

-- Q2  Full rows: can never be index-only (needs every column)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM check_ins
WHERE cafe_id = 42
ORDER BY created_at DESC
LIMIT 20;

-- Q3  'Activity in the last 24h' dashboard tile: filters on created_at ONLY
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM check_ins
WHERE created_at > now() - interval '1 day';

-- Q4  Cafés by city: rare / medium / very common value
EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, rating FROM cafes WHERE city = 'St Davids';
EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, rating FROM cafes WHERE city = 'Bristol';
EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, rating FROM cafes WHERE city = 'London';

-- Q5  Case-insensitive name lookup (what the NearBrew search box sends)
--     \\gset stores the result column into a psql variable called :target
SELECT lower(name) AS target FROM cafes WHERE id = 4242 \\gset
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name FROM cafes WHERE lower(name) = :'target';

-- Q6  Yesterday's check-ins: function on the column vs a sargable range
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM check_ins
WHERE created_at::date = current_date - 1;

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM check_ins
WHERE created_at >= current_date - 1
  AND created_at <  current_date;

-- Q7  Open cafés in a city, best first (the 'Open now' filter chip)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, rating
FROM cafes
WHERE city = 'Bristol' AND is_open
ORDER BY rating DESC
LIMIT 10;

-- Q7b Same, but WITHOUT the is_open filter
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, rating
FROM cafes
WHERE city = 'Bristol'
ORDER BY rating DESC
LIMIT 10;

-- Handy inspection queries -------------------------------------------
-- What does the planner believe about a column?
SELECT attname, n_distinct, most_common_vals, most_common_freqs
FROM pg_stats
WHERE tablename = 'cafes' AND attname IN ('city', 'is_open');

-- Which indexes exist, how big are they, and are they being used?
SELECT relname AS table_name, indexrelname AS index_name, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE relname IN ('cafes', 'check_ins')
ORDER BY relname, indexrelname;`;

const W1_WRITE_COST_SQL = `-- write-cost.sql: how much do indexes slow down inserts?
-- Run inside psql:  \\i /tmp/write-cost.sql   (after docker cp write-cost.sql pg:/tmp/)
\\timing on

DROP TABLE IF EXISTS check_ins_bench;
CREATE TABLE check_ins_bench (
  cafe_id    bigint      NOT NULL,
  user_id    bigint      NOT NULL,
  created_at timestamptz NOT NULL,
  note       text
);

-- Run 1: no indexes at all
INSERT INTO check_ins_bench (cafe_id, user_id, created_at, note)
SELECT 1 + floor(random() * 200000)::bigint,
       1 + floor(random() * 50000)::bigint,
       now() - random() * interval '365 days',
       NULL
FROM generate_series(1, 300000);

TRUNCATE check_ins_bench;

-- Run 2: four indexes, roughly what an over-indexed table looks like
CREATE INDEX ON check_ins_bench (cafe_id);
CREATE INDEX ON check_ins_bench (user_id);
CREATE INDEX ON check_ins_bench (created_at);
CREATE INDEX ON check_ins_bench (cafe_id, created_at DESC) INCLUDE (user_id);

INSERT INTO check_ins_bench (cafe_id, user_id, created_at, note)
SELECT 1 + floor(random() * 200000)::bigint,
       1 + floor(random() * 50000)::bigint,
       now() - random() * interval '365 days',
       NULL
FROM generate_series(1, 300000);

SELECT pg_size_pretty(pg_relation_size('check_ins_bench')) AS heap,
       pg_size_pretty(pg_indexes_size('check_ins_bench'))  AS all_indexes;

DROP TABLE check_ins_bench;`;

const W1_RESULTS_TEMPLATE = `results.txt  (fill in as you go; keep it, it's interview evidence)

Query | Indexes present                  | Top plan node(s)              | Est rows | Actual rows | Buffers (hit+read) | Exec ms
------+----------------------------------+-------------------------------+----------+-------------+--------------------+--------
Q1    | none (PK only)                   |                               |          |             |                    |
Q1    | (cafe_id)                        |                               |          |             |                    |
Q1    | (cafe_id, created_at DESC)       |                               |          |             |                    |
Q1    | (cafe_id, created_at DESC) INCL  |                               |          |             |                    |
Q3    | composite only                   |                               |          |             |                    |
Q3    | + (created_at)                   |                               |          |             |                    |
Q4 St Davids / Bristol / London    | (city) |                       |          |             |                    |
Q5    | none vs (lower(name))            |                               |          |             |                    |
Q6    | (created_at): cast vs range      |                               |          |             |                    |
Q7    | partial (city, rating) WHERE open|                               |          |             |                    |

Write cost: 300k inserts, 0 indexes = ____ ms ; 4 indexes = ____ ms ; index size = ____

One-line conclusion per experiment:
-
- `;

const W1_EX_SEQSCAN = `-- Q1 with only the primary key. Read the tree from the most-indented line outwards.
-- (Illustrative output: your timings and buffer counts will differ.)

Limit  (cost=14721.37..14723.70 rows=20 width=16) (actual time=61.420..64.012 rows=20 loops=1)
  Buffers: shared hit=7361
  ->  Gather Merge  (cost=14721.37..14916.48 rows=1672 width=16) (actual time=61.418..64.005 rows=20 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=7361
        ->  Sort  (cost=13721.35..13723.44 rows=836 width=16) (actual time=57.903..57.906 rows=17 loops=3)
              Sort Key: created_at DESC
              Sort Method: top-N heapsort  Memory: 26kB
              ->  Parallel Seq Scan on check_ins  (cost=0.00..13699.10 rows=836 width=16) (actual time=0.031..57.601 rows=669 loops=3)
                    Filter: (cafe_id = 42)
                    Rows Removed by Filter: 332664
                    Buffers: shared hit=7353
Planning Time: 0.140 ms
Execution Time: 64.090 ms

-- How to read it:
-- Parallel Seq Scan    : 3 processes (leader + 2 workers, so loops=3) each read a share of
--                        ALL ~7,350 pages and threw away ~332k rows each ('Rows Removed by Filter').
-- rows=669 loops=3     : 'actual rows' is a PER-LOOP average: 669 x 3 = ~2,007 matching rows.
-- Sort (top-N heapsort): only keeps the best 20 per worker, but still had to see every match.
-- Gather Merge         : merges the three sorted streams.
-- cost=a..b            : planner units (not ms). a = cost before first row, b = cost for all rows.
-- Buffers shared hit   : 8kB pages found in Postgres's cache; 'read=' would mean fetched from OS/disk.
-- Verdict              : the whole table is read to return 20 rows. That's the smell.`;

const W1_EX_COMPOSITE = `-- Build the index that matches the query's shape: equality column first, then the sort column.
CREATE INDEX check_ins_cafe_created_idx ON check_ins (cafe_id, created_at DESC);

-- Q1 again (illustrative):
Limit  (cost=0.42..21.30 rows=20 width=16) (actual time=0.028..0.061 rows=20 loops=1)
  Buffers: shared hit=24
  ->  Index Scan using check_ins_cafe_created_idx on check_ins  (cost=0.42..1745.88 rows=1672 width=16) (actual time=0.027..0.057 rows=20 loops=1)
        Index Cond: (cafe_id = 42)
        Buffers: shared hit=24
Execution Time: 0.080 ms

-- No Sort node: the index already returns rows in created_at DESC order for cafe 42,
-- so Limit stops after 20 rows. Note the child's total cost (1745.88) covers ALL 1,672
-- estimated rows, but Limit only pays for ~20 of them.
-- Buffers dropped from ~7,361 to ~24: a few index pages + ~20 heap pages (one per row,
-- because check-ins for cafe 42 are scattered around the table).

-- Now make it covering so the heap is skipped entirely:
CREATE INDEX check_ins_cafe_created_incl_idx
  ON check_ins (cafe_id, created_at DESC) INCLUDE (user_id);
DROP INDEX check_ins_cafe_created_idx;

Limit  (cost=0.42..1.15 rows=20 width=16) (actual time=0.022..0.030 rows=20 loops=1)
  Buffers: shared hit=4
  ->  Index Only Scan using check_ins_cafe_created_incl_idx on check_ins  (...) (actual time=0.021..0.027 rows=20 loops=1)
        Index Cond: (cafe_id = 42)
        Heap Fetches: 0
        Buffers: shared hit=4

-- Heap Fetches: 0 means the visibility map said every page was all-visible, so Postgres
-- never touched the table. After fresh writes (before VACUUM) this number goes up.`;

const W1_EX_BITMAP = `CREATE INDEX cafes_city_idx ON cafes (city);

-- Medium selectivity: Bristol is ~2.5% of rows (~5,000). Typical plan (illustrative):
Bitmap Heap Scan on cafes  (cost=57.1..2311.6 rows=4950 width=27) (actual time=0.61..4.90 rows=5012 loops=1)
  Recheck Cond: (city = 'Bristol'::text)
  Heap Blocks: exact=1702
  Buffers: shared hit=1710
  ->  Bitmap Index Scan on cafes_city_idx  (cost=0.00..55.9 rows=4950 width=0) (actual time=0.42..0.42 rows=5012 loops=1)
        Index Cond: (city = 'Bristol'::text)
        Buffers: shared hit=8

-- Step 1 (inner): Bitmap Index Scan walks the index and builds an in-memory bitmap of
--                 matching row locations. width=0: it returns no columns, just locations.
-- Step 2 (outer): Bitmap Heap Scan visits those heap pages in PHYSICAL order, each page once.
-- Recheck Cond  : shown always; it is only re-evaluated if the bitmap became 'lossy'
--                 (page-level instead of row-level) because it exceeded work_mem.
--                 'Heap Blocks: exact=' means no lossy pages; 'lossy=' would appear otherwise.

-- Very common value: London is ~40% of rows. The index exists but is ignored:
Seq Scan on cafes  (cost=0.00..4204.0 rows=80120 width=27) (actual time=0.01..18.7 rows=79874 loops=1)
  Filter: (city = 'London'::text)
  Rows Removed by Filter: 120126

-- Prove the planner was right: forbid seq scans for one experiment, then compare 'actual time'.
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, rating FROM cafes WHERE city = 'London';
RESET enable_seqscan;`;

const W1_EX_EXPRESSION = `-- 1) Function on the column: an index on name cannot help lower(name).
CREATE INDEX cafes_name_idx ON cafes (name);
EXPLAIN SELECT id FROM cafes WHERE lower(name) = 'roast lab 4242';
--   Seq Scan on cafes  Filter: (lower(name) = 'roast lab 4242'::text)

-- Fix: index the expression itself, then ANALYZE so the planner gets stats for the expression.
CREATE INDEX cafes_lower_name_idx ON cafes (lower(name));
ANALYZE cafes;
EXPLAIN SELECT id FROM cafes WHERE lower(name) = 'roast lab 4242';
--   Index Scan using cafes_lower_name_idx on cafes  Index Cond: (lower(name) = 'roast lab 4242'::text)

-- 2) Casting a timestamptz to date: you can't even build that expression index,
--    because the result depends on the session TimeZone (the cast is not IMMUTABLE):
-- CREATE INDEX ON check_ins ((created_at::date));
--   ERROR:  functions in index expression must be marked IMMUTABLE

-- Fix: rewrite as a range on the raw column (a 'sargable' predicate).
CREATE INDEX check_ins_created_idx ON check_ins (created_at);
EXPLAIN SELECT count(*) FROM check_ins
WHERE created_at >= current_date - 1 AND created_at < current_date;
--   Index Only Scan using check_ins_created_idx  Index Cond: ((created_at >= ...) AND (created_at < ...))

-- 3) Partial index: only index the rows the hot query asks for.
CREATE INDEX cafes_open_city_rating_idx ON cafes (city, rating DESC) WHERE is_open;
-- Usable by:     WHERE city = 'Bristol' AND is_open ORDER BY rating DESC LIMIT 10
-- NOT usable by: WHERE city = 'Bristol' ORDER BY rating DESC LIMIT 10   (closed cafés aren't in it)
SELECT pg_size_pretty(pg_relation_size('cafes_open_city_rating_idx')) AS partial,
       pg_size_pretty(pg_relation_size('cafes_city_idx'))             AS full_city;`;

/* ------------------------------------------------------------------ */
/* Week 2 code snippets                                                */
/* ------------------------------------------------------------------ */

const W2_DATA_TS = `// src/data.ts — 3,000 deterministic NearBrew cafés (same data for everyone).
export interface Cafe {
  id: string;
  name: string;
  neighbourhood: string;
  rating: number;
  tags: string[];
  x: number; // 0..1, horizontal position on the fake map
  y: number; // 0..1, vertical position on the fake map
  openNow: boolean;
}

const NAMES_A = ['Bean', 'Brew', 'Roast', 'Crema', 'Drip', 'Ember', 'Grind', 'Kettle', 'Oat', 'Press'];
const NAMES_B = ['House', 'Lab', 'Corner', 'Collective', 'Bar', 'Room', 'Works', 'Club', 'Yard', 'Society'];
const AREAS = ['Shoreditch', 'Peckham', 'Hackney', 'Brixton', 'Camden', 'Islington', 'Soho', 'Clapham', 'Dalston', 'Bermondsey'];
const TAGS = ['flat white', 'oat milk', 'wifi', 'pastries', 'filter', 'quiet', 'dog friendly', 'outdoor seating', 'v60', 'matcha'];

// Tiny seeded PRNG (mulberry32) so the dataset is identical on every reload.
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

export const CAFES: Cafe[] = Array.from({ length: 3000 }, (_, i) => ({
  id: 'cafe-' + i,
  name: pick(NAMES_A) + ' ' + pick(NAMES_B) + ' ' + (i + 1),
  neighbourhood: pick(AREAS),
  rating: Math.round((3 + rand() * 2) * 10) / 10,
  tags: TAGS.filter(() => rand() < 0.3),
  x: rand(),
  y: rand(),
  openNow: rand() < 0.6,
}));`;

const W2_SEARCH_TS = `// src/search.ts — a deliberately naive fuzzy search.
// PROBLEM (on purpose): it re-normalises every string and runs an edit-distance
// check against every word of every café, on every call.
import type { Cafe } from './data';

// If search is too fast on your machine to see anything, raise this to 2 or 3.
export const WORK_FACTOR = 1;

function normalise(s: string): string {
  return s.normalize('NFD').toLowerCase().trim();
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = temp;
    }
  }
  return prev[b.length];
}

export function scoreCafe(cafe: Cafe, query: string): number {
  const q = normalise(query);
  if (!q) return 1;
  let best = 0;
  for (let n = 0; n < WORK_FACTOR; n++) {
    const fields = [cafe.name, cafe.neighbourhood, ...cafe.tags].map(normalise);
    for (const text of fields) {
      if (text.includes(q)) best = 1;
      for (const word of text.split(' ')) {
        const similarity = 1 - editDistance(word, q) / Math.max(word.length, q.length);
        if (similarity > best) best = similarity;
      }
    }
  }
  return best;
}

export function searchCafes(cafes: Cafe[], query: string, favourites: Set<string>): Cafe[] {
  return cafes
    .map((cafe) => ({ cafe, score: scoreCafe(cafe, query) }))
    .filter((r) => r.score > 0.6)
    .sort((a, b) => {
      const favA = favourites.has(a.cafe.id) ? 1 : 0;
      const favB = favourites.has(b.cafe.id) ? 1 : 0;
      if (favA !== favB) return favB - favA; // favourites float to the top
      return b.score - a.score || b.cafe.rating - a.cafe.rating;
    })
    .map((r) => r.cafe);
}`;

const W2_PERF_TS = `// src/perf.ts — collects React <Profiler> samples so you can record real numbers.
// In the browser console:  perfReset()  ... interact ...  perfReport()
import type { ProfilerOnRenderCallback } from 'react';

interface Sample { id: string; phase: string; actual: number }
const samples: Sample[] = [];

export const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  samples.push({ id, phase, actual: actualDuration });
};

function perfReport() {
  const byId = new Map<string, { commits: number; totalMs: number; maxMs: number }>();
  for (const s of samples) {
    const row = byId.get(s.id) ?? { commits: 0, totalMs: 0, maxMs: 0 };
    row.commits += 1;
    row.totalMs += s.actual;
    row.maxMs = Math.max(row.maxMs, s.actual);
    byId.set(s.id, row);
  }
  const table = [...byId].map(([id, r]) => ({
    id,
    commits: r.commits,
    totalMs: Number(r.totalMs.toFixed(1)),
    avgMs: Number((r.totalMs / r.commits).toFixed(2)),
    maxMs: Number(r.maxMs.toFixed(1)),
  }));
  console.table(table);
  return table;
}

function perfReset() {
  samples.length = 0;
  console.log('perf samples cleared');
}

Object.assign(window, { perfReport, perfReset });`;

const W2_CONTEXT_TSX = `// src/AppContext.tsx — ONE context for everything (deliberately).
import { createContext, useContext } from 'react';

export interface AppContextValue {
  favourites: Set<string>;
  toggleFavourite: (id: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>');
  return ctx;
}`;

const W2_APP_TSX = `// src/App.tsx — the slow version. Every PROBLEM comment is a deliberate bug.
import { Profiler, useState } from 'react';
import { CAFES } from './data';
import { searchCafes } from './search';
import { AppContext } from './AppContext';
import { Header } from './Header';
import { CafeList } from './CafeList';
import { MapPanel } from './MapPanel';
import { onRender } from './perf';

export default function App() {
  // PROBLEM: the search query lives at the very top, so every keystroke
  // re-renders App and therefore EVERY child, including the 3,000-dot map.
  const [query, setQuery] = useState('');
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // PROBLEM: expensive search runs on every App render, whatever caused it
  // (typing, selecting a pin, saving a favourite).
  const results = searchCafes(CAFES, query, favourites);

  const toggleFavourite = (id: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    // PROBLEM: a brand-new value object on every render => every useApp() consumer
    // re-renders, even ones that only read 'favourites' when only 'selectedId' changed.
    <AppContext.Provider value={{ favourites, toggleFavourite, selectedId, setSelectedId }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, fontFamily: 'system-ui' }}>
        <div>
          <Header />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cafés, areas or tags (try: oat, v60, peckham)"
            style={{ width: '100%', padding: 8, fontSize: 16, boxSizing: 'border-box' }}
          />
          <p>{results.length} cafés</p>
          <Profiler id="CafeList" onRender={onRender}>
            <CafeList cafes={results.slice(0, 200)} />
          </Profiler>
        </div>
        <Profiler id="MapPanel" onRender={onRender}>
          <MapPanel cafes={CAFES} />
        </Profiler>
      </div>
    </AppContext.Provider>
  );
}`;

const W2_HEADER_TSX = `// src/Header.tsx — only needs the favourites count.
import { useApp } from './AppContext';

export function Header() {
  const { favourites } = useApp();
  return <h1 style={{ fontSize: 20 }}>NearBrew · {favourites.size} saved</h1>;
}`;

const W2_LIST_TSX = `// src/CafeList.tsx
import { memo, useState, type CSSProperties } from 'react';
import type { Cafe } from './data';
import { useApp } from './AppContext';

export function CafeList({ cafes }: { cafes: Cafe[] }) {
  const { favourites, toggleFavourite, selectedId, setSelectedId } = useApp();
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {cafes.map((cafe, index) => (
        <CafeRow
          // PROBLEM: index as key. Saving a café moves it to the top of the list,
          // so React keeps each row's local state at the old POSITION, not the café.
          key={index}
          cafe={cafe}
          isFavourite={favourites.has(cafe.id)}
          isSelected={selectedId === cafe.id}
          // PROBLEM: new function + new object every render, which silently defeats memo().
          onToggleFavourite={() => toggleFavourite(cafe.id)}
          onSelect={() => setSelectedId(cafe.id)}
          style={{ padding: 8, borderBottom: '1px solid #ddd' }}
        />
      ))}
    </ul>
  );
}

interface CafeRowProps {
  cafe: Cafe;
  isFavourite: boolean;
  isSelected: boolean;
  onToggleFavourite: () => void;
  onSelect: () => void;
  style: CSSProperties;
}

// memo() is here, but it never gets to skip a render. Why? (That's the exercise.)
const CafeRow = memo(function CafeRow({ cafe, isFavourite, isSelected, onToggleFavourite, onSelect, style }: CafeRowProps) {
  // Local UI state: is the private-note box open for this row?
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <li style={{ ...style, background: isSelected ? '#fff4d6' : undefined }}>
      <button onClick={onSelect} style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }}>
        {cafe.name}
      </button>
      <span> · {cafe.neighbourhood} · ★ {cafe.rating}</span>
      <button onClick={onToggleFavourite} aria-pressed={isFavourite} style={{ marginLeft: 8 }}>
        {isFavourite ? '♥ Saved' : '♡ Save'}
      </button>
      <button onClick={() => setNoteOpen((open) => !open)} style={{ marginLeft: 8 }}>
        Note
      </button>
      {noteOpen && (
        <textarea placeholder={'Private note about ' + cafe.name} style={{ display: 'block', width: '100%', marginTop: 4 }} />
      )}
    </li>
  );
});`;

const W2_MAP_TSX = `// src/MapPanel.tsx — a fake map: one absolutely-positioned dot per café.
// Rendering 3,000 dots is deliberately heavy so wasted renders are visible.
import type { Cafe } from './data';
import { useApp } from './AppContext';

export function MapPanel({ cafes }: { cafes: Cafe[] }) {
  const { favourites, selectedId, setSelectedId } = useApp();
  return (
    <div style={{ position: 'sticky', top: 16, height: 520, background: '#e8efe6', borderRadius: 8, overflow: 'hidden' }}>
      {cafes.map((cafe) => {
        const selected = cafe.id === selectedId;
        const saved = favourites.has(cafe.id);
        return (
          <div
            key={cafe.id}
            title={cafe.name}
            onClick={() => setSelectedId(cafe.id)}
            style={{
              position: 'absolute',
              left: cafe.x * 100 + '%',
              top: cafe.y * 100 + '%',
              width: selected ? 12 : 6,
              height: selected ? 12 : 6,
              borderRadius: '50%',
              cursor: 'pointer',
              background: selected ? '#d9480f' : saved ? '#c2255c' : '#2b8a3e',
            }}
          />
        );
      })}
    </div>
  );
}`;

const W2_MEASURE_TEMPLATE = `measurements.md (plain text is fine). Same machine, same browser, same CPU throttle.

Scenario A: type 'oat milk' (8 keystrokes) into an empty search box
Scenario B: click 'Save' on 5 different cafés
Scenario C: click 5 different map pins

                         | Baseline | After fix 1 | After fix 2 | After fix 3 | After fix 4
                         | (slow)   | (search)    | (state down)| (context)   | (keys+props)
-------------------------+----------+-------------+-------------+-------------+------------
A: MapPanel commits      |          |             |             |             |
A: MapPanel total ms     |          |             |             |             |
A: CafeList total ms     |          |             |             |             |
A: slowest commit (DevTools Profiler) ms |  |     |             |             |
A: searchCafes ms/call   |          |             |             |             |
B: CafeRow renders/click |          |             |             |             |
C: Header renders/click  |          |             |             |             |
Note-box bug reproduces? |   yes    |             |             |             |

CPU throttle used: ____x   React version: ____   StrictMode on/off: ____

Summary (3 sentences: biggest win, what surprised you, what you would NOT bother memoising):`;

const W2_EX_REFEQ = `// Why memo() did nothing in the starter: props are compared with Object.is, one by one.
Object.is('cafe-1', 'cafe-1');           // true  (primitives compare by value)
Object.is({ padding: 8 }, { padding: 8 }); // false (two different objects)
Object.is(() => {}, () => {});           // false (two different functions)

// Parent render #1 and #2 each create NEW style and onSave values:
<CafeRow cafe={cafe} style={{ padding: 8 }} onSave={() => save(cafe.id)} />
// => memo compares, sees style/onSave changed, re-renders anyway. You paid for the
//    comparison AND the render.

// Stable version:
const rowStyle = { padding: 8 };               // module-level constant: same object forever

function CafeList({ cafes }: { cafes: Cafe[] }) {
  const { toggle } = useFavouriteActions();    // stable function from context (see example 3)
  return cafes.map((cafe) => (
    <CafeRow key={cafe.id} cafe={cafe} style={rowStyle} onToggleFavourite={toggle} />
  ));
}
// CafeRow now calls onToggleFavourite(cafe.id) itself, so no per-row closure is needed.
// If you DO need a closure that captures changing values, useCallback with correct deps.`;

const W2_EX_STATE_DOWN = `// BEFORE: query in App => typing re-renders App, Header, the list AND the map.
function App() {
  const [query, setQuery] = useState('');
  return (
    <>
      <SearchBox value={query} onChange={setQuery} />
      <Results query={query} />
      <MapPanel cafes={CAFES} />   {/* re-renders on every keystroke for no reason */}
    </>
  );
}

// AFTER (move state down): only the subtree that needs the query owns it.
function App() {
  return (
    <>
      <CafeSearch />               {/* owns query + results; re-renders on keystrokes */}
      <MapPanel cafes={CAFES} />   {/* App didn't re-render, so neither does this */}
    </>
  );
}

// Lifting content up (children as props): a stateful wrapper does NOT re-render the
// elements it receives, because they were created by the PARENT and are the same objects.
function ResizablePanel({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(480);    // changes 60 times/sec while dragging
  return (
    <div style={{ width }}>
      <DragHandle onDrag={setWidth} />
      {children}                               {/* <MapPanel/> is NOT re-rendered by drags */}
    </div>
  );
}
// <ResizablePanel><MapPanel cafes={CAFES} /></ResizablePanel>`;

const W2_EX_CONTEXT = `// Split by what changes, and keep the 'actions' object stable.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

const FavouritesContext = createContext<ReadonlySet<string>>(new Set());
const FavouriteActionsContext = createContext<{ toggle: (id: string) => void } | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [favourites, setFavourites] = useState<ReadonlySet<string>>(() => new Set());

  // setFavourites is guaranteed stable by React, so this object is created once.
  const actions = useMemo(
    () => ({
      toggle: (id: string) =>
        setFavourites((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
    }),
    [],
  );

  return (
    <FavouriteActionsContext.Provider value={actions}>
      <FavouritesContext.Provider value={favourites}>{children}</FavouritesContext.Provider>
    </FavouriteActionsContext.Provider>
  );
}

export const useFavourites = () => useContext(FavouritesContext);
export function useFavouriteActions() {
  const ctx = useContext(FavouriteActionsContext);
  if (!ctx) throw new Error('useFavouriteActions must be used inside <FavouritesProvider>');
  return ctx;
}
// A component that only calls useFavouriteActions() never re-renders when favourites change.
// Do the same for selection: SelectionContext (selectedId) + a stable setter.
// Note: memo() does NOT block context. If a memoised component reads a context, it still
// re-renders whenever that context's value changes.`;

const W2_EX_KEYS = `// State belongs to a position in the tree, identified by (component type, key).
// With key={index}, 'row #2' keeps its state even when a different café moves into it.

// List before saving 'Oat Lab 7':        List after (favourites float to top):
// key=0  Bean House 3                     key=0  Oat Lab 7     <- gets row 0's state
// key=1  Crema Bar 12                     key=1  Bean House 3  <- gets row 1's state
// key=2  Oat Lab 7   (note box OPEN)      key=2  Crema Bar 12  <- note box is OPEN here now!

// Fix: a key that identifies the DATA, stable across reorders, filters and inserts.
{cafes.map((cafe) => <CafeRow key={cafe.id} cafe={cafe} />)}

// Never: key={Math.random()} (remounts every render, destroys state, very slow)
// Fine:  key={index} for static lists that never reorder, filter or insert, and rows without state.
// Useful trick: change a key on purpose to RESET a component, e.g.
// <ReviewForm key={cafe.id} />  so switching café gives a fresh, empty form.`;

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

export const weeks01to02: Lesson[] = [
  {
    week: 1,
    slug: 'postgres-indexes-explain',
    title: 'PostgreSQL indexes and EXPLAIN ANALYZE',
    track: 'backend',
    secondaryTracks: ['cs'],
    topics: [
      'B-tree indexes',
      'EXPLAIN ANALYZE',
      'query planner',
      'composite indexes',
      'partial indexes',
      'covering indexes',
      'expression indexes',
      'planner statistics',
      'selectivity',
      'index write cost',
    ],
    objective:
      'By the end you can read an EXPLAIN (ANALYZE, BUFFERS) plan line by line, explain why Postgres chose a Seq Scan, Index Scan, Bitmap Heap Scan or Index Only Scan, and design the right single, composite, partial, covering or expression index for a real NearBrew query, including what it costs on writes.',
    whyItMatters:
      "Most 'the API is slow' tickets in product backends end in the database, and most of those come down to a missing, wrong or unusable index. Engineers who can read a plan fix these in minutes with evidence; engineers who can't add random indexes, slow down every write, and still don't know why the query was slow. It is also one of the clearest ways to show senior judgment in an interview or a design review: 'here is the plan, here is why, here is the trade-off'.",
    explanation: [
      "Start with the physical picture. A Postgres table (the **heap**) is a pile of 8 kB pages with rows in no useful order, roughly the order they were inserted or wherever free space was found. Without help, the only way to answer `WHERE cafe_id = 42` is to read every page and test every row: a **Seq Scan**. A **B-tree index** is a separate, sorted structure of (key, row location) pairs, kept balanced so any key is found in a handful of page reads (3–4 levels covers millions of rows). It gives you two superpowers: jump straight to matching keys, and read them **already sorted**. Almost everything in this lesson follows from those two facts plus the cost of going from the index back to the heap.",
      "Postgres uses a **cost-based planner**. For every query it considers alternative plans (scan types, join orders and methods), estimates how many rows each step produces using table **statistics**, converts that into an abstract cost, and runs the cheapest. `EXPLAIN` shows the chosen plan and estimates without running it. `EXPLAIN ANALYZE` actually executes the query and adds real timings and row counts, and `BUFFERS` adds how many 8 kB pages were touched. Because ANALYZE really runs the statement, wrap an `UPDATE` or `DELETE` in `BEGIN; ... ROLLBACK;` when you explain it. Make `EXPLAIN (ANALYZE, BUFFERS)` your default: timing alone is noisy (cache warm or cold), but buffer counts are a stable measure of work done.",
      "Reading one plan line: `Index Scan using idx on check_ins (cost=0.42..21.30 rows=20 width=16) (actual time=0.028..0.061 rows=20 loops=1)`. The first parentheses are **estimates**: `cost=startup..total` in planner units (not milliseconds; by default reading one sequential page costs 1.0 and a random page 4.0), `rows` is the estimated rows this node outputs, `width` the average row size in bytes. The second parentheses are **reality**: time in ms to the first row and to the last row, actual rows output, and `loops`, how many times the node ran. Actual rows and time are **per loop**, so a node showing `rows=669 loops=3` really produced about 2,000 rows (common in parallel scans and in the inner side of nested loop joins). The plan is a tree: indented `->` lines are children feeding their parent, and you read from the most-indented line outward.",
      "The four scan types you must recognise. **Seq Scan**: read every heap page in order; sequential I/O is cheap per page, but it's all pages. **Index Scan**: walk the index, and for each match fetch the row from the heap. It's great for few rows, and it returns rows in index order, so a following `ORDER BY ... LIMIT` can stop early. It's bad for many rows, because each fetch can be a random page read. **Bitmap Index Scan + Bitmap Heap Scan**: first collect all matching row locations into an in-memory bitmap, then visit heap pages in physical order, each page once. That is the middle ground for 'a few percent of the table', and Postgres can combine bitmaps from several indexes with `BitmapAnd` / `BitmapOr`. **Index Only Scan**: every column the query needs is in the index, so the heap is skipped, but only for pages the **visibility map** marks all-visible. `Heap Fetches: N` tells you how often it still had to check the heap, which is why `VACUUM` matters for index-only scans.",
      "**Estimates vs actual rows** is the most valuable comparison in the whole plan. If a node estimated `rows=200` and produced `rows=4800`, every decision above it was made on bad information: the wrong scan type, a nested loop where a hash join would be better, too little memory for a sort. Estimates come from statistics gathered by `ANALYZE` (autovacuum runs it in the background): per column, the fraction of nulls, `n_distinct`, a list of **most common values** with their frequencies, and a histogram for the rest. You can read them in `pg_stats`. After a bulk load, a big backfill, or a data migration, run `ANALYZE` yourself instead of waiting. A 10x or worse mismatch is a red flag worth investigating before you touch any index. Two classic causes are stale stats and correlated columns, which the planner assumes are independent unless you create extended statistics.",
      "**Selectivity** decides whether an index is worth it at all. With an index on `city`, 'St Davids' (200 of 200,000 cafés) is an obvious index lookup. 'Bristol' (around 2.5%) usually becomes a bitmap scan. 'London' (40%) gets a Seq Scan even though the index exists, and the planner is **right**: reading most pages sequentially beats jumping around the index and the heap for 80,000 rows. There is no fixed percentage threshold. It depends on row width, on how well the physical row order matches the index order (the `correlation` stat), on cache, and on cost settings. Small tables are often seq-scanned whatever you do. The lesson for product work: index the columns that **narrow** results down a lot. A low-selectivity filter (booleans, status columns, a dominant city) rarely deserves its own index, but it can be a great **partial index predicate**.",
      "**Composite index column order** works like a phone book sorted by (surname, first name). It is great for 'everyone named Smith', and for 'Smith, sorted by first name', but useless for 'everyone named Anna' because Annas are scattered across every surname. The usual rule is **equality columns first, then the range or sort column**. `(cafe_id, created_at DESC)` serves `WHERE cafe_id = 42 ORDER BY created_at DESC LIMIT 20` perfectly: Postgres jumps to cafe 42 and reads the first 20 entries already in order, with no Sort node, and Limit stops early. The same index cannot efficiently serve `WHERE created_at > now() - interval '1 day'`. On Postgres 16 you'll get a Seq Scan, or at best a scan of the entire index. (Postgres 18 added B-tree 'skip scan', which can sometimes use a non-leading column when the leading column has few distinct values. Don't count on it, and it won't appear on the version used in this exercise.) A second index on `(cafe_id)` alone becomes redundant once `(cafe_id, created_at)` exists, because the composite already serves lookups on its leading column.",
      "Why the planner ignores an index you **know** exists. The most common reason is wrapping the column in a function or cast: `WHERE lower(name) = ...`, `WHERE created_at::date = ...`, `WHERE id::text = ...`. The index stores `name`, not `lower(name)`, so it can't help. Fix it with an **expression index** `ON cafes (lower(name))` (run `ANALYZE` afterwards so it has stats), or rewrite the predicate as a range on the raw column. `created_at::date` on a `timestamptz` can't even be indexed, because the result depends on the session time zone, so the range rewrite is the answer. Other reasons: a leading-wildcard `LIKE '%brew'` (B-trees index prefixes); a type mismatch that forces a cast on the column side; a query that doesn't imply a partial index's `WHERE`; the leading column of a composite missing from the query; low selectivity; or stale statistics. When in doubt, `SET enable_seqscan = off` for one session-only experiment and compare **actual** time. It tells you whether the index plan is really faster, and often it isn't.",
      "**Partial and covering indexes** are precision tools. A partial index `ON cafes (city, rating DESC) WHERE is_open` only contains open cafés (about 20% here). It is several times smaller, cheaper to maintain, and fits in cache. The planner uses it only when the query's `WHERE` provably implies `is_open`, so the 'Open now' filter chip gets fast and everything else ignores it. Classic uses include `WHERE deleted_at IS NULL`, `WHERE status = 'pending'` for a job queue, and unique constraints on active rows only. A **covering index** uses `INCLUDE (user_id)` to store extra payload columns in the leaf pages without making them part of the sort key. That enables Index Only Scans for a specific hot query without bloating the key. Use both sparingly and for named, measured queries, not 'just in case'.",
      "Finally, **indexes are not free**. Every `INSERT` must add an entry to every index on the table, and every index means more WAL (the write-ahead log, which also feeds replicas and backups), more disk, and more competition for the buffer cache. An `UPDATE` that changes an indexed column must also update the indexes. One that changes only non-indexed columns can often be a cheap **HOT** (heap-only tuple) update, so indexing a frequently updated column like `is_open` or `last_seen_at` has a hidden cost. Check `pg_stat_user_indexes.idx_scan` for indexes that are never used, and drop them deliberately (on a replica-heavy setup, check every node first). In production, create indexes with `CREATE INDEX CONCURRENTLY` so writes aren't blocked. It is slower and can fail and leave an `INVALID` index you must drop and retry. The senior habit is to state every index as a trade: this query gets X faster, these writes get Y slower, the index costs Z MB.",
    ],
    examples: [
      { language: 'text', title: 'Reading a Seq Scan plan (no useful index)', code: W1_EX_SEQSCAN },
      { language: 'sql', title: 'Composite index removes the Sort; INCLUDE gives an Index Only Scan', code: W1_EX_COMPOSITE },
      { language: 'sql', title: 'Bitmap Heap Scan vs ignored index: selectivity in action', code: W1_EX_BITMAP },
      { language: 'sql', title: 'Expression, sargable range and partial indexes', code: W1_EX_EXPRESSION },
    ],
    keyTakeaways: [
      'Always use `EXPLAIN (ANALYZE, BUFFERS)`; buffers measure work more reliably than milliseconds.',
      "Compare estimated vs actual rows first: a 10x mismatch means the planner was misinformed. Check stats (`ANALYZE`, `pg_stats`) before adding indexes.",
      'Actual rows and time are per loop, so multiply by `loops`.',
      'Seq Scan for many rows, Bitmap for a few percent, Index Scan for few rows or ordered + LIMIT, Index Only Scan when the index covers every needed column and pages are all-visible.',
      'Composite order: equality columns first, then the range/sort column; a composite index makes a separate index on its leading column redundant.',
      'Functions or casts on a column hide it from a plain index; use an expression index or rewrite as a range.',
      'Every index speeds some reads and slows every write: justify each one with a named query and measured numbers.',
    ],
    prerequisites: [
      'Comfortable writing SELECT queries with WHERE, ORDER BY, LIMIT and simple joins',
      'Docker installed and able to run a container',
      'Basic command-line use (psql is introduced in the exercise)',
    ],
    prerequisiteWeeks: [],
    resources: [
      {
        title: 'PostgreSQL docs: Using EXPLAIN',
        url: 'https://www.postgresql.org/docs/current/using-explain.html',
        kind: 'docs',
        note: "Read 'EXPLAIN Basics' and 'EXPLAIN ANALYZE' closely; skim the caveats section at the end. This is the canonical guide to every number in a plan line.",
        minutes: 15,
      },
      {
        title: 'PostgreSQL docs: Multicolumn Indexes',
        url: 'https://www.postgresql.org/docs/current/indexes-multicolumn.html',
        kind: 'docs',
        note: 'Short page. Focus on why leading-column constraints matter most for B-trees.',
        minutes: 5,
      },
      {
        title: 'PostgreSQL docs: Index-Only Scans and Covering Indexes',
        url: 'https://www.postgresql.org/docs/current/indexes-index-only-scans.html',
        kind: 'docs',
        note: 'Read the explanation of the visibility map and the INCLUDE clause; it explains Heap Fetches.',
        minutes: 8,
      },
      {
        title: 'PostgreSQL docs: Partial Indexes',
        url: 'https://www.postgresql.org/docs/current/indexes-partial.html',
        kind: 'docs',
        note: "Read the examples, especially the note that the query's WHERE must imply the index predicate.",
        minutes: 5,
      },
      {
        title: 'PostgreSQL docs: Statistics Used by the Planner',
        url: 'https://www.postgresql.org/docs/current/planner-stats.html',
        kind: 'docs',
        note: 'Skim the single-column statistics section (pg_stats, most_common_vals) and the extended statistics intro. Read after the exercise if time is short.',
        minutes: 7,
      },
      {
        title: 'Use The Index, Luke (Markus Winand)',
        url: 'https://use-the-index-luke.com/',
        kind: 'article',
        note: "Optional, free, vendor-neutral book on SQL indexing. Read the chapter on the anatomy of an index and the one on the WHERE clause (concatenated keys, functions) when you want more depth.",
        minutes: 15,
        verify: true,
      },
    ],
    exercise: {
      title: 'Make the NearBrew check-in feed fast, and prove it with plans',
      scenario:
        "NearBrew's café page shows 'recent visitors' (the last 20 check-ins), city listings, an 'Open now' filter and a case-insensitive name search. With 200k cafés and 1M check-ins, product reports the café page is sluggish and the ops dashboard's '24h activity' tile times out at peak. You'll reproduce the dataset locally, measure every query, add indexes one at a time, and leave a results table that justifies each index, including what it costs on writes.",
      setup: [
        'Start Postgres 16: `docker run --name pg -e POSTGRES_PASSWORD=pg -p 5432:5432 -d postgres:16` (if the name is taken: `docker rm -f pg` first).',
        'Create the database: `docker exec -it pg createdb -U postgres nearbrew`.',
        'Make a working folder (e.g. `~/nearbrew-db`) and save the starter files below as `seed.sql`, `queries.sql`, `write-cost.sql` and `results.txt`.',
        'Load the data: `docker exec -i pg psql -U postgres -d nearbrew < seed.sql` (expect 15–60 s; the last two SELECTs print row counts and sizes).',
        'Open an interactive session for the rest of the exercise: `docker exec -it pg psql -U postgres -d nearbrew`. Useful psql commands: `\\d check_ins` (table and its indexes), `\\di+` (index sizes), `\\x` (toggle expanded output), `\\q` (quit).',
      ],
      steps: [
        "Orient yourself (5 min). Run `\\d cafes` and `\\d check_ins` and note that only primary-key indexes exist. Run the `pg_stats` query from the end of `queries.sql` and read `most_common_vals` / `most_common_freqs` for `city`: you should see London near 0.40 and Manchester near 0.15. This is exactly what the planner believes. Optionally run `SET max_parallel_workers_per_gather = 0;` to make the first plans easier to read (you'll compare with parallelism later).",
        "Baseline (10 min). Run Q1, Q1b, Q3, Q4 (all three cities), Q5, Q6 and Q7 with no extra indexes. For each, write in `results.txt` the top scan node, estimated vs actual rows on the scan node, total buffers (hit + read) and execution time. For Q1, trace the tree bottom-up using example 1 (Seq Scan → Sort → Gather Merge → Limit), and multiply actual rows by `loops` to get the real match count.",
        'Single-column index (5 min). `CREATE INDEX check_ins_cafe_idx ON check_ins (cafe_id);` then rerun Q1 (hot café 42) and Q1b (quiet café 4242). Expect different plans. Q1b (about 5 rows) likely gets an Index Scan or a small Bitmap Heap Scan. Q1 (about 2,000 rows) likely gets a Bitmap Heap Scan feeding a Sort, because it has to fetch every check-in for café 42 just to keep the newest 20. Record the buffers for both and note why the hot café is still doing far more work than it returns.',
        "Composite index and column order (8 min). `CREATE INDEX check_ins_cafe_created_idx ON check_ins (cafe_id, created_at DESC);` and rerun Q1. Confirm the Sort node has disappeared and the buffers dropped to a few dozen (example 2). Now `DROP INDEX check_ins_cafe_idx;`, rerun Q1b and confirm the composite still serves a lookup on its leading column alone. That's why the single-column index was redundant. Then run Q3 (last 24h, filters only `created_at`) and record that the composite does NOT make it cheap: expect a Seq Scan, or an Index Only Scan whose buffer count shows it read most of the index.",
        "Covering index and the visibility map (8 min). Create `CREATE INDEX check_ins_cafe_created_incl_idx ON check_ins (cafe_id, created_at DESC) INCLUDE (user_id);`, drop `check_ins_cafe_created_idx`, and rerun Q1: you should see `Index Only Scan` with `Heap Fetches: 0`. Run Q2 (`SELECT *`) and note it falls back to a regular Index Scan. Now insert fresh rows: `INSERT INTO check_ins (cafe_id, user_id, created_at) SELECT 42, g, now() FROM generate_series(1, 50) g;` and rerun Q1. Heap Fetches should now be non-zero, because new pages aren't all-visible yet. Run `VACUUM check_ins;`, rerun, and watch it drop back to 0.",
        "Selectivity and 'the planner was right' (8 min). `CREATE INDEX cafes_city_idx ON cafes (city);` and rerun the three Q4 queries. Expect roughly: St Davids gets an Index Scan or a small Bitmap Heap Scan, Bristol gets a Bitmap Heap Scan, and London gets a Seq Scan with the index ignored (example 3). If you see a different plan for Bristol on your machine, that's fine: record what you see and why. Then run `SET enable_seqscan = off;`, rerun the London query, compare actual time and buffers with the Seq Scan version, and `RESET enable_seqscan;`. Write one sentence on why the planner avoided the index.",
        "Functions on columns: expression index and sargable rewrite (8 min). Run Q5 (the `lower(name)` lookup) and record the Seq Scan. Create `CREATE INDEX cafes_lower_name_idx ON cafes (lower(name));`, run `ANALYZE cafes;`, rerun Q5, and confirm an Index Scan with `Index Cond: (lower(name) = ...)`. Next, `CREATE INDEX check_ins_created_idx ON check_ins (created_at);` and run both Q6 variants. The `created_at::date = ...` version can't use the index. The range version can, and it should now be an Index Only Scan or a Bitmap scan touching a few hundred pages at most. Rerun Q3 too: it is now cheap. Try `CREATE INDEX ON check_ins ((created_at::date));` and read the IMMUTABLE error.",
        "Partial index for 'Open now' (5 min). `CREATE INDEX cafes_open_city_rating_idx ON cafes (city, rating DESC) WHERE is_open;` then rerun Q7 and Q7b. Q7 should use the partial index with no Sort. Q7b can't, because closed cafés aren't in it. Compare sizes with the size query at the end of example 4, or with `\\di+`. Note in `results.txt` that this index is only maintained for rows where `is_open` is true, and think about what happens to it when a job flips `is_open` for thousands of cafés every morning and evening.",
        "Stale statistics (8 min). Run `ALTER TABLE cafes SET (autovacuum_enabled = false);` then `UPDATE cafes SET city = 'St Davids' WHERE city = 'Glasgow';` (moves about 4,500 rows). Immediately run `EXPLAIN ANALYZE SELECT id, name FROM cafes WHERE city = 'St Davids';`. The estimate will still say about 200 rows while the actual is about 4,700, and the plan may be one that suits 200 rows. Run `ANALYZE cafes;`, rerun, and compare the estimate and possibly the plan. Then `ALTER TABLE cafes RESET (autovacuum_enabled);`. Record the before/after estimate.",
        "Write cost and cleanup (8 min). `docker cp write-cost.sql pg:/tmp/write-cost.sql` then in psql `\\i /tmp/write-cost.sql`. Record insert time with 0 vs 4 indexes and the index size vs heap size. Then run the `pg_stat_user_indexes` query: which of your indexes have `idx_scan = 0` or only served one experiment? Decide which indexes you'd actually ship for NearBrew (probably the covering check-in index, `created_at`, `lower(name)` and the partial open-cafés index) and drop the rest. Finish `results.txt` with one line per index: the query it serves, the speed-up in buffers, and its size.",
      ],
      starter: [
        { language: 'sql', title: 'seed.sql: NearBrew dataset with generate_series', code: W1_SEED_SQL },
        { language: 'sql', title: 'queries.sql: the EXPLAIN workbook', code: W1_WORKBOOK_SQL },
        { language: 'sql', title: 'write-cost.sql: measure index maintenance overhead', code: W1_WRITE_COST_SQL },
        { language: 'text', title: 'results.txt: fill this in as you go', code: W1_RESULTS_TEMPLATE },
      ],
      expected: [
        'Baseline Q1 reads every page of check_ins (several thousand buffers) to return 20 rows; with the composite index it drops to a few dozen buffers, and to a handful with the INCLUDE index (Index Only Scan, Heap Fetches: 0).',
        'With only (cafe_id), the hot café plan still contains a Sort over ~2,000 rows; with (cafe_id, created_at DESC) the Sort node disappears and Limit stops early.',
        "The London query keeps a Seq Scan even with cafes_city_idx present, and forcing the index with enable_seqscan = off is not faster (often slower).",
        'lower(name) only uses an index after the expression index exists; created_at::date never uses the created_at index, while the range rewrite does.',
        'Q7 uses the partial index; Q7b does not. The partial index is noticeably smaller than the full city index.',
        'After the UPDATE with autovacuum disabled, the estimate for St Davids is badly wrong (about 200 vs about 4,700); ANALYZE fixes it.',
        'Inserting 300k rows is measurably slower with 4 indexes than with none, and the indexes together are a large fraction of (or bigger than) the heap.',
      ],
      hints: [
        "If plans look cluttered by Gather / Parallel nodes, run `SET max_parallel_workers_per_gather = 0;` for the session. Remember that this changes timings, so compare like with like.",
        "Run each EXPLAIN twice and record the second run. The first may show `read=` buffers (cold cache) while later runs show `hit=`. Buffer totals are comparable across runs; milliseconds less so.",
        "If an index you just created isn't used, check three things in order: does the query's WHERE match the index's leading column and any partial predicate exactly? Is a function or cast wrapping the column? Are statistics fresh (run `ANALYZE table_name`)?",
        "An index that appears in the plan isn't automatically a win. Compare buffers and actual time against the baseline, not just the node name.",
      ],
      verification: [
        '`results.txt` has a row for every experiment with plan node, est vs actual rows, buffers and time filled in.',
        'You can point at the Q1 baseline plan and explain every line, including why `rows` must be multiplied by `loops`.',
        'You can predict (before running) which scan type Q4 will use for a new city value you pick, and you are right or can explain why not.',
        "Running `\\d check_ins` and `\\d cafes` shows only the indexes you'd defend in a code review, each with a one-line justification in results.txt.",
        'You recorded the insert-time difference from write-cost.sql and can state it as a trade-off sentence.',
      ],
    },
    successChecklist: [
      'Seeded 200k cafés and ~1M check-ins locally and captured a baseline plan for every workbook query',
      'Observed and explained Seq Scan, Index Scan, Bitmap Heap Scan and Index Only Scan on your own data',
      'Removed a Sort node with a correctly ordered composite index and showed the buffer reduction',
      'Demonstrated an index being ignored for low selectivity and for a function on a column, and fixed the latter',
      'Showed stale statistics causing a misestimate and fixed it with ANALYZE',
      'Measured insert slowdown and index size, and dropped indexes you could not justify',
    ],
    questions: [
      {
        question:
          'A plan shows `Index Scan using check_ins_cafe_idx ... (cost=0.42..8.44 rows=1 width=24) (actual time=0.03..95.10 rows=48000 loops=1)`. What is going on, and what would you check next?',
        answer:
          "The planner estimated 1 row but the node really produced 48,000. That is a massive misestimate, and it's why an Index Scan (good for very few rows) was chosen: it is now doing ~48,000 heap fetches, many of them random pages, which explains the 95 ms. The first thing to check is statistics: when was the table last analyzed (`pg_stat_user_tables.last_analyze` / `last_autoanalyze`), and does `pg_stats` for `cafe_id` reflect the current distribution? A bulk import or a newly popular café often causes this. Run `ANALYZE check_ins` and re-explain: with a realistic estimate the planner would likely switch to a Bitmap Heap Scan or a Seq Scan. If stats are fresh and it's still wrong, look for correlated predicates or parameter values that differ wildly from the typical value (raising the column's statistics target can help).",
      },
      {
        question:
          'NearBrew needs `WHERE user_id = $1 AND created_at > $2 ORDER BY created_at DESC LIMIT 50` (a user\'s recent check-ins). Which index would you create and why that column order? What would change if the query instead filtered on `created_at` alone for an admin report?',
        answer:
          "Create `(user_id, created_at DESC)`. `user_id` is an equality condition, so putting it first narrows the search to one contiguous slice of the index. Within that slice entries are already sorted by `created_at`, so the range condition becomes a bounded walk and `ORDER BY ... LIMIT 50` needs no Sort: the scan stops after 50 entries. The reverse order `(created_at, user_id)` would have to walk every user's check-ins inside the time range and filter by user, which is far more work. For an admin report filtering only on `created_at`, this composite doesn't help much on Postgres 16, because the leading column isn't constrained. You'd want a separate index on `(created_at)` if that report runs often enough to justify the extra write cost, or you'd accept a Seq Scan for a rare report. If the report only needs a few columns, `INCLUDE` could make it index-only.",
      },
      {
        question:
          'A teammate proposes adding indexes on `is_open`, `price_level`, `city`, `rating` and `created_at` on the cafés table "so all the filters are fast". How do you respond?',
        answer:
          "First, most of those are low-selectivity columns. `is_open` is a boolean and `price_level` has four values, so a single-column B-tree on them will usually be ignored in favour of a Seq Scan, or at best give a weak bitmap scan. Second, every index slows every insert and every update that touches the indexed columns, costs disk and cache, and adds WAL; `is_open` changes frequently, so indexing it also prevents cheap HOT updates. Third, single-column indexes rarely match real query shapes. The better approach is to list the actual hot queries from the app (e.g. 'open cafés in a city by rating') and design one or two indexes for them, such as a composite `(city, rating DESC)` partial index `WHERE is_open`. Then verify each with `EXPLAIN (ANALYZE, BUFFERS)` and check `pg_stat_user_indexes` after a week to confirm they're used.",
      },
    ],
    explainPrompt:
      "Explain to a mid-level teammate in a code review why their new endpoint `GET /cafes/:id/check-ins?limit=20` is slow and what index you'd add. Walk them through the EXPLAIN (ANALYZE, BUFFERS) output before and after, including what each scan node means, why column order matters, and what the index costs.",
    rubric: [
      'Explains what the baseline plan is doing in plain language (whole-table scan, filter, sort) rather than just naming nodes',
      'Uses evidence: estimated vs actual rows, buffers and timings, and multiplies by loops where relevant',
      'Justifies the composite column order (equality first, then sort column) and explains why the Sort node disappears and LIMIT stops early',
      'Mentions when an index would NOT be used (selectivity, functions on columns, stale stats) without being asked',
      'States the write and storage cost of the index and when to use CREATE INDEX CONCURRENTLY',
      'Is concise and teaches rather than lectures: a teammate could apply it to the next query on their own',
    ],
    referenceExplanation:
      "Here's the plan for the endpoint before any change. Read it from the bottom up. The innermost node is a Parallel Seq Scan on check_ins: three processes read all ~7,000 pages of the table and discarded about a million rows to find the ~2,000 check-ins for this café. 'Actual rows' is per loop, so rows=669 with loops=3 is about 2,000 matches. A Sort then keeps the newest 20 and Limit returns them. Total work: ~7,300 buffers to return 20 rows, and it grows with the table, not with the page we show. The query shape is 'one café, newest first, take 20', so the index should match that shape: `(cafe_id, created_at DESC)`. The equality column goes first, so Postgres jumps straight to this café's entries, and within them the entries are already in the order we want. In the new plan the Sort node is gone and the Index Scan feeds Limit directly, which stops after 20 rows: about 24 buffers and well under a millisecond. If we add `INCLUDE (user_id)` and only select those columns, it becomes an Index Only Scan with Heap Fetches: 0, so it never touches the table. Putting `created_at` first would be wrong: we'd walk every café's check-ins by time and filter. Two cautions. Indexes aren't free: every check-in insert now updates this index too. I measured roughly how much slower bulk inserts got, and the index is tens of MB, which I think is fine for our most-viewed page. Create it with `CREATE INDEX CONCURRENTLY` so we don't block check-in writes during the build. And if you ever see the estimated rows far from the actual rows, check statistics before adding more indexes.",
    stretch: {
      title: 'Join planning: top-rated open cafés with review counts',
      description:
        "Write `SELECT c.id, c.name, count(r.*) FROM cafes c JOIN reviews r ON r.cafe_id = c.id WHERE c.city = 'Bristol' AND c.is_open GROUP BY c.id ORDER BY count(r.*) DESC LIMIT 10;`. Explain it with and without an index on `reviews (cafe_id)`. Identify the join method (Nested Loop, Hash Join or Merge Join), read the `loops` count on the inner side, and explain in a paragraph why the planner's choice changed. Bonus: create extended statistics (`CREATE STATISTICS ... (dependencies) ON city, is_open FROM cafes`) and check whether estimates move.",
    },
    lightTask:
      "Busy week? Start Postgres in Docker, run seed.sql, then do just Q1. Capture `EXPLAIN (ANALYZE, BUFFERS)` with no index, with `(cafe_id)`, and with `(cafe_id, created_at DESC)`. For each, write down the top scan node, buffers and execution time, plus two sentences on why the Sort node disappears with the composite index.",
    intensiveExtras: [
      'Run Q1 and Q4 with `SET max_parallel_workers_per_gather = 0` and then with parallelism back on, and explain the Gather / Gather Merge nodes and how loops changes the numbers.',
      "Add a `LIKE 'Oat%'` and an `ILIKE '%lab%'` search on cafés. Find out why a plain B-tree may not serve the prefix search under your database's collation (look up `text_pattern_ops` in the docs), and note what kind of index (e.g. trigram via pg_trgm) a contains-search would need.",
      "Simulate the production rule: build an index with `CREATE INDEX CONCURRENTLY` while a second psql session runs a loop of inserts, and observe that writes are not blocked. Then cancel a concurrent build halfway and find the INVALID index with `\\d`.",
      'Use `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on Q1 and paste the result into a plan visualiser of your choice to compare with reading the text format by hand.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['databases', 'backend-services', 'production-reliability'],
    depth: 'detailed',
  },
  {
    week: 2,
    slug: 'react-rendering-profiling',
    title: 'React rendering and performance profiling',
    track: 'frontend',
    topics: [
      'render vs commit',
      're-render triggers',
      'reconciliation',
      'keys',
      'referential equality',
      'memo',
      'useMemo',
      'useCallback',
      'moving state down',
      'children as props',
      'context splitting',
      'React DevTools Profiler',
      'useDeferredValue',
      'React Compiler',
    ],
    objective:
      'By the end you can predict which components re-render and why, profile a slow React screen with the DevTools Profiler, and fix it in the right order (structure first, memoisation second), with before/after numbers to prove it.',
    whyItMatters:
      "Product UIs get slow in predictable ways: a search box that lags on every keystroke, a list that re-renders entirely when one item changes, a map or carousel that repaints for no reason. On mid-range phones and low-power devices such as TVs and set-top boxes, these wasted renders become visible jank. Engineers who sprinkle `useMemo` everywhere add complexity and often fix nothing. Engineers who can profile, name the cause, and fix structure first ship faster UIs and simpler code, and they can explain why in a review or an interview.",
    explanation: [
      "React's work happens in two phases. In the **render phase**, React calls your component functions to work out what the UI should look like. That is just JavaScript producing a tree of elements, and no DOM is touched. In the **commit phase**, React compares that result with the previous one and applies only the differences to the DOM, then runs layout effects and effects. The browser then does its own work (style, layout, paint). The key consequence: **a render is not a DOM update**. A component can re-render 50 times and produce identical output, costing JavaScript time but zero DOM writes. Performance problems come either from too much render work (too many components, or expensive ones) or from too much commit and browser work (large DOM changes). The Profiler shows you which.",
      "Only a few things cause a component to render. (1) **Its own state changes**: `setState` or a reducer dispatch with a value that isn't `Object.is`-equal to the current one. This includes state inside custom hooks it uses. (2) **Its parent renders**: by default React re-renders **all** children of a rendering component, whether or not their props changed. (3) **A context it reads changes value**: every component that calls `useContext(SomeContext)` re-renders when the Provider's `value` is a different value. A common misconception is that 'props changed' is a trigger. It isn't. Props only change because a parent rendered, and the parent rendering is what re-renders the child. Once this clicks, most mysteries go away: a keystroke in a search box at the top of the app re-renders everything below it, simply because of where the state lives.",
      "**Reconciliation** is how React matches the new element tree against the old one. At each position it compares the element **type**. Same type means update the existing instance and keep its state; a different type means unmount the old subtree (losing its state and DOM) and mount a new one. For lists, React uses the **key** to match children between renders. State and DOM nodes belong to a (type, key) position, not to your data. With `key={index}`, reordering, filtering or inserting makes React pair the wrong data with the wrong instance: an open note box or a typed comment jumps to a different café, inputs keep stale text, and more rows update than necessary. Use a stable ID from the data. The flip side is a useful trick: changing a key on purpose (`<ReviewForm key={cafe.id} />`) resets a component's state cleanly.",
      "**Referential equality** is the hinge for every optimisation tool. React compares dependencies, memoised props and context values with `Object.is`. Primitives compare by value, but objects, arrays and functions compare by identity, and `{}` written in a render body is a **new object every render**. So `style={{ padding: 8 }}`, `onClick={() => select(id)}`, `items={list.filter(...)}` and `value={{ user, setUser }}` all produce new identities each time the parent renders. That is harmless for ordinary components, which re-render anyway. But it silently defeats `memo`, re-triggers `useEffect`s whose deps include them, invalidates `useMemo` caches, and makes every context consumer re-render.",
      "`memo(Component)` lets React skip re-rendering a component when its parent renders, **if** every prop is `Object.is`-equal to last time. `useMemo(fn, deps)` caches a computed value between renders. `useCallback(fn, deps)` caches a function's identity, which is the same as `useMemo(() => fn, deps)`. They're worth it when three things are true: the component re-renders often, it usually receives the same props when it does, and its render (or the computation) is measurably expensive. They're **not** worth it for cheap components, for props that change every time anyway, or for wrapping every handler 'just in case'. Each one adds comparison work, memory, dependency arrays you must keep correct, and fragility: one unstable prop added by someone later and the `memo` does nothing, silently. `useCallback` on a handler passed to a plain DOM element (`<button onClick>`) buys nothing at all.",
      "Before reaching for memoisation, fix the **structure**. **Move state down**: if only the search box and results need `query`, put `query` in a `CafeSearch` component rather than in `App`. Then typing re-renders only that subtree, and the map next to it isn't involved. **Lift content up** (children as props): when a component must own fast-changing state, like a resizable panel or a scroll-position wrapper, have it accept `children`. The parent created those child elements, so when the wrapper's state changes, React sees the same element objects and skips them. These two moves often remove more wasted renders than any amount of `memo`, and they make the code simpler, not more complex.",
      "**Context** is a broadcast. When a Provider's `value` changes by `Object.is`, **every** consumer re-renders, and `memo` does not stop it, because context bypasses props. The classic bug is `<Ctx.Provider value={{ favourites, toggleFavourite, selectedId, setSelectedId }}>`: a new object on every Provider render, so every consumer re-renders on every render of the Provider's owner. Fixes, in order: memoise the value (`useMemo` with real deps); **split** state from actions, since setters from `useState` and `dispatch` are stable, so an actions-only context never changes; and split by **update frequency**, so selection, favourites and theme don't share one value. For very high-frequency shared state, an external store read with `useSyncExternalStore` and a selector lets each component subscribe to just its slice. That is the idea behind libraries like Zustand and Redux.",
      "Some work is simply expensive per input, like a fuzzy search over 3,000 cafés on every keystroke. `useMemo` only helps when the inputs **haven't** changed, for example when a pin is selected and the query is the same. It does nothing for a new keystroke, which is a new input. For that, reduce the work itself: precompute normalised search text **once** when the data loads instead of on every call, use a cheaper algorithm, or cap the results. Then keep the input responsive: `useDeferredValue(query)` (React 18+) lets React render the input with the new text immediately and the expensive list with a slightly older value, abandoning stale renders when you keep typing. Debouncing is a different trade-off: it delays all work by a fixed time, which also delays results on fast devices.",
      "**Profile before and after every change.** With the React DevTools browser extension, enable 'Highlight updates when components render' (in the Components tab settings) to see renders flash as you interact. In the Profiler tab, open settings and enable 'Record why each component rendered while profiling', then record a short interaction (e.g. type 8 characters). The bar chart at the top has one bar per **commit**. The **flamegraph** shows the tree for the selected commit: bar width is render time including children, grey or striped means it did not render, and hovering shows **why it rendered** (props changed and which ones, hooks changed, parent rendered, context changed). The **ranked** view sorts components by their own render time. Development builds are slower than production, so treat dev numbers as **relative**: compare before and after on the same machine. Use Chrome DevTools' Performance panel with CPU throttling (4x or 6x) to approximate a mid-range phone or a TV-class device and to see layout and paint as well as JavaScript. The `<Profiler onRender>` API lets you log numbers programmatically, which the exercise uses to fill a measurement table.",
      "**React Compiler** is an optional, newer build-time tool from the React team that analyses your components and inserts memoisation automatically, roughly the `memo`, `useMemo` and `useCallback` you'd otherwise write by hand. It can reduce the referential-equality busywork described above, but it relies on your code following the Rules of React (pure renders, no mutation of props or state). It won't fix index keys, an algorithm that's too slow, a context design that broadcasts too widely, or state that lives too high in the tree, and you still need to read a profile to know what's slow. Check react.dev for its current status and setup before adopting it. Whatever the tool, the workflow stays the same: **measure, form a hypothesis, change one thing, measure again**, and keep the numbers.",
    ],
    examples: [
      { language: 'tsx', title: 'Referential equality: why memo() silently did nothing', code: W2_EX_REFEQ },
      { language: 'tsx', title: 'Move state down and lift content up (children as props)', code: W2_EX_STATE_DOWN },
      { language: 'tsx', title: 'Splitting context into state and stable actions', code: W2_EX_CONTEXT },
      { language: 'tsx', title: 'Keys: why index keys move state to the wrong row', code: W2_EX_KEYS },
    ],
    keyTakeaways: [
      'Render (calling components) is not commit (DOM changes); wasted renders cost JavaScript time even when the DOM does not change.',
      'Re-render triggers: own state, parent render, consumed context. "Props changed" is a consequence of a parent render, not a trigger.',
      'Keys identify instances. Use stable data IDs, never indexes for lists that reorder, filter or insert.',
      "Inline objects and functions are new every render; that's harmless until something compares them (memo, deps, context value).",
      'Fix structure first: move state down, pass children as props, split context by update frequency and separate stable actions.',
      'Memoise only measured, expensive, frequently re-rendered work; useMemo cannot speed up a computation whose input changed.',
      'Always measure before and after with the Profiler on the same machine and throttle, and record the numbers.',
    ],
    prerequisites: [
      'Comfortable building React function components with useState, useEffect and props',
      'Node.js 18+ and npm installed',
      'Chrome, Edge or Firefox with the React Developer Tools extension',
    ],
    prerequisiteWeeks: [],
    resources: [
      {
        title: 'react.dev: Render and Commit',
        url: 'https://react.dev/learn/render-and-commit',
        kind: 'docs',
        note: 'Read the whole page: the trigger, render and commit steps, and why rendering does not imply DOM changes.',
        minutes: 8,
      },
      {
        title: 'react.dev: Preserving and Resetting State',
        url: 'https://react.dev/learn/preserving-and-resetting-state',
        kind: 'docs',
        note: 'Read the sections on state being tied to a position in the tree and on resetting state with a key. This is the foundation for the index-key bug.',
        minutes: 8,
      },
      {
        title: 'react.dev: memo',
        url: 'https://react.dev/reference/react/memo',
        kind: 'docs',
        note: "Read 'Skipping re-rendering when props are unchanged', the section on minimising props changes, and the note on whether you should add memo everywhere.",
        minutes: 7,
      },
      {
        title: 'react.dev: useMemo',
        url: 'https://react.dev/reference/react/useMemo',
        kind: 'docs',
        note: "Read 'Skipping expensive recalculations' and how to tell if a calculation is expensive; skim the troubleshooting section.",
        minutes: 5,
      },
      {
        title: 'react.dev: <Profiler>',
        url: 'https://react.dev/reference/react/Profiler',
        kind: 'docs',
        note: 'Read the onRender parameters (actualDuration vs baseDuration). The exercise uses this API to record numbers.',
        minutes: 4,
      },
      {
        title: 'Before You memo() (Dan Abramov, overreacted.io)',
        url: 'https://overreacted.io/before-you-memo/',
        kind: 'article',
        note: "Short post showing 'move state down' and 'lift content up' with tiny examples. Read it before step 6 of the exercise.",
        minutes: 6,
        verify: true,
      },
    ],
    exercise: {
      title: 'Profile and fix a sluggish NearBrew café search',
      scenario:
        "NearBrew's web companion has a café discovery screen: a search box, a list of up to 200 results with Save and Note buttons, and a 'map' panel with 3,000 pins. Users report that typing lags, especially on older laptops, and QA found a bug where the note you opened 'jumps' to another café after you save it. The starter code below reproduces both problems with four deliberate mistakes. You'll measure first, fix one cause at a time, and record numbers after each fix.",
      setup: [
        'Scaffold: `npm create vite@latest nearbrew-perf -- --template react-ts`, then `cd nearbrew-perf && npm install`.',
        'Delete `src/App.css` and the contents of `src/index.css` (keep the file), and remove the `import \'./App.css\'` line if present.',
        'Create the files below in `src/` exactly as given: `data.ts`, `search.ts`, `perf.ts`, `AppContext.tsx`, `Header.tsx`, `CafeList.tsx`, `MapPanel.tsx`, and replace `App.tsx`.',
        "Add `import './perf';` as the first line of `src/main.tsx` (so `perfReport()` and `perfReset()` exist in the console). Leave the rest of main.tsx as generated.",
        'Run `npm run dev`, open the URL Vite prints, and install or enable the React Developer Tools browser extension. Initialise git (`git init && git add -A && git commit -m baseline`) so you can diff each fix.',
      ],
      steps: [
        "Reproduce the correctness bug (5 min). Clear the search box. Click 'Note' on the 3rd café and type something in the note. Now click 'Save' on that same café. It jumps to the top of the list (favourites float up), but the open note box, with your text, stays in the 3rd position, now attached to a different café. Write down what you see. You'll explain it in step 8.",
        "See wasted renders (5 min). In the React DevTools Components tab, open settings (the gear) and enable 'Highlight updates when components render'. Type a few characters in the search box: the whole page flashes, including the 3,000-dot map, which has nothing to do with the query. Click a map pin and watch the Header flash even though the saved count didn't change. Turn highlighting off before measuring, because it adds overhead.",
        "Baseline numbers (10 min). In Chrome DevTools, open the Performance panel's settings and set CPU throttling to 4x (keep this fixed for every measurement). In React DevTools' Profiler settings, enable 'Record why each component rendered while profiling'. In the console run `perfReset()`. Start a Profiler recording, type `oat milk` at a steady pace, stop recording, and run `perfReport()`. Fill the 'Baseline' column of measurements.md: MapPanel commits and total ms, CafeList total ms, and the slowest commit from the Profiler's commit bar chart. Click a few CafeRow bars in the flamegraph and read 'Why did this render?'. Note that CafeRow says props changed (`onToggleFavourite`, `onSelect`, `style`) even though it's wrapped in `memo`.",
        "Measure the search cost by itself (5 min). Temporarily wrap the search call in App: `const t0 = performance.now(); const results = searchCafes(CAFES, query, favourites); console.log('search ms', (performance.now() - t0).toFixed(1));`. Type a few characters, then click a map pin. The search reruns on the pin click too, even though the query didn't change. Record ms per call. If it's under ~2 ms with 4x throttling, raise `WORK_FACTOR` in search.ts to 2 or 3 so the effect is visible, and keep that value for all measurements.",
        "Fix 1: reduce the expensive work (8 min). In search.ts, precompute a search index once at module load: for each café, the normalised lowercase words of its name, neighbourhood and tags (e.g. `const INDEX = CAFES.map((cafe) => ({ cafe, words: [...] }))`), and make scoring use those instead of re-normalising per call. Then, in App, wrap the call in `useMemo(() => searchCafes(CAFES, query, favourites), [query, favourites])` so selecting a pin no longer reruns it. Re-measure: ms per keystroke should drop (precomputation), and pin clicks should log no search at all (useMemo). Commit with message 'fix 1'. Note in your table that useMemo did nothing for keystrokes. Why?",
        "Fix 2: move state down (10 min). Create `src/CafeSearch.tsx` and move `query`, the input, the results count, the search `useMemo` and `<CafeList>` (with its Profiler) out of App into it. App now renders `<Header />`, `<CafeSearch />` and the MapPanel Profiler, and still owns favourites and selection for now. CafeSearch reads `favourites` from context for the sort. Re-run the 'oat milk' measurement: MapPanel should record **zero** commits while typing, because App no longer re-renders on keystrokes. Record the numbers and commit 'fix 2'.",
        "Fix 3: split and stabilise context (10 min). Replace AppContext with two providers following example 3: `FavouritesProvider` (a favourites Set plus a stable `toggle` in a separate actions context) and `SelectionProvider` (selectedId plus a stable `select`). Wrap the app in both inside main.tsx or App, passing children. Update Header to read only `useFavourites()`, MapPanel to read favourites and selection, and CafeList and CafeSearch to read what they need. Re-measure scenario C (click 5 pins): Header should no longer render on pin clicks. Use the Profiler's 'why did this render' to confirm the remaining renders all have a real reason. Commit 'fix 3'.",
        "Fix 4: stable keys and stable props so memo can work (8 min). In CafeList, use `key={cafe.id}`. Hoist the row style to a module-level `const rowStyle`. Change CafeRow's props to `onToggleFavourite: (id: string) => void` and `onSelect: (id: string) => void`, pass the stable `toggle` and `select` from context directly, and have the row call them with `cafe.id`. Now redo step 1: the note box stays with its café when it moves to the top. Measure scenario B (save 5 cafés): with stable props, only the rows whose `isFavourite` changed (plus any whose position changed) should render, and the rest should show as grey in the flamegraph. Commit 'fix 4'.",
        "Optional responsiveness pass (5 min). With 6x throttling, type quickly. If the input still feels sticky, try `const deferredQuery = useDeferredValue(query)` in CafeSearch and pass `deferredQuery` to the search `useMemo`. The input should update immediately while results catch up. Optionally wrap CafeList in `memo` so it can skip rendering while `deferredQuery` hasn't changed. Record how it feels and the slowest-commit number. Note that this doesn't make the search cheaper, only better scheduled.",
        "Write up (5 min). Complete measurements.md with every column filled in, compute the percentage change for MapPanel total ms and slowest commit between baseline and final, and write the 3-sentence summary: the biggest win, the surprise, and one place you deliberately did **not** add memo and why (e.g. Header is cheap, and MapPanel's dots legitimately change on selection). Keep the git history: `git log --oneline` should read baseline, fix 1, fix 2, fix 3, fix 4.",
      ],
      starter: [
        { language: 'ts', title: 'src/data.ts', code: W2_DATA_TS },
        { language: 'ts', title: 'src/search.ts (deliberately slow)', code: W2_SEARCH_TS },
        { language: 'ts', title: 'src/perf.ts (Profiler sample collector)', code: W2_PERF_TS },
        { language: 'tsx', title: 'src/AppContext.tsx (one context for everything)', code: W2_CONTEXT_TSX },
        { language: 'tsx', title: 'src/App.tsx (state too high, unmemoised value, search every render)', code: W2_APP_TSX },
        { language: 'tsx', title: 'src/Header.tsx', code: W2_HEADER_TSX },
        { language: 'tsx', title: 'src/CafeList.tsx (index keys, inline props defeat memo)', code: W2_LIST_TSX },
        { language: 'tsx', title: 'src/MapPanel.tsx (3,000 pins)', code: W2_MAP_TSX },
        { language: 'text', title: 'measurements.md template', code: W2_MEASURE_TEMPLATE },
      ],
      expected: [
        'Baseline: every keystroke commits the whole tree. MapPanel renders once per keystroke, and the Profiler shows CafeRow rendering despite memo, with props changed: onToggleFavourite, onSelect, style.',
        'After fix 1: search ms per keystroke drops noticeably, and clicking a pin no longer runs the search at all.',
        'After fix 2: MapPanel records 0 commits while typing; the slowest commit during typing shrinks to roughly the cost of the search plus the list.',
        'After fix 3: clicking a map pin no longer renders Header; components that only use actions never re-render from state changes.',
        'After fix 4: the note box stays attached to its café when it moves, and saving one café renders a handful of rows instead of all of them.',
        'Your measurements table shows a large reduction (often well over 50%) in MapPanel time during typing and in the slowest commit. Exact numbers depend on your machine.',
      ],
      hints: [
        "If the Profiler shows each component rendering twice, or timings look doubled, it's React StrictMode's development double-render. Keep StrictMode the same (on or off) for every measurement so the comparison is fair.",
        "If memo still isn't skipping CafeRow after fix 4, check the 'why did this render' panel. The prop it names is the unstable one, often a callback still created inline or the `cafe` object being recreated by a `.map` in the search.",
        'For fix 2, the map must not depend on `query`. If you want the map to highlight only matching cafés, that\'s a legitimate dependency, and a good stretch question about where state should then live.',
        'Setter functions from useState are stable across renders, so an actions object built only from setters can be memoised with an empty dependency array.',
      ],
      verification: [
        'measurements.md has numbers in every column for scenarios A, B and C, recorded with the same CPU throttle.',
        "With 'Highlight updates' on, typing in the search box flashes only the search input, count and list, never the map or Header.",
        'The note-box bug from step 1 no longer reproduces, and you can explain it in terms of keys and component identity.',
        "Every remaining `useMemo`, `useCallback` or `memo` in your code has a one-line comment saying what it prevents. You can name at least one place where you chose not to memoise.",
        '`npm run build` succeeds with no TypeScript errors.',
      ],
    },
    successChecklist: [
      'Reproduced and explained the index-key note bug, then fixed it with stable keys',
      'Recorded baseline Profiler numbers (commits, total ms, slowest commit) before changing any code',
      'Eliminated MapPanel renders during typing by moving state down, without using memo',
      'Split the context into state and stable actions and verified with "why did this render"',
      'Made memo on CafeRow effective by stabilising props, and confirmed grey (skipped) rows in the flamegraph',
      'Wrote a before/after table and a short summary, including where you deliberately did not memoise',
    ],
    questions: [
      {
        question:
          'A component wrapped in `memo` still re-renders every time its parent renders. List the likely causes and how you would confirm which one it is.',
        answer:
          "memo only skips a render when every prop is `Object.is`-equal to the previous render, and it does nothing for the component's own state or for context. Likely causes: an inline object, array or function prop (`style={{...}}`, `onClick={() => ...}`, `items={list.filter(...)}`) created fresh each render; a prop derived from data that's rebuilt each render (e.g. mapped search results creating new objects); `children` passed as JSX, which is a new element every time; or the component reading a context whose value changes. To confirm, enable 'Record why each component rendered' in the React DevTools Profiler, record the interaction, and select the component in the flamegraph. It names the changed props, hooks or context. Then stabilise that specific value (hoist constants, `useCallback` or `useMemo` with correct deps, pass IDs instead of closures), or decide memo isn't worth it.",
      },
      {
        question:
          "Why doesn't `useMemo` make a search-as-you-type list faster per keystroke, and what would you do instead?",
        answer:
          "useMemo caches the result for a given set of dependencies. On each keystroke the `query` dependency changes, so the cache misses and the full computation runs anyway, with a little extra overhead for the dependency check. It only helps when the component re-renders for other reasons while the query is unchanged, such as selecting a map pin or toggling a theme. To make each keystroke cheaper, reduce the work itself: precompute normalised search text once when data loads, use a cheaper matching algorithm, cap or paginate results, and render fewer rows (virtualisation for long lists). To keep typing responsive while the expensive part catches up, use `useDeferredValue` (or `startTransition`) so React prioritises the input update and can abandon outdated list renders. Debouncing is an alternative, but it adds fixed latency on fast devices too.",
      },
      {
        question:
          'A teammate puts `{ user, theme, cart, setUser, setTheme, addToCart }` in a single context value created inline in `App`. What problems does this cause, and how would you restructure it?',
        answer:
          "Because the value is a new object every time App renders, every consumer of the context re-renders on every App render, even components that only need `setTheme`. Since all the state is bundled, a cart change re-renders theme-only consumers, and memo can't help because context bypasses props. Restructure by splitting along update frequency and concern: separate contexts (or providers) for user, theme and cart. Within each, separate the state from the actions, because setters and dispatch functions are stable, so an actions context built with `useMemo(..., [])` never changes and its consumers never re-render from state changes. Memoise each state value with `useMemo` if it's an object. Make each provider take `children` so its own state changes don't re-render the tree it wraps. If one slice is very high-frequency, consider an external store with selector subscriptions (`useSyncExternalStore`) so components subscribe only to what they read.",
      },
    ],
    explainPrompt:
      "Explain to an interviewer for a product UI role how you diagnosed and fixed the slow NearBrew search screen. Cover what causes a React component to re-render, what the Profiler showed you, the order in which you applied fixes and why, and the before/after numbers. Include one place where you chose not to memoise.",
    rubric: [
      'Correctly states the three re-render triggers and distinguishes render from commit',
      'Describes the diagnosis with evidence from the Profiler (commit counts, flamegraph, "why did this render") rather than guesses',
      'Explains structural fixes (moving state down, children as props, context splitting) before memoisation, and why that order',
      'Explains the index-key bug in terms of component identity and state, not just "use IDs"',
      'Quotes concrete before/after numbers and acknowledges dev-mode and throttling caveats',
      'Shows judgment about when NOT to memoise (cost, fragility, cheap components) and mentions tools like React Compiler without overclaiming',
    ],
    referenceExplanation:
      "The screen had a search box, a 200-row results list and a 3,000-pin map, and typing felt laggy. I measured first: React DevTools Profiler with 'why did this render' on, Chrome at 4x CPU throttle, typing 'oat milk'. Every keystroke committed the entire tree, the map rendered on all eight keystrokes, and the slowest commit was about 60 ms in my run. Rows wrapped in memo still rendered because their props changed: inline callbacks and an inline style object. A component renders when its own state changes, when its parent renders, or when a context it reads changes. The query state lived in App, so every keystroke re-rendered everything. I fixed causes in order of leverage. First, the search was doing unnecessary work, re-normalising strings on every call, so I precomputed that once, which made each keystroke cheaper. useMemo only stopped it rerunning on unrelated renders like pin clicks. Second, I moved the query state into a CafeSearch component, and the map dropped to zero renders while typing with no memo at all. Third, the single context value was a new object every render, so I split it into favourites, selection and stable action contexts, and the header stopped rendering on pin clicks. Finally, I switched to stable keys and stable props. That made memo on rows actually work, and it fixed a real bug: index keys meant an open note box stayed at its old position when a saved café moved to the top. Overall the map's render time while typing went to zero and the slowest commit fell from about 60 ms to under 25 ms, measured on the same throttled dev build. I didn't memoise the Header because it's trivially cheap. Tools like React Compiler can automate some memoisation, but they wouldn't have fixed the keys, the algorithm or the state placement.",
    stretch: {
      title: 'Make the map show only matching cafés without regressing typing performance',
      description:
        "Product now wants the map to dim cafés that don't match the search. That makes `query` (or the result IDs) a real dependency of the map. Design it so typing stays fast: options include lifting a deferred result-ID Set to a shared parent, memoising individual `Pin` components keyed by id so only pins whose matched state flips re-render, or drawing the pins on a single `<canvas>` outside React's tree. Implement one, measure it with the same table, and write a paragraph comparing it with one alternative you didn't choose.",
    },
    lightTask:
      "Busy week? Set up the starter app, then do only two things. First, record a Profiler session while typing 'oat milk' and note the MapPanel commit count. Second, apply fix 2 (move the query state into a CafeSearch component) and record again. Write three sentences explaining why MapPanel stopped rendering without any memo, using the phrase 'parent render'.",
    intensiveExtras: [
      'Record the same "oat milk" scenario in the Chrome Performance panel at 6x throttling before and after your fixes. Identify the scripting vs rendering vs painting time and the longest task in each.',
      'Replace the 200-row cap with all results and see how far the list scales before typing degrades. Note the numbers; this sets up virtualisation in a later week.',
      'Write a small Vitest + React Testing Library test that counts renders of CafeRow (via a render counter or Profiler) when one café is saved, and fails if more than a handful re-render. This guards against regressions.',
      "Rebuild the context layer as an external store with `useSyncExternalStore` and a `useFavourite(id)` selector hook so each row subscribes to its own boolean. Compare the code size and render counts with the split-context version.",
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['rendering-performance', 'react-architecture', 'consumer-ui'],
    depth: 'detailed',
  },
];
