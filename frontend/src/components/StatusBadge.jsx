const map = {
  Active:  'badge-green',
  Renewal: 'badge-amber',
  Overdue: 'badge-red',
  Paid:    'badge-green',
  Pending: 'badge-amber',
}
const dot = {
  Active:  'var(--green)',
  Renewal: 'var(--amber)',
  Overdue: 'var(--red)',
  Paid:    'var(--green)',
  Pending: 'var(--amber)',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${map[status] || 'badge-blue'}`}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dot[status] || 'var(--blue)',
        display: 'inline-block',
        animation: 'pulse-dot 2s ease infinite',
      }} />
      {status}
    </span>
  )
}
