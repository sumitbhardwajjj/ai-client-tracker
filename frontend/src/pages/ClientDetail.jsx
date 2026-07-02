import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { getClient, addContactLog, deleteClient, updateClient, addInvoice, markInvoicePaid } from '../lib/api'
import { computeContractStatus, computeInvoiceStatus, daysUntilContractEnd } from '../lib/status'
import { ArrowLeft, Pencil, Trash2, Send, CheckCircle2 } from 'lucide-react'

// Module-scope so it keeps a stable identity across renders (doesn't lose
// input focus on every keystroke like a component redefined per-render would).
function EditField({ label, value, onChange, type = 'text', placeholder, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-3)',
        letterSpacing: '.04em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children || (
        <input
          className="input"
          type={type}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={onChange}
        />
      )}
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [c, setC]           = useState(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)

  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [markingId, setMarkingId] = useState(null)
  const [showStartMonthly, setShowStartMonthly] = useState(false)
  const [periodForm, setPeriodForm] = useState({ period_start: '', period_end: '', amount: '', paid: false })
  const [periodSaving, setPeriodSaving] = useState(false)
  const [periodError, setPeriodError] = useState('')

  useEffect(() => {
    getClient(id)
      .then(r => setC(r.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id])

  const logContact = async () => {
    if (!note.trim()) return
    setSaving(true)
    const { data } = await addContactLog(id, note)
    setC(data)
    setNote('')
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return
    await deleteClient(id)
    navigate('/')
  }

  const startEditing = () => {
    setEditForm({
      name: c.name || '',
      contact: c.contact || '',
      email: c.email || '',
      phone: c.phone || '',
      contract_end: c.contract_end || '',
      contract_value: c.contract_value || '',
      invoice_status: c.invoice_status || 'Pending',
      invoice_amount: c.invoice_amount || '',
      notes: c.notes || '',
    })
    setEditError('')
    setEditing(true)
  }

  const setField = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }))

  const saveEdit = async () => {
    if (!editForm.name.trim()) {
      setEditError('Client name is required')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      const { data } = await updateClient(id, editForm)
      setC(data)
      setEditing(false)
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setEditSaving(false)
    }
  }

  const handleMarkPaid = async (invoiceId) => {
    setMarkingId(invoiceId)
    try {
      const { data } = await markInvoicePaid(id, invoiceId)
      setC(data)
    } finally {
      setMarkingId(null)
    }
  }

  const startMonthlyBilling = async () => {
    if (!periodForm.period_start || !periodForm.period_end) {
      setPeriodError('Start and end dates are required')
      return
    }
    setPeriodSaving(true)
    setPeriodError('')
    try {
      const { data } = await addInvoice(id, {
        period_start: periodForm.period_start,
        period_end: periodForm.period_end,
        amount: periodForm.amount,
        status: periodForm.paid ? 'Paid' : 'Pending',
      })
      setC(data)
      setShowStartMonthly(false)
      setPeriodForm({ period_start: '', period_end: '', amount: '', paid: false })
    } catch (err) {
      setPeriodError(err.response?.data?.message || 'Failed to start monthly billing')
    } finally {
      setPeriodSaving(false)
    }
  }

  if (loading) return (
    <Layout>
      <div style={{ padding: 48, color: 'var(--text-3)', textAlign: 'center' }}>Loading…</div>
    </Layout>
  )
  if (!c) return null

  const initials = c.initials || c.name.slice(0, 2).toUpperCase()
  const color    = c.color || '#3B6FF5'
  const isMonthly = c.billing_cycle === 'monthly'
  const invoices = (c.invoices || []).slice().sort((a, b) => new Date(a.period_start) - new Date(b.period_start))

  return (
    <Layout
      title={c.name}
      subtitle={c.email}
      action={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}><ArrowLeft size={15} /> Back</button>
          {!editing && (
            <button className="btn btn-ghost" onClick={startEditing}><Pencil size={15} /> Edit</button>
          )}
          <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={15} /> Delete</button>
        </div>
      }
    >
      {editing ? (
        /* ── Edit form ─────────────────────────────────────────────────── */
        <div className="card fade-up" style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 18 }}>
            Edit Client
          </h3>

          {editError && (
            <div style={{
              background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.25)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              fontSize: 13.5, color: 'var(--red)',
            }}>
              {editError}
            </div>
          )}

          <div className="form-grid">
            <EditField label="Company name" value={editForm.name} onChange={e => setField('name', e.target.value)} />
            <EditField label="Contact person" value={editForm.contact} onChange={e => setField('contact', e.target.value)} />
            <EditField label="Email" type="email" value={editForm.email} onChange={e => setField('email', e.target.value)} />
            <EditField label="Phone" value={editForm.phone} onChange={e => setField('phone', e.target.value)} />
          </div>

          {!isMonthly && (
            <>
              <div style={{
                fontSize: 12.5, color: 'var(--text-3)', margin: '16px 0',
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px',
              }}>
                Client status (Active / Renewal / Overdue) is calculated automatically from the contract end date — no need to set it by hand. Mark an invoice "Paid" once you've received payment; it becomes "Overdue" on its own once the contract end date passes unpaid.
              </div>
              <div className="form-grid">
                <EditField label="Contract value" placeholder="₹80,000/yr" value={editForm.contract_value} onChange={e => setField('contract_value', e.target.value)} />
                <EditField label="Contract end date" type="date" value={editForm.contract_end} onChange={e => setField('contract_end', e.target.value)} />
                <EditField label="Invoice status">
                  <select className="input" value={editForm.invoice_status} onChange={e => setField('invoice_status', e.target.value)}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </EditField>
                <EditField label="Invoice amount" placeholder="₹48,000" value={editForm.invoice_amount} onChange={e => setField('invoice_amount', e.target.value)} />
              </div>
            </>
          )}
          {isMonthly && (
            <div style={{
              fontSize: 12.5, color: 'var(--text-3)', margin: '16px 0',
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              This client is on monthly billing — manage billing periods in the Billing card below instead of here.
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              Notes
            </label>
            <textarea
              className="input"
              rows={4}
              value={editForm.notes}
              onChange={e => setField('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={editSaving}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header card */}
          <div className="card client-header-card fade-up" style={{ marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: color + '22', color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-head)',
              boxShadow: `0 0 20px ${color}33`,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>
                  {c.name}
                </h2>
                <StatusBadge status={computeContractStatus(c)} />
                {isMonthly && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
                    Monthly billing
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                {c.contact && <span>{c.contact} · </span>}
                {c.email}
                {c.phone && <span> · {c.phone}</span>}
              </div>
            </div>
            {!isMonthly && (
              <div className="client-header-value" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-head)', color: 'var(--text-1)' }}>
                  {c.contract_value || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Annual value</div>
              </div>
            )}
          </div>

          {/* Stats row */}
          {!isMonthly && (
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              {[
                {
                  label: 'Contract ends',
                  value: c.contract_end || '—',
                  sub: (() => {
                    const d = daysUntilContractEnd(c)
                    if (d === null) return null
                    if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`
                    if (d === 0) return 'Today'
                    return `in ${d} day${d === 1 ? '' : 's'}`
                  })(),
                  color: computeContractStatus(c) === 'Overdue' ? 'var(--red)' : computeContractStatus(c) === 'Renewal' ? 'var(--amber)' : 'var(--text-1)',
                },
                { label: 'Pending invoice', value: c.invoice_amount || '—', color: 'var(--amber)' },
                { label: 'Last contacted',  value: c.last_contact  || '—', color: 'var(--red)'   },
              ].map(s => (
                <div key={s.label} className="card fade-up" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 17, fontWeight: 600, fontFamily: 'var(--font-head)', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                  {s.sub && <div style={{ fontSize: 11, color: s.color, marginTop: 4 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Two columns */}
          <div className="two-col-grid">
            {/* Contact history */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>
                Contact History
              </h3>
              {(!c.history || c.history.length === 0) ? (
                <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No contacts logged yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {c.history.slice().reverse().map((h, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 14, padding: '10px 0',
                      borderBottom: i < c.history.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 80, paddingTop: 1, flexShrink: 0 }}>
                        {new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{h.note}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Log new contact */}
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  placeholder="Log a new contact note…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && logContact()}
                  style={{ fontSize: 13, flex: 1, minWidth: 160 }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: 13, flexShrink: 0 }}
                  onClick={logContact}
                  disabled={saving || !note.trim()}
                >
                  {saving ? '…' : <><Send size={13} /> Log</>}
                </button>
              </div>
            </div>

            {/* Billing */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
                  {isMonthly ? 'Billing — Monthly Periods' : 'Contract Details'}
                </h3>
                {!isMonthly && !showStartMonthly && (
                  <button
                    type="button"
                    onClick={() => setShowStartMonthly(true)}
                    style={{
                      fontSize: 12, color: 'var(--blue)', background: 'transparent',
                      border: 'none', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    Switch to monthly →
                  </button>
                )}
              </div>

              {!isMonthly && !showStartMonthly && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { label: 'Contract value',  value: c.contract_value  },
                    { label: 'Contract ends',   value: c.contract_end    },
                    { label: 'Invoice status',  value: <StatusBadge status={computeInvoiceStatus(c)} /> },
                    { label: 'Invoice amount',  value: c.invoice_amount  },
                    { label: 'Notes',           value: c.notes          },
                  ].map(({ label, value }) => {
                    const hasValue = value !== undefined && value !== null && value !== ''
                    return hasValue && (
                      <div key={label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', textAlign: 'right' }}>{value}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {!isMonthly && showStartMonthly && (
                <div>
                  {periodError && (
                    <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{periodError}</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <EditField label="Period start" type="date" value={periodForm.period_start} onChange={e => setPeriodForm(p => ({ ...p, period_start: e.target.value }))} />
                    <EditField label="Period end" type="date" value={periodForm.period_end} onChange={e => setPeriodForm(p => ({ ...p, period_end: e.target.value }))} />
                    <EditField label="Amount per period" placeholder="₹15,000/mo" value={periodForm.amount} onChange={e => setPeriodForm(p => ({ ...p, amount: e.target.value }))} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={periodForm.paid} onChange={e => setPeriodForm(p => ({ ...p, paid: e.target.checked }))} />
                      This period is already paid — start the next cycle automatically
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button className="btn btn-primary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={startMonthlyBilling} disabled={periodSaving}>
                      {periodSaving ? 'Saving...' : 'Start monthly billing'}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setShowStartMonthly(false)} disabled={periodSaving}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isMonthly && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoices.map(inv => (
                    <div key={inv.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 10, padding: '10px 12px', borderRadius: 8,
                      background: 'var(--bg-3)', border: '1px solid var(--border)', flexWrap: 'wrap',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
                          {inv.period_start} → {inv.period_end}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                          {inv.amount || '—'}
                          {inv.paid_at && <> · paid {new Date(inv.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
                        </div>
                      </div>
                      {inv.status === 'Paid' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--green)' }}>
                          <CheckCircle2 size={13} /> Paid
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: '6px 12px' }}
                          onClick={() => handleMarkPaid(inv.id)}
                          disabled={markingId === inv.id}
                        >
                          {markingId === inv.id ? '…' : 'Mark Paid'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
