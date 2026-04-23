import { useState, useCallback, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Hash, Camera, Mail, Clock, MessageCircle, X, Phone, Copy, AlertTriangle, Check, ShieldCheck, UserX, CheckCircle2, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'
import QRScanner from '../../components/QRScanner'
import api from '../../lib/api'
import { formatGradoSeccion } from '../../lib/nivelAcademico'
import { abrirWhatsApp } from '../../lib/externo'
import { obtenerUsuario } from '../../lib/auth'
import { hapticMedium, hapticLight } from '../../lib/haptics'

// ─── Motivos para salida anticipada ──────────────────────────────────────────
const MOTIVOS_SALIDA = [
  { v: 'marcha',            label: 'Marcha / Movilización' },
  { v: 'juegos_deportivos', label: 'Juegos deportivos'     },
  { v: 'enfermedad',        label: 'Enfermedad / Malestar' },
  { v: 'permiso_apoderado', label: 'Permiso del apoderado' },
  { v: 'otro',              label: 'Otro motivo'           },
]

export const MOTIVO_LABEL = {
  marcha:                  'Marcha / Movilización',
  juegos_deportivos:       'Juegos deportivos',
  enfermedad:              'Enfermedad / Malestar',
  permiso_apoderado:       'Permiso del apoderado',
  actividad_institucional: 'Actividad institucional',
  tardanza_justificada:    'Tardanza justificada',
  otro:                    'Otro motivo',
}

// ─── Config visual por acción detectada ──────────────────────────────────────
const PREVIEW_HEADER = {
  ingreso:          { bg: 'bg-green-500',  label: 'INGRESO',           ring: 'ring-green-400'  },
  tardanza:         { bg: 'bg-amber-500',  label: 'TARDANZA',          ring: 'ring-amber-400'  },
  salida:           { bg: 'bg-blue-500',   label: 'SALIDA',            ring: 'ring-blue-400'   },
  salida_especial:  { bg: 'bg-orange-500', label: 'SALIDA ANTICIPADA', ring: 'ring-orange-400' },
  ingreso_especial: { bg: 'bg-violet-600', label: 'REGRESO',           ring: 'ring-violet-400' },
}

const ESTADO_CFG = {
  puntual:  { label: 'PUNTUAL',  cls: 'badge-verde',    headerBg: 'bg-green-500',  modalLabel: 'Llegó a tiempo',    ring: 'ring-green-400'  },
  tardanza: { label: 'TARDANZA', cls: 'badge-amarillo', headerBg: 'bg-amber-500',  modalLabel: 'Tardanza detectada',ring: 'ring-amber-400'  },
  especial: { label: 'ESPECIAL', cls: 'badge-naranja',  headerBg: 'bg-violet-600', modalLabel: 'Registro especial', ring: 'ring-violet-400' },
  falta:    { label: 'FALTA',    cls: 'badge-rojo',     headerBg: 'bg-red-500',    modalLabel: 'Falta registrada',  ring: 'ring-red-400'    },
}

function FotoEstudiante({ foto_url, nombre, ring = 'ring-gray-200', size = 'md' }) {
  const dim  = size === 'lg' ? 'w-28 h-28 rounded-3xl ring-4 text-5xl' : 'w-14 h-14 rounded-2xl ring-2 text-2xl'
  if (foto_url) {
    return (
      <div className={`${dim} overflow-hidden ${ring} flex-shrink-0`}>
        <img src={foto_url} alt={nombre} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${dim} bg-gray-100 ${ring} flex items-center justify-center font-bold text-gray-400 flex-shrink-0`}>
      {nombre?.charAt(0) || 'A'}
    </div>
  )
}

const AUTO_CONFIRM_SEG = 3
const AUTO_CIERRE_SEG  = 5

// ─── Flujo APO- (solo i-auxiliar / inicial) ───────────────────────────────────
const PREVIEW_HDR_INI = {
  ingreso:          { bg: 'bg-green-500',  label: 'INGRESO PUNTUAL'   },
  tardanza:         { bg: 'bg-amber-500',  label: 'TARDANZA'          },
  salida:           { bg: 'bg-blue-500',   label: 'SALIDA'            },
  salida_especial:  { bg: 'bg-orange-500', label: 'SALIDA ANTICIPADA' },
  ingreso_especial: { bg: 'bg-violet-600', label: 'REGRESO'           },
  solo_recojo:      { bg: 'bg-[#0a1f3d]', label: 'RECOJO'            },
}

const MOTIVOS_SALIDA_INI = [
  { v: 'marcha',            label: 'Marcha / Movilización' },
  { v: 'juegos_deportivos', label: 'Juegos deportivos'     },
  { v: 'enfermedad',        label: 'Enfermedad / Malestar' },
  { v: 'permiso_apoderado', label: 'Permiso del apoderado' },
  { v: 'otro',              label: 'Otro motivo'           },
]

function AvatarIni({ foto_url, nombre, className = '', textClass = '' }) {
  if (foto_url) return <img src={foto_url} alt={nombre} className={`object-cover ${className}`} />
  return (
    <div className={`flex items-center justify-center font-black text-white/70 ${textClass} ${className}`}>
      {nombre?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}

function ModalSeleccionIni({ datoApo, qrToken, onConfirmar, onCancelar, cargando }) {
  const { apoderado, hijos } = datoApo
  const [hijoId,      setHijoId]      = useState(hijos.length === 1 ? hijos[0].id : '')
  const [preview,     setPreview]     = useState(null)
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [motivo,      setMotivo]      = useState('')
  const [conRecojo,   setConRecojo]   = useState(false)
  const [autoConfirm, setAutoConfirm] = useState(0)
  const acRef     = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!hijoId) return
    setPreview(null); setObservacion(''); setMotivo(''); setConRecojo(false)
    setLoadingPrev(true)
    api.post('/inicial/previsualizar', { qr_token: qrToken, estudiante_id: hijoId })
      .then(r => {
        setPreview(r.data)
        if (!r.data.tiene_asistencia && r.data.puede_recojo) setConRecojo(true)
      })
      .catch(err => { toast.error(err.response?.data?.detail || 'Error al previsualizar'); onCancelar() })
      .finally(() => setLoadingPrev(false))
  }, [hijoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const puedeAutoConfirmar = preview && !preview.requiere_observacion &&
    !preview.requiere_motivo && preview.tiene_asistencia && !preview.puede_recojo

  useEffect(() => {
    clearTimeout(acRef.current); setAutoConfirm(0)
    if (!puedeAutoConfirmar) return
    setAutoConfirm(AUTO_CONFIRM_SEG)
  }, [puedeAutoConfirmar, preview?.tipo_asistencia])

  useEffect(() => {
    clearTimeout(acRef.current)
    if (autoConfirm <= 0) return
    acRef.current = setTimeout(() => {
      setAutoConfirm(c => { if (c <= 1) { confirmRef.current?.(); return 0 } return c - 1 })
    }, 1000)
    return () => clearTimeout(acRef.current)
  }, [autoConfirm])

  const handleConfirmar = () => {
    clearTimeout(acRef.current)
    if (!preview || !hijoId) return
    const accion = preview.tiene_asistencia && conRecojo ? 'ambos'
      : preview.tiene_asistencia ? 'asistencia' : 'recojo'
    const extras = {}
    if (preview.tipo_asistencia)  extras.tipo_asistencia = preview.tipo_asistencia
    if (observacion.trim())       extras.observacion     = observacion.trim()
    if (motivo)                   extras.motivo_especial = motivo
    else if (preview.motivo_auto) extras.motivo_especial = preview.motivo_auto
    onConfirmar(hijoId, accion, qrToken, extras)
  }
  confirmRef.current = handleConfirmar

  const puedeConfirmar = preview && hijoId &&
    (!preview.requiere_observacion || observacion.trim()) &&
    (!preview.requiere_motivo || motivo) &&
    (preview.tiene_asistencia || conRecojo)

  const hdrKey = preview
    ? (!preview.tiene_asistencia ? 'solo_recojo'
       : preview.estado_previsto === 'tardanza' ? 'tardanza'
       : preview.tipo_asistencia || 'ingreso')
    : null
  const hdr = hdrKey ? PREVIEW_HDR_INI[hdrKey] : null

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) { clearTimeout(acRef.current); onCancelar() } }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {hdr && (
          <div className={`h-1 ${hdr.bg} opacity-30`}>
            {autoConfirm > 0 && (
              <div className={`h-1 ${hdr.bg} transition-all duration-1000 ease-linear`}
                style={{ width: `${(autoConfirm / AUTO_CONFIRM_SEG) * 100}%` }} />
            )}
          </div>
        )}

        {hdr ? (
          <div className={`${hdr.bg} px-5 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <p className="text-white font-black text-xl tracking-widest">{hdr.label}</p>
              {autoConfirm > 0 && (
                <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">{autoConfirm}s</span>
              )}
            </div>
            <button onClick={() => { clearTimeout(acRef.current); onCancelar() }}
              className="text-white/80 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20">
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="bg-[#0a1f3d] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AvatarIni foto_url={apoderado.foto_url} nombre={apoderado.nombre}
                className="w-10 h-10 rounded-xl flex-shrink-0" textClass="text-base bg-white/20 w-10 h-10 rounded-xl" />
              <div>
                <p className="text-white font-bold leading-tight">{apoderado.nombre} {apoderado.apellido}</p>
                <p className="text-white/50 text-xs mt-0.5">Apoderado · Nivel Inicial</p>
              </div>
            </div>
            <button onClick={onCancelar} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <X size={16} className="text-white" />
            </button>
          </div>
        )}

        <div className="px-5 pt-5 pb-4 space-y-4">
          {hijos.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selecciona al alumno</p>
              {hijos.map(h => (
                <button key={h.id} onClick={() => setHijoId(h.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    hijoId === h.id ? 'border-[#0a1f3d] bg-[#0a1f3d]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <AvatarIni foto_url={h.foto_url} nombre={h.nombre}
                    className="w-10 h-10 rounded-xl flex-shrink-0" textClass="text-base bg-gray-200 w-10 h-10 rounded-xl" />
                  <div className="flex-1 text-left">
                    <p className="font-bold text-gray-900 text-sm">{h.nombre} {h.apellido}</p>
                    <p className="text-xs text-gray-500">{h.grado} años · Aula {h.seccion}</p>
                  </div>
                  {h.estado_hoy?.tiene_ingreso
                    ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Presente</span>
                    : <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Ausente</span>}
                </button>
              ))}
            </div>
          )}

          {loadingPrev && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-[#0a1f3d] border-t-transparent rounded-full animate-spin" />
              Detectando acción...
            </div>
          )}

          {preview && (
            <>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  <ShieldCheck size={13} className="text-gray-300" /> Verificar identidad
                </div>
                <FotoEstudiante foto_url={preview.estudiante?.foto_url} nombre={preview.estudiante?.nombre} size="lg" />
                <div>
                  <p className="font-black text-[#0a1f3d] text-xl leading-tight">
                    {preview.estudiante?.nombre} {preview.estudiante?.apellido}
                  </p>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {preview.estudiante?.grado} años · Aula {preview.estudiante?.seccion}
                  </p>
                  {preview.sublabel && <p className="text-xs text-gray-400 italic mt-1">{preview.sublabel}</p>}
                </div>
              </div>

              {preview.tipo_asistencia === 'ingreso_especial' && preview.motivo_auto && (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                  <p className="text-sm text-violet-700">
                    Retorna de: <span className="font-semibold">{preview.motivo_auto.replace(/_/g, ' ')}</span>
                  </p>
                </div>
              )}

              {preview.requiere_observacion && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide text-center">¿Por qué llegó tarde?</p>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none"
                    rows={2} value={observacion} onChange={e => setObservacion(e.target.value)}
                    placeholder="Motivo de la tardanza (obligatorio)..." autoFocus />
                </div>
              )}

              {preview.requiere_motivo && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">¿Por qué sale antes?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MOTIVOS_SALIDA_INI.map(m => (
                      <button key={m.v} type="button" onClick={() => setMotivo(m.v)}
                        className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold text-left transition-all ${
                          motivo === m.v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {preview.puede_recojo && preview.tiene_asistencia && (
                <button onClick={() => setConRecojo(v => !v)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                    conRecojo ? 'border-[#0a1f3d] bg-[#0a1f3d]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    conRecojo ? 'bg-[#0a1f3d]' : 'border-2 border-gray-300'}`}>
                    {conRecojo && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">También autorizar recojo</p>
                    <p className="text-xs text-gray-400">Registra salida + recojo en un solo escaneo</p>
                  </div>
                  <ShieldCheck size={16} className={`flex-shrink-0 ${conRecojo ? 'text-[#0a1f3d]' : 'text-gray-300'}`} />
                </button>
              )}

              {!preview.tiene_asistencia && preview.puede_recojo && (
                <div className="bg-[#0a1f3d]/5 border border-[#0a1f3d]/20 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm font-bold text-[#0a1f3d]">Ingreso y salida ya registrados</p>
                  <p className="text-xs text-gray-500 mt-0.5">Se registrará solo el recojo seguro</p>
                </div>
              )}

              <div className="space-y-2.5">
                <button onClick={handleConfirmar} disabled={cargando || !puedeConfirmar}
                  className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] ${hdr ? hdr.bg : 'bg-[#0a1f3d]'}`}>
                  {cargando
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</>
                    : <><Check size={16} /> {autoConfirm > 0 ? `Confirmar (${autoConfirm}s)` : 'Confirmar registro'}</>}
                </button>
                <button onClick={() => { clearTimeout(acRef.current); onCancelar() }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 text-sm font-semibold">
                  <UserX size={15} /> Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function PantallaResultadoIni({ resultado, alumno, onCerrar }) {
  const [cuenta, setCuenta] = useState(8)
  const timerRef = useRef(null)

  useEffect(() => {
    hapticMedium()
    timerRef.current = setInterval(() => setCuenta(c => {
      if (c <= 1) { clearInterval(timerRef.current); onCerrar(); return 0 }
      return c - 1
    }), 1000)
    return () => clearInterval(timerRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const tieneAsist  = !!resultado.asistencia
  const tieneRecojo = !!resultado.recojo
  const bg = tieneRecojo ? '#15803d' : tieneAsist ? '#0a1f3d' : '#6b7280'
  const titulo = tieneRecojo && tieneAsist ? 'ENTRADA Y RECOJO'
    : tieneRecojo ? 'RECOJO AUTORIZADO'
    : tieneAsist  ? 'ENTRADA REGISTRADA'
    : resultado.mensaje || 'REGISTRADO'

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: bg }}
      onClick={() => { clearInterval(timerRef.current); onCerrar() }}>
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 flex items-start justify-between">
        <div>
          <p className="text-white font-black text-3xl leading-tight">{titulo}</p>
          <p className="text-white/70 text-sm mt-1">{alumno.nombre} {alumno.apellido}</p>
          <p className="text-white/50 text-xs">{alumno.grado} años · Aula {alumno.seccion}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold tabular-nums">{cuenta}</span>
          </div>
          <button onClick={() => { clearInterval(timerRef.current); onCerrar() }}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <X size={20} className="text-white" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="flex flex-col items-center gap-5">
          <FotoEstudiante foto_url={alumno.foto_url} nombre={alumno.nombre}
            ring="ring-white/30" size="lg" />
          <div className="flex flex-wrap gap-2 justify-center">
            {tieneAsist && (
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                <Check size={14} className="text-white" />
                <span className="text-white text-sm font-bold">
                  {resultado.asistencia.tipo === 'ingreso' ? 'Entrada' : 'Salida'}
                  {resultado.asistencia.hora && ` · ${resultado.asistencia.hora}`}
                </span>
              </div>
            )}
            {tieneRecojo && (
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                <ShieldCheck size={14} className="text-white" />
                <span className="text-white text-sm font-bold">Recojo</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <button onClick={() => { clearInterval(timerRef.current); onCerrar() }}
          className="w-full py-4 rounded-2xl bg-white/20 border border-white/30 text-white font-black text-base flex items-center justify-center gap-2">
          Siguiente ({cuenta})
        </button>
      </div>
    </div>,
    document.body
  )
}

function StatBadge({ valor, label, color }) {
  return (
    <div className={`flex-1 rounded-xl p-3 text-center ${color}`}>
      <p className="text-xl font-bold">{valor}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

export default function Escanear() {
  const _usuario = obtenerUsuario()
  const [modo, setModo]                 = useState('camara')
  const [dniManual, setDniManual]       = useState('')
  const [cargando, setCargando]         = useState(false)
  const [camaraActiva, setCamaraActiva] = useState(true)
  const [horarioHoy, setHorarioHoy]     = useState(null)
  const [feed, setFeed]                 = useState([])

  // ── Fase 1: preview ──────────────────────────────────────────────────────
  const [preview, setPreview]               = useState(null)
  const [pendingToken, setPendingToken]     = useState(null)
  const [motivoEspecial, setMotivoEspecial] = useState('')
  const [observacion, setObservacion]       = useState('')
  const [autoConfirm, setAutoConfirm]       = useState(0)
  const acTimerRef    = useRef(null)
  const confirmarRef  = useRef(null)
  const lectorInputRef = useRef(null)

  // ── Fase 2: resultado ────────────────────────────────────────────────────
  const [resultado, setResultado]           = useState(null)
  const [apoderados, setApoderados]         = useState([])
  const [cuentaRegresiva, setCuentaRegresiva] = useState(AUTO_CIERRE_SEG)
  const [autoActivo, setAutoActivo]         = useState(false)
  const closeTimerRef = useRef(null)

  // ── Flujo APO- (solo i-auxiliar) ─────────────────────────────────────────
  const [datoApo,          setDatoApo]          = useState(null)
  const [qrTokenApo,       setQrTokenApo]       = useState('')
  const [resultadoInicial, setResultadoInicial] = useState(null)
  const [alumnoInicial,    setAlumnoInicial]    = useState(null)

  // Clave visual del header del preview
  const headerKey    = preview
    ? (preview.estado_previsto === 'tardanza' ? 'tardanza' : preview.tipo_a_enviar)
    : null
  const previewHdr   = headerKey ? PREVIEW_HEADER[headerKey] : null
  const resultCfg    = resultado ? (ESTADO_CFG[resultado.asistencia?.estado] || ESTADO_CFG.puntual) : null
  const tardanzas    = resultado?.tardanzas_mes ?? 0
  const faltas       = resultado?.faltas_mes    ?? 0
  const hayAlerta    = tardanzas >= 3 || faltas >= 3

  // Cargar horario efectivo del día
  useEffect(() => {
    api.get('/asistencia/horario-hoy').then(r => setHorarioHoy(r.data)).catch(() => {})
  }, [])

  // ── Auto-confirm: arranca cuando aparece preview sin inputs requeridos ──
  useEffect(() => {
    clearTimeout(acTimerRef.current)
    setAutoConfirm(0)
    if (!preview || preview.requiere_motivo || preview.requiere_observacion) return
    setAutoConfirm(AUTO_CONFIRM_SEG)
  }, [preview])

  useEffect(() => {
    clearTimeout(acTimerRef.current)
    if (autoConfirm <= 0) return
    acTimerRef.current = setTimeout(() => {
      setAutoConfirm(c => {
        if (c <= 1) { confirmarRef.current?.(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearTimeout(acTimerRef.current)
  }, [autoConfirm])

  // ── Auto-cierre del modal resultado ─────────────────────────────────────
  useEffect(() => {
    if (!resultado) { setAutoActivo(false); setCuentaRegresiva(AUTO_CIERRE_SEG); return }
    setAutoActivo(true)
    setCuentaRegresiva(AUTO_CIERRE_SEG)
  }, [resultado])

  useEffect(() => {
    if (!autoActivo) return
    if (cuentaRegresiva <= 0) { cerrarModal(); return }
    closeTimerRef.current = setTimeout(() => setCuentaRegresiva(c => c - 1), 1000)
    return () => clearTimeout(closeTimerRef.current)
  }, [autoActivo, cuentaRegresiva])

  // Re-enfocar el input del lector físico después de cada escaneo
  useEffect(() => {
    if (modo !== 'lector' || cargando || preview || resultado || datoApo) return
    const t = setTimeout(() => lectorInputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [modo, cargando, preview, resultado, datoApo])

  const detenerAutoConfirm = () => {
    clearTimeout(acTimerRef.current)
    setAutoConfirm(0)
  }

  const cancelarAutoClose = () => setAutoActivo(false)

  const cerrarModal = useCallback(() => {
    setResultado(null)
    setApoderados([])
    setCamaraActiva(true)
    setAutoActivo(false)
    setCuentaRegresiva(AUTO_CIERRE_SEG)
  }, [])

  const cancelarPreview = useCallback(() => {
    clearTimeout(acTimerRef.current)
    setPreview(null)
    setPendingToken(null)
    setMotivoEspecial('')
    setObservacion('')
    setAutoConfirm(0)
    setCamaraActiva(true)
  }, [])

  // ── Fase 1: escanear → previsualizar ────────────────────────────────────
  const escanear = useCallback(async (token) => {
    if (cargando) return

    // QR de apoderado de inicial → flujo APO- inline (solo i-auxiliar)
    if (token.startsWith('APO-') && _usuario?.rol === 'i-auxiliar') {
      setCargando(true)
      setCamaraActiva(false)
      try {
        const { data } = await api.post('/inicial/resolver-qr', { qr_token: token })
        hapticLight()
        setQrTokenApo(token)
        setDatoApo(data)
      } catch (err) {
        toast.error(err.response?.data?.detail || 'QR de apoderado no reconocido')
        setCamaraActiva(true)
      } finally {
        setCargando(false)
      }
      return
    }

    setCargando(true)
    setCamaraActiva(false)
    try {
      const { data } = await api.post('/asistencia/previsualizar', { qr_token: token })
      setPendingToken(token)
      setMotivoEspecial('')
      setObservacion('')
      setPreview(data)
    } catch (err) {
      const raw = err.response?.data?.detail
      const msg = typeof raw === 'string' ? raw : 'No se pudo identificar al estudiante'
      toast.error(msg)
      setCamaraActiva(true)
    } finally {
      setCargando(false)
    }
  }, [cargando])

  // ── Fase 2: confirmar → escanear real ───────────────────────────────────
  const confirmarRegistro = useCallback(async () => {
    if (!preview || !pendingToken || cargando) return
    clearTimeout(acTimerRef.current)

    if (preview.requiere_motivo && !motivoEspecial) {
      toast.error('Selecciona el motivo antes de confirmar')
      return
    }
    if (preview.requiere_observacion && !observacion.trim()) {
      toast.error('Ingresa el motivo de la tardanza')
      return
    }

    setCargando(true)
    try {
      const payload = { qr_token: pendingToken, tipo_solicitado: preview.tipo_a_enviar }
      if (preview.requiere_motivo)         payload.motivo_especial = motivoEspecial
      else if (preview.motivo_auto)        payload.motivo_especial = preview.motivo_auto
      if (preview.requiere_observacion)    payload.observacion = observacion.trim()

      const { data } = await api.post('/asistencia/escanear', payload)
      setResultado(data)
      setFeed(prev => [data, ...prev].slice(0, 20))
      setDniManual('')
      setPreview(null)
      setPendingToken(null)
      setMotivoEspecial('')
      setObservacion('')
      setApoderados([])
      if (data.estudiante?.id) {
        api.get(`/estudiantes/${data.estudiante.id}/apoderados`)
          .then(r => setApoderados(r.data.filter(a => a.telefono)))
          .catch(() => {})
      }
    } catch (err) {
      const raw = err.response?.data?.detail
      const msg = typeof raw === 'string' ? raw
               : (raw?.detail && typeof raw.detail === 'string') ? raw.detail
               : 'Error al registrar'
      toast.error(msg)
    } finally {
      setCargando(false)
    }
  }, [preview, pendingToken, cargando, motivoEspecial, observacion])

  // Mantener ref sincronizado para el auto-confirm
  confirmarRef.current = confirmarRegistro

  const confirmarInicial = useCallback(async (hijoId, accion, qrToken, extras = {}) => {
    if (cargando) return
    setCargando(true)
    const hijo = datoApo?.hijos?.find(h => h.id === hijoId)
    try {
      const { data } = await api.post('/inicial/escanear', {
        qr_token: qrToken, estudiante_id: hijoId, accion, ...extras,
      })
      hapticMedium()
      setDatoApo(null)
      setAlumnoInicial(hijo)
      setResultadoInicial(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar')
    } finally {
      setCargando(false)
    }
  }, [cargando, datoApo])

  const cerrarResultadoInicial = useCallback(() => {
    setResultadoInicial(null)
    setAlumnoInicial(null)
    setCamaraActiva(true)
  }, [])

  const handleQR     = useCallback(token => { setCamaraActiva(false); escanear(token) }, [escanear])
  const handleManual = e => { e.preventDefault(); if (dniManual.trim()) escanear(dniManual.trim()) }

  const handleLector = useCallback(e => {
    e.preventDefault()
    const token = lectorInputRef.current?.value?.trim()
    if (!token || cargando) return
    lectorInputRef.current.value = ''
    escanear(token)
  }, [cargando, escanear])

  const copiarTelefono = apo => {
    navigator.clipboard.writeText(`+51${apo.telefono}`)
      .then(() => toast.success('Número copiado')).catch(() => {})
  }

  const enviarWA = apo => {
    cancelarAutoClose()
    const alumno    = `${resultado.estudiante?.nombre} ${resultado.estudiante?.apellido}`
    const grado     = `${resultado.estudiante?.grado} ${resultado.estudiante?.seccion}`
    const estadoStr = resultCfg?.label || ''
    const hora      = resultado.asistencia?.hora?.substring(11, 16) || ''
    const motivo    = resultado.asistencia?.motivo_especial
    const motivoStr = motivo ? `\nMotivo: ${MOTIVO_LABEL[motivo] || motivo}` : ''
    const obs       = resultado.asistencia?.observacion ? `\nObservación: ${resultado.asistencia.observacion}` : ''
    const texto     = `Estimado/a ${apo.nombre},\nLe informamos que *${alumno}* (${grado}) fue registrado/a con estado *${estadoStr}* hoy a las ${hora}.${motivoStr}${obs}\n\n_Colegio CEAUNE_`
    abrirWhatsApp(apo.telefono, texto)
  }

  return (
    <>
      {/* ── Modales del flujo APO- (i-auxiliar / inicial) ─────────────────── */}
      {datoApo && (
        <ModalSeleccionIni
          datoApo={datoApo}
          qrToken={qrTokenApo}
          cargando={cargando}
          onConfirmar={confirmarInicial}
          onCancelar={() => { setDatoApo(null); setCamaraActiva(true) }}
        />
      )}
      {resultadoInicial && alumnoInicial && (
        <PantallaResultadoIni
          resultado={resultadoInicial}
          alumno={alumnoInicial}
          onCerrar={cerrarResultadoInicial}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          <h1 className="text-xl font-bold text-marino">Registrar Asistencia</h1>

          {/* Banner horario modificado */}
          {horarioHoy?.tiene_excepcion && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-800">Horario modificado hoy</p>
                <p className="text-xs text-amber-700 mt-0.5">{horarioHoy.motivo_excepcion}</p>
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {horarioHoy.hora_ingreso_fin && (
                    <span className="text-xs text-amber-700 font-medium">
                      Límite puntual: {horarioHoy.hora_ingreso_fin.substring(0, 5)}
                    </span>
                  )}
                  {horarioHoy.hora_salida_inicio && (
                    <span className="text-xs text-amber-700 font-medium">
                      Inicio salida: {horarioHoy.hora_salida_inicio.substring(0, 5)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Selector modo */}
          <div className="flex gap-2">
            {[
              { id: 'camara', icon: Camera,  label: 'Cámara QR'    },
              { id: 'lector', icon: QrCode,  label: 'Lector físico' },
              { id: 'manual', icon: Hash,    label: 'DNI Manual'   },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setModo(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modo === id ? 'bg-marino text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* Scanner cámara */}
          {modo === 'camara' && (
            <div className="card">
              <p className="text-xs text-gray-400 text-center mb-3">
                Apunta el QR del alumno — el sistema detecta el tipo de registro automáticamente
              </p>
              <QRScanner
                onResult={handleQR}
                activo={camaraActiva && !cargando && !preview}
              />
              {cargando && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
                  <span className="animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />
                  Identificando alumno...
                </div>
              )}
            </div>
          )}

          {/* Lector físico USB */}
          {modo === 'lector' && (
            <form onSubmit={handleLector} className="card space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors ${
                  cargando ? 'bg-dorado/10 border-2 border-dorado/30' : 'bg-green-50 border-2 border-green-100'
                }`}>
                  {cargando
                    ? <span className="w-8 h-8 border-[3px] border-dorado border-t-transparent rounded-full animate-spin" />
                    : <QrCode size={40} className="text-green-500" />
                  }
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${cargando ? 'text-dorado' : 'text-green-700'}`}>
                    {cargando ? 'Identificando alumno...' : 'Lector listo'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cargando ? 'Espera un momento' : 'Pasa el carnet frente al escáner'}
                  </p>
                </div>
              </div>
              <input
                ref={lectorInputRef}
                className="input w-full text-center font-mono tracking-widest"
                placeholder="Esperando escaneo..."
                autoFocus
                disabled={cargando}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </form>
          )}

          {/* DNI manual */}
          {modo === 'manual' && (
            <form onSubmit={handleManual} className="card flex gap-3">
              <input
                className="input flex-1"
                value={dniManual}
                onChange={e => setDniManual(e.target.value)}
                placeholder="Ingrese DNI del alumno"
                maxLength={8}
                disabled={cargando}
              />
              <button
                type="submit"
                disabled={cargando || !dniManual.trim()}
                className="btn-primary whitespace-nowrap"
              >
                {cargando
                  ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  : 'Registrar'}
              </button>
            </form>
          )}
        </div>

        {/* Feed lateral */}
        <div className="card">
          <h3 className="font-semibold text-sm text-marino mb-3">Últimos registros del día</h3>
          {feed.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">Sin registros aún</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[600px]">
              {feed.map((item, i) => {
                const c      = ESTADO_CFG[item.asistencia?.estado] || ESTADO_CFG.puntual
                const motivo = item.asistencia?.motivo_especial
                return (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {item.estudiante?.nombre} {item.estudiante?.apellido}
                      </p>
                      <p className="text-xs text-gray-400">{item.asistencia?.hora?.substring(11, 16)}</p>
                      {motivo && (
                        <p className="text-[10px] text-violet-600 font-medium mt-0.5 truncate">
                          {MOTIVO_LABEL[motivo]}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`${c.cls} text-[10px]`}>{c.label}</span>
                      {item.asistencia?.correo_enviado && <Mail size={10} className="text-dorado" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Preview (verificación de identidad) ──────────────────── */}
      {preview && previewHdr && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center"
          onClick={detenerAutoConfirm}
        >
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Barra auto-confirm */}
            <div className={`h-1 ${previewHdr.bg} opacity-30`}>
              {autoConfirm > 0 && (
                <div
                  className={`h-1 ${previewHdr.bg} transition-all duration-1000 ease-linear`}
                  style={{ width: `${(autoConfirm / AUTO_CONFIRM_SEG) * 100}%` }}
                />
              )}
            </div>

            {/* Header compacto */}
            <div className={`${previewHdr.bg} px-5 py-3 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <p className="text-white font-black text-xl tracking-widest">{previewHdr.label}</p>
                {autoConfirm > 0 && (
                  <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full tabular-nums">
                    {autoConfirm}s
                  </span>
                )}
              </div>
              <button
                onClick={cancelarPreview}
                className="text-white/80 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-5 pb-4 space-y-4">

              {/* ── Bloque central de identidad ── */}
              <div className="flex flex-col items-center text-center gap-3">
                {/* Label verificación */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  <ShieldCheck size={13} className="text-gray-300" />
                  Verificar identidad
                </div>

                {/* Foto grande centrada */}
                <FotoEstudiante
                  foto_url={preview.estudiante?.foto_url}
                  nombre={preview.estudiante?.nombre}
                  ring={previewHdr?.ring || 'ring-gray-200'}
                  size="lg"
                />

                {/* Nombre y grado */}
                <div>
                  <p className="font-black text-marino text-xl leading-tight">
                    {preview.estudiante?.nombre} {preview.estudiante?.apellido}
                  </p>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {formatGradoSeccion(preview.estudiante?.nivel, preview.estudiante?.grado, preview.estudiante?.seccion)}
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="capitalize">{preview.estudiante?.nivel}</span>
                  </p>
                </div>

                {/* Sublabel del estado */}
                {preview.sublabel && (
                  <p className="text-xs text-gray-400 italic">{preview.sublabel}</p>
                )}
              </div>

              {/* CASO: salida_especial → chips de motivo */}
              {preview.requiere_motivo && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                    ¿Por qué sale antes?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MOTIVOS_SALIDA.map(m => (
                      <button
                        key={m.v}
                        type="button"
                        onClick={() => setMotivoEspecial(m.v)}
                        className={`py-3 px-3 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                          motivoEspecial === m.v
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CASO: tardanza → campo de observación */}
              {preview.requiere_observacion && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide text-center">
                    ¿Por qué llegó tarde?
                  </p>
                  <textarea
                    className="input resize-none text-sm"
                    rows={2}
                    value={observacion}
                    onChange={e => setObservacion(e.target.value)}
                    placeholder="Motivo de la tardanza (obligatorio)..."
                    autoFocus
                  />
                </div>
              )}

              {/* CASO: regreso tras salida especial */}
              {preview.tipo_a_enviar === 'ingreso_especial' && preview.motivo_auto && (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                  <p className="text-sm text-violet-700">
                    Regresa de: <span className="font-semibold">{MOTIVO_LABEL[preview.motivo_auto] || preview.motivo_auto}</span>
                  </p>
                </div>
              )}

              {/* Botones */}
              <div className="space-y-2.5">
                <button
                  onClick={confirmarRegistro}
                  disabled={
                    cargando ||
                    (preview.requiere_motivo && !motivoEspecial) ||
                    (preview.requiere_observacion && !observacion.trim())
                  }
                  className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98] hover:opacity-90 ${cargando ? 'bg-gray-400' : previewHdr.bg}`}
                >
                  {cargando
                    ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    : <Check size={17} />}
                  {cargando ? 'Registrando...' : autoConfirm > 0 ? `Confirmar (${autoConfirm}s)` : 'Confirmar registro'}
                </button>

                {/* Botón de seguridad — no es este alumno */}
                <button
                  onClick={cancelarPreview}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  <UserX size={15} />
                  No es este alumno
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Resultado ─────────────────────────────────────────────── */}
      {resultado && resultCfg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={cancelarAutoClose}
          >
            {/* Header con hora + cuenta regresiva */}
            <div className={`${resultCfg.headerBg} px-5 py-4`}>
              {/* Barra de auto-cierre dentro del header */}
              <div className="h-0.5 bg-white/20 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-0.5 bg-white/60 rounded-full transition-all duration-1000"
                  style={{ width: autoActivo ? `${(cuentaRegresiva / AUTO_CIERRE_SEG) * 100}%` : '0%' }}
                />
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-black text-2xl leading-none">{resultCfg.modalLabel}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-white/80 text-sm flex items-center gap-1">
                      <Clock size={12} />
                      {resultado.asistencia?.hora?.substring(11, 16)}
                    </span>
                    {resultado.asistencia?.motivo_especial && (
                      <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {MOTIVO_LABEL[resultado.asistencia.motivo_especial]}
                      </span>
                    )}
                    {resultado.asistencia?.correo_enviado && (
                      <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Mail size={10} /> Correo enviado
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {autoActivo && (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <span className="text-white font-bold text-sm tabular-nums">{cuentaRegresiva}</span>
                    </div>
                  )}
                  <button
                    onClick={cerrarModal}
                    className="text-white/80 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Estudiante — foto pequeña inline */}
            <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100">
              <FotoEstudiante
                foto_url={resultado.estudiante?.foto_url}
                nombre={resultado.estudiante?.nombre}
                ring={resultCfg?.ring || 'ring-gray-200'}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-marino text-base leading-tight truncate">
                  {resultado.estudiante?.nombre} {resultado.estudiante?.apellido}
                </p>
                <p className="text-gray-500 text-sm">
                  {formatGradoSeccion(resultado.estudiante?.nivel, resultado.estudiante?.grado, resultado.estudiante?.seccion)}
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="capitalize text-gray-400 text-xs">{resultado.estudiante?.nivel}</span>
                </p>
              </div>
            </div>

            {/* Observación si la hay */}
            {resultado.asistencia?.observacion && (
              <div className="px-5 pt-3 pb-0">
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Observación</p>
                  <p className="text-sm text-gray-700 leading-snug">{resultado.asistencia.observacion}</p>
                </div>
              </div>
            )}

            {/* Stats + alerta */}
            <div className="px-5 py-3 space-y-2">
              <div className="flex gap-2">
                <div className={`flex-1 rounded-xl px-3 py-2.5 flex items-center gap-2.5 ${tardanzas >= 3 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-black tabular-nums ${tardanzas >= 3 ? 'text-amber-600' : 'text-gray-500'}`}>{tardanzas}</p>
                  <p className={`text-xs leading-tight ${tardanzas >= 3 ? 'text-amber-600' : 'text-gray-400'}`}>tardanzas<br/>este mes</p>
                </div>
                <div className={`flex-1 rounded-xl px-3 py-2.5 flex items-center gap-2.5 ${faltas >= 3 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-black tabular-nums ${faltas >= 3 ? 'text-red-600' : 'text-gray-500'}`}>{faltas}</p>
                  <p className={`text-xs leading-tight ${faltas >= 3 ? 'text-red-600' : 'text-gray-400'}`}>faltas<br/>este mes</p>
                </div>
              </div>

              {hayAlerta && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-red-700 font-semibold text-xs">Patrón frecuente detectado</p>
                    <p className="text-red-500 text-[11px]">Notifica al apoderado</p>
                  </div>
                </div>
              )}
            </div>

            {/* Contactar apoderado */}
            <div className="px-5 pb-3 space-y-2 border-t border-gray-100 pt-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contactar apoderado</p>
              {apoderados.length === 0 ? (
                <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
              ) : (
                <div className="space-y-2">
                  {apoderados.map(apo => (
                    <div key={apo.id} className="flex gap-2">
                      <button
                        onClick={() => copiarTelefono(apo)}
                        className="w-11 h-11 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl transition-colors flex-shrink-0"
                        title="Copiar número"
                      >
                        <Copy size={14} />
                      </button>
                      <a
                        href={`tel:+51${apo.telefono}`}
                        onClick={cancelarAutoClose}
                        className="w-11 h-11 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors flex-shrink-0"
                        title="Llamar"
                      >
                        <Phone size={14} />
                      </a>
                      <button
                        onClick={() => enviarWA(apo)}
                        className="flex items-center justify-center gap-2 h-11 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors flex-1 active:scale-[0.98]"
                      >
                        <MessageCircle size={14} />
                        {apo.nombre}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón cerrar */}
            <div className="px-5 pb-5">
              <button
                onClick={cerrarModal}
                className="w-full py-3 rounded-xl bg-marino text-white font-semibold text-sm hover:bg-marino/90 active:scale-[0.98] transition-all"
              >
                Cerrar y continuar {autoActivo && `(${cuentaRegresiva}s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
