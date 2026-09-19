/**
 * Removes every environment variable whose name starts with `GIT_`. A
 * git hook runs with `GIT_INDEX_FILE`, `GIT_DIR`, `GIT_WORK_TREE`,
 * `GIT_PREFIX`, and more already set, pointed at the commit in
 * progress; a child process that inherits them could have its own git
 * commands silently redirected there instead of the repo's normal
 * state.
 * @param {NodeJS.ProcessEnv} env - The environment to sanitize.
 * @returns {NodeJS.ProcessEnv} A copy of `env` with every `GIT_*` variable removed.
 */
export function withoutGitEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')))
}
