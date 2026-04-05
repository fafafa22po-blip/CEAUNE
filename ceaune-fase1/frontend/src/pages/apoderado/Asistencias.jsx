import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import api from '../../lib/api'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

// ─── Tarjeta resumen ─────────────────────────────────────────────────────────
function ResumenCard({ icon, label, value, sub, color }) {
  const colors = {
    navy:   'bg-ceaune-navy text-white',
    green:  'bg-green-50 border border-green-100 text-green-700',
    yellow: 'bg-yellow-50 border border-yellow-100 text-yellow-700',
    red:    'bg-red-50 border border-red-100 text-red-700',
  }
  return (
    <div className={`rounded-xl p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{icon}</span>
        <span className="text-4xl font-bold tabular-nums">{value ?? '—'}</span>
      </div>
      <p className={`text-sm font-semibold ${color === 'navy' ? 'text-blue-200' : 'opacity-80'}`}>{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${color === 'navy' ? 'text-blue-300' : 'opacity-60'}`}>{sub}</p>}
    </div>
  )
}

// ─── Ítem del timeline ────────────────────────────────────────────────────────
function TimelineItem({ registro, showFecha, isLast }) {
  const esIngreso = registro.tipo.includes('ingreso')
  const esFalta   = registro.estado === 'falta'

  const estadoConfig = {
    puntual:  { dot: 'bg-green-500',  badge: 'badge-puntual',  label: 'Puntual'  },
    tardanza: { dot: 'bg-yellow-500', badge: 'badge-tardanza', label: 'Tardanza' },
    falta:    { dot: 'bg-red-500',    badge: 'badge-falta',    label: 'Falta'    },
    especial: { dot: 'bg-blue-500',   badge: 'badge-especial', label: 'Especial' },
  }
  const cfg = estadoConfig[registro.estado] || estadoConfig.especial

  const hora = esFalta
    ? '—'
    : new Date(registro.hora).toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' })

  const fecha = new Date(registro.fecha + 'T00:00:00').toLocaleDateString('es-PE', {
    weekday:'long', day:'numeric', month:'long'
  })

  return (
    <div className="flex gap-4">
      {/* Línea de tiempo */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-3 h-3 rounded-full mt-1.5 ring-2 ring-white ${cfg.dot}`} />
        {!isLast && <div className="w-0.5 bg-gray-100 flex-1 mt-1" />}
      </div>

      {/* Contenido */}
      <div className={`flex-1 pb-5 ${isLast ? '' : ''}`}>
        {showFecha && (
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">
            {fecha}
          </p>
        )}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">{esFalta ? '❌' : esIngreso ? '↗' : '↙'}</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {esFalta
                  ? 'Falta'
                  : esIngreso ? 'Ingreso' : 'Salida'}
                {registro.tipo.includes('especial') && !esFalta && (
                  <span className="ml-1 text-xs text-gray-400">(especial)</span>
                )}
              </p>
              <p className="text-xs text-gray-400 tabular-nums">{hora}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={cfg.badge}>{cfg.label}</span>
            {registro.correo_enviado && (
              <span title="Notificación enviada" className="text-green-500 text-sm">✉️</span>
            )}
          </div>
          {registro.observacion && (
            <p className="w-full text-xs text-gray-400 italic border-t border-gray-50 pt-2 mt-1">
              {registro.observacion}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Selector de hijo ─────────────────────────────────────────────────────────
function SelectorHijo({ hijos, hijoActivo, onChange }) {
  if (hijos.length <= 1) return null
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {hijos.map(h => (
        <button
          key={h.id}
          onClick={() => onChange(h)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            hijoActivo?.id === h.id
              ? 'bg-ceaune-navy text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-ceaune-gold'
          }`}
        >
          {h.nombre} {h.apellido}
        </button>
      ))}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Asistencias() {
  const hoyDate = new Date()
  const [hijos,       setHijos]       = useState([])
  const [hijoActivo,  setHijoActivo]  = useState(null)
  const [registros,   setRegistros]   = useState([])
  const [resumen,     setResumen]     = useState(null)
  const [mes,         setMes]         = useState(hoyDate.getMonth() + 1)
  const [anio,        setAnio]        = useState(hoyDate.getFullYear())
  const [loading,     setLoading]     = useState(true)
  const [loadingDatos,setLoadingDatos]= useState(false)

  // Cargar hijos al montar
  useEffect(() => {
    api.get('/apoderado/mis-hijos')
      .then(({ data }) => {
        setHijos(data)
        if (data.length > 0) setHijoActivo(data[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Cargar registros y resumen cuando cambia hijo/mes/año
  const fetchDatos = useCallback(async () => {
    if (!hijoActivo) return
    setLoadingDatos(true)
    try {
      const [r1, r2] = await Promise.all([
        api.get(`/apoderado/hijo/${hijoActivo.id}/asistencias?mes=${mes}&anio=${anio}`),
        api.get(`/apoderado/hijo/${hijoActivo.id}/resumen-mes?mes=${mes}&anio=${anio}`),
      ])
      setRegistros(r1.data)
      setResumen(r2.data)
    } catch (e) { console.error(e) }
    finally { setLoadingDatos(false) }
  }, [hijoActivo, mes, anio])

  useEffect(() => { fetchDatos() }, [fetchDatos])

  // Agrupar registros por fecha para el timeline
  const registrosPorFecha = registros.reduce((acc, r) => {
    const key = r.fecha
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const fechas = Object.keys(registrosPorFecha).sort((a, b) => b.localeCompare(a))

  // Años disponibles (año actual y 2 anteriores)
  const anios = [hoyDate.getFullYear(), hoyDate.getFullYear()-1, hoyDate.getFullYear()-2]

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <svg className="animate-spin h-8 w-8 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      </Layout>
    )
  }

  if (hijos.length === 0) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <p className="text-6xl mb-4">👶</p>
          <h2 className="text-xl font-bold text-ceaune-navy mb-2">Sin hijos registrados</h2>
          <p className="text-gray-400 text-sm">
            No tienes ningún alumno vinculado a tu cuenta.<br/>
            Comunícate con secretaría para vincular a tu hijo/a.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ceaune-navy">Asistencias</h1>
          <p className="text-gray-400 text-sm mt-0.5">Secundaria CEAUNE</p>
        </div>

        {/* Selector de hijo (si tiene más de uno) */}
        <SelectorHijo hijos={hijos} hijoActivo={hijoActivo} onChange={setHijoActivo} />

        {/* Info del alumno */}
        {hijoActivo && (
          <div className="bg-ceaune-navy text-white rounded-2xl px-6 py-4 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ceaune-gold/20 border-2 border-ceaune-gold/40 flex items-center justify-center text-2xl font-bold text-ceaune-gold flex-shrink-0">
              {hijoActivo.nombre?.[0]}{hijoActivo.apellido?.[0]}
            </div>
            <div>
              <p className="text-xl font-bold">{hijoActivo.nombre} {hijoActivo.apellido}</p>
              <p className="text-blue-300 text-sm">
                {hijoActivo.grado} &lsquo;{hijoActivo.seccion}&rsquo; &mdash; Secundaria
              </p>
            </div>
          </div>
        )}

        {/* Filtro mes/año */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="text-sm text-gray-700 focus:outline-none bg-transparent"
            >
              {MESES.map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
            <select
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              className="text-sm text-gray-700 focus:outline-none bg-transparent"
            >
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <span className="text-sm text-gray-400">
            {registros.length} registro(s)
          </span>
        </div>

        {/* Cards resumen del mes */}
        {resumen && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <ResumenCard
              icon="📊" label="Asistencia" color="navy"
              value={`${resumen.porcentaje_asistencia}%`}
              sub={`${resumen.dias_registrados} días`}
            />
            <ResumenCard
              icon="✅" label="Puntuales" color="green"
              value={resumen.puntuales}
            />
            <ResumenCard
              icon="⚠️" label="Tardanzas" color="yellow"
              value={resumen.tardanzas}
            />
            <ResumenCard
              icon="❌" label="Faltas" color="red"
              value={resumen.faltas}
            />
          </div>
        )}

        {/* Timeline */}
        {loadingDatos ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : fechas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📭</p>
            <p className="font-medium">Sin registros en {MESES[mes-1]} {anio}</p>
            <p className="text-sm mt-1">Cambia el mes o el año para ver otros períodos</p>
          </div>
        ) : (
          <div className="space-y-0">
            {fechas.map(fecha => {
              const regs = registrosPorFecha[fecha]
              return regs.map((r, i) => (
                <TimelineItem
                  key={r.id}
                  registro={r}
                  showFecha={i === 0}
                  isLast={
                    fecha === fechas[fechas.length - 1] &&
                    i === regs.length - 1
                  }
                />
              ))
            })}
          </div>
        )}

      </div>
    </Layout>
  )
}
