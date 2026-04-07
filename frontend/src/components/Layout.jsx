import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { setStatusBarDark } from '../lib/statusbar'
import { obtenerUsuario, cerrarSesion } from '../lib/auth'
import logoImg from '../assets/logo.png'
import api from '../lib/api'
import { QK } from '../lib/queryKeys'
import { HijoProvider, useHijo } from '../context/HijoContext'
import { hapticMedium, hapticLight } from '../lib/haptics'
import {
  QrCode, LayoutDashboard, Users, Calendar, Settings,
  MessageSquare, Inbox, FileCheck,
  BookOpen, Eye, BarChart2, Home, LogOut,
  ChevronLeft, ChevronRight, Clock, User, Phone, ScanSearch,
  CalendarCheck, GraduationCap, NotebookText, MoreHorizontal, UserCheck, Briefcase, ArrowLeftRight,
} from 'lucide-react'

// ── BOTTOM NAV — config por rol ──────────────────────────────────────
const AUXILIAR_NAV = {
  main: [
    { a: '/auxiliar/inicio',      icon: Home,          label: 'Inicio'     },
    { a: '/auxiliar/escanear',    icon: QrCode,        label: 'Escanear',  scan: true },
    { a: '/auxiliar/asistencia',  icon: CalendarCheck, label: 'Asistencia' },
    { a: '/auxiliar/bandeja',     icon: Inbox,         label: 'Bandeja'    },
  ],
  overflow: [
    { a: '/auxiliar/inspeccion',      icon: ScanSearch,    label: 'Inspección'      },
    { a: '/auxiliar/comunicar',       icon: MessageSquare, label: 'Comunicar'       },
    { a: '/auxiliar/justificaciones', icon: FileCheck,     label: 'Justificaciones' },
    { a: '/auxiliar/horarios',        icon: Clock,         label: 'Horarios'        },
    { a: '/auxiliar/horario-clases',  icon: GraduationCap, label: 'Clases'          },
    { a: '/auxiliar/contactos',       icon: Phone,         label: 'Contactos'       },
    { a: '/auxiliar/perfil',          icon: User,          label: 'Mi Perfil'       },
  ],
}

