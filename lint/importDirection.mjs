import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_ROOT = resolve(REPO_ROOT, 'src')
const SRC_PREFIX = 'src/'
const RENDERER_ALIAS = '@renderer/'
const RENDERER_ROOT = resolve(SRC_ROOT, 'renderer/src')

/**
 * Names the top folder under `src` that holds a file.
 *
 * @param {string} absolutePath - An absolute path.
 * @returns {string | undefined} `core`, `main`, and so on, or `undefined` for a path outside `src`.
 */
function topFolder(absolutePath) {
  const inside = relative(SRC_ROOT, absolutePath)
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return undefined
  return inside.split(sep)[0]
}

/**
 * Resolves an import source to the top folder under `src` it lands in. A
 * relative source resolves against the importing file, so `../../shared` means
 * `src/core/shared` from a nested core file and `src/shared` from elsewhere.
 *
 * @param {string} source - The import specifier.
 * @param {string} importerPath - The absolute path of the importing file.
 * @returns {string | undefined} The target's top folder, or `undefined` for a package or a path outside `src`.
 */
function targetFolder(source, importerPath) {
  if (source.startsWith('.')) return topFolder(resolve(dirname(importerPath), source))
  if (source.startsWith(RENDERER_ALIAS)) {
    return topFolder(resolve(RENDERER_ROOT, source.slice(RENDERER_ALIAS.length)))
  }
  // tsconfig.web.json sets `baseUrl` to the repo root, so `src/...` resolves too.
  if (source.startsWith(SRC_PREFIX)) return topFolder(resolve(REPO_ROOT, source))
  return undefined
}

/**
 * Reads the string an import-like node points at.
 *
 * @param {import('estree').Node | null | undefined} node - A source node.
 * @returns {string | undefined} The specifier, or `undefined` when it is not a plain string.
 */
function sourceText(node) {
  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined
}

/**
 * Enforces the one-way dependency directions between the top folders of `src`.
 *
 * The single option maps a folder to what it may not import:
 * `{ core: { folders: ['main'], packages: ['electron'] } }` bans `src/main`
 * and the `electron` package from `src/core`. It checks static imports
 * (including `import type`), re-exports, dynamic `import()`, and type-position
 * `import()`, and it resolves each relative path, the `@renderer/` alias, and `src/`-rooted paths, so
 * the check follows the target file rather than the import string.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const importDirection = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the one-way dependency directions between src folders.' },
    schema: [
      {
        type: 'object',
        additionalProperties: {
          type: 'object',
          additionalProperties: false,
          properties: {
            folders: { type: 'array', items: { type: 'string' } },
            packages: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    ],
    messages: {
      forbiddenFolder:
        'Code in src/{{from}} must not import from src/{{to}}. Dependencies run one way (AGENTS.md, "Architecture and code organization").',
      forbiddenPackage:
        'Code in src/{{from}} must not import "{{name}}". Dependencies run one way (AGENTS.md, "Architecture and code organization").'
    }
  },
  create(context) {
    const from = topFolder(context.filename)
    const rules = from === undefined ? undefined : context.options[0]?.[from]
    if (rules === undefined) return {}
    const folders = new Set(rules.folders ?? [])
    const packages = rules.packages ?? []

    /** @param {import('estree').Node | null | undefined} node */
    function check(node) {
      const source = sourceText(node)
      if (source === undefined || node == null) return
      const to = targetFolder(source, context.filename)
      if (to !== undefined && folders.has(to)) {
        context.report({ node, messageId: 'forbiddenFolder', data: { from, to } })
      } else if (packages.some((name) => source === name || source.startsWith(`${name}/`))) {
        context.report({ node, messageId: 'forbiddenPackage', data: { from, name: source } })
      }
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      // `typeof import('x')` and `import('x').T`.
      TSImportType: (node) => check(node.source)
    }
  }
}

export default importDirection
