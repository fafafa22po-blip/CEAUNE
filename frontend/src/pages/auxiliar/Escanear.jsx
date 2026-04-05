import { useState, useCallback, useEffect, useRef } from 'react'
import { Hash, Camera, Mail, Clock, MessageCircle, X, Phone, Copy, AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import QRScanner from '../../components/QRScanner'
import api from '../../lib/api'
import { abrirWhatsApp } from '../../lib/externo'

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
  ingreso:          { bg: 'bg-green-500',  label: 'INGRESO'           },
  tardanza:         { bg: 'bg-amber-500',  label: 'TARDANZA'          },
  salida:           { bg: 'bg-blue-500',   label: 'SALIDA'            },
  salida_especial:  { bg: 'bg-orange-500', label: 'SALIDA ANTICIPADA' },
  ingreso_especial: { bg: 'bg-violet-600', label: 'REGRESO'           },
}

const ESTADO_CFG = {
  puntual:  { label: 'PUNTUAL',  cls: 'badge-verde',    headerBg: 'bg-green-500',  modalLabel: 'Llegó a tiempo'     },
  tardanza: { label: 'TARDANZA', cls: 'badge-amarillo', headerBg: 'bg-amber-500',  modalLabel: 'Tardanza detectada' },
  especial: { label: 'ESPECIAL', cls: 'badge-naranja',  headerBg: 'bg-violet-600', modalLabel: 'Registro especial'  },
  falta:    { label: 'FALTA',    cls: 'badge-rojo',     headerBg: 'bg-red-500',    modalLabel: 'Falta registrada'   },
}

const AUTO_CONFIRM_SEG = 3
const AUTO_CIERRE_SEG  = 5

