# CLAUDE.md

The project rules for all agents live in AGENTS.md:

@AGENTS.md

When writing React or TypeScript here, load the `react-typescript` skill. When committing, load the `conventional-commits` skill. Where either skill conflicts with AGENTS.md, AGENTS.md wins. That covers styling (plain CSS Modules, not Tailwind), testing (Vitest for everything, not `node --test`), and fixtures (co-located synthetic files).
