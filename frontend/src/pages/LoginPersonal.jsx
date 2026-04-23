import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye, EyeOff,
  Briefcase, Users, Download,
} from 'lucide-react'
import mascotaImg from '../assets/mascota.png'

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

// ── Panel izquierdo con carrusel y Ken Burns (solo desktop) ──────────────────

const DURACION_LOGIN = 8000

function PanelIzquierdo() {
  const [fotos,   setFotos]   = useState([])
  const [activo,  setActivo]  = useState(0)

  useEffect(() => {
    api.get('/login-fotos/')
      .then(r => setFotos(Array.isArray(r.data) ? r.data : []))
      .catch(() => setFotos([]))
  }, [])

  useEffect(() => {
    if (fotos.length <= 1) return
    const id = setInterval(
      () => setActivo(p => (p + 1) % fotos.length),
      DURACION_LOGIN
    )
    return () => clearInterval(id)
  }, [fotos.length, activo])

  return (
    <div
      className="hidden lg:block relative flex-shrink-0 overflow-hidden"
      style={{ width: '48%' }}
    >
      {/* Fondo azul de respaldo (cuando no hay fotos cargadas aún) */}
      <div className="absolute inset-0" style={{ background: '#0a1f3d' }} />

      {/* Slides con Ken Burns y crossfade */}
      {fotos.map((foto, i) => (
        <div
          key={foto.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === activo ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            key={i === activo ? `${foto.id}-on` : `${foto.id}-off`}
            src={`${api.defaults.baseURL}/login-fotos/imagen/${foto.id}`}
            alt=""
            className="w-full h-full object-cover"
            style={i === activo ? {
              animation: `kb${(i % 3) + 1} 10s ease-in-out forwards`,
            } : undefined}
          />
        </div>
      ))}

      {/* Degradado: sutil arriba, fuerte abajo */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.18) 100%)',
        }}
      />

      {/* Contenido sobre el overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between px-14 py-12">

        {/* Arriba: solo nombre institucional, sin logo */}
        <div>
          <p className="font-black text-white text-base leading-tight tracking-wide">CEAUNE</p>
          <p className="text-white/50 text-xs mt-0.5">Centro de Aplicación UNE</p>
        </div>

        {/* Abajo: titular + subtítulo + dots */}
        <div className="space-y-5">
          <div>
            <p className="text-white/45 text-[11px] uppercase tracking-widest font-medium mb-3">
              Portal del Personal
            </p>
            <h2 className="text-[2.6rem] font-black leading-[1.1] text-white mb-3">
              Sistema de<br />
              Asistencia<br />
              <span className="text-dorado">Inteligente</span>
            </h2>
            <p className="text-white/45 text-sm leading-relaxed max-w-xs">
              Plataforma institucional para el registro, seguimiento
              y comunicación de asistencia estudiantil.
            </p>
          </div>

          {/* Dots — solo si hay más de 1 foto */}
          {fotos.length > 1 && (
            <div className="flex gap-1.5 items-center">
              {fotos.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === activo
                      ? 'w-5 h-1.5 bg-dorado'
                      : 'w-1.5 h-1.5 bg-white/25'
                  }`}
                />
              ))}
            </div>
          )}

          <p className="text-white/20 text-xs">
            Acceso exclusivo para personal autorizado
          </p>
        </div>
      </div>

      {/* Ken Burns keyframes */}
      <style>{`
        @keyframes kb1 {
          0%   { transform: scale(1)    translate(0%,   0%);  }
          100% { transform: scale(1.10) translate(-2%, -1%);  }
        }
        @keyframes kb2 {
          0%   { transform: scale(1.08) translate(2%,   0%);  }
          100% { transform: scale(1)    translate(-1%,  2%);  }
        }
        @keyframes kb3 {
          0%   { transform: scale(1)    translate(-1%,  1%);  }
          100% { transform: scale(1.10) translate(1%,  -2%);  }
        }
      `}</style>
    </div>
  )
}

// ── Login principal ───────────────────────────────────────────────────────────

export default function LoginPersonal() {
  const [codigo,      setCodigo]      = useState('')
  const [password,    setPassword]    = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [cargando,    setCargando]    = useState(false)
  const [exito,       setExito]       = useState(false)
  const [exitoNombre, setExitoNombre] = useState('')
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
      guardarSesion(tokenData.access_token, usuario, tokenData.refresh_token)

      if (usuario.es_apoderado && usuario.rol !== 'apoderado') {
        // Tiene doble rol — preguntar con qué perfil desea ingresar
        setModalRol({ usuario })
      } else {
        setExitoNombre(usuario.nombre || '')
        setExito(true)
        setTimeout(() => nav(obtenerRutaPorRol(usuario.rol)), 1800)
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
    setExitoNombre(usuario.nombre || '')
    setExito(true)
    setTimeout(() => nav(modo === 'apoderado' ? '/apoderado' : obtenerRutaPorRol(usuario.rol)), 1800)
  }

  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-marino">
        <div className="text-center text-white flex flex-col items-center gap-5"
          style={{ animation: 'ceaune-fadein 0.4s ease-out' }}>

          {/* Logo */}
          <img
            src={logoImg}
            alt="CEAUNE"
            className="h-20 w-auto object-contain"
            style={{ animation: 'ceaune-scalein 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
          />

          {/* Saludo */}
          <div>
            <p className="text-2xl font-bold tracking-tight">
              ¡Bienvenido{exitoNombre ? `, ${exitoNombre}` : ''}!
            </p>
            <p className="text-white/50 text-sm mt-1">Ingresando al sistema…</p>
          </div>

          {/* Barra de progreso */}
          <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-dorado rounded-full"
              style={{ animation: 'ceaune-progress 1.6s ease-in-out forwards' }}
            />
          </div>
        </div>

        <style>{`
          @keyframes ceaune-fadein {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
          @keyframes ceaune-scalein {
            from { opacity: 0; transform: scale(0.7); }
            to   { opacity: 1; transform: scale(1);   }
          }
          @keyframes ceaune-progress {
            from { width: 0%;   }
            to   { width: 100%; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — Branding con fotos ────────────────────────── */}
      <PanelIzquierdo />

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

          <p className="text-center text-xs text-gray-400 mt-3">
            ¿Eres apoderado?{' '}
            <a href="/login" className="text-marino font-semibold hover:underline">
              Ingresa aquí
            </a>
          </p>

          {/* Banner APK — solo en navegador web */}
          {!esNativo && (
            <div className="mt-5">
              {APK_URL ? (
                <a
                  href={APK_URL}
                  download
                  className="relative flex items-center gap-3 p-3.5 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #0d2547 0%, #0a1f3d 100%)' }}
                >
                  <div className="absolute inset-0 opacity-20"
                    style={{ background: 'radial-gradient(ellipse at 85% 50%, #c9a227 0%, transparent 55%)' }} />
                  <img src={mascotaImg} alt="" className="relative w-12 h-12 object-contain rounded-2xl flex-shrink-0" />
                  <div className="relative flex-1 min-w-0">
                    <p className="text-white font-bold text-xs leading-tight">¡Descarga la App CEAUNE!</p>
                    <p className="text-white/50 text-[11px] mt-0.5">Escaneo QR nativo · Notificaciones push</p>
                  </div>
                  <div className="relative w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#c9a227' }}>
                    <Download size={15} className="text-white" />
                  </div>
                </a>
              ) : (
                <div
                  className="relative flex items-center gap-3 p-3.5 rounded-2xl overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0d2547 0%, #0a1f3d 100%)' }}
                >
                  <div className="absolute inset-0 opacity-15"
                    style={{ background: 'radial-gradient(ellipse at 85% 50%, #c9a227 0%, transparent 55%)' }} />
                  <img src={mascotaImg} alt="" className="relative w-12 h-12 object-contain rounded-2xl flex-shrink-0" />
                  <div className="relative min-w-0">
                    <p className="text-white font-bold text-xs leading-tight">App CEAUNE disponible</p>
                    <p className="text-white/50 text-[11px] mt-0.5">Pídela al administrador del colegio</p>
                  </div>
                </div>
              )}
            </div>
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
