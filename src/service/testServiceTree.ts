import { join } from 'node:path'
import { afterEach, beforeEach } from 'vitest'
import {
  buildAiTitleRecord,
  buildAssistantRecord,
  buildJsonlText
} from '../core/transcript/testFixtures'
import { buildDiscoveryTree, type DiscoveryTree } from '../core/transcript/testDiscoveryTree'
import { createServiceDeps } from './createServiceDeps'
import type { SessionScanCache } from './sessionDetail/sessionScanCache'
import type { ServiceDeps } from './serviceDeps'

/** A synthetic project folder name. */
export const TEST_PROJECT = '-Users-test-proj'
/** A scan cache that never hits, so every scan reaches the scheduler. */
export const NO_SCAN_CACHE: SessionScanCache = { get: () => undefined, set: () => {} }
/** A synthetic session id. */
export const TEST_SESSION_ID = '1a1a1a1a-1111-4111-8111-11111111111b'
/** A meta field no whitelist knows about, to prove it is dropped. */
export const UNKNOWN_META_FIELD = 'futureField'

/** A synthetic `~/.claude` with one project, one session, and one subagent. */
export interface ServiceTestTree extends DiscoveryTree {
  /** Stands in for the user's home directory. */
  readonly home: string
  /** The session transcript's path. */
  readonly sessionPath: string
}

/**
 * Builds a synthetic home directory holding `.claude/projects/<project>/<session>.jsonl`
 * with a title, one assistant message, and one subagent whose meta carries an
 * unknown field.
 * @returns The tree and its paths.
 */
export async function buildServiceTestTree(): Promise<ServiceTestTree> {
  const projectDir = `.claude/projects/${TEST_PROJECT}`
  const tree = await buildDiscoveryTree({
    files: {
      [`${projectDir}/${TEST_SESSION_ID}.jsonl`]: buildJsonlText([
        buildAiTitleRecord('My title'),
        buildAssistantRecord()
      ]),
      [`${projectDir}/${TEST_SESSION_ID}/subagents/agent-a1.jsonl`]: buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_sub' })
      ]),
      [`${projectDir}/${TEST_SESSION_ID}/subagents/agent-a1.meta.json`]: JSON.stringify({
        agentType: 'Explore',
        description: 'look around',
        [UNKNOWN_META_FIELD]: 'must not cross the bridge'
      })
    }
  })
  return {
    ...tree,
    home: tree.root,
    sessionPath: join(tree.root, projectDir, `${TEST_SESSION_ID}.jsonl`)
  }
}

/** The current test's synthetic tree and the service dependencies rooted at it. */
export interface ServiceTestContext {
  /** The current test's tree. */
  readonly tree: ServiceTestTree
  /** Service dependencies whose home is the current test's tree. */
  readonly deps: ServiceDeps
}

/**
 * Builds a fresh {@link ServiceTestTree} and matching {@link ServiceDeps} before each
 * test in the calling file, and removes the tree after it.
 * @returns Getters for the current test's tree and deps.
 * @throws {Error} When a getter is read outside a running test.
 */
export function registerServiceTestTree(): ServiceTestContext {
  let current: ServiceTestContext | undefined

  beforeEach(async () => {
    const tree = await buildServiceTestTree()
    current = { tree, deps: createServiceDeps(join(tree.home, '.claude', 'projects')) }
  })

  afterEach(async () => {
    await current?.tree.cleanup()
    current = undefined
  })

  const get = (): ServiceTestContext => {
    if (current === undefined) throw new Error('registerServiceTestTree read outside a test')
    return current
  }

  return {
    get tree() {
      return get().tree
    },
    get deps() {
      return get().deps
    }
  }
}
