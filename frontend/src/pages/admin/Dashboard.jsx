import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, X, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { obtenerUsuario } from '../../lib/auth'

export default function Dashboard() {
  const nav = useNavigate()
  const usuario = obtenerUsuario()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
  const nombreAdmin = usuario?.nombre ? usuario.nombre.split(' ')[0] : 'Admin'

  useEffect(() => {
    const cargar = async () => {
      try {
        const { data } = await api.get('/admin/dashboard')
        setDatos(data)
      } catch { toast.error('Error al cargar dashboard') }
      finally { setCargando(false) }
    }
    cargar()
  }, [])

  if (cargando) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <span className="animate-spin w-5 h-5 border-2 border-dorado border-t-transparent rounded-full mr-3" />
      Cargando...
    </div>
  )

  const niveles = datos?.niveles || []
  const topTardanzas = datos?.top_tardanzas || []
  const topFaltas = datos?.top_faltas || []
  const asistenciaSemana = datos?.asistencia_semana || []

  return (
    <div className="space-y-6">

      {/* ── Banner de bienvenida ── */}
      <div className="relative overflow-hidden rounded-2xl bg-marino px-8 py-7">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute top-6 right-52    w-14 h-14 rounded-full bg-dorado/20  pointer-events-none" />
        <div className="absolute -bottom-20 right-32 w-56 h-56 rounded-full bg-dorado/10  pointer-events-none" />
        <div className="absolute bottom-6 right-8  w-8  w-8  rounded-full bg-white/10  pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-xs capitalize tracking-wide mb-2">
              {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
            <h1 className="text-3xl font-black text-white leading-tight">
              {saludo},<br />
              <span className="text-dorado">{nombreAdmin}</span>
            </h1>
            <p className="mt-2 text-white/55 text-sm">
              Administrador del sistema
            </p>
            <button
              onClick={() => nav('/admin/reportes')}
              className="mt-5 inline-flex items-center gap-2 bg-dorado text-marino text-sm font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-dorado/20"
            >
              Ver reportes <ChevronRight size={14} />
            </button>
          </div>

          <div className="hidden sm:block flex-shrink-0 w-32 h-32 sm:w-44 sm:h-44 opacity-90 select-none pointer-events-none">
            <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="80" cy="85" r="62" fill="white" fillOpacity="0.04"/>
              <rect x="30" y="50" width="60" height="75" rx="6" fill="#c9a227" fillOpacity="0.20"/>
              <rect x="30" y="50" width="60" height="75" rx="6" stroke="#c9a227" strokeWidth="1.5" strokeOpacity="0.40"/>
              <rect x="38" y="62" width="44" height="5"  rx="2" fill="#c9a227" fillOpacity="0.70"/>
              <rect x="38" y="73" width="36" height="4"  rx="2" fill="white"   fillOpacity="0.30"/>
              <rect x="38" y="83" width="40" height="4"  rx="2" fill="white"   fillOpacity="0.25"/>
              <rect x="38" y="93" width="30" height="4"  rx="2" fill="white"   fillOpacity="0.20"/>
              <rect x="38" y="103" width="38" height="4" rx="2" fill="white"   fillOpacity="0.18"/>
              <circle cx="110" cy="62" r="22" fill="#c9a227" fillOpacity="0.85"/>
              <path d="M100 62 L108 70 L122 54" stroke="#0a1f3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M140 28 L142.5 35 L150 35 L144 39.5 L146.5 46.5 L140 42 L133.5 46.5 L136 39.5 L130 35 L137.5 35 Z"
                fill="#c9a227" fillOpacity="0.50"/>
              <circle cx="32" cy="62" r="5" fill="white" fillOpacity="0.10"/>
              <circle cx="20" cy="80" r="3" fill="white" fillOpacity="0.07"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Stats por nivel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {niveles.map((n) => (
          <div key={n.nivel} className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-marino">{n.nivel}</h3>
              <span className="badge-gris text-xs">{n.porcentaje}%</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-green-600">{n.puntuales}</p>
                <p className="text-xs text-gray-400">Puntuales</p>
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-600">{n.tardanzas}</p>
                <p className="text-xs text-gray-400">Tardanzas</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{n.faltas}</p>
                <p className="text-xs text-gray-400">Faltas</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-dorado h-2 rounded-full" style={{ width: `${n.porcentaje}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grafico semana */}
      {asistenciaSemana.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-marino mb-4 flex items-center gap-2">
            <TrendingUp size={16} /> Asistencia diaria — semana actual
          </h3>
          <div className="flex items-end gap-3 h-32">
            {asistenciaSemana.map((d) => {
              const altura = Math.max(10, (d.porcentaje / 100) * 100)
              return (
                <div key={d.dia} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{d.porcentaje}%</span>
                  <div className="w-full bg-dorado rounded-t-md" style={{ height: `${altura}%` }} />
                  <span className="text-xs text-gray-400">{d.dia}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-semibold text-marino mb-3 flex items-center gap-2">
            <Clock size={15} className="text-yellow-500" /> Top 5 tardanzas del mes
          </h3>
          {topTardanzas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {topTardanzas.map((a, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="text-sm text-gray-700">{a.nombre_completo}</span>
                  </div>
                  <span className="badge-amarillo">{a.cantidad}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-marino mb-3 flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500" /> Top 5 faltas del mes
          </h3>
          {topFaltas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {topFaltas.map((a, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="text-sm text-gray-700">{a.nombre_completo}</span>
                  </div>
                  <span className="badge-rojo">{a.cantidad}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accesos rapidos */}
      <div className="card">
        <h3 className="font-semibold text-marino mb-4">Accesos rapidos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/estudiantes', label: 'Gestionar estudiantes', color: 'bg-blue-50 text-blue-700' },
            { href: '/admin/horarios',    label: 'Horarios',              color: 'bg-green-50 text-green-700' },
            { href: '/admin/calendario',  label: 'Calendario escolar',    color: 'bg-yellow-50 text-yellow-700' },
            { href: '/admin/reportes',    label: 'Reportes',              color: 'bg-purple-50 text-purple-700' },
          ].map(({ href, label, color }) => (
            <button key={href} onClick={() => nav(href)} className={`${color} rounded-xl p-4 text-sm font-semibold text-center active:scale-[0.97] transition-all`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
