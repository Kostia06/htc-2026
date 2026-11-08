import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './app/App'
import { AppProvider } from './app/AppProvider'
import './styles/tokens.css'
import './styles/glass.css'
import './styles/base.css'
import './ui/ui.css'
import './app/app.css'

// Routes are written without the /app prefix; the basename follows Vite's `base` so the two can't drift apart.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
