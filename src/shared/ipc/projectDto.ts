/** One project folder under `~/.claude/projects`. */
export interface ProjectDto {
  /** The folder's name exactly as on disk. Never a path. */
  readonly dirName: string
}
