// Contract/invoice status is now computed automatically from real dates
// instead of being picked by hand — this is the single source of truth for
// that logic so the dashboard, client detail page, chatbot context, and
// bulk import all agree on what "Overdue" / "Renewal" actually mean.

// Days before contract_end that a client starts showing as "Renewal" due.
const RENEWAL_WINDOW_DAYS = 30

function daysFromToday(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

// Client relationship status: Active / Renewal / Overdue
export function computeContractStatus(client) {
  const days = daysFromToday(client?.contract_end)
  if (days === null) return client?.status || 'Active'
  if (days < 0) return 'Overdue'                 // contract has lapsed
  if (days <= RENEWAL_WINDOW_DAYS) return 'Renewal' // renewal coming up soon
  return 'Active'
}

// Invoice status: Paid stays manual (someone has to confirm payment came
// in) — Pending automatically escalates to Overdue once the contract date
// (used as the billing due date) has passed without being marked Paid.
export function computeInvoiceStatus(client) {
  if (client?.invoice_status === 'Paid') return 'Paid'
  const days = daysFromToday(client?.contract_end)
  if (days !== null && days < 0) return 'Overdue'
  return client?.invoice_status || 'Pending'
}

export function daysUntilContractEnd(client) {
  return daysFromToday(client?.contract_end)
}
