const AGENTS_PREFIX = '.claude/agents/'
const SKILLS_PREFIX = '.claude/skills/'
const SETTINGS_PREFIX = '.claude/settings'
const RENDERER_PREFIX = 'src/renderer/'

const SECURITY_DIR_PREFIXES = [
  'src/main/',
  'src/preload/',
  'src/shared/',
  'src/core/',
  'build/',
  '.github/',
  '.claude/hooks/',
  '.githooks/',
  'scripts/',
  AGENTS_PREFIX,
  'resources/'
]
const SECURITY_RENDERER_EXTENSIONS = new Set(['ts', 'tsx', 'html'])
const SECURITY_EXACT_PATHS = new Set([
  'package.json',
  'package-lock.json',
  'electron-builder.yml',
  '.nvmrc',
  '.gitattributes',
  '.npmrc'
])
const SECURITY_FILE_PREFIXES = ['electron.vite.config.', 'eslint.config.', 'vitest.config.']
const SECURITY_FILE_MATCHERS = [/^tsconfig[^/]*\.json$/]

const ACCESSIBILITY_EXTENSIONS = new Set(['tsx', 'css', 'html'])

/**
 * Checks whether a path is documentation that needs no review at all: a
 * Markdown file outside `.claude/agents/`, anything under
 * `.claude/skills/`, or the LICENSE file.
 * @param {string} path - A path from the diff, relative to the repo root.
 * @returns {boolean} Whether the path is exempt from every review.
 */
export function isDocsPath(path) {
  if (path === 'LICENSE') return true
  if (path.startsWith(SKILLS_PREFIX)) return true
  return path.endsWith('.md') && !path.startsWith(AGENTS_PREFIX)
}

/**
 * Checks whether a path is a test file: anything under a `__tests__`
 * directory, or matching `*.test.{ts,tsx,mjs}`.
 * @param {string} path - A path from the diff, relative to the repo root.
 * @returns {boolean} Whether the path is a test.
 */
export function isTestPath(path) {
  if (path.split('/').includes('__tests__')) return true
  return /\.test\.(ts|tsx|mjs)$/.test(path)
}

function hasExtension(path, extensions) {
  const match = /\.([a-z0-9]+)$/i.exec(path)
  return match !== null && extensions.has(match[1].toLowerCase())
}

/**
 * Checks whether a path touches a security-sensitive surface: the
 * main/preload/shared/core sources, the renderer's TS/TSX/HTML files
 * (it displays untrusted transcript content), the review gate itself
 * (`.githooks/`, `scripts/`) and its Claude Code guard (`.claude/hooks/`),
 * reviewer agent prompts (they steer the gate), or the app's build,
 * dependency, CI, and hook configuration. Callers should skip test
 * paths first.
 * @param {string} path - A path from the diff, relative to the repo root.
 * @returns {boolean} Whether the path requires a security review.
 */
export function isSecurityPath(path) {
  if (SECURITY_DIR_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  if (path.startsWith(RENDERER_PREFIX) && hasExtension(path, SECURITY_RENDERER_EXTENSIONS)) {
    return true
  }
  if (SECURITY_EXACT_PATHS.has(path)) return true
  if (SECURITY_FILE_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  if (SECURITY_FILE_MATCHERS.some((pattern) => pattern.test(path))) return true
  return path.startsWith(SETTINGS_PREFIX) && path.endsWith('.json')
}

/**
 * Checks whether a path touches renderer UI that needs an accessibility
 * review: the renderer's TSX, CSS, or HTML files. Callers should skip
 * test paths first.
 * @param {string} path - A path from the diff, relative to the repo root.
 * @returns {boolean} Whether the path requires an accessibility review.
 */
export function isAccessibilityPath(path) {
  return path.startsWith(RENDERER_PREFIX) && hasExtension(path, ACCESSIBILITY_EXTENSIONS)
}
