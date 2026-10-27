# Pipeline board — reverse-engineering notes and DevHub plan

Reference: Rapport demo, `https://demo.codeandchill.store/rapport/#/pipeline`
(analysed 2026-10-27).

> **Licensing.** Rapport is a commercial template: its HTML header reads
> "© 2026 Hasib (OVERSHOOT). All rights reserved. Licensed, not sold." These
> notes record _observed behaviour and interaction design_ only. DevHub must
> not copy Rapport's source, CSS, copy, photos or icons. Everything below is
> implemented from scratch with DevHub's own components and tokens. If you
> hold a Rapport licence, check its terms before reusing any asset.

## 1. How the analysis was done

- Fetched the public HTML and the code-split bundles the page loads
  (`index-*.js` 160 KB, `pipeline-*.js` 32 KB, `index-*.css` 31 KB).
- Read the minified pipeline module for structure, events and accessibility
  attributes.
- Ran REA (`tools/rea`, built from `github.com/morluto/rea`) —
  `analyze-javascript-application` stopped before parsing because REA's macOS
  process-ownership helper failed to compile against this machine's Xcode
  Command Line Tools (duplicate `SwiftBridging` module map). Fix, then re-run:
  `sudo rm /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap`
  (or reinstall the Command Line Tools), followed by
  `node tools/rea/scripts/rea.mjs analyze-javascript-application <dir> --json`.

## 2. What the Rapport pipeline does

**Stack.** Framework-free TypeScript compiled by Vite; views render HTML
strings and are code-split per route (`#/overview`, `#/pipeline`, …). Animation
uses GSAP (`fromTo`, `power3.inOut`, staggered entrances). Hosted on Vercel
with `frame-ancestors 'none'` and `X-Frame-Options: DENY` (cannot be iframed).

**Layout.**

| Region    | Behaviour                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header    | Title plus three stat tiles: open pipeline value, weighted forecast, deals closing this month (count-up animation).                                                     |
| Toolbar   | Search (120 ms debounce, `Esc` clears), owner filter chips (`aria-pressed`), Board/List segmented control, CSV export, primary "New deal".                              |
| Board     | Four stage columns (`section` + `role="list"`), each with a coloured dot, count, total, and per-column "+" button; empty columns show a "Drop a deal here" placeholder. |
| End zones | "Won" and "Lost" drop targets below the columns, with running totals.                                                                                                   |
| Card      | Close-date chip (red when overdue), title, company, amount, avatar stack, "more" menu (`aria-haspopup="menu"`).                                                         |
| List view | Sortable table (deal, customer, stage, amount, close date, owner) with an "Include won & lost" toggle and an empty state.                                               |

**Interaction model.**

- _Pointer drag_ with `setPointerCapture`. Mouse drags start after **5 px** of
  movement; touch uses a **long-press timer** and cancels if the finger moves
  **> 8 px** first (so scrolling still works). The context menu is suppressed
  mid-drag.
- The card is lifted into a fixed-position ghost appended to `<body>`
  (sized from `getBoundingClientRect`).
- **Edge auto-scroll** while dragging: the board scrolls horizontally, a
  column scrolls vertically, the window scrolls within 70 px of the viewport
  edge.
- Drop re-renders the board and runs a **FLIP** animation (cards slide from
  their old to new positions; `clearProps: transform` afterwards).
- `Esc` cancels a drag and returns the card.
- **Keyboard**: cards are focusable `role="listitem"` with
  `aria-keyshortcuts="Enter Shift+ArrowLeft Shift+ArrowRight"` — Shift+Arrows
  move between stages, Enter opens.
- Every move shows a **toast with Undo** and writes a sentence to a polite
  `aria-live` region ("Moved to Proposal", "<deal> back in Qualify").
- Cards are diffed by a signature string so unchanged cards are not
  re-rendered.
- Board/List choice persists in `localStorage`.

## 3. What this becomes in DevHub

