/** One project folder under `~/.claude/projects`. */
export interface ProjectDto {
  /** The folder's name exactly as on disk. Never a path. */
  readonly dirName: string
  /**
   * The name of the listed folder this one is a worktree of, or `null` when it
   * is not a worktree folder of a listed folder. A worktree folder is named
   * `<parent>--claude-worktrees-<name>`. Never a path.
   */
  readonly worktreeOf: string | null
}
