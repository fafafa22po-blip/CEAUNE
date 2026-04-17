import { useState, useEffect, useRef } from 'react'
import {
  Paperclip, Send, CheckCircle2, XCircle, Clock,
  AlertTriangle, X, FileText, Calendar, ChevronRight, ScanLine, Camera,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { scanDocument, takePhoto, compressImage, esNativo } from '../../lib/documentScanner'
import {
  format, parseISO,
  eachDayOfInterval, startOfMonth, getDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { useHijo } from '../../context/HijoContext'

const MAX_BYTES     = 10 * 1024 * 1024
const MIMES_VALIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg']

// ── Modal de justificación ────────────────────────────────────────────────────
function ModalJustificar({ falta, hijoId, onCerrar, onEnviado }) {
  const [motivo, setMotivo]     = useState('')
  const [adjunto, setAdjunto]   = useState(null)
  const [enviando, setEnviando]   = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [tomando, setTomando]     = useState(false)
  const fileRef     = useRef()
  const backdropRef = useRef(null)

  // Bloquea touch events para que NO lleguen al pull-to-refresh del Layout
  useEffect(() => {
    const el = backdropRef.current
    if (!el) return
    const stop = e => e.stopPropagation()
    el.addEventListener('touchstart', stop, { passive: true })
    el.addEventListener('touchmove',  stop, { passive: true })
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove',  stop)
    }
  })

  const handleEscanear = async () => {
    setEscaneando(true)
    try {
      const { file } = await scanDocument()
      setAdjunto(file)
    } catch (err) {
      if (err?.code !== 'CANCELLED') toast.error('No se pudo escanear el documento')
    } finally {
      setEscaneando(false)
    }
  }

  const handleTomarFoto = async () => {
    setTomando(true)
    try {
      const { file } = await takePhoto()
      setAdjunto(file)
    } catch (err) {
      if (err?.code !== 'CANCELLED') toast.error('No se pudo acceder a la cámara')
    } finally {
      setTomando(false)
    }
  }

  const esTardanza = falta.tipo === 'tardanza'

  const handleEnviar = async (e) => {
    e.preventDefault()
    if (!motivo.trim()) return toast.error('El motivo es obligatorio')
    if (adjunto && adjunto.size > MAX_BYTES)
      return toast.error('El archivo supera el límite de 10 MB')
    if (adjunto && !MIMES_VALIDOS.includes(adjunto.type))
      return toast.error('Solo se permiten PDF e imágenes (JPG, PNG, WEBP)')
    setEnviando(true)
    try {
      const formData = new FormData()
      formData.append('estudiante_id', hijoId)
      formData.append('fecha', falta.fecha)
      formData.append('motivo', motivo)
      if (adjunto) formData.append('adjunto', adjunto)
      await api.post('/justificaciones/por-fecha', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Justificación enviada correctamente')
      onEnviado()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  const fecha = parseISO(falta.fecha)

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in modal-nav-offset"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCerrar} />

      {/* Panel — flex column con altura máxima para que el botón Enviar siempre sea visible */}
      <div
        className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl animate-slide-up sm:animate-in z-10 flex flex-col"
        style={{ maxHeight: 'calc(90vh - var(--nav-h) - env(safe-area-inset-bottom, 0px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header fijo */}
        <div className="flex items-start justify-between px-5 pt-3 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${esTardanza ? 'text-amber-500' : 'text-red-500'}`}>
              {esTardanza ? 'Justificar tardanza' : 'Justificar inasistencia'}
            </p>
            <p className="text-lg font-bold text-marino capitalize leading-tight">
              {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form — contenido scrollable + botones fijos */}
        <form onSubmit={handleEnviar} className="flex flex-col flex-1 overflow-hidden">

          {/* Área scrollable */}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2 space-y-4" style={{ overscrollBehavior: 'contain' }}>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {esTardanza ? 'Motivo de la tardanza' : 'Motivo de la inasistencia'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input resize-none"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={esTardanza
                  ? 'Ej: El estudiante tuvo cita médica por la mañana...'
                  : 'Ej: El estudiante presentó fiebre y fue al médico...'}
              />
            </div>

            {/* Adjunto */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Documento de respaldo{' '}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>

              {adjunto ? (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-800 truncate">{adjunto.name}</p>
                    <p className="text-[10px] text-blue-500 mt-0.5">
                      {(adjunto.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdjunto(null)}
                    className="text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : esNativo ? (
                /* Nativo: escanear + tomar foto + galería/archivos */
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleEscanear}
                    disabled={escaneando || tomando}
                    className="w-full flex items-center gap-3 bg-marino/5 hover:bg-marino/10 border-2 border-marino/20 hover:border-marino/40 rounded-xl px-4 py-3.5 transition-colors group"
                  >
                    <div className="w-9 h-9 bg-marino rounded-xl flex items-center justify-center flex-shrink-0">
                      {escaneando
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <ScanLine size={16} className="text-white" />
                      }
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-marino">
                        {escaneando ? 'Abriendo escáner...' : 'Escanear documento'}
                      </p>
                      <p className="text-[10px] text-marino/60">Toma foto con efecto escaneo · multi-página PDF</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleTomarFoto}
                    disabled={escaneando || tomando}
                    className="w-full flex items-center gap-3 bg-dorado/5 hover:bg-dorado/10 border-2 border-dorado/20 hover:border-dorado/40 rounded-xl px-4 py-3.5 transition-colors group"
                  >
                    <div className="w-9 h-9 bg-dorado rounded-xl flex items-center justify-center flex-shrink-0">
                      {tomando
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Camera size={16} className="text-white" />
                      }
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-dorado">
                        {tomando ? 'Abriendo cámara...' : 'Tomar foto'}
                      </p>
                      <p className="text-[10px] text-dorado/60">Captura directa con la cámara del dispositivo</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={escaneando || tomando}
                    className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Paperclip size={13} className="text-gray-400" />
                    <p className="text-[11px] text-gray-400">Elegir desde archivos o galería</p>
                  </button>
                </div>
              ) : (
                /* Web: file picker normal */
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-3 border-2 border-dashed border-gray-200 hover:border-dorado rounded-xl px-4 py-3 transition-colors group"
                >
                  <div className="w-8 h-8 bg-gray-100 group-hover:bg-dorado/10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                    <Paperclip size={14} className="text-gray-400 group-hover:text-dorado transition-colors" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-gray-600">Adjuntar archivo</p>
                    <p className="text-[10px] text-gray-400">PDF, imagen u otro documento</p>
                  </div>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={async (e) => {
                  const raw = e.target.files[0]
                  if (!raw) return setAdjunto(null)
                  const file = await compressImage(raw)
                  setAdjunto(file)
                }}
              />
            </div>

          </div>{/* fin área scrollable */}

          {/* Botones fijos — siempre visibles sin importar el contenido */}
          <div className="flex-shrink-0 flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100">
            <button type="button" onClick={onCerrar} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !motivo.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {enviando
                ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <><Send size={14} /> Enviar</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card de falta / tardanza pendiente ───────────────────────────────────────
function CardFalta({ falta, onClick }) {
  const fecha      = parseISO(falta.fecha)
  const esTardanza = falta.tipo === 'tardanza'

  const color = esTardanza
    ? { bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200', num: 'text-amber-600', mes: 'text-amber-400', sep: 'bg-amber-200', dot: 'bg-amber-400', label: 'text-amber-600', arrow: 'text-amber-300 group-hover:text-amber-500' }
    : { bg: 'bg-red-50 hover:bg-red-100 border-red-200',       num: 'text-red-600',   mes: 'text-red-400',   sep: 'bg-red-200',   dot: 'bg-red-400',   label: 'text-red-500',   arrow: 'text-red-300 group-hover:text-red-500' }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 active:scale-[0.98] border rounded-2xl px-4 py-3.5 transition-all group text-left ${color.bg}`}
    >
      {/* Número de día */}
      <div className="flex-shrink-0 text-center w-11">
        <p className={`text-[28px] font-black leading-none ${color.num}`}>
          {format(fecha, 'd')}
        </p>
        <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${color.mes}`}>
          {format(fecha, 'MMM', { locale: es })}
        </p>
      </div>

      {/* Separador */}
      <div className={`w-px h-10 flex-shrink-0 ${color.sep}`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 capitalize">
          {format(fecha, 'EEEE', { locale: es })}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />
          <span className={`text-xs font-medium ${color.label}`}>
            {esTardanza ? 'Tardanza sin justificar' : 'Falta sin justificar'}
          </span>
        </div>
      </div>

      {/* Flecha */}
      <ChevronRight size={16} className={`flex-shrink-0 transition-colors ${color.arrow}`} />
    </button>
  )
}

// ── Item del historial (timeline) ─────────────────────────────────────────────
const ESTADO_CFG = {
  aprobada:  {
    dot: 'bg-green-500', ring: 'ring-green-100',
    Icon: CheckCircle2,
    cardBg: 'bg-green-50', cardBorder: 'border-green-200',
    label: 'Aprobada', labelColor: 'text-green-700',
  },
  rechazada: {
    dot: 'bg-red-500', ring: 'ring-red-100',
    Icon: XCircle,
    cardBg: 'bg-red-50', cardBorder: 'border-red-200',
    label: 'Rechazada', labelColor: 'text-red-700',
  },
  pendiente: {
    dot: 'bg-amber-400', ring: 'ring-amber-100',
    Icon: Clock,
    cardBg: 'bg-amber-50', cardBorder: 'border-amber-200',
    label: 'En revisión', labelColor: 'text-amber-700',
  },
}

function ItemHistorial({ j, esUltimo }) {
  const fechaRaw = j.asistencia?.fecha
  const fechaStr = fechaRaw
    ? (typeof fechaRaw === 'string' ? fechaRaw : format(new Date(fechaRaw), 'yyyy-MM-dd'))
    : null

  const cfg = ESTADO_CFG[j.estado] || ESTADO_CFG.pendiente
  const { Icon } = cfg

  return (
    <div className="flex gap-3">
      {/* Dot + línea vertical */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div className={`w-8 h-8 rounded-full ${cfg.dot} ring-4 ${cfg.ring} flex items-center justify-center z-10 flex-shrink-0`}>
          <Icon size={14} className="text-white" />
        </div>
        {!esUltimo && <div className="w-0.5 flex-1 bg-gray-100 mt-1 mb-0" />}
      </div>

      {/* Card de justificación */}
      <div className={`flex-1 ${esUltimo ? 'pb-0' : 'pb-4'}`}>
        <div className={`rounded-2xl border ${cfg.cardBg} ${cfg.cardBorder} px-4 py-3 space-y-1.5`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.labelColor}`}>
                  {cfg.label}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  j.asistencia?.estado === 'tardanza'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {j.asistencia?.estado === 'tardanza' ? 'Tardanza' : 'Falta'}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 capitalize mt-0.5">
                {fechaStr
                  ? format(parseISO(fechaStr), "EEEE d 'de' MMMM", { locale: es })
                  : 'Sin fecha'}
              </p>
            </div>
            <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
              {j.created_at
                ? format(parseISO(j.created_at), "d MMM", { locale: es })
                : ''}
            </span>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
            {j.motivo}
          </p>

          {j.estado === 'rechazada' && j.observacion_revision && (
            <div className="flex items-start gap-2 bg-red-100 rounded-xl px-3 py-2 mt-1">
              <XCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium leading-relaxed">
                {j.observacion_revision}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonFalta() {
  return <div className="h-[72px] bg-gray-100 rounded-2xl animate-pulse" />
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Justificar() {
  const { hijoActivo } = useHijo()
  const [faltasSinJustificar,    setFaltasSinJustificar]    = useState([])
  const [justificacionesEnviadas, setJustificacionesEnviadas] = useState([])
  const [faltaSeleccionada,      setFaltaSeleccionada]      = useState(null)
  const [cargando,               setCargando]               = useState(true)

  const cargarDatos = async () => {
    if (!hijoActivo) return
    setCargando(true)
    try {
      const hoy       = new Date()
      const hoyStr    = format(hoy, 'yyyy-MM-dd')
      const inicioMes = startOfMonth(hoy)

      const [asistRes, justRes] = await Promise.all([
        api.get(`/apoderado/hijo/${hijoActivo.id}/asistencias`, {
          params: {
            fecha_inicio: format(inicioMes, 'yyyy-MM-dd'),
            fecha_fin:    hoyStr,
          },
        }),
        api.get('/apoderado/justificaciones'),
      ])

      const registros = Array.isArray(asistRes.data) ? asistRes.data : []
      const justs     = Array.isArray(justRes.data)  ? justRes.data  : []

      // Mapa fecha → estado (solo ingresos)
      const mapa = {}
      registros
        .filter(r => r.tipo === 'ingreso' || r.tipo === 'ingreso_especial')
        .forEach(r => {
          const f = typeof r.fecha === 'string' ? r.fecha : format(new Date(r.fecha), 'yyyy-MM-dd')
          if (!mapa[f] || r.estado === 'tardanza') mapa[f] = r.estado
        })

      // Fechas que ya tienen justificación activa (pendiente o aprobada)
      const fechasJustificadas = new Set(
        justs
          .filter(j => j.estado === 'pendiente' || j.estado === 'aprobada')
          .map(j => {
            const f = j.asistencia?.fecha
            if (!f) return null
            return typeof f === 'string' ? f : format(new Date(f), 'yyyy-MM-dd')
          })
          .filter(Boolean)
      )

      // Días laborables (L-V) del mes hasta hoy sin asistencia válida y sin justificación activa
      const faltasDias = eachDayOfInterval({ start: inicioMes, end: hoy })
        .filter(d => {
          const dow  = getDay(d)
          if (dow < 1 || dow > 5) return false
          const dStr     = format(d, 'yyyy-MM-dd')
          const estadoDia = mapa[dStr]
          // Excluir solo si vino puntual o con registro especial (no falta ni tardanza)
          if (estadoDia && estadoDia !== 'falta' && estadoDia !== 'tardanza') return false
          if (fechasJustificadas.has(dStr)) return false
          return true
        })
        .map(d => {
          const dStr = format(d, 'yyyy-MM-dd')
          return { fecha: dStr, tipo: mapa[dStr] || 'falta' }
        })
        .reverse()

      setFaltasSinJustificar(faltasDias)
      setJustificacionesEnviadas(justs)
    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [hijoActivo?.id])

  // Métricas
  const totalFaltas = faltasSinJustificar.length + justificacionesEnviadas.length
  const aprobadas   = justificacionesEnviadas.filter(j => j.estado === 'aprobada').length
  const pendientes  = justificacionesEnviadas.filter(j => j.estado === 'pendiente').length

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Título */}
      <div>
        <h1 className="text-xl font-bold text-marino">Justificaciones</h1>
        <p className="text-sm text-gray-400 mt-0.5 capitalize">
          {format(new Date(), "MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Métricas de resumen */}
      {!cargando && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { valor: totalFaltas,                    label: 'Total',       color: 'text-gray-700'  },
            { valor: faltasSinJustificar.length,     label: 'Pendientes',  color: 'text-red-500'   },
            { valor: pendientes,                     label: 'En revisión', color: 'text-amber-500' },
            { valor: aprobadas,                      label: 'Aprobadas',   color: 'text-green-500' },
          ].map(({ valor, label, color }) => (
            <div key={label} className="card text-center py-3 px-1">
              <p className={`text-2xl font-black ${color}`}>{valor}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Layout 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Faltas y tardanzas sin justificar ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-marino">Por justificar</h2>
            {!cargando && faltasSinJustificar.length > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {faltasSinJustificar.length}
              </span>
            )}
          </div>

          {cargando ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <SkeletonFalta key={i} />)}
            </div>
          ) : faltasSinJustificar.length === 0 ? (
            <div className="card text-center py-10 space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} className="text-green-500" />
              </div>
              <div>
                <p className="text-gray-700 font-semibold">Todo justificado</p>
                <p className="text-gray-400 text-sm mt-0.5">No hay faltas ni tardanzas que justificar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <AlertTriangle size={11} className="text-amber-400" />
                Toca una fecha para justificar la falta o tardanza
              </p>
              {faltasSinJustificar.map((f) => (
                <CardFalta
                  key={f.fecha}
                  falta={f}
                  onClick={() => setFaltaSeleccionada(f)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Historial ── */}
        <div className="space-y-3">
          <h2 className="font-semibold text-marino">Historial</h2>

          {cargando ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : justificacionesEnviadas.length === 0 ? (
            <div className="card text-center py-10 space-y-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <Calendar size={22} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">Sin justificaciones enviadas</p>
            </div>
          ) : (
            <div>
              {justificacionesEnviadas.map((j, i) => (
                <ItemHistorial
                  key={j.id}
                  j={j}
                  esUltimo={i === justificacionesEnviadas.length - 1}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal */}
      {faltaSeleccionada && (
        <ModalJustificar
          falta={faltaSeleccionada}
          hijoId={hijoActivo.id}
          onCerrar={() => setFaltaSeleccionada(null)}
          onEnviado={() => {
            setFaltaSeleccionada(null)
            cargarDatos()
          }}
        />
      )}
    </div>
  )
}
