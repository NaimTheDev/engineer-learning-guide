import type { Lesson } from '../types';

/**
 * Weeks 5–8 (Q1 Foundations, detailed depth):
 * 5  cs            The JavaScript event loop and asynchronous programming
 * 6  frontend      TypeScript for domain modelling
 * 7  backend       Transactions, isolation levels, optimistic vs pessimistic locking
 * 8  cs            HTTP and networking fundamentals
 */
export const weeks05to08: Lesson[] = [
  // ---------------------------------------------------------------------------
  // Week 5 — Event loop
  // ---------------------------------------------------------------------------
  {
    week: 5,
    slug: 'javascript-event-loop-async',
    title: 'The JavaScript event loop and asynchronous programming',
    track: 'cs',
    secondaryTracks: ['frontend'],
    topics: [
      'event loop',
      'call stack',
      'task queue',
      'microtasks',
      'promises',
      'async/await',
      'rendering opportunities',
      'long tasks',
      'yielding to the main thread',
      'INP',
    ],
    objective:
      'By the end you can predict the exact output order of mixed sync, promise, microtask and timer code, explain where rendering fits in the loop, and turn a blocking client-side computation into one that keeps input responsive.',
    whyItMatters:
      "Almost every 'the UI froze', 'the spinner never showed', 'this state update happened in the wrong order' or 'tap took a second to respond' bug is an event-loop bug. Senior frontend engineers are expected to reason about main-thread time precisely: when a callback runs, what it blocks, and when the browser actually gets a chance to paint. Interaction latency metrics such as INP measure exactly this, so it shows up directly in product quality and in debugging conversations.",
    explanation: [
      "JavaScript on a web page runs on **one main thread** with **one call stack**. When a function is called it is pushed on the stack; when it returns it is popped. While anything is on the stack, nothing else on that thread can run: no other JS callback, no click handler, and — crucially — no rendering. The event loop is the scheduler that decides what runs next once the stack is empty. A useful mental model: the stack is a single checkout lane, and the event loop is the person deciding which queue gets served next.",
      "Work arrives in **tasks** (often called macrotasks). A task is a unit of work the browser schedules: running a `<script>`, dispatching a click event, firing a `setTimeout` callback, delivering a `postMessage` or `MessageChannel` message, or a network callback. The loop picks **one** task from a task queue, runs it to completion (until the stack is empty), then does housekeeping before picking the next. Browsers can have several task sources and are allowed to prioritise between them (for example, input events are often prioritised over timers), but within one source tasks are FIFO.",
      "**Microtasks** are a second, higher-priority queue. Promise reactions (`.then`, `.catch`, `.finally` callbacks, and the continuation after `await`), `queueMicrotask(fn)` and `MutationObserver` callbacks are microtasks. The rule that matters: **whenever the call stack empties — after every task, and after every individual callback the browser invokes — the engine drains the entire microtask queue, including microtasks queued by microtasks**, before doing anything else. That is why a resolved promise's `.then` always runs before a `setTimeout(fn, 0)` scheduled earlier: the timer is a task, the promise reaction is a microtask, and microtasks jump the queue.",
      "**Rendering** is not a task you schedule; it is an opportunity the loop takes between tasks. Roughly once per display frame (about every 16.7 ms on a 60 Hz screen), after a task and its microtasks finish, the browser may run `requestAnimationFrame` callbacks, then recalculate style, layout and paint. If your task takes 300 ms, the browser misses about 18 frames: the spinner you set to visible at the start of the function will never be painted, because painting only happens after you return. Setting `element.textContent = 'Loading…'` changes the DOM immediately, but the user sees it only at the next rendering opportunity.",
      "**Promises and async/await** are syntax on top of microtasks, not threads. An `async` function runs synchronously until its first `await`. `await x` roughly desugars to `Promise.resolve(x).then(rest => …the rest of the function…)`: the rest of the function is parked as a promise reaction and the function returns a pending promise to its caller. So `await` never makes CPU-bound work non-blocking. `await heavySort(cafes)` still blocks the thread for however long `heavySort` takes; it just schedules what happens after it. Making code `async` only helps when the thing being awaited genuinely happens elsewhere (network, timers, a worker).",
      "**`setTimeout(fn, 0)` vs `queueMicrotask(fn)`**: both defer `fn` until the current stack is empty, but very differently. `queueMicrotask` runs `fn` before the browser gets any chance to render or handle input — it is 'later in this same turn'. `setTimeout(fn, 0)` creates a new task, so rendering and input can happen first; it is 'a later turn'. Note that `0` is a minimum, not a guarantee: browsers clamp nested timers (after several levels of nesting) to at least about 4 ms, and background tabs throttle timers much harder. Use microtasks to batch or order work consistently within a turn; use tasks (or `scheduler.yield()` / `MessageChannel`) to give the browser a breather.",
      "**Starving the event loop** happens in two flavours. The obvious one is a **long task**: a single synchronous chunk of work over ~50 ms (the threshold the Long Tasks API and Lighthouse use) that blocks input and paint. The sneakier one is **microtask starvation**: a microtask that queues another microtask forever (for example a recursive `Promise.resolve().then(loop)`) never lets the queue drain, so no task, input event or frame ever runs — the page freezes even though every individual callback is tiny. Recursive `setTimeout` does not freeze the page because each iteration is a separate task.",
      "The fix for CPU-heavy work on the main thread is **chunking and yielding**: process N items (or work for ~5–10 ms measured with `performance.now()`), then yield back to the event loop so input and rendering can happen, then continue. Ways to yield: `await new Promise(r => setTimeout(r, 0))` (simple, subject to timer clamping), a `MessageChannel` postMessage (a task without clamping), or `scheduler.yield()` where supported (currently Chromium-based browsers; feature-detect it), which also keeps your continuation near the front of the queue. The alternative is moving the work off the main thread entirely with a **Web Worker**, which is the right call when the work is large and does not need the DOM. Chunking trades total throughput (slightly longer overall) for responsiveness (no single long task), which is almost always the right trade for UI.",
      "How to **measure** responsiveness: the simplest proxy is input delay — in an `input` or `pointerdown` handler compute `performance.now() - event.timeStamp`, which is how long the event waited in the queue before your handler ran. More rigorous: a `PerformanceObserver` observing `'event'` entries (Event Timing API, which underlies INP) or `'longtask'` entries (Chromium). The DevTools Performance panel shows long tasks with red corner markers and lets you see exactly which function filled the frame. Always measure before and after a change; 'it feels smoother' is not evidence.",
    ],
    examples: [
      {
        language: 'js',
        title: 'Predict the output (answer in the comment at the bottom)',
        code: `console.log('A');

setTimeout(() => console.log('B'), 0);

Promise.resolve()
  .then(() => console.log('C'))
  .then(() => console.log('D'));

queueMicrotask(() => console.log('E'));

(async () => {
  console.log('F');
  await null;
  console.log('G');
})();

console.log('H');

// Answer: A F H C E G D B
// Sync first: A, F (async fn body runs synchronously until await), H.
// Stack empties -> drain microtasks in FIFO order: C, E, G.
// Running C resolved the promise returned by the first .then, which
// queued D at the back of the microtask queue, so D comes after G.
// Only after microtasks are empty does the next task (the timer) run: B.`,
      },
      {
        language: 'js',
        title: 'Why the spinner never shows, and the fix',
        code: `button.addEventListener('click', () => {
  spinner.hidden = false;           // DOM updated, but not painted yet
  const ranked = rankCafes(cafes);  // 400 ms of synchronous work
  render(ranked);
  spinner.hidden = true;            // the user never sees the spinner
});

// Fix: let a frame happen before the heavy work starts
button.addEventListener('click', async () => {
  spinner.hidden = false;
  // wait for the next frame, then for the task after it, so the paint happens
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const ranked = await rankCafesChunked(cafes); // yields every ~8 ms
  render(ranked);
  spinner.hidden = true;
});`,
      },
      {
        language: 'js',
        title: 'A reusable yield helper and microtask starvation',
        code: `// Yield to the event loop so input + rendering can run.
function yieldToMain() {
  if (globalThis.scheduler && 'yield' in globalThis.scheduler) {
    return globalThis.scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// DON'T: this freezes the page. Each iteration is a microtask that queues
// another microtask, so the microtask queue never drains and no task,
// input event or frame ever gets a turn.
function spinForever() {
  Promise.resolve().then(spinForever);
}

// Fine (but wasteful): each iteration is a separate task, so the browser
// can render and handle input in between.
function pollForever() {
  setTimeout(pollForever, 0);
}`,
      },
      {
        language: 'js',
        title: 'Roughly how async/await desugars',
        code: `async function loadFavourites(userId) {
  const res = await fetch('/api/users/' + userId + '/favourites');
  const json = await res.json();
  return json.items;
}

// ...behaves roughly like:
function loadFavouritesDesugared(userId) {
  return Promise.resolve(fetch('/api/users/' + userId + '/favourites'))
    .then((res) => res.json())     // continuation 1: a microtask
    .then((json) => json.items);   // continuation 2: a microtask
}
// Errors thrown after an await reject the returned promise, just like a
// throw inside a .then callback.`,
      },
    ],
    keyTakeaways: [
      'One thread, one stack: while JS runs, nothing else on the main thread (input, rendering) can.',
      'After every task, and whenever the stack empties, the whole microtask queue drains before anything else.',
      'Rendering happens between tasks, roughly once per frame; DOM changes are not visible until you return.',
      'async/await is promise sugar: it orders work, it never makes CPU-bound code non-blocking.',
      'queueMicrotask = later in this turn (before paint); setTimeout(0) = a later turn (paint and input can happen first).',
      'Break long work into chunks of a few milliseconds and yield, or move it to a Web Worker; measure input delay before and after.',
    ],
    prerequisites: [
      'Comfortable with promises and async/await syntax',
      'Basic browser DevTools usage (Console, Performance panel)',
    ],
    prerequisiteWeeks: [2],
    resources: [
      {
        title: 'MDN: Using microtasks in JavaScript with queueMicrotask()',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide',
        kind: 'docs',
        note: 'Read the sections on tasks vs microtasks and when to use microtasks. Pay attention to the examples showing ordering.',
        minutes: 10,
      },
      {
        title: 'MDN: The event loop / JavaScript execution model',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop',
        kind: 'docs',
        note: 'Read the overview of stack, heap and queue and the run-to-completion section. MDN has been restructuring this page into an execution-model guide, so the URL may redirect.',
        minutes: 8,
        verify: true,
      },
      {
        title: "Jake Archibald: 'In The Loop' (JSConf.Asia talk)",
        url: 'https://www.youtube.com/watch?v=cCOL7MC4Pl0',
        kind: 'video',
        note: 'Watch the whole talk if you can (about 35 minutes); at minimum watch the parts on requestAnimationFrame and microtasks. The best visual model of where rendering fits in the loop. Use it as your intensive-week Learn resource if short on time.',
        minutes: 35,
        verify: true,
      },
      {
        title: 'Jake Archibald: Tasks, microtasks, queues and schedules',
        url: 'https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/',
        kind: 'article',
        note: 'Step through the interactive examples; the nested-click example is a great predict-the-output drill. Some browser-behaviour notes in it are historical.',
        minutes: 12,
        verify: true,
      },
      {
        title: 'web.dev: Optimize long tasks',
        url: 'https://web.dev/articles/optimize-long-tasks',
        kind: 'article',
        note: 'Read the sections on yielding to the main thread and scheduler.yield(). This is the practical playbook for the exercise.',
        minutes: 10,
        verify: true,
      },
    ],
    exercise: {
      title: 'Make NearBrew’s 50k-café ranking non-blocking and prove it',
      scenario:
        "NearBrew's web companion lets users type in a filter box while a 'Best near you' list is ranked client-side. In a stress test with 50,000 cafés (a big-city offline cache), ranking takes several hundred milliseconds and typing in the filter box stutters badly. You will reproduce the jank, measure it, fix it with chunking and yielding, and measure again.",
      setup: [
        'Create a folder `event-loop-lab` with an `index.html` and `main.js` (below). No build tool needed.',
        'Serve it with `npx serve .` or `python3 -m http.server 5173`, then open it in Chrome or Edge (needed for the long-task observer; other browsers still work for the input-delay meter).',
      ],
      steps: [
        'Warm-up (10 min): in a scratch file, write your predicted output for the predict-the-output example in this lesson, then run it in the browser console. If you got it wrong, write one sentence explaining which rule you missed.',
        'Write a second puzzle yourself that mixes `setTimeout`, `await`, `queueMicrotask` and `requestAnimationFrame`, predict it, then run it. Note that rAF timing relative to timers can vary by frame, which is itself a lesson.',
        'Add the starter `index.html` and `main.js`. Click **Rank (blocking)**, then immediately type quickly into the filter box. Watch the input-delay readout and the console long-task logs.',
        "Record a DevTools Performance trace while clicking **Rank (blocking)** and typing. Find the long task, note its duration, and confirm the function at the bottom of the flame chart is `scoreCafe`/`sort`.",
        'Implement `rankChunked` in `main.js`: score cafés in chunks, checking `performance.now()` and yielding via `yieldToMain()` whenever the chunk has run for more than ~8 ms. Show progress in the status element so the user sees the work happening.',
        'Sorting 50k items is itself a long-ish task (often tens of ms). Measure it separately. If it is above ~50 ms on your machine, either sort per chunk and merge, or keep only the top 200 with a simple bounded insertion so you never sort the full array.',
        'Make the ranking cancellable: if the user clicks Rank again (or types a new filter) mid-way, abort the old run using an `AbortController` signal checked at each yield.',
        'Click **Rank (chunked)** and type again. Compare max input delay and long-task count with the blocking version and record both numbers in a comment at the top of `main.js`.',
        'Optional within the hour: move `scoreCafe` into a Web Worker and compare. Write two sentences on when you would choose a worker over chunking.',
      ],
      starter: [
        {
          language: 'html',
          title: 'index.html',
          code: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Event loop lab</title>
    <style>
      body { font: 16px system-ui; margin: 2rem; }
      #status, #delay { font-family: ui-monospace, monospace; }
    </style>
  </head>
  <body>
    <input id="filter" placeholder="Type here while ranking..." size="40" />
    <button id="blocking">Rank (blocking)</button>
    <button id="chunked">Rank (chunked)</button>
    <p id="status">idle</p>
    <p id="delay">max input delay: 0 ms</p>
    <ol id="results"></ol>
    <script type="module" src="./main.js"></script>
  </body>
</html>`,
        },
        {
          language: 'js',
          title: 'main.js',
          code: `// Results: blocking max delay = ___ ms, long tasks = ___
//          chunked  max delay = ___ ms, long tasks = ___

const $ = (id) => document.getElementById(id);
const USER = { lat: 51.5072, lng: -0.1276 };

// 50k fake cafes
const cafes = Array.from({ length: 50_000 }, (_, i) => ({
  id: 'cafe_' + i,
  name: 'Cafe ' + i,
  lat: 51.3 + Math.random() * 0.4,
  lng: -0.5 + Math.random() * 0.7,
  rating: 3 + Math.random() * 2,
  reviewCount: Math.floor(Math.random() * 2000),
  openNow: Math.random() > 0.3,
}));

function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Deliberately a bit expensive, like a real scoring model
function scoreCafe(cafe) {
  let s = 0;
  for (let k = 0; k < 40; k++) {
    const d = haversineKm(USER, cafe);
    s = cafe.rating * Math.log10(cafe.reviewCount + 10) - d * 0.8 + (cafe.openNow ? 2 : 0);
  }
  return s;
}

function rankBlocking() {
  const scored = cafes.map((c) => ({ c, s: scoreCafe(c) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 20);
}

function yieldToMain() {
  if (globalThis.scheduler && 'yield' in globalThis.scheduler) {
    return globalThis.scheduler.yield();
  }
  return new Promise((r) => setTimeout(r, 0));
}

async function rankChunked(signal, onProgress) {
  // TODO: score in chunks; every ~8 ms (performance.now()) call onProgress(i)
  // and await yieldToMain(); throw if signal.aborted.
  // TODO: avoid one big sort of 50k items (bounded top-k or sort-then-merge).
  throw new Error('implement me');
}

function render(top) {
  $('results').innerHTML = top
    .map(({ c, s }) => '<li>' + c.name + ' (' + s.toFixed(2) + ')</li>')
    .join('');
}

// --- measurement ---
let maxDelay = 0;
$('filter').addEventListener('input', (e) => {
  const delay = performance.now() - e.timeStamp;
  maxDelay = Math.max(maxDelay, delay);
  $('delay').textContent = 'max input delay: ' + maxDelay.toFixed(0) + ' ms';
});

let longTasks = 0;
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      longTasks++;
      console.log('long task', entry.duration.toFixed(0) + ' ms', 'total', longTasks);
    }
  }).observe({ type: 'longtask', buffered: true });
} catch {
  console.log('Long Tasks API not supported in this browser');
}

$('blocking').addEventListener('click', () => {
  maxDelay = 0;
  $('status').textContent = 'ranking...'; // never painted - why?
  const t0 = performance.now();
  render(rankBlocking());
  $('status').textContent = 'done in ' + (performance.now() - t0).toFixed(0) + ' ms';
});

let controller;
$('chunked').addEventListener('click', async () => {
  maxDelay = 0;
  controller?.abort();
  controller = new AbortController();
  const t0 = performance.now();
  try {
    const top = await rankChunked(controller.signal, (i) => {
      $('status').textContent = 'ranked ' + i + ' / ' + cafes.length;
    });
    render(top);
    $('status').textContent = 'done in ' + (performance.now() - t0).toFixed(0) + ' ms';
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }
});`,
        },
      ],
      expected: [
        "Blocking version: typing freezes; the input-delay readout jumps to several hundred ms; the 'ranking...' status is never visible; the console logs one long task of roughly the full ranking duration.",
        'Chunked version: typing stays smooth; max input delay stays roughly within one chunk budget plus a frame (well under 100 ms); the progress text visibly updates; few or no long tasks are logged.',
        'Total time for the chunked version is somewhat longer than the blocking version — this is the expected throughput-for-responsiveness trade.',
        'Clicking Chunked twice quickly aborts the first run instead of racing two renders.',
      ],
      hints: [
        "Inside the loop: `if (performance.now() - sliceStart > 8) { onProgress(i); await yieldToMain(); if (signal.aborted) throw new DOMException('aborted', 'AbortError'); sliceStart = performance.now(); }`.",
        'For top-k, keep an array of the best 20 sorted descending; for each item, if it beats the last element, insert it in place and pop. That is O(n·k) with k = 20, far cheaper than sorting 50k.',
        "If the input-delay meter reports 0 during blocking, you probably typed after the task ended. Click, then start typing immediately; queued keystrokes will show large delays once the task finishes.",
        'In DevTools Performance, enable CPU throttling (4x) to make the effect obvious on a fast laptop.',
      ],
      verification: [
        'You have before/after numbers (max input delay and long-task count) written at the top of `main.js`.',
        'A Performance trace of the chunked version shows many short tasks instead of one long one.',
        'You can explain, without notes, why the blocking status text never painted.',
        'Your predict-the-output answers matched the console, or you can name the rule you missed.',
      ],
    },
    successChecklist: [
      'Correctly predicted the lesson’s predict-the-output example and one puzzle you wrote yourself',
      'Captured a DevTools trace showing the long task in the blocking version',
      'Implemented chunked ranking with time-budgeted yielding and cancellation',
      'Measured max input delay before and after and recorded the numbers',
      'Can explain the difference between queueMicrotask and setTimeout(0) in terms of rendering',
      'Can explain why `await` does not make CPU-bound code non-blocking',
    ],
    questions: [
      {
        question:
          'A teammate says: "I made `computeRecommendations` async and awaited it, so it no longer blocks the UI." Is that right? What actually happens?',
        answer:
          'No. Marking a function `async` only changes its return value into a promise and lets it use `await`; the body still runs synchronously on the main thread until the first `await` of something that is not already done. If `computeRecommendations` is CPU-bound, the call stack is occupied for its whole duration, so input events and rendering are blocked exactly as before. `await` only schedules the code after it as a microtask once the awaited value settles. To actually unblock the UI you must either break the work into chunks and yield to the event loop between them (setTimeout, MessageChannel, scheduler.yield), or move it to a Web Worker.',
      },
      {
        question:
          'What is the difference between `queueMicrotask(fn)` and `setTimeout(fn, 0)`, and when would you choose each?',
        answer:
          'Both run `fn` after the current synchronous code finishes, but `queueMicrotask` puts it on the microtask queue, which is drained completely as soon as the stack empties, before the browser renders or processes the next task such as an input event. `setTimeout(fn, 0)` creates a new task, so rendering and other tasks can run first, and the delay may be clamped to around 4 ms when timers are nested or throttled in background tabs. Choose a microtask when you need work to happen consistently before the browser yields, for example batching several synchronous state changes into one flush. Choose a task (or scheduler.yield) when you want to give the browser a chance to paint or respond to input, for example between chunks of heavy work. Using microtasks to break up heavy work does not help at all, because no rendering happens until the microtask queue is empty.',
      },
      {
        question: 'How can a page freeze even though no single callback runs for more than a millisecond?',
        answer:
          'Through microtask starvation. If every microtask queues another microtask — for example a recursive `Promise.resolve().then(loop)` or a polling loop written with `await` on already-resolved promises — the microtask queue never becomes empty. The event loop only moves on to the next task and to rendering once microtasks are drained, so input handlers, timers and paints never get a turn and the page appears frozen. The same pattern written with `setTimeout` would not freeze, because each iteration is a separate task and the browser can render and handle input in between. The fix is to yield with a task-based mechanism or restructure the loop so it terminates.',
      },
    ],
    explainPrompt:
      'Explain to a mid-level teammate in a code review why their loading spinner never appears during a heavy client-side ranking, and walk them through the fix. Cover the call stack, tasks vs microtasks, where rendering happens, and why making the function async did not help.',
    rubric: [
      'States that rendering only happens between tasks, after the stack and microtask queue are empty',
      'Distinguishes tasks from microtasks with a correct example of each',
      'Explains that async/await orders work but does not offload CPU work',
      'Proposes a concrete fix (time-budgeted chunking with a task-based yield, or a Web Worker) and its trade-off',
      'Mentions how to measure the improvement (input delay, long tasks, Performance panel)',
    ],
    referenceExplanation:
      "The spinner code sets `hidden = false`, but the browser can only paint after your click handler returns. The main thread has one call stack; while your handler is running the ranking, nothing else on that thread can happen — not other event handlers, not style, layout or paint. The event loop runs one task (here, the click event dispatch), then drains the microtask queue (promise callbacks, code after `await`), and only then may it take a rendering opportunity, roughly once per frame. So the DOM change to show the spinner is real, but by the time the browser gets to paint, you've already hidden it again.\n\nMaking `rankCafes` async didn't change that. An async function runs synchronously until its first `await`, and awaiting CPU-bound work just schedules the next line as a microtask; microtasks also run before rendering. The CPU is busy for the same 400 ms either way.\n\nThe fix is to give the browser turns. First, let one frame happen after showing the spinner, for example by awaiting a `requestAnimationFrame` followed by a `setTimeout`. Then process cafés in time-boxed slices of about 8 ms and yield with a task between slices — `scheduler.yield()` where available, otherwise `setTimeout(0)` or a MessageChannel. Each slice is now a short task, so keystrokes and paints slot in between. Total time goes up slightly, but no single task blocks input. If the work were much bigger or didn't need the DOM, I'd move it to a Web Worker instead. We should verify with numbers: measure input delay with `performance.now() - event.timeStamp` and count long tasks in a DevTools trace before and after.",
    stretch: {
      title: 'Build a tiny cooperative scheduler',
      description:
        'Write a `runTasks(tasks, { budgetMs })` helper that accepts an array of generator functions (each `yield` marks a safe pause point), runs them round-robin within a frame budget, prioritises a "user-blocking" lane over a "background" lane, and supports cancellation. Use it to run café ranking (background) and filter-box suggestions (user-blocking) concurrently, and show in a trace that suggestions stay snappy.',
    },
    lightTask:
      'Spend 30 minutes on the predict-the-output drill: run the lesson example in the console after writing your prediction, then write and predict two more puzzles of your own mixing setTimeout, await, queueMicrotask and requestAnimationFrame. For each mistake, write one sentence naming the rule (for example, "microtasks queued by microtasks run before the next task").',
    intensiveExtras: [
      'Move `scoreCafe` into a Web Worker, transfer the café data once, and compare total time and input delay with the chunked version.',
      'Write a microtask-starvation demo page and a recursive-setTimeout demo page; record a trace of each and annotate why one freezes and the other does not.',
      'Use a `PerformanceObserver` with `type: "event"` and `durationThreshold: 16` to log the slowest interactions while using the chunked ranking, and identify which phase (input delay, processing, presentation) dominates.',
      'Find one real place in a codebase you work on where a large synchronous loop runs in an event handler, and sketch how you would chunk or offload it.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['js-ts', 'cs-fundamentals', 'rendering-performance'],
    depth: 'detailed',
  },

  // ---------------------------------------------------------------------------
  // Week 6 — TypeScript domain modelling
  // ---------------------------------------------------------------------------
  {
    week: 6,
    slug: 'typescript-domain-modelling',
    title: 'TypeScript for domain modelling',
    track: 'frontend',
    secondaryTracks: ['backend'],
    topics: [
      'discriminated unions',
      'narrowing',
      'exhaustiveness checking',
      'never',
      'branded types',
      'unknown at boundaries',
      'type guards',
      'runtime validation',
      'generics with constraints',
      'satisfies',
    ],
    objective:
      'By the end you can model a booking lifecycle as a discriminated-union state machine that makes illegal states unrepresentable, parse untrusted API data at the boundary into those types, and use generics, branded IDs and `satisfies` to keep the compiler doing real work for you.',
    whyItMatters:
      "Most production bugs in typed frontends live where the types lie: an optional field that is 'always there when confirmed', an `any` from `res.json()`, a userId passed where a cafeId was expected, or a new status added on the backend that the UI silently ignores. Modelling the domain precisely moves those bugs from runtime to compile time and makes refactors safe. It is also how senior engineers communicate intent in code: the types become the documentation of what states exist and which transitions are legal.",
    explanation: [
      "The core idea is **make illegal states unrepresentable**. A common anti-pattern is one wide interface with optional fields: `{ status: string; holdExpiresAt?: Date; confirmedAt?: Date; paymentId?: string; cancelReason?: string }`. It permits nonsense like a cancelled booking with a payment ID but no reason, and every consumer has to guess which fields exist in which status, sprinkling `!` and `?.` everywhere. The alternative is a **discriminated union**: one variant per state, each with exactly the fields that state has, sharing a literal **discriminant** property such as `status: 'held'`.",
      "TypeScript **narrows** a union when you check the discriminant. Inside `if (b.status === 'confirmed')` or `case 'confirmed':`, the compiler knows `b` is the confirmed variant, so `b.paymentId` is a `string`, not `string | undefined`. Narrowing also works with `typeof`, `instanceof`, `in` checks, truthiness, and user-defined type guards. The mental model: the type of a variable is not fixed, it is the set of possible values at that point in the control flow, and each check removes possibilities.",
      "**Exhaustiveness checking with `never`** is what makes unions pay off over time. In a `switch` over the discriminant, after every case is handled, the variable's type in the `default` branch is `never` (no possibilities left). If you pass it to a function `assertNever(x: never): never`, then the day someone adds a `'no_show'` status, every switch that forgot to handle it becomes a compile error pointing at the exact line. Compare that with a `default: return 'Unknown'` branch, which silently swallows the new state. Enabling `noFallthroughCasesInSwitch` and making functions return a value from every case strengthens this further.",
      "A **state machine** is the natural next step: represent transitions as functions whose input type is the specific state they accept and whose output is the next state, e.g. `confirm(b: HeldBooking, paymentId: PaymentId, now: Date): ConfirmedBooking`. Now 'confirm a cancelled booking' does not compile. For events that arrive dynamically (from a reducer or a websocket) you write one `transition(state, event)` function with a nested switch, and return either the next state or an explicit error. This is the same discipline as a backend status column with allowed transitions, expressed in the type system.",
      "**Branded (nominal) types** fix the problem that TypeScript is structurally typed: a `BookingId` that is just `string` is interchangeable with a `UserId` or a café name. A brand intersects the primitive with a phantom property: `type BookingId = string & { readonly __brand: 'BookingId' }`. At runtime it is still a plain string (zero cost), but the compiler refuses to pass a `UserId` where a `BookingId` is expected. You create branded values only through a constructor or parser (`asBookingId(raw)`) that validates the format, so having a `BookingId` is evidence that validation happened. Brands also work for units: `Minutes` vs `Seconds`, `Cents` vs `Euros`.",
      "**Treat external data as `unknown` at the boundary.** `res.json()` returns `Promise<any>`, and `any` is contagious: it switches off checking everywhere it flows. Instead annotate the parsed body as `unknown`, which forces you to check before use, and convert it into your domain types in one place — a **parser** that returns either a typed value or an error. 'Parse, don't validate': rather than checking a value and continuing to pass the loose type around, the parser's output type records what you learned. Inside the app, you then trust the types; at the edges (HTTP responses, `localStorage`, `postMessage`, URL params, feature-flag payloads) you verify.",
      "Hand-written **type guards** (`function isRecord(x: unknown): x is Record<string, unknown>`) are fine for small shapes and teach you exactly what narrowing does, but they are easy to get subtly wrong because the compiler trusts the `x is T` claim without checking your logic. For anything sizeable, schema libraries in the **zod**, valibot or io-ts style let you declare a schema once and derive both the runtime validator and the static type from it (`z.infer<typeof Schema>`), so they cannot drift apart. The principle matters more than the library: one boundary, one parser, typed output, explicit failure handling (show an error state, log it, do not crash deep inside a component).",
      "**Generics with constraints** let you write reusable helpers that stay precise. `function byId<T extends { id: string }>(items: readonly T[]): Map<string, T>` works for cafés, reviews or bookings and returns the caller's actual type, not a lossy base type. `K extends keyof T` lets a function accept only real property names of `T`. Constraints are how you say 'any type, as long as it has these capabilities'. A good smell test: if a generic parameter appears only once in a signature, it probably is not doing anything and `unknown` or a concrete type would be clearer.",
      "The **`satisfies` operator** (TypeScript 4.9+) checks that an expression conforms to a type **without widening** the expression's own inferred type. `const statusLabel = { draft: 'Draft', held: 'On hold', … } satisfies Record<BookingStatus, string>` errors if you forget a status or misspell one (exhaustiveness for lookup tables), while still letting TypeScript remember the exact keys and literal values. With a plain annotation (`: Record<BookingStatus, string>`) you get the check but lose the literal types; with no annotation you keep the literals but lose the check. Use `satisfies` for config objects, route tables, label maps and test fixtures.",
    ],
    examples: [
      {
        language: 'ts',
        title: 'Booking state machine with a discriminated union and exhaustive switch',
        code: `type Brand<T, B extends string> = T & { readonly __brand: B };
export type BookingId = Brand<string, 'BookingId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type SlotId = Brand<string, 'SlotId'>;

type Base = { id: BookingId; slotId: SlotId; partySize: number };

export type Booking =
  | (Base & { status: 'draft' })
  | (Base & { status: 'held'; holdExpiresAt: Date })
  | (Base & { status: 'confirmed'; confirmedAt: Date; paymentId: PaymentId })
  | (Base & { status: 'cancelled'; cancelledAt: Date; reason: 'user' | 'venue' | 'hold_expired' })
  | (Base & { status: 'completed'; completedAt: Date });

export type BookingStatus = Booking['status'];
type Of<S extends BookingStatus> = Extract<Booking, { status: S }>;

export function assertNever(x: never): never {
  throw new Error('Unhandled variant: ' + JSON.stringify(x));
}

// Transitions only accept the states they are legal from.
export function confirm(b: Of<'held'>, paymentId: PaymentId, now: Date): Of<'confirmed'> {
  const { holdExpiresAt: _ignored, ...rest } = b;
  return { ...rest, status: 'confirmed', confirmedAt: now, paymentId };
}

export function describe(b: Booking): string {
  switch (b.status) {
    case 'draft':
      return 'Not submitted yet';
    case 'held':
      return 'Held until ' + b.holdExpiresAt.toLocaleTimeString();
    case 'confirmed':
      return 'Confirmed (payment ' + b.paymentId + ')';
    case 'cancelled':
      return 'Cancelled: ' + b.reason;
    case 'completed':
      return 'Completed';
    default:
      return assertNever(b); // add a status -> compile error here
  }
}`,
      },
      {
        language: 'ts',
        title: 'Parsing an unknown API response at the boundary',
        code: `type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const isIsoDate = (x: unknown): x is string =>
  typeof x === 'string' && !Number.isNaN(Date.parse(x));

export function asBookingId(raw: unknown): BookingId | null {
  return typeof raw === 'string' && /^bk_[a-z0-9]{8,}$/.test(raw) ? (raw as BookingId) : null;
}

export function parseBooking(input: unknown): Result<Booking> {
  if (!isRecord(input)) return { ok: false, error: 'not an object' };
  const id = asBookingId(input.id);
  if (!id) return { ok: false, error: 'bad id' };
  if (typeof input.slotId !== 'string') return { ok: false, error: 'bad slotId' };
  if (typeof input.partySize !== 'number' || input.partySize < 1)
    return { ok: false, error: 'bad partySize' };
  const base = { id, slotId: input.slotId as SlotId, partySize: input.partySize };

  switch (input.status) {
    case 'held':
      if (!isIsoDate(input.holdExpiresAt)) return { ok: false, error: 'held without expiry' };
      return { ok: true, value: { ...base, status: 'held', holdExpiresAt: new Date(input.holdExpiresAt) } };
    // ...one case per status...
    default:
      return { ok: false, error: 'unknown status ' + String(input.status) };
  }
}

// Usage: the only place that touches raw JSON.
export async function fetchBooking(id: BookingId): Promise<Result<Booking>> {
  const res = await fetch('/api/bookings/' + id);
  if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
  const body: unknown = await res.json(); // not any
  return parseBooking(body);
}`,
      },
      {
        language: 'ts',
        title: 'Generics with constraints and satisfies',
        code: `// Works for any entity with an id; returns the caller's precise type.
export function indexById<T extends { id: string }>(items: readonly T[]): Map<T['id'], T> {
  return new Map(items.map((item) => [item.id, item] as const));
}

// K must be a real key of T, and the result is typed per key.
export function groupBy<T, K extends keyof T>(items: readonly T[], key: K): Map<T[K], T[]> {
  const out = new Map<T[K], T[]>();
  for (const item of items) {
    const k = item[key];
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

// satisfies: checked for completeness, literal types preserved.
export const statusBadge = {
  draft: { label: 'Draft', tone: 'neutral' },
  held: { label: 'On hold', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'neutral' },
} satisfies Record<BookingStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }>;

// statusBadge.held.tone has type 'warning', not the wider union,
// and removing the 'completed' entry is a compile error.`,
      },
    ],
    keyTakeaways: [
      'Model each state as its own union variant with exactly its fields; avoid one interface full of optionals.',
      'Switch on the discriminant and end with assertNever so new variants break the build, not production.',
      'Write transitions whose parameter types encode which states they are legal from.',
      'Brand IDs and units so structurally identical strings and numbers cannot be mixed up.',
      'External data is unknown until parsed at one boundary; parsers return typed values or explicit errors.',
      'Use generic constraints to keep helpers precise, and satisfies to check objects without losing literal types.',
    ],
    prerequisites: [
      'Day-to-day TypeScript with React (interfaces, unions, basic generics)',
      'Familiarity with fetching JSON from a REST API',
    ],
    prerequisiteWeeks: [3],
    resources: [
      {
        title: 'TypeScript Handbook: Narrowing',
        url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html',
        kind: 'docs',
        note: 'Read the sections on discriminated unions, the never type and exhaustiveness checking, and using type predicates.',
        minutes: 12,
      },
      {
        title: 'TypeScript Handbook: Generics',
        url: 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
        kind: 'docs',
        note: 'Read Generic Constraints and Using Type Parameters in Generic Constraints (the keyof example).',
        minutes: 8,
      },
      {
        title: 'TypeScript 4.9 release notes: the satisfies operator',
        url: 'https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html',
        kind: 'docs',
        note: 'Read only the satisfies section; the colour-palette example maps directly onto status label tables.',
        minutes: 5,
      },
      {
        title: "Alexis King: Parse, don't validate",
        url: 'https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/',
        kind: 'article',
        note: 'Examples are in Haskell, but read the argument: a parser’s return type should record what you checked. Skim code, read prose.',
        minutes: 10,
        verify: true,
      },
      {
        title: 'Zod documentation',
        url: 'https://zod.dev',
        kind: 'docs',
        note: 'Optional: skim the basic usage and type inference sections to see how a schema library derives types from runtime validators. Not required for the exercise.',
        minutes: 5,
      },
    ],
    exercise: {
      title: 'Type-safe booking lifecycle for a café table-reservation feature',
      scenario:
        'NearBrew is adding table reservations at partner cafés. A booking goes draft -> held (a 10-minute hold while the user pays) -> confirmed -> completed, and can be cancelled by the user, by the venue, or automatically when a hold expires. The backend returns bookings as JSON and is known to occasionally send unexpected statuses during deploys. You will build the domain module that the React screens will depend on.',
      setup: [
        'Create a scratch project: `mkdir booking-types && cd booking-types && npm init -y && npm i -D typescript vitest`.',
        'Create `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noFallthroughCasesInSwitch": true`, `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`.',
        'Create `src/booking.ts` and `src/booking.test.ts`. Run checks with `npx tsc --noEmit` and tests with `npx vitest run`.',
      ],
      steps: [
        'Start from the "before" type in the starter. List, in a comment, three illegal states it allows (for example, confirmed without a paymentId).',
        'Replace it with a discriminated union `Booking` with variants draft, held, confirmed, cancelled, completed, each carrying only its own fields. Add branded `BookingId`, `SlotId`, `PaymentId` and a `Brand` helper.',
        'Write `describe(b: Booking): string` with an exhaustive `switch` ending in `assertNever`. Then temporarily add a `no_show` variant and confirm the compiler points at every switch that needs updating. Remove it (or handle it) afterwards.',
        "Write typed transition functions: `hold(draft, now)`, `confirm(held, paymentId, now)`, `cancel(b: Of<'held'> | Of<'confirmed'>, reason, now)`, `complete(confirmed, now)`. Verify with a `// @ts-expect-error` line that `confirm(cancelledBooking, …)` does not compile.",
        "Write an event-driven `transition(state: Booking, event: BookingEvent, now: Date): Result<Booking, string>` where `BookingEvent` is itself a discriminated union (`{ type: 'PAY_SUCCEEDED'; paymentId }`, `{ type: 'HOLD_EXPIRED' }`, …). Illegal combinations return `{ ok: false }` rather than throwing.",
        'Write `parseBooking(input: unknown): Result<Booking, string>` using hand-written guards. Dates arrive as ISO strings; IDs must match `bk_…`, `slot_…`, `pay_…` prefixes. Unknown statuses must return an error, not crash.',
        'Add a `statusBadge` lookup table using `satisfies Record<BookingStatus, …>` and a generic `groupBy<T, K extends keyof T>` used to group a list of bookings by status for a dashboard.',
        'Write Vitest tests: parsing valid fixtures for each status, rejecting at least four malformed payloads (missing field, wrong type, unknown status, bad ID prefix), and each legal and one illegal transition.',
        'Finally, write a 5-line comment describing where in a React app `parseBooking` should be called (the fetch layer or query function, not inside components) and what the UI shows when parsing fails.',
      ],
      starter: [
        {
          language: 'ts',
          title: 'src/booking.ts (starting point)',
          code: `// BEFORE: the type you are replacing. What illegal states does it allow?
export interface LooseBooking {
  id: string;
  slotId: string;
  partySize: number;
  status: string;
  holdExpiresAt?: string;
  confirmedAt?: string;
  paymentId?: string;
  cancelReason?: string;
  completedAt?: string;
}

// AFTER: fill these in.
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type BookingId = Brand<string, 'BookingId'>;
// export type SlotId = ...
// export type PaymentId = ...

// export type Booking = ...
// export type BookingStatus = Booking['status'];
// export type Of<S extends BookingStatus> = Extract<Booking, { status: S }>;

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function assertNever(x: never): never {
  throw new Error('Unhandled variant: ' + JSON.stringify(x));
}

export type BookingEvent =
  | { type: 'SUBMIT' }
  | { type: 'PAY_SUCCEEDED'; paymentId: string }
  | { type: 'HOLD_EXPIRED' }
  | { type: 'USER_CANCELLED' }
  | { type: 'VENUE_CANCELLED' }
  | { type: 'VISIT_COMPLETED' };

export function parseBooking(_input: unknown): Result<never> {
  return { ok: false, error: 'not implemented' };
}`,
        },
        {
          language: 'ts',
          title: 'src/booking.test.ts (starting point)',
          code: `import { describe as group, it, expect } from 'vitest';
import { parseBooking } from './booking';

const heldJson = {
  id: 'bk_12345678',
  slotId: 'slot_abc123',
  partySize: 2,
  status: 'held',
  holdExpiresAt: '2026-10-12T10:10:00Z',
};

group('parseBooking', () => {
  it('parses a held booking', () => {
    const r = parseBooking(heldJson);
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown status', () => {
    const r = parseBooking({ ...heldJson, status: 'teleported' });
    expect(r.ok).toBe(false);
  });

  it('rejects a held booking without expiry', () => {
    const { holdExpiresAt: _drop, ...rest } = heldJson;
    expect(parseBooking(rest).ok).toBe(false);
  });
});`,
        },
      ],
      expected: [
        '`npx tsc --noEmit` passes with strict settings and no `any`, `as any` or non-null assertions in your domain code (a single `as BookingId` inside the validated constructor is fine).',
        'Adding a new variant to `Booking` produces compile errors in `describe`, `transition` and the `statusBadge` table.',
        '`@ts-expect-error` lines prove that illegal transitions and mixed-up IDs do not compile.',
        'All parser tests pass, including the malformed-payload cases, and none of them throw.',
      ],
      hints: [
        "`Extract<Booking, { status: 'held' }>` pulls one variant out of the union; wrap it in a helper type `Of<S>` to keep signatures readable.",
        'When transitioning, destructure away fields that do not belong in the next state (for example `holdExpiresAt`) so the object literal type-checks as the target variant.',
        'If narrowing does not happen after a check, you probably stored the discriminant in a separate variable before checking or widened the type with an annotation; check `b.status` directly.',
        'For the parser, validate shared base fields once, then switch on `input.status` and validate per-variant fields.',
      ],
      verification: [
        'Run `npx tsc --noEmit` and `npx vitest run`; both are green.',
        'Grep your file for `any` and `!.`; there should be none in domain code.',
        'Temporarily add a `no_show` status and count the compile errors; each points to a place that genuinely needs a decision.',
        'Explain to yourself why `parseBooking` returns a `Result` rather than throwing, and where the error surfaces in the UI.',
      ],
    },
    successChecklist: [
      'Booking is a discriminated union with no optional fields that depend on status',
      'Every switch over status ends with assertNever and adding a variant breaks the build',
      'Transitions are typed so illegal ones do not compile (proven with @ts-expect-error)',
      'IDs are branded and created only through validating constructors',
      'parseBooking takes unknown, returns a Result, and has tests for at least four malformed payloads',
      'A label/badge table uses satisfies and a helper uses a constrained generic',
    ],
    questions: [
      {
        question:
          'Why is a discriminated union better than one interface with optional fields for a booking, and what does it cost?',
        answer:
          'A union encodes which fields exist in which state, so the compiler can narrow on `status` and guarantee, for example, that a confirmed booking has a `paymentId`. With one interface of optionals, every consumer must guess the relationships and use `?.` or `!`, and nonsense combinations like a cancelled booking without a reason are representable and will eventually be created. Unions also enable exhaustiveness checking, so adding a state forces every switch to handle it. The costs are more verbose type definitions, transition code that must construct the new variant explicitly, and the need to parse incoming data into the correct variant rather than casting. For a core domain object those costs are small compared with the bugs prevented.',
      },
      {
        question: 'What does `assertNever` actually do, at compile time and at runtime?',
        answer:
          'At compile time it is a function whose parameter type is `never`, so you can only call it with a value the compiler has proven to have no remaining possibilities. In the default branch of a switch over a discriminant, the value is `never` only if every variant was handled; if a new variant is added, the value has that variant type and the call becomes a type error at that line. At runtime it throws, which matters because types can be wrong at runtime when data came from an unvalidated source or a newer backend. That throw should be rare if you parse at the boundary, and it is far better than silently rendering the wrong thing. It is a cheap, explicit statement that the switch is meant to be exhaustive.',
      },
      {
        question:
          'When would you choose `satisfies` over a type annotation, and how is it different from `as`?',
        answer:
          'Use `satisfies` when you want the compiler to check that a value conforms to a type but keep the more specific inferred type, for example a status-to-label map that must cover every status but whose values you want to keep as literal types. A type annotation also checks, but then the variable has the annotated, wider type, losing literal keys and values. `as` is the opposite of a check: it is an assertion that tells the compiler to trust you, and it allows many incorrect conversions, so it hides mistakes instead of catching them. In short, annotations check and widen, `satisfies` checks and preserves, and `as` skips checking. Prefer `satisfies` for config and lookup tables and reserve `as` for validated constructors like branded IDs.',
      },
    ],
    explainPrompt:
      'Explain to an interviewer how you would model and protect a booking lifecycle in a TypeScript frontend, from the API response to the component that renders it. Cover discriminated unions, exhaustiveness, branded IDs and parsing unknown data at the boundary, and mention one trade-off.',
    rubric: [
      'Explains the illegal-states-unrepresentable idea with a concrete booking example',
      'Describes narrowing and exhaustiveness via never, including what happens when a new status is added',
      'Explains branded types and why structural typing makes them necessary',
      'Places runtime parsing at a single boundary and explains how parse failures surface',
      'Names a real trade-off (verbosity, schema duplication, library vs hand-written guards)',
    ],
    referenceExplanation:
      "I start from the domain, not the JSON. A booking can be draft, held, confirmed, cancelled or completed, and each state has different data: a hold has an expiry, a confirmed booking has a payment ID, a cancellation has a reason. So I model it as a discriminated union with one variant per status, each carrying exactly its own fields. That means a confirmed booking without a payment ID simply can't be constructed, and inside `case 'confirmed'` the compiler knows `paymentId` is there — no optional chaining or non-null assertions.\n\nEvery switch over status ends with `assertNever`. When the backend adds a `no_show` status, the build breaks at each place that needs a product decision, instead of a default branch quietly rendering 'Unknown'. Transitions are typed functions like `confirm(held, paymentId)`, so confirming a cancelled booking doesn't compile.\n\nIDs are branded — a `BookingId` is a string at runtime but a distinct type at compile time — so I can't pass a user ID to `cancelBooking`. Brands are created only by a validating constructor.\n\nThe API is the one place types can lie, so `res.json()` goes into an `unknown`, and a single `parseBooking` function turns it into a `Booking` or returns an error result. That runs in the data layer, so components only ever see trusted types, and a parse failure becomes an explicit error state plus a log, rather than a crash three components deep. For larger schemas I'd use a zod-style library so the validator and type come from one definition.\n\nThe trade-off is verbosity and some ceremony in transitions and parsers, which I accept for core domain objects but wouldn't impose on every small UI prop type.",
    stretch: {
      title: 'Type-level transition table',
      description:
        "Define a type `Transitions = { draft: 'held' | 'cancelled'; held: 'confirmed' | 'cancelled'; confirmed: 'completed' | 'cancelled'; cancelled: never; completed: never }` and write a generic `move<From extends BookingStatus, To extends Transitions[From]>(b: Of<From>, to: To, data: …): Of<To>` so the allowed-transitions table is the single source of truth. Then derive a runtime array of allowed transitions from the same object using `satisfies` so the backend contract tests can share it.",
    },
    lightTask:
      'In 30 minutes: write the `Booking` discriminated union with branded IDs and a `describe` function with an exhaustive switch ending in `assertNever`. Then add a `no_show` variant, observe the compile error, and handle it. Compile with `npx tsc --noEmit --strict` on the single file.',
    intensiveExtras: [
      'Rewrite `parseBooking` with a zod-style schema library and compare the size, error messages and how types are derived; note which you would choose for a team and why.',
      'Wire the domain module into a tiny React screen using a reducer whose actions are `BookingEvent` and whose state is `Booking`; render a different component per status.',
      'Add branded unit types `Cents` and `Minutes` to the booking (deposit and duration) and find any arithmetic that needs explicit conversion.',
      'Audit one real codebase file you own for `any`, `as` and wide optional-field interfaces, and refactor one of them into a union with a parser at its boundary.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['js-ts', 'ui-reliability', 'api-design', 'feature-ownership'],
    depth: 'detailed',
  },

  // ---------------------------------------------------------------------------
  // Week 7 — Transactions and locking
  // ---------------------------------------------------------------------------
  {
    week: 7,
    slug: 'postgres-transactions-isolation-locking',
    title: 'Transactions, isolation levels, optimistic vs pessimistic locking',
    track: 'backend',
    secondaryTracks: ['system-design'],
    topics: [
      'ACID',
      'isolation levels',
      'read committed',
      'repeatable read',
      'serializable',
      'lost update',
      'write skew',
      'SELECT FOR UPDATE',
      'optimistic locking',
      'exclusion constraints',
      'double-booking',
      'PDO transactions',
    ],
    objective:
      'By the end you can reproduce a lost update and a double-booking in PostgreSQL with two concurrent sessions, explain which isolation level or locking strategy prevents each, and implement both pessimistic (FOR UPDATE) and optimistic (version column) fixes plus a database constraint that makes double-booking impossible.',
    whyItMatters:
      "Concurrency bugs pass every test you run alone on your laptop and then appear in production the first time two people tap 'Book' within the same second. Double-booked tables, oversold seats, lost edits in a dashboard and negative balances are all the same class of bug: read-check-write logic that assumed nobody else was writing. Knowing what your database actually guarantees by default — and how to make it guarantee more — is core backend judgment, and booking systems are a very common design and interview topic.",
    explanation: [
      "A **transaction** groups statements so they behave as one unit. **ACID** is the promise: **Atomicity** (all statements commit or none do — a crash midway rolls back), **Consistency** (constraints you declared, such as foreign keys, `CHECK` and `UNIQUE`, hold at commit; note the application's business rules are only protected if you encode them), **Isolation** (concurrent transactions do not see each other's partial work, to a degree defined by the isolation level), and **Durability** (once committed, it survives a crash, via the write-ahead log). Isolation is the one with the fine print, and it is where most real bugs live.",
      "PostgreSQL uses **MVCC** (multi-version concurrency control): an update writes a new row version rather than overwriting in place, and each statement or transaction reads from a **snapshot** of committed data. The upshot is that readers do not block writers and writers do not block readers. Writers do block writers on the **same row**: if transaction A has updated a row and not committed, transaction B's `UPDATE` of that row waits until A commits or rolls back.",
      "**Read Committed** is PostgreSQL's default. Each *statement* sees a fresh snapshot of data committed before that statement began. So two `SELECT`s in the same transaction can return different results if someone committed in between. When an `UPDATE` waits for another transaction's lock on a row and that transaction commits, Postgres re-checks the `WHERE` clause against the newly committed version and applies the update to it. That makes `UPDATE slots SET seats_left = seats_left - 1 WHERE id = 1` safe under concurrency, but it does nothing for application code that reads a value, computes in PHP or Node, and writes the result back.",
      "That last pattern produces a **lost update**: A reads `seats_left = 5`, B reads `5`, A writes `4`, B writes `4`. Two bookings, one decrement — one update is silently lost. Ways to prevent it: make the change atomic in SQL (`seats_left = seats_left - 1`, ideally with `CHECK (seats_left >= 0)`); lock the row when reading with `SELECT … FOR UPDATE` so B's read waits for A's commit (**pessimistic locking**); or detect the conflict at write time with a version column (**optimistic locking**); or run at **Repeatable Read**, where B's update of a row changed since B's snapshot fails with `could not serialize access due to concurrent update` (SQLSTATE `40001`) and must be retried.",
      "**Repeatable Read** in PostgreSQL gives each *transaction* one snapshot taken at its first statement, so repeated reads are stable (it is actually snapshot isolation, which is stronger than the SQL standard requires for this level, and it also prevents phantom reads in Postgres). But it still permits **write skew**: two transactions read an overlapping set of rows, each makes a decision based on what it read, and each writes a *different* row. The classic booking example: both check 'are there any bookings for table 7 from 19:00 to 21:00?', both see none, both insert their own booking. No row was updated by both, so there is no write-write conflict to detect — and the table is double-booked.",
      "**Serializable** in PostgreSQL uses Serializable Snapshot Isolation (SSI): it tracks read/write dependencies between concurrent transactions and aborts one of them with a serialization failure (`40001`) if the outcome could not have happened in some serial order. That catches write skew, including the double-booking above. The contract is that **your application must retry** failed transactions, and you should keep serializable transactions short. It is a powerful, low-effort correctness tool, but it adds abort-and-retry paths and some overhead, so many teams use it selectively.",
      "**Pessimistic locking** with `SELECT … FOR UPDATE` takes row locks on the rows you read; other transactions trying to lock or update them wait until you commit. It is simple and correct when contention is real (a popular slot at 9 a.m. Saturday), at the cost of waiting, potential deadlocks if you lock rows in inconsistent orders, and holding locks across slow work. Crucially, **you cannot lock rows that do not exist yet**, so for 'check no overlapping booking, then insert' you lock a *parent* row — the table or resource being booked (`SELECT … FROM tables WHERE id = 7 FOR UPDATE`) — to serialise all bookings for that resource. Variants: `NOWAIT` (fail immediately instead of waiting) and `SKIP LOCKED` (useful for job queues, week 10).",
      "**Optimistic locking** assumes conflicts are rare: add a `version integer` column, read it with the row, and write with `UPDATE … SET …, version = version + 1 WHERE id = :id AND version = :expected`. If the affected row count is 0, someone else changed it first — reload and retry, or show 'this booking was changed by someone else'. No locks are held between read and write, which suits user-facing edit flows where minutes pass between loading a form and saving it (a staff member editing a booking in a SaaS dashboard). It maps cleanly onto HTTP with `ETag`/`If-Match` (week 8).",
      "The strongest defence is to make the invariant a **database constraint**, so it holds no matter which code path, script or future teammate writes the data. For exact-slot booking, a `UNIQUE (slot_id)` (or a partial unique index `WHERE status <> 'cancelled'`) makes the second insert fail. For time ranges, PostgreSQL **exclusion constraints** do it directly: `EXCLUDE USING gist (table_id WITH =, during WITH &&)` rejects any two rows for the same table whose `tstzrange` periods overlap (the `btree_gist` extension lets the integer equality participate in the GiST index). Then the application's job is to catch the constraint violation (SQLSTATE `23P01` for exclusion, `23505` for unique) and turn it into a clean 'slot no longer available' response. A good production design usually combines a constraint as the safety net with a lock or optimistic check for a good user experience.",
    ],
    examples: [
      {
        language: 'sql',
        title: 'Lost update: two psql sessions under Read Committed',
        code: `-- Session A                                  -- Session B
BEGIN;
SELECT seats_left FROM slots WHERE id = 1;    -- 5
                                               BEGIN;
                                               SELECT seats_left FROM slots WHERE id = 1; -- 5
UPDATE slots SET seats_left = 4 WHERE id = 1; -- app computed 5 - 1
COMMIT;
                                               UPDATE slots SET seats_left = 4 WHERE id = 1; -- also 5 - 1
                                               COMMIT;
-- Two bookings were taken, seats_left = 4. One decrement was lost.

-- Fix 1 (atomic): UPDATE slots SET seats_left = seats_left - 1
--                 WHERE id = 1 AND seats_left > 0 RETURNING seats_left;
-- Fix 2 (pessimistic): SELECT seats_left FROM slots WHERE id = 1 FOR UPDATE;
--   -> Session B's SELECT ... FOR UPDATE blocks until A commits, then reads 4.
-- Fix 3 (REPEATABLE READ): B's UPDATE fails with
--   ERROR: could not serialize access due to concurrent update  (retry)`,
      },
      {
        language: 'sql',
        title: 'Making double-booking impossible with an exclusion constraint',
        code: `CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE cafe_tables (
  id      serial PRIMARY KEY,
  cafe_id int  NOT NULL,
  label   text NOT NULL
);

CREATE TABLE reservations (
  id        bigserial PRIMARY KEY,
  table_id  int NOT NULL REFERENCES cafe_tables(id),
  user_id   int NOT NULL,
  during    tstzrange NOT NULL,
  status    text NOT NULL DEFAULT 'confirmed'
            CHECK (status IN ('confirmed', 'cancelled')),
  version   int NOT NULL DEFAULT 1,
  EXCLUDE USING gist (table_id WITH =, during WITH &&)
    WHERE (status <> 'cancelled')
);

-- Ranges are half-open '[)': 19:00-21:00 and 21:00-23:00 do NOT overlap.
INSERT INTO reservations (table_id, user_id, during)
VALUES (7, 1, tstzrange('2026-10-17 19:00+00', '2026-10-17 21:00+00', '[)'));

INSERT INTO reservations (table_id, user_id, during)
VALUES (7, 2, tstzrange('2026-10-17 20:00+00', '2026-10-17 22:00+00', '[)'));
-- ERROR: conflicting key value violates exclusion constraint ...  (SQLSTATE 23P01)`,
      },
      {
        language: 'php',
        title: 'Optimistic locking with PDO (version column)',
        code: `<?php
final class ConcurrentModification extends RuntimeException {}

function rescheduleReservation(PDO $pdo, int $id, int $expectedVersion,
                               string $start, string $end): void
{
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare(
        "UPDATE reservations
            SET during = tstzrange(:start, :end, '[)'),
                version = version + 1
          WHERE id = :id AND version = :version AND status = 'confirmed'"
    );

    try {
        $stmt->execute([
            ':start' => $start, ':end' => $end,
            ':id' => $id, ':version' => $expectedVersion,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23P01') {          // exclusion violation
            throw new DomainException('That time overlaps another booking.');
        }
        throw $e;
    }

    if ($stmt->rowCount() === 0) {
        // Someone else changed (or cancelled) it since we read version N.
        throw new ConcurrentModification('Reservation changed; reload and retry.');
    }
}`,
      },
      {
        language: 'php',
        title: 'Pessimistic locking with PDO: lock the parent resource, then check and insert',
        code: `<?php
function bookTable(PDO $pdo, int $tableId, int $userId, string $start, string $end): int
{
    $pdo->beginTransaction();
    try {
        // Serialise all bookings for this table; rows that do not exist yet
        // cannot be locked, so we lock the parent row instead.
        $pdo->prepare('SELECT id FROM cafe_tables WHERE id = ? FOR UPDATE')
            ->execute([$tableId]);

        $check = $pdo->prepare(
            "SELECT 1 FROM reservations
              WHERE table_id = ? AND status <> 'cancelled'
                AND during && tstzrange(?, ?, '[)') LIMIT 1"
        );
        $check->execute([$tableId, $start, $end]);
        if ($check->fetchColumn()) {
            $pdo->rollBack();
            throw new DomainException('Slot no longer available.');
        }

        $ins = $pdo->prepare(
            "INSERT INTO reservations (table_id, user_id, during)
             VALUES (?, ?, tstzrange(?, ?, '[)')) RETURNING id"
        );
        $ins->execute([$tableId, $userId, $start, $end]);
        $id = (int) $ins->fetchColumn();
        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        throw $e;
    }
}`,
      },
    ],
    keyTakeaways: [
      'PostgreSQL defaults to Read Committed: each statement sees a fresh snapshot, so read-compute-write in app code can lose updates.',
      'Repeatable Read gives a per-transaction snapshot and rejects concurrent updates to the same row, but still allows write skew.',
      'Serializable (SSI) prevents write skew by aborting one transaction with 40001; the application must retry.',
      'FOR UPDATE is pessimistic: it waits for row locks; lock a parent row when the rows you care about do not exist yet.',
      'Optimistic locking uses a version column and checks the affected row count; ideal for long user edit flows.',
      'Encode invariants as UNIQUE or EXCLUDE constraints so double-booking is impossible regardless of code path.',
    ],
    prerequisites: [
      'Comfortable writing SQL (SELECT, INSERT, UPDATE, basic DDL)',
      'Docker installed, or a local PostgreSQL 14+',
      'Basic PHP with PDO (for the snippet step)',
    ],
    prerequisiteWeeks: [1],
    resources: [
      {
        title: 'PostgreSQL docs: Transaction Isolation',
        url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
        kind: 'docs',
        note: 'Read the whole page, especially the table of phenomena per level and the Read Committed section on how UPDATE re-checks rows. The serializable section includes a write-skew style example.',
        minutes: 15,
      },
      {
        title: 'PostgreSQL docs: Explicit Locking',
        url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
        kind: 'docs',
        note: 'Read the row-level locks section (FOR UPDATE, FOR NO KEY UPDATE, FOR SHARE) and the short deadlocks section. Skim the table-level lock modes.',
        minutes: 8,
      },
      {
        title: 'PostgreSQL docs: Constraints (exclusion constraints)',
        url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
        kind: 'docs',
        note: 'Read the Exclusion Constraints subsection, then glance at the range types page for tstzrange and the && operator.',
        minutes: 5,
      },
      {
        title: 'PHP manual: PDO transactions and auto-commit',
        url: 'https://www.php.net/manual/en/pdo.transactions.php',
        kind: 'docs',
        note: 'Short page on beginTransaction/commit/rollBack semantics; useful before the PDO step.',
        minutes: 5,
      },
      {
        title: 'Designing Data-Intensive Applications (Martin Kleppmann)',
        url: 'https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/',
        kind: 'book',
        note: 'Read the chapter on transactions, focusing on the weak isolation levels section (lost updates, write skew and phantoms) — the meeting-room booking example is directly relevant. Use for an intensive week.',
        minutes: 30,
        verify: true,
      },
    ],
    exercise: {
      title: 'Reproduce and fix a lost update and a double-booking with two psql sessions',
      scenario:
        'NearBrew partner cafés can take table reservations, and a sister product sells limited seats for latte-art workshops. Support has two tickets: a workshop with 12 seats sold 13 tickets, and two users were both confirmed for table 7 on Saturday evening. You will reproduce both bugs deterministically with two interactive sessions, then fix them with pessimistic locking, optimistic locking, and constraints.',
      setup: [
        'Start Postgres: `docker run --name pg-tx -e POSTGRES_PASSWORD=pg -p 5432:5432 -d postgres:16`.',
        'Open two terminals and in each run `docker exec -it pg-tx psql -U postgres`. Label them A and B. In each, run `\\set PROMPT1 \'A=# \'` (or `B=# `) so you never mix them up.',
        'Run the schema script below in either session.',
      ],
      steps: [
        'Lost update (Read Committed): in A, `BEGIN; SELECT seats_left FROM workshops WHERE id = 1;`. In B, do the same. In A, `UPDATE workshops SET seats_left = <value-1> WHERE id = 1; COMMIT;`. In B, run the same literal update and `COMMIT`. Confirm one decrement was lost.',
        'Fix 1, atomic update: repeat with `UPDATE workshops SET seats_left = seats_left - 1 WHERE id = 1 AND seats_left > 0 RETURNING seats_left;` in both sessions, interleaved. Observe B waits for A, then decrements the committed value. Try it at 1 seat left and see that B updates 0 rows.',
        'Fix 2, pessimistic: repeat the read-compute-write flow but read with `SELECT … FOR UPDATE`. Observe B’s SELECT block until A commits, then return the new value.',
        'Repeatable Read: repeat the original lost-update flow with `BEGIN ISOLATION LEVEL REPEATABLE READ;` in both. Observe B’s update fail with `could not serialize access due to concurrent update`; note the transaction must now be rolled back and retried.',
        "Double-booking via write skew: drop the exclusion constraint for now (`ALTER TABLE reservations DROP CONSTRAINT no_overlap;`). In A and B, `BEGIN ISOLATION LEVEL REPEATABLE READ;`, then in both run the overlap check query for table 7, 19:00–21:00. Both see zero rows. Insert a booking from each (A: 19:00–21:00, B: 20:00–22:00) and commit both. Confirm the table is double-booked even under Repeatable Read.",
        'Fix with Serializable: delete the rows and repeat with `BEGIN ISOLATION LEVEL SERIALIZABLE;`. One of the commits (or inserts) fails with a serialization failure (SQLSTATE 40001). Write down which one and why.',
        'Fix with a parent-row lock: back on Read Committed, repeat the check-then-insert flow but first run `SELECT id FROM cafe_tables WHERE id = 7 FOR UPDATE;` in each session. Observe B blocks, then its overlap check sees A’s committed booking.',
        'Fix with a constraint: re-add the exclusion constraint (`ALTER TABLE reservations ADD CONSTRAINT no_overlap EXCLUDE USING gist (table_id WITH =, during WITH &&) WHERE (status <> \'cancelled\');`) and try the naive concurrent inserts again. B’s insert blocks until A commits, then fails with SQLSTATE 23P01. Also check that a cancelled booking does not block a new one.',
        'Optimistic locking: write the PHP script from the starter (or port it to Node with `pg`). Run it twice in parallel against the same reservation and confirm exactly one reschedule succeeds and the other reports a concurrent modification.',
        'Write a short decision table (in a comment or notes file): for workshop seats, table bookings and the staff dashboard edit form, which mechanism you would use and why.',
      ],
      starter: [
        {
          language: 'sql',
          title: 'schema.sql',
          code: `CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP TABLE IF EXISTS reservations, cafe_tables, workshops;

CREATE TABLE workshops (
  id         serial PRIMARY KEY,
  title      text NOT NULL,
  seats_left int  NOT NULL CHECK (seats_left >= 0)
);
INSERT INTO workshops (title, seats_left) VALUES ('Latte art basics', 5);

CREATE TABLE cafe_tables (
  id      serial PRIMARY KEY,
  cafe_id int  NOT NULL,
  label   text NOT NULL
);
INSERT INTO cafe_tables (cafe_id, label)
SELECT 1, 'Table ' || g FROM generate_series(1, 10) g;

CREATE TABLE reservations (
  id       bigserial PRIMARY KEY,
  table_id int NOT NULL REFERENCES cafe_tables(id),
  user_id  int NOT NULL,
  during   tstzrange NOT NULL,
  status   text NOT NULL DEFAULT 'confirmed'
           CHECK (status IN ('confirmed', 'cancelled')),
  version  int NOT NULL DEFAULT 1,
  CONSTRAINT no_overlap EXCLUDE USING gist (table_id WITH =, during WITH &&)
    WHERE (status <> 'cancelled')
);

-- Overlap check used in the write-skew step:
-- SELECT id FROM reservations
--  WHERE table_id = 7 AND status <> 'cancelled'
--    AND during && tstzrange('2026-10-17 19:00+00', '2026-10-17 21:00+00', '[)');`,
        },
        {
          language: 'php',
          title: 'optimistic.php (run: php optimistic.php <reservationId> <label>)',
          code: `<?php
// Requires the pdo_pgsql extension. Run two copies at once:
//   php optimistic.php 1 first & php optimistic.php 1 second & wait
$pdo = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=postgres', 'postgres', 'pg', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

[$_, $id, $label] = $argv + [null, '1', 'run'];

// 1. Read the row and its version (no lock held).
$row = $pdo->prepare('SELECT version FROM reservations WHERE id = ?');
$row->execute([$id]);
$version = (int) $row->fetchColumn();
echo "$label read version $version\\n";

sleep(1); // simulate the user thinking / a slow request

// 2. Write only if nobody changed it in the meantime.
$upd = $pdo->prepare(
    "UPDATE reservations
        SET during = tstzrange(lower(during) + interval '30 minutes',
                               upper(during) + interval '30 minutes', '[)'),
            version = version + 1
      WHERE id = ? AND version = ?"
);
$upd->execute([$id, $version]);

echo $upd->rowCount() === 1
    ? "$label: rescheduled (now version " . ($version + 1) . ")\\n"
    : "$label: CONFLICT - reservation changed by someone else, reload and retry\\n";`,
        },
      ],
      expected: [
        'Read Committed read-compute-write ends with seats_left decremented once for two bookings.',
        'The atomic update and FOR UPDATE versions decrement correctly; in the FOR UPDATE version session B visibly hangs until A commits.',
        'Repeatable Read raises `could not serialize access due to concurrent update` on the second updater.',
        'Under Repeatable Read without the constraint, two overlapping reservations for table 7 both commit; under Serializable one transaction fails with SQLSTATE 40001.',
        'With the exclusion constraint, the second overlapping insert fails with SQLSTATE 23P01 regardless of isolation level.',
        'Two parallel optimistic.php runs: exactly one prints rescheduled, the other prints CONFLICT.',
      ],
      hints: [
        'If B never blocks, check that A has not already committed; locks are held only until the end of the transaction.',
        'After any error inside a transaction, psql shows `current transaction is aborted`; run `ROLLBACK;` before continuing.',
        'Under Serializable, which transaction fails can depend on timing; the guarantee is that both cannot succeed.',
        'If `CREATE EXTENSION btree_gist` fails, make sure you are using the official postgres image, which ships the contrib extensions.',
      ],
      verification: [
        '`SELECT table_id, during FROM reservations WHERE status <> \'cancelled\' ORDER BY table_id, during;` shows no overlaps after the constraint step.',
        'You have notes showing, for each step, which session blocked or errored and the exact error message.',
        'You can state which isolation level prevents lost updates but not write skew in PostgreSQL (Repeatable Read).',
        'Your decision table names a mechanism for each of the three scenarios with a one-line reason.',
      ],
    },
    successChecklist: [
      'Reproduced a lost update under Read Committed with two sessions',
      'Fixed it three ways: atomic UPDATE, SELECT FOR UPDATE, and Repeatable Read with a retry',
      'Reproduced write-skew double-booking under Repeatable Read and saw Serializable reject it',
      'Prevented double-booking with an exclusion constraint and saw SQLSTATE 23P01',
      'Ran the PDO optimistic-locking script concurrently and observed exactly one success',
      'Wrote a decision table matching mechanisms to booking scenarios',
    ],
    questions: [
      {
        question:
          'Why does `UPDATE slots SET seats_left = seats_left - 1 WHERE id = 1` not lose updates under Read Committed, while reading the value in PHP and writing `seats_left = 4` does?',
        answer:
          'The first form computes the new value inside the database, against the row version the UPDATE actually locks. If another transaction updated the row and committed, the waiting UPDATE re-evaluates against the newly committed version, so it decrements 4 to 3 rather than 5 to 4. The second form computes the value in application code from a snapshot that may already be stale by the time the write happens; the database just overwrites the row with a constant, and nothing tells it that the constant was derived from an old read. Read Committed only guarantees you never see uncommitted data, not that what you read is still current. Fixes for the second form are locking the row on read (FOR UPDATE), an optimistic version check, or Repeatable Read with retries.',
      },
      {
        question: 'What is write skew, and why does Repeatable Read in PostgreSQL not prevent it?',
        answer:
          'Write skew is an anomaly where two concurrent transactions read an overlapping set of data, each makes a decision based on what it read, and each writes a different row, so that the combined result violates an invariant neither would violate alone. Double-booking is the classic case: both check that no reservation overlaps 19:00–21:00 for table 7, both see none, and both insert their own row. PostgreSQL Repeatable Read is snapshot isolation: it detects conflicts only when two transactions write the same row, and here they wrote different, new rows, so there is no conflict to detect. Serializable isolation tracks the read dependencies and aborts one transaction; alternatively you can materialise the conflict by locking a shared parent row, or encode the rule as an exclusion constraint.',
      },
      {
        question:
          'When would you choose optimistic locking over SELECT ... FOR UPDATE, and what does each cost?',
        answer:
          'Optimistic locking fits cases where conflicts are rare and the time between read and write is long or spans requests, such as a staff member loading a booking edit form and saving it minutes later; holding a database lock across that time would be impossible or harmful. Its cost is that conflicts are discovered late, so the application needs a retry or a user-facing conflict message, and under high contention many attempts fail and waste work. FOR UPDATE fits short, server-side transactions on hot rows where contention is expected, like decrementing seats for a popular workshop; it makes the second transaction wait rather than fail. Its costs are blocking, lock queues under load, deadlock risk when rows are locked in inconsistent orders, and it cannot lock rows that do not exist yet. Either way, a database constraint should still back up the invariant.',
      },
    ],
    explainPrompt:
      'Explain to a mid-level teammate in a design review how two users ended up confirmed for the same café table, and how you would make it impossible. Cover what Read Committed and Repeatable Read do and do not guarantee, write skew, and the role of locks versus constraints.',
    rubric: [
      'Correctly describes the race as a check-then-insert (write skew) rather than a simple overwrite',
      'States accurately what Read Committed, Repeatable Read and Serializable guarantee in PostgreSQL',
      'Explains why FOR UPDATE must lock a parent row in the insert case',
      'Recommends a database constraint (exclusion or unique) as the safety net and explains error handling',
      'Discusses retries for serialization failures and the trade-off between waiting and failing',
    ],
    referenceExplanation:
      "Our booking endpoint does check-then-insert: query for any reservation overlapping 19:00–21:00 on table 7, and if none, insert one. Two requests arrived together, both ran the check before either inserted, both saw an empty result, and both inserted. Neither transaction overwrote the other's row, so this isn't a lost update — it's write skew.\n\nPostgres defaults to Read Committed, where each statement sees data committed before it started; nothing stops two transactions from reading the same 'nothing here' state. Repeatable Read doesn't help either: it gives each transaction a stable snapshot and rejects concurrent updates to the same row, but our two transactions wrote different, brand-new rows, so there's no conflict for it to detect. Serializable would catch it — Postgres tracks the read dependencies and aborts one transaction with a 40001 error — but then we need retry logic everywhere.\n\nA lock can fix it if we lock the right thing. We can't `FOR UPDATE` a reservation that doesn't exist yet, so we'd lock the `cafe_tables` row first; that serialises bookings per table and the second request's check then sees the first booking.\n\nThe fix I'd insist on is making it impossible in the schema: an exclusion constraint on `(table_id WITH =, during WITH &&)` for non-cancelled reservations. Any code path — API, admin script, future feature — that tries to create an overlap gets a 23P01 error, which we map to a 409 'slot no longer available'. I'd keep the parent-row lock or a pre-check for a nicer user experience, but the constraint is the guarantee. For staff editing an existing booking in the dashboard, I'd add a version column and optimistic checks, since holding locks across a form edit isn't viable.",
    stretch: {
      title: 'Retry wrapper and contention benchmark',
      description:
        'Write a Node (`pg`) or PHP helper `withSerializableRetry(fn, { maxAttempts, baseDelayMs })` that runs a transaction at SERIALIZABLE and retries on SQLSTATE 40001 with jittered backoff. Then benchmark 50 concurrent booking attempts for the same table using (a) FOR UPDATE on the parent row, (b) Serializable with retries, and (c) naive inserts relying only on the exclusion constraint. Compare throughput, p95 latency and number of retries, and write up when each wins.',
    },
    lightTask:
      'In 30 minutes: start Postgres in Docker, create the `workshops` table, and reproduce the lost update with two psql sessions under Read Committed. Then repeat it using `SELECT … FOR UPDATE` and observe session B blocking until A commits. Write two sentences explaining why the first version lost an update.',
    intensiveExtras: [
      'Create a deadlock deliberately: two sessions each lock table 3 then table 5 in opposite orders. Read the error Postgres reports and write down the rule that avoids it (consistent lock ordering).',
      'Implement the same booking endpoint in a tiny PHP (`php -S`) or Node server using each strategy and hammer it with `xargs -P 20 curl …` to show double-booking without protection.',
      'Add a partial unique index for exact-slot bookings (`CREATE UNIQUE INDEX … ON reservations (slot_id) WHERE status = \'confirmed\'`) on a slot-based variant of the schema and compare it with the range exclusion approach.',
      'Use `SELECT … FOR UPDATE NOWAIT` in session B and design how the API should respond when a lock is not immediately available.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['databases', 'backend-services', 'production-reliability'],
    depth: 'detailed',
  },

  // ---------------------------------------------------------------------------
  // Week 8 — HTTP and networking
  // ---------------------------------------------------------------------------
  {
    week: 8,
    slug: 'http-networking-fundamentals',
    title: 'HTTP and networking fundamentals: DNS, TCP, TLS, HTTP/1.1 vs 2 vs 3, caching headers',
    track: 'cs',
    secondaryTracks: ['backend', 'frontend'],
    topics: [
      'DNS',
      'TCP handshake',
      'TLS 1.3',
      'round trips',
      'HTTP/1.1 keep-alive',
      'HTTP/2 multiplexing',
      'HTTP/3 and QUIC',
      'head-of-line blocking',
      'Cache-Control',
      'ETag and 304',
      'CORS',
      'curl and dig',
    ],
    objective:
      'By the end you can narrate what happens between typing a URL and receiving the first byte, read a curl or DevTools timing breakdown and say which phase is slow, explain what HTTP/2 and HTTP/3 change, and implement and test ETag-based conditional requests and correct Cache-Control headers.',
    whyItMatters:
      "Many 'the app is slow' problems are not code at all: they are extra round trips, a DNS lookup on a third-party domain, a connection that is not reused, a CORS preflight on every request, or an asset that is re-downloaded because its caching headers are wrong. On mobile networks, latency (round trips) dominates bandwidth, so knowing how many round trips each step costs is how you reason about real-world performance. Full-stack engineers own both sides of the headers, so this is where frontend and backend meet.",
    explanation: [
      "Typing `https://api.nearbrew.example/cafes?near=…` starts with **DNS**: turning a hostname into an IP address. The browser checks its own cache, then the OS resolver, which asks a recursive resolver (your ISP's, or a public one), which walks root, TLD and authoritative name servers if it has no cached answer. Each answer carries a **TTL** controlling how long it may be cached. A cold lookup can cost tens to hundreds of milliseconds; a warm one is near zero. This is why every extra third-party domain on a page has a cost, and why `<link rel=\"preconnect\">` or `dns-prefetch` exist.",
      "Next is the **TCP handshake**: SYN, SYN-ACK, ACK. It costs **one round trip** (RTT) before any data can be sent. TCP then gives you an ordered, reliable byte stream, retransmitting lost packets. New connections also start slowly (congestion control's 'slow start' gradually increases how much data can be in flight), so a fresh connection is slower than a warmed-up one even after the handshake. The mental model: on a phone with 100 ms RTT, every round trip you add is a tenth of a second the user waits.",
      "Then **TLS** for HTTPS: client and server agree on keys and the server proves its identity with a certificate chain the client validates. **TLS 1.3** needs **one round trip** for a full handshake (TLS 1.2 needed two), and supports session resumption, including optional 0-RTT early data with replay caveats. During the handshake, **ALPN** negotiates which HTTP version will be used, and **SNI** tells the server which hostname you want so it can pick the right certificate. So a cold HTTPS request over TCP is roughly DNS + 1 RTT (TCP) + 1 RTT (TLS 1.3) + 1 RTT (request/response) before the first byte, plus server think time.",
      "**HTTP/1.1** sends text requests and responses. **Keep-alive** (persistent connections, the default in 1.1) lets several requests reuse one connection sequentially, avoiding repeated handshakes. But each connection carries only one request at a time, and a slow response blocks the ones queued behind it (application-level head-of-line blocking). Browsers work around it by opening several parallel connections per origin (commonly about six), which is why old performance advice included domain sharding and sprite sheets.",
      "**HTTP/2** keeps HTTP semantics (methods, status codes, headers) but changes the wire format to binary frames and **multiplexes** many concurrent request/response **streams** over **one** connection, with header compression (HPACK). One connection per origin is now the ideal, sharding becomes counterproductive, and many small requests are cheap. Its remaining weakness is **TCP head-of-line blocking**: TCP delivers bytes in order, so one lost packet stalls every stream on that connection until it is retransmitted, which hurts on lossy mobile networks.",
      "**HTTP/3** runs HTTP over **QUIC**, a transport built on UDP. QUIC integrates TLS 1.3 into its own handshake (so a new connection costs about one round trip in total rather than TCP's plus TLS's), implements streams in the transport so a lost packet only stalls the stream it belongs to, and supports **connection migration** using connection IDs, so a phone switching from Wi-Fi to cellular can keep its connection. Browsers usually discover HTTP/3 support through an `Alt-Svc` response header or DNS HTTPS records and fall back to HTTP/2 if UDP is blocked. You rarely change application code for any of this; you choose infrastructure (CDN, load balancer) that supports it and stop optimising for HTTP/1.1 limits.",
      "**HTTP caching** decides whether a request needs the network at all. `Cache-Control: max-age=N` means the response is **fresh** for N seconds: the browser reuses it without asking. After that it is **stale** and must be **revalidated**. `no-cache` means 'store it but always revalidate before use' (it does not mean 'do not cache'); `no-store` means never store it (use for sensitive responses). `private` restricts storage to the user's browser, `public`/`s-maxage` let shared caches like CDNs store it, `immutable` tells the browser not to revalidate during freshness, and `stale-while-revalidate=N` lets a cache serve a stale copy while refreshing it in the background. The common pattern: fingerprinted static assets (`app.3f9a1c.js`) get `max-age=31536000, immutable`; HTML and API responses get short or zero freshness plus validators.",
      "**Validators** make revalidation cheap. The server sends `ETag: \"abc123\"` (an opaque version identifier, often a content hash) or `Last-Modified`. When revalidating, the browser sends `If-None-Match: \"abc123\"`; if nothing changed, the server replies **`304 Not Modified`** with no body, saving bandwidth (but still costing a round trip). Weak ETags (`W/\"…\"`) signal semantic rather than byte-for-byte equality. The same idea in reverse supports optimistic concurrency on writes: `If-Match: \"abc123\"` on a `PUT`, answered with `412 Precondition Failed` if someone changed the resource — the HTTP twin of the version column from week 7.",
      "**CORS** is a browser rule, not a server security feature. By default, scripts can only read responses from the page's own **origin** (scheme + host + port). A server opts in to cross-origin reads with `Access-Control-Allow-Origin`. 'Simple' requests (GET/POST with limited headers and content types) are sent directly, and the browser hides the response if the header is missing. Others — e.g. JSON `POST` with `Content-Type: application/json`, custom headers like `Authorization`, or `PUT`/`DELETE` — trigger a **preflight** `OPTIONS` request first, answered with `Access-Control-Allow-Methods`/`-Headers` and optionally cached with `Access-Control-Max-Age`. With credentials (cookies), `*` is not allowed: you must echo a specific origin and send `Access-Control-Allow-Credentials: true`. curl ignores CORS entirely, which is why 'it works in curl but not the browser' is the classic CORS symptom.",
    ],
    examples: [
      {
        language: 'bash',
        title: 'Seeing every phase with dig and curl',
        code: `# DNS: which IPs, which TTL, how long did it take?
dig developer.mozilla.org +noall +answer +stats

# Full verbose exchange: TLS version, ALPN-negotiated protocol, headers
curl -sv -o /dev/null https://developer.mozilla.org/ 2>&1 | grep -E '^(\\*|<|>)' | head -40

# Timing breakdown (all values are cumulative seconds since start)
curl -s -o /dev/null https://developer.mozilla.org/ -w '
 dns        %{time_namelookup}
 tcp        %{time_connect}
 tls        %{time_appconnect}
 ttfb       %{time_starttransfer}
 total      %{time_total}
 http       %{http_version}
'

# Connection reuse: two URLs in one invocation; look for "Re-using existing connection"
curl -sv -o /dev/null -o /dev/null https://developer.mozilla.org/ https://developer.mozilla.org/en-US/ 2>&1 | grep -i -E 're-?us|connected to'`,
      },
      {
        language: 'http',
        title: 'Conditional request and 304',
        code: `GET /api/cafes/42 HTTP/1.1
Host: api.nearbrew.example

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, no-cache
ETag: "9f2b7c1e"

{"id":42,"name":"Hollow Bean","rating":4.6}

# ...later, the browser revalidates:
GET /api/cafes/42 HTTP/1.1
Host: api.nearbrew.example
If-None-Match: "9f2b7c1e"

HTTP/1.1 304 Not Modified
Cache-Control: private, no-cache
ETag: "9f2b7c1e"`,
      },
      {
        language: 'http',
        title: 'A CORS preflight for a JSON POST with credentials',
        code: `OPTIONS /api/favourites HTTP/1.1
Origin: https://app.nearbrew.example
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.nearbrew.example
Access-Control-Allow-Methods: GET, POST, DELETE
Access-Control-Allow-Headers: content-type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 600
Vary: Origin`,
      },
    ],
    keyTakeaways: [
      'A cold HTTPS request costs DNS + TCP (1 RTT) + TLS 1.3 (1 RTT) + request (1 RTT); on mobile, round trips dominate.',
      'HTTP/1.1 keep-alive reuses connections but serves one request at a time per connection.',
      'HTTP/2 multiplexes streams on one TCP connection but still suffers TCP head-of-line blocking on packet loss.',
      'HTTP/3 uses QUIC over UDP: combined transport+TLS handshake, per-stream loss recovery, connection migration.',
      'max-age controls freshness; no-cache means revalidate; no-store means never store; immutable for fingerprinted assets.',
      'ETag + If-None-Match gives cheap 304 revalidation; If-Match + 412 gives optimistic concurrency on writes.',
      'CORS is enforced by browsers; non-simple requests preflight, and credentials require an explicit origin.',
    ],
    prerequisites: [
      'Comfortable with REST APIs and status codes (week 3)',
      'Caching concepts: TTL, freshness, invalidation (week 4)',
      'Node.js 18+ installed; curl and dig available (dig is in dnsutils/bind-tools)',
    ],
    prerequisiteWeeks: [3, 4],
    resources: [
      {
        title: 'MDN: HTTP caching',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
        kind: 'docs',
        note: 'Read freshness, validation, and the common caching patterns section (cache busting with fingerprinted assets). MDN has been reorganising its HTTP guides, so this may redirect.',
        minutes: 12,
        verify: true,
      },
      {
        title: 'MDN: Cross-Origin Resource Sharing (CORS)',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
        kind: 'docs',
        note: 'Read simple requests, preflighted requests and requests with credentials. Skip the full header reference.',
        minutes: 10,
        verify: true,
      },
      {
        title: 'High Performance Browser Networking (Ilya Grigorik)',
        url: 'https://hpbn.co/',
        kind: 'book',
        note: 'Free online. Read the chapters on latency and bandwidth and on TCP building blocks for the round-trip mental model, and skim the HTTP/2 chapter. Written before HTTP/3 was standardised, so treat the QUIC parts as background.',
        minutes: 20,
        verify: true,
      },
      {
        title: 'web.dev: Prevent unnecessary network requests with the HTTP Cache',
        url: 'https://web.dev/articles/http-cache',
        kind: 'article',
        note: 'Practical guide to choosing Cache-Control values per resource type; use it to sanity-check your exercise headers.',
        minutes: 8,
        verify: true,
      },
      {
        title: 'Node.js docs: HTTP module',
        url: 'https://nodejs.org/api/http.html',
        kind: 'docs',
        note: 'Reference for http.createServer, request headers (lower-cased) and response.writeHead, used in the exercise.',
        minutes: 5,
      },
    ],
    exercise: {
      title: 'Trace a request end to end, then build a cache-friendly café API',
      scenario:
        "NearBrew's web app feels slow on first load in a new city. Before touching code, you will measure where the time goes using dig, curl and the DevTools waterfall. Then you will build a tiny café-detail API with node:http that serves correct Cache-Control and ETag headers, supports conditional requests, and answers a CORS preflight from the web app's origin.",
      setup: [
        'Install dig if needed (`sudo apt install dnsutils`, or `brew install bind`). Check `curl --version` and note whether it lists HTTP2 and HTTP3 under Features.',
        'Create a folder `http-lab` with `server.mjs` (starter below). Run it with `node server.mjs`; it listens on port 8080.',
      ],
      steps: [
        'DNS: run `dig` for a site you use often and for a cold domain you have never visited. Compare the query time and TTLs. Run it twice and observe caching on the second run (lower time, decreasing TTL).',
        'Timing: run the curl `-w` timing command from the examples against two or three real HTTPS sites. Compute the phases as differences (tcp − dns, tls − tcp, ttfb − tls) and estimate the RTT from the TCP phase.',
        'Protocols: run `curl -sv -o /dev/null --http1.1 <url>` and `--http2` against the same site and find the ALPN line and the protocol in the response. If your curl supports it, try `--http3`. Note which version the site negotiates.',
        'DevTools: open a content-rich site (any café or restaurant listing site works as a NearBrew stand-in) with cache disabled. In the Network panel, add the Protocol and Connection ID columns, then hover a request’s Waterfall to read Queueing, DNS Lookup, Initial connection, SSL, Waiting for server response (TTFB) and Content Download. Find a third-party origin that paid for its own DNS+TCP+TLS.',
        'Reload without "Disable cache" and identify responses served from memory or disk cache versus 304 revalidations. Write down which assets are fingerprinted with long max-age and which are revalidated.',
        'Implement the `TODO`s in `server.mjs`: compute a strong ETag from the JSON body, return 304 with no body when `If-None-Match` matches, and set `Cache-Control: private, no-cache` on café JSON and `public, max-age=31536000, immutable` on the fingerprinted asset route.',
        'Test with curl: request `/cafes/42` with `-i`, copy the ETag, then send `-H "If-None-Match: <etag>"` and confirm a 304 with an empty body. Hit `POST /cafes/42/rating` to change the data, then repeat the conditional request and confirm you get a 200 with a new ETag.',
        'Implement the CORS TODO: answer `OPTIONS` preflights from `http://localhost:5173` only, with allowed methods and headers, `Access-Control-Max-Age`, and `Vary: Origin`. Test with `curl -i -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" localhost:8080/cafes/42/rating`, and again with a different Origin.',
        'Browser check: from a page served on another origin (for example `npx serve -l 5173 .` with a small HTML file that calls `fetch(\'http://localhost:8080/cafes/42\')`), load it twice and observe the second request revalidate with a 304 in DevTools. Change the allowed origin and watch the CORS error appear in the console while curl still works.',
        'Write a five-line summary of where time went in step 4 and two concrete changes (headers, preconnect, fewer origins) you would propose for NearBrew’s web app.',
      ],
      starter: [
        {
          language: 'js',
          title: 'server.mjs',
          code: `import http from 'node:http';
import { createHash } from 'node:crypto';

const cafes = new Map([
  [42, { id: 42, name: 'Hollow Bean', rating: 4.6, ratingCount: 120 }],
  [7, { id: 7, name: 'Kettle & Crumb', rating: 4.2, ratingCount: 58 }],
]);

const ALLOWED_ORIGIN = 'http://localhost:5173';

function etagFor(body) {
  // Strong ETag: quoted, derived from the exact bytes.
  return '"' + createHash('sha1').update(body).digest('base64url').slice(0, 16) + '"';
}

function applyCors(req, res) {
  // TODO: if req.headers.origin === ALLOWED_ORIGIN, set
  //   Access-Control-Allow-Origin to that origin and add Vary: Origin.
  // Return true if the origin is allowed.
  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const match = url.pathname.match(/^\\/cafes\\/(\\d+)(\\/rating)?$/);

  if (req.method === 'OPTIONS') {
    // TODO: preflight. If allowed, respond 204 with
    //   Access-Control-Allow-Methods, Access-Control-Allow-Headers,
    //   Access-Control-Max-Age. Otherwise 403.
    res.writeHead(501).end();
    return;
  }

  applyCors(req, res);

  if (url.pathname === '/assets/app.3f9a1c.js') {
    // TODO: long-lived immutable caching for a fingerprinted asset
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end('console.log("hello from a fingerprinted asset");');
    return;
  }

  if (!match) {
    res.writeHead(404).end();
    return;
  }

  const cafe = cafes.get(Number(match[1]));
  if (!cafe) {
    res.writeHead(404).end();
    return;
  }

  if (req.method === 'POST' && match[2]) {
    cafe.ratingCount += 1;
    cafe.rating = Math.round((cafe.rating * 0.98 + 5 * 0.02) * 100) / 100;
    res.writeHead(204).end();
    return;
  }

  if (req.method === 'GET' && !match[2]) {
    const body = JSON.stringify(cafe);
    const etag = etagFor(body);
    // TODO: if req.headers['if-none-match'] includes etag -> 304, no body,
    //       but still send ETag and Cache-Control.
    res.writeHead(200, {
      'Content-Type': 'application/json',
      // TODO: Cache-Control and ETag headers
    });
    res.end(body);
    return;
  }

  res.writeHead(405, { Allow: 'GET, POST, OPTIONS' }).end();
});

server.listen(8080, () => console.log('http://localhost:8080'));`,
        },
        {
          language: 'bash',
          title: 'curl tests',
          code: `# 1. First request: note the ETag
curl -i localhost:8080/cafes/42

# 2. Conditional request: expect 304 and no body
curl -i -H 'If-None-Match: "PASTE_ETAG_HERE"' localhost:8080/cafes/42

# 3. Change the resource, then repeat step 2: expect 200 and a new ETag
curl -i -X POST localhost:8080/cafes/42/rating

# 4. Preflight from the allowed origin (expect 204 + Allow-* headers)
curl -i -X OPTIONS localhost:8080/cafes/42/rating \\
  -H 'Origin: http://localhost:5173' \\
  -H 'Access-Control-Request-Method: POST' \\
  -H 'Access-Control-Request-Headers: content-type'

# 5. Same preflight from another origin (expect no Allow-Origin / 403)
curl -i -X OPTIONS localhost:8080/cafes/42/rating \\
  -H 'Origin: https://evil.example' \\
  -H 'Access-Control-Request-Method: POST'`,
        },
      ],
      expected: [
        'dig shows a noticeably lower query time on the second lookup, and the TTL counts down between runs.',
        'curl timing shows DNS, TCP and TLS phases of similar magnitude to your RTT; the TCP phase is roughly one RTT and TLS 1.3 roughly one more.',
        'The DevTools waterfall shows at least one third-party origin paying its own DNS, connection and SSL costs, and HTTP/2 or HTTP/3 in the Protocol column for most requests.',
        'Your server returns 200 with an ETag, then 304 with an empty body for a matching If-None-Match, and 200 with a new ETag after a rating POST.',
        'Preflight from localhost:5173 gets 204 with the Allow-* headers; other origins get no Access-Control-Allow-Origin; the browser blocks the read while curl does not.',
      ],
      hints: [
        'Node lower-cases incoming header names: use `req.headers[\'if-none-match\']`.',
        'ETags must include the double quotes. `If-None-Match` can contain a comma-separated list or `*`, so a robust check splits on commas and trims.',
        'A 304 must not include a body, but should repeat headers such as ETag and Cache-Control that would have been sent with the 200.',
        'If the browser does not revalidate, check that DevTools "Disable cache" is off and that you are not using a hard reload.',
      ],
      verification: [
        'All five curl tests behave as described in the expected section.',
        'You can point at a request in DevTools and state its DNS, connection, TLS and TTFB times from the timing tab.',
        'You can explain why `no-cache` on the café JSON still resulted in a 304 rather than a full download.',
        'Your written summary names two concrete improvements backed by something you measured.',
      ],
    },
    successChecklist: [
      'Measured DNS, TCP, TLS and TTFB for real sites with curl -w and estimated the RTT',
      'Identified the negotiated HTTP version via ALPN in curl -v and the DevTools Protocol column',
      'Read a DevTools waterfall and found a request that paid for a new connection to a third-party origin',
      'Built a node:http server with ETag, 304 handling and appropriate Cache-Control per resource type',
      'Implemented and tested a CORS preflight that allows exactly one origin',
      'Wrote a short, evidence-based list of networking improvements for a NearBrew-like site',
    ],
    questions: [
      {
        question:
          'Roughly how many round trips does a brand-new HTTPS request cost over HTTP/2 versus HTTP/3, and why does that matter more on mobile than on office Wi-Fi?',
        answer:
          'Over HTTP/2 a cold request needs a DNS lookup (which may be cached), one round trip for the TCP handshake, one for a TLS 1.3 handshake and one for the request and response itself, so about three round trips plus DNS before the body arrives. HTTP/3 over QUIC folds the transport and TLS handshakes into one, so about two round trips plus DNS, and resumed connections can use 0-RTT for idempotent requests. Mobile networks often have round-trip times of tens to hundreds of milliseconds, so each round trip is a visible delay, while extra bandwidth does not reduce it. On low-latency office networks the same handshakes cost only a few milliseconds each. That is why connection reuse, fewer origins and preconnect hints have outsized impact on mobile.',
      },
      {
        question:
          'What is the difference between `Cache-Control: no-cache`, `no-store` and `max-age=0`, and which would you use for a NearBrew café-detail API response?',
        answer:
          '`no-store` forbids storing the response anywhere, so every use requires a full download; it is for sensitive data like account or payment details. `no-cache` allows storing but requires revalidation with the server before each use, so with an ETag the browser sends If-None-Match and usually gets a cheap 304. `max-age=0` makes the response immediately stale, which in practice also leads to revalidation, though caches may be allowed to serve stale responses in some conditions unless `must-revalidate` is present, so `no-cache` states the intent more clearly. For café details that change occasionally and are per-user only if personalised, `private, no-cache` with an ETag is a good default, or a short `max-age` with `stale-while-revalidate` if slightly stale data is acceptable and you want instant loads. Fingerprinted static assets are the opposite case: long max-age with immutable.',
      },
      {
        question:
          'A developer says "the API works in curl and Postman but the browser says it is blocked by CORS, so the server must be broken." What is actually going on, and how do you fix it?',
        answer:
          'CORS is enforced by browsers, not servers or HTTP clients like curl, so curl working tells you only that the server responds, not that it opts in to cross-origin reads. The browser blocks the page script from reading a cross-origin response unless the response includes a matching `Access-Control-Allow-Origin`, and for non-simple requests such as a JSON POST or one with an Authorization header it first sends an OPTIONS preflight that must succeed with the right Allow-Methods and Allow-Headers. Check the Network panel for the preflight and the console for the specific reason. The fix is server configuration: answer the preflight, return the allowed origin (a specific origin, not `*`, when cookies are involved, plus Allow-Credentials), and add `Vary: Origin` if the value depends on the request. Disabling CORS in the browser or proxying blindly hides the problem rather than fixing it.',
      },
    ],
    explainPrompt:
      'Explain to an interviewer what happens between typing a NearBrew URL into a browser and seeing the café page, focusing on networking: DNS, TCP, TLS, the HTTP version, caching and revalidation. Point out where you would look first if first load is slow on mobile.',
    rubric: [
      'Walks through DNS, TCP, TLS and the HTTP exchange in the right order with approximate round-trip costs',
      'Explains what HTTP/2 multiplexing and HTTP/3/QUIC improve, including head-of-line blocking',
      'Describes freshness vs revalidation and the role of ETag/304 accurately',
      'Mentions CORS preflights as a possible extra round trip for API calls',
      'Proposes measurement-first debugging (DevTools waterfall, curl timing) and concrete fixes',
    ],
    referenceExplanation:
      "First the browser resolves the hostname. It checks its own cache and the OS, and if nothing is cached a recursive resolver walks the DNS hierarchy; the answer comes back with a TTL. Then it opens a TCP connection, a SYN/SYN-ACK/ACK exchange costing one round trip, and does a TLS 1.3 handshake, another round trip, during which the certificate is verified and ALPN picks HTTP/2 or HTTP/1.1. Only then can it send the GET and wait for the first byte. On a phone with a 100 ms round trip, that's around 300 ms before the server even starts responding.\n\nWith HTTP/2, the HTML, CSS, JS and API calls to the same origin share that one connection as multiplexed streams, so there's no queueing behind slow responses. The catch is that TCP delivers bytes in order, so a lost packet stalls every stream. HTTP/3 runs over QUIC on UDP, combines the transport and TLS handshakes, recovers loss per stream, and survives a switch from Wi-Fi to cellular.\n\nCaching decides what never hits the network. Fingerprinted bundles get a long `max-age` with `immutable`, so repeat visits load them from disk. HTML and café JSON use `no-cache` with an ETag: the browser revalidates with If-None-Match and usually gets a bodiless 304. That still costs a round trip but saves the download. If the API is on a different origin, a JSON POST also triggers a CORS preflight, which is an extra round trip unless `Access-Control-Max-Age` caches it.\n\nIf first load is slow on mobile, I'd start with the DevTools waterfall under network throttling. I'd count the origins that each pay for DNS, TCP and TLS, check that connections are reused and HTTP/2 or 3 is negotiated, look for render-blocking assets without long-lived caching,, and look for preflights, then fix the biggest measured cost first.",
    stretch: {
      title: 'Serve the same API over HTTP/2 and compare',
      description:
        'Use `node:http2` with a self-signed certificate (`openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 7 -subj "/CN=localhost"`) to serve a page that loads 100 small café thumbnails. Compare the DevTools waterfall against the HTTP/1.1 version of the same server (`node:https`): count connections, observe queueing, and add 2% packet loss with your OS network-link conditioner or `tc netem` on Linux to see TCP head-of-line blocking. Write up what you observed and what HTTP/3 would change.',
    },
    lightTask:
      'In 30 minutes: build only the ETag part of the server (GET /cafes/42 returning JSON with an ETag and `Cache-Control: private, no-cache`, and a 304 when If-None-Match matches), then prove it with two curl commands. Finish by running the curl `-w` timing command against one real HTTPS site and labelling which phase is DNS, TCP, TLS and TTFB.',
    intensiveExtras: [
      'Add `Last-Modified` and `If-Modified-Since` support alongside ETag and explain when each is better (second-level timestamp granularity, multiple servers generating different ETags).',
      'Implement `If-Match` on a `PUT /cafes/:id` route that returns 412 Precondition Failed on a stale ETag, linking it to last week’s optimistic locking.',
      'Use `dig +trace` on a domain to watch the full root -> TLD -> authoritative resolution path, and explain the TTLs at each level.',
      'Audit the caching headers of a real site you have shipped: list every response type, its current Cache-Control, and what you would change.',
    ],
    minutes: { learn: 30, practice: 60, explain: 30 },
    competencies: ['cs-fundamentals', 'api-design', 'rendering-performance', 'backend-services'],
    depth: 'detailed',
  },
];
