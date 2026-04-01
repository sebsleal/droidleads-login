import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PasswordGate from './components/PasswordGate.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { ThemeProvider, applyTheme, getStoredTheme } from './components/ThemeProvider.tsx'

applyTheme(getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordGate>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </PasswordGate>
  </StrictMode>,
)
