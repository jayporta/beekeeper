// @ts-check
const NODE_IMPORT_MESSAGE =
  'core reaches the file system through fileSystem() from src/core/io; only src/core/io/node may import node modules.'

const NODE_GLOBAL_MESSAGE =
  "not available in the mod's runtime; use Uint8Array, an option, or the port"

/**
 * The Node imports core may not make, as the `patterns` option of
 * `no-restricted-imports`: everything behind the `node:` prefix.
 *
 * @type {{ group: string[], message: string }[]}
 */
export const coreBannedImportPatterns = [{ group: ['node:*'], message: NODE_IMPORT_MESSAGE }]

/**
 * The built-in modules core could reach without the `node:` prefix, as the
 * `paths` option of `no-restricted-imports`.
 *
 * @type {{ name: string, message: string }[]}
 */
export const coreBannedImportPaths = [
  'fs',
  'fs/promises',
  'path',
  'os',
  'child_process',
  'buffer',
  'util',
  'stream'
].map((name) => ({ name, message: NODE_IMPORT_MESSAGE }))

/**
 * The Node globals core may not use, as `no-restricted-globals` entries.
 * `setTimeout` stays allowed: the mod's runtime has it.
 *
 * @type {{ name: string, message: string }[]}
 */
export const coreBannedGlobals = [
  'Buffer',
  'process',
  'setImmediate',
  '__dirname',
  '__filename',
  'require',
  'global'
].map((name) => ({ name, message: NODE_GLOBAL_MESSAGE }))
