import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, CalendarCheck, Bell, FileText, Smartphone, Download } from 'lucide-react'

const APK_URL = import.meta.env.VITE_APK_URL || null
const esNativo = window.Capacitor?.isNativePlatform?.() === true
import logoImg from '../assets/logo.png'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { guardarSesion, obtenerRutaPorRol } from '../lib/auth'
import { iniciarPush, resetPush } from '../lib/pushNotifications'


export default function LoginApoderado() {
  const [dni,         setDni]         = useState('')
  const [password,    setPassword]    = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [exito,    setExito]    = useState(false)
  const nav = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!dni || !password) return toast.error('Completa todos los campos')
    setCargando(true)
    try {
      const { data: tokenData } = await api.post('/auth/login', { dni, password })
      localStorage.setItem('token', tokenData.access_token)
      const { data: usuario } = await api.get('/auth/me')
      guardarSesion(tokenData.access_token, usuario)
      await resetPush().catch(() => {})
      await iniciarPush().catch(() => {})

      setExito(true)
      setTimeout(() => nav(obtenerRutaPorRol(usuario.rol)), 1500)
    } catch (err) {
      localStorage.removeItem('token')
      toast.error(err.response?.data?.detail || 'DNI o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
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
        style={{ width: '52%', background: '#0a1f3d' }}
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
            Portal del Apoderado
          </p>
          <h2 className="text-4xl font-black leading-tight mb-4">
            Mantente al tanto<br />
            de tu <span className="text-dorado">hijo/a</span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Accede en cualquier momento a la asistencia,
            comunicados y novedades del colegio.
          </p>
        </div>

        {/* Features orientadas al padre */}
        <div className="space-y-4">
          {[
            { Icon: CalendarCheck, text: 'Consulta la asistencia diaria de tu hijo/a'   },
            { Icon: Bell,          text: 'Recibe notificaciones importantes del colegio' },
            { Icon: FileText,      text: 'Justifica inasistencias desde tu celular'      },
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
          Acceso para padres y apoderados registrados
        </p>
      </div>

      {/* ── Panel derecho — Formulario ───────────────────────────────────── */}
      <div
        className="flex flex-col w-full lg:flex-1 min-h-screen"
        style={{ background: '#f8f7f4' }}
      >

        {/* ── Header móvil (APK) ── */}
        <div
          className="lg:hidden flex flex-col items-center px-6 text-white relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #0d2547 0%, #0a1f3d 60%, #071628 100%)',
            paddingTop: '3.5rem',
            paddingBottom: '3rem',
            borderRadius: '0 0 2.8rem 2.8rem',
          }}
        >
          {/* Círculos decorativos */}
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-5" style={{ background: '#c9a227' }} />
          <div className="absolute -bottom-8 -left-10 w-32 h-32 rounded-full opacity-5" style={{ background: '#c9a227' }} />

          {/* Logo */}
          <div className="relative mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
              style={{ background: 'rgba(201,162,39,0.12)', border: '2px solid rgba(201,162,39,0.35)' }}
            >
              <img src={logoImg} alt="CEAUNE" className="w-14 h-14 object-contain drop-shadow-lg" />
            </div>
          </div>

          {/* Separador dorado */}
          <div className="w-10 h-0.5 rounded-full mb-3" style={{ background: '#c9a227', opacity: 0.7 }} />

          {/* Textos institucionales */}
          <p
            className="text-center font-bold uppercase tracking-widest mb-1 leading-snug"
            style={{ fontSize: '9px', color: '#c9a227', letterSpacing: '0.12em' }}
          >
            Universidad Nacional de Educación<br />Enrique Guzmán y Valle
          </p>
          <h1 className="text-[17px] font-black text-center text-white leading-tight mb-2">
            Colegio Experimental de Aplicación
          </h1>
          <p className="text-center leading-snug" style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.45)' }}>
            I.E. por Convenio UNE-MED · R.M. N° 045-2001-ED
          </p>
          <p className="text-center mt-0.5" style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.45)' }}>
            Jornada Escolar Completa con Formación Técnica
          </p>

          {/* Badge portal apoderado */}
          <div
            className="mt-4 px-4 py-1 rounded-full"
            style={{ background: 'rgba(201,162,39,0.15)', border: '1px solid rgba(201,162,39,0.3)' }}
          >
            <p className="text-[10px] font-semibold" style={{ color: '#c9a227' }}>Portal del Apoderado</p>
          </div>
        </div>

        {/* ── Formulario ── */}
        <div className="flex-1 flex flex-col justify-center px-7 sm:px-16 py-8">
          <div className="max-w-sm w-full mx-auto">

            {/* Logo desktop */}
            <div className="hidden lg:flex justify-center mb-6">
              <img src={logoImg} alt="CEAUNE" className="w-20 h-20 object-contain drop-shadow-sm" />
            </div>

            <h2 className="text-[22px] font-black text-marino mb-1">Bienvenido</h2>
            <p className="text-gray-500 text-sm mb-7">
              Ingresa con el DNI y contraseña que te asignó el colegio
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  DNI
                </label>
                <input
                  className="input w-full"
                  value={dni}
                  onChange={e => setDni(e.target.value)}
                  placeholder="Ingresa tu DNI"
                  autoComplete="username"
                  maxLength={8}
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    className="input w-full pr-11"
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
                disabled={cargando || !dni || !password}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all mt-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.98]"
                style={{ background: '#0a1f3d', color: '#c9a227', letterSpacing: '0.03em' }}
              >
                {cargando ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Verificando…
                  </>
                ) : 'Ingresar'}
              </button>
            </form>

            <div className="mt-5 p-3.5 rounded-xl" style={{ background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.2)' }}>
              <p className="text-xs text-center leading-relaxed" style={{ color: '#8a6d1a' }}>
                ¿Olvidaste tu contraseña? Comunícate con la secretaría del colegio.
              </p>
            </div>

            {/* Banner APK — solo en navegador web */}
            {!esNativo && (
              APK_URL ? (
                <a
                  href={APK_URL}
                  download
                  className="mt-4 flex items-center gap-3 p-3.5 rounded-xl transition-colors active:opacity-80"
                  style={{ background: 'rgba(10,31,61,0.05)', border: '1px solid rgba(10,31,61,0.1)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0a1f3d' }}>
                    <Smartphone size={17} className="text-dorado" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-marino leading-tight">Descarga la App CEAUNE</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Recibe notificaciones en tiempo real</p>
                  </div>
                  <Download size={14} className="text-gray-400 flex-shrink-0" />
                </a>
              ) : (
                <div
                  className="mt-4 flex items-center gap-3 p-3.5 rounded-xl"
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

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-300 pb-5 px-4">
          CEAUNE © {new Date().getFullYear()} · Portal del Apoderado
        </p>
      </div>

    </div>
  )
}
