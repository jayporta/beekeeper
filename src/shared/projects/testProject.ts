import type { ProjectDto } from '../ipc/projectDto'

/** What makes a test project a worktree: the folder it belongs to and its name. Set together or not at all. */
export interface TestWorktree {
  /** The name of the folder this one is a worktree of. */
  readonly worktreeOf: string
  /** The worktree's name, as the app reports it. */
  readonly worktreeName: string
}

/**
 * A project folder, for stubbing `listProjects`.
 *
 * @param dirName - The folder's name under `~/.claude/projects`.
 * @param worktree - Set when the folder is a worktree of another listed folder. Omit it for a top-level project.
 * @returns The project, with no label.
 */
export function testProject(dirName: string, worktree?: TestWorktree): ProjectDto {
  return {
    dirName,
    label: null,
    worktreeOf: worktree?.worktreeOf ?? null,
    worktreeName: worktree?.worktreeName ?? null
  }
}
