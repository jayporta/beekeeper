import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { QueryProvider } from './app/QueryProvider'
import { reactErrorHandlers } from './app/reactErrorHandlers'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('index.html has no #root element')

createRoot(rootElement, reactErrorHandlers).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </AppErrorBoundary>
  </StrictMode>
)
