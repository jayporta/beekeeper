# CLAUDE.md

The project rules for all agents live in AGENTS.md:

@AGENTS.md

This repo ships project skills in `.claude/skills/` that load automatically: `doc-comments` for TSDoc and `conventional-commits` for commit messages. The project agents in `.claude/agents/` are the default pre-commit reviewers.

If you also have personal coding skills (such as `react-typescript` or `code-standards`), AGENTS.md wins wherever they conflict. That covers styling (plain CSS Modules, not Tailwind), testing (Vitest for everything, not `node --test`), fixtures (co-located synthetic files), and user-facing copy (written for engineers).
