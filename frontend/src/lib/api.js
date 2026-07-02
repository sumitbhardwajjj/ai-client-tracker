import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Normalize error messages so components can rely on err.message being
// something readable, whether the failure came from the backend, a network
// drop, or something else.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      (err.request && !err.response ? 'Cannot reach the server. Check your connection and try again.' : 'Something went wrong.')
    err.message = message
    return Promise.reject(err)
  }
)

// ── Clients ──────────────────────────────────────────────────────────────────
export const getClients    = ()       => api.get('/clients')
export const getClient     = (id)     => api.get(`/clients/${id}`)
export const createClient  = (data)   => api.post('/clients', data)
export const bulkImportClients = (clients) => api.post('/clients/bulk', { clients })
export const updateClient  = (id, d)  => api.put(`/clients/${id}`, d)
export const deleteClient  = (id)     => api.delete(`/clients/${id}`)
export const addContactLog = (id, note) => api.post(`/clients/${id}/contact`, { note })

export default api
