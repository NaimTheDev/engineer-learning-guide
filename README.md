# EngineerOS

A calm, structured weekly learning system for growing into a stronger senior full-stack engineer, with a 52-week curriculum aimed at Netflix-style **L4 full-stack** and **L5 product UI** roles.

The app answers three questions as soon as you open it:

1. **What am I learning this week?** The current lesson, its track, and its objective.
2. **What exactly do I do next?** One **Continue learning** button that opens the next unfinished step.
3. **How much progress have I made?** Weekly progress, overall curriculum progress, and topics covered.

You never have to decide what to study next. Lessons advance **when you finish them, not by calendar date**, so missed weeks never put you behind.

---

## What's inside

| Area | What it does |
| --- | --- |
| **Today** (dashboard) | Current week and lesson, time remaining, weekly progress, overall progress, a gentle rhythm indicator, the next lesson, and anything else in progress. |
| **Lessons** | Three steps per lesson: **Learn** (30 min: explanation, examples, vetted resources), **Practice** (60 min: hands-on exercise with starter code, hints, verification, success checklist, notes), and **Explain** (30 min: write it in your own words, then compare against a reference explanation and self-assessment criteria). Comprehension questions have answers you can reveal. |
| **Curriculum** | All 52 weeks grouped by quarter. Full-text search, filters by track and status, and track summaries. Filters live in the URL, so you can bookmark them. |
| **Netflix readiness** | Two target profiles (full-stack product engineer; senior product UI engineer). Each competency shows its signals, the lessons that build it, a four-level self-assessment, reflection notes, and an evidence log. **It is not an official rubric or score.** |
| **Settings** | Weekly commitment (30 min light, 2 h standard, 4 h intensive), theme, JSON export/import, and reset with confirmation. |

### Curriculum shape

Six tracks: **A** Frontend & JavaScript · **B** Backend · **C** Computer Science · **D** System Design · **E** Senior Engineering · **F** Interview Prep.

| Quarter | Weeks | Focus |
| --- | --- | --- |
| Q1 Foundations | 1–13 | Postgres indexes & EXPLAIN, React rendering, REST & pagination, caching, event loop, TypeScript modelling, transactions & locking, HTTP, incident investigation, queues, browser rendering, design docs, a checkpoint |
| Q2 Depth | 14–26 | Data structures, client state architecture, SQL optimization, Node internals, accessibility, load balancing, code review, selective algorithms, Java, observability, frontend system design, concurrency, behavioural stories |
| Q3 Systems | 27–39 | Replication & consistency, PHP patterns, memory & leaks, React at scale, TV/10-foot UI, API evolution, ADRs, failure handling & retries, testing strategy, OS basics, booking system design, rate limiting, postmortems |
| Q4 Integration | 40–52 | Partitioning & sharding, event-driven architecture & outbox, UI reliability, web security, media home-screen design, maintainability, algorithms II, notification system design, mentoring, end-to-end performance, a mock loop, a portfolio case study, the year review |

Weeks 1–12 are authored with extra depth. Exercises run locally for free (Docker Postgres, Node, a Vite app, a browser, or paper). Many use **NearBrew**, a café-discovery app, plus booking-platform and multi-tenant SaaS scenarios.

### Weekly modes

- **Standard (2 h)**: the full lesson. This is the default, and the path that is always complete.
- **Light (30 min)**: one minimum-viable task per lesson. The lesson stays open so you can finish it later.
- **Intensive (4 h)**: the standard lesson plus optional extra practice. You get more repetitions, not a harder core.

---

## Getting started

Requirements: **Node.js 20+** (CI uses 22) and npm.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check, then produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (TypeScript, React Hooks) |
| `npm test` | Vitest + React Testing Library, run once |
| `npm run test:watch` | Tests in watch mode |
| `npm run check` | Type check, lint, and tests together |
| `npm run check:links` | Check every curriculum resource URL (needs network access) |

### Tests

The tests in `src/test/` cover:

- **Progress logic**: lesson completion and un-completion, checklists, resume behaviour, completion-driven advancement (calendar time never matters), weekly plans for each mode, and the rhythm indicator.
- **Import/export validation**: round-trip, invalid JSON, files from other apps, unsupported versions, malformed fields, defaults, and stored data that won't parse.
- **Curriculum integrity**: 52 sequential weeks, unique slugs, valid tracks and competencies, prerequisites that only point to earlier weeks, three questions per lesson, and HTTPS resources.
- **Integration (RTL)**: the full Learn → Practice → Explain → Complete flow, persistence across reloads, resuming from the dashboard, search, week-mode changes, import confirmation, and the typed-confirmation reset.

