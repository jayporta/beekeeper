# beekeeper

See what your Claude Code agents did, what they changed, and what they cost. Local-only.

**Status: alpha.** The sessions list works: pick a project and see each session's agents, tokens, and API-equivalent cost. Session detail is next.

## Why

Tools like Langfuse, Braintrust, and Helicone are built to trace single requests in a production LLM app. That's not the question a local agent swarm raises. When you kick off a handful of subagents or teammates on a repo, you want to know which agent touched which files, what each worktree actually changed, what each one cost, and where one of them went off the rails. beekeeper is built to answer those questions by reading Claude Code's own session files on disk, without a proxy, a server, or a network call.

## Status

A rough roadmap, in build order:

- [x] Project scaffold, security hardening, lint, tests, and CI
- [x] Read and parse Claude Code transcripts
- [x] Agent tree, token usage, and cost estimates
- [x] Worktree diffs
- [x] Sessions list
- [ ] Session detail: agents, timeline, and files

## Privacy promise

beekeeper is local-first and read-only. It makes zero outbound network calls and collects zero telemetry. The only network listener is an opt-in receiver for Claude Code's own cost reports, described below, and it is off until you turn it on. That's not just a claim in this README, it's enforced in a few concrete ways:

- **A session-level request blocker.** Every outgoing request is checked against an allowlist before it's allowed to leave the process. In production, only the app's own bundled files are allowed through, nothing else, not even to `localhost`. In development, only the Vite dev server's own origin is allowed too, so hot reload keeps working.
- **A strict Content-Security-Policy.** The renderer runs under a CSP that blocks any script, connection, or resource that isn't bundled with the app.
- **Lint rules that ban network APIs.** `http`, `https`, `net`, `tls`, `dgram`, `http2`, and Electron's own `net` module are banned imports. `fetch`, `XMLHttpRequest`, `WebSocket`, and `EventSource` are banned globals. If one of these ever creeps into the code, lint fails and CI blocks the merge. The one exception is `http`, which the opt-in receiver's folder (`src/main/otel/`) may import, and a lint test checks that the other bans still apply there.

### The opt-in telemetry receiver

Claude Code can export its own per-request cost estimates over OpenTelemetry. If you want beekeeper to show them next to its own estimate, you can turn on a receiver. It is off by default, and nothing listens until you turn it on.

- **Loopback only.** It binds `127.0.0.1` on a random port that beekeeper chooses each time you turn the receiver on, so nothing off your machine can reach it. It never makes an outbound request.
- **Authenticated.** Claude Code must send a bearer token that beekeeper creates each time you turn the receiver on and keeps, with the port, in its app data folder (`otel-receiver.json`, readable only by you). A request without the token is refused. Turning the receiver off deletes the token and the port, and turning it on again issues a new pair. A random port defeats a process that targets a known port, but not one that could bind the whole range while beekeeper is closed. Rotating the token limits what a captured token can do.
- **Narrow.** It accepts only `POST /v1/logs` with a JSON body. It refuses any request that carries an `Origin` header or a `Host` other than `127.0.0.1` or `localhost`, so a web page can't use your browser to reach it. Compressed bodies and bodies over 2 MiB are refused.
- **Only costs.** From each `claude_code.api_request` event beekeeper reads the session id, the cost, the token counts, the model, and the agent and request ids. It never stores or logs prompt or response content, headers, or the token, and it keeps what it hears in memory only, so nothing survives a restart.

Leave Claude Code's content flags (`OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_CONTENT`, and `OTEL_LOG_RAW_API_BODIES`) off. beekeeper ignores that content, but it has no reason to receive it.

## What beekeeper reads

