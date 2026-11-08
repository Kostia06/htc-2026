import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'
import { installEmulatorIfAsked } from './emulator.js'

// The emulator has to replace navigator.xr before the app first asks it
// whether VR is supported.
installEmulatorIfAsked().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
