import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard    from './pages/Dashboard'
import ClientDetail from './pages/ClientDetail'
import AddClient    from './pages/AddClient'
import Chatbot      from './pages/Chatbot'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Dashboard />}    />
        <Route path="/client/:id"  element={<ClientDetail />} />
        <Route path="/add-client"  element={<AddClient />}    />
        <Route path="/chat"        element={<Chatbot />}      />
      </Routes>
    </BrowserRouter>
  )
}
