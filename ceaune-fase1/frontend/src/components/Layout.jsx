import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getUser, clearSession } from '../lib/auth'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icon = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  scan: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  ),
  list: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  student: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  family: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  mail: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  logout: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
  menu: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
}

// ─── Nav config por rol ────────────────────────────────────────────────────────
const NAV = {
  admin: [
    { to: '/admin/dashboard',         label: 'Dashboard',      icon: 'dashboard' },
    { to: '/admin/estudiantes',       label: 'Estudiantes',    icon: 'student'   },
    { to: '/admin/apoderados',        label: 'Apoderados',     icon: 'family'    },
    { to: '/auxiliar/escanear',       label: 'Escanear QR',    icon: 'scan'      },
    { to: '/auxiliar/hoy',            label: 'Asistencia Hoy', icon: 'list'      },
    { to: '/auxiliar/comunicados',    label: 'Comunicados',    icon: 'mail'      },
  ],
  auxiliar: [
    { to: '/auxiliar/escanear',       label: 'Escanear QR',    icon: 'scan'      },
    { to: '/auxiliar/hoy',            label: 'Asistencia Hoy', icon: 'list'      },
    { to: '/auxiliar/estudiantes',    label: 'Consulta Alumnos', icon: 'student' },
    { to: '/auxiliar/comunicados',    label: 'Comunicados',    icon: 'mail'      },
  ],
  apoderado: [
    { to: '/apoderado/asistencias',   label: 'Mis Hijos',      icon: 'users'     },
    { to: '/apoderado/comunicados',   label: 'Comunicados',    icon: 'mail'      },
  ],
}

const ROL_LABEL = {
  admin:     'Administrador',
  auxiliar:  'Auxiliar',
  apoderado: 'Apoderado',
}

// ─── Sidebar content ──────────────────────────────────────────────────────────
function SidebarContent({ links, user, location, onNavigate, onLogout }) {
  return (
    <div className="flex flex-col h-full">

      {/* Brand */}
      <div className="h-[73px] px-5 flex items-center border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ceaune-gold flex items-center justify-center shadow-md shrink-0">
            <span className="text-white font-extrabold text-base">C</span>
          </div>
          <div>
            <p className="text-white font-bold text-[15px] leading-tight tracking-wide">CEAUNE</p>
            <p className="text-blue-400 text-[11px] leading-tight mt-0.5">Sistema de Asistencia</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] font-semibold text-blue-400/70 uppercase tracking-widest select-none">
          Menú principal
        </p>
        {links.map((link) => {
          const active = location.pathname === link.to
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-ceaune-gold text-white shadow-md'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={active ? 'text-white' : 'text-blue-400'}>
                {Icon[link.icon]}
              </span>
              <span className="flex-1">{link.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />}
            </Link>
          )
        })}
      </nav>

      {/* User & Logout */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 mb-1">
          <div className="w-8 h-8 rounded-full bg-ceaune-gold/30 flex items-center justify-center shrink-0">
            <span className="text-ceaune-gold font-bold text-sm">
              {user?.nombre?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">
              {user?.nombre} {user?.apellido}
            </p>
            <p className="text-blue-400 text-[11px] leading-tight">{ROL_LABEL[user?.rol]}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-300 hover:bg-red-500/15 hover:text-red-300 transition-all duration-150"
        >
          {Icon.logout}
          Cerrar sesión
        </button>
      </div>

    </div>
  )
}

// ─── Layout principal ─────────────────────────────────────────────────────────
export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user     = getUser()
  const [open, setOpen] = useState(false)

  const links = NAV[user?.rol] || []

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const sidebarProps = {
    links,
    user,
    location,
    onNavigate: () => setOpen(false),
    onLogout:   handleLogout,
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-ceaune-navy shadow-xl z-20">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Sidebar — mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-60 bg-ceaune-navy shadow-2xl">
            <SidebarContent {...sidebarProps} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar — desktop */}
        <header className="hidden md:flex h-[73px] bg-ceaune-navy px-6 items-center justify-between shrink-0 border-b border-white/10">
          <div>
            <p className="text-white font-semibold text-sm">
              {links.find(l => l.to === location.pathname)?.label ?? 'Panel'}
            </p>
            <p className="text-blue-400 text-xs capitalize">
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-white leading-tight">{user?.nombre} {user?.apellido}</p>
              <p className="text-xs text-blue-400 leading-tight">{ROL_LABEL[user?.rol]}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-ceaune-gold/30 flex items-center justify-center shrink-0">
              <span className="text-ceaune-gold font-bold text-sm">
                {user?.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Topbar — móvil */}
        <header className="md:hidden bg-ceaune-navy text-white px-4 py-3 flex items-center gap-3 shadow-md shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="text-blue-200 hover:text-white transition-colors"
            aria-label="Abrir menú"
          >
            {Icon.menu}
          </button>
          <span className="font-bold text-ceaune-gold tracking-wide">CEAUNE</span>
          <span className="ml-auto text-blue-300 text-xs truncate max-w-[140px]">
            {user?.nombre} {user?.apellido}
          </span>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

      </div>
    </div>
  )
}
