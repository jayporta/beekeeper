import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from '@electron-toolkit/eslint-config-ts'
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import importDirection from '../importDirection.mjs'
import { importDirectionPolicy } from '../importDirectionPolicy.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const at = (path: string): string => resolve(repoRoot, path)

const options = [importDirectionPolicy]

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, sourceType: 'module' }
})

const forbidden = [{ messageId: 'forbiddenFolder' as const }]

ruleTester.run('importDirection', importDirection, {
  valid: [
    {
      name: 'core reaches its own nested shared folder',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { x } from '../shared/errorCode'",
      options
    },
    {
      name: 'core file two levels deep reaches src/core/shared',
      filename: at('src/core/git/nested/run.ts'),
      code: "import { x } from '../../shared/errorCode'",
      options
    },
    {
      name: 'core imports a Node built-in',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { readFile } from 'node:fs/promises'",
      options
    },
    {
      name: 'core imports a package that only shares a prefix with a banned one',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { x } from 'electronic'",
      options
    },
    {
      name: 'renderer imports itself through the alias',
      filename: at('src/renderer/src/features/a/A.tsx'),
      code: "import { x } from '@renderer/i18n/formats'",
      options
    },
    {
      name: 'renderer imports the shared contract through a src-rooted path',
      filename: at('src/renderer/src/features/a/useA.ts'),
      code: "import type { T } from 'src/shared/ipc/contract'",
      options
    },
    {
      name: 'renderer imports the shared contract',
      filename: at('src/renderer/src/features/a/useA.ts'),
      code: "import { x } from '../../../../shared/ipc/contract'",
      options
    },
    {
      name: 'main imports core and shared',
      filename: at('src/main/ipc/guardIpc.ts'),
      code: "import { a } from '../../core/shared/errorCode'\nimport { b } from '../../shared/ipc/ipcResult'",
      options
    },
    {
      name: 'preload imports shared',
      filename: at('src/preload/index.ts'),
      code: "import { b } from '../shared/ipc/ipcResult'",
      options
    },
    {
      name: 'main imports a file outside src',
      filename: at('src/main/index.ts'),
      code: "import icon from '../../resources/icon.png?asset'",
      options
    },
    {
      name: 'a file outside src is not checked',
      filename: at('electron.vite.config.ts'),
      code: "import { x } from './src/renderer/src/a'",
      options
    },
    {
      name: 'a type import of an allowed folder',
      filename: at('src/main/index.ts'),
      code: "import type { T } from '../shared/ipc/ipcResult'",
      options
    },
    {
      name: 'a dynamic import with a template literal holding an expression is skipped',
      filename: at('src/core/transcript/parse.ts'),
      code: 'const m = await import(`../../main/${name}`)',
      options
    },
    {
      name: 'a dynamic import with a computed source is skipped',
      filename: at('src/core/transcript/parse.ts'),
      code: 'const m = await import(name)',
      options
    },
    {
      name: 'no options means no restrictions',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { x } from '../../main/index'",
      options: [{}]
    }
  ],
  invalid: [
    {
      name: 'core imports the top-level shared folder',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { x } from '../../shared/ipc/ipcResult'",
      options,
      errors: forbidden
    },
    {
      name: 'core imports electron',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { app } from 'electron'",
      options,
      errors: [{ messageId: 'forbiddenPackage' }]
    },
    {
      name: 'core imports an electron subpath',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { x } from 'electron/main'",
      options,
      errors: [{ messageId: 'forbiddenPackage' }]
    },
    {
      name: 'core imports main',
      filename: at('src/core/git/run.ts'),
      code: "import { x } from '../../main/index'",
      options,
      errors: forbidden
    },
    {
      name: 'renderer imports core',
      filename: at('src/renderer/src/features/a/A.tsx'),
      code: "import { x } from '../../../../core/transcript/parse'",
      options,
      errors: forbidden
    },
    {
      name: 'renderer imports main',
      filename: at('src/renderer/src/features/a/A.tsx'),
      code: "import { x } from '../../../../main/index'",
      options,
      errors: forbidden
    },
    {
      name: 'renderer imports preload',
      filename: at('src/renderer/src/features/a/A.tsx'),
      code: "import { x } from '../../../../preload/index'",
      options,
      errors: forbidden
    },
    {
      name: 'main imports renderer through a relative path',
      filename: at('src/main/index.ts'),
      code: "import { x } from '../renderer/src/main'",
      options,
      errors: forbidden
    },
    {
      name: 'main imports renderer through the alias',
      filename: at('src/main/index.ts'),
      code: "import { x } from '@renderer/i18n/formats'",
      options,
      errors: forbidden
    },
    {
      name: 'core imports renderer through the alias',
      filename: at('src/core/transcript/parse.ts'),
      code: "import { x } from '@renderer/i18n/formats'",
      options,
      errors: forbidden
    },
    {
      name: 'preload imports renderer through the alias',
      filename: at('src/preload/index.ts'),
      code: "import { x } from '@renderer/i18n/formats'",
      options,
      errors: forbidden
    },
    {
      name: 'renderer imports core through a src-rooted path',
      filename: at('src/renderer/src/features/a/useA.ts'),
      code: "import type { T } from 'src/core/transcript/parse'",
      options,
      errors: forbidden
    },
    {
      name: 'main imports renderer through a src-rooted path',
      filename: at('src/main/index.ts'),
      code: "import { x } from 'src/renderer/src/main'",
      options,
      errors: forbidden
    },
    {
      name: 'main imports preload',
      filename: at('src/main/index.ts'),
      code: "import { x } from '../preload/index'",
      options,
      errors: forbidden
    },
    {
      name: 'preload imports main',
      filename: at('src/preload/index.ts'),
      code: "import { x } from '../main/index'",
      options,
      errors: forbidden
    },
    {
      name: 'preload imports core',
      filename: at('src/preload/index.ts'),
      code: "import { x } from '../core/shared/errorCode'",
      options,
      errors: forbidden
    },
    {
      name: 'preload imports renderer',
      filename: at('src/preload/index.ts'),
      code: "import { x } from '../renderer/src/main'",
      options,
      errors: forbidden
    },
    {
      name: 'shared imports core',
      filename: at('src/shared/ipc/contract.ts'),
      code: "import { x } from '../../core/shared/errorCode'",
      options,
      errors: forbidden
    },
    {
      name: 'shared imports main',
      filename: at('src/shared/ipc/contract.ts'),
      code: "import { x } from '../../main/index'",
      options,
      errors: forbidden
    },
    {
      name: 'a type-only import is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: "import type { T } from '../../shared/ipc/ipcResult'",
      options,
      errors: forbidden
    },
    {
      name: 'a side-effect import is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: "import '../../main/index'",
      options,
      errors: forbidden
    },
    {
      name: 'a dynamic import is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: "const m = await import('../../main/index')",
      options,
      errors: forbidden
    },
    {
      name: 'a dynamic import with a plain template literal is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: 'const m = await import(`../../main/index`)',
      options,
      errors: forbidden
    },
    {
      name: 'a dynamic import of a banned package is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: "const m = await import('electron')",
      options,
      errors: [{ messageId: 'forbiddenPackage' }]
    },
    {
      name: 'an export-all re-export is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: "export * from '../../shared/ipc/ipcResult'",
      options,
      errors: forbidden
    },
    {
      name: 'a named re-export is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: "export { x } from '../../shared/ipc/ipcResult'",
      options,
      errors: forbidden
    },
    {
      name: 'a type-position import() is checked',
      filename: at('src/core/transcript/parse.ts'),
      code: "type T = import('../../main/index').Foo",
      options,
      errors: forbidden
    }
  ]
})
