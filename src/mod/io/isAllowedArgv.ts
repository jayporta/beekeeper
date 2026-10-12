const PROBES: readonly (readonly [string, readonly string[]])[] = [
  ['/usr/bin/xcode-select', ['-p']],
  ['/usr/bin/xcrun', ['--find', 'git']]
]

/**
 * Whether the mod may run this program: git by absolute path, or one of the two macOS probes
 * `locateGit` makes to find it. Git's arguments are not checked here: core checks the commands it
 * runs in a repository against `gitAllowlist.ts`, but `locateGit` also runs `<candidate> --version`
 * without that check.
 *
 * @param file - The program's path.
 * @param args - The arguments after it.
 * @returns True for an absolute path whose last segment is exactly `git`, or for exactly one probe.
 */
export function isAllowedArgv(file: string, args: readonly string[]): boolean {
  if (file.startsWith('/') && file.split('/').at(-1) === 'git') return true
  return PROBES.some(
    ([probe, probeArgs]) =>
      file === probe &&
      args.length === probeArgs.length &&
      args.every((arg, index) => arg === probeArgs[index])
  )
}
