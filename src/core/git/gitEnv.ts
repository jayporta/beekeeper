/**
 * The complete environment for a git child process, built from scratch so
 * nothing inherited from the app (`GIT_DIR`, `GIT_WORK_TREE`, pagers, user
 * config) can change what git reads or writes.
 */
export const GIT_ENV: Readonly<Record<string, string>> = Object.freeze({
  GIT_OPTIONAL_LOCKS: '0',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_NO_LAZY_FETCH: '1',
  GIT_PAGER: 'cat',
  LC_ALL: 'C',
  PATH: '/usr/bin:/bin'
})
