import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout({ children, title, subtitle, action }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        {/* Mobile-only topbar with hamburger */}
        <div className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
              color: 'var(--text-1)', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Menu size={17} />
          </button>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
            ClientAI
          </div>
          <div style={{ width: 36 }} />
        </div>

        {(title || action) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12,
            justifyContent: 'space-between', marginBottom: 28,
          }}>
            <div>
              {title && (
                <h1 style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: 26, fontWeight: 700,
                  color: 'var(--text-1)',
                  letterSpacing: '-.02em',
                }}>{title}</h1>
              )}
              {subtitle && (
                <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>
                  {subtitle}
                </p>
              )}
            </div>
            {action && <div>{action}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
