import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Normalize error messages so components can rely on err.message being
// something readable, whether the failure came from the backend, a network
// drop, or something else.
api.interceptors.response.use(
  (res) => {
    // If VITE_API_BASE_URL is misconfigured, requests can land on the
    // frontend's own SPA rewrite rule and come back as index.html with a
    // 200 status instead of a real API error. Treat that as a failure.
    const contentType = res.headers?.['content-type'] || ''
    if (contentType.includes('text/html')) {
      return Promise.reject({
        message: 'Received an HTML page instead of API data — check VITE_API_BASE_URL.',
        response: res,
      })
    }
    return res
  },
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
export const addInvoice    = (id, data) => api.post(`/clients/${id}/invoices`, data)
export const markInvoicePaid = (id, invoiceId) => api.post(`/clients/${id}/invoices/${invoiceId}/mark-paid`)

export default api
