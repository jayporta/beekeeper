import { z } from 'zod'

/** The meta fields the detail views read, which are text where they read text. */
const agentMetaSchema = z.looseObject({
  agentType: z.string(),
  description: z.string().optional(),
  model: z.string().optional(),
  name: z.string().optional(),
  teamName: z.string().optional(),
  worktreeBranch: z.string().optional(),
  spawnDepth: z.number().optional(),
  stoppedByUser: z.boolean().optional()
})

const metaStatusSchema = z.discriminatedUnion('status', [
  z.looseObject({ status: z.literal('ok'), meta: agentMetaSchema }),
  z.looseObject({ status: z.literal('absent') }),
  z.looseObject({ status: z.literal('error') })
])

/** One tree node without its descendants, which {@link hasValidNodes} checks in turn. */
export const archivedAgentNodeSchema = z.looseObject({
  agentId: z.string().nullable(),
  meta: metaStatusSchema,
  workflowRunId: z.string().nullable(),
  children: z.array(z.unknown())
})

/**
 * Whether `root` and every node below it have the shape of an agent node.
 * It walks the tree with a stack, like the views that read it.
 */
function hasValidNodes(root: unknown): boolean {
  const pending: unknown[] = [root]
  while (pending.length > 0) {
    const parsed = archivedAgentNodeSchema.safeParse(pending.pop())
    if (!parsed.success) return false
    for (const child of parsed.data.children) pending.push(child)
  }
  return true
}

/**
 * An archived agent tree: every node, at any depth, carries what the detail
 * views read. The check doesn't recurse, so a deep spawn chain that was
 * written can also be read back.
 */
export const archivedAgentTreeSchema = z.unknown().refine(hasValidNodes, {
  message: 'must be an agent tree'
})
