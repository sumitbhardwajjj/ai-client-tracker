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

// Overall client status shown on the dashboard (metric cards, filters, badge).
// computeContractStatus() only looks at contract_end, which monthly-billing
// clients don't have — so on its own it can never flag a monthly client as
// Overdue, even with a genuinely overdue unpaid invoice. This wraps it so
// monthly clients are judged by their current invoice instead. (Monthly
// billing has no natural "Renewal" moment the way an annual contract does,
// so monthly clients only resolve to Active or Overdue here.)
export function computeClientStatus(client) {
  if (client?.billing_cycle === 'monthly') {
    const inv = getCurrentInvoice(client)
    if (!inv || inv.status === 'Paid') return 'Active'
    const days = daysFromToday(inv.period_end)
    if (days !== null && days < 0) return 'Overdue'
    return 'Active'
  }
  return computeContractStatus(client)
}

// ── Monthly billing (recurring invoice periods) ────────────────────────────
// A client on billing_cycle: 'monthly' has an `invoices` array, each entry:
// { id, period_start, period_end, amount, status: 'Pending'|'Paid', paid_at }

export function getCurrentInvoice(client) {
  const invoices = client?.invoices || []
  if (!invoices.length) return null
  const unpaid = invoices
    .filter(i => i.status !== 'Paid')
    .sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
  return unpaid[0] || invoices[invoices.length - 1]
}

export function computeInvoiceStatus(client) {
  if (client?.billing_cycle === 'monthly') {
    const inv = getCurrentInvoice(client)
    if (!inv) return 'Pending'
    if (inv.status === 'Paid') return 'Paid'
    const days = daysFromToday(inv.period_end)
    if (days !== null && days < 0) return 'Overdue'
    return 'Pending'
  }
  if (client?.invoice_status === 'Paid') return 'Paid'
  const days = daysFromToday(client?.contract_end)
  if (days !== null && days < 0) return 'Overdue'
  return client?.invoice_status || 'Pending'
}

export function daysUntilContractEnd(client) {
  return daysFromToday(client?.contract_end)
}
