import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const eslint = new ESLint({ cwd: repoRoot })

/** How long the first lint may take: it loads the config and builds the type-aware program. */
export const WARM_UP_TIMEOUT_MS = 60_000

/**
 * Lints `code` as if it lived at `path`, with the repo's ESLint config.
 * @param path - The file path, relative to the repo root, that selects which config blocks apply.
 * @param code - The source to lint.
 * @returns The ids of the rules that reported on `code`, one per message.
 */
export async function reportedRules(path: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(repoRoot, path) })
  return (result?.messages ?? []).flatMap((message) => (message.ruleId ? [message.ruleId] : []))
}