The pattern fits DevHub where items **flow through stages that a person
legitimately decides**. It must not be used where a drag would trigger an
operational action without confirmation.

| Board                               | Columns                                                          | End zones                   | Drag allowed?                                                         | Phase |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- | ----- |
| **Issue triage**                    | New · Investigating · Fix in progress · Ready to verify          | Resolved · Ignored          | Yes — needs `issues:triage`                                           | 3     |
| **Connection pipeline** (portfolio) | Registered · SDK installed · Credentials · Test event · Verified | —                           | No — driven by verification checks only                               | 2     |
| **Delivery pipeline**               | Queued · Building · Deploying · Verifying health                 | Live · Failed / Rolled back | No — provider events only; rollback stays a confirmed, audited action | 5     |

### Data changes (Phase 3 migration)

- `issues.triage_stage text not null default 'new'` with a check constraint,
  `issues.assignee_id uuid` (FK to `users`), index
  `(project_id, triage_stage, last_seen_at desc)`.
- Extend the `issues_triage` policy / column grants to
  `update (status, triage_stage, assignee_id)`; dropping on Resolved/Ignored
  sets `status`. Audit triggers already record every change.
- RPC `move_issue(p_issue, p_stage, p_expected_updated_at)` for optimistic
  concurrency: it fails if someone else moved the card first, and the UI
  reverts with a message.

### Front-end implementation

| Concern      | Approach in DevHub                                                                                                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drag & drop  | `@dnd-kit/core` + `@dnd-kit/sortable`: pointer, touch (long-press activation, tolerance 8 px) and keyboard sensors, built-in screen-reader announcements, auto-scroll. Replaces Rapport's hand-written pointer code with an audited, accessible library.             |
| Motion       | `motion` layout animations (FLIP) with `useReducedMotion`; no animation when the user prefers reduced motion.                                                                                                                                                        |
| Writes       | Server Action `moveIssue` → `requirePermission("issues:triage", projectId)` → RPC. React `useOptimistic` for instant feedback; rollback on failure.                                                                                                                  |
| Undo         | Toast with Undo calls the same action with the previous stage (also audited). 6 s window.                                                                                                                                                                            |
| Keyboard     | Focusable cards; Shift+←/→ moves stage; Enter opens issue detail; `Esc` cancels drag.                                                                                                                                                                                |
| Filters      | Search (debounced, server-side `ilike` on title/culprit), environment and assignee chips, URL-encoded so views are shareable.                                                                                                                                        |
| Views        | Board / List toggle; List reuses `@devhub/ui` `Table` with sortable headers; preference stored per user (`localStorage`, try/catch).                                                                                                                                 |
| Live updates | Phase 3 decision: Supabase Realtime (requires browser access to Supabase, so the CSP/runtime-config model changes) **or** server-sent events from `apps/web`. SSE keeps the current "browser talks only to DevHub" model; preferred unless volume requires Realtime. |
| Stats header | Real aggregates only: open issues, new in 24 h, regressions. No forecasts or invented numbers.                                                                                                                                                                       |
| Export       | CSV of the current filter, generated server-side with the same RLS-scoped query.                                                                                                                                                                                     |

### Acceptance criteria

- Moving a card by mouse, touch and keyboard produces the same audited change.
- A viewer sees the board read-only (drag handles hidden, actions disabled).
- Concurrent moves never silently overwrite each other.
- Screen readers announce pick-up, movement and drop.
- 500 issues per project render and scroll smoothly on a mid-range phone.
- Playwright tests cover drag, keyboard move, undo and permission denial.

## 4. If the goal is to _monitor_ the Rapport demo with DevHub

Registering `demo.codeandchill.store/rapport` as a DevHub project is possible
without touching its code for **uptime and response-time checks** (Phase 3).
Error tracking, Web Vitals and release correlation need the browser SDK added
to its source and a redeploy, which requires owning that deployment. Embedding
it in DevHub is not possible (it forbids framing).
