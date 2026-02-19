import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Scene from './Scene.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* <Scene /> */}
  </StrictMode>,
)
