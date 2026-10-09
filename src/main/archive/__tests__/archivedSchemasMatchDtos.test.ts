import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type { AgentNodeDto, AgentReportDto } from '../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { archivedAgentReportSchema } from '../archivedAgentReportSchema'
import { archivedAgentNodeSchema } from '../archivedAgentTreeSchema'
import { archivedDetailSchema } from '../archivedDetailSchema'
import { archivedListItemSchema } from '../archivedListItemSchema'

/**
 * What a schema accepts, without the index signature a loose object adds at
 * each level, so a DTO interface can be compared with it.
 */
type Accepted<T> = T extends readonly (infer Item)[]
  ? readonly Accepted<Item>[]
  : T extends object
    ? { [K in keyof T as string extends K ? never : K]: Accepted<T[K]> }
    : T

/**
 * `true` when `Schema` accepts every value of `Dto`. The compiler rejects the
 * type arguments otherwise, naming the property that differs.
 */
type Accepts<Dto extends Accepted<z.infer<Schema>>, Schema extends z.ZodType> = Dto extends Dto
  ? true
  : never

/** A list item as the archive holds it: only an item with a readable summary is written. */
type ArchivableListItem = Omit<SessionListItemDto, 'summary'> & {
  readonly summary: Extract<SessionListItemDto['summary'], { readonly ok: true }>
}

// These are compile-time checks: the tests pass at run time, and `npm run typecheck`
// fails when a DTO gains a value its schema rejects, which would drop every archived
// row written with it.
describe('the archive schemas', () => {
  it('accept every value an agent report can hold', () => {
    const accepts: Accepts<AgentReportDto, typeof archivedAgentReportSchema> = true

    expect(accepts).toBe(true)
  })

  it('accept every value an agent tree node can hold', () => {
    const accepts: Accepts<AgentNodeDto, typeof archivedAgentNodeSchema> = true

    expect(accepts).toBe(true)
  })

  it('accept every value a session detail can hold', () => {
    const accepts: Accepts<SessionDetailDto, typeof archivedDetailSchema> = true

    expect(accepts).toBe(true)
  })

  it('accept every value a list item with a readable summary can hold', () => {
    const accepts: Accepts<ArchivableListItem, typeof archivedListItemSchema> = true

    expect(accepts).toBe(true)
  })
})
