import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, QrCode, Mail, BarChart2, Lock, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { guardarSesion, obtenerRutaPorRol } from '../lib/auth'
import { iniciarPush, resetPush } from '../lib/pushNotifications'
import logoImg from '../assets/logo.png'

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
  const [exitoNombre, setExitoNombre] = useState('')
  const nav = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!dni || !password) return toast.error('Complete todos los campos')
    setCargando(true)
    try {
      // Intentar con DNI puro; si falla autenticación, reintentar con prefijo CE
      let tokenData
      try {
        const res = await api.post('/auth/login', { dni, password })
        tokenData = res.data
      } catch (firstErr) {
        const status = firstErr.response?.status
        if (status === 401 || status === 400) {
          const res = await api.post('/auth/login', { dni: `CE${dni}`, password })
          tokenData = res.data
        } else {
          throw firstErr
        }
      }

      localStorage.setItem('token', tokenData.access_token)
      const { data: usuario } = await api.get('/auth/me')
      guardarSesion(tokenData.access_token, usuario)
      window.dispatchEvent(new CustomEvent('ceaune:sesion-iniciada'))
      await resetPush().catch(() => {})
      await iniciarPush().catch(() => {})

      setExitoNombre(usuario.nombre || '')
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
        <div
          className="text-center text-white flex flex-col items-center gap-5"
          style={{ animation: 'ceaune-fadein 0.4s ease-out' }}
        >
          <img
            src={logoImg}
            alt="CEAUNE"
            className="h-20 w-auto object-contain"
            style={{ animation: 'ceaune-scalein 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          <div>
            <p className="text-2xl font-bold tracking-tight">
              ¡Bienvenido{exitoNombre ? `, ${exitoNombre}` : ''}!
            </p>
            <p className="text-white/50 text-sm mt-1">Ingresando al sistema...</p>
          </div>
          <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-dorado rounded-full"
              style={{ animation: 'ceaune-progress 1.4s ease-in-out forwards' }}
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

      {/* ── Panel izquierdo (solo desktop) ─────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between px-16 py-16 text-white flex-shrink-0"
        style={{ width: '52%', background: '#0a1f3d' }}
      >
        <div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8">
            <img src={logoImg} alt="CEAUNE" className="w-14 h-14 object-contain drop-shadow-lg" />
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
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-5" style={{ background: '#c9a227' }} />
          <div className="absolute -bottom-8 -left-10 w-32 h-32 rounded-full opacity-5" style={{ background: '#c9a227' }} />

          <div className="relative mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
              style={{ background: 'rgba(201,162,39,0.12)', border: '2px solid rgba(201,162,39,0.35)' }}
            >
              <img src={logoImg} alt="CEAUNE" className="w-14 h-14 object-contain drop-shadow-lg" />
            </div>
          </div>

          <div className="w-10 h-0.5 rounded-full mb-3" style={{ background: '#c9a227', opacity: 0.7 }} />

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
        </div>

        {/* ── Formulario ── */}
        <div className="flex-1 flex flex-col justify-center px-7 sm:px-12 py-8">
          <div className="max-w-sm w-full mx-auto">

            {/* Logo desktop — encima del formulario */}
            <div className="hidden lg:flex justify-center mb-6">
              <img src={logoImg} alt="CEAUNE" className="w-20 h-20 object-contain drop-shadow-sm" />
            </div>

            <div className="mb-7">
              <h2 className="text-[22px] font-black text-marino">Iniciar sesión</h2>
              <p className="text-gray-400 text-sm mt-1">
                Ingrese su DNI y contraseña para continuar
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  DNI
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    className="input pl-10"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Ej: 12345678"
                    autoComplete="username"
                    inputMode="numeric"
                    maxLength={8}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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

              <button
                type="submit"
                disabled={cargando || !dni || !password}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all mt-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.98]"
                style={{ background: '#0a1f3d', color: '#c9a227', letterSpacing: '0.03em' }}
              >
                {cargando ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    Verificando...
                  </>
                ) : 'Ingresar al sistema'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
              ¿Problemas para ingresar?<br />
              Contacte al administrador del sistema.
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-300 pb-5 px-4">
          CEAUNE © {new Date().getFullYear()} · Sistema de Control de Asistencia
        </p>
      </div>

    </div>
  )
}
