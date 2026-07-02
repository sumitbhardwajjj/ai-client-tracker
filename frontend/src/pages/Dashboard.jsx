import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import MetricCard from '../components/MetricCard'
import { getClients, bulkDeleteClients } from '../lib/api'
import { computeClientStatus, computeInvoiceStatus, getCurrentInvoice } from '../lib/status'
import { Search, UserPlus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const FILTERS = ['All', 'Active', 'Renewal', 'Overdue']
const PAGE_SIZE = 25

export default function Dashboard() {
  const [clients, setClients]   = useState([])
  const [filter, setFilter]     = useState('All')
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage]         = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getClients()
      .then(r => setClients(Array.isArray(r.data) ? r.data : []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }, [])

  // Typing shouldn't re-filter/re-render the whole table on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [filter, debouncedSearch])

  // Each client's status only needs computing once per data change, not
  // once per filter check, once per metric count, and once per render.
  const withStatus = useMemo(() => (
    clients.map(c => ({
      client: c,
      status: computeClientStatus(c),
      invoiceStatus: computeInvoiceStatus(c),
    }))
  ), [clients])

  const total   = withStatus.length
  const active  = withStatus.filter(c => c.status === 'Active').length
  const renewal = withStatus.filter(c => c.status === 'Renewal').length
  const overdue = withStatus.filter(c => c.status === 'Overdue').length

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return withStatus.filter(({ client: c, status }) =>
      (filter === 'All' || status === filter) &&
      (c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
    )
  }, [withStatus, filter, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const allFilteredSelected = filtered.length > 0 && filtered.every(({ client: c }) => selectedIds.has(c.id))

  const toggleOne = (id, e) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(prev => {
      if (allFilteredSelected) {
        const next = new Set(prev)
        filtered.forEach(({ client: c }) => next.delete(c.id))
        return next
      }
      const next = new Set(prev)
      filtered.forEach(({ client: c }) => next.add(c.id))
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    if (!count) return
    if (!confirm(`Delete ${count} client${count === 1 ? '' : 's'}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await bulkDeleteClients([...selectedIds])
      setClients(prev => prev.filter(c => !selectedIds.has(c.id)))
      clearSelection()
    } catch (err) {
      alert(err.message || 'Failed to delete selected clients')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Layout
      title="Clients"
      subtitle="Track contracts, invoices and follow-ups"
      action={
        <button className="btn btn-primary" onClick={() => navigate('/add-client')}>
          <UserPlus size={15} /> Add Client
        </button>
      }
    >
      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom: 28 }}>
        <MetricCard label="Total"        value={total}   icon="⬡" />
        <MetricCard label="Active"       value={active}  icon="✓" color="var(--green)"  sub="Currently engaged" />
        <MetricCard label="Renewal due"  value={renewal} icon="↻" color="var(--amber)"  sub="Action needed" />
        <MetricCard label="Overdue"      value={overdue} icon="!" color="var(--red)"    sub="Urgent follow-up" />
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', marginBottom: 12, borderRadius: 10,
          background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.25)',
        }}>
          <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>
            {selectedIds.size} client{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={clearSelection} disabled={deleting}>
              Cancel
            </button>
            <button className="btn btn-danger" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={handleBulkDelete} disabled={deleting}>
              <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete selected'}
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div className="dashboard-toolbar" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          gap: 16, flexWrap: 'wrap',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 14px', borderRadius: 7,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: 'none', transition: 'all .15s',
                  background: filter === f ? 'var(--blue)' : 'transparent',
                  color: filter === f ? '#fff' : 'var(--text-3)',
                  boxShadow: filter === f ? '0 0 10px var(--blue-glow)' : 'none',
                }}
              >{f}</button>
            ))}
          </div>
          {/* Search */}
          <div className="search-input" style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              className="input"
              placeholder="Search clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            No clients found.{' '}
            <span
              style={{ color: 'var(--blue)', cursor: 'pointer' }}
              onClick={() => navigate('/add-client')}
            >Add one →</span>
          </div>
        ) : (
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} onClick={e => e.stopPropagation()} />
                </th>
                <th>Client</th>
                <th>Status</th>
                <th>Contract ends</th>
                <th>Invoice</th>
                <th>Last contact</th>
                <th>Value / yr</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(({ client: c, status, invoiceStatus }) => (
                <tr key={c.id} onClick={() => navigate(`/client/${c.id}`)}>
                  <td>
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={e => toggleOne(c.id, e)} onClick={e => e.stopPropagation()} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: (c.color || 'var(--blue)') + (c.color ? '22' : ''),
                        color: c.color || 'var(--badge-blue-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-head)',
                      }}>
                        {c.initials || c.name.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={status} /></td>
                  <td>{c.contract_end || getCurrentInvoice(c)?.period_end || '—'}</td>
                  <td><StatusBadge status={invoiceStatus} /></td>
                  <td style={{ color: 'var(--text-3)' }}>{c.last_contact || '—'}</td>
                  <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                    {c.contract_value || getCurrentInvoice(c)?.amount || '—'}
                    {c.billing_cycle === 'monthly' && <span style={{ fontSize: 10, color: 'var(--text-3)' }}> /mo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {!loading && filtered.length > PAGE_SIZE && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--border)',
            fontSize: 12.5, color: 'var(--text-3)',
          }}>
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 9px' }}
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              >
                <ChevronLeft size={13} />
              </button>
              <span>{page} / {totalPages}</span>
              <button
                className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 9px' }}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
