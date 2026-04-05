import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, CalendarCheck, Bell, FileText } from 'lucide-react'
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
        className="flex flex-col justify-center px-8 sm:px-16 w-full lg:flex-1"
        style={{ background: '#f8f7f4' }}
      >
        <div className="max-w-sm w-full mx-auto">

          {/* Logo móvil */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src={logoImg} alt="CEAUNE" className="w-24 h-24 object-contain drop-shadow-md mb-3" />
            <p className="font-black text-marino text-3xl tracking-wide">CEAUNE</p>
            <p className="text-gray-400 text-xs mt-1">Centro de Aplicación UNE</p>
          </div>

          {/* Logo desktop — encima del formulario */}
          <div className="hidden lg:flex justify-center mb-6">
            <img src={logoImg} alt="CEAUNE" className="w-20 h-20 object-contain drop-shadow-sm" />
          </div>

          <h2 className="text-2xl font-black text-marino mb-1">Bienvenido</h2>
          <p className="text-gray-500 text-sm mb-8">
            Ingresa con el DNI y contraseña que te asignó el colegio
          </p>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                DNI
              </label>
              <input
                className="input w-full py-3"
                value={dni}
                onChange={e => setDni(e.target.value)}
                placeholder="Ingresa tu DNI"
                autoComplete="username"
                maxLength={8}
                inputMode="numeric"
              />
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
              className="btn-primary w-full py-3.5 font-bold flex items-center justify-center gap-2 mt-2"
            >
              {cargando && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {cargando ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>

          {/* Nota de ayuda */}
          <div className="mt-5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-700 text-center leading-relaxed">
              ¿Olvidaste tu contraseña? Comunícate con la secretaría del colegio.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
