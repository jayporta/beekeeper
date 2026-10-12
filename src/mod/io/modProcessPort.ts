import type { ProcessPort } from '../../core/io/processPort'
import { err, ok } from '../../core/shared/result'
import type { ModHost } from '../modHost'

/** Set over the request's env so the user's own git configuration and discovery settings don't leak in. */
const ISOLATION_ENV = {
  GIT_CONFIG_COUNT: '0',
  GIT_CONFIG_PARAMETERS: '',
  GIT_CEILING_DIRECTORIES: '',
  GIT_DISCOVERY_ACROSS_FILESYSTEM: ''
}

/**
 * A {@link ProcessPort} over the engine's `$.process.run`, through a {@link ModHost}.
 *
 * Promises of the port that the mod can't keep: the child's environment is the request's env set
 * over the engine's inherited one, not the whole of it, so git is refused instead when an inherited
 * repository variable could redirect it (`gitDisabled`); and stdout comes back as text, so
 * `exactOutput` is false.
 *
 * @param options - The host; the platform name; and whether to refuse every run.
 * @returns The adapter to install with `installProcessPort`.
 */
export function createModProcessPort(options: {
  host: ModHost
  platform: string
  gitDisabled: boolean
}): ProcessPort {
  const { host, platform, gitDisabled } = options
  const encoder = new TextEncoder()
  return {
    async run(request) {
      if (gitDisabled) return err('spawn-failed')
      const startedAt = performance.now()
      let result
      try {
        result = await host.runGit({
          file: request.file,
          args: request.args,
          env: { ...request.env, ...ISOLATION_ENV },
          timeoutMs: request.timeoutMs
        })
      } catch {
        return err(performance.now() - startedAt >= request.timeoutMs ? 'timeout' : 'spawn-failed')
      }
      if (result.isStdoutTruncated) return err('output-too-large')
      const stdout = encoder.encode(result.stdout)
      if (stdout.length > request.maxOutputBytes) return err('output-too-large')
      return ok({ exitCode: result.exitCode, stdout })
    },
    /** The engine reports no mode bits, so any regular file counts. */
    async isExecutable(path) {
      try {
        return (await host.stat(path)).kind === 'file'
      } catch {
        return false
      }
    },
    platform,
    exactOutput: false
  }
}
