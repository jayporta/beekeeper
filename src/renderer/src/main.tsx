import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { QueryProvider } from './app/QueryProvider'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('index.html has no #root element')

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </AppErrorBoundary>
  </StrictMode>
)
