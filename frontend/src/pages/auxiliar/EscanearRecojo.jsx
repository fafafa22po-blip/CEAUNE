import { useState, useCallback, useEffect } from 'react'
import {
  CheckCircle2, Clock, Users, RefreshCw, ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const hoy   = new Date(); hoy.setHours(0,0,0,0)
  const ayer  = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (d.getTime() === hoy.getTime())  return 'Hoy'
  if (d.getTime() === ayer.getTime()) return 'Ayer'
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long' })
}

function Avatar({ foto_url, nombre, className = '' }) {
  if (foto_url) return <img src={foto_url} alt={nombre} className={`object-cover ${className}`} />
  return (
    <div className={`flex items-center justify-center font-bold text-gray-400 bg-gray-100 ${className}`}>
      {nombre?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}

function StatCard({ valor, label, color, icon: Icon }) {
  const paleta = {
    marino: 'bg-[#0a1f3d] text-white',
    green:  'bg-green-600 text-white',
    amber:  'bg-amber-500 text-white',
  }
  return (
    <div className={`${paleta[color]} rounded-2xl p-3.5 flex flex-col gap-1 flex-1`}>
      <div className="flex items-center justify-between">
        <span className="text-3xl font-black leading-none">{valor}</span>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
      <span className="text-xs font-medium opacity-80 leading-tight">{label}</span>
    </div>
  )
}

function FilaRecojo({ estudiante, responsable, hora }) {
  const aula = estudiante.nivel === 'inicial'
    ? `${estudiante.grado} años · Aula ${estudiante.seccion}`
    : `${estudiante.grado}° "${estudiante.seccion}"`
  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Foto alumno */}
      <Avatar foto_url={estudiante.foto_url} nombre={estudiante.nombre}
        className="w-10 h-10 rounded-xl flex-shrink-0" />
      {/* Info alumno */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-tight truncate">
          {estudiante.nombre} {estudiante.apellido}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{aula}</p>
        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-green-500 flex-shrink-0" />
          {responsable.nombre} {responsable.apellido}
          <span className="text-gray-300">·</span>
          <span className="capitalize">{responsable.parentesco}</span>
        </p>
      </div>
      {/* Hora */}
      <span className="text-xs font-mono text-gray-400 flex-shrink-0">{hora}</span>
    </div>
  )
}

// ── Tab: Hoy ─────────────────────────────────────────────────────────────────
function TabHoy() {
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/recojo/resumen-hoy')
      setDatos(data)
    } catch {
      toast.error('No se pudo cargar el resumen de hoy')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {datos && (
          <p className="text-xs text-gray-400 capitalize">
            {new Date(datos.fecha + 'T00:00:00').toLocaleDateString('es-PE', {
              weekday: 'long', day: '2-digit', month: 'long',
            })}
          </p>
        )}
        <button onClick={cargar} disabled={cargando}
          className="ml-auto w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {cargando && !datos && (
        <div className="flex gap-3">
          {[1,2,3].map(i => <div key={i} className="flex-1 h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {datos && (
        <div className="flex gap-3">
          <StatCard valor={datos.total_presentes}  label="Presentes hoy"  color="marino" icon={Users}        />
          <StatCard valor={datos.total_recogidos}  label="Ya recogidos"   color="green"  icon={CheckCircle2} />
          <StatCard valor={datos.total_pendientes} label="Pendientes"     color="amber"  icon={Clock}        />
        </div>
      )}

      {datos?.pendientes?.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-50">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-800">
              Pendientes de recojo
              <span className="ml-2 text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full">
                {datos.pendientes.length}
              </span>
            </p>
          </div>
          <div className="divide-y divide-gray-50 px-4">
            {datos.pendientes.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Avatar foto_url={p.estudiante?.foto_url} nombre={p.estudiante?.nombre}
                  className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                    {p.estudiante?.nombre} {p.estudiante?.apellido}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.estudiante?.nivel === 'inicial'
                      ? `${p.estudiante?.grado} años · Aula ${p.estudiante?.seccion}`
                      : `${p.estudiante?.grado}° "${p.estudiante?.seccion}"`}
                  </p>
                  {p.hora_ingreso && (
                    <p className="text-xs text-green-600 mt-0.5">Ingresó {p.hora_ingreso}</p>
                  )}
                </div>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
                  Esperando
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {datos?.recogidos?.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-green-100 bg-green-50">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-sm font-bold text-green-800">
              Ya recogidos
              <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                {datos.recogidos.length}
              </span>
            </p>
          </div>
          <div className="divide-y divide-gray-50 px-4">
            {datos.recogidos.map((r, i) => (
              <FilaRecojo key={i}
                estudiante={r.estudiante}
                responsable={r.responsable}
                hora={r.hora} />
            ))}
          </div>
        </div>
      )}

      {datos && datos.total_presentes === 0 && (
        <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Sin ingresos registrados hoy</p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Semana / Mes ─────────────────────────────────────────────────────────
function TabPeriodo({ periodo }) {
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/recojo/resumen-periodo', { params: { periodo } })
      setDatos(data)
    } catch {
      toast.error('No se pudo cargar el resumen')
    } finally {
      setCargando(false)
    }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  if (cargando) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  if (!datos) return null

  const desde = new Date(datos.desde + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long' })
  const hasta = new Date(datos.hasta + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{desde} — {hasta}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#0a1f3d] bg-[#0a1f3d]/10 px-3 py-1 rounded-full">
            {datos.total} recogidos
          </span>
          <button onClick={cargar}
            className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {datos.por_fecha.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
          <ShieldCheck className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Sin recojos registrados en este período</p>
        </div>
      ) : (
        datos.por_fecha.map(({ fecha, items }) => (
          <div key={fecha} className="card overflow-hidden p-0">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700 capitalize">{fmtFecha(fecha)}</p>
              <span className="text-[10px] font-bold text-gray-400">{items.length} recogidos</span>
            </div>
            <div className="divide-y divide-gray-50 px-4">
              {items.map((r, i) => (
                <FilaRecojo key={i}
                  estudiante={r.estudiante}
                  responsable={r.responsable}
                  hora={r.hora} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EscanearRecojo() {
  const [tab, setTab] = useState('hoy')

  const tabs = [
    { id: 'hoy',    label: 'Hoy'    },
    { id: 'semana', label: 'Semana' },
    { id: 'mes',    label: 'Mes'    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marino">Recojo Seguro</h1>
          <p className="text-xs text-gray-400 mt-0.5">Historial de recojos confirmados</p>
        </div>
        <ShieldCheck className="w-7 h-7 text-[#0a1f3d] opacity-30" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-white text-[#0a1f3d] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      {tab === 'hoy'    && <TabHoy />}
      {tab === 'semana' && <TabPeriodo periodo="semana" />}
      {tab === 'mes'    && <TabPeriodo periodo="mes" />}
    </div>
  )
}
