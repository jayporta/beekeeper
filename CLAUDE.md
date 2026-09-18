# CLAUDE.md

The project rules for all agents live in AGENTS.md:

@AGENTS.md

This repo ships project skills in `.claude/skills/` that load automatically: `doc-comments` for TSDoc and `conventional-commits` for commit messages.

If you also have a personal `react-typescript` skill, AGENTS.md wins wherever they conflict. That covers styling (plain CSS Modules, not Tailwind), testing (Vitest for everything, not `node --test`), and fixtures (co-located synthetic files).
