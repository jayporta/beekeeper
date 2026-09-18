# AGENTS.md

Instructions for anyone, human or AI agent, changing code in this repo. Where this file and a general-purpose style guide disagree, this file wins.

## What Beekeeper is, and the promises it keeps

Beekeeper is a local-only, read-only Electron app that reads Claude Code's session files in `~/.claude/projects` and shows what each agent did, changed, and cost. Every change must keep these promises:

- **No network, ever.** No telemetry, no update checks, no remote fonts or assets. The session request allowlist (`src/main/security/`), the CSP, and the lint bans on network APIs enforce this. Never weaken them to make something work.
- **Read-only.** Beekeeper never writes to `~/.claude` or to a user's repositories. Git commands are read-only (`diff`, `merge-base`, `rev-parse`) and run through `execFile` with argument arrays, never a shell string.
- **Transcripts are untrusted input.** They contain web pages, tool output, and possibly secrets. Render them as plain text. Never use `dangerouslySetInnerHTML`, and never log transcript content.
- **The renderer has no Node access.** All file and git access happens in the main process and reaches the renderer through one typed preload API whose contract lives in `src/shared/`.

## Workflow

- Branch off `main` for every change. Never commit directly to `main`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`), with an optional scope such as `feat(transcript):`.
- Work in small, human-reviewable chunks. Finish, review, and commit one chunk before starting the next.
- Don't push until the maintainer has reviewed the change. Once pushed, open a pull request into `main`.
- CI (lint, format check, typecheck, tests, build on macOS and Ubuntu) must pass before merge.

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
- **Single responsibility.** One component, hook, or logical flow per file. No catch-all files of unrelated constants and helpers.
- **One component per file, one hook per file,** and never a hook or a Context in the same file as a component.
- **Size threshold.** When a source file passes 250 lines, or a change would add more than 50 lines of new logic to an existing file, extract discrete pieces (sub-components, pure transformations) into co-located files first. Before adding a function to a large file, state why it belongs there rather than in a new file. Generated data files are exempt.
- **DRY.** Keep a single source of truth. Don't duplicate anything that can be derived, read, or called.
- **Naming.** Components, types, and classes are `PascalCase`. Modules, variables, and functions are `camelCase`. Component files are `ComponentName.tsx`, and hooks are `useThing.ts`.
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
