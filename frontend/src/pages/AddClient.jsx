import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import BulkImport from '../components/BulkImport'
import { createClient } from '../lib/api'
import { UserPlus, Upload, CheckCircle2 } from 'lucide-react'

const COLOR_OPTIONS = [
  { label: 'Blue', value: '#3B6FF5' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Cyan', value: '#06B6D4' },
]

const INITIAL = {
  name: '',
  email: '',
  phone: '',
  contact: '',
  contractEnd: '',
  contractValue: '',
  invoiceStatus: 'Pending',
  invoiceAmount: '',
  color: '#3B6FF5',
  notes: '',
}

// Defined OUTSIDE AddClient so React keeps the same component identity across
// renders. Previously this was declared inside AddClient(), which meant a new
// Field function (and therefore a new <input>) was created on every render —
// React would unmount and remount the input on every keystroke, so it lost
// focus after each character.
function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  value,
  error,
  onChange,
  children,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-3)',
          letterSpacing: '.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}{' '}
        {required && <span style={{ color: 'var(--red)' }}>*</span>}
      </label>

      {children || (
        <input
          className="input"
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          style={error ? { borderColor: 'var(--red)' } : {}}
        />
      )}

      {error && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--red)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

export default function AddClient() {
  const [mode, setMode] = useState('single') // 'single' | 'bulk'
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const navigate = useNavigate()

  const set = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const validate = () => {
    const e = {}

    if (!form.name.trim()) {
      e.name = 'Client name is required'
    }

    if (!form.email.trim()) {
      e.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      e.email = 'Invalid email'
    }

    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errs = validate()

    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setErrors({})
    setSaving(true)

    try {
      await createClient({
        name: form.name,
        initials: form.name
          .split(' ')
          .map(w => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        contact: form.contact,
        email: form.email,
        phone: form.phone,
        contract_end: form.contractEnd,
        contract_value: form.contractValue,
        invoice_status: form.invoiceStatus,
        invoice_amount: form.invoiceAmount,
        color: form.color,
        notes: form.notes,
      })

      setSuccess(true)

      setTimeout(() => {
        navigate('/')
      }, 1200)
    } catch (err) {
      setErrors({
        submit:
          err.response?.data?.message ||
          'Failed to save. Is the backend running?',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout
      title="Add Client"
      subtitle="Add a new client to your tracker"
    >
      <div style={{ maxWidth: 700 }}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-3)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
          <button
            type="button"
            onClick={() => setMode('single')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, transition: 'all .15s',
              background: mode === 'single' ? 'var(--blue)' : 'transparent',
              color: mode === 'single' ? '#fff' : 'var(--text-2)',
            }}
          >
            <UserPlus size={14} /> Single client
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, transition: 'all .15s',
              background: mode === 'bulk' ? 'var(--blue)' : 'transparent',
              color: mode === 'bulk' ? '#fff' : 'var(--text-2)',
            }}
          >
            <Upload size={14} /> Bulk import
          </button>
        </div>

        {mode === 'bulk' ? (
          <BulkImport onDone={() => navigate('/')} />
        ) : (
        <>
        {success && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--green-bg)',
              border: '1px solid rgba(16,185,129,.25)',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: 13.5,
              color: 'var(--green)',
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={16} /> Client added successfully! Redirecting…
          </div>
        )}

        {errors.submit && (
          <div
            style={{
              background: 'var(--red-bg)',
              border: '1px solid rgba(239,68,68,.25)',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: 13.5,
              color: 'var(--red)',
            }}
          >
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-1)',
                marginBottom: 18,
              }}
            >
              Basic Information
            </h3>

            <div className="form-grid">
              <Field
                label="Company name"
                name="name"
                placeholder="Acme Corp"
                required
                value={form.name}
                error={errors.name}
                onChange={(e) => set('name', e.target.value)}
              />

              <Field
                label="Contact person"
                name="contact"
                placeholder="John Smith"
                value={form.contact}
                error={errors.contact}
                onChange={(e) => set('contact', e.target.value)}
              />

              <Field
                label="Email"
                name="email"
                type="email"
                placeholder="john@acme.com"
                required
                value={form.email}
                error={errors.email}
                onChange={(e) => set('email', e.target.value)}
              />

              <Field
                label="Phone"
                name="phone"
                placeholder="+91 98765 43210"
                value={form.phone}
                error={errors.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>

            <div
              style={{
                marginTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                }}
              >
                Brand colour
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                {COLOR_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    title={opt.label}
                    onClick={() => set('color', opt.value)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: opt.value,
                      cursor: 'pointer',
                      border:
                        form.color === opt.value
                          ? '2px solid #fff'
                          : '2px solid transparent',
                      boxShadow:
                        form.color === opt.value
                          ? `0 0 10px ${opt.value}88`
                          : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Contract Details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-1)',
                marginBottom: 10,
              }}
            >
              Contract Details
            </h3>

            <div style={{
              fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16,
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              Client status (Active / Renewal / Overdue) is calculated automatically from the contract end date below — no need to set it by hand.
            </div>

            <div className="form-grid">
              <Field
                label="Contract value"
                name="contractValue"
                placeholder="₹80,000/yr"
                value={form.contractValue}
                error={errors.contractValue}
                onChange={(e) => set('contractValue', e.target.value)}
              />

              <Field
                label="Contract end date"
                name="contractEnd"
                type="date"
                value={form.contractEnd}
                error={errors.contractEnd}
                onChange={(e) => set('contractEnd', e.target.value)}
              />

              <Field
                label="Invoice status"
                name="invoiceStatus"
              >
                <select
                  className="input"
                  value={form.invoiceStatus}
                  onChange={(e) =>
                    set('invoiceStatus', e.target.value)
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                </select>
              </Field>

              <Field
                label="Invoice amount"
                name="invoiceAmount"
                placeholder="₹48,000"
                value={form.invoiceAmount}
                error={errors.invoiceAmount}
                onChange={(e) => set('invoiceAmount', e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-1)',
                marginBottom: 18,
              }}
            >
              Notes
            </h3>

            <textarea
              className="input"
              rows={4}
              placeholder="Any extra context about this client..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              style={{
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : <><UserPlus size={15} /> Add Client</>}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>
        </form>
        </>
        )}
      </div>
    </Layout>
  )
}