---

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml`:

1. Runs on every push to `main`, on pull requests (build and checks only, no deploy), and manually via **Run workflow** (`workflow_dispatch`).
2. Installs dependencies with `npm ci`, then runs **type check → lint → tests → build**. Any failure stops the deploy.
3. Builds with `VITE_BASE=/<repo-name>/` so asset URLs match a project site.
4. Uploads `dist/` with `actions/upload-pages-artifact`.
5. Deploys with the official `actions/deploy-pages` action.

It uses only the built-in `GITHUB_TOKEN`, with `contents: read`, `pages: write`, and `id-token: write`. **No repository secrets are needed.**

### One-time setup

1. Push this repository to GitHub, with the default branch named `main`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push to `main`, or open **Actions → Deploy to GitHub Pages → Run workflow**.
5. When the run finishes, the deploy job shows the live URL.

### Where it will live

```
https://<your-github-username>.github.io/<repository-name>/
```

For this repository that is `https://naimthedev.github.io/engineer-learning-guide/`.

Routes use the hash, for example `…/engineer-learning-guide/#/lesson/postgres-indexes-explain/practice`. GitHub Pages has no server-side rewrites, and hash routing means that refreshing the page or opening a deep link always loads `index.html`, so you never hit a 404.

If you use a custom domain or a `<user>.github.io` user site, set `VITE_BASE: /` in the workflow. Local builds default to the relative base `./`, which works from any path.

---

## Your data, backups, and the localStorage limitation

> **Progress lives only in the browser where you use the app.**

EngineerOS has no server, accounts, or database. Everything you do is saved automatically to that browser's `localStorage`: completed steps, checklists, exercise notes, explanations, settings, and readiness evidence. This has consequences:

- **It does not sync** between devices, between browsers, or between a normal and a private window.
- **Clearing site data** (or some browser cleanup tools) deletes it.
- Data is scoped to the site's origin, so a local dev server and the deployed site keep **separate** progress.

**Back up with Export.** Go to **Settings → Export JSON** to download `engineeros-progress-YYYY-MM-DD.json`. To move to another device, open the deployed site there and use **Settings → Import JSON**. Import validates the file, shows a summary, and asks for confirmation before replacing anything. Export after each lesson, or at least monthly.

Other safeguards:

- If stored data can't be read, it is preserved under a separate `engineeros:progress:v1:unreadable:<timestamp>` key rather than silently overwritten.
- If the browser blocks storage, a banner tells you to export before closing the tab.
- Changes made in another tab are picked up automatically.

**Keep employer data out.** The readiness evidence form reminds you to describe your own actions and outcomes in general terms. Leave out employer names, client names, internal system names, customer data, and anything covered by an NDA.

---

## About the content

- The **readiness profiles** are a personal planning aid written from general, publicly described expectations for senior product engineers. They are **not** an official Netflix rubric, levelling guide, interview description, or score.
- **Resources** link to official documentation (PostgreSQL, React, MDN, TypeScript, Node.js, Java, MIT Missing Semester, the Google SRE book, web.dev, OWASP) and to well-known books and sites.
  - Links marked **"Verify link/edition"** point at books, paid content, or deep links that may move. Check those manually.
  - The URLs were written without live network access. Run `npm run check:links` once from a machine with internet access and fix anything it reports.
- Book references name topics or chapters only where the author was confident. Otherwise they describe the subject ("the chapter on replication") so you can find it in your edition.

### Editing the curriculum

Lessons are typed data in `src/data/curriculum/weeksNN-MM.ts`, and they must satisfy the `Lesson` interface in `src/data/types.ts`. Text fields support a small inline syntax: `` `code` ``, `**bold**`, and `[text](https://url)`. Progress is keyed by lesson `slug`, so **don't rename slugs** after you've started or your progress for that lesson will detach. The curriculum integrity tests catch structural mistakes.

---

## Project structure

```
src/
  data/
    types.ts            Lesson, Track, Competency contracts
    tracks.ts           Six learning tracks
    competencies.ts     Readiness profiles and competencies
    curriculum/         52 lessons as typed data (+ index.ts)
  lib/
    progress.ts         State shape, reducer, selectors (pure, tested)
    backup.ts           Export envelope + import validation (pure, tested)
    curriculum.ts       Lookup, search/filter, navigation helpers
    storage.ts          Failure-tolerant localStorage wrapper
  state/                ProgressContext (persistence) and ThemeContext
  components/
    ui/                 Button, Card, Badge, Progress, CheckItem, CodeBlock, Dialog, …
    layout/AppShell.tsx Sidebar (desktop), top bar + tab bar (mobile)
    lesson/             Learn / Practice / Explain steps and lesson badges
  pages/                Dashboard, Lesson, Curriculum, Readiness, Settings
  test/                 Vitest + RTL tests and fixtures
.github/workflows/deploy.yml
scripts/check-links.mjs
```

The stack is React 18, TypeScript (strict), Vite, Tailwind CSS, Lucide icons, React Router (`HashRouter`), Vitest, and React Testing Library. Runtime dependencies are limited to React, React DOM, React Router, and Lucide.

### Accessibility and responsiveness

- Native form controls, labelled inputs, and visible focus rings.
- Arrow-key segmented controls, and dialogs with a focus trap and Escape to close.
- A skip link, and focus moves to the content on navigation.
- `prefers-reduced-motion` is respected.
- Light and dark themes (system, light, or dark).
- A sidebar layout on desktop; a top bar and bottom tab bar on mobile.
