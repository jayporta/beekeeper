# CLAUDE.md

The project rules for all agents live in AGENTS.md:

@AGENTS.md

If you also have personal coding skills (such as `react-typescript` or `code-standards`), AGENTS.md wins wherever they conflict. That covers styling (plain CSS Modules, not Tailwind), testing (Vitest for everything, not `node --test`), fixtures (co-located synthetic files), and user-facing copy (written for engineers).

## Worktrees

Create worktrees with `claude --worktree <name>` or the EnterWorktree tool, so they land in `.claude/worktrees/`. Never use plain `git worktree add` to a sibling directory. EnterWorktree switches between worktrees under `.claude/worktrees/` freely, but entering any other path asks for approval every time, and a session started in a sibling checkout stays pinned there. Start sessions from the main checkout.
