import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { setSession, getRedirectByRole } from '../lib/auth'

const ROLES = [
  {
    id: 'apoderado',
    label: 'Apoderado',
    subtitle: 'Consulta la asistencia de tu hijo/a',
    placeholder: 'DNI del apoderado',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.196-3.796M9 20H4v-2a4 4 0 015.196-3.796M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'auxiliar',
    label: 'Auxiliar',
    subtitle: 'Accede al módulo de control de asistencia',
    placeholder: 'DNI del auxiliar',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m0 14v1M4.22 4.22l.707.707M18.364 18.364l.707.707M4 12H3m18 0h-1M4.22 19.778l.707-.707M18.364 5.636l.707-.707M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
        <rect x="7" y="7" width="10" height="10" rx="2" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'admin',
    label: 'Administrador',
    subtitle: 'Panel de administración del sistema',
    placeholder: 'DNI del administrador',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
]

export default function Login() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState(0)
  const [form, setForm] = useState({ dni: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const role = ROLES[selectedRole]

  const handleRoleChange = (idx) => {
    setSelectedRole(idx)
    setError('')
    setForm({ dni: '', password: '' })
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.dni.trim() || !form.password.trim()) {
      setError('Ingresa tu DNI y contraseña')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', {
        dni: form.dni.trim(),
        password: form.password,
      })
      setSession(data.access_token, data.usuario)
      navigate(getRedirectByRole(data.usuario.rol), { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al conectar con el servidor'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── PANEL IZQUIERDO — Branding ── */}
      <div className="relative flex flex-col justify-between bg-ceaune-navy md:w-5/12 lg:w-2/5 px-10 py-12 overflow-hidden">

        {/* Fondo decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-ceaune-teal opacity-20" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-ceaune-gold opacity-5" />
          <div className="absolute top-1/2 -right-10 w-48 h-48 rounded-full bg-ceaune-teal-light opacity-10" />
        </div>

        {/* Retícula decorativa */}
        <div className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(201,162,39,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.4) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo + nombre */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <img src="/logo.png" alt="Logo CEAUNE" className="w-14 h-auto drop-shadow-lg" />
            <div>
              <h1 className="text-2xl font-bold text-ceaune-gold tracking-widest">CEAUNE</h1>
              <p className="text-blue-300 text-xs tracking-wide">Colegio de Aplicación UNE</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-ceaune-gold/30" />
              <span className="text-ceaune-gold text-xs uppercase tracking-widest font-medium">Secundaria</span>
              <div className="h-px flex-1 bg-ceaune-gold/30" />
            </div>
            <h2 className="text-white text-2xl font-bold leading-snug">
              Plataforma de<br />
              <span className="text-ceaune-gold">Asistencia Digital</span>
            </h2>
            <p className="text-blue-200/70 text-sm mt-3 leading-relaxed">
              Seguimiento en tiempo real de la asistencia estudiantil para toda la comunidad educativa.
            </p>
          </div>

          {/* Stats decorativos */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { label: 'Estudiantes', value: '1,200+' },
              { label: 'Docentes', value: '80+' },
              { label: 'Secciones', value: '36' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                <p className="text-ceaune-gold font-bold text-lg">{s.value}</p>
                <p className="text-blue-300/60 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer izquierdo */}
        <p className="relative z-10 text-blue-300/40 text-xs mt-12">
          © {new Date().getFullYear()} CEAUNE — Universidad Nacional de Educación
        </p>
      </div>

      {/* ── PANEL DERECHO — Login ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">

          {/* Selector de rol */}
          <div className="mb-8">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-3 text-center">
              ¿Quién eres?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleChange(idx)}
                  className={`
                    flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all duration-200
                    ${selectedRole === idx
                      ? 'border-ceaune-gold bg-ceaune-navy text-ceaune-gold shadow-lg scale-105'
                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'
                    }
                  `}
                >
                  <span className={selectedRole === idx ? 'text-ceaune-gold' : 'text-gray-400'}>
                    {r.icon}
                  </span>
                  <span className="text-xs font-semibold leading-tight text-center">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cabecera dinámica */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ceaune-navy text-ceaune-gold mb-4 shadow-lg">
              {role.icon}
            </div>
            <h3 className="text-xl font-bold text-ceaune-navy">Iniciar sesión</h3>
            <p className="text-gray-400 text-sm mt-1">{role.subtitle}</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                DNI
              </label>
              <input
                type="text"
                name="dni"
                value={form.dni}
                onChange={handleChange}
                placeholder={role.placeholder}
                maxLength={8}
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-ceaune-gold focus:border-transparent text-gray-800 placeholder-gray-300 transition shadow-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-600">
                  Contraseña
                </label>
                <button
                  type="button"
                  className="text-xs text-ceaune-gold hover:underline"
                  tabIndex={-1}
                >
                  ¿Necesitas ayuda?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-ceaune-gold focus:border-transparent text-gray-800 placeholder-gray-300 transition shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-all duration-200 mt-2
                         bg-ceaune-navy hover:bg-ceaune-navy-light
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 shadow-lg shadow-ceaune-navy/30"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </>
              ) : (
                <>
                  Ingresar como {role.label}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Nota de seguridad */}
          <p className="text-center text-gray-300 text-xs mt-8 flex items-center justify-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Acceso seguro — Tus datos están protegidos
          </p>
        </div>
      </div>

    </div>
  )
}