- `~/.claude/projects/**/*.jsonl`: the main transcript and subagent transcripts for every session
- `~/.claude/projects/**/subagents/*.meta.json`: per-agent metadata (type, model, team, worktree)
- Read-only git commands inside your project and worktree folders, to show what a worktree agent changed: `rev-parse`, `merge-base`, `diff`, `diff-index`, and `ls-files` for the changes themselves, `check-ref-format` to validate a branch name, `config --get-regexp` to find filter drivers, since a repo that defines one isn't diffed as a working tree, and `check-attr` to check whether a changed path has a filter attribute, since such a path isn't diffed as a working tree either. To find a usable git, beekeeper checks a few known install paths, runs `git --version`, and on macOS also runs `xcode-select -p` and `xcrun --find git`.
- File metadata (`lstat`, `realpath`, `readlink`) inside project and worktree folders, to keep every git path confined to the folder it belongs to. beekeeper doesn't read file contents there except through git.

Planned: `~/.claude/sessions/*.json`, the live session registry, for a "running now" badge.

beekeeper never reads `~/.claude/sessions/*.key` (a peer token, not session data), `~/.claude/history.jsonl` (your prompt history), or `~/.claude/file-history/` (Claude Code's own edit backups).

## What beekeeper stores

beekeeper keeps a cache of the project list and of the session lists you've opened, so the app opens without rescanning everything. The cache holds those lists exactly as the app shows them:

- **Projects:** each project folder name, which encodes the path of the project, and which project is a worktree of which.
- **Each session:** its id, the project folder it's in, its title, whether it's a lead or a teammate agent, its agent type, name, and team, its model, and its activity times; its transcript's size and modification time; its subagent count; its recorded token and cost totals, and the token total of its own transcript; how many lines couldn't be read; and any plan limit it hit, with its reset time.
- **Why a summary is missing:** when a session's summary couldn't be read, the error code (`not-found`, `unreadable`, or `internal`).
- **Teams:** the team name, and how a session groups with its lead and teammates, including how a teammate was matched to its lead, whether it stopped, and whether it's missing. For a lead, it also holds the team's token and cost totals, how many sessions have no figure, and whether the lead's spawn or stop lists were capped.

beekeeper also keeps two preferences: the selected project and whether you've dismissed the first-run screen.

- They live in IndexedDB in beekeeper's own app data folder, never in `~/.claude` or in a repository, and they're never sent anywhere.
- No cached list is older than 7 days, and an update that changes the data format clears the cache. The two preferences stay until you change them.

If you turn on the telemetry receiver, beekeeper also writes `otel-receiver.json` to its app data folder with your on or off choice and, while it is on, the bearer token and port, readable only by you. Costs the receiver hears about are held in memory and never written to disk.

## Permissions you may see

- **A macOS folder prompt.** If a project or worktree lives under Documents, Desktop, Downloads, or iCloud Drive, macOS will ask if beekeeper can access that folder the first time it reads a file or runs `git` there. This is macOS protecting those folders, not beekeeper asking for anything unusual. `~/.claude` itself isn't protected this way.
- **A Gatekeeper warning on unsigned builds.** Until beekeeper ships signed and notarized builds, macOS will warn you the first time you open one. That's expected for an app you built or downloaded from source.
- beekeeper never asks for Full Disk Access.

## What's knowable

| Knowable from session files                                                   | Estimated, or needs hooks                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Agent tree: lead, subagents, teammates, model, team                           | Files changed via Bash in a shared checkout (attribution is a guess without a hook)                           |
| Tokens per agent, tool calls, wall-clock span, errors                         | Exact billed cost (subscription plans aren't billed per token, so beekeeper shows an API-equivalent estimate) |
| Files edited through Edit/Write (the transcript records each patch)           | A worktree's base commit once the worktree is deleted                                                         |
| A worktree agent's exact `git diff` against its merge-base                    | History older than 30 days (Claude Code's default retention)                                                  |
| Signs an agent went off the rails: error streaks, `stoppedByUser`, compaction | Live output while an agent is still running (beekeeper reads what's on disk, not a live stream)               |

## Development

beekeeper needs Node 22 or newer (CI runs on Node 24).

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

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE). The license doesn't grant rights to the beekeeper name or logo.
