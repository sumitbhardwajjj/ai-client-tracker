import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getUsers, createUser, deleteUser } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { UserPlus, Trash2, AlertTriangle } from 'lucide-react'

export default function Team() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const { user: currentUser } = useAuth()

  const load = () => {
    getUsers()
      .then(({ data }) => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await createUser(form)
      setForm({ name: '', email: '', password: '' })
      load()
    } catch (err) {
      setError(err.message || 'Failed to add teammate')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id) => {
    if (!confirm("Remove this teammate's account? They will be signed out immediately.")) return
    setRemovingId(id)
    try {
      await deleteUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      alert(err.message || 'Failed to remove account')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Layout title="Team" subtitle="Manage who can log in to this workspace">
      <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
        <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>
          Add a teammate
        </h3>
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14,
            background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--red)',
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input" placeholder="Name" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <input
            className="input" type="email" placeholder="Email" required value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
          />
          <input
            className="input" type="password" placeholder="Password (min. 8 characters)" required minLength={8} value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
          />
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            <UserPlus size={15} /> {saving ? 'Adding...' : 'Add teammate'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 640 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Loading...</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text-1)' }}>
                      {u.name || '—'}{u.id === currentUser?.id && <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}> (you)</span>}
                    </td>
                    <td style={{ color: 'var(--text-3)' }}>{u.email}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: '5px 9px' }}
                        onClick={() => handleRemove(u.id)}
                        disabled={removingId === u.id}
                        title="Remove account"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
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
