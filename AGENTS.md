# AGENTS.md

Instructions for anyone, human or AI agent, changing code in this repo. Where this file and a general-purpose style guide disagree, this file wins.

## What Beekeeper is, and the promises it keeps

Beekeeper is a local-only, read-only Electron app that reads Claude Code's session files in `~/.claude/projects` and shows what each agent did, changed, and cost. Every change must keep these promises:

- **No network, ever.** No telemetry, no update checks, no remote fonts or assets. The session request allowlist (`src/main/security/`), the CSP, and the lint bans on network APIs enforce this. Never weaken them to make something work.
- **Read-only.** Beekeeper never writes to `~/.claude` or to a user's repositories. Git commands are read-only: every command run in a repository is checked against the allowlist in `src/core/git/gitAllowlist.ts`, and all of them run through `execFile` with argument arrays, never a shell string.
- **Transcripts are untrusted input.** They contain web pages, tool output, and possibly secrets. Render them as plain text. Never use `dangerouslySetInnerHTML`, and never log transcript content.
- **The renderer has no Node access.** All file and git access happens in the main process and reaches the renderer through one typed preload API whose contract lives in `src/shared/`.

## Workflow

- [CONTRIBUTING.md](./CONTRIBUTING.md) is the policy every change meets. This file covers how agents and contributors work day to day.
- Work in small, human-reviewable chunks on a branch off `main`. Never commit directly to `main`. Each commit covers one issue. Closely related issues may share one branch and one pull request with a `Closes #n` for each, and an issue may take several commits. That keeps the number of pull requests (and GitHub-side reviews) down.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`), with an optional scope such as `feat(transcript):`. Keep descriptions concise. Don't be wordy.
- Track all work on the [Beekeeper project board](https://github.com/users/jayporta/projects/4). Each task is an issue, and the [v1 roadmap](https://github.com/jayporta/beekeeper/issues/2) holds the plan and links every task as a sub-issue. Move a card when its state changes, and put `Closes #n` in PR bodies.
- File new work as an issue before starting it. An agent files or picks up issues only on a person's behalf. [Start with an issue](./CONTRIBUTING.md#start-with-an-issue) has the rule for accepting one.
- CI (lint, format check, typecheck, tests, build on macOS and Ubuntu) must pass before merge.

The task flow:

