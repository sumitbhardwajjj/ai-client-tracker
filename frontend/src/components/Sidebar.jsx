import { NavLink, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, UserPlus, Sparkles, Sun, Moon, X, Users, LogOut } from 'lucide-react'

const links = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/add-client',  icon: UserPlus,        label: 'Add Client'  },
  { to: '/chat',        icon: Sparkles,        label: 'AI Assistant'},
  { to: '/team',        icon: Users,           label: 'Team'        },
]

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo + mobile close button */}
      <div style={{
        padding: '0 20px 28px', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div
          onClick={() => { navigate('/'); onClose?.() }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff',
            fontFamily: 'var(--font-head)',
            boxShadow: '0 0 16px var(--blue-glow)',
          }}>C</div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
              ClientAI
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
              Pixelmattic
            </div>
          </div>
        </div>

        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
            color: 'var(--text-2)', fontSize: 15,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 8px 8px' }}>
          Menu
        </div>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 9,
              fontSize: 13.5, fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-2)',
              background: isActive ? 'var(--blue)' : 'transparent',
              textDecoration: 'none',
              transition: 'all .15s',
              boxShadow: isActive ? '0 0 14px var(--blue-glow)' : 'none',
            })}
          >
            <l.icon size={15} style={{ opacity: .8, flexShrink: 0 }} />
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle */}
      <div style={{ padding: '0 12px 12px' }}>
        <button
          onClick={toggleTheme}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 9,
            fontSize: 13.5, fontWeight: 500,
            color: 'var(--text-2)',
            background: 'transparent',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-1)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
        >
          {theme === 'dark' ? <Moon size={15} style={{ opacity: .8 }} /> : <Sun size={15} style={{ opacity: .8 }} />}
          {theme === 'dark' ? 'Dark mode' : 'Light mode'}
        </button>
      </div>

      {/* Bottom user badge */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--blue), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: '#fff',
            }}>
              {(user?.name || user?.email || '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || user?.email}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer', flexShrink: 0,
              color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
