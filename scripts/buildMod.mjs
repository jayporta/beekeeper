// Builds the Claude Code mod from src/mod into mod/hooks. Run from the repo root.
import { build } from 'esbuild'

const common = { format: 'esm', platform: 'neutral', target: 'es2023', logLevel: 'warning' }

// lib.js bundles core, service, shared and i18next. It never sees `$`, only the ModHost register.js hands it.
const lib = await build({
  ...common,
  entryPoints: ['src/mod/lib.ts'],
  bundle: true,
  outfile: 'mod/hooks/lib.js',
  mainFields: ['module', 'main'],
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  legalComments: 'eof',
  metafile: true
})

// register.js is transpiled, not bundled: the engine's validator reads its `$` calls.
await build({
  ...common,
  entryPoints: ['src/mod/register.ts'],
  bundle: false,
  outfile: 'mod/hooks/register.js'
})

const [output] = Object.values(lib.metafile.outputs)
const banned = Object.keys(output?.inputs ?? {}).filter((input) =>
  /^node:|^src\/(main|preload|renderer)\//.test(input)
)
if (banned.length > 0) {
  console.error(`The mod bundle pulled in code it must not contain:\n${banned.join('\n')}`)
  process.exit(1)
}
console.log(`mod/hooks/lib.js ${((output?.bytes ?? 0) / 1024).toFixed(1)} KB`)
