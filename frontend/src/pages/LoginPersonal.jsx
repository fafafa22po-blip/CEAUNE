import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye, EyeOff, QrCode,
  BarChart2, Mail, CheckCircle,
  Briefcase, Users, Smartphone, Download,
} from 'lucide-react'

const APK_URL = import.meta.env.VITE_APK_URL || null
const esNativo = window.Capacitor?.isNativePlatform?.() === true
import logoImg from '../assets/logo.png'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { guardarSesion, guardarModoSesion, obtenerRutaPorRol } from '../lib/auth'

const ROL_LABEL = {
  'admin':      'Administrador',
  'tutor':      'Tutor',
  'i-auxiliar': 'Auxiliar Inicial',
  'p-auxiliar': 'Auxiliar Primaria',
  's-auxiliar': 'Auxiliar Secundaria',
}

export default function LoginPersonal() {
  const [codigo,      setCodigo]      = useState('')
  const [password,    setPassword]    = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [cargando,    setCargando]    = useState(false)
  const [exito,       setExito]       = useState(false)
  const [modalRol,    setModalRol]    = useState(null) // { usuario }
  const nav = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!codigo || !password) return toast.error('Completa todos los campos')
    const dni = `CE${codigo}`
    setCargando(true)
    try {
      const { data: tokenData } = await api.post('/auth/login', { dni, password })
      localStorage.setItem('token', tokenData.access_token)
      const { data: usuario } = await api.get('/auth/me')
      guardarSesion(tokenData.access_token, usuario)

      if (usuario.es_apoderado && usuario.rol !== 'apoderado') {
        // Tiene doble rol — preguntar con qué perfil desea ingresar
        setModalRol({ usuario })
      } else {
        setExito(true)
        setTimeout(() => nav(obtenerRutaPorRol(usuario.rol)), 1500)
      }
    } catch (err) {
      localStorage.removeItem('token')
      toast.error(err.response?.data?.detail || 'DNI o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
  }

  const elegirModo = (modo, usuario) => {
    if (modo === 'apoderado') {
      guardarModoSesion('apoderado')
    }
    setModalRol(null)
    setExito(true)
    setTimeout(() => nav(modo === 'apoderado' ? '/apoderado' : obtenerRutaPorRol(usuario.rol)), 1500)
  }

  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-marino">
        <div className="text-center text-white">
          <CheckCircle size={64} className="mx-auto mb-4 text-dorado" />
          <p className="text-2xl font-bold">¡Bienvenido!</p>
          <p className="text-white/60 mt-1">Redirigiendo…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — Branding ───────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between px-14 py-12 text-white flex-shrink-0"
        style={{ width: '48%', background: '#0a1f3d' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="CEAUNE" className="w-12 h-12 object-contain drop-shadow-sm" />
          <div>
            <p className="font-bold text-sm leading-tight">CEAUNE</p>
            <p className="text-white/40 text-xs">Centro de Aplicación UNE</p>
          </div>
        </div>

        {/* Titular */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4 font-medium">
            Portal del Personal
          </p>
          <h2 className="text-4xl font-black leading-tight mb-4">
            Sistema de control<br />
            de <span className="text-dorado">asistencia</span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Plataforma institucional para el registro, seguimiento y
            comunicación de asistencia estudiantil.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4">
          {[
            { Icon: QrCode,    text: 'Escaneo QR en tiempo real'          },
            { Icon: Mail,      text: 'Notificaciones automáticas'          },
            { Icon: BarChart2, text: 'Reportes y estadísticas detalladas'  },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Icon size={17} className="text-dorado" />
              </div>
              <span className="text-white/70 text-sm">{text}</span>
            </div>
          ))}
        </div>

        {/* Pie */}
        <p className="text-white/20 text-xs">
          Acceso exclusivo para personal autorizado
        </p>
      </div>

      {/* ── Panel derecho — Formulario ───────────────────────────────────── */}
      <div
        className="flex flex-col justify-center px-8 sm:px-12 w-full lg:flex-1 overflow-y-auto py-12"
        style={{ background: '#f8f7f4' }}
      >
        <div className="max-w-sm w-full mx-auto">

          {/* Logo móvil */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src={logoImg} alt="CEAUNE" className="w-24 h-24 object-contain drop-shadow-md mb-3" />
            <p className="font-black text-marino text-3xl tracking-wide">CEAUNE</p>
            <p className="text-gray-400 text-xs mt-1">Centro de Aplicación UNE</p>
          </div>

          {/* Logo desktop */}
          <div className="hidden lg:flex justify-center mb-6">
            <img src={logoImg} alt="CEAUNE" className="w-20 h-20 object-contain drop-shadow-sm" />
          </div>

          <h2 className="text-2xl font-black text-marino mb-1">Bienvenido</h2>
          <p className="text-gray-500 text-sm mb-7">
            Ingresa tu código institucional y contraseña
          </p>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Código institucional
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-marino text-sm select-none pointer-events-none tracking-wider">
                  CE
                </span>
                <input
                  className="input pl-9"
                  value={codigo}
                  onChange={e => {
                    let val = e.target.value.toUpperCase()
                    if (val.startsWith('CE')) val = val.slice(2)
                    setCodigo(val.replace(/\D/g, '').slice(0, 8))
                  }}
                  placeholder="12345678"
                  autoComplete="username"
                  inputMode="numeric"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Ingresa solo los 8 dígitos de tu DNI — el prefijo CE ya está incluido</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  className="input w-full py-3 pr-11"
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full py-3.5 font-bold text-sm flex items-center justify-center gap-2 mt-1"
            >
              {cargando && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {cargando ? 'Verificando…' : 'Ingresar al sistema'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
            ¿Problemas para ingresar?<br />
            Contacte al administrador del sistema.
          </p>

          {/* Banner APK — solo en navegador web */}
          {!esNativo && (
            APK_URL ? (
              <a
                href={APK_URL}
                download
                className="mt-5 flex items-center gap-3 p-3.5 rounded-xl transition-colors active:opacity-80"
                style={{ background: 'rgba(10,31,61,0.05)', border: '1px solid rgba(10,31,61,0.1)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0a1f3d' }}>
                  <Smartphone size={17} className="text-dorado" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-marino leading-tight">Descarga la App CEAUNE</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Escaneo QR y notificaciones nativas</p>
                </div>
                <Download size={14} className="text-gray-400 flex-shrink-0" />
              </a>
            ) : (
              <div
                className="mt-5 flex items-center gap-3 p-3.5 rounded-xl"
                style={{ background: 'rgba(10,31,61,0.04)', border: '1px solid rgba(10,31,61,0.08)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0a1f3d' }}>
                  <Smartphone size={17} className="text-dorado" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-marino leading-tight">App CEAUNE disponible</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Solicita la instalación al administrador</p>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Modal: selección de perfil de ingreso ────────────────────────── */}
      {modalRol && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-2xl">
            {/* Cabecera */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-marino/10 flex items-center justify-center mx-auto mb-3">
                <img src={logoImg} alt="" className="w-8 h-8 object-contain" />
              </div>
              <h3 className="font-black text-marino text-lg">
                Hola, {modalRol.usuario.nombre}
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                Tienes acceso con dos perfiles.<br />¿Con cuál deseas ingresar hoy?
              </p>
            </div>

            {/* Opciones */}
            <div className="space-y-3">
              <button
                onClick={() => elegirModo('personal', modalRol.usuario)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-marino bg-marino/5 hover:bg-marino/10 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-marino flex items-center justify-center flex-shrink-0">
                  <Briefcase size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-marino text-sm">
                    {ROL_LABEL[modalRol.usuario.rol] || modalRol.usuario.rol}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Acceso al portal del personal</p>
                </div>
              </button>

              <button
                onClick={() => elegirModo('apoderado', modalRol.usuario)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dorado bg-dorado/5 hover:bg-dorado/10 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-dorado flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-dorado text-sm">Apoderado</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ver asistencia de mis hijos</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