const BOTTOM_NAV = {
  'i-auxiliar': AUXILIAR_NAV,
  'p-auxiliar': AUXILIAR_NAV,
  's-auxiliar': AUXILIAR_NAV,
  'tutor': {
    main: [
      { a: '/tutor/inicio',      icon: Home,          label: 'Inicio'      },
      { a: '/tutor/mi-aula',     icon: BookOpen,      label: 'Mi Aula'     },
      { a: '/tutor/comunicados', icon: MessageSquare, label: 'Comunicados' },
      { a: '/tutor/seguimiento', icon: Eye,           label: 'Seguimiento' },
    ],
    overflow: [
      { a: '/tutor/libretas',  icon: NotebookText,  label: 'Libretas'  },
      { a: '/tutor/reuniones', icon: CalendarCheck, label: 'Reuniones' },
      { a: '/tutor/perfil',    icon: User,          label: 'Mi Perfil' },
    ],
  },
  'apoderado': {
    main: [
      { a: '/apoderado/inicio',      icon: Home,          label: 'Inicio'      },
      { a: '/apoderado/asistencias', icon: Calendar,      label: 'Asistencias' },
      { a: '/apoderado/comunicados', icon: MessageSquare, label: 'Comunicados', badge: true },
      { a: '/apoderado/justificar',  icon: FileCheck,     label: 'Justificar'  },
    ],
    overflow: [
      { a: '/apoderado/horario',  icon: GraduationCap, label: 'Horario'  },
      { a: '/apoderado/libretas', icon: NotebookText,  label: 'Libretas' },
      { a: '/apoderado/contacto', icon: Phone,         label: 'Contacto' },
    ],
  },
  'admin': {
    main: [
      { a: '/admin/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
      { a: '/admin/estudiantes', icon: Users,           label: 'Estudiantes' },
      { a: '/admin/comunicar',   icon: MessageSquare,   label: 'Comunicar'   },
      { a: '/admin/reportes',    icon: BarChart2,       label: 'Reportes'    },
    ],
    overflow: [
      { a: '/admin/apoderados',     icon: UserCheck,     label: 'Apoderados'  },
      { a: '/admin/calendario',     icon: Calendar,      label: 'Calendario'  },
      { a: '/admin/horarios',       icon: Clock,         label: 'Horarios'    },
      { a: '/admin/horario-clases', icon: GraduationCap, label: 'Clases'      },
      { a: '/admin/bandeja',        icon: Inbox,         label: 'Bandeja'     },
      { a: '/admin/usuarios',       icon: Settings,      label: 'Usuarios'    },
    ],
  },
}

// ── SIDEBAR MENUS (desktop) ──────────────────────────────────────────
const MENUS = {
  'i-auxiliar': [
    { a: '/auxiliar/inicio',          icon: Home,            label: 'Inicio'          },
    { a: '/auxiliar/escanear',        icon: QrCode,          label: 'Escanear'        },
    { a: '/auxiliar/inspeccion',      icon: ScanSearch,      label: 'Inspección'      },
    { a: '/auxiliar/asistencia',      icon: LayoutDashboard, label: 'Asistencia'      },
    { a: '/auxiliar/comunicar',       icon: MessageSquare,   label: 'Comunicar'       },
    { a: '/auxiliar/bandeja',         icon: Inbox,           label: 'Bandeja'         },
    { a: '/auxiliar/justificaciones', icon: FileCheck,       label: 'Justificaciones' },
    { a: '/auxiliar/horarios',        icon: Clock,           label: 'Horarios'        },
    { a: '/auxiliar/horario-clases',  icon: GraduationCap,   label: 'Clases'          },
    { a: '/auxiliar/contactos',       icon: Phone,           label: 'Contactos'       },
    { a: '/auxiliar/perfil',          icon: User,            label: 'Mi Perfil'       },
  ],
  'p-auxiliar': [
    { a: '/auxiliar/inicio',          icon: Home,            label: 'Inicio'          },
    { a: '/auxiliar/escanear',        icon: QrCode,          label: 'Escanear'        },
    { a: '/auxiliar/inspeccion',      icon: ScanSearch,      label: 'Inspección'      },
    { a: '/auxiliar/asistencia',      icon: LayoutDashboard, label: 'Asistencia'      },
    { a: '/auxiliar/comunicar',       icon: MessageSquare,   label: 'Comunicar'       },
    { a: '/auxiliar/bandeja',         icon: Inbox,           label: 'Bandeja'         },
    { a: '/auxiliar/justificaciones', icon: FileCheck,       label: 'Justificaciones' },
    { a: '/auxiliar/horarios',        icon: Clock,           label: 'Horarios'        },
    { a: '/auxiliar/horario-clases',  icon: GraduationCap,   label: 'Clases'          },
    { a: '/auxiliar/contactos',       icon: Phone,           label: 'Contactos'       },
    { a: '/auxiliar/perfil',          icon: User,            label: 'Mi Perfil'       },
  ],
  's-auxiliar': [
    { a: '/auxiliar/inicio',          icon: Home,            label: 'Inicio'          },
    { a: '/auxiliar/escanear',        icon: QrCode,          label: 'Escanear'        },
    { a: '/auxiliar/inspeccion',      icon: ScanSearch,      label: 'Inspección'      },
    { a: '/auxiliar/asistencia',      icon: LayoutDashboard, label: 'Asistencia'      },
    { a: '/auxiliar/comunicar',       icon: MessageSquare,   label: 'Comunicar'       },
    { a: '/auxiliar/bandeja',         icon: Inbox,           label: 'Bandeja'         },
    { a: '/auxiliar/justificaciones', icon: FileCheck,       label: 'Justificaciones' },
    { a: '/auxiliar/horarios',        icon: Clock,           label: 'Horarios'        },
    { a: '/auxiliar/horario-clases',  icon: GraduationCap,   label: 'Clases'          },
    { a: '/auxiliar/contactos',       icon: Phone,           label: 'Contactos'       },
    { a: '/auxiliar/perfil',          icon: User,            label: 'Mi Perfil'       },
  ],
  'tutor': [
    { a: '/tutor/inicio',        icon: Home,           label: 'Inicio'        },
    { a: '/tutor/mi-aula',       icon: BookOpen,       label: 'Mi Aula'       },
    { a: '/tutor/seguimiento',   icon: Eye,            label: 'Seguimiento'   },
    { a: '/tutor/comunicados',   icon: MessageSquare,  label: 'Comunicados'   },
    { a: '/tutor/libretas',      icon: NotebookText,   label: 'Libretas'      },
    { a: '/tutor/reuniones',     icon: CalendarCheck,  label: 'Reuniones'     },
    { a: '/tutor/perfil',        icon: User,           label: 'Mi Perfil'     },
  ],
  'apoderado': [
    { a: '/apoderado/inicio',      icon: Home,          label: 'Inicio'      },
    { a: '/apoderado/asistencias', icon: Calendar,      label: 'Asistencias' },
    { a: '/apoderado/comunicados', icon: MessageSquare, label: 'Comunicados' },
    { a: '/apoderado/justificar',  icon: FileCheck,     label: 'Justificar'  },
    { a: '/apoderado/horario',     icon: GraduationCap, label: 'Horario'     },
    { a: '/apoderado/libretas',    icon: NotebookText,  label: 'Libretas'    },
    { a: '/apoderado/contacto',    icon: Phone,         label: 'Contacto'    },
  ],
  'admin': [
    { a: '/admin/dashboard',       icon: LayoutDashboard, label: 'Dashboard'    },
    { a: '/admin/estudiantes',     icon: Users,           label: 'Estudiantes'  },
    { a: '/admin/apoderados',      icon: UserCheck,       label: 'Apoderados'   },
    { a: '/admin/calendario',      icon: Calendar,        label: 'Calendario'   },
    { a: '/admin/horarios',        icon: Clock,           label: 'Horarios'     },
    { a: '/admin/horario-clases',  icon: GraduationCap,   label: 'Clases'       },
    { a: '/admin/reportes',        icon: BarChart2,       label: 'Reportes'     },
    { a: '/admin/comunicar',       icon: MessageSquare,   label: 'Comunicar'    },
    { a: '/admin/bandeja',         icon: Inbox,           label: 'Bandeja'      },
    { a: '/admin/usuarios',        icon: Settings,        label: 'Usuarios'     },
  ],
}

const NIVEL_LABEL = {
  'i-auxiliar': 'Auxiliar Inicial',
  'p-auxiliar': 'Auxiliar Primaria',
  's-auxiliar': 'Auxiliar Secundaria',
  'tutor':      'Tutor',
  'apoderado':  'Apoderado',
  'admin':      'Administrador',
}

const RUTAS_CON_SELECTOR = [
  '/apoderado/asistencias',
  '/apoderado/horario',
  '/apoderado/justificar',
  '/apoderado/libretas',
  '/apoderado/contacto',
]

const NIVEL_AVATAR = {
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100   text-blue-700',
  secundaria: 'bg-amber-100  text-amber-700',
}

// ── SELECTOR HIJO ────────────────────────────────────────────────────
function SelectorHijo() {
  const { hijos, hijoActivo, seleccionar } = useHijo()
  const location = useLocation()

  const visible =
    hijos.length > 1 &&
    RUTAS_CON_SELECTOR.some(r => location.pathname.startsWith(r))

  if (!visible) return null

  return (
    <div className="bg-white border-b border-gray-100 flex-shrink-0">
      <div className="flex items-center gap-2.5 px-4 py-2.5 overflow-x-auto scrollbar-none">
        {hijos.map(h => {
          const activo = hijoActivo?.id === h.id
          return (
            <button
              key={h.id}
              onClick={() => seleccionar(h.id)}
              className={`
                flex flex-col items-center gap-1 flex-shrink-0
                px-3.5 py-2 rounded-2xl transition-all duration-200
                ${activo
                  ? 'bg-marino shadow-md shadow-marino/20 scale-[1.04]'
                  : 'bg-gray-50 border border-gray-200 hover:border-marino/30 active:scale-95'}
              `}
            >
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center
                text-sm font-black select-none
                ${activo ? 'bg-dorado text-marino' : 'bg-marino/10 text-marino'}
              `}>
                {h.nombre?.charAt(0).toUpperCase()}
              </div>
              <span className={`text-[11px] font-semibold max-w-[60px] truncate leading-none ${activo ? 'text-white' : 'text-gray-600'}`}>
                {h.nombre?.split(' ')[0]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── RELOJ DIGITAL ────────────────────────────────────────────────────
function RelojDigital() {
  const [hora, setHora] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hhmm = hora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  const ss   = hora.toLocaleTimeString('es-PE', { second: '2-digit' })
  return (
    <div className="flex items-baseline gap-0.5 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
      <span className="font-mono font-bold text-white text-base tabular-nums tracking-tight leading-none">
        {hhmm}
      </span>
      <span className="font-mono text-white/50 text-[10px] tabular-nums leading-none">
        {ss}
      </span>
    </div>
  )
}

// ── LAYOUT PRINCIPAL ─────────────────────────────────────────────────
export default function Layout() {
  const [colapsado,  setColapsado]  = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)
  const [pullUI,     setPullUI]     = useState({ progress: 0, refreshing: false })

  // Modo sesión reactivo (para usuarios con doble perfil: personal + apoderado)
  const [modoSesion, setModoSesion] = useState(() => localStorage.getItem('modo_sesion') || '')
  const [mostrarModalRol, setMostrarModalRol] = useState(() => {
    const u = obtenerUsuario()
    return !!(u?.es_apoderado && u?.rol !== 'apoderado' && !localStorage.getItem('modo_sesion'))
  })

  const mainRef      = useRef(null)
  const pullStateRef = useRef({ startY: 0, progress: 0, active: false })
  const queryClient  = useQueryClient()

  // Refs para back button (evita closures stale)
  const masAbiertoRef        = useRef(false)
  const ultimaPresionAtrasRef = useRef(0)
  masAbiertoRef.current = masAbierto

  const usuario  = obtenerUsuario()
  const nav      = useNavigate()
  const location = useLocation()

  // Rol efectivo: si eligió modo apoderado, usar 'apoderado' aunque su rol base sea otro
  const rolEfectivo = (usuario?.es_apoderado && modoSesion === 'apoderado')
    ? 'apoderado'
    : (usuario?.rol || '')

  const menu     = MENUS[rolEfectivo] || []
  const bottomNav     = BOTTOM_NAV[rolEfectivo]
  const mainTabs      = bottomNav?.main     ?? []
  const overflowTabs  = bottomNav?.overflow ?? []
  const tieneOverflow = overflowTabs.length > 0
  const enOverflow    = overflowTabs.some(i => location.pathname.startsWith(i.a))

  // Iniciales del usuario para el avatar
  const iniciales = `${usuario?.nombre?.[0] ?? ''}${usuario?.apellido?.[0] ?? ''}`.toUpperCase()

  // Badge comunicados sin leer (solo apoderado)
  const esApoderado = rolEfectivo === 'apoderado'
  const { data: sinLeer = 0 } = useQuery({
    queryKey: QK.comunicados,
    queryFn:  () => api.get('/apoderado/comunicados').then(r =>
      Array.isArray(r.data) ? r.data : (r.data.items || [])
    ),
    enabled:   esApoderado,
    staleTime: 60_000,
    select:    items => items.filter(c => !c.leido).length,
  })

  useEffect(() => { setStatusBarDark() }, [])
  useEffect(() => { setMasAbierto(false) }, [location.pathname])

  // ── Botón Atrás Android ──────────────────────────────────────────────
  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform?.()) return
    let listener

    async function addBackListener() {
      const { App: CapApp } = await import(/* @vite-ignore */ '@capacitor/app')
      listener = await CapApp.addListener('backButton', () => {
        // 1. Cerrar el panel "Más" si está abierto
        if (masAbiertoRef.current) {
          setMasAbierto(false)
          return
        }
        // 2. Doble toque para salir (patrón nativo Android)
        const ahora = Date.now()
        if (ahora - ultimaPresionAtrasRef.current < 2000) {
          CapApp.exitApp()
        } else {
          ultimaPresionAtrasRef.current = ahora
          toast('Presiona atrás de nuevo para salir', {
            duration: 2000,
            style: { fontSize: '14px', borderRadius: '12px' },
          })
        }
      })
    }

    addBackListener()
    return () => { listener?.remove() }
  }, []) // refs — sin closures stale

  // ── Pull-to-refresh ───────────────────────────────────────────────
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const THRESHOLD = 65

    const onStart = (e) => {
      if (el.scrollTop <= 0) {
        pullStateRef.current = { startY: e.touches[0].clientY, progress: 0, active: false }
      }
    }
    const onMove = (e) => {
      const { startY } = pullStateRef.current
      if (!startY) return
      const dy = e.touches[0].clientY - startY
      if (dy > 0 && el.scrollTop <= 0) {
        e.preventDefault()
        const progress = Math.min(dy / THRESHOLD, 1)
        pullStateRef.current.progress = progress
        pullStateRef.current.active   = true
        if (progress >= 1 && pullStateRef.current.progress < 1) hapticLight()
        setPullUI({ progress, refreshing: false })
      }
    }
    const onEnd = async () => {
      const { progress, active } = pullStateRef.current
      pullStateRef.current = { startY: 0, progress: 0, active: false }
      if (!active) return
      if (progress >= 1) {
        hapticMedium()
        setPullUI({ progress: 1, refreshing: true })
        await queryClient.refetchQueries({ type: 'active' })
        setPullUI({ progress: 0, refreshing: false })
      } else {
        setPullUI({ progress: 0, refreshing: false })
      }
    }

    el.addEventListener('touchstart',  onStart, { passive: true  })
    el.addEventListener('touchmove',   onMove,  { passive: false })
    el.addEventListener('touchend',    onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart',  onStart)
      el.removeEventListener('touchmove',   onMove)
      el.removeEventListener('touchend',    onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [queryClient])

  const handleLogout = () => {
    cerrarSesion()
    nav('/login')
  }

  const elegirModo = (modo) => {
    setMostrarModalRol(false)
    setMasAbierto(false)
    if (modo === 'apoderado') {
      localStorage.setItem('modo_sesion', 'apoderado')
      setModoSesion('apoderado')
      nav('/apoderado/inicio')
    } else {
      localStorage.removeItem('modo_sesion')
      setModoSesion('')
      nav(`/${usuario?.rol || 'login'}/inicio`)
    }
  }

  return (
    <HijoProvider>
    <div className="flex h-screen overflow-hidden bg-crema">

      {/* ── SIDEBAR DESKTOP (lg+) ──────────────────────────────────── */}
      <aside className={`hidden lg:flex flex-col bg-marino text-white transition-all duration-300 flex-shrink-0 ${
        colapsado ? 'w-16' : 'w-56'
      }`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <img
            src={logoImg}
            alt="CEAUNE"
            className="w-8 h-8 rounded-xl object-contain flex-shrink-0 bg-white/10 p-0.5"
          />
          {!colapsado && (
            <div>
              <p className="font-bold text-sm leading-tight tracking-tight">CEAUNE</p>
              <p className="text-[10px] text-white/40 leading-none mt-0.5">{NIVEL_LABEL[rolEfectivo]}</p>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {menu.map(({ a, icon: Icon, label }) => (
            <NavLink
              key={a}
              to={a}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-dorado text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
              title={colapsado ? label : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!colapsado && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Colapsar */}
        <button
          onClick={() => setColapsado(!colapsado)}
          className="flex items-center justify-center py-3 border-t border-white/10 text-white/40 hover:text-white transition-colors"
        >
          {colapsado ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* TOPBAR ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between bg-marino px-4 flex-shrink-0 shadow-topbar"
          style={{ minHeight: 56, paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          {/* Izquierda: logo + info */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo mark — solo móvil */}
            <img
              src={logoImg}
              alt="CEAUNE"
              className="lg:hidden w-8 h-8 rounded-xl object-contain flex-shrink-0 bg-white/10 p-0.5"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider leading-none truncate">
                {NIVEL_LABEL[rolEfectivo]}
              </p>
              <p className="text-sm font-bold text-white leading-tight mt-0.5 truncate">
                {usuario ? `${usuario.nombre} ${usuario.apellido}` : ''}
              </p>
            </div>
          </div>

          {/* Derecha: reloj + avatar */}
          <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
            <RelojDigital />
            {/* Avatar estático */}
            <div className="w-9 h-9 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white text-xs font-bold select-none">
              {iniciales || <User size={15} />}
            </div>
          </div>
        </header>

        {/* SELECTOR HIJO (apoderado) ────────────────────────────── */}
        {esApoderado && <SelectorHijo />}

        {/* PÁGINA ──────────────────────────────────────────────── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-3 sm:p-6" style={{ overscrollBehavior: 'none' }}>

          {/* Indicador pull-to-refresh */}
          {(pullUI.progress > 0 || pullUI.refreshing) && (
            <div
              className="flex items-center justify-center overflow-hidden transition-all duration-200 -mt-1 mb-2"
              style={{ height: pullUI.refreshing ? 40 : `${pullUI.progress * 40}px`, opacity: pullUI.refreshing ? 1 : pullUI.progress }}
            >
              <div
                className={`w-7 h-7 rounded-full border-2 border-dorado border-t-transparent ${pullUI.refreshing ? 'animate-spin' : ''}`}
                style={{ transform: pullUI.refreshing ? '' : `rotate(${pullUI.progress * 260}deg)` }}
              />
            </div>
          )}

          {/* Página con transición al navegar */}
          <div key={location.pathname} className="animate-page-enter">
            <Outlet />
          </div>

          {/* Espaciador para el bottom nav en móvil.
               Debe coincidir exactamente con: altura del nav + safe area inferior */}
          {bottomNav && (
            <div
              className="lg:hidden"
              style={{ height: 'calc(var(--nav-h) + env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
              aria-hidden="true"
            />
          )}
        </main>
      </div>

      {/* ── BOTTOM NAV (todos los roles, solo móvil) ─────────────── */}
      {bottomNav && (
        <>
          {/* Overlay — cierra el panel "Más" */}
          {masAbierto && (
            <div
              className="fixed inset-0 z-30 lg:hidden bg-black/30 animate-fade-in"
              onClick={() => setMasAbierto(false)}
            />
          )}

          {/* Panel "Más" — bottom sheet con grid */}
          {masAbierto && (
            <div
              className="fixed inset-x-0 z-40 lg:hidden bg-white rounded-t-3xl shadow-float px-4 pt-3 pb-4 animate-slide-up"
              style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))' }}
            >
              {/* Handle drag */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

              <p className="section-title px-1 mb-3">Más opciones</p>

              {/* ── Selector de perfil (solo para personal con hijo en el colegio) ── */}
              {usuario?.es_apoderado && usuario?.rol !== 'apoderado' && (
                <div className="mb-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  {/* Encabezado */}
                  <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
                    <ArrowLeftRight size={12} className="text-gray-400" />
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Cambiar perfil
                    </span>
                  </div>

                  {/* Dos tarjetas: perfil personal | apoderado */}
                  <div className="grid grid-cols-2 gap-2">

                    {/* Opción: perfil personal (tutor / auxiliar / etc.) */}
                    <button
                      onClick={() => rolEfectivo !== usuario?.rol && elegirModo('personal')}
                      disabled={rolEfectivo !== 'apoderado'}
                      className={`
                        flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-all select-none
                        ${rolEfectivo !== 'apoderado'
                          ? 'bg-marino shadow-md cursor-default'
                          : 'bg-white border border-gray-200 active:scale-[0.97] active:bg-gray-50'}
                      `}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        rolEfectivo !== 'apoderado' ? 'bg-white/15' : 'bg-gray-100'
                      }`}>
                        <Briefcase size={17} className={rolEfectivo !== 'apoderado' ? 'text-white' : 'text-gray-500'} />
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-bold leading-tight ${
                          rolEfectivo !== 'apoderado' ? 'text-white' : 'text-gray-600'
                        }`}>
                          {NIVEL_LABEL[usuario?.rol]}
                        </p>
                        {rolEfectivo !== 'apoderado'
                          ? <span className="inline-block mt-1 text-[9px] bg-dorado text-white px-2 py-0.5 rounded-full font-bold">Activo</span>
                          : <span className="inline-block mt-1 text-[9px] text-gray-400 font-medium">Cambiar</span>
                        }
                      </div>
                    </button>

                    {/* Opción: apoderado */}
                    <button
                      onClick={() => rolEfectivo !== 'apoderado' && elegirModo('apoderado')}
                      disabled={rolEfectivo === 'apoderado'}
                      className={`
                        flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-all select-none
                        ${rolEfectivo === 'apoderado'
                          ? 'bg-marino shadow-md cursor-default'
                          : 'bg-white border border-gray-200 active:scale-[0.97] active:bg-gray-50'}
                      `}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        rolEfectivo === 'apoderado' ? 'bg-white/15' : 'bg-gray-100'
                      }`}>
                        <Users size={17} className={rolEfectivo === 'apoderado' ? 'text-white' : 'text-gray-500'} />
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-bold leading-tight ${
                          rolEfectivo === 'apoderado' ? 'text-white' : 'text-gray-600'
                        }`}>
                          Apoderado
                        </p>
                        {rolEfectivo === 'apoderado'
                          ? <span className="inline-block mt-1 text-[9px] bg-dorado text-white px-2 py-0.5 rounded-full font-bold">Activo</span>
                          : <span className="inline-block mt-1 text-[9px] text-gray-400 font-medium">Cambiar</span>
                        }
                      </div>
                    </button>

                  </div>
                </div>
              )}

              {/* Grid 3 columnas */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {overflowTabs.map(({ a, icon: Icon, label }) => (
                  <NavLink
                    key={a}
                    to={a}
                    onClick={() => setMasAbierto(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-2 py-3.5 px-2 rounded-2xl transition-all active:scale-[0.96] select-none ${
                        isActive
                          ? 'bg-marino text-white shadow-card-md'
                          : 'bg-crema text-gray-600 active:bg-crema-dark'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                        <span className="text-[11px] font-semibold text-center leading-tight">
                          {label}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>

              {/* Separador + logout */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl text-red-500 active:bg-red-50 transition-colors"
                >
                  <LogOut size={18} strokeWidth={1.8} />
                  <span className="text-sm font-semibold">Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}

          {/* Barra de tabs */}
          <nav
            className="fixed bottom-0 inset-x-0 lg:hidden bg-white shadow-bottom z-40 flex items-stretch"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
              minHeight: 'var(--nav-h)',
            }}
          >
            {mainTabs.map(({ a, icon: Icon, label, scan, badge }) => (
              <NavLink
                key={a}
                to={a}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 select-none"
              >
                {({ isActive }) =>
                  scan ? (
                    /* Botón escanear — tratamiento especial dorado */
                    <>
                      <div className={`nav-pill-scan rounded-2xl flex items-center justify-center transition-all duration-200 ${
                        isActive
                          ? 'bg-dorado shadow-scan scale-105'
                          : 'bg-dorado/20'
                      }`}>
                        <Icon
                          size={19}
                          strokeWidth={2.2}
                          className={isActive ? 'text-white' : 'text-dorado-600'}
                        />
                      </div>
                      <span className={`nav-tab-label font-bold ${
                        isActive ? 'text-dorado-600' : 'text-dorado/70'
                      }`}>
                        {label}
                      </span>
                    </>
                  ) : (
                    /* Tab normal — indicador pill MD3 */
                    <>
                      <div className="relative">
                        <div className={`nav-pill rounded-full flex items-center justify-center transition-all duration-200 ${
                          isActive ? 'bg-marino/10' : ''
                        }`}>
                          <Icon
                            size={21}
                            strokeWidth={isActive ? 2.5 : 1.8}
                            className={isActive ? 'text-marino' : 'text-gray-400'}
                          />
                        </div>
                        {/* Badge de notificación */}
                        {badge && sinLeer > 0 && (
                          <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none animate-bounce-pop">
                            {sinLeer > 9 ? '9+' : sinLeer}
                          </span>
                        )}
                      </div>
                      <span className={`nav-tab-label px-1 truncate max-w-full ${
                        isActive ? 'text-marino font-bold' : 'text-gray-400 font-medium'
                      }`}>
                        {label}
                      </span>
                    </>
                  )
                }
              </NavLink>
            ))}

            {/* Botón "Más" (si hay overflow) */}
            {tieneOverflow && (
              <button
                onClick={() => setMasAbierto(prev => !prev)}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 select-none"
              >
                <div className={`nav-pill rounded-full flex items-center justify-center transition-all duration-200 ${
                  enOverflow || masAbierto ? 'bg-marino/10' : ''
                }`}>
                  <MoreHorizontal
                    size={21}
                    strokeWidth={enOverflow || masAbierto ? 2.5 : 1.8}
                    className={enOverflow || masAbierto ? 'text-marino' : 'text-gray-400'}
                  />
                </div>
                <span className={`nav-tab-label ${
                  enOverflow || masAbierto ? 'text-marino font-bold' : 'text-gray-400 font-medium'
                }`}>
                  Más
                </span>
              </button>
            )}
          </nav>
        </>
      )}
    </div>

    {/* ── Modal: elegir perfil (personal que también es apoderado) ── */}
    {mostrarModalRol && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up">

          {/* Cabecera con fondo marino */}
          <div className="bg-marino px-6 py-6 text-white text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
              <img src={logoImg} alt="" className="w-9 h-9 object-contain" />
            </div>
            <h3 className="font-black text-xl">¡Hola, {usuario?.nombre}!</h3>
            <p className="text-white/70 text-sm mt-1.5 leading-relaxed">
              Tienes dos perfiles disponibles.<br />
              ¿Con cuál quieres continuar hoy?
            </p>
          </div>

          {/* Opciones */}
          <div className="p-4 space-y-3">
            <button
              onClick={() => elegirModo('personal')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-marino bg-marino/5 hover:bg-marino/10 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-marino flex items-center justify-center flex-shrink-0">
                <Briefcase size={20} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-marino">{NIVEL_LABEL[usuario?.rol]}</p>
                <p className="text-xs text-gray-500 mt-0.5">Portal del personal docente</p>
              </div>
            </button>

            <button
              onClick={() => elegirModo('apoderado')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dorado bg-dorado/5 hover:bg-dorado/10 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-dorado flex items-center justify-center flex-shrink-0">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-dorado">Apoderado</p>
                <p className="text-xs text-gray-500 mt-0.5">Ver asistencia de mis hijos</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )}
    </HijoProvider>
  )
}
