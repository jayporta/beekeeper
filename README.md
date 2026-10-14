# beekeeper

See what your Claude Code agents did, what they changed, and what they cost. Local-only.

**Status: alpha.** 0.1.0 is the first public release. Builds are unsigned for now (signing is tracked in [#20](https://github.com/jayporta/beekeeper/issues/20)), so your OS will warn you the first time you open one. See [Install](#install).

## Install

Download the build for your platform from the [Releases page](https://github.com/jayporta/beekeeper/releases). Builds are available for macOS (Apple Silicon) and Linux (x64).

### macOS

1. Download [`beekeeper-mac-arm64.dmg`](https://github.com/jayporta/beekeeper/releases/latest/download/beekeeper-mac-arm64.dmg), open it, and drag Beekeeper into Applications.
2. Open Beekeeper. macOS blocks the first launch because the build isn't signed by an identified developer.
3. Open System Settings > Privacy & Security, scroll to the message about Beekeeper, and click **Open Anyway**.

Or remove the quarantine flag from a terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Beekeeper.app
```

### Linux

- **deb (recommended, especially on Ubuntu 24.04 and newer):** download [`beekeeper-linux-amd64.deb`](https://github.com/jayporta/beekeeper/releases/latest/download/beekeeper-linux-amd64.deb), then run `sudo apt install ./beekeeper-linux-amd64.deb`. Ubuntu 24.04+ restricts unprivileged user namespaces with AppArmor, and an AppImage needs an allowance for that.
- **AppImage:** download [`beekeeper-linux-x86_64.AppImage`](https://github.com/jayporta/beekeeper/releases/latest/download/beekeeper-linux-x86_64.AppImage), run `chmod +x beekeeper-linux-x86_64.AppImage`, then run it. It needs FUSE 2, which current distros often leave out: on Ubuntu 24.04 install `libfuse2t64`, and on 22.04 `libfuse2`.

### Verify your download

Each release includes a `SHA256SUMS` file. Put it in the same folder as the files you downloaded, then run:

```bash
shasum -a 256 -c SHA256SUMS   # macOS
sha256sum -c SHA256SUMS       # Linux
```

Lines for files you didn't download will report as missing. Ignore those.

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

Beekeeper is local-first and read-only. It makes zero outbound network calls and collects zero telemetry. The only network listener is an opt-in receiver for Claude Code's own cost reports, described below, and it is off until you turn it on. That's not just a claim in this README, it's enforced in a few concrete ways:

- **A session-level request blocker.** Every outgoing request is checked against an allowlist before it's allowed to leave the process. In production, only the app's own bundled files are allowed through, nothing else, not even to `localhost`. In development, only the Vite dev server's own origin is allowed too, so hot reload keeps working.
- **A strict Content-Security-Policy.** The renderer runs under a CSP that blocks any script, connection, or resource that isn't bundled with the app.
- **Lint rules that ban network APIs.** `http`, `https`, `net`, `tls`, `dgram`, `http2`, and Electron's own `net` module are banned imports. `fetch`, `XMLHttpRequest`, `WebSocket`, and `EventSource` are banned globals. If one of these ever creeps into the code, lint fails and CI blocks the merge. The one exception is `http`, which the opt-in receiver's folder (`src/main/otel/`) may import, and a lint test checks that the other bans still apply there.

### The opt-in telemetry receiver

Claude Code can export its own per-request cost estimates over OpenTelemetry. If you want beekeeper to show them next to its own estimate, you can turn on a receiver. It is off by default, and nothing listens until you turn it on.

- **Loopback only.** It binds `127.0.0.1` on a random port that beekeeper chooses each time you turn the receiver on, so nothing off your machine can reach it. It never makes an outbound request.
- **Authenticated.** Claude Code must send a bearer token that beekeeper creates each time you turn the receiver on and keeps, with the port, in its app data folder (`otel-receiver.json`, readable only by you). A request without the token is refused. Turning the receiver off deletes the token and the port, and turning it on again issues a new pair. A random port defeats a process that targets a known port, but not one that could bind the whole range while beekeeper is closed. Rotating the token limits what a captured token can do.
- **Narrow.** It accepts only `POST /v1/logs` with a JSON body. It refuses any request that carries an `Origin` header or a `Host` other than `127.0.0.1` or `localhost`, so a web page can't use your browser to reach it. Compressed bodies and bodies over 2 MiB are refused.
- **Only costs.** From each `claude_code.api_request` event beekeeper reads the session id, the cost, the token counts, the model, and the agent and request ids. It never stores or logs prompt or response content, headers, or the token, and it keeps what it hears in memory only, so nothing survives a restart.

Leave Claude Code's content flags (`OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_CONTENT`, and `OTEL_LOG_RAW_API_BODIES`) off. Beekeeper ignores that content, but it has no reason to receive it.

## What beekeeper reads

The paths below start at `~/.claude`, or at the folder `CLAUDE_CONFIG_DIR` names when it's set to an absolute path (an empty or relative value is ignored). An app opened from Finder or the Dock doesn't inherit your shell's variables, so the variable only applies when it's in launchd's environment or you quit beekeeper and run its executable from a terminal (`/Applications/Beekeeper.app/Contents/MacOS/Beekeeper`). `open -a Beekeeper` goes through Finder's environment too, and while beekeeper is already open a second launch just exits.

- `~/.claude/projects/**/*.jsonl`: the main transcript and subagent transcripts for every session
- `~/.claude/projects/**/subagents/*.meta.json`: per-agent metadata (type, model, team, worktree)
- Read-only git commands inside your project and worktree folders, to show what a worktree agent changed: `rev-parse`, `merge-base`, `diff`, `diff-index`, and `ls-files` for the changes themselves, `check-ref-format` to validate a branch name, `config --get-regexp` to find filter drivers, since a repo that defines one isn't diffed as a working tree, and `check-attr` to check whether a changed path has a filter attribute, since such a path isn't diffed as a working tree either. To find a usable git, beekeeper checks a few known install paths, runs `git --version`, and on macOS also runs `xcode-select -p` and `xcrun --find git`.
- File metadata (`lstat`, `realpath`, `readlink`) inside project and worktree folders, to keep every git path confined to the folder it belongs to. Beekeeper doesn't read file contents there except through git.

Planned: `~/.claude/sessions/*.json`, the live session registry, for a "running now" badge.

Beekeeper never reads `~/.claude/sessions/*.key` (a peer token, not session data), `~/.claude/history.jsonl` (your prompt history), or `~/.claude/file-history/` (Claude Code's own edit backups).

## What beekeeper stores

Beekeeper keeps its own data in its app data folder: `~/Library/Application Support/beekeeper` on macOS, `~/.config/beekeeper` on Linux. It never writes to `~/.claude` or a repository, and nothing it keeps is sent anywhere.

It never stores your prompts, the model's responses, tool output, or file contents. Session titles are the ones Claude Code generates itself. The categories below are described with examples, not as complete lists.

- **Cache.** So the app opens without rescanning, beekeeper caches (in IndexedDB) the project list, the session lists you've opened, per-project totals, and daily usage. A session list holds each session as the sessions list shows it, such as its title, agent, team, token and cost totals, signals, and its subagents' names, task descriptions, and types. Totals hold tokens and cost per project and the latest session's id, title, and time. Daily usage holds tokens per day per model. Entries expire after 7 days, and an update that changes the data format clears the cache.
- **Preferences.** The selected project, whether you've dismissed the first-run screen, and the sidebar width (in IndexedDB). They stay until you change them.
- **Archive.** Claude Code deletes old transcripts (after 30 days by default), so beekeeper keeps an archive in a SQLite file, `archive.sqlite` (plus `archive.sqlite-wal` and `archive.sqlite-shm`).
  - **List entries.** Each session with a readable transcript in any project folder under `~/.claude/projects` gets an entry: a background pass archives every folder, not only the ones you open. It holds what the cache holds, plus a record of when the session was active (its teammates spawned and stopped, and its token usage per model in 15-minute UTC slots).
  - **Session details.** Once a session's last activity is 7 days old, the archive keeps the session's detail, such as the agent tree and each agent's metadata, tokens and API-equivalent cost, the paths of files its tool calls touched, signals, message counts, activity times, and workflow runs. A detail over 5 million characters is skipped. Worktree diffs and patches, and costs from the telemetry receiver, are read live and never archived.
  - **When.** A background pass writes the archive a minute after the first window loads, then daily, and opening a project or session writes it too.
  - **How long.** The archive has no expiry, and beekeeper never deletes a row. A session stays in it after Claude Code removes its transcript, and beekeeper then shows the archived copy and marks it as archived.

If you turn on the telemetry receiver, beekeeper also writes `otel-receiver.json` to the same folder with your on or off choice and, while it is on, the bearer token and port, readable only by you. Costs the receiver hears about are held in memory and never written to disk.

To delete the archive, quit beekeeper and delete `archive.sqlite`, `archive.sqlite-wal`, and `archive.sqlite-shm` from the app data folder. Beekeeper starts a new archive the next time it runs, from the transcripts still on disk.

## Permissions you may see

- **A macOS folder prompt.** If a project or worktree lives under Documents, Desktop, Downloads, or iCloud Drive, macOS will ask if beekeeper can access that folder the first time it reads a file or runs `git` there. This is macOS protecting those folders, not beekeeper asking for anything unusual. `~/.claude` itself isn't protected this way.
- **A Gatekeeper warning on unsigned builds.** Until beekeeper ships signed and notarized builds, macOS blocks the first launch. See [Install](#install) for how to open it.
- Beekeeper never asks for Full Disk Access.

## What's knowable

| Knowable from session files                                                   | Estimated, or needs hooks                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Agent tree: lead, subagents, teammates, model, team                           | Files changed via Bash in a shared checkout (attribution is a guess without a hook)                           |
| Tokens per agent, tool calls, wall-clock span, errors                         | Exact billed cost (subscription plans aren't billed per token, so beekeeper shows an API-equivalent estimate) |
| Files edited through Edit/Write (the transcript records each patch)           | A worktree's base commit once the worktree is deleted                                                         |
| A worktree agent's exact `git diff` against its merge-base                    | History older than 30 days (Claude Code's default retention), unless beekeeper archived the session first     |
| Signs an agent went off the rails: error streaks, `stoppedByUser`, compaction | Live output while an agent is still running (beekeeper reads what's on disk, not a live stream)               |

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

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE). The license doesn't grant rights to the beekeeper name or logo.
