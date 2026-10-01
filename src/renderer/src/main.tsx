import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { QueryProvider } from './app/QueryProvider'
import { reactErrorHandlers } from './app/reactErrorHandlers'
import { i18n } from './i18n/i18n'

document.documentElement.lang = i18n.language

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
