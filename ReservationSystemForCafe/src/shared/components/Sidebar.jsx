import { Link, NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../../features/auth/AuthContext.jsx'

function SideItem({ to, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sideItem sideItem--left ${isActive ? 'sideItem--active' : ''}`}
    >
      <span className="sideItem__label">{label}</span>
      {typeof badge === 'number' ? <span className="sideItem__badge">{badge}</span> : null}
    </NavLink>
  )
}

function getInitials(name) {
  const text = String(name || '').trim()
  if (!text) return ''
  const parts = text.split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] || ''
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''
  return (a + b).toUpperCase()
}

export default function Sidebar({ brand = 'CAFÉ', items = [], role = 'Customer' }) {
  const { user } = useAuth()

  const displayName = user?.displayName || user?.email || '—'
  const initials = getInitials(user?.displayName || user?.email)

  return (
    <aside className="leftSidebar">
      <div className="leftSidebar__brand">
        <div className="leftSidebar__logo" />
        <div className="leftSidebar__name">{brand}</div>
      </div>

      <nav className="leftSidebar__nav">
        {items.map((it) => (
          <SideItem key={it.to} to={it.to} label={it.label} badge={it.badge} />
        ))}
      </nav>

      <div className="leftSidebar__bottom">
        <div className="leftSidebar__actions" aria-label="Sidebar actions">
          {!user ? (
            <div className="leftSidebar__authLinks">
              <Link className="leftSidebar__link" to="/auth/login">
                Log In
              </Link>
              <div className="leftSidebar__divider" aria-hidden="true" />
              <Link className="leftSidebar__link" to="/auth/signup">
                Sign up
              </Link>
            </div>
          ) : (
            <button className="leftSidebar__logout" type="button" onClick={() => signOut(auth)}>
              Log Out
            </button>
          )}
        </div>

        <div className="leftSidebar__user">
          {user?.photoURL ? (
            <img className="leftSidebar__avatarImg" src={user.photoURL} alt="Avatar" />
          ) : (
            <div className="leftSidebar__avatarFallback" aria-label="Avatar">
              {user && initials ? <span className="leftSidebar__avatarInitials">{initials}</span> : null}
            </div>
          )}

          {user ? (
            <div className="leftSidebar__userMeta">
              <div className="leftSidebar__userName">{displayName}</div>
              <div className="leftSidebar__userRole">{role}</div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
