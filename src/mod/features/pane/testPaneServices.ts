import type { IpcResult } from '../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import type { PaneServices } from './refreshPane'

/** A fake {@link PaneServices} that records its calls. */
export interface TestPaneServices extends PaneServices {
  /** How many times `listSessions` was called. */
  listCalls: number
  /** How many times `getSession` was called. */
  getCalls: number
}

/**
 * Builds fake services that answer fixed results, or throw when given an `Error`.
 *
 * @param answers - What each service answers.
 * @returns The services, with call counts.
 */
export function testPaneServices(answers: {
  readonly list: IpcResult<readonly SessionListItemDto[]> | Error
  readonly get: IpcResult<SessionDetailDto> | Error
}): TestPaneServices {
  const services: TestPaneServices = {
    listCalls: 0,
    getCalls: 0,
    listSessions: async () => {
      services.listCalls += 1
      if (answers.list instanceof Error) throw answers.list
      return answers.list
    },
    getSession: async () => {
      services.getCalls += 1
      if (answers.get instanceof Error) throw answers.get
      return answers.get
    }
  }
  return services
}
