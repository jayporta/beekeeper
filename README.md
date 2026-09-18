# Beekeeper

See what your Claude Code agents did, what they changed, and what they cost. Local-only.

**Status: pre-alpha.** There's nothing to look at in the app yet, just the scaffolding and the security setup. Come back once the sessions list lands.

## Why

Tools like Langfuse, Braintrust, and Helicone are built to trace single requests in a production LLM app. That's not the question a local agent swarm raises. When you kick off a handful of subagents or teammates on a repo, you want to know which agent touched which files, what each worktree actually changed, what each one cost, and where one of them went off the rails. Beekeeper is built to answer those questions by reading Claude Code's own session files on disk, without a proxy, a server, or a network call.

## Status

A rough roadmap, in build order:

- [x] Project scaffold, security hardening, lint, tests, and CI
- [ ] Read and parse Claude Code transcripts
- [ ] Agent tree, token usage, and cost estimates
- [ ] Worktree diffs
- [ ] Sessions list
- [ ] Session detail: agents, timeline, and files

## Privacy promise

Beekeeper is local-first and read-only. It makes zero network calls and collects zero telemetry. That's not just a claim in this README, it's enforced in a few concrete ways:

- **A session-level request blocker.** Every outgoing request is checked against an allowlist before it's allowed to leave the process. In production, only the app's own bundled files are allowed through, nothing else, not even to `localhost`. In development, only the Vite dev server's own origin is allowed too, so hot reload keeps working.
- **A strict Content-Security-Policy.** The renderer runs under a CSP that blocks any script, connection, or resource that isn't bundled with the app.
- **Lint rules that ban network APIs.** `http`, `https`, `net`, `tls`, `dgram`, `http2`, and Electron's own `net` module are banned imports. `fetch`, `XMLHttpRequest`, `WebSocket`, and `EventSource` are banned globals. If one of these ever creeps into the code, lint fails and CI blocks the merge.

## What Beekeeper reads

- `~/.claude/projects/**/*.jsonl`: the main transcript and subagent transcripts for every session
- `~/.claude/projects/**/subagents/*.meta.json`: per-agent metadata (type, model, team, worktree)
- `~/.claude/sessions/*.json`: the live session registry, used for a "running now" badge
- Read-only `git diff` and `git merge-base` inside your project and worktree folders, to show what a worktree agent changed

Beekeeper never reads `~/.claude/sessions/*.key` (a peer token, not session data), `~/.claude/history.jsonl` (your prompt history), or `~/.claude/file-history/` (Claude Code's own edit backups).

## Permissions you may see

- **A macOS folder prompt.** If a project or worktree lives under Documents, Desktop, Downloads, or iCloud Drive, macOS will ask if Beekeeper can access that folder the first time it reads a file or runs `git` there. This is macOS protecting those folders, not Beekeeper asking for anything unusual. `~/.claude` itself isn't protected this way.
- **A Gatekeeper warning on unsigned builds.** Until Beekeeper ships signed and notarized builds, macOS will warn you the first time you open one. That's expected for an app you built or downloaded from source.
- Beekeeper never asks for Full Disk Access.

## What's knowable

| Knowable from session files                                                   | Estimated, or needs hooks                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Agent tree: lead, subagents, teammates, model, team                           | Files changed via Bash in a shared checkout (attribution is a guess without a hook)                           |
| Tokens per agent, tool calls, wall-clock span, errors                         | Exact billed cost (subscription plans aren't billed per token, so Beekeeper shows an API-equivalent estimate) |
| Files edited through Edit/Write, with the patch                               | A worktree's base commit once the worktree is deleted                                                         |
| A worktree agent's exact `git diff` against its merge-base                    | History older than 30 days (Claude Code's default retention)                                                  |
| Signs an agent went off the rails: error streaks, `stoppedByUser`, compaction | Live output while an agent is still running (Beekeeper reads what's on disk, not a live stream)               |

## Development

Beekeeper needs Node 22 or newer (CI runs on Node 24).

```bash
npm install           # also installs the pre-commit review hook
npm run dev           # run the app
npm run lint          # eslint
npm run format:check  # prettier, check only
npm run typecheck     # tsc, no emit
npm test              # vitest
npm run build         # typecheck, then electron-vite build
npm run review:plan   # which reviews the staged change needs
npm run review:record # record that those reviews came back clean
```

Commits go through a pre-commit review gate. `npm install` sets this clone's `core.hooksPath` to `.githooks/`, and the hook blocks `git commit` until the checks pass and a code, security, or accessibility review (whichever the change needs) has come back clean for the exact staged content. See the "Pre-commit review" section of [AGENTS.md](./AGENTS.md) for how the reviews work.

## License

MIT. See [LICENSE](./LICENSE).
