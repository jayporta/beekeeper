# CLAUDE.md

The project rules for all agents live in AGENTS.md:

@AGENTS.md

This repo ships project skills in `.claude/skills/` that load automatically: `doc-comments` for TSDoc and `conventional-commits` for commit messages.

Pre-commit reviews follow the "Pre-commit review" section of AGENTS.md. The project agents in `.claude/agents/` are the defaults, and your own review agents are fine as long as they cover the same ground. Whichever you use, run each review as a fresh subagent rather than a fork: a reviewer that inherits the author's context shares the author's blind spots.

If you also have a personal `react-typescript` skill, AGENTS.md wins wherever they conflict. That covers styling (plain CSS Modules, not Tailwind), testing (Vitest for everything, not `node --test`), and fixtures (co-located synthetic files).
