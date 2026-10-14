import type { ProcessPort } from '../../core/io/processPort'
import { err, ok } from '../../core/shared/result'
import type { ModHost } from '../modHost'

/**
 * Pinned beside the request's env, which wins where it sets the same name: the variables that
 * change how git reads its configuration, finds a repository, matches paths or logs, set to the
 * values that turn that off.
 */
const ISOLATION_ENV = {
  GIT_CONFIG_COUNT: '0',
  GIT_CONFIG_PARAMETERS: '',
  GIT_CEILING_DIRECTORIES: '',
  GIT_DISCOVERY_ACROSS_FILESYSTEM: '',
  GIT_LITERAL_PATHSPECS: '0',
  GIT_ICASE_PATHSPECS: '0',
  GIT_GLOB_PATHSPECS: '0',
  GIT_NOGLOB_PATHSPECS: '0',
  GIT_TRACE: '0',
  GIT_TRACE2: '0',
  GIT_TRACE2_EVENT: '0',
  GIT_TRACE2_PERF: '0',
  GIT_TRACE_PACKET: '0',
  GIT_TRACE_PERFORMANCE: '0',
  GIT_TRACE_SETUP: '0'
}

/**
 * A {@link ProcessPort} over the engine's `$.process.run`, through a {@link ModHost}.
 *
 * Promises of the port that the mod can't keep: the child's environment is the request's env set
 * over the engine's inherited one, not the whole of it. Git is refused (`gitDisabled`) when an
 * inherited repository variable could redirect it, and the variables that most change its behavior
 * are pinned, but any other inherited variable still reaches it. Stdout comes back as text, so
 * `exactOutput` is false, though each run reports `exact` when its text holds no U+FFFD.
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
          env: { ...ISOLATION_ENV, ...request.env },
          timeoutMs: request.timeoutMs
        })
      } catch {
        return err(performance.now() - startedAt >= request.timeoutMs ? 'timeout' : 'spawn-failed')
      }
      if (result.isStdoutTruncated) return err('output-too-large')
      const stdout = encoder.encode(result.stdout)
      if (stdout.length > request.maxOutputBytes) return err('output-too-large')
      // Valid UTF-8 re-encodes to the same bytes; U+FFFD marks bytes the engine's decoding lost.
      return ok({ exitCode: result.exitCode, stdout, exact: !result.stdout.includes('\uFFFD') })
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
