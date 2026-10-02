# Beekeeper

See what your Claude Code agents did, what they changed, and what they cost. Local-only.

**Status: alpha.** The sessions list works: pick a project and see each session's agents, tokens, and API-equivalent cost. Session detail is next.

## Why

Tools like Langfuse, Braintrust, and Helicone are built to trace single requests in a production LLM app. That's not the question a local agent swarm raises. When you kick off a handful of subagents or teammates on a repo, you want to know which agent touched which files, what each worktree actually changed, what each one cost, and where one of them went off the rails. Beekeeper is built to answer those questions by reading Claude Code's own session files on disk, without a proxy, a server, or a network call.

## Status

A rough roadmap, in build order:

- [x] Project scaffold, security hardening, lint, tests, and CI
- [x] Read and parse Claude Code transcripts
- [x] Agent tree, token usage, and cost estimates
- [x] Worktree diffs
- [x] Sessions list
- [ ] Session detail: agents, timeline, and files

## Privacy promise

Beekeeper is local-first and read-only. It makes zero network calls and collects zero telemetry. That's not just a claim in this README, it's enforced in a few concrete ways:

- **A session-level request blocker.** Every outgoing request is checked against an allowlist before it's allowed to leave the process. In production, only the app's own bundled files are allowed through, nothing else, not even to `localhost`. In development, only the Vite dev server's own origin is allowed too, so hot reload keeps working.
- **A strict Content-Security-Policy.** The renderer runs under a CSP that blocks any script, connection, or resource that isn't bundled with the app.
- **Lint rules that ban network APIs.** `http`, `https`, `net`, `tls`, `dgram`, `http2`, and Electron's own `net` module are banned imports. `fetch`, `XMLHttpRequest`, `WebSocket`, and `EventSource` are banned globals. If one of these ever creeps into the code, lint fails and CI blocks the merge.

## What Beekeeper reads

- `~/.claude/projects/**/*.jsonl`: the main transcript and subagent transcripts for every session
- `~/.claude/projects/**/subagents/*.meta.json`: per-agent metadata (type, model, team, worktree)
- Read-only git commands inside your project and worktree folders, to show what a worktree agent changed: `rev-parse`, `merge-base`, `diff`, `diff-index`, and `ls-files` for the changes themselves, `check-ref-format` to validate a branch name, `config --get-regexp` to find filter drivers, since a repo that defines one isn't diffed as a working tree, and `check-attr` to check whether a changed path has a filter attribute, since such a path isn't diffed as a working tree either. To find a usable git, Beekeeper checks a few known install paths, runs `git --version`, and on macOS also runs `xcode-select -p` and `xcrun --find git`.
- File metadata (`lstat`, `realpath`, `readlink`) inside project and worktree folders, to keep every git path confined to the folder it belongs to. Beekeeper doesn't read file contents there except through git.

Planned: `~/.claude/sessions/*.json`, the live session registry, for a "running now" badge.

Beekeeper never reads `~/.claude/sessions/*.key` (a peer token, not session data), `~/.claude/history.jsonl` (your prompt history), or `~/.claude/file-history/` (Claude Code's own edit backups).

## What Beekeeper stores

Beekeeper keeps a cache of the project list and of the session lists you've opened, so the app opens without rescanning everything. The project cache holds each folder name and its worktree parent, if any. For each session, the cache holds its project folder and session id; transcript modification time and size; subagent count; summary read status or error code; title; token and cost totals; activity times; unreadable-line count; lead or agent role; agent type, agent name, team name, and model; plan-limit type and reset time; and team grouping data. Team grouping data includes lead and teammate session references, usage totals and missing-usage counts, missing or truncated teammate records, how a teammate was matched, whether it was stopped, and ungrouped team names. Beekeeper also keeps two preferences: the selected project and whether you've dismissed the first-run screen.

- They live in IndexedDB in Beekeeper's own app data folder, never in `~/.claude` or in a repository, and they're never sent anywhere.
- No cached list is older than 7 days, and an update that changes the data format clears the cache. The two preferences stay until you change them.

## Permissions you may see

- **A macOS folder prompt.** If a project or worktree lives under Documents, Desktop, Downloads, or iCloud Drive, macOS will ask if Beekeeper can access that folder the first time it reads a file or runs `git` there. This is macOS protecting those folders, not Beekeeper asking for anything unusual. `~/.claude` itself isn't protected this way.
- **A Gatekeeper warning on unsigned builds.** Until Beekeeper ships signed and notarized builds, macOS will warn you the first time you open one. That's expected for an app you built or downloaded from source.
- Beekeeper never asks for Full Disk Access.

## What's knowable

| Knowable from session files                                                   | Estimated, or needs hooks                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Agent tree: lead, subagents, teammates, model, team                           | Files changed via Bash in a shared checkout (attribution is a guess without a hook)                           |
| Tokens per agent, tool calls, wall-clock span, errors                         | Exact billed cost (subscription plans aren't billed per token, so Beekeeper shows an API-equivalent estimate) |
| Files edited through Edit/Write (the transcript records each patch)           | A worktree's base commit once the worktree is deleted                                                         |
| A worktree agent's exact `git diff` against its merge-base                    | History older than 30 days (Claude Code's default retention)                                                  |
| Signs an agent went off the rails: error streaks, `stoppedByUser`, compaction | Live output while an agent is still running (Beekeeper reads what's on disk, not a live stream)               |

## Development

Beekeeper needs Node 22 or newer (CI runs on Node 24).

```bash
npm install           # install dependencies
npm run dev           # run the app
npm run lint          # eslint
npm run format:check  # prettier, check only
npm run typecheck     # tsc, no emit
npm test              # vitest
npm run build         # typecheck, then electron-vite build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to contribute and what every change must meet.

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE). The license doesn't grant rights to the Beekeeper name or logo.
