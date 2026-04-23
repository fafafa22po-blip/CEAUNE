import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { guardarSesion, obtenerRutaPorRol } from '../lib/auth'
import { iniciarPush, resetPush } from '../lib/pushNotifications'
import logoImg from '../assets/logo.png'

// ── Panel izquierdo con carrusel y Ken Burns (solo desktop) ──────────────────

const DURACION_LOGIN = 8000

function PanelIzquierdo() {
  const [fotos,  setFotos]  = useState([])
  const [activo, setActivo] = useState(0)

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
      style={{ width: '52%' }}
    >
      {/* Fondo azul de respaldo */}
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
          background: 'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.40) 45%, rgba(0,0,0,0.22) 100%)',
        }}
      />

      {/* Contenido sobre el overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between px-16 py-16">

        {/* Arriba: limpio — la foto habla sola */}
        <div />

        {/* Abajo: tipografía escalonada de impacto */}
        <div className="space-y-5">

          {/* Línea separadora dorada */}
          <div className="w-10 h-[2px]" style={{ background: '#c9a227' }} />

          {/* 3 niveles: pequeño → grande → más grande en dorado */}
          <div>
            <p
              className="uppercase font-semibold mb-2"
              style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.28em' }}
            >
              Sistema de
            </p>
            <p className="font-black text-white leading-none" style={{ fontSize: '3rem' }}>
              Asistencia
            </p>
            <p className="font-black leading-none" style={{ fontSize: '3.6rem', color: '#c9a227' }}>
              Inteligente
            </p>
          </div>

          {/* Dots — solo si hay más de 1 foto */}
          {fotos.length > 1 && (
            <div className="flex gap-1.5 items-center">
              {fotos.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:      i === activo ? '1.25rem' : '0.375rem',
                    height:     '0.375rem',
                    background: i === activo ? '#c9a227' : 'rgba(255,255,255,0.25)',
                  }}
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
      guardarSesion(tokenData.access_token, usuario, tokenData.refresh_token)
      window.dispatchEvent(new CustomEvent('ceaune:sesion-iniciada'))
      await resetPush().catch(() => {})
      await iniciarPush().catch(() => {})

      setExitoNombre(usuario.nombre || '')
      setExito(true)
      // Cierra el teclado antes de navegar para evitar que el layout
      // llegue al dashboard con el viewport encogido
      if (window.Capacitor?.isNativePlatform?.()) {
        import('@capacitor/keyboard').then(({ Keyboard }) => Keyboard.hide()).catch(() => {})
      }
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
    <div className="min-h-screen flex" style={{ backgroundColor: '#0a1f3d' }}>

      {/* ── Panel izquierdo — fotos con Ken Burns (solo desktop) ────────── */}
      <PanelIzquierdo />

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

            {/* Bloque institucional desktop — arriba del logo */}
            <div className="hidden lg:block text-center mb-5">
              <p
                className="font-bold uppercase leading-snug mb-2"
                style={{ fontSize: '11px', color: '#c9a227', letterSpacing: '0.12em' }}
              >
                Universidad Nacional de Educación<br />Enrique Guzmán y Valle
              </p>
              <p className="font-black text-marino leading-tight mb-2" style={{ fontSize: '20px' }}>
                Colegio Experimental de Aplicación
              </p>
              <p className="text-gray-500 font-medium" style={{ fontSize: '11.5px' }}>
                I.E. por Convenio UNE-MED · R.M. N° 045-2001-ED
              </p>
              <p className="text-gray-500 font-medium" style={{ fontSize: '11.5px' }}>
                Jornada Escolar Completa con Formación Técnica
              </p>
            </div>

            {/* Logo desktop */}
            <div className="hidden lg:flex justify-center mb-5">
              <img src={logoImg} alt="CEAUNE" className="w-20 h-20 object-contain drop-shadow-sm" />
            </div>

            {/* Separador desktop */}
            <div className="hidden lg:block h-px bg-gray-200 mb-7" />

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
