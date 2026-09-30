import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useState } from 'react'
import { idbStorage } from '@renderer/storage/idbStorage'
import { createQueryClient, PERSIST_MAX_AGE_MS } from './queryClient'
import { shouldPersistQuery } from './shouldPersistQuery'

const persister = createAsyncStoragePersister({ storage: idbStorage, key: 'beekeeper-query-cache' })

const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE_MS,
  buster: __IPC_CONTRACT_HASH__,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery }
}

/** Props for {@link QueryProvider}. */
interface QueryProviderProps {
  /** The app subtree that reads queries. */
  readonly children: React.ReactNode
}

/**
 * Provides the query client, backed by an IndexedDB cache so the app opens
 * with its last project and session lists and refreshes them in the
 * background. The cache is discarded when the IPC contract changes.
 *
 * @example
 * <QueryProvider><App /></QueryProvider>
 */
export function QueryProvider({ children }: QueryProviderProps): React.JSX.Element {
  const [client] = useState(createQueryClient)

  return (
    <PersistQueryClientProvider client={client} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  )
}
