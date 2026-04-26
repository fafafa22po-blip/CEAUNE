import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { abrirWhatsApp } from '../../lib/externo'
import {
  Users, Phone, ChevronLeft, ChevronRight, ArrowLeft,
  XCircle, Clock, CheckCircle2, FileText, AlertTriangle, BookOpen, Award,
  Download,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import toast from 'react-hot-toast'

// ── Configs de eventos ─────────────────────────────────────────────────────────
const OBS_CFG = {
  academica:  { label: 'Académica',  Icon: BookOpen,      bg: 'bg-indigo-50', border: 'border-indigo-100', color: 'text-indigo-600' },
  conductual: { label: 'Conductual', Icon: AlertTriangle,  bg: 'bg-orange-50', border: 'border-orange-100', color: 'text-orange-600' },
  salud:      { label: 'Salud',      Icon: FileText,       bg: 'bg-red-50',    border: 'border-red-100',    color: 'text-red-600'    },
  logro:      { label: 'Logro',      Icon: Award,          bg: 'bg-green-50',  border: 'border-green-100',  color: 'text-green-600'  },
  otro:       { label: 'Otro',       Icon: FileText,       bg: 'bg-gray-50',   border: 'border-gray-100',   color: 'text-gray-500'   },
}

const JUST_CFG = {
  pendiente: { label: 'Pendiente de revisión',  Icon: Clock,        bg: 'bg-yellow-50', border: 'border-yellow-200', color: 'text-yellow-700' },
  aprobada:  { label: 'Justificación aprobada', Icon: CheckCircle2, bg: 'bg-green-50',  border: 'border-green-200',  color: 'text-green-700'  },
  rechazada: { label: 'Justificación rechazada',Icon: XCircle,      bg: 'bg-red-50',    border: 'border-red-200',    color: 'text-red-700'    },
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const FILTROS = [
  { key: 'todos',         label: 'Todos'           },
  { key: 'falta',         label: 'Faltas'          },
  { key: 'tardanza',      label: 'Tardanzas'       },
  { key: 'observacion',   label: 'Observaciones'   },
  { key: 'justificacion', label: 'Justificaciones' },
]

// ── Helpers de color ───────────────────────────────────────────────────────────
const pctColor = p => p >= 90 ? 'text-green-600'  : p >= 75 ? 'text-amber-600'  : 'text-red-600'
const pctBg    = p => p >= 90 ? 'bg-green-100'    : p >= 75 ? 'bg-amber-100'    : 'bg-red-100'
const pctBar   = p => p >= 90 ? 'bg-green-500'    : p >= 75 ? 'bg-amber-400'    : 'bg-red-500'
const avatarBg = p => p >= 90
  ? 'bg-green-100 text-green-700'
  : p >= 75 ? 'bg-amber-100 text-amber-700'
  : 'bg-red-100 text-red-700'

// ── Componente de evento individual ───────────────────────────────────────────
function EventoCard({ evento }) {
  const fechaLabel = evento.fecha
    ? format(parseISO(evento.fecha), "EEEE d 'de' MMMM", { locale: es })
    : ''
  const horaLabel = evento.hora ? evento.hora.slice(11, 16) : null

  if (evento.tipo === 'falta') {
    return (
      <div className="flex gap-3 px-4 py-4 bg-red-50 rounded-2xl border border-red-100">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <XCircle size={20} className="text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-red-700">Falta</p>
            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 capitalize">{fechaLabel}</span>
          </div>
          <p className="text-xs text-red-500 mt-0.5">No se registró ingreso en este día</p>
        </div>
      </div>
    )
  }

  if (evento.tipo === 'tardanza') {
    return (
      <div className="flex gap-3 px-4 py-4 bg-amber-50 rounded-2xl border border-amber-100">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Clock size={20} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-amber-700">Tardanza</p>
            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 capitalize">{fechaLabel}</span>
          </div>
          <p className="text-xs text-amber-600 mt-0.5">
            Ingresó a las <strong>{horaLabel || 'hora no registrada'}</strong>
            {evento.detalle?.observacion && ` · ${evento.detalle.observacion}`}
          </p>
        </div>
      </div>
    )
  }

  if (evento.tipo === 'observacion') {
    const cfg = OBS_CFG[evento.detalle?.subtipo] || OBS_CFG.otro
    const { Icon } = cfg
    return (
      <div className={`flex gap-3 px-4 py-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
        <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 mt-0.5 border ${cfg.border}`}>
          <Icon size={18} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-700">Observación</p>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white border ${cfg.border} ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 capitalize">{fechaLabel}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{evento.detalle?.descripcion}</p>
          {evento.detalle?.enviado_apoderado && (
            <p className="text-[11px] text-green-600 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={11} /> Notificado al apoderado
            </p>
          )}
        </div>
      </div>
    )
  }

  if (evento.tipo === 'justificacion') {
    const cfg = JUST_CFG[evento.detalle?.estado] || JUST_CFG.pendiente
    const { Icon } = cfg
    return (
      <div className={`flex gap-3 px-4 py-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
        <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 mt-0.5 border ${cfg.border}`}>
          <Icon size={18} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</p>
            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 capitalize">{fechaLabel}</span>
          </div>
          {evento.detalle?.motivo && (
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{evento.detalle.motivo}</p>
          )}
          {evento.detalle?.observacion_revision && (
            <p className="text-xs text-gray-500 mt-1 italic border-l-2 border-gray-200 pl-2">
              "{evento.detalle.observacion_revision}"
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ── Anillo de progreso circular ───────────────────────────────────────────────
function CircularProgress({ pct }) {
  const r    = 48
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const stroke = pct >= 90 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#ef4444'
  const trackColor = pct >= 90 ? '#dcfce7' : pct >= 75 ? '#fef3c7' : '#fee2e2'

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke={trackColor} strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className={`text-2xl font-black tabular-nums leading-none ${pctColor(pct)}`}>
          {pct}%
        </span>
        <span className="text-[10px] text-gray-400 tracking-wide">asistencia</span>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Seguimiento() {
  const [seleccionado, setSeleccionado] = useState(null)
  const [busqueda,     setBusqueda]     = useState('')
  const [mes,  setMes]  = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [filtro,      setFiltro]      = useState('todos')
  const [cargandoPDF, setCargandoPDF] = useState(false)

  // ── Queries (caché compartida con Inicio.jsx y MiAula.jsx) ────────────────
  const { data: estudiantes = [], isLoading: cargandoLista } = useQuery({
    queryKey: QK.tutorEstudiantes(),
    queryFn: () => api.get('/tutor/mi-aula/estudiantes').then(r => r.data?.estudiantes || []),
  })

  const { data: estadisticas = [] } = useQuery({
    queryKey: QK.tutorEstadisticas(),
    queryFn: () => api.get('/tutor/mi-aula/estadisticas').then(r => r.data?.estudiantes || []),
  })

  const { data: seguimiento, isFetching: cargandoTimeline, isError: errorTimeline } = useQuery({
    queryKey: QK.tutorSeguimiento(seleccionado?.id, mes, anio),
    queryFn: () => api.get(`/tutor/estudiante/${seleccionado.id}/seguimiento`, { params: { mes, anio } })
      .then(r => r.data),
    enabled: !!seleccionado,
  })

  // ── Derivados ─────────────────────────────────────────────────────────────
  const statsMap = {}
  const _estadArr = Array.isArray(estadisticas) ? estadisticas : []
  _estadArr.forEach(e => { statsMap[e.id] = e })

  const filtrados = estudiantes.filter(e => {
    const q = busqueda.toLowerCase().trim()
    return !q || `${e.nombre} ${e.apellido}`.toLowerCase().includes(q)
  })

  const conteos = useMemo(() => {
    const evs = Array.isArray(seguimiento?.eventos) ? seguimiento.eventos : []
    if (!evs.length) return {}
    return evs.reduce((acc, e) => {
      acc[e.tipo] = (acc[e.tipo] || 0) + 1
      return acc
    }, {})
  }, [seguimiento])

  const eventosFiltrados = useMemo(() => {
    const evs = Array.isArray(seguimiento?.eventos) ? seguimiento.eventos : []
    if (filtro === 'todos') return evs
    return evs.filter(e => e.tipo === filtro)
  }, [seguimiento, filtro])

  // ── Acciones ──────────────────────────────────────────────────────────────
  const seleccionar = (est) => {
    setSeleccionado(est)
    setFiltro('todos')
  }

  const cambiarMes = (delta) => {
    const hoy = new Date()
    let nm = mes + delta
    let na = anio
    if (nm < 1)  { nm = 12; na-- }
    if (nm > 12) { nm = 1;  na++ }
    if (na > hoy.getFullYear() || (na === hoy.getFullYear() && nm > hoy.getMonth() + 1)) return
    setMes(nm)
    setAnio(na)
    setFiltro('todos')
  }

  const volver = () => {
    setSeleccionado(null)
    setMes(new Date().getMonth() + 1)
    setAnio(new Date().getFullYear())
    setFiltro('todos')
  }

  const descargarPDF = async () => {
    setCargandoPDF(true)
    try {
      const resp = await api.get(
        `/tutor/estudiante/${seleccionado.id}/reporte-pdf`,
        { params: { mes, anio }, responseType: 'blob', timeout: 40000 },
      )
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a   = document.createElement('a')
      a.href     = url
      a.download = `Reporte_${seleccionado.apellido}_${seleccionado.nombre}_${MESES[mes - 1]}${anio}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al generar el reporte PDF')
    } finally {
      setCargandoPDF(false)
    }
  }

  const isFuturo = anio > new Date().getFullYear() ||
    (anio === new Date().getFullYear() && mes > new Date().getMonth() + 1)

  // ── VISTA: Lista de alumnos ───────────────────────────────────────────────
  if (!seleccionado) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-marino">Seguimiento del Alumno</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Selecciona un alumno para ver su historial de asistencia y observaciones
          </p>
        </div>

        <div className="relative">
          <Users size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Escribe el nombre o apellido del alumno…"
            className="input w-full pl-10 py-3 text-sm"
          />
        </div>

        {cargandoLista ? (
          <div className="flex items-center justify-center h-52 text-gray-400">
            <span className="w-6 h-6 border-2 border-dorado border-t-transparent rounded-full animate-spin mr-3" />
            Cargando alumnos…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtrados.map(est => {
              const stats = statsMap[est.id]
              const pct   = stats?.porcentaje ?? 0
              return (
                <button
                  key={est.id}
                  onClick={() => seleccionar(est)}
                  className="card text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0 ${
                      stats ? avatarBg(pct) : 'bg-gray-100 text-gray-500'
                    }`}>
                      {est.apellido?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-marino truncate">{est.apellido}</p>
                      <p className="text-sm text-gray-400 truncate">{est.nombre}</p>
                    </div>
                    {stats && (
                      <span className={`text-sm font-black px-2.5 py-1 rounded-xl flex-shrink-0 tabular-nums ${pctBg(pct)} ${pctColor(pct)}`}>
                        {pct}%
                      </span>
                    )}
                  </div>

                  {stats && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`${pctBar(pct)} h-1.5 rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {stats.faltas > 0
                          ? `${stats.faltas} ${stats.faltas === 1 ? 'falta' : 'faltas'} este mes`
                          : 'Sin faltas este mes'}
                        {stats.tardanzas > 0 && ` · ${stats.tardanzas} tardanza${stats.tardanzas !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end">
                    <span className="text-xs text-dorado font-semibold group-hover:underline flex items-center gap-1">
                      Ver historial <ChevronRight size={13} />
                    </span>
                  </div>
                </button>
              )
            })}

            {filtrados.length === 0 && (
              <div className="col-span-full card text-center py-16 text-gray-400">
                <Users size={36} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">No se encontró ningún alumno</p>
                <p className="text-xs mt-1">Intenta con otro nombre o apellido</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── VISTA: Perfil + Timeline del alumno ───────────────────────────────────
  const stats = seguimiento?.estadisticas

  return (
    <div className="space-y-5">

      <div className="flex items-center gap-3">
        <button
          onClick={volver}
          className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
          title="Volver a la lista"
        >
          <ArrowLeft size={18} className="text-marino" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-marino leading-tight truncate">
            {seleccionado.apellido}, {seleccionado.nombre}
          </h1>
          <p className="text-xs text-gray-400">Historial del alumno</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-4">

        {/* ─── Panel izquierdo ─────────────────────────────────────────── */}
        <div className="lg:w-72 xl:w-80 flex-shrink-0 lg:sticky lg:top-0 space-y-4">

          <div className="card flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0 ${
              stats ? avatarBg(stats.porcentaje) : 'bg-gray-100 text-gray-400'
            }`}>
              {seleccionado.apellido?.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-black text-marino text-base leading-tight truncate">
                {seleccionado.apellido}
              </p>
              <p className="text-sm text-gray-500 truncate">{seleccionado.nombre}</p>
            </div>
          </div>

          {stats ? (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Asistencia</p>
                <span className="text-xs text-gray-400">{MESES[mes - 1]} {anio}</span>
              </div>
              <CircularProgress pct={stats.porcentaje} />
              <div className="border-t border-gray-100" />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Presentes', val: stats.presentes, color: 'text-green-600', bg: 'bg-green-50'  },
                  { label: 'Tardanzas', val: stats.tardanzas, color: 'text-amber-600', bg: 'bg-amber-50'  },
                  { label: 'Faltas',    val: stats.faltas,    color: 'text-red-600',   bg: 'bg-red-50'    },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl py-3 flex flex-col items-center gap-0.5`}>
                    <p className={`text-xl font-black tabular-nums leading-none ${color}`}>{val}</p>
                    <p className="text-[10px] text-gray-400 text-center mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !cargandoTimeline && (
              <div className="card flex items-center justify-center h-48 text-gray-300">
                <span className="text-sm">Sin estadísticas</span>
              </div>
            )
          )}

          {seguimiento?.apoderados?.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-gray-400" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Apoderados</p>
              </div>
              <div className="space-y-2">
                {seguimiento.apoderados.map(ap =>
                  ap.telefono ? (
                    <button
                      key={ap.id}
                      type="button"
                      onClick={() => abrirWhatsApp(ap.telefono)}
                      className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors group w-full text-left"
                    >
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone size={13} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-800 truncate">{ap.nombre}</p>
                        <p className="text-xs text-green-600">{ap.telefono}</p>
                      </div>
                      <ChevronRight size={14} className="text-green-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                    </button>
                  ) : (
                    <div
                      key={ap.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl opacity-50"
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone size={13} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-500 truncate">{ap.nombre}</p>
                        <p className="text-xs text-gray-400">Sin número registrado</p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <button
            onClick={descargarPDF}
            disabled={cargandoPDF || !seguimiento}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-marino text-white text-sm font-semibold rounded-xl hover:bg-marino/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargandoPDF ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Generando PDF…
              </>
            ) : (
              <>
                <Download size={16} />
                <span>
                  Reporte PDF
                  <span className="font-normal opacity-75 ml-1">— {MESES[mes - 1]} {anio}</span>
                </span>
              </>
            )}
          </button>
        </div>

        {/* ─── Panel derecho: Timeline ──────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="card space-y-4">

            <div className="flex items-center justify-between">
              <button
                onClick={() => cambiarMes(-1)}
                className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <ChevronLeft size={18} className="text-marino" />
              </button>
              <span className="font-bold text-marino text-sm">
                {MESES[mes - 1]} {anio}
              </span>
              <button
                onClick={() => cambiarMes(1)}
                disabled={isFuturo}
                className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} className="text-marino" />
              </button>
            </div>

            <div className="border-t border-gray-100" />

            {!cargandoTimeline && seguimiento && (
              <div className="flex flex-wrap gap-2">
                {FILTROS.map(f => {
                  const count = f.key === 'todos'
                    ? (seguimiento.eventos?.length ?? 0)
                    : (conteos[f.key] ?? 0)
                  const isActive = filtro === f.key
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFiltro(f.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-marino text-white shadow-sm'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {f.label}
                      <span className={`text-[10px] font-black tabular-nums min-w-[16px] text-center leading-none px-1 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-gray-500 border border-gray-200'
                      }`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {!cargandoTimeline && seguimiento && (
              <div className="border-t border-gray-100" />
            )}

            {cargandoTimeline ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <span className="w-6 h-6 border-2 border-dorado border-t-transparent rounded-full animate-spin mr-3" />
                Cargando historial…
              </div>
            ) : errorTimeline ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm text-center">
                No se pudo cargar el historial.<br />
                <span className="text-xs mt-1 block">Verifica la conexión e intenta de nuevo.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {eventosFiltrados.length === 0 && filtro === 'todos' && (
                  <div className="text-center py-14">
                    <CheckCircle2 size={36} className="mx-auto mb-3 text-green-400" />
                    <p className="font-bold text-green-700">Sin incidencias este mes</p>
                    <p className="text-xs text-gray-400 mt-1">
                      El alumno no registra faltas ni observaciones en {MESES[mes - 1].toLowerCase()}
                    </p>
                  </div>
                )}
                {eventosFiltrados.length === 0 && filtro !== 'todos' && (
                  <div className="text-center py-14">
                    <FileText size={36} className="mx-auto mb-3 text-gray-200" />
                    <p className="font-medium text-gray-400">
                      Sin {FILTROS.find(f => f.key === filtro)?.label.toLowerCase()} en {MESES[mes - 1].toLowerCase()}
                    </p>
                  </div>
                )}
                {eventosFiltrados.map((evento, idx) => (
                  <EventoCard key={evento.id ?? idx} evento={evento} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
