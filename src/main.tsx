import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/main.css'
import App from './App.tsx'
import { checkEnvVars } from './utils/envCheck'

// Verificar variables de entorno al inicio
checkEnvVars();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
