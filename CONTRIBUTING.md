# Contributing to Beekeeper

Use whatever tools you like, AI agents or none. Beekeeper judges the result, not how it was made. A change is good when a person owns it, it's verified, it's independently reviewed, and it's small enough to read.

[AGENTS.md](./AGENTS.md) holds the promises Beekeeper keeps, the code rules, and the review roles. Read it before you change code.

## Start with an issue

Every pull request needs an accepted issue. Open one, describe the problem, and wait for the maintainer to accept it before you start. An issue is accepted once the maintainer adds it to the [project board](https://github.com/users/jayporta/projects/4). A pull request without an accepted issue, or one its author can't explain, gets closed. Obvious typo fixes are the exception.

## The standard every change meets

1. **You own it.** Whoever opens the pull request answers for every line and its behavior, whatever wrote it. You answer review comments yourself, not by relaying them to a tool you can't explain.
2. **It keeps Beekeeper's promises.** No network, read-only, transcripts as untrusted input, and no Node access in the renderer. See [the promises in AGENTS.md](./AGENTS.md#what-beekeeper-is-and-the-promises-it-keeps).
3. **It's verified.** You ran it. Tests cover the new behavior and can fail, which you prove by breaking the code on purpose. The pull request says how you verified it.
4. **It's reviewed independently.** The review roles in [AGENTS.md](./AGENTS.md#review) that apply to the change ran, and no finding is left unfixed or unanswered. A reviewer can be a person or an AI agent, but never the one that wrote the change. For an AI reviewer, that means a fresh session without the author's context.
5. **It's worth its review.** It's small, each commit covers one issue, and there's no unrelated churn. It has no generated output nobody read, no dead code, and no comments that narrate what the code already says.
6. **The checks pass.** Lint, format, typecheck, tests, and build.

## Agents

Agents may plan, write, test, review, and open pull requests on a person's behalf. That person is the author of record and answers for the work. Agents don't open issues, pull requests, or comments on their own initiative.

A rule a tool can check beats a rule in prose. When you see the same problem come up again, propose a lint rule or a test for it instead of another paragraph of guidance.

## Pull requests

- Branch off `main`. Never push to it directly.
- Write commit messages as [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), such as `fix(transcript): skip a partial last line`.
- Put `Closes #n` in the description, and fill in the pull request template.

What decides a merge:

- CI must pass on macOS and Ubuntu.
- A contributor's pull request also needs the maintainer's approval, and the maintainer merges it. GitHub doesn't let authors approve their own pull requests, so the maintainer's own pull requests merge once CI passes and the reviews in [AGENTS.md](./AGENTS.md#review) are answered.
- Automated reviewers may comment on a pull request. They advise and the maintainer decides. Their approval isn't required, and neither is agreeing with every comment.

## Development

The README's [Development](./README.md#development) section covers setup, and the Commands section of [AGENTS.md](./AGENTS.md#commands) lists every script. Run lint, format check, typecheck, and tests before you ask for a review. They're cheaper than one.
