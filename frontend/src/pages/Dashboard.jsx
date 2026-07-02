import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import MetricCard from '../components/MetricCard'
import { getClients } from '../lib/api'
import { Search, UserPlus } from 'lucide-react'

const FILTERS = ['All', 'Active', 'Renewal', 'Overdue']

export default function Dashboard() {
  const [clients, setClients]   = useState([])
  const [filter, setFilter]     = useState('All')
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getClients()
      .then(r => setClients(r.data))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = clients
    .filter(c => filter === 'All' || c.status === filter)
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) ||
                 c.email?.toLowerCase().includes(search.toLowerCase()))

  const total   = clients.length
  const active  = clients.filter(c => c.status === 'Active').length
  const renewal = clients.filter(c => c.status === 'Renewal').length
  const overdue = clients.filter(c => c.status === 'Overdue').length

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
                <th>Client</th>
                <th>Status</th>
                <th>Contract ends</th>
                <th>Invoice</th>
                <th>Last contact</th>
                <th>Value / yr</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => navigate(`/client/${c.id}`)}>
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
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.contract_end || '—'}</td>
                  <td><StatusBadge status={c.invoice_status} /></td>
                  <td style={{ color: 'var(--text-3)' }}>{c.last_contact || '—'}</td>
                  <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{c.contract_value || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
