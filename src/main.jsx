import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { builder } from '@builder.io/react'
import './index.css'
import App from './App.jsx'
import WaveformAnalyzer from './tools/WaveformAnalyzer.jsx'

builder.init(import.meta.env.VITE_BUILDER_API_KEY)

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/analyzer', element: <WaveformAnalyzer /> },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
