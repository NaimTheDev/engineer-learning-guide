import type { Lesson } from '../types';

export const weeks46to52: Lesson[] = [
  // ---------------------------------------------------------------------------
  // Week 46
  // ---------------------------------------------------------------------------
  {
    week: 46,
    slug: 'selective-algorithms-trees-graphs-heaps-dp',
    title: 'Selective algorithms II: trees, graphs, heaps/top-k, intro to dynamic programming',
    track: 'interview',
    secondaryTracks: ['cs'],
    topics: ['binary trees', 'DFS', 'BFS', 'graphs', 'topological sort', 'heaps', 'top-k', 'dynamic programming', 'memoization'],
    objective:
      'By the end you can recognise four high-yield problem patterns (tree recursion, graph traversal, top-k with a heap, and 1-D dynamic programming) and solve a well-known example of each inside a 25-minute time box while narrating your reasoning.',
    whyItMatters:
      'Coding rounds reward pattern recognition far more than volume. A small set of patterns covers a large share of commonly asked problems, and the same ideas show up in product code: tree recursion for nested comments or category menus, BFS for "within N hops", heaps for "top 10 nearest", memoization for expensive repeated work.',
    explanation: [
      'The goal this week is not to grind. It is to learn four **shapes** well enough that, when you read a new problem, you can say "this is a top-k problem, so a size-k heap gives O(n log k)" within the first two minutes. Each shape has a template you can write from memory, and most of the difficulty in interview problems is mapping the story onto the template. Budget about 25 minutes per problem: if you are stuck at 25, read a solution, close it, and re-implement it from scratch the next day. Re-implementing a solution you understood is worth more than three problems you half-solved.',
      '**Trees: let recursion return information upward.** Almost every binary-tree problem is "define what a function returns for a subtree, then combine children". Max depth returns `1 + max(left, right)`. Validate BST passes a `(min, max)` window downward and fails if a node falls outside it, which is why checking only `node.left.val < node.val` is the classic wrong answer: a node deep in the left subtree can still be larger than an ancestor. Ask two questions: what do I pass down (constraints, depth, a running path), and what do I return up (height, a boolean, a count)? When the problem says "level by level" or "closest to the root", switch to BFS with a queue and process one level at a time by snapshotting `queue.length` before the inner loop.',
      '**Graphs: adjacency list plus a visited set.** Graphs arrive in disguise: a grid (each cell has up to four neighbours), a list of prerequisite pairs, or a map of friendships. Build an adjacency list (`Map<node, node[]>`), then run DFS or BFS with a `visited` set so you never process a node twice; that set is what turns an exponential walk into O(V + E). Use BFS when you need the shortest path in an unweighted graph, because BFS reaches nodes in order of distance. For "can all courses be finished" or "what order should jobs run", use topological sort: Kahn\'s algorithm repeatedly removes nodes with in-degree zero; if you remove fewer nodes than exist, there is a cycle.',
      '**Heaps and top-k: keep only what you need.** "K largest", "K most frequent" and "K closest" all share one trick: maintain a min-heap of size k. Push each item; if the heap grows past k, pop the smallest. What remains are the k largest, in O(n log k) time and O(k) memory, which beats sorting everything (O(n log n)) when k is small and n is large or streaming. JavaScript has no built-in priority queue, so either write a 30-line binary heap (good practice, and shown below) or say explicitly in an interview: "I would use a heap here; for brevity I will sort, which costs O(n log n) instead of O(n log k)". Stating the trade-off out loud earns most of the credit.',
      '**Dynamic programming: name the state, then the recurrence.** DP is recursion where the same subproblem is solved many times. The process is mechanical: (1) define `f(i)` in words ("the fewest coins that make amount i"), (2) write the recurrence (`f(i) = 1 + min(f(i - c))` over coins c), (3) write base cases (`f(0) = 0`, impossible = Infinity), (4) add a memo or fill an array bottom-up. Climbing Stairs is Fibonacci; House Robber is "take this house plus `f(i-2)`, or skip it and take `f(i-1)`". If you can write the plain recursive version and say "this recomputes `f(3)` many times, so I will memoise it", you have demonstrated the core idea even before optimising space.',
      'Communication matters as much as code. Before writing, restate the problem, ask about input size and edge cases (empty tree, disconnected graph, k larger than n, amount 0), say the pattern and its complexity, then code. After coding, trace one small example by hand and state time and space. Here is a short, well-known list to practise from (all available on the [NeetCode practice page](https://neetcode.io/practice)): Trees: **Maximum Depth of Binary Tree**, **Validate Binary Search Tree**, **Binary Tree Level Order Traversal**. Graphs: **Number of Islands**, **Course Schedule**. Heaps: **Kth Largest Element in an Array**, **Top K Frequent Elements**, **K Closest Points to Origin**. DP: **Climbing Stairs**, **House Robber**, **Coin Change**. Do not try to do all eleven this week.',
    ],
    examples: [
      {
        language: 'ts',
        title: 'A minimal binary min-heap (enough for any top-k problem)',
        code: `export class MinHeap<T> {
  private items: T[] = [];
  constructor(private score: (item: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    let i = this.items.length - 1;
    // Bubble up while smaller than parent.
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.score(this.items[i]) >= this.score(this.items[parent])) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      // Sink down while larger than the smaller child.
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.score(this.items[l]) < this.score(this.items[smallest])) smallest = l;
        if (r < this.items.length && this.score(this.items[r]) < this.score(this.items[smallest])) smallest = r;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

// Top-k largest by score: keep a min-heap of size k, evict the smallest.
export function topK<T>(items: T[], k: number, score: (t: T) => number): T[] {
  const heap = new MinHeap<T>(score);
  for (const item of items) {
    heap.push(item);
    if (heap.size > k) heap.pop();
  }
  const out: T[] = [];
  while (heap.size) out.push(heap.pop()!);
  return out.reverse(); // largest first
}`,
      },
      {
        language: 'ts',
        title: 'Coin Change: recursion, then memoisation, then bottom-up',
        code: `// State: f(amount) = fewest coins summing to amount (Infinity if impossible).
// Recurrence: f(a) = 1 + min over coins c <= a of f(a - c). Base: f(0) = 0.

export function coinChangeMemo(coins: number[], amount: number): number {
  const memo = new Map<number, number>();
  const f = (a: number): number => {
    if (a === 0) return 0;
    if (a < 0) return Infinity;
    const cached = memo.get(a);
    if (cached !== undefined) return cached;
    let best = Infinity;
    for (const c of coins) best = Math.min(best, 1 + f(a - c));
    memo.set(a, best);
    return best;
  };
  const result = f(amount);
  return result === Infinity ? -1 : result;
}

// Same recurrence, filled in increasing order: no recursion depth limit.
export function coinChangeTable(coins: number[], amount: number): number {
  const dp = new Array<number>(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
// Time O(amount * coins.length), space O(amount).`,
      },
    ],
    keyTakeaways: [
      'Identify the pattern in the first two minutes and say its complexity before coding.',
      'Tree problems: decide what you pass down and what you return up.',
      'Graph problems: adjacency list plus a visited set; BFS for unweighted shortest paths; Kahn\'s algorithm for ordering and cycle detection.',
      'Top-k: a size-k min-heap gives O(n log k); if you sort instead, say what it costs.',
      'DP: define the state in words, write the recurrence and base cases, then memoise or tabulate.',
      'Time-box at 25 minutes; re-implementing a solution the next day beats grinding new problems.',
    ],
    prerequisites: ['Recursion and Big-O basics', 'Two pointers, sliding window and basic BFS/DFS from week 21'],
    prerequisiteWeeks: [14, 21],
    resources: [
      {
        title: 'NeetCode practice',
        url: 'https://neetcode.io/practice',
        kind: 'practice',
        note: 'Find the Trees, Graphs, Heap / Priority Queue and 1-D Dynamic Programming sections. Pick the named problems from this lesson only; watch the explanation video only after your 25-minute attempt.',
        minutes: 10,
      },
      {
        title: 'NeetCode roadmap',
        url: 'https://neetcode.io/roadmap',
        kind: 'practice',
        note: 'Look at how the topics depend on each other so you can see why trees come before graphs and graphs before DP. Skim only.',
        minutes: 5,
        verify: true,
      },
      {
        title: 'MDN: Map',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map',
        kind: 'docs',
        note: 'Refresh insertion order, `get`/`set`/`has`, and why a Map is preferable to a plain object for adjacency lists and memo tables keyed by numbers or strings.',
        minutes: 5,
      },
      {
        title: 'MDN glossary: Recursion',
        url: 'https://developer.mozilla.org/en-US/docs/Glossary/Recursion',
        kind: 'docs',
        note: 'Short refresher on base cases and the call stack; relevant to why bottom-up DP avoids stack overflows on large inputs.',
        minutes: 5,
      },
      {
        title: 'Introduction to Algorithms (Cormen, Leiserson, Rivest, Stein), MIT Press',
        url: 'https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/',
        kind: 'book',
        note: 'Optional reference only: the chapters on heapsort and on dynamic programming if you want the formal treatment of heap operations and optimal substructure.',
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'NearBrew-flavoured pattern drills, time-boxed',
      scenario:
        'Each drill is a well-known problem wearing a NearBrew costume: the top 5 nearest cafés from a list of coordinates (K Closest Points), the depth of the café category menu (Max Depth), counting separate "café clusters" on a city grid (Number of Islands), and the fewest loyalty stamps of sizes 1, 3 and 4 to reach a reward (Coin Change). You will solve four, one per pattern, with a 25-minute cap each.',
      setup: [
        'Create a folder `algos46` and run `npm init -y` inside it.',
        'Save the starter below as `drills.ts`. Run it with `npx tsx drills.ts` (tsx downloads on first run; no global install needed).',
        'Have a timer ready and a blank sheet of paper for each problem.',
      ],
      steps: [
        'For each drill, before typing: write on paper the pattern name, what you pass down/return up (trees) or the state and recurrence (DP), and the expected time and space complexity. Spend at most 3 minutes on this.',
        'Implement `kNearest` using the `MinHeap` example from this lesson (copy it into the file). Hint for direction: to keep the k smallest distances, score by negative distance so the heap evicts the farthest.',
        'Implement `maxDepth` recursively. Then, if time allows, a BFS version that counts levels.',
        'Implement `countClusters` with DFS or BFS over the grid, marking visited cells. Make sure diagonal cells are not neighbours.',
        'Implement `fewestStamps` with memoisation first, then convert to a bottom-up table.',
        'Run the file. All checks should print PASS. If a drill passes the 25-minute cap, stop, read the matching NeetCode explanation, and note in a `notes.md` exactly which step you missed.',
        'Pick one of the named problems you did not do (for example Course Schedule) and attempt it on the NeetCode site under the same 25-minute rule.',
        'Tomorrow (or at the start of next week), re-implement the hardest drill from a blank file without looking.',
      ],
      starter: [
        {
          language: 'ts',
          title: 'drills.ts',
          code: `// Paste the MinHeap class from the lesson example here.

type Point = { id: string; x: number; y: number };
type TreeNode = { name: string; children: TreeNode[] };

export function kNearest(cafes: Point[], me: { x: number; y: number }, k: number): string[] {
  // TODO: size-k heap. Return ids sorted nearest first.
  return [];
}

export function maxDepth(root: TreeNode | null): number {
  // TODO: 0 for null, 1 for a leaf.
  return 0;
}

export function countClusters(grid: string[]): number {
  // '#' = cafe cell, '.' = empty. 4-directional neighbours only.
  return 0;
}

export function fewestStamps(sizes: number[], target: number): number {
  // TODO: -1 if impossible.
  return 0;
}

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'PASS ' : 'FAIL ') + name, ok ? '' : { actual, expected });
}

const cafes: Point[] = [
  { id: 'a', x: 5, y: 5 }, { id: 'b', x: 1, y: 1 }, { id: 'c', x: -2, y: 0 },
  { id: 'd', x: 10, y: -3 }, { id: 'e', x: 0, y: 3 },
];
check('kNearest', kNearest(cafes, { x: 0, y: 0 }, 3), ['b', 'c', 'e']);
check('kNearest k > n', kNearest(cafes, { x: 0, y: 0 }, 10).length, 5);

const menu: TreeNode = {
  name: 'Drinks',
  children: [
    { name: 'Coffee', children: [{ name: 'Espresso', children: [{ name: 'Ristretto', children: [] }] }] },
    { name: 'Tea', children: [] },
  ],
};
check('maxDepth', maxDepth(menu), 4);
check('maxDepth null', maxDepth(null), 0);

check('countClusters', countClusters(['##..', '#...', '..##', '...#']), 2);
check('countClusters diagonal', countClusters(['#.', '.#']), 2);
check('countClusters empty', countClusters([]), 0);

check('fewestStamps', fewestStamps([1, 3, 4], 6), 2);
check('fewestStamps impossible', fewestStamps([2], 3), -1);
check('fewestStamps zero', fewestStamps([1, 5], 0), 0);
check('fewestStamps large', fewestStamps([1, 5, 10, 25], 10000), 400);`,
        },
      ],
      expected: [
        'All eleven checks print PASS.',
        '`fewestStamps` with the table version handles target 10000 instantly; a naive recursive version without a memo will hang or be very slow, which is the point of the drill.',
        'Your notes contain, for each drill, the pattern, complexity, and the time you took.',
      ],
      hints: [
        'Greedy fails for stamps [1, 3, 4] and target 6: greedy picks 4 + 1 + 1 (three stamps) but 3 + 3 is two. That is why this needs DP.',
        'For the grid, either keep a `Set` of "r,c" strings or copy the grid into a mutable `string[][]` and overwrite visited cells with `.`.',
        'For kNearest you can compare squared distances; the square root does not change the ordering.',
        'If the memoised recursive version overflows the stack on large targets, that is your cue to switch to the bottom-up table.',
      ],
      verification: [
        'Run `npx tsx drills.ts` and confirm all PASS lines.',
        'Explain each solution aloud in under 90 seconds, including complexity, without looking at the code.',
        'Re-implement one drill from a blank file the following day and time yourself.',
      ],
    },
    successChecklist: [
      'Solved at least four problems, one per pattern, each inside a 25-minute time box (or logged precisely where you got stuck).',
      'Wrote a working binary heap or justified using sort with the correct complexity cost.',
      'Can state the DP state, recurrence and base case for Coin Change from memory.',
      'Can explain why Validate BST needs a (min, max) window rather than a parent comparison.',
      'Re-implemented one solution from scratch on a later day.',
    ],
    questions: [
      {
        question: 'Why is a size-k min-heap better than sorting for "top 10 cafés by rating out of 2 million", and when would sorting be perfectly fine?',
        answer:
          'Sorting costs O(n log n) time and usually needs the whole array in memory. A size-k min-heap processes each item with O(log k) work and only ever holds k items, so the total is O(n log k) time and O(k) space, which matters when n is huge or arrives as a stream. With k = 10, log k is tiny, so the heap is effectively linear. Sorting is fine when n is small (a few thousand items in a UI), when you need the whole list sorted anyway, or when the data already lives in a database where `ORDER BY rating DESC LIMIT 10` with an index does the work for you. In an interview, say which you are choosing and why.',
      },
      {
        question: 'In Number of Islands, what goes wrong if you forget to mark cells as visited, and why does marking make the algorithm O(rows x cols)?',
        answer:
          'Without marking, DFS from one land cell moves to its neighbour and then back again, recursing forever (or until the stack overflows), and even with a guard you would count the same island multiple times. Marking a cell when you first reach it guarantees each cell is expanded at most once. Each expansion checks at most four neighbours, so the total work is proportional to the number of cells: O(rows x cols) time. Space is O(rows x cols) in the worst case for the recursion stack or queue, for example when the whole grid is land.',
      },
      {
        question: 'Explain how you would recognise that a problem needs dynamic programming rather than greedy, using House Robber as the example.',
        answer:
          'Two signals: the problem asks for an optimum (max, min, count of ways) and a local choice affects which future choices are allowed. In House Robber, robbing house i forbids robbing house i - 1, so greedily taking the biggest available house can block two smaller houses whose sum is larger: with values [2, 3, 2], greedy takes 3 and gets 3, while 2 + 2 = 4. Try to find a counterexample to greedy quickly; if you find one, define a state. Here f(i) is the best total using houses 0..i, and f(i) = max(f(i-1), f(i-2) + value[i]). The overlapping subproblems (f(i-2) is used by both f(i) and f(i-1)) are what make memoisation pay off.',
      },
    ],
    explainPrompt:
      'Explain to an interviewer, as if you just finished Coin Change, how you recognised it as dynamic programming, what your state and recurrence are, and the time and space complexity of your solution. Then explain in two sentences how the same thinking applies to a non-interview problem in NearBrew.',
    rubric: [
      'Named the pattern and why greedy fails, with a concrete counterexample.',
      'Defined the state in plain words before giving the recurrence.',
      'Gave base cases and how "impossible" is represented.',
      'Stated time and space complexity correctly with the variables named.',
      'Connected the idea to real product code without overclaiming.',
    ],
    referenceExplanation:
      'The question asks for the fewest coins to reach an amount, which is an optimisation where each choice changes what is left, so I first checked whether greedy works. It does not: with coins 1, 3 and 4 and amount 6, taking the largest coin first gives 4 + 1 + 1, three coins, while 3 + 3 is two. Once greedy fails on an optimisation problem, I look for a state. I defined f(a) as "the fewest coins that sum exactly to a". For any coin c no larger than a, I can use c and then solve the smaller problem, so f(a) = 1 + min over coins of f(a - c). The base case is f(0) = 0, and I use Infinity for amounts that cannot be made, converting that to -1 at the end. A plain recursive version recomputes the same amounts many times, so I memoised it, and then rewrote it bottom-up as an array from 0 to amount, which also avoids recursion-depth limits. Time is O(amount x number of coins) because each amount looks at every coin once, and space is O(amount) for the table. In NearBrew, the same habit applies whenever a computation repeats with the same inputs, such as computing opening-hours status for many cafés that share a schedule: name the input that determines the output, cache on it, and make sure the cache key captures everything the result depends on.',
    stretch: {
      title: 'Course Schedule II with cycle reporting',
      description:
        'Solve Course Schedule II (return a valid order) using Kahn\'s algorithm, then extend it to report which nodes are part of a cycle when no order exists. Frame it as ordering NearBrew database migrations that declare dependencies on each other.',
    },
    lightTask:
      'Set a 25-minute timer and solve Maximum Depth of Binary Tree and Climbing Stairs on paper or in a scratch file. For each, write one line stating the pattern, the recurrence or return value, and the complexity.',
    intensiveExtras: [
      'Solve Course Schedule and Top K Frequent Elements from the named list, each under the 25-minute rule.',
      'Implement Binary Tree Level Order Traversal both with BFS and with DFS carrying a depth parameter, and compare the code.',
      'Record yourself solving one drill out loud for 20 minutes and note every place you went quiet for more than 30 seconds.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['cs-fundamentals', 'js-ts', 'technical-communication'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 47
  // ---------------------------------------------------------------------------
  {
    week: 47,
    slug: 'system-design-notification-system',
    title: 'System design: design a notification system (push, email, in-app; NearBrew)',
    track: 'interview',
    secondaryTracks: ['system-design', 'backend'],
    topics: ['notifications', 'fan-out', 'user preferences', 'deduplication', 'rate limiting', 'push tokens', 'APNs', 'FCM', 'transactional outbox', 'retries'],
    objective:
      'By the end you can design a multi-channel notification system for NearBrew end to end, from domain event to delivered push or email, and defend your choices on fan-out, preferences, deduplication, rate limits, retries and push-token hygiene.',
    whyItMatters:
      'Notifications are where many distributed-systems ideas meet a user\'s phone: at-least-once delivery becomes "you sent me the same push three times", missing rate limits become uninstalls, and stale push tokens quietly waste provider quota. It is a common design question because it exercises queues, idempotency and product judgment together, and NearBrew needs it for real.',
    explanation: [
      'Start with requirements, because they decide everything. For NearBrew: **transactional** notifications ("Your friend Sam checked in at Kiln Coffee", "Your review got a reply"), **digest or marketing** notifications ("3 new cafés opened near you this week"), and an **in-app inbox** that shows everything even when push is disabled. Channels are push (iOS and Android), email, and in-app. Non-functional requirements: a friend\'s check-in should arrive within seconds to a minute; never send the same notification twice on one channel; respect preferences and quiet hours; survive provider outages without losing messages. Ask the scale question early: 100k users with a few notifications each per day is a single Postgres-backed worker; 50 million is partitioned queues. Design for the stated number and say what changes at 100x.',
      'The pipeline has clear stages. (1) A domain event happens in the main app (`checkin.created`). It is written in the same database transaction as the check-in using the **transactional outbox** from week 41, so you never commit a check-in without its event or publish an event for a rolled-back check-in. (2) A relay publishes outbox rows to a queue. (3) The **notification service** consumes the event, works out recipients (fan-out), and for each recipient and channel checks eligibility: preferences, quiet hours, rate limits, valid tokens. (4) Eligible messages are written as `notification` rows and enqueued per channel. (5) Channel workers call providers: APNs or FCM for push (or Expo\'s push service if the app uses Expo), an email provider\'s API for email; the in-app channel is just the row in the inbox table. (6) Results update a delivery status. Each stage is a queue boundary (week 10), so a slow email provider never delays push.',
      '**Fan-out** is the part interviewers probe. A check-in notifies the user\'s friends: typically tens to hundreds of recipients, so the service can expand it inline into per-recipient jobs. A café announcement to everyone who favourited it might be 50,000 recipients; expanding that in one transaction is slow and fragile, so expand in batches (a job per 1,000 recipients, paginated by user id with keyset pagination from week 16). For the in-app inbox you also choose between fan-out on write (insert a row per recipient, fast reads, the usual choice for personal notifications) and fan-out on read (store one broadcast and merge it into each inbox at query time, which avoids 50,000 inserts for announcements). Many systems use both: write for personal, read for broadcast.',
      '**Preferences, dedupe and rate limits** protect the user. Preferences are per user, per category (social, reviews, marketing) and per channel, plus quiet hours in the user\'s own time zone; marketing push and email should be opt-in. Delivery is at-least-once everywhere (week 41), so retries and redeliveries are normal and must be harmless: give each notification an idempotency key such as `checkin:812:user:44:push` and enforce it with a unique constraint, so a duplicate insert fails and the worker treats that as "already done" (week 10). Rate limits (week 38) apply at two levels: per user ("at most 5 social pushes per hour; beyond that, collapse into \'Sam and 4 others checked in nearby\'") and per provider (a token bucket sized to the provider\'s throughput so a broadcast does not trigger throttling).',
      '**Retries and provider failure** follow week 34. Classify provider responses: transient errors (timeouts, HTTP 5xx, 429 throttling) are retried with exponential backoff and jitter, honouring any `Retry-After` header, up to a cap, then moved to a dead-letter table for inspection. Permanent errors are not retried. The important permanent case for push is an invalid token: APNs responds with status 410 and reason `Unregistered`, and FCM returns an `UNREGISTERED` error, both meaning the app was uninstalled or the token rotated. The worker must delete or deactivate that token. Add a circuit breaker per provider so a full outage pauses the channel instead of burning retries, and set a TTL: a "friend checked in" push that is six hours late is worse than none, so drop it (the in-app row still exists).',
      '**Push tokens** are their own small data model. A user has many devices; each device has a token that the OS can rotate at any time. Store `device_tokens(user_id, platform, token UNIQUE, app_version, last_seen_at, revoked_at)`. The app registers its token on every launch (an upsert that refreshes `last_seen_at` and reassigns the token if a different user is now signed in on that device), removes it on sign-out, and the server prunes tokens that providers reject or that have not been seen for months. Treat token payloads as personal data, and keep sensitive content out of the push body itself: "Sam replied to your review" is fine, the full private message is not. Finally, measure: sent, delivered (where the provider reports it), opened, and opt-out rate per category. A rising opt-out rate is the product-level signal that your rate limits are too loose.',
    ],
    examples: [
      {
        language: 'sql',
        title: 'Core tables: preferences, tokens, notifications with an idempotency key',
        code: `CREATE TABLE notification_preferences (
  user_id      bigint NOT NULL,
  category     text   NOT NULL CHECK (category IN ('social','reviews','marketing')),
  channel      text   NOT NULL CHECK (channel IN ('push','email','in_app')),
  enabled      boolean NOT NULL,
  PRIMARY KEY (user_id, category, channel)
);

CREATE TABLE device_tokens (
  id            bigserial PRIMARY KEY,
  user_id       bigint NOT NULL,
  platform      text   NOT NULL CHECK (platform IN ('ios','android')),
  token         text   NOT NULL UNIQUE,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);

CREATE TABLE notifications (
  id               bigserial PRIMARY KEY,
  idempotency_key  text NOT NULL UNIQUE,      -- e.g. 'checkin:812:user:44:push'
  user_id          bigint NOT NULL,
  channel          text   NOT NULL,
  category         text   NOT NULL,
  payload          jsonb  NOT NULL,
  status           text   NOT NULL DEFAULT 'pending', -- pending|sending|sent|failed|dead|expired
  attempts         int    NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_due ON notifications (next_attempt_at) WHERE status = 'pending';

-- A worker claims a batch without blocking other workers.
UPDATE notifications SET status = 'sending', attempts = attempts + 1
WHERE id IN (
  SELECT id FROM notifications
  WHERE status = 'pending' AND next_attempt_at <= now() AND channel = 'push'
  ORDER BY next_attempt_at
  LIMIT 100
  FOR UPDATE SKIP LOCKED
)
RETURNING id, user_id, payload, attempts, expires_at;`,
      },
      {
        language: 'ts',
        title: 'Handling a push provider result (sketch)',
        code: `type ProviderResult =
  | { kind: 'ok' }
  | { kind: 'transient'; retryAfterSeconds?: number } // timeout, 5xx, 429
  | { kind: 'invalid-token' }                        // APNs 410 Unregistered, FCM UNREGISTERED
  | { kind: 'permanent'; reason: string };           // malformed payload, auth misconfig

const MAX_ATTEMPTS = 6;

function backoffSeconds(attempt: number): number {
  const cap = 15 * 60;
  const exp = Math.min(cap, 2 ** attempt * 5);
  return Math.random() * exp; // full jitter
}

export async function onResult(n: { id: number; attempts: number; tokenId: number }, r: ProviderResult, db: Db) {
  switch (r.kind) {
    case 'ok':
      return db.markSent(n.id);
    case 'invalid-token':
      await db.revokeToken(n.tokenId);
      return db.markFailed(n.id, 'invalid-token'); // do not retry
    case 'permanent':
      return db.markDead(n.id, r.reason);          // alert if this rate rises
    case 'transient': {
      if (n.attempts >= MAX_ATTEMPTS) return db.markDead(n.id, 'max-attempts');
      const delay = Math.max(r.retryAfterSeconds ?? 0, backoffSeconds(n.attempts));
      return db.reschedule(n.id, delay);           // status back to 'pending'
    }
  }
}

interface Db {
  markSent(id: number): Promise<void>;
  markFailed(id: number, reason: string): Promise<void>;
  markDead(id: number, reason: string): Promise<void>;
  reschedule(id: number, delaySeconds: number): Promise<void>;
  revokeToken(tokenId: number): Promise<void>;
}`,
      },
    ],
    keyTakeaways: [
      'Clarify categories, channels, latency and scale before drawing boxes.',
      'Write the domain event with the business change via a transactional outbox; everything after it is at-least-once.',
      'Expand small fan-outs inline and large ones in batches; consider fan-out on read for broadcasts.',
      'Dedupe with an idempotency key backed by a unique constraint; rate limit per user and per provider.',
      'Retry transient provider errors with backoff and jitter, never retry permanent ones, and revoke tokens the provider rejects.',
      'Give time-sensitive notifications an expiry; the in-app inbox is the durable record.',
    ],
    prerequisites: ['Queues, retries and idempotency (week 10)', 'Timeouts, backoff and circuit breakers (week 34)', 'Rate limiting (week 38)', 'Transactional outbox and at-least-once delivery (week 41)'],
    prerequisiteWeeks: [10, 16, 34, 37, 38, 41],
    resources: [
      {
        title: 'System Design Interview, Volume 1 (Alex Xu)',
        url: 'https://bytebytego.com',
        kind: 'book',
        note: 'Read the chapter on designing a notification system. Compare its component diagram with the pipeline in this lesson and note one thing it covers that you did not.',
        minutes: 15,
        verify: true,
      },
      {
        title: 'Firebase Cloud Messaging documentation',
        url: 'https://firebase.google.com/docs/cloud-messaging',
        kind: 'docs',
        note: 'Skim the overview and the section on managing registration tokens (token freshness and removing stale tokens).',
        minutes: 8,
      },
      {
        title: 'Apple: User Notifications framework',
        url: 'https://developer.apple.com/documentation/usernotifications',
        kind: 'docs',
        note: 'Skim how an app registers for remote notifications and receives a device token, and the page on handling notification responses from APNs.',
        minutes: 5,
      },
      {
        title: 'Pattern: Transactional outbox (microservices.io)',
        url: 'https://microservices.io/patterns/data/transactional-outbox.html',
        kind: 'article',
        note: 'Reread to connect week 41 to this design: the check-in and its event commit together.',
        minutes: 5,
        verify: true,
      },
      {
        title: 'Expo push notifications overview',
        url: 'https://docs.expo.dev/push-notifications/overview/',
        kind: 'docs',
        note: 'Relevant if NearBrew uses Expo: read how Expo push tickets and receipts work, since receipts are where you discover invalid tokens.',
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'Design NearBrew notifications, then prove dedupe and claiming in Postgres',
      scenario:
        'NearBrew is adding three notifications: "a friend checked in near you" (social, push + in-app), "someone replied to your review" (reviews, push + email + in-app), and "weekly new cafés near you" (marketing, email, opt-in). You have 80k users today and expect 1M within a year. Produce a design on paper, then validate the riskiest mechanics in a local database.',
      setup: [
        'Paper or a whiteboard tool for the design.',
        'Run `docker run --name nb-notify -e POSTGRES_PASSWORD=pg -p 5432:5432 -d postgres:16` and connect with `docker exec -it nb-notify psql -U postgres`.',
      ],
      steps: [
        'Spend 10 minutes writing requirements: functional (the three notifications, inbox), non-functional (latency per category, no duplicates per channel, quiet hours), and scale estimates (notifications per day now and at 1M users; peak per second when the weekly digest goes out).',
        'Draw the pipeline: check-in transaction with outbox row, relay, queue, notification service (recipient expansion, eligibility), per-channel queues, workers, providers, status updates, inbox. Label which arrows are at-least-once.',
        'Decide fan-out for each notification type and write one sentence justifying it (for example, the weekly digest is batched by user-id ranges and scheduled by time zone).',
        'Write down the idempotency key format for each notification type and where it is enforced.',
        'Define rate limits: a per-user cap per category and the collapse message when exceeded, plus a per-provider token bucket.',
        'In psql, create the three tables from the lesson example. Insert the same notification twice with the same `idempotency_key` using `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id` and observe the second insert returns no row.',
        'Insert 300 pending push notifications with `generate_series`. Open two psql sessions, run `BEGIN;` and the claim query in both (without committing the first), and confirm they receive different rows because of `SKIP LOCKED`.',
        'Write a failure table: for APNs/FCM timeout, 429, invalid token, and full provider outage, state the action (retry with backoff, honour Retry-After, revoke token, open circuit) and what the user sees.',
      ],
      starter: [
        {
          language: 'sql',
          title: 'Seed and dedupe check',
          code: `-- after creating the tables from the lesson example
INSERT INTO notifications (idempotency_key, user_id, channel, category, payload, expires_at)
VALUES ('checkin:812:user:44:push', 44, 'push', 'social', '{"title":"Sam checked in at Kiln"}', now() + interval '1 hour')
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id;   -- run twice: first returns an id, second returns 0 rows

INSERT INTO notifications (idempotency_key, user_id, channel, category, payload, expires_at)
SELECT 'checkin:900:user:' || g || ':push', g, 'push', 'social', '{}'::jsonb, now() + interval '1 hour'
FROM generate_series(1, 300) AS g;

-- per-user rate check: how many social pushes in the last hour?
SELECT count(*) FROM notifications
WHERE user_id = 44 AND category = 'social' AND channel = 'push'
  AND created_at > now() - interval '1 hour' AND status <> 'expired';`,
        },
      ],
      expected: [
        'A one-page diagram with every stage, queue boundary and data store labelled.',
        'The duplicate insert returns zero rows instead of raising an error or creating a second notification.',
        'Two concurrent claim transactions each get 100 distinct ids with no overlap.',
        'A failure table with a specific action for each provider response class.',
      ],
      hints: [
        'Quiet hours are easiest as a delay: if a social push becomes eligible during quiet hours and will still be useful, set `next_attempt_at` to the end of quiet hours; otherwise expire it and rely on the inbox.',
        'Check the rate limit and insert in a way that tolerates races (for example a counter row updated atomically, or accepting slight overshoot and documenting it).',
        'For the weekly digest, the expensive part is the "new cafés near each user" query, not sending. Consider precomputing per area rather than per user.',
        'Remember a user can have several devices; the idempotency key is per notification and channel, while delivery is per token.',
      ],
      verification: [
        'Present the design aloud in 10 minutes to a rubber duck or a recording, covering requirements, pipeline, fan-out, dedupe, rate limits, retries and tokens.',
        'Your psql session shows the duplicate insert returning 0 rows and the two-session claim test producing disjoint sets.',
        'For each of weeks 10, 34, 38 and 41, you can point to the exact part of your design that uses it.',
      ],
    },
    successChecklist: [
      'Requirements include categories, channels, latency targets and a numeric scale estimate.',
      'The diagram shows the outbox, queues per channel, and where at-least-once delivery happens.',
      'Fan-out strategy is chosen per notification type with a reason.',
      'Idempotency keys are defined and enforced by a unique constraint, verified in Postgres.',
      'Rate limits exist per user and per provider, with a collapse behaviour.',
      'Provider failures are classified and invalid tokens are revoked.',
    ],
    questions: [
      {
        question: 'A worker sends a push successfully but crashes before marking the notification as sent. What happens, and how do you limit the damage?',
        answer:
          'When the worker\'s claim times out, the row is returned to pending and another worker sends it again, so the user may get a duplicate. Exactly-once delivery to a phone is not achievable across a provider boundary, so you reduce the window instead: mark sent immediately after the provider call, keep the claim timeout reasonable, and where the provider supports it, pass a collapse identifier (APNs `apns-collapse-id`, or an FCM collapse key) so the device replaces rather than stacks a duplicate. The idempotency key still prevents duplicates being created upstream; it is the final hop that is at-least-once. Being explicit about this boundary is a strong signal in an interview.',
      },
      {
        question: 'Why would you use fan-out on write for "friend checked in" but consider fan-out on read for "Kiln Coffee announced a new seasonal menu" to 50,000 followers?',
        answer:
          'Friend check-ins have small, personal recipient lists, each recipient may have different preferences, and the inbox read path should be fast, so writing one row per recipient is cheap and simple. A café announcement to 50,000 followers is identical for everyone; writing 50,000 inbox rows creates a burst of writes and storage for content that many people will never open. With fan-out on read you store one broadcast row and merge it into each follower\'s inbox query, at the cost of a more complex read path. Push and email still need per-recipient delivery, so you would batch those jobs and pace them with the provider rate limit.',
      },
      {
        question: 'How should NearBrew manage push tokens over their lifecycle?',
        answer:
          'The app should register its token on every launch and whenever the OS reports a new one, sending it to an upsert endpoint keyed on the token that updates the user id and `last_seen_at`. On sign-out the app deletes its token so the next person on that device does not receive the previous user\'s notifications. The server revokes a token immediately when a provider reports it as invalid, such as APNs status 410 Unregistered or FCM UNREGISTERED, and periodically prunes tokens not seen for a long time. Notifications are sent to all active tokens for the user, and delivery failures for one device must not block the others.',
      },
    ],
    explainPrompt:
      'You are in a system design interview. In about five minutes, walk the interviewer from "a user checks in at a café" to "their friend\'s phone shows a push notification", naming each component and explaining how you prevent duplicates, respect preferences and handle a provider outage.',
    rubric: [
      'Started with requirements and a scale estimate rather than components.',
      'Explained why the outbox is needed and where at-least-once delivery applies.',
      'Described dedupe concretely (key format plus unique constraint), not just "make it idempotent".',
      'Covered preferences, quiet hours and per-user rate limits.',
      'Covered retries with backoff, permanent errors and token revocation.',
      'Mentioned what changes at 10x to 100x scale.',
    ],
    referenceExplanation:
      'First I would confirm scope: social, review and marketing notifications across push, email and an in-app inbox, around 80k users growing to a million, with social pushes expected within a minute. When a user checks in, the API writes the check-in and an outbox row in one transaction, so we never notify about a check-in that rolled back. A relay publishes outbox rows to a queue. The notification service consumes the event, looks up the user\'s friends, and for each friend and channel checks preferences, quiet hours in their time zone, and a per-user rate limit; above five social pushes an hour it collapses them into one summary. Each eligible notification is inserted with an idempotency key like checkin:812:user:44:push under a unique constraint, so a redelivered event creates nothing new. The in-app inbox row is written at the same time, so it is the durable record even if push fails. Push workers claim pending rows with SKIP LOCKED and call APNs or FCM for each of the user\'s active device tokens, paced by a provider token bucket. Timeouts, 5xx and 429 are retried with exponential backoff and jitter, honouring Retry-After, then dead-lettered. An invalid-token response revokes that token and is not retried. A circuit breaker pauses the channel during an outage, and a one-hour expiry stops stale "friend checked in" pushes from arriving late. At 100x I would partition the queues by user id and batch large fan-outs.',
    stretch: {
      title: 'Digest scheduling across time zones',
      description:
        'Design the weekly "new cafés near you" email so every user receives it at 9am local time on Monday, without a thundering-herd query at midnight UTC. Include how you precompute "new cafés per area", how you schedule batches per time-zone offset, and how you resume if the job crashes halfway.',
    },
    lightTask:
      'On one page, draw the NearBrew notification pipeline from check-in to push, and write the idempotency key format plus the action you take for each of: timeout, 429, invalid token.',
    intensiveExtras: [
      'Write a small Node worker that claims rows with the SKIP LOCKED query, calls a fake provider that fails randomly 30% of the time, and applies the `onResult` logic. Confirm no notification is sent twice after killing the worker mid-run.',
      'Design the preferences settings screen for the mobile app, including what happens when OS-level notification permission is denied.',
      'Time yourself giving the full design in 35 minutes, then list the three follow-up questions you would least like to be asked and answer them.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['system-design', 'backend-services', 'production-reliability', 'technical-communication'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 48
  // ---------------------------------------------------------------------------
  {
    week: 48,
    slug: 'mentoring-and-technical-communication',
    title: 'Mentoring and technical communication',
    track: 'senior',
    topics: ['mentoring', 'pair programming', 'writing for audiences', 'feedback', 'SBI', 'code review comments', 'BLUF'],
    objective:
      'By the end you can run a productive pairing session that grows the other person\'s skills, write the same technical update for three different audiences, and give specific, actionable feedback using a simple structure.',
    whyItMatters:
      'At senior level, a large part of your impact flows through other people: the junior who can now debug alone, the PM who made the right call because your update was clear, the teammate whose code got better because your review comment explained why. These are learnable skills with simple structures, not personality traits.',
    explanation: [
      '**Mentoring is mostly asking, not telling.** When a less experienced engineer brings you a bug, the fastest thing is to fix it; the most valuable thing is to help them find it. A useful ladder: ask what they have tried and what they expected; ask a question that points at the next step ("what does the network tab show for that request?"); give a hint about where to look; and only then show the answer, explaining how you would have found it. Match the rung to the urgency. A production incident is not a teaching moment; a feature branch on a Tuesday usually is. Also be explicit about what kind of help you are giving: "I am going to give you the answer this time because we are blocked, then let\'s walk through how I knew".',
      '**Pairing works when roles are clear.** In driver/navigator pairing, the driver types and handles the immediate line of code while the navigator thinks about direction, edge cases and what comes next; swap every 15 to 25 minutes. Ping-pong pairing pairs naturally with TDD: one person writes a failing test, the other makes it pass and writes the next failing test. Strong-style pairing ("for an idea to go from your head into the computer, it must go through someone else\'s hands") is excellent for mentoring, because the less experienced person drives and the experienced person must explain intent in words rather than grabbing the keyboard. Agree on a goal and a time box at the start, take breaks, and end with two minutes of "what did we learn, what is next". Pairing is tiring; two focused hours beat a full day of passive screen-watching.',
      '**Writing for different audiences: same facts, different order.** An engineer reviewing your PR wants context, the approach, the trade-offs you considered, and how to test it. A product manager wants impact, options, risk and dates. A non-technical stakeholder wants one sentence of outcome and whether they need to do anything. Lead with the conclusion (often called BLUF, bottom line up front): "The nearby search slowdown is fixed in production; p95 dropped from 1.8s to 220ms; no action needed." Then supply detail in decreasing order of importance, so a reader can stop at any point and still have the most important information. Cut jargon for non-engineers, but do not cut precision: "about 2 seconds" is fine, "it was slow" is not.',
      '**Feedback needs a structure or it turns into vagueness.** The Situation-Behaviour-Impact model keeps it specific: describe the situation ("in yesterday\'s design review"), the observable behaviour ("you presented three caching options with measured hit rates"), and the impact ("the team decided in ten minutes instead of a second meeting"). It works for praise, which should be just as specific, and for critical feedback ("in the incident channel, the updates stopped for 40 minutes; support had nothing to tell users"). Then make a request or ask a question, not a judgment about character. Give critical feedback privately, soon, and in proportion; give positive feedback often, and publicly if they are comfortable with that.',
      '**Code review comments are feedback at scale.** Label the weight of each comment so the author knows what matters: `blocking:` for correctness or security, `suggestion:` for improvements they can take or leave, `nit:` for style, `question:` when you genuinely do not know. Explain the why ("this query runs inside the loop, so a café with 200 reviews makes 200 round-trips") and, where helpful, propose the fix. Ask questions that teach ("what happens if two users favourite the same café at once?") rather than ones that test. And notice what is good: a review that only lists problems teaches people to dread your reviews. This builds on week 20; the difference now is intent: you are reviewing to make the person better, not only the code.',
    ],
    examples: [
      {
        language: 'text',
        title: 'One change, three audiences',
        code: `Context: you fixed NearBrew's slow "Nearby" tab (missing index + N+1 query).

1) PR description (peer engineer)
Summary: Nearby endpoint replaced per-cafe rating queries with one aggregate
join and added an index on reviews(cafe_id). p95 locally 1.8s -> 210ms (seeded
500k reviews, EXPLAIN output attached).
Trade-offs: the aggregate is computed per request; a materialized rating column
would be faster but needs write-path changes. Not worth it at current traffic.
Testing: integration test asserts one query per request; manual check on staging.
Risk: index creation uses CONCURRENTLY; no lock on writes.

2) Slack to PM
Nearby tab speed fix is ready to ship today. It takes the slow case from about
2 seconds to under a quarter of a second. No UI change, low risk, and we can
roll back in minutes. I'd suggest we mention it in Friday's release notes.

3) Note to the café-partnerships lead (non-technical)
The "Nearby" screen will load noticeably faster from tomorrow. Nothing changes
for partners and there's nothing you need to do.`,
      },
    ],
    keyTakeaways: [
      'Mentor with a ladder: ask, point, hint, then show and explain how you would have found it.',
      'Make pairing roles explicit, swap regularly, time-box, and end with a short retro.',
      'Strong-style pairing forces the experienced person to explain in words, which is what transfers skill.',
      'Lead with the conclusion and order detail by importance for the specific reader.',
      'Use Situation-Behaviour-Impact for both praise and criticism, then make a request.',
      'Label review comments by weight and explain why.',
    ],
    prerequisites: ['Writing a design document (week 12)', 'Code review as a senior engineer (week 20)'],
    prerequisiteWeeks: [12, 20],
    resources: [
      {
        title: 'On Pair Programming (Birgitta Böckeler and Nina Siessegger, martinfowler.com)',
        url: 'https://martinfowler.com/articles/on-pair-programming.html',
        kind: 'article',
        note: 'Read the sections on pairing styles (driver/navigator, ping-pong, strong-style) and on the challenges of pairing, including power dynamics between experienced and less experienced pairs.',
        minutes: 15,
      },
      {
        title: 'Google Technical Writing courses',
        url: 'https://developers.google.com/tech-writing',
        kind: 'course',
        note: 'Skim Technical Writing One on audience and short, clear sentences. Pick one lesson and apply it to your three-audience exercise.',
        minutes: 10,
      },
      {
        title: 'Conventional Comments',
        url: 'https://conventionalcomments.org',
        kind: 'article',
        note: 'A short spec for labelling review comments (suggestion, issue, nitpick, question) with decorations such as non-blocking. Read the whole page; it takes five minutes.',
        minutes: 5,
        verify: true,
      },
      {
        title: 'The Manager\'s Path (Camille Fournier), O\'Reilly',
        url: 'https://www.oreilly.com/library/view/the-managers-path/9781491973882/',
        kind: 'book',
        note: 'Optional: the early chapters on being mentored and on mentoring are useful for individual contributors too; you do not need the management chapters.',
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'Three audiences, two feedback conversations, one pairing session',
      scenario:
        'Use a real change from NearBrew or freelance work in the last month (or the performance fix you will do in week 49 if you have nothing else). A hypothetical junior developer, Priya, has joined to help with the NearBrew backend, and you want her productive and independent within a month.',
      setup: [
        'A text editor, a timer, and optionally a peer or friend for the pairing step (a recorded solo session is an acceptable fallback).',
      ],
      steps: [
        'Pick the change. Write down the facts once: what was wrong, what you did, numbers, risk, what is left.',
        'Write a PR description for a peer engineer (under 200 words) with summary, approach, trade-offs, testing and risk.',
        'Write a Slack message to a PM (under 80 words) that leads with the conclusion and states impact, risk and any decision needed.',
        'Write a note for a non-technical stakeholder in two or three sentences. Read it aloud; remove any word they would need to ask about.',
        'Write SBI feedback for two scenarios: (a) positive: Priya wrote a clear reproduction for a bug that saved you an hour; (b) critical: Priya merged a migration without telling anyone and the staging app broke for the afternoon. Each must have a situation, an observable behaviour, an impact, and a request or question.',
        'Rewrite three review comments you have given or received recently using `blocking:`, `suggestion:`, `nit:` or `question:` labels and an explanation of why.',
        'Run a 30-minute strong-style pairing session with someone less familiar with the code (or record yourself narrating for an imagined driver). Task: add a "has wifi" filter to NearBrew\'s café search. You may not touch the keyboard; you must explain intent in words. End with a two-minute retro.',
        'Write five lines on what you noticed: where you wanted to grab the keyboard, which explanations failed, what you would change next time.',
      ],
      starter: [
        {
          language: 'text',
          title: 'Templates',
          code: `PR DESCRIPTION
Summary (1-2 sentences, with a number):
Approach:
Trade-offs considered:
How to test:
Risk / rollback:

PM UPDATE
Bottom line:
Impact for users:
Risk:
Decision or action needed (or "none"):

SBI FEEDBACK
Situation:
Behaviour (what you saw or heard, no adjectives about the person):
Impact (on users, team, timeline):
Request or question:

PAIRING SESSION
Goal: ............  Time box: 30 min  Swap / check-in at: 15 min
Retro: What did we learn? What is next? What would make pairing better?`,
        },
      ],
      expected: [
        'Three messages about the same change that differ clearly in order, vocabulary and length, with the conclusion first in each.',
        'Two SBI feedback scripts that describe behaviour, not personality.',
        'Three relabelled review comments, each with a why.',
        'Pairing notes identifying at least two moments where you over-helped or under-explained.',
      ],
      hints: [
        'If your PM message starts with "So, I was looking at...", move the last sentence to the top.',
        'Behaviour test: could a video camera have recorded it? "You were careless" fails; "the migration was merged without a review or a message in the channel" passes.',
        'In strong-style pairing, describe intent at the highest level the driver can act on ("add a boolean column with a default") and only drop to specifics ("type ALTER TABLE...") if they are stuck.',
        'For critical feedback, prepare the request in advance; the conversation is easier if you already know what you are asking for.',
      ],
      verification: [
        'Give the stakeholder note to someone non-technical (or imagine a specific person) and check they can say what changes for them.',
        'Check each SBI script against the camera test.',
        'Compare your pairing notes against the challenges section of the pairing article and identify one technique to try next time.',
      ],
    },
    successChecklist: [
      'Wrote the same update for three audiences with the conclusion first in each.',
      'The PR description includes a number, trade-offs, testing and rollback.',
      'Wrote two SBI feedback scripts that pass the camera test.',
      'Relabelled three review comments by weight with a reason.',
      'Ran (or simulated) a strong-style pairing session and wrote a short retro.',
    ],
    questions: [
      {
        question: 'A junior engineer asks you why their React list re-renders on every keystroke. Describe how you would help without simply giving the answer, and when you would just give it.',
        answer:
          'I would start by asking what they expected and what they have tried, then point them at a tool: "open the React Profiler, type one character, and tell me which components rendered and why". If they are stuck, I would give a hint about where to look, such as "check what props the list receives and whether any are created during render". Once they find it, I would ask them to explain the fix back and how they would spot it next time. I would just give the answer when time pressure is real (a production issue or a release deadline), when they have already spent a reasonable time and are frustrated, or when the knowledge is arbitrary rather than reasoned, like an obscure tool flag. Even then, I would follow up later with the reasoning.',
      },
      {
        question: 'What makes an update "bottom line up front", and why is it more useful for busy readers?',
        answer:
          'A BLUF update states the conclusion or decision first, such as "the fix is in production and p95 is now 220ms; no action needed", and then supplies supporting detail in decreasing order of importance. Busy readers often read only the first line or two, so putting the conclusion there ensures they get the most important information even if they stop. It also makes any request explicit early, so the reader knows whether they need to act. A chronological narrative forces the reader to reconstruct the conclusion and often hides the ask at the end. Detail is still there for those who want it; it is just ordered by value.',
      },
      {
        question: 'Rewrite the review comment "This is wrong, use a transaction" to be more useful, and explain what changed.',
        answer:
          'A better version is: "blocking: the favourite insert and the counter update can interleave with another request, so two users favouriting at once can lose an increment. Wrapping both in a transaction with `UPDATE ... SET count = count + 1` (or deriving the count with a query) would fix it. Happy to pair if useful." The label tells the author it must be addressed before merging. The explanation states the concrete failure scenario, so the author learns the concept rather than just obeying. The suggested fix lowers effort, and the offer to pair signals collaboration. It also avoids judging the person; it describes what the code does.',
      },
    ],
    explainPrompt:
      'Explain to a mid-level teammate who has just been asked to mentor a new hire how you approach mentoring: how you decide between giving answers and asking questions, how you run a pairing session, and how you give feedback that is specific and kind.',
    rubric: [
      'Described a concrete ladder or approach for help, not just "be supportive".',
      'Explained when giving the answer directly is the right call.',
      'Described pairing roles, swaps and a time box.',
      'Gave a feedback structure with a specific example.',
      'Kept it practical and short enough for a teammate to use tomorrow.',
    ],
    referenceExplanation:
      'My default with a new hire is to ask before telling. When they bring me a problem, I ask what they expected and what they tried, then point them at the next tool or place to look, then give a hint, and only then show the answer, explaining how I would have found it. I move down that ladder faster when it is urgent; an incident or a release-day blocker is not the time for Socratic questions, so I will just fix it and walk through the reasoning afterwards. For pairing, I agree a goal and a 30 to 60 minute time box up front. With someone new I like strong-style pairing: they drive, I navigate, and I am not allowed to touch the keyboard, which forces me to explain intent in words. That is exactly the skill they are trying to absorb. We swap or check in every 15 to 20 minutes and finish with two minutes on what we learned and what is next. For feedback I use situation, behaviour, impact: "In Tuesday\'s standup, you flagged the migration risk before we deployed; it saved us a broken staging environment." The same shape works for criticism, followed by a request rather than a judgement about the person. I give positive feedback often and specifically, critical feedback privately and soon. In code review, I label comments as blocking, suggestion or nit and always explain why, because the why is what they will reuse.',
    stretch: {
      title: 'Write an onboarding guide for NearBrew',
      description:
        'Write a two-page onboarding guide for a new engineer joining NearBrew: how to run the app and API locally, the three most important architectural decisions and why they were made, where the sharp edges are, and a suggested first-week task. Have someone (or your future self in a month) follow it from a clean machine and note every gap.',
    },
    lightTask:
      'Take one recent change and write it twice: a three-sentence BLUF update for a PM and a two-sentence note for a non-technical stakeholder. Then write one SBI piece of positive feedback for someone you have worked with recently.',
    intensiveExtras: [
      'Record a 5-minute explanation of a NearBrew architectural decision for a new hire, watch it back, and rewrite the parts where you used undefined jargon.',
      'Review an open-source PR on GitHub (read-only) and draft labelled comments as if you were the reviewer; compare with what the maintainers actually said.',
      'Run a second pairing session using ping-pong TDD on a small NearBrew utility, such as an opening-hours parser.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['technical-communication', 'feature-ownership'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 49
  // ---------------------------------------------------------------------------
  {
    week: 49,
    slug: 'end-to-end-performance-investigation',
    title: 'End-to-end performance engineering: from slow page to fixed (frontend + backend together)',
    track: 'frontend',
    secondaryTracks: ['backend'],
    topics: ['performance investigation', 'Server-Timing', 'TTFB', 'LCP', 'INP', 'EXPLAIN ANALYZE', 'N+1', 'React Profiler', 'virtualisation', 'useDeferredValue'],
    objective:
      'By the end you can take a page that "feels slow", split the time between network, server, database and client rendering with measurements, fix the biggest contributor at each layer, and report before-and-after numbers.',
    whyItMatters:
      'Real performance problems rarely sit in one layer. A slow page is often a slow query behind a request waterfall behind a list that re-renders on every keystroke. Engineers who can trace the whole path and prove the improvement with numbers are rare and valuable, and this is exactly the kind of story that makes a strong portfolio case study (week 51).',
    explanation: [
      'Start by **defining the symptom as a metric**. "The café list is slow" is not actionable. "On a mid-range laptop with CPU throttling at 4x, the café list takes 2.6s to show content (LCP) and typing in the filter box has 400ms interactions (INP)" is. Pick the user-facing metric that matches the complaint: LCP for "takes ages to appear", INP for "laggy when I type or tap", CLS for "things jump" (week 11). Set a target before you start, for example LCP under 1.5s locally and INP under 200ms. Without a target you will either stop too early or polish forever.',
      '**Split the time before fixing anything.** Open the DevTools Network panel and look at the main API request: the timing breakdown separates waiting for the server (TTFB) from download. If TTFB is 1.7s out of a 2.6s LCP, the problem is mostly the backend; if the API is 80ms and the page still takes 2.6s, look at the client. Add a `Server-Timing` response header from the API (for example `db;dur=1650, render;dur=12`) so DevTools shows server-side phases next to the request, which removes guesswork about where server time goes. Also look for **waterfalls**: the page fetches cafés, then, after rendering, fetches ratings for each one. Sequential requests multiply latency even when each is fast.',
      '**Backend: confirm with the database, not intuition.** Log the queries a request makes. Two classic culprits from weeks 1 and 16: an N+1 pattern (one query for 50 cafés, then 50 more queries for each café\'s rating), and a missing index (Postgres does not automatically index foreign key columns, so `reviews.cafe_id` is often unindexed and every per-café lookup becomes a sequential scan of the whole reviews table). Run `EXPLAIN (ANALYZE, BUFFERS)` on the slow query, look for `Seq Scan` on a large table with a selective filter, and check the estimated and actual row counts. The fix is usually one aggregate query with a join or `GROUP BY` plus an index on the join column. Re-run EXPLAIN and the endpoint timing to confirm.',
      '**Frontend: profile with throttling, then fix the biggest render cost.** Record a Performance trace with 4x CPU throttling while typing in the filter. Long tasks during each keystroke point to render work. Then use the React Profiler (week 2) to see which components rendered and why. Common causes: filtering and formatting 2,000 rows inline on every render, rows re-rendering because a parent recreates props, and the DOM simply being too big. Fixes in order of how often they help: avoid redoing expensive work (`useMemo` keyed on the right inputs, or precompute once when data arrives), keep the input responsive by deferring the list update (`useDeferredValue` or `startTransition`, week 30), and virtualise long lists so only visible rows exist in the DOM (week 30). For LCP, make sure the hero image or first content is not waiting on JavaScript, and that the data request starts as early as possible.',
      '**Change one thing at a time and keep a log.** Each change gets a row: hypothesis, change, metric before, metric after, and whether to keep it. This protects you from fixes that do nothing (and add complexity) and gives you the numbers for the write-up. Measure several runs and use the median, because single runs are noisy; run on a cold and warm cache if caching is involved. Finally, think about prevention: a performance budget in CI, a test that asserts the endpoint performs one query rather than N, a slow-query log threshold, or real-user monitoring of INP and LCP so regressions show up before users complain.',
    ],
    examples: [
      {
        language: 'js',
        title: 'Adding Server-Timing to a Node endpoint',
        code: `// Measure phases and expose them to DevTools.
const t0 = performance.now();
const rows = await loadCafesWithRatings(city);      // DB work
const t1 = performance.now();
const body = JSON.stringify(rows);                  // serialisation
const t2 = performance.now();

res.setHeader(
  'Server-Timing',
  'db;dur=' + (t1 - t0).toFixed(1) + ', json;dur=' + (t2 - t1).toFixed(1)
);
res.setHeader('Content-Type', 'application/json');
res.end(body);
// In Chrome DevTools: Network > select request > Timing tab shows "Server Timing".
// For a cross-origin API, also send Timing-Allow-Origin so the page can read it.`,
      },
      {
        language: 'sql',
        title: 'From N+1 with sequential scans to one indexed aggregate',
        code: `-- Before: run once per cafe (50 times per request), no index on reviews.cafe_id
SELECT avg(rating), count(*) FROM reviews WHERE cafe_id = $1;
-- EXPLAIN ANALYZE shows: Seq Scan on reviews ... Rows Removed by Filter: ~499,750

-- After: one query for the whole page
CREATE INDEX CONCURRENTLY reviews_cafe_id_idx ON reviews (cafe_id) INCLUDE (rating);

SELECT c.id, c.name, round(avg(r.rating), 2) AS avg_rating, count(r.id) AS review_count
FROM cafes c
LEFT JOIN reviews r ON r.cafe_id = c.id
WHERE c.city = $1
GROUP BY c.id
ORDER BY c.name
LIMIT 50;`,
      },
    ],
    keyTakeaways: [
      'Turn "slow" into a metric (LCP, INP, TTFB, p95) with a target before changing code.',
      'Split time across network, server, database and client before choosing a fix.',
      'Server-Timing makes backend phases visible in DevTools.',
      'Foreign keys are not indexed automatically in Postgres; N+1 plus a missing index is a common pairing.',
      'On the client: avoid repeated expensive work, defer non-urgent updates, virtualise long lists.',
      'One change at a time, medians of several runs, and a log of before and after.',
    ],
    prerequisites: ['EXPLAIN ANALYZE and indexes (weeks 1 and 16)', 'React Profiler (week 2)', 'Core Web Vitals (week 11)', 'Virtualisation and transitions (week 30)'],
    prerequisiteWeeks: [1, 2, 11, 16, 30],
    resources: [
      {
        title: 'web.dev: Web Vitals',
        url: 'https://web.dev/articles/vitals',
        kind: 'article',
        note: 'Refresh the thresholds for LCP, INP and CLS, and how each is measured in the lab versus the field.',
        minutes: 8,
      },
      {
        title: 'MDN: Server-Timing header',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing',
        kind: 'docs',
        note: 'Read the syntax and the note about Timing-Allow-Origin for cross-origin requests.',
        minutes: 5,
      },
      {
        title: 'PostgreSQL: Using EXPLAIN',
        url: 'https://www.postgresql.org/docs/current/using-explain.html',
        kind: 'docs',
        note: 'Reread the EXPLAIN ANALYZE section and how to compare estimated and actual rows.',
        minutes: 7,
      },
      {
        title: 'React: Profiler',
        url: 'https://react.dev/reference/react/Profiler',
        kind: 'docs',
        note: 'Refresh the `onRender` callback fields (actualDuration, baseDuration) so you can log render cost programmatically as well as in DevTools.',
        minutes: 5,
      },
      {
        title: 'React: useDeferredValue',
        url: 'https://react.dev/reference/react/useDeferredValue',
        kind: 'docs',
        note: 'Read the section on deferring re-rendering for a part of the UI, which is exactly the filter-box case.',
        minutes: 5,
      },
      {
        title: 'Chrome DevTools: Performance panel',
        url: 'https://developer.chrome.com/docs/devtools/performance',
        kind: 'docs',
        note: 'Skim how to record with CPU throttling and read long tasks in the main thread track.',
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'Fix the slow NearBrew "Cafés in London" page, layer by layer',
      scenario:
        'NearBrew\'s web companion has a "Cafés in a city" page: it fetches cafés with their average rating and review count, and lets users filter by name. Users say it takes ages to load and the filter box lags. You will reproduce it locally, measure, fix the backend and the frontend, and write up before-and-after numbers.',
      setup: [
        'Start Postgres: `docker run --name nb-perf -e POSTGRES_PASSWORD=pg -p 5432:5432 -d postgres:16`, then run the seed SQL below with `docker exec -i nb-perf psql -U postgres < seed.sql`.',
        'Create `api/` with `npm init -y && npm i pg`, save `server.mjs` below, and run `node server.mjs` (port 3001).',
        'Create the client with `npm create vite@latest web -- --template react-ts`, add a proxy in `vite.config.ts` (`server: { proxy: { \'/api\': \'http://localhost:3001\' } }`), and replace `src/App.tsx` with the component below.',
      ],
      steps: [
        'Write your target and baseline log: open the page with DevTools, 4x CPU throttling, cache disabled. Record API time (Network, Timing tab), TTFB, LCP (Performance panel), and the interaction duration of typing one character in the filter. Take the median of three runs.',
        'Read the Server-Timing value in the Network Timing tab. Decide which layer dominates load time.',
        'Backend: count queries per request (the server logs them). Run `EXPLAIN (ANALYZE, BUFFERS)` on the per-café query with a real id and note the scan type and rows removed.',
        'Fix the N+1 by replacing the loop with the single aggregate query from the lesson example. Re-measure.',
        'Add the index on `reviews (cafe_id)`. Re-measure and re-run EXPLAIN on the new query. Log both changes separately.',
        'Frontend: record a Performance trace while typing, then use the React Profiler to see what renders per keystroke and how long it takes.',
        'Fix the client: compute the formatted label once per row when data arrives (or `useMemo` on the data), and wrap the filtered list in `useDeferredValue` so the input stays responsive. Re-measure INP. If still slow, render only the first 100 matches or virtualise.',
        'Write a 10-line summary: symptom, target, root causes per layer, changes, before/after medians, and one prevention step.',
      ],
      starter: [
        {
          language: 'sql',
          title: 'seed.sql',
          code: `CREATE TABLE cafes (
  id serial PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL
);
CREATE TABLE reviews (
  id serial PRIMARY KEY,
  cafe_id int NOT NULL REFERENCES cafes(id),   -- note: no index on this column
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cafes (name, city)
SELECT 'Cafe ' || g, (ARRAY['London','Leeds','Bristol'])[1 + g % 3]
FROM generate_series(1, 3000) AS g;

INSERT INTO reviews (cafe_id, rating, body, created_at)
SELECT 1 + floor(random() * 3000)::int,
       1 + floor(random() * 5)::int,
       'Lovely flat white, friendly staff',
       now() - random() * interval '365 days'
FROM generate_series(1, 600000);

ANALYZE;`,
        },
        {
          language: 'js',
          title: 'api/server.mjs (deliberately slow)',
          code: `import http from 'node:http';
import pg from 'pg';

const pool = new pg.Pool({ host: 'localhost', user: 'postgres', password: 'pg', database: 'postgres' });
let queryCount = 0;
const q = (text, params) => { queryCount++; return pool.query(text, params); };

async function loadCafesWithRatings(city) {
  const cafes = (await q('SELECT id, name FROM cafes WHERE city = $1 ORDER BY name LIMIT 50', [city])).rows;
  for (const cafe of cafes) {
    // N+1: one aggregate per cafe, each a sequential scan without an index.
    const r = (await q('SELECT avg(rating)::float AS avg, count(*)::int AS n FROM reviews WHERE cafe_id = $1', [cafe.id])).rows[0];
    cafe.avgRating = r.avg;
    cafe.reviewCount = r.n;
  }
  return cafes;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/api/cafes') { res.statusCode = 404; return res.end(); }
  queryCount = 0;
  const t0 = performance.now();
  const rows = await loadCafesWithRatings(url.searchParams.get('city') ?? 'London');
  const t1 = performance.now();
  res.setHeader('Server-Timing', 'db;dur=' + (t1 - t0).toFixed(1));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(rows));
  console.log(url.pathname, 'queries=' + queryCount, 'db=' + (t1 - t0).toFixed(0) + 'ms');
}).listen(3001, () => console.log('API on http://localhost:3001'));`,
        },
        {
          language: 'tsx',
          title: 'web/src/App.tsx (deliberately slow)',
          code: `import { useEffect, useState } from 'react';

type Cafe = { id: number; name: string; avgRating: number | null; reviewCount: number };

// Simulates expensive per-row formatting (e.g. heavy date/locale/markdown work).
function slowLabel(c: Cafe): string {
  let x = 0;
  for (let i = 0; i < 40000; i++) x += Math.sqrt(i);
  return c.name + ' - ' + (c.avgRating?.toFixed(1) ?? 'no rating') + ' (' + c.reviewCount + ') ' + (x > 0 ? '' : '');
}

export default function App() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/cafes?city=London').then(r => r.json()).then((rows: Cafe[]) => {
      // Duplicate rows to make the client-side cost visible.
      setCafes(Array.from({ length: 40 }, (_, k) => rows.map(c => ({ ...c, id: c.id * 100 + k }))).flat());
    });
  }, []);

  const visible = cafes.filter(c => slowLabel(c).toLowerCase().includes(filter.toLowerCase()));

  return (
    <main>
      <h1>Cafés in London</h1>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by name" />
      <p>{visible.length} cafés</p>
      <ul>{visible.map(c => <li key={c.id}>{slowLabel(c)}</li>)}</ul>
    </main>
  );
}`,
        },
      ],
      expected: [
        'Baseline: the server logs `queries=51` and hundreds of milliseconds to seconds of db time; typing in the filter shows long tasks and noticeable lag under throttling.',
        'After the single aggregate query: `queries=1` and a large drop in db time.',
        'After the index: EXPLAIN shows an index (or index-only / bitmap) scan instead of a sequential scan for the per-café lookup, and a further reduction in db time.',
        'After the client fixes: typing stays responsive; the Profiler shows the expensive formatting no longer runs on every keystroke.',
        'A log with before/after medians for each change.',
      ],
      hints: [
        'Exact numbers vary by machine; what matters is the ratio between before and after, measured the same way.',
        'For the aggregate query with LIMIT, the planner may still scan many reviews; check whether filtering cafés first in a subquery or CTE and then joining changes the plan.',
        'Precompute labels when data arrives: map rows to `{ ...cafe, label }` once in the effect, then filter on `label` with `useDeferredValue(filter)`.',
        'If the list is still slow to update after deferring, render 2,000 `li` elements less often: cap results or virtualise as in week 30.',
      ],
      verification: [
        'Your log has at least four rows (N+1 fix, index, memoised labels, deferred value), each with a before/after median.',
        'The server logs one query per request after the fix.',
        'EXPLAIN output before and after is saved in your notes.',
        'You can explain, for each layer, why the change helped, not just that it did.',
      ],
    },
    successChecklist: [
      'Defined the symptom as metrics with a target before changing anything.',
      'Used Network timing and Server-Timing to attribute load time to a layer.',
      'Removed the N+1 and verified one query per request.',
      'Added an index and confirmed the plan change with EXPLAIN ANALYZE.',
      'Fixed the client render cost and confirmed with the Profiler and a throttled trace.',
      'Wrote a before/after summary with medians and a prevention step.',
    ],
    questions: [
      {
        question: 'The café page has an LCP of 2.6s. The API request\'s TTFB is 1.9s. Where do you look first, and what tools do you use?',
        answer:
          'Most of the LCP is spent waiting on the server, so I start at the backend: I check the Server-Timing breakdown to see how much is database work versus other processing, and the server logs to count queries per request. If the database dominates, I run EXPLAIN (ANALYZE, BUFFERS) on the slow query or queries to find sequential scans, bad estimates or N+1 patterns. I would not start by optimising React rendering because even a perfect client cannot show content before data arrives. After fixing the backend, I re-measure LCP, because the remaining time may now be dominated by the client or by a request waterfall.',
      },
      {
        question: 'Why does Postgres not automatically index foreign key columns, and how does that contribute to N+1 slowness?',
        answer:
          'Postgres requires an index on the referenced column (the primary key) but not on the referencing column, because not every workload queries by the foreign key and every index adds write cost and storage. So `reviews.cafe_id` has no index unless you create one. Any query filtering reviews by café must then scan the whole reviews table. In an N+1 pattern that full scan happens once per café on the page, so 50 cafés means 50 full table scans. The fix is both to collapse the N queries into one and to add the index, ideally covering the columns the query needs.',
      },
      {
        question: 'Typing in the filter box is laggy. Compare `useMemo`, `useDeferredValue` and virtualisation as fixes. When does each help?',
        answer:
          '`useMemo` (or precomputing when data arrives) avoids repeating expensive work whose inputs did not change, such as formatting labels for every row on every keystroke; it helps when the cost is in computation. `useDeferredValue` lets React render the input update urgently and the list update at lower priority, so the input stays responsive even if the list re-render is slow; it improves perceived responsiveness but does not reduce total work. Virtualisation reduces the number of rows rendered and in the DOM to what is visible, which helps when the cost is the sheer number of elements. They combine well: precompute labels, defer the filtered list, and virtualise if thousands of rows remain.',
      },
    ],
    explainPrompt:
      'Explain to a product manager and an engineering lead in the same meeting how you diagnosed and fixed the slow café page: what you measured, what the root causes were at each layer, what you changed, and what the numbers were before and after. Keep it under three minutes.',
    rubric: [
      'Opened with the outcome and the user-facing numbers.',
      'Explained how time was split across layers before fixing.',
      'Named the specific root causes (N+1, missing index, repeated render work) in plain terms.',
      'Gave before/after numbers measured consistently.',
      'Mentioned a prevention step so it does not regress.',
      'Pitched the explanation so both the PM and the lead could follow.',
    ],
    referenceExplanation:
      'The café page now shows content in about 0.6 seconds instead of 2.6, and typing in the filter is instant instead of lagging by around 400 milliseconds; these are medians of three runs on a throttled laptop. First I measured where the time went. The browser was waiting almost two seconds for the server, so the backend was the first problem. The server timing header showed nearly all of that was database time, and the logs showed 51 queries per page: one for the cafés, then one per café to get its rating. That is an N+1 pattern. Each of those queries also scanned the entire 600,000-row reviews table because the column linking reviews to cafés had no index. I replaced the 50 queries with one query that computes all ratings together, which took the database time from about 1.7 seconds to around 150 milliseconds, and then added the index, which brought it to about 20. On the client, every keystroke was reformatting two thousand rows. I now format each row once when the data arrives and let React update the list at a lower priority than the input, so typing stays responsive. To stop this coming back, I added a test that fails if the endpoint makes more than two queries, and the team can watch INP in our monitoring. Next, I would look at whether the page needs two thousand rows at all, or whether pagination would be a better experience.',
    stretch: {
      title: 'Remove the request waterfall and add a regression test',
      description:
        'Split the page so the café list and a "featured photos" panel load from two endpoints, deliberately create a waterfall (photos fetched after cafés render), then fix it by starting both requests in parallel at route load. Add a Node integration test that fails if `/api/cafes` issues more than two queries.',
    },
    lightTask:
      'Run only the backend part: seed the database, start the slow server, record the db time and query count, then replace the N+1 with the single aggregate query and add the index. Write down before and after numbers and the EXPLAIN scan type for each.',
    intensiveExtras: [
      'Virtualise the list with a small hand-written windowing component (fixed row height) and compare INP and DOM node count with the deferred-only version.',
      'Add an HTTP cache layer (`Cache-Control: max-age=30` plus an ETag) to the API and measure repeat-visit load time.',
      'Use the React Profiler `onRender` callback to log render durations to the console and build a tiny before/after table automatically.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['rendering-performance', 'databases', 'production-reliability', 'react-architecture'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 50
  // ---------------------------------------------------------------------------
  {
    week: 50,
    slug: 'mock-interview-loop',
    title: 'Mock interview loop: coding + system design + behavioural',
    track: 'interview',
    topics: ['mock interview', 'coding round', 'system design round', 'behavioural round', 'self-scoring', 'time management', 'STAR'],
    objective:
      'By the end you have run a timed, multi-round mock loop on yourself, scored each round against an explicit rubric, and turned the results into a short, prioritised list of what to practise next.',
    whyItMatters:
      'Knowing material and performing it under a clock are different skills. A full mock exposes problems you cannot see when studying topic by topic: running out of time in design, going silent while coding, rambling in behavioural answers. Scoring yourself honestly against a rubric turns a vague feeling ("that went okay") into specific practice targets.',
    explanation: [
      'A caveat first: interview loops differ between companies, teams and levels, and change over time, so this lesson does not describe any company\'s actual process. Use what recruiters tell you about a specific loop. What follows is a **generic** loop that exercises the skill areas many senior product-engineering loops share: a coding round, a design round (frontend or backend system design), and a behavioural round. The core version fits in 80 minutes; the intensive version runs each round at a more realistic 45 minutes.',
      '**Run it like the real thing.** Choose problems in advance without reading them (ask a friend to pick, or pick a list and use a random number). Set up a plain editor without autocomplete or AI assistance for the coding round, a blank whiteboard or paper for design, and a recording (screen plus voice) for everything. Talk out loud the whole time; the recording is how you will score communication later. Use a visible timer and respect the boxes: stopping at the time limit, even mid-solution, is part of the exercise because it shows you where time actually goes.',
      '**Coding round (25 minutes in the core loop).** Spend 3 to 5 minutes on clarifying questions, examples and an approach with its complexity before typing. Code the straightforward version first, then test it by tracing a small example and edge cases aloud. Typical failure modes: diving in without a plan, silent stretches of more than a minute, never testing, and not stating complexity. Use a problem from week 46\'s list you have not solved, or a medium from the NeetCode practice list in the trees, graphs or heap sections.',
      '**Design round (35 minutes in the core loop).** Use a prompt you have not rehearsed in detail, for example "design the backend for café table reservations with deposits" or "design the frontend for a café photo gallery that works offline". Budget roughly: 5 minutes for requirements and scale, 10 for the high-level design, 15 for one or two deep dives you choose deliberately (data model, consistency, caching, failure handling), and 5 for trade-offs and what you would do differently at 10x. The most common failure is spending 20 minutes on boxes and never reaching a deep dive; the second is never stating a trade-off. Weeks 24, 37, 44 and 47 are your source material.',
      '**Behavioural round (20 minutes in the core loop).** Answer three questions with stories from week 26: a conflict or disagreement, a time you owned a problem end to end, and a failure or mistake. Use STAR but weight it: a short situation, most time on your actions and decisions, and a concrete result with a number where possible, plus what you learned. Keep each answer to around two to three minutes and use "I" for your contributions. Then **score everything the same day** with the rubrics below, from the recording rather than memory, and pick the two lowest-scoring criteria as next week\'s practice focus. One honest mock with a clear follow-up is worth more than five unscored ones.',
    ],
    examples: [
      {
        language: 'text',
        title: 'Self-scoring rubrics (1 = not yet, 2 = partly, 3 = solid, 4 = strong)',
        code: `CODING (25 min)
[ ] Clarified inputs, constraints and edge cases before coding
[ ] Stated an approach and its time/space complexity before typing
[ ] Code was correct for the main case
[ ] Tested aloud: traced an example and at least two edge cases
[ ] Narrated continuously; no silent gap > 60 seconds
[ ] Finished, or clearly explained what remained, at the time limit

SYSTEM DESIGN (35 min)
[ ] Requirements: functional, non-functional, and a numeric scale estimate
[ ] High-level design with clear data flow, done within ~15 minutes
[ ] At least one deep dive with real detail (schema, consistency, caching, failure)
[ ] Named trade-offs explicitly ("I chose X over Y because...")
[ ] Addressed failure modes (timeouts, retries, duplicates, outages)
[ ] Discussed what changes at 10x

BEHAVIOURAL (20 min, 3 questions)
[ ] Each story had a clear situation in under 30 seconds
[ ] Focused on my actions and decisions ("I"), not the team's in general
[ ] Result was concrete, ideally with a number
[ ] Included reflection: what I learned or would do differently
[ ] Each answer between 2 and 3 minutes

Total per round: sum / (criteria x 4). Lowest two criteria overall = next focus.`,
      },
    ],
    keyTakeaways: [
      'No company\'s loop is described here; treat this as a generic rehearsal and use recruiter guidance for specifics.',
      'Simulate realistically: unseen problems, no AI assistance, a visible timer, and a recording.',
      'Coding: plan and state complexity before typing, then test aloud.',
      'Design: protect time for deep dives and explicit trade-offs.',
      'Behavioural: short situation, mostly actions, concrete result, reflection.',
      'Score from the recording the same day and turn the two weakest criteria into next week\'s focus.',
    ],
    prerequisites: ['Selective algorithms (weeks 21 and 46)', 'Behavioural stories (week 26)', 'System design practice (weeks 24, 37, 44, 47)'],
    prerequisiteWeeks: [13, 21, 24, 26, 37, 44, 46, 47],
    resources: [
      {
        title: 'NeetCode practice',
        url: 'https://neetcode.io/practice',
        kind: 'practice',
        note: 'Choose the coding problem for your mock from a section you have studied but a problem you have not solved. Do not read it until the timer starts.',
        minutes: 5,
      },
      {
        title: 'Tech Interview Handbook',
        url: 'https://www.techinterviewhandbook.org',
        kind: 'article',
        note: 'Read the sections on the coding interview cheatsheet (what to do before, during and after coding) and on behavioural interviews. Compare their checklists with the rubric in this lesson.',
        minutes: 12,
        verify: true,
      },
      {
        title: 'System Design Interview, Volume 1 (Alex Xu)',
        url: 'https://bytebytego.com',
        kind: 'book',
        note: 'Reread the chapter on a framework for system design interviews, focusing on how time is divided between scoping, high-level design and deep dives.',
        minutes: 10,
        verify: true,
      },
    ],
    exercise: {
      title: 'Run and score a full mock loop',
      scenario:
        'You are rehearsing for senior product-engineering interviews. You will run three back-to-back timed rounds on yourself, recorded, then score them. The design prompt is NearBrew-adjacent so you can draw on your own experience: "Design table reservations for cafés, including deposits and no-show handling."',
      setup: [
        'Pick (but do not read) one coding problem: an unsolved problem from the week 46 named list or a NeetCode medium in trees, graphs or heaps.',
        'Prepare three behavioural questions on index cards and shuffle them, for example: a disagreement with a teammate or PM; a time you owned something end to end; a mistake that affected users.',
        'Open a plain editor with AI assistance and autocomplete turned off, a blank sheet or whiteboard tool, and a screen-plus-microphone recorder.',
        'Copy the rubric from the lesson example into a notes file.',
      ],
      steps: [
        'Start recording. Coding round, 25 minutes: read the problem, clarify aloud as if an interviewer were present, state approach and complexity, code, test aloud. Stop at 25 minutes regardless.',
        'Take a 3-minute break. Do not review the coding round yet.',
        'Design round, 35 minutes: requirements and scale (5), high-level design (10), deep dives on double-booking prevention and deposit payment failure (15), trade-offs and 10x (5). Use a timer with alerts at each boundary.',
        'Take a 3-minute break.',
        'Behavioural round, 20 minutes: draw the three cards one at a time and answer each in two to three minutes with STAR. Note the time per answer.',
        'Watch or listen to the recording at 1.5x speed. Score each rubric criterion from 1 to 4 with a one-line piece of evidence (a timestamp or quote).',
        'Write the top two weakest criteria and one concrete drill for each (for example, "silent gaps: do two 20-minute problems narrating everything, check recording for gaps").',
        'Schedule those drills into the next two weeks, using light-week tasks if time is tight.',
      ],
      starter: [
        {
          language: 'text',
          title: 'Mock loop log',
          code: `Date:            Conditions (time of day, energy 1-5):
CODING   problem: ..........  finished? Y/N  time to first line of code: ....
  scores: clarify _ approach _ correct _ tested _ narration _ time _
  evidence:
DESIGN   prompt: table reservations with deposits
  time at end of: requirements __:__  high-level __:__  deep dives __:__
  scores: reqs _ HLD _ deep-dive _ trade-offs _ failures _ 10x _
  evidence:
BEHAVIOURAL  q1 ..... (_ min)  q2 ..... (_ min)  q3 ..... (_ min)
  scores: situation _ "I" focus _ result _ reflection _ length _
  evidence:
WEAKEST TWO: 1) ............ drill: ............
             2) ............ drill: ............`,
        },
      ],
      expected: [
        'A complete recording of three rounds with timestamps.',
        'Every rubric criterion scored 1 to 4 with evidence from the recording, not memory.',
        'Two clearly identified weaknesses with specific drills scheduled.',
        'An honest picture of where time went, especially in the design round.',
      ],
      hints: [
        'If you finish coding early, use the time to discuss alternatives and test more edge cases, as you would with a real interviewer.',
        'In the design round, double-booking prevention links to week 7 (transactions and locking) and week 37; deposit failures link to week 34 (retries and idempotency) and week 41 (outbox).',
        'If a behavioural answer passes three minutes, note where you lost time; usually it is a long situation section.',
        'Scoring yourself a 2 is useful information, not a failure; inflated scores waste the exercise.',
      ],
      verification: [
        'Your log is complete and every score has evidence.',
        'The two practice drills are on your calendar.',
        'Repeat the mock in four to six weeks with different problems and compare scores for the same criteria.',
      ],
    },
    successChecklist: [
      'Ran all three rounds under time limits, with AI assistance off and a recording.',
      'Scored every criterion from the recording with evidence.',
      'Identified the two weakest criteria and scheduled specific drills.',
      'Recorded where time went in the design round.',
      'Each behavioural answer had a concrete result.',
    ],
    questions: [
      {
        question: 'In a 45-minute design round, you are 25 minutes in and still adding boxes to the high-level diagram. What should you do?',
        answer:
          'Stop expanding breadth and say so explicitly: "The high-level design covers the main flows; I would like to go deep on the part that is hardest to get right, which is preventing double bookings." Then pick one or two deep dives that show judgment, such as the data model with a unique constraint or locking strategy, and failure handling for payments. Interviewers generally learn more from one well-reasoned deep dive than from a complete but shallow diagram. Leave a few minutes at the end for trade-offs and scaling. In practice, use a timer with checkpoints so this decision happens at 15 minutes, not 25.',
      },
      {
        question: 'Why should you score a mock interview from the recording rather than from memory, and what kinds of issues usually only show up in the recording?',
        answer:
          'Memory is biased: we remember our intent and the parts that went well, and we underestimate how long silences and tangents lasted. The recording shows what an interviewer actually experienced. Issues that usually only appear on playback include long silent stretches while coding, filler and restarts, spending far longer on the situation in a STAR answer than you thought, not stating complexity or trade-offs even though you knew them, and drifting past time boxes. Evidence-based scoring also makes your next mock comparable, so you can see real progress.',
      },
      {
        question: 'What makes a behavioural answer strong, beyond following STAR?',
        answer:
          'A strong answer is specific to you and shows judgment: it uses "I" for your decisions, explains why you chose an action and what alternatives you considered, and includes a concrete, ideally measurable result. It is the right length, usually two to three minutes, with most time on actions rather than background. It includes reflection: what you learned or would do differently, which signals growth and self-awareness. For failure stories, it owns the mistake without blaming others and shows what changed afterwards. Finally, it answers the question that was asked rather than a prepared story that only partly fits.',
      },
    ],
    explainPrompt:
      'Explain to a friend who is also preparing for interviews what you learned from your mock loop: what went well, your two weakest areas with evidence from the recording, and exactly how you will practise them over the next two weeks.',
    rubric: [
      'Used specific evidence (timestamps, quotes, times) rather than general feelings.',
      'Was honest about weaknesses without catastrophising.',
      'Named concrete, time-boxed drills rather than "practise more".',
      'Mentioned at least one strength worth keeping.',
      'Did not make claims about any specific company\'s interview process.',
    ],
    referenceExplanation:
      'The mock went better than I expected on design and worse on coding. In the coding round I picked Course Schedule and identified it as topological sort within two minutes, but I went silent for about four minutes while writing the in-degree loop, which I only noticed on the recording at the twelve-minute mark. I finished, but I never traced an edge case aloud, so I scored myself a 2 for narration and a 2 for testing. In design, I hit my checkpoints: requirements done at five minutes, high-level design at fourteen. My deep dive on double-booking was solid; I used a unique constraint on table and time slot, and explained why I preferred that to a lock-then-check approach. But I ran out of time before discussing what changes at 10x, so that is a 2. Behavioural answers were the right length, though my disagreement story spent a full minute on background. My two weakest areas are narration while coding and testing aloud. For the next two weeks I will do three 20-minute problems from the week 46 list, recorded, with one rule: say what I am about to write before I write it, and finish every problem by tracing an empty input and one tricky case aloud. I will check each recording for silent gaps over 30 seconds and repeat the full mock in five weeks to compare the same criteria. I am keeping the design checkpoint timer; it clearly worked.',
    stretch: {
      title: 'Swap in a frontend practical round',
      description:
        'Run a second mock where the coding round is a 45-minute frontend practical: build an accessible, keyboard-navigable autocomplete for café names in React with debounced fetching, loading and error states, and cancellation of stale requests. Score it with the coding rubric plus two criteria for accessibility and state handling.',
    },
    lightTask:
      'Run just the behavioural round: three questions, two to three minutes each, recorded on your phone. Score each answer against the behavioural rubric and write down the single weakest criterion.',
    intensiveExtras: [
      'Run each round at 45 minutes instead of the core time boxes, adding a full trade-offs and scaling discussion to the design round.',
      'Swap roles with a friend preparing for interviews: interview them using the rubric, then have them interview you with a problem you have not seen.',
      'Do a second design round on a frontend prompt (week 44 style) and compare your design rubric scores between frontend and backend prompts.',
    ],
    minutes: { learn: 20, practice: 80, explain: 20 },
    competencies: ['technical-communication', 'system-design', 'cs-fundamentals'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 51
  // ---------------------------------------------------------------------------
  {
    week: 51,
    slug: 'nearbrew-engineering-case-study',
    title: 'Building your evidence portfolio: a NearBrew engineering case study',
    track: 'senior',
    secondaryTracks: ['interview'],
    topics: ['case study', 'portfolio', 'evidence', 'trade-offs', 'impact metrics', 'technical writing', 'brag document'],
    objective:
      'By the end you have a one-to-two page engineering case study about a real NearBrew decision, covering problem, constraints, decisions, trade-offs, results with honest numbers, and what you would change, plus a five-minute spoken version.',
    whyItMatters:
      'Interviews and promotions reward evidence, not adjectives. A written case study forces you to reconstruct why you made decisions, gives you a polished story for "tell me about a project you are proud of", and shows the judgment senior roles look for. Most engineers never write one, so those who do stand out.',
    explanation: [
      '**Pick a decision, not a product.** "I built NearBrew" is too broad to be interesting. Choose one problem with real constraints and a non-obvious choice: how nearby search works (PostGIS radius queries versus geohash prefixes versus a third-party places API), offline favourites and check-ins with sync conflicts, the notification pipeline from week 47, image upload and resizing for café photos, or the performance fix from week 49. Good candidates have at least two reasonable options you rejected and some measurable outcome. If you wrote a design doc (week 12), an ADR (week 33) or a postmortem (week 39) during the year, those are your raw material.',
      '**Use a fixed structure.** (1) Context and problem: who the users are, what was going wrong or missing, and why it mattered, in three or four sentences. (2) Constraints: team size (often just you), budget, deadlines, platform limits, data volume, things you could not change. (3) Options considered: two or three, each with its main advantage and cost. (4) Decision and design: what you chose, a simple diagram, and the key details that make it work. (5) Trade-offs and risks you accepted knowingly. (6) Results with numbers. (7) What you would change now. This mirrors how design reviews and many interviewers probe a project, so writing it once prepares you for both.',
      '**Numbers must be honest and labelled.** Good results sections mix technical metrics (p95 latency 1.8s to 220ms; crash-free sessions 98.1% to 99.6%; cloud cost from about £40 to £12 a month) with product or delivery outcomes (shipped in three weeks; support emails about slow search stopped). State how each number was measured and at what scale: "measured locally on a seeded dataset of 600k reviews" is credible; an unlabelled "10x faster" is not. NearBrew may have modest traffic, and that is fine: judgment at small scale is still judgment, and saying "at 1,000 daily users this mattered for battery and cost, not throughput" shows maturity. Never inflate; interviewers follow up, and one exaggerated number undermines the rest.',
      '**Trade-offs and "what I would change" carry the seniority signal.** Anyone can describe what they built; fewer can explain what they gave up. Write sentences like "I chose geohash prefixes over PostGIS because the hosting tier did not support extensions; the cost is less precise radius results near cell boundaries, which I mitigated by querying neighbouring cells." The "what I would change" section should be specific and show learning, not self-criticism for its own sake: "I would add the index migration and a query-count test at the start, not after users noticed." It also gives interviewers an easy, positive follow-up thread.',
      '**Make it usable in three formats.** The written one-to-two page version for a portfolio or to share with a hiring manager; a five-minute spoken version for "tell me about a project"; and a 30-second summary for introductions. Keep proprietary or client details out if any freelance work is involved, and remove secrets, internal URLs and personal data from screenshots. Keep a running "brag document" (a dated list of wins, numbers and links) through the next year so the next case study takes an hour instead of a weekend of archaeology.',
    ],
    examples: [
      {
        language: 'text',
        title: 'Case study skeleton with example sentences',
        code: `TITLE: Making "Nearby" fast and cheap for NearBrew

1. Context & problem
NearBrew helps people find independent cafés nearby. The Nearby tab took
~2s to load on mid-range Android phones and was the most common complaint
in beta feedback (11 of 40 responses).

2. Constraints
Solo developer, ~4 evenings available, managed Postgres tier without PostGIS,
must work on 3G-quality connections, budget < £20/month.

3. Options considered
A) PostGIS radius query - most precise; not available on current tier.
B) Geohash prefix + bounding-box filter - works on plain Postgres; edge effects.
C) Third-party places API - fast to build; per-request cost, data ownership.

4. Decision & design
Chose B. Store a 6-char geohash per café, index it, query the user's cell plus
8 neighbours, then filter by exact distance in SQL. (diagram)

5. Trade-offs accepted
Slightly more complex query; results at cell edges depend on neighbour lookup.

6. Results (measured how, at what scale)
p95 API latency 1.9s -> 180ms (staging, 12k cafés, 50 runs).
Payload 240KB -> 38KB by trimming fields. Hosting cost unchanged.

7. What I'd change
Add a query-count test and performance budget from day one; evaluate moving
to a tier with PostGIS once café count passes ~100k.`,
      },
    ],
    keyTakeaways: [
      'Write about one decision with real constraints and rejected options, not the whole product.',
      'Use a fixed structure: problem, constraints, options, decision, trade-offs, results, what you would change.',
      'Every number states how and at what scale it was measured; never inflate.',
      'Trade-offs and lessons are where seniority shows.',
      'Prepare written, five-minute and 30-second versions.',
      'Keep a running brag document so future case studies are easy.',
    ],
    prerequisites: ['Design documents (week 12)', 'ADRs and trade-off analysis (week 33)', 'Postmortems (week 39)', 'End-to-end performance work (week 49)'],
    prerequisiteWeeks: [12, 26, 33, 39, 49],
    resources: [
      {
        title: 'Get your work recognized: write a brag document (Julia Evans)',
        url: 'https://jvns.ca/blog/brag-documents/',
        kind: 'article',
        note: 'Read the whole post. Start a brag document today and seed it with this year\'s NearBrew and freelance wins; it becomes the source for future case studies.',
        minutes: 10,
        verify: true,
      },
      {
        title: 'web.dev case studies',
        url: 'https://web.dev/case-studies',
        kind: 'article',
        note: 'Read one or two performance case studies and notice their structure: problem, what they measured, what they changed, and results stated with specific metrics.',
        minutes: 10,
        verify: true,
      },
      {
        title: 'Google Technical Writing courses',
        url: 'https://developers.google.com/tech-writing',
        kind: 'course',
        note: 'Revisit the material on audience and on writing clear, short sentences before editing your draft.',
        minutes: 5,
      },
      {
        title: 'martinfowler.com',
        url: 'https://martinfowler.com',
        kind: 'article',
        note: 'Optional: browse an article that explains an architectural decision with its trade-offs and borrow the tone: explicit about context, honest about costs.',
        minutes: 5,
      },
    ],
    exercise: {
      title: 'Draft, cut and rehearse a NearBrew case study',
      scenario:
        'You want one artefact that you can send to a hiring manager or walk through in an interview, showing how you make and justify engineering decisions on a real product you own.',
      setup: [
        'Gather raw material: commits and PRs, any design doc, ADR or postmortem from this year, screenshots of profiler or EXPLAIN output, analytics or store reviews, and your week 49 performance log.',
        'Create `case-study.md` (or a doc) using the skeleton from the lesson example.',
      ],
      steps: [
        'Shortlist three candidate decisions. For each, write one line answering: what were the alternatives, and do I have a number? Pick the one with the strongest answers.',
        'Write the context and constraints sections in under 150 words combined.',
        'Write the options section with two or three options, each with one main advantage and one main cost.',
        'Write the decision and design section with one simple diagram (boxes and arrows, drawn by hand and photographed is fine).',
        'Write the results section. For every number, add how it was measured and at what scale. If you lack production numbers, measure locally now and label them as local measurements.',
        'Write trade-offs accepted and what you would change, at least two specific items each.',
        'Cut the draft to two pages maximum. Remove any client-confidential details, secrets or personal data.',
        'Rehearse a five-minute spoken version and a 30-second version out loud, recording each. Time them.',
      ],
      starter: [
        {
          language: 'text',
          title: 'Number-quality checklist (apply to each metric)',
          code: `Metric: ..................................
Before: ........   After: ........
How measured (tool, method, runs, median/p95): ...........................
Environment and scale (local / staging / production; data size; users): ...
Time window (dates or "single test session"): ............................
Could someone else reproduce it from this description?  Y / N
Am I claiming more than this shows?                      Y / N`,
        },
      ],
      expected: [
        'A case study of one to two pages with all seven sections.',
        'At least two quantified results, each with method and scale labelled.',
        'At least two explicitly rejected options with reasons.',
        'A five-minute and a 30-second recording that tell the same story consistently.',
      ],
      hints: [
        'If the "options considered" section feels forced, you may have picked a decision that was not really a decision; try another candidate.',
        'Constraints make choices understandable: "solo, four evenings, no PostGIS" explains a lot.',
        'Replace adjectives with facts: "significantly faster" becomes "p95 from 1.9s to 180ms".',
        'In the spoken version, spend the most time on the decision and trade-offs, not the background.',
      ],
      verification: [
        'Ask someone (or imagine a sceptical interviewer) to pick any sentence and ask "how do you know?"; every result sentence has an answer.',
        'Run every metric through the number-quality checklist.',
        'The five-minute recording is between four and six minutes and covers trade-offs and what you would change.',
      ],
    },
    successChecklist: [
      'Chose one decision with real constraints and at least two rejected alternatives.',
      'All seven sections are present and the document is two pages or less.',
      'Every number states method and scale; nothing is inflated.',
      'Includes at least two specific trade-offs and two specific changes you would make.',
      'Confidential details, secrets and personal data are removed.',
      'Recorded a five-minute and a 30-second version.',
    ],
    questions: [
      {
        question: 'NearBrew has a few thousand users. How do you present results credibly without overstating scale?',
        answer:
          'State the actual scale and frame the results around what mattered at that scale: latency on mid-range devices, battery and data usage, cost, development time and reliability. Label each number with how and where it was measured, for example "p95 from 1.9s to 180ms on staging with 12k cafés, median of 50 runs". Where you designed for future growth, say explicitly what you would change at 10x or 100x rather than implying you already operate there. Interviewers value accurate reasoning about scale far more than large numbers, and modest but well-measured results are more convincing than vague big claims.',
      },
      {
        question: 'Why is the "what I would change" section valuable rather than a confession of weakness?',
        answer:
          'It shows that you evaluate your own work after the fact and learn from outcomes, which is a core senior-engineer behaviour. Specific changes, such as "add a query-count test from day one" or "pick a hosting tier with PostGIS sooner", demonstrate that you understand the consequences of your decisions in hindsight. It also anticipates the interviewer\'s natural follow-up question and gives you control of the answer. The key is to be specific and constructive, framed as what you learned, rather than vague self-criticism.',
      },
      {
        question: 'How does a case study differ from a design document, and why write both?',
        answer:
          'A design document is written before or during the work to propose a solution, invite feedback and align people; its results are predictions. A case study is written afterwards and tells the whole story, including what actually happened, the measured results, surprises and what you would change. The design doc is a decision-making tool, while the case study is evidence of judgment and impact. Writing the design doc first makes the case study easier and more honest, because you can compare what you expected with what happened.',
      },
    ],
    explainPrompt:
      'An interviewer says, "Tell me about a technical decision you are proud of." Give your five-minute case study answer as if speaking to them, then answer their follow-up: "What would you do differently?"',
    rubric: [
      'Set context and constraints quickly (under one minute).',
      'Presented real alternatives and why they were rejected.',
      'Results were quantified and labelled with method and scale.',
      'Named trade-offs accepted knowingly.',
      'The "differently" answer was specific and showed learning.',
      'Stayed within about five minutes.',
    ],
    referenceExplanation:
      'NearBrew is a café discovery app I build and run on my own. In beta, the most common complaint, in 11 of 40 feedback responses, was that the Nearby tab was slow on mid-range Android phones, around two seconds. My constraints were tight: I was the only engineer with about four evenings, the managed Postgres tier did not allow PostGIS, and I wanted to stay under £20 a month. I considered three options. PostGIS radius queries were the most precise but would mean changing hosting. A third-party places API would have been quick to build but adds per-request cost and means I do not own the data. I chose geohash prefixes on plain Postgres: each café stores a six-character geohash, which is indexed. I query the user\'s cell plus its eight neighbours, so cafés near a cell edge are not missed, and then filter by exact distance. I accepted a slightly more complex query, and that precision depends on getting the neighbour lookup right, so I wrote tests for edge cases. I also cut the response payload to the fields the list shows. On staging, with 12,000 cafés and the median of 50 runs, p95 API latency went from 1.9 seconds to 180 milliseconds and the payload from 240KB to 38KB, with no cost increase, and the slow-search complaints stopped in the next round of feedback. What would I do differently? I would set a performance budget and add a test counting queries per request from the start, because the original slowness was a predictable N+1. I would also plan the move to PostGIS for when we pass about 100,000 cafés.',
    stretch: {
      title: 'Publish a sanitised version',
      description:
        'Turn the case study into a public blog post or portfolio page with diagrams and before/after charts, with all client and personal data removed. Ask one engineer you respect for feedback on whether the trade-offs section is convincing, and revise.',
    },
    lightTask:
      'Write a half-page case study outline for one NearBrew decision: one sentence each for problem and constraints, two options with their costs, the decision, one quantified result with how it was measured, and one thing you would change.',
    intensiveExtras: [
      'Write a second, shorter case study on a different kind of work (for example a reliability improvement or a mentoring outcome) so you have stories covering different competencies.',
      'Do a mock "deep dive on a past project" interview with a friend who asks "why?" and "how do you know?" at least five times.',
      'Create a brag document for the whole year with dated entries, links and numbers, organised by competency.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['technical-communication', 'feature-ownership', 'system-design'],
    depth: 'standard',
  },

  // ---------------------------------------------------------------------------
  // Week 52
  // ---------------------------------------------------------------------------
  {
    week: 52,
    slug: 'year-review-and-next-year-plan',
    title: 'Year review and next-year plan',
    track: 'senior',
    topics: ['year review', 'self-assessment', 'competencies', 'evidence', 'learning plan', 'sustainable cadence', 'spaced repetition'],
    objective:
      'By the end you have revisited your readiness self-assessment with evidence, chosen two or three focus areas for next year, and written a plan with a cadence you can sustain alongside NearBrew, freelance work and life.',
    whyItMatters:
      'Learning compounds when it is reviewed and directed. Without a review you tend to keep practising what is comfortable and forget what you learned in month two. A short, evidence-based review turns 52 weeks of work into a clear picture of strengths, gaps and next steps, and the plan keeps next year intentional rather than reactive.',
    explanation: [
      'First, a reassurance that is also a fact about learning: **progress compounds, and missed weeks are normal.** In a year that included launching a mobile app and freelance work, some weeks were light and some were skipped. That does not erase the weeks you did. Each topic you worked through (indexes, rendering, queues, failure handling, design writing) now connects to others, which is why later weeks probably felt easier to absorb than early ones. The goal of this review is not to grade attendance; it is to see what you can do now that you could not do a year ago, and to choose what comes next.',
      '**Revisit the readiness self-assessment with evidence.** For each competency in EngineerOS (JavaScript and TypeScript, React architecture, rendering performance, UI reliability, consumer UI, accessibility, API design, backend services, databases, system design, production reliability, feature ownership, technical communication, CS fundamentals), rate yourself from 1 to 4 and attach evidence: a lesson exercise, a NearBrew PR, a case study, a design doc, a postmortem, a mock score. A rating without evidence is a guess; mark it as such. Compare with your earliest ratings if you recorded them. Expect some ratings to go down, because you now know more about what "strong" looks like; that is calibration, not regression.',
      '**Pick focus areas deliberately: two or three, not seven.** Look for the intersection of three things: gaps relative to the roles you target (full-stack L4 and senior product UI), areas where you have momentum or real projects to practise on, and what you enjoy enough to sustain. For a product-UI direction, that might be rendering performance and consumer UI on low-power devices; for full-stack, system design and production reliability. Write each focus as an outcome with evidence, not an activity: "ship a measured INP improvement in NearBrew and write it up" beats "learn more about performance".',
      '**Design a cadence you can keep in a bad month.** The two-hour weekly rhythm with light and intensive variants worked because it flexes. Keep a minimum ("one 30-minute light task per week, even in launch weeks") and a typical target ("two hours, three weeks out of four"), and plan quarterly themes rather than 52 fixed topics. Use spaced repetition for weak spots: revisit a topic you found hard at increasing intervals (two weeks, a month, a quarter) by redoing its light task or explaining it again from memory. Build one recovery rule, such as "if I miss two weeks, the next session is a light task on anything, not catching up", so a gap never becomes a reason to stop.',
      '**Connect learning to evidence and outcomes.** Each quarter should end with something you can show: a case study, a merged improvement with numbers, a mock interview scored against last time, or a talk or write-up. Schedule your next mock loop and readiness review now (for example at the end of each quarter) so they happen. If you are applying for roles in the coming year, align the plan with that timeline: the months before applications should weight interview practice and polishing case studies; other months can go deeper on engineering. Finally, write a short letter to yourself in a year: what you hope will be true, and what you will forgive yourself for if life gets busy.',
    ],
    examples: [
      {
        language: 'text',
        title: 'Next-year plan on one page',
        code: `NEXT-YEAR PLAN (written: ____)

Direction: Senior product UI (primary), full-stack L4 (secondary)

Focus areas (outcomes, with evidence):
1. Rendering performance on low-power devices
   -> Ship a measured INP/LCP improvement in NearBrew; write it as a case study.
2. System design depth
   -> Two scored mock design rounds per quarter; average rubric >= 3.
3. Production reliability
   -> Add client error monitoring and one SLO to NearBrew; one postmortem written.

Cadence
Minimum: one 30-min light task per week (launch weeks included)
Typical: 2 h/week, 3 weeks of 4; 1 intensive week per month if energy allows
Recovery rule: after 2 missed weeks, restart with any light task. No catch-up.
Spaced review: redo light tasks for weeks I rated <= 2 at +2 weeks, +1 month, +1 quarter.

Quarterly checkpoints (in calendar now)
Q1 end: readiness self-assessment + 1 case study
Q2 end: full mock loop, compare with week 50
Q3 end: readiness self-assessment + public write-up
Q4 end: year review`,
      },
    ],
    keyTakeaways: [
      'Missed weeks are normal; what you did still compounds.',
      'Rate each competency with evidence; a rating without evidence is a guess.',
      'Lower ratings can mean better calibration, not regression.',
      'Choose two or three focus areas written as outcomes with evidence.',
      'Set a minimum cadence, a typical cadence and a recovery rule.',
      'Put quarterly checkpoints (self-assessment, mock loop, case study) in the calendar now.',
    ],
    prerequisites: ['Quarter checkpoints (weeks 13, 26, 39)', 'Mock loop (week 50)', 'Case study (week 51)'],
    prerequisiteWeeks: [13, 26, 39, 50, 51],
    resources: [
      {
        title: 'Get your work recognized: write a brag document (Julia Evans)',
        url: 'https://jvns.ca/blog/brag-documents/',
        kind: 'article',
        note: 'Use the suggested sections as prompts for collecting this year\'s evidence before rating yourself.',
        minutes: 8,
        verify: true,
      },
      {
        title: 'The Pragmatic Programmer, 20th Anniversary Edition (David Thomas and Andrew Hunt)',
        url: 'https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/',
        kind: 'book',
        note: 'Read the section on your knowledge portfolio: treating learning like an investment portfolio with regular, diversified contributions. It maps directly to a sustainable cadence.',
        minutes: 10,
        verify: true,
      },
      {
        title: 'Google SRE book: Postmortem Culture',
        url: 'https://sre.google/sre-book/postmortem-culture/',
        kind: 'book',
        note: 'Optional reread: apply the blameless mindset to your own year. Review what happened and what to change, without judging yourself for missed weeks.',
        minutes: 7,
      },
      {
        title: 'NeetCode roadmap',
        url: 'https://neetcode.io/roadmap',
        kind: 'practice',
        note: 'Only if algorithms are one of your focus areas: pick the next two topic nodes you have not covered and schedule them at a sustainable pace.',
        minutes: 5,
        verify: true,
      },
    ],
    exercise: {
      title: 'Evidence-based year review and a sustainable plan',
      scenario:
        'You have worked through a year of EngineerOS alongside launching NearBrew and freelance work. You will turn that year into a clear self-assessment, choose what to focus on, and write a plan you will actually follow.',
      setup: [
        'Open the EngineerOS readiness self-assessment and your weekly completion history.',
        'Gather evidence: exercise outputs, NearBrew PRs, your design doc (week 12), ADR (week 33), postmortem (week 39), performance log (week 49), mock scores (week 50), case study (week 51).',
      ],
      steps: [
        'List the weeks you completed fully, lightly, or skipped. Note without judgement any patterns (for example, skipped weeks clustered around the NearBrew launch).',
        'For each competency, rate yourself from 1 to 4 and attach at least one piece of evidence. Mark ratings without evidence with a question mark.',
        'Compare with earlier ratings if you have them. For any rating that went down, write one line on whether that reflects calibration or a real gap.',
        'Identify your top three strengths with evidence. Write them as sentences you could say in an interview.',
        'Choose two or three focus areas for next year using three filters: gap relative to target roles, available real projects, and interest. Write each as an outcome with evidence.',
        'Choose three to five weak weeks to revisit with spaced repetition, and schedule their light tasks at +2 weeks, +1 month and +1 quarter.',
        'Write your cadence: minimum, typical, intensive option, and a recovery rule.',
        'Put the quarterly checkpoints (self-assessment, mock loop, case study) in your calendar now, and write a five-sentence note to yourself for this time next year.',
      ],
      starter: [
        {
          language: 'text',
          title: 'Competency review table',
          code: `Competency                 | Rating 1-4 | Evidence (link or artefact)           | Next step
---------------------------|------------|----------------------------------------|----------------
JS & TypeScript            |            |                                        |
React architecture         |            |                                        |
Rendering performance      |            | week 49 perf log, before/after medians |
UI reliability             |            |                                        |
Consumer UI                |            |                                        |
Accessibility              |            |                                        |
API design                 |            |                                        |
Backend services           |            |                                        |
Databases                  |            |                                        |
System design              |            | week 47 design, week 50 mock score     |
Production reliability     |            | week 39 postmortem                     |
Feature ownership          |            | week 51 case study                     |
Technical communication    |            |                                        |
CS fundamentals            |            | week 46 drills                         |

1 = not yet  2 = can do with help/reference  3 = can do independently  4 = can teach or lead it`,
        },
      ],
      expected: [
        'Every competency has a rating, with evidence or an explicit question mark.',
        'Three strengths written as interview-ready sentences.',
        'Two or three focus areas written as outcomes with evidence.',
        'A cadence with a minimum, a typical target and a recovery rule.',
        'Quarterly checkpoints and spaced-review sessions scheduled in your calendar.',
      ],
      hints: [
        'If every competency feels like a priority, choose the ones that most directly support the roles you plan to apply for in the next six to nine months.',
        'A 4 should mean you could teach it or lead the work; be strict, as it makes progress next year visible.',
        'Look at what you did in your best weeks (time of day, setup, energy) and build the cadence around that.',
        'If you missed many weeks, the plan should be lighter, not heavier. Consistency at a smaller size beats an ambitious plan that collapses in February.',
      ],
      verification: [
        'Someone reading your table could see why you gave each rating.',
        'Your focus areas each name a concrete artefact you will produce.',
        'The first checkpoint and the first spaced-review session are in your calendar with dates.',
      ],
    },
    successChecklist: [
      'Rated every competency, with evidence or an explicit question mark.',
      'Wrote three evidence-backed strengths.',
      'Chose two or three focus areas written as outcomes.',
      'Defined minimum and typical cadence plus a recovery rule.',
      'Scheduled quarterly checkpoints and spaced reviews.',
      'Wrote a short note to your future self.',
    ],
    questions: [
      {
        question: 'Why might some of your self-assessment ratings be lower now than at the start of the year, even though you have learned a lot?',
        answer:
          'Early in learning, people often overestimate their skill because they do not yet know what they do not know. As you study a topic, such as database performance, you discover its depth, and your idea of what "strong" means rises, so the same or better ability can earn a lower rating. That is improved calibration, which is valuable in itself: it leads to better decisions about what to practise and more honest interview answers. The way to tell calibration from a real gap is evidence: if you can point to work that shows the skill improved, the lower rating reflects higher standards.',
      },
      {
        question: 'What makes a learning cadence sustainable for someone with a demanding job and side projects?',
        answer:
          'It has a small minimum that survives bad weeks, such as one 30-minute task, so the habit never fully breaks. It has a typical target that fits real life, like two hours three weeks out of four, rather than an ideal that requires perfect weeks. It includes a recovery rule that avoids catching up, because catch-up debt is a common reason people quit. It ties learning to real projects like NearBrew so practice also moves work forward. And it has scheduled checkpoints so you review and adjust instead of drifting.',
      },
      {
        question: 'Why write focus areas as outcomes with evidence instead of activities?',
        answer:
          'An activity such as "learn more about performance" has no finish line and no way to tell whether it worked, so it drifts. An outcome such as "ship a measured INP improvement in NearBrew and write it up as a case study" defines success, forces practice on a real problem, and produces evidence you can use in interviews or reviews. It also makes it easier to say no to tangents, because you can ask whether a resource helps produce that outcome. Outcomes still involve activities; they just give those activities a purpose and a check.',
      },
    ],
    explainPrompt:
      'Explain to a trusted friend or mentor what changed in your engineering skills this year, using evidence, what you will focus on next year and why, and how you will keep going when weeks get busy.',
    rubric: [
      'Cited specific evidence for growth rather than general statements.',
      'Was honest about gaps and about missed weeks without self-criticism.',
      'Focus areas were few, outcome-based and tied to target roles.',
      'Described a realistic cadence with a minimum and a recovery rule.',
      'Sounded motivated and sustainable rather than punishing.',
    ],
    referenceExplanation:
      'A year ago I would have said I was good at frontend and okay at backend, without much to back it up. Now I can point to evidence. I found and fixed an N+1 query and a missing index in NearBrew, with medians before and after. I wrote a design doc and an ADR for nearby search, and a blameless postmortem for the photo-upload outage. In my mock loop I scored around 3 out of 4 on design. Some ratings went down: I used to rate myself 3 on databases, and now I would say a solid 2, because I understand replication and partitioning well enough to see how much there is to learn. I missed about ten weeks, mostly around the NearBrew launch, and I am fine with that; the light tasks kept the habit alive. Next year I am focusing on three things. First, rendering performance on low-powered devices, ending with a measured INP improvement and a case study, because that is central to the product-UI roles I want. Second, system design, with two scored mock rounds a quarter. Third, production reliability, adding client error monitoring and an SLO to NearBrew. My cadence is a 30-minute minimum every week, two hours most weeks, and a rule that after two missed weeks I restart with any light task instead of catching up. Quarterly checkpoints are already in my calendar. I also scheduled reviews of the four topics I found hardest, so they get revisited rather than forgotten.',
    stretch: {
      title: 'Design your own Q1 curriculum',
      description:
        'Using your focus areas, draft the next 13 weeks in the same format as EngineerOS: a title, objective, a concrete local exercise and an explain prompt for each week, mixing new topics with spaced reviews of weak ones. Include at least two light-week fallbacks you know you will need.',
    },
    lightTask:
      'Rate yourself 1 to 4 on each competency with one piece of evidence or a question mark, then write your two focus areas for next year as outcomes and your minimum weekly cadence in one sentence.',
    intensiveExtras: [
      'Redo the light task from the three weeks you rated weakest and update your ratings based on how it went.',
      'Write a one-page "year in engineering" summary suitable to share with a mentor or to prepare for a performance review.',
      'Run a quick 30-minute version of the week 50 behavioural round using stories from this year and compare it with your earlier scores.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['technical-communication', 'feature-ownership'],
    depth: 'standard',
  },
];
