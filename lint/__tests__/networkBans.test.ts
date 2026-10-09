import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const eslint = new ESLint({ cwd: repoRoot })

/** The rules that reported on `code` linted as if it lived at `path`. */
async function reportedRules(path: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(repoRoot, path) })
  return (result?.messages ?? []).flatMap((message) => (message.ruleId ? [message.ruleId] : []))
}

const OTEL_FILE = 'src/main/otel/probe.ts'
const OTHER_FILE = 'src/main/probe.ts'

describe('network bans', () => {
  it.each(['node:http', 'http'])(
    'allows createServer and the server types from %s in the telemetry receiver folder',
    async (module) => {
      const rules = await reportedRules(
        OTEL_FILE,
        `import { createServer, type Server } from '${module}'\nimport type { IncomingMessage, ServerResponse } from '${module}'\nexport const s = [createServer, {} as Server, {} as IncomingMessage, {} as ServerResponse]\n`
      )

      expect(rules).not.toContain('no-restricted-imports')
    }
  )

  it.each([
    "import { request } from 'node:http'",
    "import { get } from 'node:http'",
    "import { request } from 'http'",
    "import { Agent } from 'node:http'",
    "import { ClientRequest } from 'node:http'",
    "import { createServer, request } from 'node:http'",
    "import * as http from 'node:http'",
    "import http from 'node:http'",
    "export { request } from 'node:http'",
    "export * from 'node:http'"
  ])('bans outbound http in a receiver source file: %s', async (statement) => {
    const rules = await reportedRules(OTEL_FILE, `${statement}\n`)

    expect(rules).toContain('no-restricted-imports')
  })

  it.each([
    ['a test', 'src/main/otel/__tests__/probe.test.ts'],
    ['a test helper', 'src/main/otel/testProbe.ts']
  ])('allows request from node:http in %s', async (_label, path) => {
    const rules = await reportedRules(
      path,
      "import { request, type IncomingHttpHeaders } from 'node:http'\nexport const s = [request, {} as IncomingHttpHeaders]\n"
    )

    expect(rules).not.toContain('no-restricted-imports')
  })

  it('still bans node:https in a receiver test', async () => {
    const rules = await reportedRules(
      'src/main/otel/__tests__/probe.test.ts',
      "import { request } from 'node:https'\nexport const s = request\n"
    )

    expect(rules).toContain('no-restricted-imports')
  })

  it.each(['node:http', 'http'])(
    'bans %s outside the telemetry receiver folder',
    async (module) => {
      const rules = await reportedRules(
        OTHER_FILE,
        `import { createServer } from '${module}'\nexport const s = createServer\n`
      )

      expect(rules).toContain('no-restricted-imports')
    }
  )

  it.each([
    'node:https',
    'https',
    'node:net',
    'net',
    'node:tls',
    'tls',
    'node:dgram',
    'dgram',
    'node:http2',
    'http2'
  ])('still bans %s in the telemetry receiver folder', async (module) => {
    const rules = await reportedRules(
      OTEL_FILE,
      `import * as m from '${module}'\nexport const s = m\n`
    )

    expect(rules).toContain('no-restricted-imports')
  })

  it('still bans the electron net module in the telemetry receiver folder', async () => {
    const rules = await reportedRules(
      OTEL_FILE,
      "import { net } from 'electron'\nexport const s = net\n"
    )

    expect(rules).toContain('no-restricted-imports')
  })

  it('allows other electron imports in the telemetry receiver folder', async () => {
    const rules = await reportedRules(
      OTEL_FILE,
      "import { app } from 'electron'\nexport const s = app\n"
    )

    expect(rules).not.toContain('no-restricted-imports')
  })

  it.each(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'])(
    'still bans the %s global in the telemetry receiver folder',
    async (name) => {
      const rules = await reportedRules(OTEL_FILE, `export const s = ${name}\n`)

      expect(rules).toContain('no-restricted-globals')
    }
  )
})
