/** One project folder under `~/.claude/projects`. */
export interface ProjectDto {
  /** The folder's name exactly as on disk. Never a path. */
  readonly dirName: string
  /**
   * The last path segment of a working directory the project's newest
   * transcript records, or `null` when none was found or it was unusable.
   * Transcript-derived, so render it as plain text only. Never a path.
   */
  readonly label: string | null
  /**
   * The name of the listed folder this one is a worktree of, or `null` when it
   * is not a worktree folder of a listed folder. A worktree folder is named
   * `<parent>--claude-worktrees-<name>`. Never a path.
   */
  readonly worktreeOf: string | null
}