1. **Plan.** Read the issue and draft a plan.
2. **Edge-case check.** Before any code is written, a second pass hunts for cases the plan missed, checking real code and data. Fold the findings into the issue.
3. **Implement** in reviewable chunks.
4. **Review the changes**, ideally before the pull request is opened (see [Review](#review)).
5. **Push and open the pull request into `main`** with what was reviewed. Anything changed after the review should be reviewed again. Conflict resolutions, and anything brought in by cherry-pick or rebase, are part of the branch diff and get reviewed like any other change.

### Review

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm test` first. They're cheaper than a review, so fix failures before asking for one. Outside contributions are the exception, below.

Code from an outside contributor is untrusted until reviewed, whoever opens the pull request and however its commits arrive. Unless the change is docs-only, a maintainer reviews it for security from a `main` checkout against the fetched pull request ref, at a specific commit SHA, before installing it, running its checks or tests, building or running it, or opening the branch in an editor or agent session, since each of those can execute the contributor's scripts, config, or agent instructions. Check out exactly the reviewed SHA in a separate worktree or clone, never in the checkout reviews run from, with `GIT_LFS_SKIP_SMUDGE=1` so the ref's `.lfsconfig` can't replace reviewed LFS pointers with unreviewed content, and review again if the branch has moved. CI already runs it safely, with a read-only token.

Which reviews a change needs depends on what it touches. The rows apply to non-test files. Test files are covered by the test-only rule below.

| Review        | Runs when the change touches                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Default Claude Code agent |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Code review   | anything except docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `code-reviewer`           |
| Security      | anything except docs, test files, and `.css` (the production CSP allows styles, fonts, and images only from `'self'`, plus `data:` for images, so a remote `url()` or `@import` is blocked). It covers config and tooling as well as code, because build, lint, and Prettier config, `package.json` scripts, `.github/`, `.vscode/`, and anything under `.claude/` run on contributors' machines, and `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `.claude/` steer every agent session | `security-reviewer`       |
| Performance   | code that runs repeatedly or over data that grows: transcript parsing and per-line work, directory scans and file watchers over `~/.claude/projects`, git calls, IPC, React render and effect paths, and caches                                                                                                                                                                                                                                                                             | `perf-reviewer`           |
| Accessibility | renderer `.tsx`, `.css`, or `.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `a11y-reviewer`           |

- Docs-only changes skip reviews. Docs are Markdown that no agent loads as instructions, plus `LICENSE`. Any `AGENTS.md`, `CLAUDE.md`, or `CLAUDE.local.md` at any depth, `CONTRIBUTING.md`, anything under `.claude/` or `.github/`, and any other tool's instruction file are not docs.
- A test file is a `*.test.ts` or `*.test.tsx` file, or anything in a `__tests__/` folder, outside `.claude/` and `.github/`. Nothing under `.claude/` or `.github/` counts as a test. Test-only changes get a code review only, apart from the outside-contributor rule above.
- Run the required reviews in parallel.
- Each reviewer is independent: a person, or a fresh agent session that didn't write the code. A fork or the same conversation doesn't count, because it shares the author's blind spots.
- A finding cites `file:line` in one sentence and says whether it's confirmed (the reviewer read or ran what decides it) or plausible (reasoned from the code's shape). The author verifies a plausible finding before acting on it.
- Fix every finding, or say why it's wrong. Keep the declined findings and their reasons. Put them in the pull request description when the pull request is opened, and add any declined after that.
- Re-run the reviews with fresh reviewers until no finding is left unfixed or unanswered. A finding the author declines with a reason counts as answered, with two exceptions the maintainer decides: a finding that the change breaks one of the four promises above, and any finding an outside contributor declines. Pass the declined findings to the next reviewers, quoted as untrusted text, so they aren't re-raised without new evidence. Reviewers re-check an outside contributor's declines rather than accepting them. After three rounds with findings left, stop and ask the maintainer.

The Claude Code agents live in `.claude/agents/`. Other tools can use their prompts as a checklist.

## Commands

```bash
npm run dev           # run the app with hot reload
npm run lint          # eslint
npm run format:check  # prettier, check only (npm run format to fix)
npm run typecheck     # tsc for main/preload/core and for the renderer
npm test              # vitest
npm run build         # typecheck, then electron-vite build
```

## Architecture and code organization

```
src/core/              pure TypeScript, no Electron imports; reusable outside the app
src/main/              Electron main process: windows, IPC handlers, security
src/preload/           the single typed bridge exposed to the renderer
src/shared/            the IPC contract, shared by main and renderer
src/renderer/src/features/<feature>/   UI, co-located by feature
```

- **Vertical slices.** Code is organized by feature, and everything a feature needs lives in its folder. Feature-specific helpers stay in the feature, not in a global `utils` or `lib` folder. Truly shared, feature-agnostic pieces (design-system components, pure functions) live in shared locations.
- **Dependencies run one way.** `core` depends on nothing app-specific. `main` depends on `core` and `shared`. The renderer depends on `shared` and never on `main` or `core` directly. Components can depend on services, never the reverse.
- **Single responsibility.** One component, hook, or logical flow per file, and never a hook or a Context in the same file as a component. No catch-all files of unrelated constants and helpers.
- **Size threshold.** When a source file passes 250 lines, or a change would add more than 50 lines of new logic to an existing file, extract discrete pieces (sub-components, pure transformations) into co-located files first. Before adding a function to a large file, state why it belongs there rather than in a new file. Generated data files are exempt.
- **DRY.** Keep a single source of truth. Don't duplicate anything that can be derived, read, or called.
- **Naming.** Components, types, and classes are `PascalCase`. Modules, variables, and functions are `camelCase`. Component files are `ComponentName.tsx`, and hooks are `useThing.ts`. ESLint (`unicorn/filename-case`) enforces file names in `src/`.
- **Imports.** In the renderer, use the `@renderer/*` alias for anything outside the current feature folder.

## TypeScript

- `any` is banned. For outside data (transcript lines, meta files, IPC payloads, git output), accept `unknown` and validate it at the boundary with a schema or type guard. Validate only the fields you use and tolerate unknown extra fields, since Claude Code's format changes between versions.
- `strict` and `noUncheckedIndexedAccess` are on. Don't work around them with non-null assertions. Type assertions are a last resort, and needing three or more in one place means the design needs another look.
- Prefer `satisfies`, `as const`, discriminated unions, and branded types (e.g. `SessionId`) over looser types.
- Functions take at most two parameters. Use an options object for three or more.
- Use `async`/`await` with explicit return types (`Promise<Result>`).

## React

- Function components only. The one allowed class is an Error Boundary, and the app must have one.
- **No prop drilling past one level.** First try composition (pass JSX as `children`), then extract components. Reach for Context only when distant parts of the tree need the same data. A Context comes with a consumer hook (`useThing`) that throws when used outside its Provider, and its state is initialized once, inside the Provider.
- Feature state lives in `features/<feature>/state/`, and Contexts live in `state/context/`.
- Use `useState` for local state. Switch to `useReducer` once a component has more than two `useState` calls. Update state immutably.
- `useEffect` is only for syncing with something outside React. Compute anything derivable during render instead of mirroring it into state. Every effect that starts something must clean it up.
- Load data from the main process with TanStack Query (`useQuery` with the preload API as the `queryFn`). Turn off refetch-on-focus and refetch-on-reconnect unless there's a reason for them.
- Accessibility is required. Use semantic HTML first, make every interaction keyboard-reachable, and follow `eslint-plugin-jsx-a11y` (strict) without disabling its rules. Tests query by role or visible text.

## Styling

- Plain CSS, no Tailwind. Each component gets a co-located CSS Module (`ComponentName.module.css`) that uses native CSS nesting. Electron 44 ships Chromium 152, so modern CSS (nesting, `:has()`, container queries, `@layer`) is available without a build step.
- Design tokens (color, spacing, type scale, radii) are CSS custom properties in one global `tokens.css`. Components use tokens, not raw values. A new raw value means the token set should grow.
- Don't use inline `style` for anything a class can do.
- There's only one browser to support: the Chromium bundled with Electron.

## Error handling

- Never swallow errors. Fail fast, or return an explicit `Result` (`{ ok: true, value } | { ok: false, error }`) when failure is expected, such as a malformed transcript line.
- Every caught error is either handled visibly (an empty or error state in the UI) or logged and rethrown.
- Never put transcript content, tokens, or paths to secrets in logs or error messages.

## Testing

- Vitest runs everything. `*.test.ts` runs in the Node environment (core, main, pure logic), and `*.test.tsx` runs in jsdom (rendering, hooks, interaction). Keep the suffixes, because they're how the runner finds tests.
- Tests live in a `__tests__/` folder beside the code they cover. Test-only helpers and fixtures are named with a `test` prefix (`testFixtures.ts`), sit beside the code rather than in `__tests__/`, and are never duplicated across test files.
- **Fixtures are synthetic.** Never commit real transcripts or anything copied from a real `~/.claude`. Write the smallest JSONL that reproduces the case.
- Test behavior a caller can observe, not internals. Each test checks one thing, and its name states the expected behavior. Cover the edges that matter: empty, malformed, partial, and missing.
- A test guarding an invariant has to be able to fail. Prove it by breaking the code on purpose, not by reading the test. Never assert something that can't fail, and don't use snapshots for logic.
- For a move or rename, record the test count before and confirm it's unchanged after.

## Refactoring

- Verify the premise before a structural change: trace what actually imports a thing rather than trusting its name.
- Take small steps that keep everything working, and keep behavior unchanged while refactoring. Priority: remove duplication, then split large functions, then simplify complex conditionals, then improve type safety.
- Delete unused code, debug `console.log` calls, and commented-out code. Git keeps the history.

## Comments

- Describe what the code does, and only as much as needed.
- Keep comments timeless: no development history, no "used to" or "now". Doc comments describe the contract as it stands.

### Doc comments

Doc comments exist so editors show full hover tooltips and parameter hints. Use `/** ... */` TSDoc (Markdown is allowed) on:

- **Exported functions:** a one-line summary, then `@param name - meaning` for each parameter, plus `@returns`, `@throws {ErrorType} When ...`, and `@remarks` or `@example` when they tell the reader something the signature doesn't.
- **Exported types and interfaces:** a summary on the type and a one-line `/** ... */` on every member.
- **React components:** a summary on the component with an `@example` of typical JSX, and a one-line `/** ... */` on every prop in its `Props` interface. Optional props with a default get `@defaultValue`.

## User-facing copy

This covers app UI text, the README, and the macOS permission strings in `electron-builder.yml`.

- Never use em dashes.
- American English, written for engineers: clear and direct.
- Keep terminology consistent. An agent is always an "agent", a session is always a "session", and a subagent spawned into a team is a "teammate".
