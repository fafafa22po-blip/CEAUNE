import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, QrCode, Mail, BarChart2, CheckCircle, Lock, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { guardarSesion, obtenerRutaPorRol } from '../lib/auth'
import { iniciarPush, resetPush } from '../lib/pushNotifications'

const FEATURES = [
  { icon: QrCode,    text: 'Escaneo QR en tiempo real' },
  { icon: Mail,      text: 'Notificaciones automáticas a apoderados' },
  { icon: BarChart2, text: 'Reportes y estadísticas detalladas' },
]

export default function Login() {
  const [dni,         setDni]         = useState('')
  const [password,    setPassword]    = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [cargando,    setCargando]    = useState(false)
  const [exito,       setExito]       = useState(false)
  const nav = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!dni || !password) return toast.error('Complete todos los campos')
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
      if (!err.response) {
        toast.error('Sin conexión al servidor. Verifique su red e intente de nuevo.')
      } else {
        toast.error(err.response.data?.detail || 'Credenciales incorrectas')
      }
    } finally {
      setCargando(false)
    }
  }

  /* ── Pantalla de éxito ── */
  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-marino">
        <div className="text-center text-white">
          <div className="w-24 h-24 rounded-full bg-dorado/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} className="text-dorado" />
          </div>
          <p className="text-2xl font-black">¡Bienvenido!</p>
          <p className="text-white/40 mt-2 text-sm">Ingresando al sistema...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo (solo desktop) ─────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between px-16 py-16 text-white flex-shrink-0"
        style={{ width: '52%', background: '#0a1f3d' }}
      >
        {/* Logo + título */}
        <div>
          <div className="w-14 h-14 bg-dorado rounded-2xl flex items-center justify-center mb-8 shadow-lg">
            <span className="text-white font-black text-xl tracking-tight">CE</span>
          </div>
          <p className="text-dorado text-[11px] font-bold uppercase tracking-widest mb-1">
            Universidad Nacional de Educación Enrique Guzmán y Valle
          </p>
          <h1 className="text-2xl font-black leading-tight mb-1">
            Colegio Experimental de Aplicación
          </h1>
          <p className="text-white/50 text-[11px] mb-0.5">I.E. por Convenio UNE-MED, según R.M. N° 045-2001-ED</p>
          <p className="text-white/50 text-[11px] mb-6">Modelo Educativo: Jornada Escolar Completa con Formación Técnica</p>
          <h2 className="text-4xl font-black leading-[1.1] mb-4">
            Control de<br />asistencia<br />
            <span className="text-dorado">inteligente</span>
          </h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs mt-4">
            Sistema unificado para el seguimiento y control de asistencia escolar en tiempo real.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-dorado" />
              </div>
              <span className="text-white/55 text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel derecho / pantalla completa en móvil ─────────────────── */}
      <div className="flex flex-col w-full lg:w-[48%] min-h-screen" style={{ background: '#f8f7f4' }}>

        {/* Header móvil con logo (oculto en desktop) */}
        <div
          className="lg:hidden flex flex-col items-center pt-14 pb-12 px-8 text-white"
          style={{
            background: '#0a1f3d',
            borderRadius: '0 0 2.5rem 2.5rem',
          }}
        >
          <div className="w-16 h-16 bg-dorado rounded-2xl flex items-center justify-center mb-5 shadow-lg">
            <span className="text-white font-black text-2xl tracking-tight">CE</span>
          </div>
          <p className="text-dorado text-[10px] font-bold uppercase tracking-widest mb-0.5 text-center">
            Universidad Nacional de Educación Enrique Guzmán y Valle
          </p>
          <h1 className="text-xl font-black text-center">Colegio Experimental de Aplicación</h1>
          <p className="text-white/40 text-[10px] mt-0.5 text-center">I.E. por Convenio UNE-MED, según R.M. N° 045-2001-ED</p>
          <p className="text-white/40 text-[10px] text-center">Modelo Educativo: Jornada Escolar Completa con Formación Técnica</p>
        </div>

        {/* Formulario centrado */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 py-10">
          <div className="max-w-sm w-full mx-auto">

            {/* Encabezado del form */}
            <div className="mb-8">
              <h2 className="text-2xl font-black text-marino">Iniciar sesión</h2>
              <p className="text-gray-400 text-sm mt-1">
                Ingrese su DNI y contraseña para continuar
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">

              {/* DNI */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  DNI
                </label>
                <div className="relative">
                  <User
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    className="input pl-10"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ej: 12345678"
                    autoComplete="username"
                    inputMode="numeric"
                    maxLength={8}
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    className="input pl-10 pr-11"
                    type={verPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword(!verPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Botón ingresar */}
              <button
                type="submit"
                disabled={cargando || !dni || !password}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]"
                style={{ background: '#0a1f3d' }}
              >
                {cargando ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Verificando...
                  </>
                ) : 'Ingresar al sistema'}
              </button>
            </form>

            {/* Ayuda */}
            <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
              ¿Problemas para ingresar?<br />
              Contacte al administrador del sistema.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-300 pb-6 px-4">
          CEAUNE © {new Date().getFullYear()} · Centro de Aplicación UNE
        </p>
      </div>
    </div>
  )
}
