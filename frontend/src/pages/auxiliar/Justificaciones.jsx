import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, Paperclip, X, Clock,
  AlertCircle, ChevronLeft, ChevronRight, Calendar, FileText,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow, isToday, isYesterday, differenceInHours } from 'date-fns'
import { es } from 'date-fns/locale'

const FILTROS      = ['pendiente', 'aprobada', 'rechazada']
const LABEL_FILTRO = { pendiente: 'Pendientes', aprobada: 'Aprobadas', rechazada: 'Rechazadas' }

const NIVEL_COLOR = {
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100 text-blue-700',
  secundaria: 'bg-amber-100 text-amber-700',
}
const NIVEL_LABEL = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' }

function formatFechaFalta(fecha) {
  if (!fecha) return '—'
  return format(new Date(fecha), "d 'de' MMMM yyyy", { locale: es })
}

function formatFechaRelativa(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (isToday(d))     return `Hoy a las ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Ayer a las ${format(d, 'HH:mm')}`
  return formatDistanceToNow(d, { addSuffix: true, locale: es })
}

function esUrgente(created_at) {
  if (!created_at) return false
  return differenceInHours(new Date(), new Date(created_at)) > 48
}

// ── Fila compacta de la lista ─────────────────────────────────────────────────
function FilaJustificacion({ j, activa, onClick }) {
  const nivel   = j.estudiante?.nivel || 'primaria'
  const urgente = j.estado === 'pendiente' && esUrgente(j.created_at)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 transition-all border-l-[3px] ${
        activa
          ? 'bg-amber-50 border-dorado'
          : urgente
          ? 'bg-red-50/50 border-red-400 hover:bg-red-50/70'
          : 'border-transparent hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar con inicial */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
          {j.estudiante?.nombre?.[0] ?? '?'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Nombre + grado */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {j.estudiante?.nombre} {j.estudiante?.apellido}
            </p>
            {j.estudiante?.grado && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-marino text-white tabular-nums">
                {j.estudiante.grado}° {j.estudiante.seccion}
              </span>
            )}
          </div>

          {/* Fecha + tipo */}
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              j.asistencia?.estado === 'tardanza'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-600'
            }`}>
              {j.asistencia?.estado === 'tardanza' ? 'Tardanza' : 'Falta'}
            </span>
            {formatFechaFalta(j.asistencia?.fecha)}
          </p>

          {/* Motivo preview */}
          <p className="text-xs text-gray-400 mt-0.5 truncate">{j.motivo}</p>

          {/* Footer row: tiempo + adjunto + estado */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] ${urgente ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {formatFechaRelativa(j.created_at)}
            </span>
            {j.adjunto_drive_url && (
              <Paperclip size={10} className="text-dorado flex-shrink-0" />
            )}
            <div className="ml-auto">
              {urgente && j.estado === 'pendiente' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  +48h
                </span>
              )}
              {j.estado === 'aprobada' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Aprobada
                </span>
              )}
              {j.estado === 'rechazada' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Rechazada
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Panel de detalle ──────────────────────────────────────────────────────────
function PanelDetalle({ j, onVolver, onAprobar, onRechazar, procesando }) {
  if (!j) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4 h-full text-center px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <FileText size={28} className="text-gray-200" />
        </div>
        <div>
          <p className="font-semibold text-gray-400">Selecciona una justificación</p>
          <p className="text-xs text-gray-300 mt-1">Toca una fila para ver el detalle completo</p>
        </div>
      </div>
    )
  }

  const nivel   = j.estudiante?.nivel || 'primaria'
  const urgente = j.estado === 'pendiente' && esUrgente(j.created_at)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden animate-in">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 bg-marino text-white flex-shrink-0">
        <button
          className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
          onClick={onVolver}
        >
          <ChevronLeft size={19} />
        </button>

        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${NIVEL_COLOR[nivel]}`}>
          {j.estudiante?.nombre?.[0] ?? '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">
            {j.estudiante?.nombre} {j.estudiante?.apellido}
          </p>
          <p className="text-xs text-white/70 mt-0.5 flex items-center gap-1.5">
            {NIVEL_LABEL[nivel]}
            <span className="bg-dorado text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {j.estudiante?.grado}° {j.estudiante?.seccion}
            </span>
          </p>
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
          j.estado === 'aprobada'  ? 'bg-green-500/25 text-green-200' :
          j.estado === 'rechazada' ? 'bg-red-500/25 text-red-200'     :
                                     'bg-amber-400/25 text-amber-200'
        }`}>
          {j.estado === 'aprobada' ? '✓ Aprobada' : j.estado === 'rechazada' ? '✗ Rechazada' : '● Pendiente'}
        </span>
      </div>

      {/* ── Contenido scrollable ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* Fecha de la falta / tardanza */}
        {(() => {
          const esTardanza = j.asistencia?.estado === 'tardanza'
          return (
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
              esTardanza ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
            }`}>
              <Calendar size={18} className={`flex-shrink-0 ${esTardanza ? 'text-amber-400' : 'text-red-400'}`} />
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${esTardanza ? 'text-amber-500' : 'text-red-400'}`}>
                  {esTardanza ? 'Fecha de tardanza' : 'Fecha de inasistencia'}
                </p>
                <p className={`text-sm font-bold capitalize mt-0.5 ${esTardanza ? 'text-amber-700' : 'text-red-700'}`}>
                  {formatFechaFalta(j.asistencia?.fecha)}
                </p>
              </div>
            </div>
          )
        })()}

        {/* Motivo */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Motivo del apoderado
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5">
            <p className="text-sm text-gray-700 leading-relaxed">{j.motivo}</p>
          </div>
        </div>

        {/* Adjunto */}
        {j.adjunto_drive_url && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
              Documento adjunto
            </p>
            <a
              href={j.adjunto_drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-dorado/10 hover:bg-dorado/20 active:bg-dorado/30 border border-dorado/25 rounded-xl px-4 py-3 transition-colors"
            >
              <div className="w-9 h-9 bg-dorado rounded-xl flex items-center justify-center flex-shrink-0">
                <Paperclip size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-marino">Ver documento</p>
                {j.adjunto_nombre && (
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{j.adjunto_nombre}</p>
                )}
              </div>
              <ChevronRight size={14} className="text-dorado flex-shrink-0" />
            </a>
          </div>
        )}

        {/* Fecha de envío */}
        <p className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
          <Clock size={11} className="flex-shrink-0" />
          Enviado {formatFechaRelativa(j.created_at)}
          {urgente && (
            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
              +48h sin resolver
            </span>
          )}
        </p>

        {/* Motivo de rechazo */}
        {j.estado === 'rechazada' && j.observacion_revision && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-0.5">
                Motivo de rechazo
              </p>
              <p className="text-sm text-red-700 leading-relaxed">{j.observacion_revision}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer de acciones (solo pendiente) ── */}
      {j.estado === 'pendiente' && (
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4 bg-gray-50/60">
          <div className="flex gap-3">
            <button
              onClick={() => onRechazar(j)}
              disabled={procesando === j.id}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-700 font-semibold text-sm transition-colors disabled:opacity-50"
            >
              <XCircle size={16} /> Rechazar
            </button>
            <button
              onClick={() => onAprobar(j)}
              disabled={procesando === j.id}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {procesando === j.id
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><CheckCircle2 size={16} /> Aprobar</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal confirmación Aprobar ────────────────────────────────────────────────
function ModalAprobar({ j, onConfirmar, onCancelar, procesando }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onCancelar} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl animate-slide-up sm:animate-in z-10">

        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-6 pt-5 pb-6 space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
          </div>

          <div className="text-center">
            <h3 className="font-bold text-marino text-lg">¿Aprobar justificación?</h3>
            <p className="text-sm text-gray-600 font-medium mt-1">
              {j.estudiante?.nombre} {j.estudiante?.apellido}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              {j.asistencia?.estado === 'tardanza' ? 'Tardanza del' : 'Falta del'}{' '}
              {formatFechaFalta(j.asistencia?.fecha)}
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{j.motivo}</p>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            El apoderado recibirá una notificación de aprobación
          </p>

          <div className="flex gap-3">
            <button onClick={onCancelar} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={onConfirmar}
              disabled={procesando}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {procesando
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><CheckCircle2 size={15} /> Confirmar</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de rechazo ──────────────────────────────────────────────────────────
function ModalRechazo({ j, motivoRechazo, setMotivoRechazo, onConfirmar, onCancelar, procesando }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onCancelar} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl animate-slide-up sm:animate-in z-10">

        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-marino">Rechazar justificación</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {j.estudiante?.nombre} {j.estudiante?.apellido}
                {' · '}
                <span className="capitalize">{formatFechaFalta(j.asistencia?.fecha)}</span>
              </p>
            </div>
            <button
              onClick={onCancelar}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input resize-none"
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Explique el motivo para que el apoderado pueda corregirlo..."
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">El apoderado verá este mensaje</p>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancelar} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={onConfirmar}
              disabled={procesando || !motivoRechazo.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {procesando
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><XCircle size={15} /> Rechazar</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Justificaciones() {
  const [lista,         setLista]         = useState([])
  const [filtro,        setFiltro]        = useState('pendiente')
  const [cargando,      setCargando]      = useState(true)
  const [seleccionada,  setSeleccionada]  = useState(null)
  const [viendoDetalle, setViendoDetalle] = useState(false)
  const [modalAprobar,  setModalAprobar]  = useState(null)
  const [modalRechazo,  setModalRechazo]  = useState(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [procesando,    setProcesando]    = useState(false)
  const [conteos,       setConteos]       = useState({ pendiente: null, aprobada: null, rechazada: null })

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/justificaciones/pendientes', { params: { estado: filtro } })
      setLista(data)
      setConteos(prev => ({ ...prev, [filtro]: data.length }))
    } catch {
      toast.error('Error al cargar justificaciones')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    setSeleccionada(null)
    setViendoDetalle(false)
  }, [filtro])

  const handleSeleccionar = (j) => {
    setSeleccionada(j)
    setViendoDetalle(true)
  }

  const aprobar = async () => {
    const j = modalAprobar
    setModalAprobar(null)
    setProcesando(true)
    try {
      await api.put(`/justificaciones/${j.id}/aprobar`)
      toast.success('Justificación aprobada')
      setLista(prev => prev.filter(item => item.id !== j.id))
      setConteos(prev => ({ ...prev, pendiente: Math.max(0, (prev.pendiente ?? 1) - 1) }))
      if (seleccionada?.id === j.id) {
        setSeleccionada(null)
        setViendoDetalle(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al aprobar')
    } finally {
      setProcesando(false)
    }
  }

  const rechazar = async () => {
    if (!motivoRechazo.trim()) return toast.error('El motivo es obligatorio')
    const j = modalRechazo
    setModalRechazo(null)
    setProcesando(true)
    try {
      await api.put(`/justificaciones/${j.id}/rechazar`, { observacion: motivoRechazo })
      toast.success('Justificación rechazada')
      setLista(prev => prev.filter(item => item.id !== j.id))
      setConteos(prev => ({ ...prev, pendiente: Math.max(0, (prev.pendiente ?? 1) - 1) }))
      setMotivoRechazo('')
      if (seleccionada?.id === j.id) {
        setSeleccionada(null)
        setViendoDetalle(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al rechazar')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* ── Header + filtros ── */}
      <div className="flex-shrink-0 space-y-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-marino">Justificaciones</h1>
          {conteos.pendiente !== null && conteos.pendiente > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {conteos.pendiente} pendiente{conteos.pendiente !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filtro === f
                  ? 'bg-marino text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {LABEL_FILTRO[f]}
              {conteos[f] !== null && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center ${
                  filtro === f
                    ? 'bg-white/20 text-white'
                    : f === 'pendiente' && conteos[f] > 0
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-500'
                }`}>
                  {conteos[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Layout split ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">

        {/* ══ LISTA ══ */}
        <div className={`lg:col-span-2 min-h-0 flex flex-col ${viendoDetalle ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">

            {cargando ? (
              <div className="flex-1 overflow-hidden divide-y divide-gray-50">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3.5 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                      <div className="h-2 bg-gray-100 rounded w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : lista.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <FileText size={26} className="text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500">
                    No hay justificaciones {LABEL_FILTRO[filtro].toLowerCase()}
                  </p>
                  {filtro === 'pendiente' && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Los apoderados aún no han enviado justificaciones
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {lista.map((j) => (
                  <FilaJustificacion
                    key={j.id}
                    j={j}
                    activa={seleccionada?.id === j.id}
                    onClick={() => handleSeleccionar(j)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ DETALLE ══ */}
        <div className={`lg:col-span-3 min-h-0 flex flex-col ${viendoDetalle ? 'flex' : 'hidden lg:flex'}`}>
          <PanelDetalle
            j={seleccionada}
            onVolver={() => setViendoDetalle(false)}
            onAprobar={(j) => setModalAprobar(j)}
            onRechazar={(j) => setModalRechazo(j)}
            procesando={procesando}
          />
        </div>
      </div>

      {/* ── Modal Aprobar ── */}
      {modalAprobar && (
        <ModalAprobar
          j={modalAprobar}
          onConfirmar={aprobar}
          onCancelar={() => setModalAprobar(null)}
          procesando={procesando}
        />
      )}

      {/* ── Modal Rechazar ── */}
      {modalRechazo && (
        <ModalRechazo
          j={modalRechazo}
          motivoRechazo={motivoRechazo}
          setMotivoRechazo={setMotivoRechazo}
          onConfirmar={rechazar}
          onCancelar={() => { setModalRechazo(null); setMotivoRechazo('') }}
          procesando={procesando}
        />
      )}
    </div>
  )
}
