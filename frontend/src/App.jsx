import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'

const Dashboard    = lazy(() => import('./pages/Dashboard'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const AddClient    = lazy(() => import('./pages/AddClient'))
const Chatbot      = lazy(() => import('./pages/Chatbot'))
const Team         = lazy(() => import('./pages/Team'))

function PageFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
      Loading...
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/"            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}    />
            <Route path="/client/:id"  element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="/add-client"  element={<ProtectedRoute><AddClient /></ProtectedRoute>}    />
            <Route path="/chat"        element={<ProtectedRoute><Chatbot /></ProtectedRoute>}      />
            <Route path="/team"        element={<ProtectedRoute><Team /></ProtectedRoute>}         />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
