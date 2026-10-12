import type { Lesson } from '../types';

/**
 * Weeks 3–4 (Q1 Foundations, detailed): REST API design and pagination; caching.
 * Starter code in these lessons was run end-to-end with Node 22 + `npx tsx` before publishing.
 */
export const weeks03to04: Lesson[] = [
  // ---------------------------------------------------------------------------
  // Week 3
  // ---------------------------------------------------------------------------
  {
    week: 3,
    slug: 'rest-api-design-pagination',
    title: 'REST API design and pagination',
    track: 'backend',
    secondaryTracks: ['system-design'],
    topics: [
      'REST resource modelling',
      'HTTP methods',
      'HTTP status codes',
      'idempotency',
      'Idempotency-Key',
      'RFC 9457 Problem Details',
      'filtering and sorting',
      'offset pagination',
      'keyset pagination',
      'cursor pagination',
      'Link header',
    ],
    objective:
      "By the end you can design a list endpoint with predictable methods, status codes and errors, explain exactly why offset pagination skips and duplicates rows, and implement opaque keyset cursors backed by a matching composite index.",
    whyItMatters:
      "List endpoints are where most API pain lives: the NearBrew reviews feed, a booking dashboard, an invoice history. Offset pagination looks fine in development and then shows users the same review twice, silently drops rows, and gets slower with every page as tables grow. Retries on non-idempotent POSTs create double bookings and double charges. Inconsistent error shapes force every client to write special-case parsing. These are design decisions that are cheap on day one and expensive to change once mobile apps in the wild depend on them, so a senior engineer is expected to get them right up front and to explain the trade-offs.",
    explanation: [
      "Start with resources, not screens. A resource is a noun the business cares about and that has a stable identity: `cafes`, `reviews`, `check-ins`, `favourites`, `bookings`. URLs name resources and their relationships (`/v1/cafes/{cafeId}/reviews`, `/v1/me/favourites`), and HTTP methods say what you are doing to them. A useful test: if the URL contains a verb (`/getNearbyCafes`, `/createBooking`), you have probably modelled an action as a resource. Nest at most one level (`/cafes/{id}/reviews` is fine; `/cafes/{id}/reviews/{id}/photos/{id}/likes` usually means the child deserves its own top-level collection). When something genuinely is a process rather than a thing, model the process as a resource: `POST /v1/bookings/{id}/cancellation` reads better and evolves better than `POST /cancelBooking`.",
      "Methods carry promises that clients, proxies and retry libraries rely on. `GET` is **safe** (no side effects the client is responsible for) and therefore cacheable and retryable. `PUT` replaces the resource at a known URL and `DELETE` removes it; both are **idempotent**, meaning that sending the same request once or ten times leaves the server in the same state. `PATCH` partially updates and is not guaranteed idempotent (a JSON Patch `add` to an array is not). `POST` creates a subordinate resource or triggers processing and is neither safe nor idempotent. Idempotency is about state, not responses: a second `DELETE /reviews/rev_1` may return `204` or `404` depending on your contract, but either way the review is gone exactly once. Pick one behaviour and document it; returning `204` for an already-deleted resource makes client retries simpler.",
      "Status codes are part of the contract, and a small, consistent set beats a creative one. `200` for a successful read or update with a body, `201 Created` plus a `Location` header for a create, `204 No Content` for a successful delete, `400` when the request is malformed (bad JSON, `limit=abc`), `401` when the caller is not authenticated, `403` when they are authenticated but not allowed, `404` when the resource does not exist (or the caller must not learn that it exists), `409 Conflict` when the request is valid but clashes with current state (the seat is already booked), `422` when the payload parses but fails validation, `429` when rate limited, and `5xx` only for server faults. The `4xx` versus `5xx` split matters operationally: `5xx` should page someone and is usually retryable, `4xx` is the client's problem and retrying the same request will not help.",
      "Every error should have the same shape so clients can write one handler. [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) standardises this: respond with `Content-Type: application/problem+json` and a body containing `type` (a URI identifying the problem kind, stable and documentable), `title` (short human summary), `status` (the HTTP status), `detail` (this occurrence), optionally `instance`, plus any extension members you need, such as an `errors` array with field-level validation messages. The `type` is the thing clients branch on (`.../problems/slot-already-booked` shows a 'pick another time' sheet), never the English `title`. Do not leak stack traces or SQL in `detail`; log those server-side with a request id and return the id instead.",
      "Filtering and sorting belong in query parameters, and they must be allow-listed. `GET /v1/cafes/{id}/reviews?rating_gte=4&sort=-created_at&limit=20` is readable and cacheable. Never pass a client-supplied sort field straight into SQL: map `sort=-created_at` to a known `ORDER BY created_at DESC, id DESC` from a fixed table of options, and reject anything else with a `400` problem. Each sort option you offer is a promise that you have an index for it (week 1), so offer few. For NearBrew, 'newest' and 'highest rated' are plenty; 'sort by any column' is how you end up with sequential scans on a hot table.",
      "Offset pagination (`LIMIT 20 OFFSET 40`) is simple and supports 'jump to page 7', but it has two structural problems. First, cost: the database cannot jump to row 100,000; it has to produce and throw away the first 100,000 rows in order, so page N costs O(N + limit) and deep pages get linearly slower (the PostgreSQL docs on LIMIT and OFFSET say this explicitly). Second, correctness under writes: an offset is a position in a list that keeps moving. If two new reviews arrive while a user reads page 1, every row shifts down two places and page 2 begins with the last two rows they already saw (duplicates). If a review on page 1 is deleted, every row shifts up one and a row that should have started page 2 is never shown (a skip). On a busy café's feed or an infinite-scroll list, both happen constantly.",
      "Keyset pagination (also called seek or cursor pagination) asks for 'the next 20 rows after the last one I saw' instead of 'rows 41 to 60'. If the list is ordered by `created_at DESC, id DESC`, the next page is `WHERE (created_at, id) < ($lastCreatedAt, $lastId) ORDER BY created_at DESC, id DESC LIMIT 20`. With a composite index on the same columns (the week 1 pattern: equality filters first, then the sort columns), the database seeks directly to the key and reads only 20 index entries no matter how deep the page is. Inserts above the cursor and deletes of already-seen rows cannot shift the window, because the window is anchored to a value, not a position. The cost is that you lose 'jump to page 7' and exact page numbers, which feeds, timelines and mobile lists rarely need.",
      "The ordering must be **total**: no two rows may compare equal, or the cursor is ambiguous. `created_at` alone is not unique (bulk imports, coarse timestamps, two reviews in the same millisecond), and if 3 reviews share the boundary timestamp and the page ended after the first of them, `created_at < $last` silently skips the other two. Always append a unique tie-breaker, usually the primary key, to both the `ORDER BY` and the cursor comparison, in the same direction. PostgreSQL row-value comparison `(created_at, id) < ($1, $2)` expresses this compactly and can be used as an index condition; in databases without row values, expand it to `created_at < $1 OR (created_at = $1 AND id < $2)`.",
      "Make cursors **opaque**. Encode the sort key of the last row (for example base64url of `{\"v\":1,\"c\":\"2025-01-01T08:14:00Z\",\"i\":\"rev_0043\"}`) and tell clients that the format is private: they store it and send it back, nothing else. Opacity lets you change the sort key, add a version, or bind the cursor to its filters later without breaking apps already in the App Store. Treat a cursor as untrusted input: decode defensively, validate types, and on failure return a `400` problem telling the client to restart from page one; never `500`. If cursor tampering matters (it can reveal ids or let users probe), sign it with an HMAC. A cursor should also be rejected if it was minted for a different sort or filter, which is easy if you include a short hash of the query in it.",
      "Finish the contract with limits and navigation. Give `limit` a default (20) and a hard maximum (50 or 100) and clamp or reject larger values, otherwise one client asking for `limit=100000` becomes your next incident. Return the next cursor in the body (`page.nextCursor`, `null` on the last page) so mobile clients can read it easily, and optionally also in an [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) `Link: <...>; rel=\"next\"` header for generic clients. Fetch `limit + 1` rows to know whether a next page exists without a separate `COUNT(*)`, which is itself expensive on large tables; if product needs a total, show an approximate or cached count. Finally, make retries safe for writes: a mobile client on a train will time out and resend `POST /v1/bookings`. With an `Idempotency-Key` header (a client-generated UUID per user intent), the server stores the first response under that key and replays it for retries, so one tap creates exactly one booking (see the booking example).",
    ],
    examples: [
      {
        language: 'http',
        title: 'The contract: a keyset page, the next link, and a Problem Details error',
        code: `GET /v1/cafes/cafe_42/reviews?limit=3 HTTP/1.1
Host: api.nearbrew.example
Accept: application/json

HTTP/1.1 200 OK
Content-Type: application/json
Link: <https://api.nearbrew.example/v1/cafes/cafe_42/reviews?limit=3&cursor=eyJ2IjoxLCJjIjoiMjAyNS0wMS0wMVQwODoxNDowMC4wMDBaIiwiaSI6InJldl8wMDQzIn0>; rel="next"

{
  "data": [
    { "id": "rev_0045", "rating": 5, "body": "Seeded review #45", "createdAt": "2025-01-01T08:14:00.000Z" },
    { "id": "rev_0044", "rating": 4, "body": "Seeded review #44", "createdAt": "2025-01-01T08:14:00.000Z" },
    { "id": "rev_0043", "rating": 3, "body": "Seeded review #43", "createdAt": "2025-01-01T08:14:00.000Z" }
  ],
  "page": { "limit": 3, "nextCursor": "eyJ2IjoxLCJjIjoiMjAyNS0wMS0wMVQwODoxNDowMC4wMDBaIiwiaSI6InJldl8wMDQzIn0" }
}

GET /v1/cafes/cafe_42/reviews?cursor=not-a-real-cursor HTTP/1.1

HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://api.nearbrew.example/problems/invalid-cursor",
  "title": "Invalid cursor",
  "status": 400,
  "detail": "The cursor is malformed or expired. Restart from the first page.",
  "param": "cursor"
}

POST /v1/cafes/cafe_42/reviews HTTP/1.1
Content-Type: application/json

{ "rating": 9 }

HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.nearbrew.example/problems/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "detail": "The review has invalid fields",
  "errors": [
    { "field": "rating", "message": "must be an integer 1-5" },
    { "field": "body", "message": "is required" }
  ]
}`,
      },
      {
        language: 'ts',
        title: 'Booking platform: idempotent POST /v1/bookings with an Idempotency-Key',
        code: `// Idempotent POST /v1/bookings: the client generates one key per *user intent*
// (e.g. crypto.randomUUID() when the "Confirm booking" screen opens) and resends it on every retry.
import { createHash } from 'node:crypto';

type StoredResponse = { status: number; body: unknown };
type IdemRecord =
  | { state: 'in_progress'; requestHash: string }
  | { state: 'done'; requestHash: string; response: StoredResponse };

// Production: a table with PRIMARY KEY (account_id, idempotency_key), written in the SAME
// transaction as the booking row, plus an expiry (e.g. 24h). A Map shows the logic.
const idempotency = new Map<string, IdemRecord>();

export async function postBooking(
  accountId: string,
  idempotencyKey: string | undefined,
  body: { slotId: string; partySize: number },
  createBooking: (b: { slotId: string; partySize: number }) => Promise<StoredResponse>,
): Promise<StoredResponse> {
  if (!idempotencyKey) {
    return { status: 400, body: { type: 'https://api.nearbrew.example/problems/idempotency-key-required', title: 'Idempotency-Key header is required', status: 400 } };
  }
  const key = accountId + ':' + idempotencyKey; // scope keys per caller
  const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const existing = idempotency.get(key);

  if (existing && existing.requestHash !== requestHash) {
    // Same key, different payload: a client bug. Never silently return the old booking.
    return { status: 422, body: { type: 'https://api.nearbrew.example/problems/idempotency-key-reused', title: 'Idempotency-Key reused with a different request', status: 422 } };
  }
  if (existing?.state === 'in_progress') {
    // The first attempt is still running (the client timed out and retried quickly).
    return { status: 409, body: { type: 'https://api.nearbrew.example/problems/request-in-progress', title: 'A request with this key is still in progress', status: 409 } };
  }
  if (existing?.state === 'done') return existing.response; // replay: same status, same body, no second booking

  idempotency.set(key, { state: 'in_progress', requestHash });
  try {
    const response = await createBooking(body); // e.g. 201 { id: 'bk_123', ... } or 409 slot taken
    idempotency.set(key, { state: 'done', requestHash, response });
    return response;
  } catch (err) {
    idempotency.delete(key); // unexpected failure: nothing committed, so allow a clean retry
    throw err;
  }
}`,
      },
      {
        language: 'sql',
        title: 'Offset vs keyset in PostgreSQL, backed by the week 1 composite index',
        code: `-- Index: equality column first, then the sort columns (week 1).
-- A B-tree can be read backward, so ascending columns serve DESC, DESC ordering.
CREATE INDEX reviews_cafe_created_id_idx ON reviews (cafe_id, created_at, id);

-- Offset: reads and discards 100,000 index entries before returning 20.
SELECT id, rating, body, created_at
FROM reviews
WHERE cafe_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 100000;

-- Keyset: seek to the last-seen key and read 20 entries. Cost does not grow with depth.
-- $2, $3 come from the decoded cursor; $4 is limit + 1 (the extra row tells you if there is a next page).
SELECT id, rating, body, created_at
FROM reviews
WHERE cafe_id = $1
  AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT $4;

-- Same idea for a global feed (index on (created_at, id)):
-- WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT $3

-- Without row-value support, expand the comparison (same semantics):
-- WHERE cafe_id = $1 AND (created_at < $2 OR (created_at = $2 AND id < $3))

-- Expected EXPLAIN (ANALYZE) shape for the keyset query:
--   Limit (actual rows=20)
--     -> Index Scan Backward using reviews_cafe_created_id_idx (actual rows=20)
--          Index Cond: ((cafe_id = 42) AND (ROW(created_at, id) < ROW(...)))`,
      },
      {
        language: 'ts',
        title: 'Allow-listed sorts and a cursor bound to its query (GET /v1/cafes/nearby)',
        code: `// The client picks a named sort; the server owns the SQL. Every option has an index.
const SORTS = {
  newest: { orderBy: 'created_at DESC, id DESC', key: ['created_at', 'id'] },
  top_rated: { orderBy: 'avg_rating DESC, id DESC', key: ['avg_rating', 'id'] },
} as const;
type SortName = keyof typeof SORTS;

function parseSort(raw: string | null): SortName | null {
  const name = raw ?? 'newest';
  return name in SORTS ? (name as SortName) : null; // null -> 400 problem, never string-concatenated SQL
}

// For /v1/cafes/nearby?lat=..&lng=..&radius_m=1500&sort=distance the sort key (distance)
// depends on the query itself, so a cursor from one location is meaningless at another.
// Bind the cursor to the query that produced it and reject mismatches with 400.
import { createHash } from 'node:crypto';

function queryFingerprint(params: { lat: number; lng: number; radiusM: number; sort: string }): string {
  // Round coordinates so tiny GPS jitter between pages does not invalidate the cursor.
  const canonical = [params.lat.toFixed(3), params.lng.toFixed(3), params.radiusM, params.sort].join('|');
  return createHash('sha256').update(canonical).digest('base64url').slice(0, 10);
}

interface NearbyCursor { v: 1; q: string; distanceM: number; id: string }

function encodeNearbyCursor(c: NearbyCursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}
// On decode: if cursor.q !== queryFingerprint(currentParams) -> 400 'cursor-query-mismatch'.
// SQL: WHERE ... AND (distance_m, id) > ($distanceM, $id) ORDER BY distance_m ASC, id ASC LIMIT $n`,
      },
    ],
    keyTakeaways: [
      "Model nouns with stable identity as resources; let HTTP methods carry the verb and their safety/idempotency guarantees.",
      "Use a small, consistent set of status codes and one error envelope everywhere: RFC 9457 `application/problem+json`, with clients branching on `type`.",
      "Offset pagination costs O(offset) and skips or duplicates rows when data changes between pages; it is acceptable only for small, mostly static, page-numbered admin lists.",
      "Keyset pagination seeks to the last-seen sort key; it needs a total order (unique tie-breaker like `id`) and a composite index matching `WHERE` + `ORDER BY`.",
      "Cursors are opaque, versioned, validated user input; a bad cursor is a `400`, never a `500`.",
      "Cap `limit`, fetch `limit + 1` to detect a next page, and make POST retries safe with an `Idempotency-Key` stored with the result.",
    ],
    prerequisites: [
      "Comfortable reading TypeScript and running scripts with Node 18+ (`npx tsx` downloads on first use)",
      "Composite indexes and reading `EXPLAIN ANALYZE` output (week 1)",
      "Basic `curl` usage",
    ],
    prerequisiteWeeks: [1],
    resources: [
      {
        title: 'RFC 9457: Problem Details for HTTP APIs',
        url: 'https://www.rfc-editor.org/rfc/rfc9457',
        kind: 'docs',
        note: "Read the introduction and the section defining the members (type, status, title, detail, instance) and extension members. Skim the rest. This is the error envelope used in the exercise.",
        minutes: 10,
      },
      {
        title: 'MDN: HTTP request methods',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods',
        kind: 'docs',
        note: "Read the summary table of methods with the safe, idempotent and cacheable columns, then follow the link to the Idempotent glossary entry. Five minutes that make PUT vs POST vs PATCH unambiguous.",
        minutes: 5,
      },
      {
        title: 'MDN: HTTP response status codes',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status',
        kind: 'docs',
        note: "Use as a reference: read the entries for 201, 204, 400, 401, 403, 404, 409, 422 and 429 and compare them with the list in the explanation.",
        minutes: 5,
      },
      {
        title: 'PostgreSQL docs: LIMIT and OFFSET',
        url: 'https://www.postgresql.org/docs/current/queries-limit.html',
        kind: 'docs',
        note: "Short page. Note the two warnings: results without ORDER BY are unpredictable, and rows skipped by OFFSET still have to be computed, so a large OFFSET is slow.",
        minutes: 3,
      },
      {
        title: 'PostgreSQL docs: Row and Array Comparisons',
        url: 'https://www.postgresql.org/docs/current/functions-comparisons.html',
        kind: 'docs',
        note: "Read the 'Row Constructor Comparison' subsection: it defines how `(created_at, id) < ($1, $2)` is evaluated column by column, which is exactly the keyset condition.",
        minutes: 4,
      },
      {
        title: 'Stripe API reference: Idempotent requests',
        url: 'https://docs.stripe.com/api/idempotent_requests',
        kind: 'article',
        note: "A well-known production design for Idempotency-Key: how keys are scoped, how long they are kept, and what happens when a key is reused with different parameters. Compare it with the booking example.",
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'NearBrew reviews feed: break offset pagination, then fix it with keyset cursors',
      scenario:
        "NearBrew's café screen shows an infinite-scroll list of reviews from `GET /v1/cafes/{cafeId}/reviews`. Testers on a busy café report seeing the same review twice while scrolling, and an analyst noticed some reviews never appear in a full scroll. You will build the endpoint with plain `node:http` and an in-memory store, implement offset pagination first, reproduce both bugs deterministically, then replace it with keyset cursor pagination, a `Link` header, Problem Details errors and a capped `limit`. Finally you will prove the SQL version in the week 1 Postgres container.",
      setup: [
        "Node 18 or newer (`node --version`). No framework or npm install needed; `npx tsx` fetches the TypeScript runner on first use.",
        "`mkdir nearbrew-reviews && cd nearbrew-reviews`, then create `reviews.ts`, `server.ts` and `drift-demo.ts` from the starter code below (same folder). For the SQL step, also create `keyset.sql`.",
        "For step 9, start the Postgres container from week 1 (for example `docker start pg-week1`, or `docker run --name pg-week1 -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`). Any database works because the script creates its own `reviews_w3` table.",
      ],
      steps: [
        "Sanity check: run `npx tsx drift-demo.ts`. It should crash with `TODO pageByOffset`. Read `reviews.ts` top to bottom first: note that ids are zero-padded so string order matches creation order, and that seeded reviews share a timestamp in groups of three. That is deliberate: real data has ties.",
        "Implement `pageByOffset` in `reviews.ts`: sort with `reviewsFor(cafeId)`, slice `[offset, offset + limit)`, and set `nextOffset` to `offset + limit` when more rows remain, otherwise `null`. Start the server with `npx tsx server.ts` and try `curl -s 'localhost:3000/v1/cafes/cafe_42/reviews?limit=5&offset=0'` and `offset=5`. Check `total` is 45 and the first id is `rev_0045`.",
        "Reproduce the bugs: run `npx tsx drift-demo.ts`. The offset line should report duplicates `[\"rev_0037\",\"rev_0036\"]` and missing `[\"rev_0027\"]` (the cursor line will still crash with TODO; that is fine). In a comment at the top of `drift-demo.ts`, draw the list positions before and after each mutation and explain in two sentences why two new reviews produce two duplicates and one delete produces one skip.",
        "Exercise the contract with the server running: `curl -si '...reviews?limit=abc'` (400 problem), `'...reviews?limit=500&offset=0'` (clamped: `page.limit` is 50, so all 45 rows come back), `'...reviews?offset=0&cursor=x'` (400, mutually exclusive), `curl -si -X POST localhost:3000/v1/cafes/cafe_42/reviews -d '{\"rating\":9}'` (422 with an `errors` array), a valid POST (201 plus `Location`), the same `DELETE /v1/cafes/cafe_42/reviews/rev_0001` twice (204 both times: idempotent), `curl -si -X PUT .../reviews` (405 plus `Allow`), and an unknown café (404). Note which status each returns and whether every error shares the same JSON shape.",
        "Implement `encodeCursor` and `decodeCursor`: base64url of `JSON.stringify({ v: 1, c: createdAt, i: id })`. `decodeCursor` must return `null`, never throw, for garbage, valid base64 of non-JSON, wrong `v`, missing fields or an unparseable date. Verify with a scratch file `cursor-check.ts` that logs `decodeCursor(encodeCursor({ createdAt: '2025-01-01T08:14:00.000Z', id: 'rev_0043' }))`, `decodeCursor('garbage')` and `decodeCursor(Buffer.from('{\"v\":2}').toString('base64url'))`, then run it with `npx tsx cursor-check.ts`.",
        "Implement `isAfterKey` as the row-value comparison `(createdAt, id) < (key.createdAt, key.id)` and `pageByCursor`: filter with `isAfterKey` when `after` is not null, take `limit + 1` rows, return the first `limit`, and set `nextCursor` from the last returned row only if the extra row existed. Restart the server and follow pages with curl until `nextCursor` is `null`; you should see 45 distinct reviews across 5 pages of 10.",
        "In `server.ts`, replace the `TODO(step 7)` with a `Link: <...>; rel=\"next\"` header built with `new URL(url.pathname, 'http://' + req.headers.host)` plus `limit` and `cursor` search params. Confirm with `curl -si '...reviews?limit=10'` that the header is present on pages 1 to 4 and absent on the last page, and that following the Link URL verbatim works. Then try `?cursor=garbage` and confirm a 400 `invalid-cursor` problem, not a 500.",
        "Rerun `npx tsx drift-demo.ts`. The cursor line must report no duplicates and no missing rows even though the same inserts and delete happen between pages. Now break it on purpose: change `isAfterKey` to compare only `createdAt` (drop the id tie-breaker) and rerun. You should see 6 missing reviews, two from each timestamp group that straddled a page boundary. Restore the tie-breaker and write one sentence in a comment explaining why the ordering must be total.",
        "Prove the SQL version: run `docker exec -i pg-week1 psql -U postgres < keyset.sql` (adjust the container name). Compare the two `EXPLAIN (ANALYZE, BUFFERS)` plans: the offset plan's Index Scan reports about 100,020 actual rows and well over a thousand shared buffers; the keyset plan reports 20 rows, a handful of buffers, and the row comparison inside `Index Cond`. Record both execution times. Then drop the index (`DROP INDEX reviews_w3_cafe_created_id_idx;`), rerun only the keyset query, and note what the plan does without it.",
        "Write the contract down as a comment block at the top of `server.ts`, as you would in a PR description: path, query params (`limit` default 20, max 50; `cursor` opaque), response shape (`data`, `page.nextCursor`, `Link`), error `type` values with their status codes, ordering guarantee (`created_at DESC, id DESC`), and what clients must do on `invalid-cursor` (restart from page one). Add one line on when you would still choose offset (a small, rarely-changing admin table that needs page numbers).",
      ],
      starter: [
        {
          language: 'ts',
          title: 'reviews.ts (store + pagination; TODOs for steps 2, 5 and 6)',
          code: `// reviews.ts: in-memory review store + pagination logic (no framework, no DB)
export interface Review {
  id: string; // 'rev_0001' (zero-padded so string order == creation order)
  cafeId: string;
  rating: number; // 1..5
  body: string;
  createdAt: string; // ISO-8601 UTC, e.g. '2025-01-01T08:00:00.000Z'
}

export const CAFES = new Set(['cafe_42', 'cafe_7']);
const BASE = Date.parse('2025-01-01T08:00:00.000Z');
let reviews: Review[] = [];
let seq = 0;

function nextId(): string {
  seq += 1;
  return 'rev_' + String(seq).padStart(4, '0');
}

/** Reset to 45 reviews for cafe_42. Every 3 reviews share a timestamp, so ties are real. */
export function resetStore(count = 45): void {
  reviews = [];
  seq = 0;
  for (let i = 0; i < count; i++) {
    reviews.push({
      id: nextId(),
      cafeId: 'cafe_42',
      rating: (i % 5) + 1,
      body: 'Seeded review #' + (i + 1),
      createdAt: new Date(BASE + Math.floor(i / 3) * 60_000).toISOString(),
    });
  }
}

export function addReview(cafeId: string, rating: number, body: string): Review {
  const review: Review = { id: nextId(), cafeId, rating, body, createdAt: new Date().toISOString() };
  reviews.push(review);
  return review;
}

export function deleteReview(id: string): boolean {
  const before = reviews.length;
  reviews = reviews.filter((r) => r.id !== id);
  return reviews.length < before;
}

/** Newest first, with id as the tie-breaker: ORDER BY created_at DESC, id DESC */
export function compareNewestFirst(a: Review, b: Review): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function reviewsFor(cafeId: string): Review[] {
  return reviews.filter((r) => r.cafeId === cafeId).sort(compareNewestFirst);
}

// ---------- Offset pagination ----------
export interface OffsetPage {
  data: Review[];
  page: { limit: number; offset: number; total: number; nextOffset: number | null };
}

export function pageByOffset(cafeId: string, limit: number, offset: number): OffsetPage {
  // TODO(step 2): sort with reviewsFor(cafeId), slice [offset, offset + limit),
  // and return nextOffset (or null when there are no more rows).
  throw new Error('TODO pageByOffset ' + cafeId + limit + offset);
}

// ---------- Keyset (cursor) pagination ----------
export interface CursorKey {
  createdAt: string;
  id: string;
}

export interface CursorPage {
  data: Review[];
  page: { limit: number; nextCursor: string | null };
}

/** Opaque to clients: base64url(JSON of the sort key of the last row). */
export function encodeCursor(key: CursorKey): string {
  // TODO(step 5): base64url-encode a small versioned JSON payload, e.g. { v: 1, c: createdAt, i: id }
  throw new Error('TODO encodeCursor ' + key.id);
}

/** Returns null for anything malformed. Never trust a cursor: it is user input. */
export function decodeCursor(cursor: string): CursorKey | null {
  // TODO(step 5): reverse encodeCursor. Return null (never throw) for bad base64, bad JSON,
  // wrong version, missing fields or an unparseable date. Cursors are user input.
  throw new Error('TODO decodeCursor ' + cursor);
}

/** Row comes strictly after \`key\` in newest-first order: (created_at, id) < (key.createdAt, key.id) */
function isAfterKey(r: Review, key: CursorKey): boolean {
  // TODO(step 6): true when (r.createdAt, r.id) sorts strictly after key in newest-first order,
  // i.e. the row-value comparison (created_at, id) < (key.created_at, key.id).
  throw new Error('TODO isAfterKey ' + r.id + key.id);
}

export function pageByCursor(cafeId: string, limit: number, after: CursorKey | null): CursorPage {
  // TODO(step 6): filter rows with isAfterKey (when after !== null), take limit + 1 rows,
  // return the first \`limit\`, and set nextCursor from the last returned row only if the extra row existed.
  throw new Error('TODO pageByCursor ' + cafeId + limit + String(after));
}`,
        },
        {
          language: 'ts',
          title: 'server.ts (node:http routes, validation, Problem Details; TODO for step 7)',
          code: `// server.ts: node:http only. Run: npx tsx server.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  CAFES, resetStore, addReview, deleteReview, pageByOffset, pageByCursor, decodeCursor,
} from './reviews';

const PORT = 3000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body, null, 2));
}

/** RFC 9457 Problem Details: one error shape for every endpoint. */
function sendProblem(res: ServerResponse, status: number, slug: string, title: string, detail: string, extra: Record<string, unknown> = {}): void {
  res.writeHead(status, { 'Content-Type': 'application/problem+json' });
  const type = 'https://api.nearbrew.example/problems/' + slug; // stable, documentable error identifier
  res.end(JSON.stringify({ type, title, status, detail, ...extra }, null, 2));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function parseLimit(raw: string | null): number | null {
  if (raw === null) return DEFAULT_LIMIT;
  if (!/^\\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n < 1) return null;
  return Math.min(n, MAX_LIMIT); // clamp silently; reject only nonsense
}

async function handleListReviews(req: IncomingMessage, res: ServerResponse, url: URL, cafeId: string): Promise<void> {
  const limit = parseLimit(url.searchParams.get('limit'));
  if (limit === null) return sendProblem(res, 400, 'invalid-parameter', 'Invalid parameter', 'limit must be an integer from 1 to ' + MAX_LIMIT, { param: 'limit' });

  const cursorParam = url.searchParams.get('cursor');
  const offsetParam = url.searchParams.get('offset');
  if (cursorParam !== null && offsetParam !== null) {
    return sendProblem(res, 400, 'invalid-parameter', 'Invalid parameter', 'Use either cursor or offset, not both');
  }

  if (offsetParam !== null) {
    if (!/^\\d+$/.test(offsetParam)) return sendProblem(res, 400, 'invalid-parameter', 'Invalid parameter', 'offset must be a non-negative integer', { param: 'offset' });
    return sendJson(res, 200, pageByOffset(cafeId, limit, Number(offsetParam)));
  }

  const after = cursorParam === null ? null : decodeCursor(cursorParam);
  if (cursorParam !== null && after === null) {
    return sendProblem(res, 400, 'invalid-cursor', 'Invalid cursor', 'The cursor is malformed or expired. Restart from the first page.', { param: 'cursor' });
  }
  const result = pageByCursor(cafeId, limit, after);
  const headers: Record<string, string> = {};
  // TODO(step 7): if result.page.nextCursor is set, add an RFC 8288 Link header:
  //   Link: <http://localhost:3000/v1/cafes/cafe_42/reviews?limit=10&cursor=...>; rel="next"
  sendJson(res, 200, result, headers);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const list = url.pathname.match(/^\\/v1\\/cafes\\/([\\w-]+)\\/reviews$/);
    const item = url.pathname.match(/^\\/v1\\/cafes\\/([\\w-]+)\\/reviews\\/([\\w-]+)$/);
    const cafeId = (list ?? item)?.[1];

    if (!cafeId) return sendProblem(res, 404, 'not-found', 'Not Found', 'No route for ' + url.pathname);
    if (!CAFES.has(cafeId)) return sendProblem(res, 404, 'cafe-not-found', 'Cafe not found', 'No cafe with id ' + cafeId);

    if (list && req.method === 'GET') return await handleListReviews(req, res, url, cafeId);

    if (list && req.method === 'POST') {
      const body = (await readJson(req)) as { rating?: unknown; body?: unknown };
      const errors: { field: string; message: string }[] = [];
      if (typeof body.rating !== 'number' || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) errors.push({ field: 'rating', message: 'must be an integer 1-5' });
      if (typeof body.body !== 'string' || body.body.trim() === '') errors.push({ field: 'body', message: 'is required' });
      if (errors.length) return sendProblem(res, 422, 'validation-failed', 'Validation failed', 'The review has invalid fields', { errors });
      const review = addReview(cafeId, body.rating as number, body.body as string);
      return sendJson(res, 201, review, { Location: url.pathname + '/' + review.id });
    }

    if (item && req.method === 'DELETE') {
      deleteReview(item[2]!); // idempotent: deleting twice leaves the same state, so 204 both times
      res.writeHead(204).end();
      return;
    }

    res.setHeader('Allow', list ? 'GET, POST' : 'DELETE');
    return sendProblem(res, 405, 'method-not-allowed', 'Method Not Allowed', req.method + ' is not supported on ' + url.pathname);
  } catch (err) {
    if (err instanceof SyntaxError) return sendProblem(res, 400, 'malformed-json', 'Malformed JSON', err.message);
    console.error(err);
    return sendProblem(res, 500, 'internal', 'Internal Server Error', 'Unexpected error');
  }
});

resetStore();
server.listen(PORT, () => console.log('NearBrew reviews API on http://localhost:' + PORT));`,
        },
        {
          language: 'ts',
          title: 'drift-demo.ts (walks every page while other users write; complete, do not edit except step 3 notes)',
          code: `// drift-demo.ts: walk every page while the data changes underneath. Run: npx tsx drift-demo.ts
import { resetStore, addReview, deleteReview, pageByOffset, pageByCursor, decodeCursor, type Review } from './reviews';

const CAFE = 'cafe_42';
const LIMIT = 10;

/** Between pages, other users write: after page 1, two new reviews; after page 2, someone deletes a review from page 1. */
function simulateTraffic(pageNumber: number, firstPage: Review[]): void {
  if (pageNumber === 1) {
    addReview(CAFE, 5, 'Fresh review A');
    addReview(CAFE, 4, 'Fresh review B');
  }
  if (pageNumber === 2 && firstPage[0]) deleteReview(firstPage[0].id);
}

function report(label: string, seen: string[], initialIds: Set<string>, finalIds: Set<string>): void {
  const counts = new Map<string, number>();
  for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
  const duplicates = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
  // A row that existed the whole time must be seen exactly once.
  const stable = [...initialIds].filter((id) => finalIds.has(id));
  const missing = stable.filter((id) => !counts.has(id));
  console.log(label.padEnd(8), 'pages walked:', Math.ceil(seen.length / LIMIT), '| rows seen:', seen.length,
    '| duplicates:', JSON.stringify(duplicates), '| missing:', JSON.stringify(missing));
}

function allIds(): Set<string> {
  return new Set(pageByOffset(CAFE, 10_000, 0).data.map((r) => r.id));
}

// ---- Offset walk ----
resetStore();
let initial = allIds();
let seen: string[] = [];
let firstPage: Review[] = [];
for (let offset = 0, page = 1; ; page++) {
  const res = pageByOffset(CAFE, LIMIT, offset);
  if (page === 1) firstPage = res.data;
  seen.push(...res.data.map((r) => r.id));
  simulateTraffic(page, firstPage);
  if (res.page.nextOffset === null) break;
  offset = res.page.nextOffset;
}
report('offset', seen, initial, allIds());

// ---- Cursor walk ----
resetStore();
initial = allIds();
seen = [];
let cursor: string | null = null;
for (let page = 1; ; page++) {
  const res = pageByCursor(CAFE, LIMIT, cursor === null ? null : decodeCursor(cursor));
  if (page === 1) firstPage = res.data;
  seen.push(...res.data.map((r) => r.id));
  simulateTraffic(page, firstPage);
  if (res.page.nextCursor === null) break;
  cursor = res.page.nextCursor;
}
report('cursor', seen, initial, allIds());`,
        },
        {
          language: 'sql',
          title: 'keyset.sql (step 9: run with psql against the week 1 Postgres)',
          code: `-- keyset.sql: run inside psql against your week 1 Docker Postgres.
DROP TABLE IF EXISTS reviews_w3;
CREATE TABLE reviews_w3 (
  id         bigserial PRIMARY KEY,
  cafe_id    int NOT NULL,
  rating     int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       text NOT NULL,
  created_at timestamptz NOT NULL
);

-- 1M reviews for one busy cafe; every 3 rows share a timestamp (ties on purpose).
INSERT INTO reviews_w3 (cafe_id, rating, body, created_at)
SELECT 42, 1 + (g % 5), 'review ' || g, timestamptz '2025-01-01 00:00+00' + (g / 3) * interval '1 minute'
FROM generate_series(1, 1000000) AS g;

-- Week 1 pattern: equality column first, then the ORDER BY columns. A B-tree can be
-- scanned backward, so this ascending index serves ORDER BY created_at DESC, id DESC.
CREATE INDEX reviews_w3_cafe_created_id_idx ON reviews_w3 (cafe_id, created_at, id);
ANALYZE reviews_w3;

-- A) OFFSET: page 5,001 at 20 per page
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, rating, created_at
FROM reviews_w3
WHERE cafe_id = 42
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 100000;

-- Capture the sort key of the row just before that page into psql variables.
SELECT created_at AS k_created, id AS k_id
FROM reviews_w3
WHERE cafe_id = 42
ORDER BY created_at DESC, id DESC
OFFSET 99999 LIMIT 1 \\gset

-- B) KEYSET: the same page, seeking straight to the key
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, rating, created_at
FROM reviews_w3
WHERE cafe_id = 42
  AND (created_at, id) < (:'k_created', :k_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;`,
        },
      ],
      expected: [
        "Offset walk: `duplicates: [\"rev_0037\",\"rev_0036\"] | missing: [\"rev_0027\"]` with 46 rows seen across 5 pages.",
        "Cursor walk: `duplicates: [] | missing: []` with 45 rows seen, despite identical concurrent writes.",
        "Cursor walk without the id tie-breaker: 6 missing reviews and only 4 pages walked.",
        "Every error response has `Content-Type: application/problem+json` with `type`, `title`, `status` and `detail`; bad cursors give 400, never 500.",
        "`Link: <...>; rel=\"next\"` appears on every page except the last, and `page.nextCursor` is `null` on the last page.",
        "In Postgres, the offset plan scans about 100,020 index rows while the keyset plan scans 20 with `ROW(created_at, id) < ROW(...)` in `Index Cond`; keyset is typically one to three orders of magnitude faster at that depth.",
      ],
      hints: [
        "ISO-8601 UTC strings in the same format compare correctly as strings, so `a.createdAt < b.createdAt` is a valid time comparison here. In Postgres you compare `timestamptz` values instead.",
        "The newest-first keyset condition is 'strictly older, or same time with a smaller id': `r.createdAt < k.createdAt || (r.createdAt === k.createdAt && r.id < k.id)`. Using `<=` anywhere gives you a duplicate of the boundary row.",
        "`Buffer.from(json).toString('base64url')` and `Buffer.from(cursor, 'base64url').toString('utf8')` give URL-safe cursors without `+`, `/` or `=` that would need escaping in query strings. Wrap `JSON.parse` in try/catch and check `typeof` on every field.",
        "If `limit + 1` feels odd, try the alternative: return `nextCursor` whenever the page is full. You will then send clients to an empty last page whenever the total is a multiple of the limit.",
      ],
      verification: [
        "`npx tsx drift-demo.ts` prints the offset bug and a clean cursor line.",
        "On a freshly restarted server, following `Link` headers with curl from page 1 visits 45 unique ids, newest first, ending with `rev_0001`.",
        "`?cursor=garbage`, `?limit=abc` and `?limit=0` each return a 400 problem document; `?limit=500` returns at most 50 rows.",
        "You can explain, without looking, why the offset run has exactly two duplicates and one skip.",
        "Your saved EXPLAIN output shows Index Scan Backward with about 100,020 rows for OFFSET and 20 rows for keyset.",
      ],
    },
    successChecklist: [
      "Offset pagination implemented and its duplicate/skip bug reproduced and explained in writing.",
      "Keyset pagination with an opaque, versioned, validated base64url cursor and an `id` tie-breaker.",
      "`limit` defaulted and capped; next page detected with `limit + 1`; `Link` header and `page.nextCursor` both present.",
      "All errors use one RFC 9457 envelope with stable `type` URIs and correct 400/404/405/422 statuses.",
      "SQL keyset query uses the composite index, with both EXPLAIN plans saved and compared.",
      "A written endpoint contract a teammate could implement a client from.",
    ],
    questions: [
      {
        question:
          "A teammate says: 'Offset pagination is fine, we only have 5,000 reviews per café.' What problems remain even at that size, and when would you still accept offset?",
        answer:
          "Size only addresses the performance problem; the correctness problem is independent of table size. Any insert or delete between page requests shifts positions, so on an active café users see duplicate reviews after new ones arrive and miss rows after deletions or moderation removals, and that happens at 50 rows as easily as at 5 million. Deep offsets also become slow as the data grows, and API shapes are hard to change once mobile clients depend on them. Offset is still reasonable for small, rarely changing, admin-style tables where users genuinely need page numbers or 'jump to page N', where exact consistency across pages is not important, and where you cap the maximum offset. For a public infinite-scroll feed, keyset is the better default.",
      },
      {
        question:
          "Why must the keyset ordering include a unique tie-breaker, and what exactly goes wrong without one?",
        answer:
          "Keyset pagination says 'give me rows strictly after the last key I saw'. If the key is not unique, several rows can share the boundary value and there is no way to express 'after this particular one of them'. Using `created_at < $last` skips every remaining row with the same timestamp; using `<=` repeats the ones already shown. In the exercise, dropping the `id` tie-breaker loses 6 reviews because timestamp groups straddle page boundaries. Adding a unique column such as the primary key to both the `ORDER BY` and the comparison, in the same direction, makes the order total, so every row has exactly one position and the cursor identifies it unambiguously. The index must include the tie-breaker too, or the database falls back to sorting.",
      },
      {
        question:
          "A mobile client sends `POST /v1/bookings`, the connection drops before the response arrives, and the app retries. Walk through how an Idempotency-Key prevents a double booking and what edge cases the server must handle.",
        answer:
          "The client generates a unique key when the user starts the booking intent and sends it as `Idempotency-Key` on the first attempt and every retry. The server scopes the key to the caller, records it before doing the work, performs the booking, and stores the final status and body against the key, ideally in the same transaction as the booking row so they commit together. A retry with the same key and same payload gets the stored response replayed: same `201` and booking id, no second booking. Edge cases: a retry that arrives while the first attempt is still running should get a `409` (or wait) rather than run concurrently; the same key with a different payload is a client bug and should get a `422`, not the old result; an unexpected failure before anything committed should release the key so a retry can proceed; and keys need an expiry. Idempotency keys complement, not replace, database constraints such as a unique index on (slot_id) for confirmed bookings, which still prevents two different users taking the same seat.",
      },
    ],
    explainPrompt:
      "Explain to a mid-level frontend teammate in a code review why you are replacing `?page=N` with `?cursor=` on the NearBrew reviews endpoint. Cover the duplicate and skip bugs, the performance difference, why the cursor is opaque and includes the id, and what changes for the client (no page numbers, store and send back the cursor, restart on `invalid-cursor`).",
    rubric: [
      "Explains the duplicate/skip bug with a concrete example of rows shifting position between requests.",
      "Explains why deep OFFSET is O(offset) and why keyset with a matching composite index is constant per page.",
      "Justifies the unique tie-breaker and the opacity and validation of the cursor.",
      "States what the client must change and what they lose (jump-to-page, exact totals) without hand-waving.",
      "Mentions the contract details: limit cap, `nextCursor: null` on the last page, Problem Details errors.",
      "Pitched at the audience: concrete and short, no jargon left undefined.",
    ],
    referenceExplanation:
      "Right now the reviews list uses `?page=N`, which the server turns into `OFFSET (N-1)*20`. An offset is a position in a list that keeps changing. If two people post reviews while you are reading page 1, everything moves down two places, so page 2 starts with two reviews you already saw. If a moderator deletes a review from page 1, everything moves up one, and one review never shows on either page. On a busy café that happens all the time, and it is what testers reported. It also gets slower the deeper you scroll, because Postgres has to walk past every skipped row before returning the 20 you want. The cursor version says 'give me the 20 reviews older than the last one you showed me'. The cursor encodes that last review's `created_at` and `id`. The id matters because many reviews share a timestamp; without it we could not say which of the tied rows we stopped at, and we would skip some. With our composite index on `(cafe_id, created_at, id)` the database jumps straight to that spot, so page 500 costs the same as page 1. For the client, three changes. Treat the cursor as an opaque string: do not parse it or build one, just send back `page.nextCursor` (it may change format). Stop when `nextCursor` is `null`. If you get a 400 with type `invalid-cursor`, drop the cursor and reload from the top. We lose 'jump to page 7' and the exact total, which the infinite-scroll UI never used. Limit is capped at 50 and errors use the same Problem Details shape as the rest of the API.",
    stretch: {
      title: 'Idempotent review POST and a signed, query-bound cursor',
      description:
        "Add `Idempotency-Key` support to `POST /v1/cafes/{id}/reviews` using the booking example's logic (replay, 409 in progress, 422 on payload mismatch) and prove with curl that resending creates one review. Then add a `rating_gte` filter and a `sort=top_rated` option, include a short hash of the filter and sort in the cursor, sign the cursor with `createHmac('sha256', secret)`, and reject tampered or mismatched cursors with distinct Problem Details types.",
    },
    lightTask:
      "In 30 minutes: create `reviews.ts` and `drift-demo.ts` from the starter, implement only `pageByOffset` (about five lines), and run `npx tsx drift-demo.ts` to see the offset line report two duplicates and one missing review. Then, on paper, write the keyset SQL `WHERE cafe_id = $1 AND (created_at, id) < ($2, $3) ORDER BY created_at DESC, id DESC LIMIT $4`, the index it needs, and three sentences explaining why it cannot produce those duplicates or skips.",
    intensiveExtras: [
      "Implement backward pagination (`?before=` cursor for 'newer than') by flipping the comparison and order, then reversing the result, and verify a forward-then-back round trip returns the same page.",
      "Design `GET /v1/cafes/nearby?lat&lng&radius_m&sort=distance` on paper: resource shape, allow-listed sorts, query-bound cursor `(distance_m, id)`, limit caps, and the error types; list which index or spatial index each sort needs.",
      "Run `keyset.sql` with OFFSET 10, 1,000, 100,000 and 900,000 and plot execution time against depth for offset vs keyset in a small table in your notes.",
      "Write a 10-line client helper `async function* paginate(url)` that follows `Link` headers until there is none and use it to count all reviews.",
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['api-design', 'backend-services', 'databases'],
    depth: 'detailed',
  },

  // ---------------------------------------------------------------------------
  // Week 4
  // ---------------------------------------------------------------------------
  {
    week: 4,
    slug: 'caching-ttl-invalidation-stale-data',
    title: 'Caching: TTL, invalidation, and stale data',
    track: 'system-design',
    secondaryTracks: ['backend'],
    topics: [
      'cache layers',
      'Cache-Control',
      'CDN caching',
      'cache-aside',
      'read-through',
      'write-through',
      'write-behind',
      'TTL',
      'cache invalidation',
      'stale-while-revalidate',
      'stale-if-error',
      'cache stampede',
      'request coalescing',
      'negative caching',
      'LRU eviction',
    ],
    objective:
      "By the end you can choose where and how to cache each piece of NearBrew data, pick a TTL and invalidation strategy from how stale it is allowed to be, and implement a cache helper with expiry, request coalescing, stale-while-revalidate, serve-stale-on-error and a size bound.",
    whyItMatters:
      "Caching is the cheapest large performance win available and one of the most common sources of production bugs: users see opening hours that changed yesterday, a seat shows as available after it was booked, a cache restart sends the database a thundering herd, or a single slow upstream stalls every request. Senior engineers are expected to say not just 'add Redis' but which layer, which key, which TTL, who invalidates it, what happens when it is down, and which data must never be cached at all.",
    explanation: [
      "A cache is a copy of data kept closer to the reader so that most reads skip expensive work. That makes every cache a deliberate consistency trade: you accept that the copy may be out of date in exchange for latency, throughput or cost. The useful question is never 'should we cache?' but 'how stale may this specific piece of data be, for whom, and what happens when it is wrong?'. For NearBrew, a café's opening hours being 5 minutes stale is harmless; a review count being a minute stale is invisible; a booking slot showing 'available' after it was taken causes a double booking and an angry customer. Write the staleness budget down per data type before you write any cache code.",
      "Caches stack in layers, and each layer has a different owner and invalidation story. The **browser or app HTTP cache** is controlled by `Cache-Control` response headers and is private to one user. A **CDN** or reverse proxy is a shared cache near users; it is ideal for public, identical-for-everyone responses such as café details or photo thumbnails and is controlled by `Cache-Control` (`s-maxage` targets shared caches) plus purge APIs. An **in-process cache** (a `Map` in your Node service) is the fastest, but each instance has its own copy, so instances disagree and memory is bounded. A **shared cache** like Redis or Memcached gives every instance the same view at the cost of a network hop and another system to operate. And the **database** caches too: its buffer cache is one reason a query often runs faster the second time, which is worth remembering when you compare EXPLAIN ANALYZE timings. Caching at the highest layer that is safe saves the most work.",
      "HTTP caching deserves to be your first tool for public data because it is free, standard and pushes load off your servers entirely. `Cache-Control: public, max-age=60` lets any cache reuse a response for 60 seconds. `private` restricts it to the user's own device (use it for `/v1/me/favourites`). `no-cache` means 'you may store it but must revalidate before use', usually with an `ETag` so the server can answer `304 Not Modified` without a body. `no-store` means do not store it at all (booking availability, payment pages). Content-hashed asset URLs (`/photos/abc123.webp`) can use `max-age=31536000, immutable` because a new photo gets a new URL, which is invalidation by renaming. `stale-while-revalidate` and `stale-if-error` (from RFC 5861) let caches serve slightly old content while refreshing or while the origin is failing; support for them varies across browsers and CDNs, so check yours.",
      "Inside your service there are four classic patterns. **Cache-aside** (lazy loading): the application checks the cache, on a miss reads the database and populates the cache. It is the most common because it is simple and the cache only holds data someone asked for, but the first reader after expiry pays the full cost. **Read-through** is the same flow moved behind a library or cache layer that knows how to load (the `cached(fn)` helper you will build is read-through from the caller's point of view). **Write-through** writes to the cache and the database together on every write, keeping the cache warm and fresh for keys that are written, at the cost of slower writes and caching data that may never be read. **Write-behind** (write-back) writes to the cache and flushes to the database later in batches; it makes writes very fast but risks losing data if the cache dies before flushing, so it is rare for business data like bookings or invoices and more common for counters and analytics.",
      "TTL is your safety net, not your invalidation strategy. Every cached entry should expire eventually, because every invalidation scheme has gaps (a missed event, a bug, a race), and a TTL bounds how long a mistake can live. Choose the TTL from the staleness budget and the read/write ratio: café details read thousands of times per edit can live for minutes; a 'trending near you' list recomputed every 10 minutes can have a TTL near 10 minutes; anything correctness-critical gets a short TTL plus explicit invalidation, or no cache at all. Add a little random jitter (for example plus or minus 10%) to TTLs of entries created together, so they do not all expire in the same second. Cache 'not found' results too (**negative caching**) with a short TTL, otherwise a bot requesting `/cafes/does-not-exist` in a loop bypasses your cache entirely and hammers the database.",
      "Invalidation is how you make the cache fresh sooner than the TTL. **Delete-on-write**: after committing a database update, delete the cache key so the next reader reloads. Prefer delete to set: if two writers set the cache in the opposite order to their database commits, the cache ends up with the older value indefinitely, while a delete simply forces a reload. Delete-on-write still has a known race (a reader loads the old row, the writer commits and deletes, then the reader writes the old value into the cache), which is one reason the TTL must stay; lease or version checks close it if you need to. **Versioned keys**: put a version or generation number in the key (`cafe:42:v17`, or a per-café `reviews_gen` counter used in every review-list page key) and bump it on write; old entries are never read again and simply age out. This is the cleanest way to invalidate many derived keys at once, such as every page of a list. **Event-based** invalidation publishes a 'cafe.updated' event that cache owners (other services, CDN purge workers, in-process caches on every instance) react to; it scales across services but adds delivery delays and failure modes you must monitor.",
      "Stale-while-revalidate is the pattern that makes caches feel instant. An entry has a fresh window (serve it directly), then a stale window (serve the old value immediately and start one background refresh), then it is too old (block on a reload). Users almost never wait for the origin, and freshness is still bounded by fresh plus stale windows. The cost is that the first reader after the fresh window sees slightly older data, which is exactly the trade you want for café details and exactly wrong for a booking availability check. Libraries like SWR and TanStack Query apply the same idea on the client; you will apply it on the server.",
      "A **cache stampede** (thundering herd) happens when a hot key expires or the cache restarts and hundreds of concurrent requests all miss at once and all hit the database for the same row. The database slows down, requests time out, clients retry, and you have an outage caused by your cache. Defences, in order of how often you need them: **request coalescing** (single-flight: the first miss starts the load, every other request for the same key awaits the same in-flight promise, so the origin sees one call); **stale-while-revalidate** (expiry does not cause misses at all, only background refreshes); **TTL jitter** (expiries spread out); and **probabilistic early refresh** (each read has a small, growing chance of refreshing before expiry). In-process coalescing only dedupes within one instance; across many instances, a short Redis lock (`SET key NX PX 5000`) or simply accepting N instances times one load is the next step.",
      "Design for the cache failing, because it will. If Redis is slow or down, a naive cache-aside turns every request into a database query exactly when you least expect the extra load. Use short timeouts on cache calls (tens of milliseconds, not the default seconds), treat cache errors as misses rather than request failures, and limit how many concurrent fallback queries you allow (a semaphore or circuit breaker), shedding or serving degraded responses beyond that. In the other direction, if the origin is failing, a cache can protect users by serving the last known good value for a bounded time (**stale-if-error**), which is far better than an error screen for café details. Never cache errors as if they were data, or one blip becomes minutes of failures. Also bound the cache's memory: an in-process cache without a max size and an eviction policy (LRU is the usual default) is a memory leak with a hit rate.",
      "Finally, decide per data type and write it down; this is what reviewers and interviewers look for. NearBrew café details and opening hours: CDN plus in-process cache, minutes of TTL with stale-while-revalidate, delete or purge on owner edit, stale-if-error for an hour. Photos: immutable URLs and long CDN TTLs. Review lists: versioned keys bumped on new review, short TTL. A user's favourites: private to the user, short TTL or ETag revalidation, invalidate on their own write so they read their own writes. Booking availability and payments: do not serve from cache for the decision; you may cache the calendar view for browsing with a few seconds of TTL, but the actual 'book this slot' path must check the database inside a transaction with a constraint (week 7) and return `409` if it lost the race. Being explicit about where staleness is acceptable is the whole skill.",
    ],
    examples: [
      {
        language: 'http',
        title: 'Cache-Control per NearBrew resource (HTTP and CDN layer)',
        code: `# Cafe details: public, identical for everyone, edited rarely.
GET /v1/cafes/cafe_42
200 OK
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600, stale-if-error=86400
ETag: "cafe_42-v17"

# Revalidation after max-age: cheap 304, no body, if nothing changed.
GET /v1/cafes/cafe_42
If-None-Match: "cafe_42-v17"
304 Not Modified
ETag: "cafe_42-v17"

# Photos: content-hashed URL, so a change is a new URL (invalidation by renaming).
GET /photos/cafe_42/9f2c1e7a.webp
200 OK
Cache-Control: public, max-age=31536000, immutable

# The signed-in user's favourites: never in a shared cache, always revalidate.
GET /v1/me/favourites
200 OK
Cache-Control: private, no-cache
ETag: "fav-u_19-v4"
Vary: Authorization

# Booking availability used to make a decision: do not store anywhere.
GET /v1/cafes/cafe_42/slots?date=2026-10-14
200 OK
Cache-Control: no-store`,
      },
      {
        language: 'ts',
        title: 'Cache-aside with delete-on-write, cache-failure fallback and a concurrency limit',
        code: `interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('cache timeout')), ms))]);

let dbFallbacksInFlight = 0;
const MAX_DB_FALLBACKS = 20; // protect the DB when the cache is down

export async function getCafe(kv: KV, db: Db, id: string): Promise<Cafe | null> {
  const key = 'cafe:v1:' + id;
  let cacheHealthy = true;
  try {
    const hit = await withTimeout(kv.get(key), 30);
    if (hit !== null) return hit === 'null' ? null : (JSON.parse(hit) as Cafe); // 'null' = negative cache
  } catch {
    cacheHealthy = false; // cache error = miss, never a failed request
  }

  if (!cacheHealthy && dbFallbacksInFlight >= MAX_DB_FALLBACKS) {
    throw new ServiceUnavailable('cafe details temporarily unavailable'); // shed load, -> 503 problem
  }
  dbFallbacksInFlight++;
  try {
    const cafe = await db.findCafe(id);
    const ttl = cafe ? jitter(300) : 30; // short TTL for "not found"
    if (cacheHealthy) kv.set(key, JSON.stringify(cafe), ttl).catch(() => {}); // fire and forget
    return cafe;
  } finally {
    dbFallbacksInFlight--;
  }
}

export async function updateCafeHours(kv: KV, db: Db, id: string, hours: string): Promise<void> {
  await db.updateHours(id, hours); // 1. commit the source of truth
  await kv.del('cafe:v1:' + id).catch((err) => log.warn('cache delete failed; TTL will heal', err)); // 2. delete, don't set
}

const jitter = (seconds: number) => Math.round(seconds * (0.9 + Math.random() * 0.2));`,
      },
      {
        language: 'ts',
        title: 'Versioned keys: invalidate every cached page of a list with one increment',
        code: `// KV from the previous example, plus incr(key): Promise<number> (Redis INCR).
// Every page of a cafe's review list lives under the cafe's current "generation".
async function reviewsPageKey(kv: KV, cafeId: string, cursor: string | null): Promise<string> {
  const gen = (await kv.get('reviews_gen:' + cafeId)) ?? '0';
  return ['reviews', cafeId, 'g' + gen, cursor ?? 'first'].join(':');
}

export async function getReviewsPage(kv: KV, db: Db, cafeId: string, cursor: string | null) {
  const key = await reviewsPageKey(kv, cafeId, cursor);
  const hit = await kv.get(key);
  if (hit) return JSON.parse(hit);
  const page = await db.reviewsPage(cafeId, cursor, 20); // week 3 keyset query
  await kv.set(key, JSON.stringify(page), 120);
  return page;
}

export async function addReview(kv: KV, db: Db, cafeId: string, review: NewReview) {
  await db.insertReview(cafeId, review);
  await kv.incr('reviews_gen:' + cafeId); // all old page keys become unreachable and age out by TTL
}
// Why not delete keys? You don't know which cursors were cached, and pattern deletes
// (SCAN + DEL 'reviews:42:*') are slow and racy on a busy shared cache.`,
      },
      {
        language: 'text',
        title: 'Staleness budget per data type (write this table before writing cache code)',
        code: `Data                       Allowed staleness   Layer(s)                    Invalidation                    On origin error
-------------------------  ------------------  --------------------------  ------------------------------  -------------------
Cafe details / hours       ~5 min              CDN + in-process            purge + delete on owner edit    serve stale <= 24h
Photos                     forever (per URL)   CDN, immutable              new URL per upload              n/a
Cafe review list pages     ~2 min              shared (Redis)              versioned key bump on new review serve stale <= 1h
Rating aggregate           ~10 min             shared, recomputed          TTL only                        serve stale
User's favourites          0 for own writes    private HTTP + ETag         delete on user's write          show cached + banner
Nearby search results      ~1 min              shared, key = rounded geo   TTL only (+ jitter)             serve stale
Booking slot availability  0 for the decision  none on the booking path    n/a: DB transaction + 409       fail clearly
Payments / invoices        0                   none                        n/a                             fail clearly`,
      },
    ],
    keyTakeaways: [
      "Start from a per-data staleness budget; it decides layer, TTL, invalidation and whether to cache at all.",
      "Cache at the highest safe layer: HTTP/CDN for public data, in-process for hot tiny data, shared cache for cross-instance consistency.",
      "TTL is the safety net that bounds every invalidation bug; add jitter and use short TTLs for negative results.",
      "On write, commit to the database first, then delete (not set) the key, or bump a version used in derived keys.",
      "Coalesce concurrent misses and use stale-while-revalidate to prevent stampedes; bound memory with a max size and LRU.",
      "Treat cache failures as misses with a concurrency limit, serve stale on origin error, and never cache errors or booking decisions.",
    ],
    prerequisites: [
      "Week 1: why repeated queries hit the database and what an index-backed read costs",
      "Week 3: the NearBrew API resources and keyset pagination (used for cached review pages)",
      "Promises and `async`/`await` in TypeScript",
    ],
    prerequisiteWeeks: [1, 3],
    resources: [
      {
        title: 'MDN: HTTP caching',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
        kind: 'docs',
        note: "Read the sections on private vs shared caches, freshness, validation with ETag / 304, and the common caching patterns near the end. This covers the browser and CDN layers in the explanation.",
        minutes: 12,
      },
      {
        title: 'MDN: Cache-Control header',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control',
        kind: 'docs',
        note: "Use as a reference for the directives in the first example: max-age, s-maxage, no-cache vs no-store, private, immutable, stale-while-revalidate, stale-if-error. Read the 'Use cases' part.",
        minutes: 6,
      },
      {
        title: 'RFC 5861: HTTP Cache-Control Extensions for Stale Content',
        url: 'https://www.rfc-editor.org/rfc/rfc5861',
        kind: 'docs',
        note: "Very short RFC. Read the definitions of stale-while-revalidate and stale-if-error; the TtlCache you build implements the same two windows.",
        minutes: 5,
      },
      {
        title: 'web.dev: Keeping things fresh with stale-while-revalidate',
        url: 'https://web.dev/articles/stale-while-revalidate',
        kind: 'article',
        note: "Read the walkthrough of how a request moves through the fresh, stale and expired windows. Optional if short on time.",
        minutes: 5,
        verify: true,
      },
      {
        title: 'Scaling Memcache at Facebook (NSDI 2013)',
        url: 'https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala',
        kind: 'article',
        note: "Optional depth. Read only the parts on look-aside caching, leases (which address stale sets and thundering herds) and invalidation via delete. It shows the delete-on-write race from the explanation at scale.",
        minutes: 15,
        verify: true,
      },
    ],
    exercise: {
      title: 'Build a TtlCache for NearBrew café details: coalescing, stale-while-revalidate, stale-if-error, LRU',
      scenario:
        "The NearBrew café screen calls `fetchCafeDetails(id)`, which hits a slow origin (40 ms here, hundreds in production) that sometimes fails. Opening hours may be a few minutes stale; an error screen is worse than slightly old hours. You will implement an in-process `TtlCache` and a `cached(fn)` wrapper that serve fresh hits, coalesce concurrent misses into one origin call, serve stale values while refreshing in the background, serve stale values when the origin is down, cache 'not found' briefly, and stay bounded with LRU eviction. A provided test script with a fake clock proves each behaviour.",
      setup: [
        "Node 18 or newer. No dependencies: `npx tsx` downloads the TypeScript runner on first use.",
        "`mkdir nearbrew-cache && cd nearbrew-cache`, then create `origin.ts`, `ttl-cache.ts` and `verify-cache.ts` from the starter code below.",
        "Run `npx tsx verify-cache.ts` once. All 10 tests should FAIL with TODO errors. That is your baseline.",
      ],
      steps: [
        "Read `origin.ts` and `verify-cache.ts` before writing code. Notice the injected fake clock (`now: () => clock`): tests move time forward instantly instead of sleeping, which is how you should test any time-based logic. For each test, write in one line what behaviour it pins down.",
        "Before coding, write the staleness budget for café details as a comment at the top of `ttl-cache.ts`: fresh 60 s, stale-while-revalidate 30 s, stale-if-error 5 min, negative 5 s. Then draw the timeline: `[0, ttl)` fresh, `[ttl, ttl+swr)` stale and refresh in background, beyond that block on reload (but serve stale on error until `ttl+staleIfError`).",
        "Implement `set` (store `{ value, storedAt: this.now(), ttlMs }`, using `negativeTtlMs` when the value is `null`) and the miss and fresh-hit branches of `getOrLoad`. For now, treat anything that is not fresh as a miss, and let `load` simply call `loader()` and `set` the result. Tests 1, 2 and 7 should now pass.",
        "Implement request coalescing in `load`: if `this.inFlight` has a promise for the key, return it; otherwise create `loader().then(set).finally(remove from inFlight)`, store it, and return it. Run the tests: test 3 (50 concurrent reads, 1 origin call) should pass. Temporarily remove the `inFlight` check and watch test 3 report 50 calls: that is a stampede.",
        "Implement stale-while-revalidate: when `ttlMs <= age < ttlMs + staleWhileRevalidateMs`, increment `stats.staleHits`, start `this.load(key, loader)` without awaiting it, attach `.catch(() => {})` so a failed background refresh does not become an unhandled rejection, and return the stale value immediately. Test 4 checks that the stale read does not wait for the origin and the next read sees the new version.",
        "Implement serve-stale-on-error: for entries older than the SWR window, `await this.load(...)` in a try/catch; on error, if `age < ttlMs + staleIfErrorMs`, increment `stats.staleOnError` and return the stale value, otherwise rethrow. Confirm that errors are never stored (test 6) and that very old entries do fail (test 5).",
        "Implement LRU max size: on every read, call `touch` to move the key to the end of the `Map`; in `set`, re-insert the key and, while `entries.size > maxEntries`, delete `this.entries.keys().next().value` and increment `stats.evictions`. Test 8 verifies the least recently used key is evicted, not the oldest inserted.",
        "Implement `delete` and check test 9 (delete-on-write). Then reason about a race the tests do not cover: a load for `cafe_7` is in flight, the owner updates the café and you call `delete`, and the in-flight load then calls `set` with the old value. Write a failing test 11 for it, then fix it with a per-key generation counter that `delete` increments and `load` checks before calling `set`.",
        "Run the full suite until every line prints PASS, then add a final scenario at the bottom of `verify-cache.ts` that prints `cache.stats` after 1,000 random reads over 20 café ids with `maxEntries: 10` and the clock advancing 1 s per read. Explain the hit rate you get and how it changes with `maxEntries: 25`.",
        "Write a 5-line note answering: where would this in-process cache sit relative to a CDN and Redis for NearBrew, what breaks when you run 4 instances of the service (each has its own copy, invalidation only reaches one), and why you would never put the booking-availability check behind it.",
      ],
      starter: [
        {
          language: 'ts',
          title: 'origin.ts (fake slow, flaky NearBrew origin; complete)',
          code: `// origin.ts: a fake, slow, sometimes-broken "database/API" for NearBrew cafe details.
export interface CafeDetails {
  id: string;
  name: string;
  openingHours: string;
  version: number; // bumps on every write so tests can tell fresh from stale
}

const db = new Map<string, CafeDetails>([
  ['cafe_42', { id: 'cafe_42', name: 'Bean There', openingHours: 'Mon-Fri 07:00-17:00', version: 1 }],
  ['cafe_7', { id: 'cafe_7', name: 'Grind House', openingHours: 'Daily 08:00-16:00', version: 1 }],
  ['cafe_9', { id: 'cafe_9', name: 'Little Pour', openingHours: 'Sat-Sun 09:00-15:00', version: 1 }],
]);

/** Knobs the tests turn. */
export const originControl = { calls: 0, latencyMs: 40, down: false };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Returns null when the cafe does not exist (a real 404 from the origin). Throws when "down". */
export async function fetchCafeDetails(id: string): Promise<CafeDetails | null> {
  originControl.calls += 1;
  await sleep(originControl.latencyMs);
  if (originControl.down) throw new Error('origin unavailable (503)');
  const row = db.get(id);
  return row ? { ...row } : null;
}

/** Simulates an owner editing their cafe in the NearBrew dashboard. */
export function updateCafe(id: string, patch: Partial<Omit<CafeDetails, 'id' | 'version'>>): void {
  const row = db.get(id);
  if (!row) throw new Error('no cafe ' + id);
  db.set(id, { ...row, ...patch, version: row.version + 1 });
}

export function resetOrigin(): void {
  originControl.calls = 0;
  originControl.latencyMs = 40;
  originControl.down = false;
}`,
        },
        {
          language: 'ts',
          title: 'ttl-cache.ts (types and structure provided; implement the TODOs)',
          code: `// ttl-cache.ts: in-process cache with TTL, LRU max size, request coalescing,
// stale-while-revalidate, stale-if-error and negative caching.
export interface TtlCacheOptions {
  /** How long a value is fresh. */
  ttlMs: number;
  /** After ttlMs: serve the stale value instantly and refresh in the background. */
  staleWhileRevalidateMs: number;
  /** After ttlMs: if a refresh fails, keep serving the stale value this long. */
  staleIfErrorMs: number;
  /** TTL used when the loader returns null ("not found"). */
  negativeTtlMs: number;
  /** LRU bound on entries. */
  maxEntries: number;
  /** Injectable clock so tests can time-travel. */
  now?: () => number;
}

interface Entry<V> {
  value: V;
  storedAt: number;
  ttlMs: number;
}

export interface CacheStats {
  hits: number;
  staleHits: number;
  misses: number;
  loads: number;
  staleOnError: number;
  evictions: number;
}

export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>(); // Map keeps insertion order: first key = least recently used
  private readonly inFlight = new Map<string, Promise<V>>();
  private readonly now: () => number;
  readonly stats: CacheStats = { hits: 0, staleHits: 0, misses: 0, loads: 0, staleOnError: 0, evictions: 0 };

  constructor(private readonly opts: TtlCacheOptions) {
    this.now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  set(key: string, value: V): void {
    // TODO(step 3): store { value, storedAt: now, ttlMs } (negativeTtlMs when value === null).
    // Re-insert so the key becomes most-recently-used; evict the oldest keys while size > maxEntries.
    throw new Error('TODO set ' + key + String(value));
  }

  delete(key: string): void {
    // TODO(step 8): delete-on-write invalidation.
    throw new Error('TODO delete ' + key);
  }

  async getOrLoad(key: string, loader: () => Promise<V>): Promise<V> {
    // TODO(steps 3-7). Decide by the entry's age:
    //   no entry                         -> miss: await this.load(...)
    //   age < ttlMs                      -> fresh hit
    //   age < ttlMs + staleWhileRevalidate -> return stale now, refresh in background (catch its error!)
    //   older                            -> await this.load(...); on error serve stale if
    //                                       age < ttlMs + staleIfErrorMs, else rethrow
    // Update this.stats as you go and touch() the entry on every read.
    throw new Error('TODO getOrLoad ' + key + typeof loader);
  }

  /** One origin call per key at a time; everyone else awaits the same promise. */
  private load(key: string, loader: () => Promise<V>): Promise<V> {
    // TODO(step 4): reuse this.inFlight.get(key) if present; otherwise call loader(),
    // set() the result, and always remove the in-flight entry (success or failure).
    throw new Error('TODO load ' + key + typeof loader + this.inFlight.size);
  }

  private touch(key: string, entry: Entry<V>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }
}

/** Wrap any async function: cached(fetchCafeDetails, opts)('cafe_42') */
export function cached<A extends unknown[], V>(
  fn: (...args: A) => Promise<V>,
  opts: TtlCacheOptions,
  keyOf: (...args: A) => string = (...args) => JSON.stringify(args),
): ((...args: A) => Promise<V>) & { cache: TtlCache<V> } {
  const cache = new TtlCache<V>(opts);
  const wrapped = (...args: A) => cache.getOrLoad(keyOf(...args), () => fn(...args));
  return Object.assign(wrapped, { cache });
}`,
        },
        {
          language: 'ts',
          title: 'verify-cache.ts (test-style verification with a fake clock; run with npx tsx verify-cache.ts)',
          code: `// verify-cache.ts: run with \`npx tsx verify-cache.ts\`. Every line should say PASS.
import assert from 'node:assert/strict';
import { TtlCache, cached, type TtlCacheOptions } from './ttl-cache';
import { fetchCafeDetails, updateCafe, originControl, resetOrigin, type CafeDetails } from './origin';

let clock = 0; // fake time in ms; tests move it forward explicitly
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const opts = (o: Partial<TtlCacheOptions> = {}): TtlCacheOptions => ({
  ttlMs: 60_000, staleWhileRevalidateMs: 30_000, staleIfErrorMs: 300_000, negativeTtlMs: 5_000,
  maxEntries: 100, now: () => clock, ...o,
});
const newCache = (o?: Partial<TtlCacheOptions>) => new TtlCache<CafeDetails | null>(opts(o));
const load = (c: TtlCache<CafeDetails | null>, id: string) => c.getOrLoad(id, () => fetchCafeDetails(id));

const tests: [string, () => Promise<void>][] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

test('1. miss then hit: second read does not touch the origin', async () => {
  const c = newCache();
  const a = await load(c, 'cafe_42');
  const b = await load(c, 'cafe_42');
  assert.equal(a?.name, 'Bean There');
  assert.deepEqual(a, b);
  assert.equal(originControl.calls, 1);
});

test('2. expiry: after ttl + swr window the value is reloaded synchronously', async () => {
  const c = newCache();
  await load(c, 'cafe_42');
  clock += 60_000 + 30_000 + 1;
  await load(c, 'cafe_42');
  assert.equal(originControl.calls, 2);
});

test('3. coalescing: 50 concurrent cold reads cause exactly 1 origin call', async () => {
  const c = newCache();
  const results = await Promise.all(Array.from({ length: 50 }, () => load(c, 'cafe_7')));
  assert.equal(originControl.calls, 1);
  assert.ok(results.every((r) => r?.id === 'cafe_7'));
});

test('4. stale-while-revalidate: stale value returned instantly, refreshed in background', async () => {
  const c = newCache();
  const v1 = await load(c, 'cafe_42');
  updateCafe('cafe_42', { openingHours: 'Mon-Sat 07:00-18:00' });
  clock += 60_001; // stale but inside the swr window
  const started = performance.now();
  const stale = await load(c, 'cafe_42');
  assert.ok(performance.now() - started < originControl.latencyMs / 2, 'stale read must not wait for origin');
  assert.equal(stale?.version, v1?.version);
  await sleep(originControl.latencyMs + 20); // let the background refresh land
  const fresh = await load(c, 'cafe_42');
  assert.equal(fresh?.version, (v1?.version ?? 0) + 1);
  assert.equal(originControl.calls, 2);
});

test('5. stale-if-error: origin down -> serve stale inside staleIfError, throw after it', async () => {
  const c = newCache();
  await load(c, 'cafe_9');
  originControl.down = true;
  clock += 120_000; // past ttl + swr, inside staleIfError
  const v = await load(c, 'cafe_9');
  assert.equal(v?.id, 'cafe_9');
  assert.equal(c.stats.staleOnError, 1);
  clock += 400_000; // now older than ttl + staleIfError
  await assert.rejects(load(c, 'cafe_9'), /origin unavailable/);
});

test('6. errors are not cached: next call after recovery hits origin again', async () => {
  const c = newCache();
  originControl.down = true;
  await assert.rejects(load(c, 'cafe_7'));
  originControl.down = false;
  const v = await load(c, 'cafe_7');
  assert.equal(v?.id, 'cafe_7');
  assert.equal(originControl.calls, 2);
});

test('7. negative caching: "not found" is cached briefly', async () => {
  const c = newCache();
  assert.equal(await load(c, 'cafe_missing'), null);
  assert.equal(await load(c, 'cafe_missing'), null);
  assert.equal(originControl.calls, 1);
  clock += 5_000 + 30_000 + 1; // past negative ttl + swr
  await load(c, 'cafe_missing');
  assert.equal(originControl.calls, 2);
});

test('8. max size: least recently used entry is evicted', async () => {
  const c = newCache({ maxEntries: 2 });
  await load(c, 'cafe_42');
  await load(c, 'cafe_7');
  await load(c, 'cafe_42'); // touch: cafe_7 is now least recently used
  await load(c, 'cafe_9'); // evicts cafe_7
  assert.equal(c.size, 2);
  assert.equal(c.stats.evictions, 1);
  const before = originControl.calls;
  await load(c, 'cafe_42');
  assert.equal(originControl.calls, before, 'cafe_42 should still be cached');
  await load(c, 'cafe_7');
  assert.equal(originControl.calls, before + 1, 'cafe_7 should have been evicted');
});

test('9. delete-on-write invalidation: next read sees the new version', async () => {
  const c = newCache();
  const v1 = await load(c, 'cafe_7');
  updateCafe('cafe_7', { name: 'Grind House Roasters' });
  c.delete('cafe_7');
  const v2 = await load(c, 'cafe_7');
  assert.equal(v2?.name, 'Grind House Roasters');
  assert.equal(v2?.version, (v1?.version ?? 0) + 1);
});

test('10. cached(fn) wrapper + failed background refresh does not crash the process', async () => {
  const getCafe = cached(fetchCafeDetails, opts());
  await getCafe('cafe_42');
  originControl.down = true;
  clock += 60_001; // inside swr: returns stale, background refresh fails quietly
  const v = await getCafe('cafe_42');
  assert.equal(v?.id, 'cafe_42');
  await sleep(originControl.latencyMs + 20);
  assert.equal(getCafe.cache.stats.staleHits, 1);
});

async function main(): Promise<void> {
  let failed = 0;
  for (const [name, fn] of tests) {
    resetOrigin();
    clock = 0;
    try {
      await fn();
      console.log('PASS', name);
    } catch (err) {
      failed += 1;
      console.log('FAIL', name, '\\n    ', err instanceof Error ? err.message : err);
    }
  }
  console.log(failed === 0 ? '\\nAll tests passed' : '\\n' + failed + ' test(s) failed');
  process.exitCode = failed === 0 ? 0 : 1;
}

void main();`,
        },
      ],
      expected: [
        "`npx tsx verify-cache.ts` prints PASS for all 10 tests and `All tests passed`, and exits with code 0.",
        "Test 3 shows exactly 1 origin call for 50 concurrent cold reads; without coalescing it shows 50.",
        "The stale read in test 4 returns in well under the origin latency and the following read shows `version` incremented.",
        "With the origin down, stale café details are served inside the stale-if-error window and the error is thrown after it.",
        "No `UnhandledPromiseRejection` warnings appear, even when background refreshes fail.",
        "Your added race test (step 8) fails before the generation fix and passes after it.",
      ],
      hints: [
        "Compute `age = this.now() - entry.storedAt` once at the top of `getOrLoad` and branch on it; mixing `Date.now()` with the injected clock is the most common bug here.",
        "A JavaScript `Map` iterates in insertion order, so delete-then-set moves a key to the 'most recent' end and `map.keys().next().value` is the least recently used key. No linked list needed.",
        "Put `.finally(() => this.inFlight.delete(key))` on the loader promise so failed loads also clear the in-flight slot; otherwise one failure poisons the key forever.",
        "For the step 8 race, store a `generation: Map<string, number>`; capture the generation when the load starts and only call `set` if it is unchanged when the load resolves.",
      ],
      verification: [
        "All 10 provided tests pass and your additional race test passes.",
        "Deliberately removing coalescing, the SWR `.catch`, or the `touch` call each makes a specific test fail, and you can say which.",
        "You can draw the fresh / stale-while-revalidate / stale-if-error timeline from memory and place each test on it.",
        "Your staleness-budget comment and the 5-line deployment note exist and name a data type that must not be cached.",
      ],
    },
    successChecklist: [
      "`TtlCache` passes all provided tests: hit, expiry, coalescing, SWR, stale-if-error, no error caching, negative caching, LRU, delete.",
      "In-flight invalidation race reproduced with a test and fixed with a generation check.",
      "A written staleness budget for at least five NearBrew data types, including one that must never be cached.",
      "You can explain cache-aside vs read-through vs write-through vs write-behind with one NearBrew use for each (or why not).",
      "You can describe what happens when the shared cache goes down and how your design protects the database.",
    ],
    questions: [
      {
        question:
          "After updating a café's opening hours, why should the code delete the cache key rather than set it to the new value, and what race remains even with delete?",
        answer:
          "Setting the cache on write is vulnerable to reordering: if two updates commit to the database as A then B, but their cache writes land as B then A, the cache holds A indefinitely (until TTL) while the database holds B. Deleting is order-independent; whichever delete lands last, the next reader reloads the committed value. The remaining race is a slow reader: it misses, reads the old row from the database, then the writer commits and deletes the key, and finally the slow reader writes the old value into the cache. That stale value lives until the TTL expires, which is why a TTL is mandatory. Mitigations include leases or a generation/version check (only set if the key's generation has not changed since the read started), or versioned keys.",
      },
      {
        question:
          "A popular café's cache entry expires at 12:00:00 during the lunch rush and the database CPU spikes. Explain what happened and three ways to prevent it.",
        answer:
          "This is a cache stampede: every request that arrived after expiry missed simultaneously and each one queried the database for the same row, multiplying load at the worst moment and potentially causing timeouts and retries that make it worse. First, request coalescing (single-flight) makes concurrent misses for the same key share one in-flight load, so each instance sends one query. Second, stale-while-revalidate means expiry does not produce misses at all: requests keep getting the slightly old value while one background refresh runs. Third, TTL jitter or probabilistic early refresh spreads expirations out so many hot keys do not expire together. Across many instances you can add a short distributed lock so only one instance refreshes, and you should still cap concurrent database fallbacks.",
      },
      {
        question:
          "Product asks to cache booking slot availability for 60 seconds because the slots endpoint is slow. How do you respond?",
        answer:
          "Separate browsing from deciding. A cached availability view for browsing can be acceptable with a short TTL (seconds) and invalidation on booking, as long as the UI tolerates occasionally showing a slot that is just gone. The booking action itself must never trust the cache: it must check and claim the slot in the database inside a transaction with a constraint (for example a unique index on confirmed bookings per slot, covered in week 7), and return a `409 Conflict` Problem Details response if it lost the race, so the client can refresh and offer alternatives. A 60-second TTL on the decision path would let two users book the same seat. I would also look at why the endpoint is slow (missing index, N+1 queries) before reaching for a cache, since fixing the query might remove the need entirely.",
      },
    ],
    explainPrompt:
      "Explain to an interviewer in a system design round how you would cache NearBrew café details and why you would not cache booking availability the same way. Cover the layers you would use, TTL and invalidation choices, how you prevent a stampede, and what happens when the cache or the origin fails.",
    rubric: [
      "Starts from staleness requirements per data type rather than from a technology.",
      "Names concrete layers (HTTP/CDN, in-process, shared) with a reason for each, and a specific TTL with justification.",
      "Describes invalidation precisely (commit then delete, versioned keys or purge) and keeps TTL as the safety net.",
      "Explains stampede prevention (coalescing, stale-while-revalidate, jitter) and failure handling (cache down, origin down).",
      "Draws a clear line for booking availability: cache for browsing at most, database transaction and 409 for the decision.",
      "Concise and structured, like a real interview answer, with trade-offs stated.",
    ],
    referenceExplanation:
      "I'd start from how stale each thing may be. Café details and opening hours change maybe weekly and are identical for every user, so a few minutes of staleness is fine. Booking availability decides whether we sell a slot, so it may not be stale at all on the booking path. For café details I'd use two layers. At the edge, `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` with an ETag, so the CDN absorbs most reads. In the service, a small in-process cache, or Redis if instances need to agree, using cache-aside with a 5-minute TTL plus jitter, and a short negative TTL for unknown ids. When an owner edits their café, we commit to Postgres, then delete the cache key and purge the CDN path. The TTL stays as the safety net, because invalidation can miss. To avoid a stampede on a hot café, I'd coalesce concurrent misses so each instance makes one origin call, and serve stale while revalidating so expiry doesn't cause misses at all. For failures: if Redis is slow, a 30 ms timeout makes it count as a miss, with a cap on concurrent database fallbacks. If Postgres is down, we serve the last known details for up to a day, which beats an error screen. Booking availability is different. The calendar a user browses can be cached for a few seconds and invalidated on booking. But the 'book' request never trusts a cache. It claims the slot in a transaction backed by a unique constraint and returns 409 if someone else got it first. So the cache speeds up browsing, and the database stays the only thing that decides a booking.",
    stretch: {
      title: 'Two-tier cache with cross-instance invalidation',
      description:
        "Put your `TtlCache` in front of a shared tier: run `docker run -p 6379:6379 -d redis:7` and use the `redis` npm client so that a miss checks Redis before the origin. Start two instances of a tiny `node:http` server exposing `GET /v1/cafes/:id` and `PATCH /v1/cafes/:id`. Make the PATCH delete the Redis key and publish a `cafe.updated` message on a Redis channel that both instances subscribe to and use to delete their in-process entry. Measure how long the other instance serves stale data with and without the pub/sub message, then stop Redis and confirm both instances keep serving (in-process cache plus a capped origin fallback) instead of failing.",
    },
    lightTask:
      "In 30 minutes: create the three starter files and implement only `set`, `delete`, the fresh-hit and miss branches of `getOrLoad`, and coalescing in `load`. Get tests 1, 3 and 9 to PASS. Then write five lines naming, for café details, review lists, favourites, photos and booking availability, the TTL you would choose and how you would invalidate it.",
    intensiveExtras: [
      "Add TTL jitter (plus or minus 10%) to `set` and a test that 1,000 entries created at the same instant do not all expire in the same second.",
      "Add `Cache-Control` and `ETag` headers to week 3's `GET /v1/cafes/{id}/reviews` first page and verify a `304 Not Modified` with `curl -i -H 'If-None-Match: ...'`.",
      "Implement probabilistic early refresh: in the fresh window, refresh in the background with probability rising from 0 to 1 as age approaches `ttlMs`, and measure how it changes `stats.staleHits` in the 1,000-read simulation.",
      "Write a one-page comparison of cache-aside, read-through, write-through and write-behind for NearBrew check-in counts, including what data you lose with write-behind if the cache restarts.",
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['system-design', 'production-reliability', 'backend-services'],
    depth: 'detailed',
  },
];