function StatBadge({ valor, label, color }) {
  return (
    <div className={`flex-1 rounded-xl p-3 text-center ${color}`}>
      <p className="text-xl font-bold">{valor}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

export default function Escanear() {
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
  const confirmarRef  = useRef(null)   // ref para evitar closure stale en auto-confirm

  // ── Fase 2: resultado ────────────────────────────────────────────────────
  const [resultado, setResultado]           = useState(null)
  const [apoderados, setApoderados]         = useState([])
  const [cuentaRegresiva, setCuentaRegresiva] = useState(AUTO_CIERRE_SEG)
  const [autoActivo, setAutoActivo]         = useState(false)
  const closeTimerRef = useRef(null)

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

  const handleQR     = useCallback(token => { setCamaraActiva(false); escanear(token) }, [escanear])
  const handleManual = e => { e.preventDefault(); if (dniManual.trim()) escanear(dniManual.trim()) }

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
              { id: 'camara', icon: Camera, label: 'Cámara QR'  },
              { id: 'manual', icon: Hash,   label: 'DNI Manual' },
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

          {/* Scanner / DNI manual */}
          {modo === 'camara' ? (
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
          ) : (
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

      {/* ── Modal: Preview (confirmación previa al registro) ─────────────── */}
      {preview && previewHdr && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={detenerAutoConfirm}
        >
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Barra de progreso auto-confirm */}
            <div className="h-1.5 bg-gray-100">
              {autoConfirm > 0 && (
                <div
                  className="h-1.5 bg-white/60 transition-all duration-1000 ease-linear"
                  style={{ width: `${(autoConfirm / AUTO_CONFIRM_SEG) * 100}%` }}
                />
              )}
            </div>

            {/* Header coloreado con acción detectada */}
            <div className={`${previewHdr.bg} px-5 py-4`}>
              <div className="flex items-center justify-between">
                <p className="text-white font-bold text-2xl tracking-wide">{previewHdr.label}</p>
                <button
                  onClick={cancelarPreview}
                  className="text-white/80 hover:text-white w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-white/75 text-sm mt-0.5">{preview.sublabel}</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Info del alumno */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400 flex-shrink-0">
                  {preview.estudiante?.nombre?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="font-bold text-marino text-lg leading-tight">
                    {preview.estudiante?.nombre} {preview.estudiante?.apellido}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {preview.estudiante?.grado}° {preview.estudiante?.seccion}
                    <span className="text-gray-400"> · {preview.estudiante?.nivel}</span>
                  </p>
                </div>
              </div>

              {/* CASO: salida_especial → chips de motivo */}
              {preview.requiere_motivo && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
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

              {/* CASO: regreso tras salida especial → muestra motivo heredado */}
              {preview.tipo_a_enviar === 'ingreso_especial' && preview.motivo_auto && (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                  <p className="text-sm text-violet-700">
                    Regresa de: <span className="font-semibold">{MOTIVO_LABEL[preview.motivo_auto] || preview.motivo_auto}</span>
                  </p>
                </div>
              )}

              {/* Botones */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={confirmarRegistro}
                  disabled={
                    cargando ||
                    (preview.requiere_motivo && !motivoEspecial) ||
                    (preview.requiere_observacion && !observacion.trim())
                  }
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: cargando ? '#999' : undefined }}
                >
                  {cargando
                    ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    : <Check size={16} />}
                  {cargando
                    ? 'Registrando...'
                    : autoConfirm > 0
                    ? `Confirmar (${autoConfirm}s)`
                    : 'Confirmar registro'}
                </button>
                <button
                  onClick={cancelarPreview}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
                >
                  Cancelar — no es este alumno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Resultado ─────────────────────────────────────────────── */}
      {resultado && resultCfg && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in"
            onClick={cancelarAutoClose}
          >
            {/* Barra de auto-cierre */}
            <div className="h-1 bg-gray-100">
              <div
                className="h-1 transition-all duration-1000"
                style={{
                  width: autoActivo ? `${(cuentaRegresiva / AUTO_CIERRE_SEG) * 100}%` : '0%',
                  backgroundColor: 'rgba(255,255,255,0.5)',
                }}
              />
            </div>

            <div className={`${resultCfg.headerBg} px-5 py-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-bold text-xl">{resultCfg.modalLabel}</p>
                  <p className="text-white/75 text-sm capitalize">
                    {resultado.asistencia?.tipo?.replace(/_/g, ' ')}
                  </p>
                  {resultado.asistencia?.motivo_especial && (
                    <span className="inline-block mt-2 px-2.5 py-1 bg-white/20 rounded-lg text-white text-xs font-semibold">
                      {MOTIVO_LABEL[resultado.asistencia.motivo_especial]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {autoActivo && (
                    <span className="text-white/60 text-xs font-mono w-5 text-center">
                      {cuentaRegresiva}
                    </span>
                  )}
                  <button
                    onClick={cerrarModal}
                    className="text-white/80 hover:text-white w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400 flex-shrink-0">
                  {resultado.estudiante?.nombre?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="font-bold text-marino text-lg leading-tight">
                    {resultado.estudiante?.nombre} {resultado.estudiante?.apellido}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {resultado.estudiante?.grado} {resultado.estudiante?.seccion}
                  </p>
                  <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                    <Clock size={11} />
                    {resultado.asistencia?.hora?.substring(11, 19)}
                  </p>
                </div>
              </div>

              {resultado.asistencia?.observacion && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                    Observación
                  </p>
                  <p className="text-sm text-gray-700">{resultado.asistencia.observacion}</p>
                </div>
              )}

              <div className="flex gap-2">
                <StatBadge
                  valor={tardanzas}
                  label="tardanzas mes"
                  color={tardanzas >= 3 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}
                />
                <StatBadge
                  valor={faltas}
                  label="faltas mes"
                  color={faltas >= 3 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}
                />
              </div>

              {hayAlerta && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 font-semibold text-sm">Patrón frecuente detectado</p>
                  <p className="text-red-600 text-xs mt-0.5">Se recomienda notificar al apoderado</p>
                </div>
              )}

              {resultado.asistencia?.correo_enviado && (
                <span className="badge-verde flex items-center gap-1 text-xs w-fit">
                  <Mail size={11} /> Correo enviado al apoderado
                </span>
              )}

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Contactar apoderado
                </p>
                {apoderados.length === 0 ? (
                  <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                ) : (
                  <div className="space-y-2">
                    {apoderados.map(apo => (
                      <div key={apo.id} className="flex gap-2">
                        <button
                          onClick={() => copiarTelefono(apo)}
                          className="flex items-center justify-center px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                          title="Copiar número"
                        >
                          <Copy size={13} />
                        </button>
                        <a
                          href={`tel:+51${apo.telefono}`}
                          onClick={cancelarAutoClose}
                          className="flex items-center justify-center px-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                          title="Llamar"
                        >
                          <Phone size={13} />
                        </a>
                        <button
                          onClick={() => enviarWA(apo)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors flex-1"
                        >
                          <MessageCircle size={13} />
                          {apo.nombre}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-5">
              <button onClick={cerrarModal} className="w-full btn-primary">
                Cerrar y continuar {autoActivo && `(${cuentaRegresiva}s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
