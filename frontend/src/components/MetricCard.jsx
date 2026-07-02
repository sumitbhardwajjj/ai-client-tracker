export default function MetricCard({ label, value, color, icon, sub }) {
  return (
    <div className="card fade-up" style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {icon && (
          <span style={{ fontSize: 16, opacity: .6 }}>{icon}</span>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-head)',
        fontSize: 34, fontWeight: 700,
        color: color || 'var(--text-1)',
        lineHeight: 1,
        letterSpacing: '-.03em',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</div>
      )}
      {/* Subtle glow accent */}
      <div style={{
        position: 'absolute', bottom: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: color ? color + '18' : 'var(--blue-glow)',
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
