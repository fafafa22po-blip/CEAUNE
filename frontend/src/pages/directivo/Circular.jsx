import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Send, Paperclip, X, Users, Stamp, CheckCircle,
  Eye, ScanLine, Camera, AlertTriangle, ShieldAlert,
  CalendarClock, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { obtenerUsuario } from '../../lib/auth'
import { QK } from '../../lib/queryKeys'
import { scanDocument, takePhoto, compressImage, esNativo } from '../../lib/documentScanner'

// ── CONSTANTES ────────────────────────────────────────────────────────────────

const CARGO_DIRECTIVO = {
  inicial:    'Directora de Inicial',
  primaria:   'Subdirector de Primaria',
  secundaria: 'Subdirector de Secundaria',
  formacion:  'Subdir. Form. General',
  todos:      'Director del CEAUNE',
}

const NIVEL_DEST = {
  inicial:    'apoderados de Inicial',
  primaria:   'apoderados de Primaria',
  secundaria: 'apoderados de Secundaria',
  formacion:  'apoderados del CEAUNE',
  todos:      'apoderados del CEAUNE',
}

const URGENCIAS = [
  { value: 'normal',   label: 'Normal',   icon: Stamp,        color: 'text-marino',   bg: 'bg-marino/10',   activeBg: 'bg-marino',   prefix: ''             },
  { value: 'urgente',  label: 'Urgente',  icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50',   activeBg: 'bg-amber-500', prefix: '[URGENTE] '  },
  { value: 'citacion', label: 'Citación', icon: ShieldAlert,  color: 'text-red-600',   bg: 'bg-red-50',     activeBg: 'bg-red-500',   prefix: '[CITACIÓN] ' },
]

const URGENCIA_BADGE = {
  normal:   null,
  urgente:  { label: 'Urgente',  bg: 'bg-amber-50 text-amber-700', Icon: AlertTriangle },
  citacion: { label: 'Citación', bg: 'bg-red-50 text-red-600',     Icon: ShieldAlert   },
}

const MAX_CHARS = 2000

// ── HELPERS ───────────────────────────────────────────────────────────────────

function formatFecha(iso) {
  if (!iso) return ''
  return format(new Date(iso), "d 'de' MMMM, HH:mm", { locale: es })
}

function asuntoConPrefijo(urgencia, asunto) {
  const u = URGENCIAS.find(u => u.value === urgencia)
  return (u?.prefix ?? '') + asunto
}

function parsearAsunto(asuntoRaw = '') {
  if (asuntoRaw.startsWith('[URGENTE] '))  return { urgencia: 'urgente',  asunto: asuntoRaw.replace('[URGENTE] ', '')  }
  if (asuntoRaw.startsWith('[CITACIÓN] ')) return { urgencia: 'citacion', asunto: asuntoRaw.replace('[CITACIÓN] ', '') }
  return { urgencia: 'normal', asunto: asuntoRaw }
}

// ── TARJETA CIRCULAR ─────────────────────────────────────────────────────────

function TarjetaCircular({ circular }) {
  const { urgencia, asunto } = parsearAsunto(circular.asunto)
  const badge = URGENCIA_BADGE[urgencia]
  const pct = circular.total_destinatarios > 0
    ? Math.round((circular.leidos / circular.total_destinatarios) * 100)
    : 0

  return (
    <div className="bg-white rounded-2xl p-4 shadow-card border-l-4 border-marino">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Stamp size={13} className="text-marino flex-shrink-0" />
          <p className="text-sm font-bold text-gray-900 truncate">{asunto}</p>
        </div>
        <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
          {formatFecha(circular.created_at)}
        </span>
      </div>

      {badge && (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${badge.bg}`}>
          <badge.Icon size={10} />
          {badge.label}
        </span>
      )}

      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{circular.mensaje}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users size={11} className="text-gray-400" />
          <span className="text-xs text-gray-500">{circular.total_destinatarios} familias</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Eye size={11} className="text-emerald-600" />
          <span className="text-xs font-bold text-emerald-700">{pct}% leído</span>
        </div>
      </div>

      {circular.total_destinatarios > 0 && (
        <div className="mt-2 bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── MODAL DE CONFIRMACIÓN ─────────────────────────────────────────────────────

function ModalConfirmacion({ cargo, destLabel, asunto, mensaje, urgencia, adjunto, onConfirmar, onCancelar, enviando }) {
  const badge = URGENCIA_BADGE[urgencia]
  const asuntoFinal = asuntoConPrefijo(urgencia, asunto)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="bg-marino px-5 py-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-dorado/20 flex items-center justify-center">
              <Stamp size={18} className="text-dorado" />
            </div>
            <div>
              <p className="text-xs text-white/60 leading-none">Confirmación de envío</p>
              <p className="text-sm font-bold leading-tight">{cargo}</p>
            </div>
          </div>
          <p className="text-xs text-white/50">
            Se enviará a todos los <span className="text-white/80 font-semibold">{destLabel}</span>
          </p>
        </div>

        {/* Preview */}
        <div className="p-4 space-y-3">
          <div className="bg-gray-50 rounded-2xl p-3">
            {badge && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${badge.bg}`}>
                <badge.Icon size={10} /> {badge.label}
              </span>
            )}
            <p className="text-sm font-bold text-gray-900">{asuntoFinal}</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-3">{mensaje}</p>
            {adjunto && (
              <div className="flex items-center gap-1.5 mt-2">
                <Paperclip size={11} className="text-marino" />
                <span className="text-[11px] text-marino truncate">{adjunto.name}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            ¿Confirmas el envío de esta circular?
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              disabled={enviando}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={enviando}
              className="btn-primary flex-1"
            >
              {enviando
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></>
                : <><Send size={14} /> Enviar</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

export default function Circular() {
  const usuario   = obtenerUsuario()
  const cargo     = CARGO_DIRECTIVO[usuario?.nivel] || 'Directivo'
  const destLabel = NIVEL_DEST[usuario?.nivel] || 'todos los apoderados'

  const [urgencia,    setUrgencia]    = useState('normal')
  const [asunto,      setAsunto]      = useState('')
  const [mensaje,     setMensaje]     = useState('')
  const [adjunto,     setAdjunto]     = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando,    setEnviando]    = useState(false)
  const [enviado,     setEnviado]     = useState(false)
  const fileRef = useRef()
  const queryClient = useQueryClient()

  const { data: circulares = [], isLoading: cargandoLista } = useQuery({
    queryKey: QK.directivoCirculares,
    queryFn:  () => api.get('/directivo/circulares').then(r => r.data),
    staleTime: 60_000,
  })

  const subirAdjunto = async (file) => {
    const compressed = await compressImage(file)
    const fd = new FormData()
    fd.append('archivo', compressed, file.name)
    const { data } = await api.post('/comunicados/subir-adjunto', fd)
    return data
  }

  const handleConfirmar = async () => {
    setEnviando(true)
    try {
      let adjunto_nombre    = null
      let adjunto_drive_url = null
      if (adjunto) {
        const result = await subirAdjunto(adjunto)
        adjunto_nombre    = result.nombre
        adjunto_drive_url = result.url
      }
      await api.post('/directivo/circular', {
        asunto:  asuntoConPrefijo(urgencia, asunto.trim()),
        mensaje: mensaje.trim(),
        adjunto_nombre,
        adjunto_drive_url,
      })
      toast.success('Circular enviada correctamente')
      setAsunto('')
      setMensaje('')
      setAdjunto(null)
      setUrgencia('normal')
      setConfirmando(false)
      setEnviado(true)
      setTimeout(() => setEnviado(false), 3000)
      queryClient.invalidateQueries({ queryKey: QK.directivoCirculares })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar circular')
    } finally {
      setEnviando(false)
    }
  }

  const handleEscanear = async () => {
    try {
      const file = await scanDocument()
      if (file) setAdjunto(file)
    } catch { toast.error('No se pudo escanear') }
  }

  const handleFoto = async () => {
    try {
      const file = await takePhoto()
      if (file) setAdjunto(file)
    } catch { toast.error('No se pudo tomar foto') }
  }

  const puedeEnviar = asunto.trim().length >= 3 && mensaje.trim().length >= 10

  return (
    <div className="lg:max-w-none max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-black text-marino">Circular Oficial</h1>
        <p className="text-xs text-gray-400 mt-0.5">{cargo}</p>
      </div>

      {/* ── Grid desktop: formulario izq | historial der ── */}
      <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-6 lg:items-start space-y-5 lg:space-y-0">

      {/* Formulario */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">

        {/* Sello directivo */}
        <div className="bg-marino px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-dorado/20 flex items-center justify-center flex-shrink-0">
            <Stamp size={16} className="text-dorado" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">{cargo}</p>
            <p className="text-[10px] text-white/50">Para {destLabel}</p>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* Selector de urgencia */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Tipo de circular
            </label>
            <div className="flex gap-2">
              {URGENCIAS.map(u => {
                const isActive = urgencia === u.value
                return (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUrgencia(u.value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ${
                      isActive
                        ? `${u.activeBg} text-white border-transparent shadow-sm`
                        : `${u.bg} border-gray-200 ${u.color}`
                    }`}
                  >
                    <u.icon size={16} />
                    <span className="text-[11px] font-bold">{u.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Asunto */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Asunto
            </label>
            {urgencia !== 'normal' && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] text-gray-400">Se enviará como:</span>
                <span className="text-[10px] font-bold text-gray-600">
                  {asuntoConPrefijo(urgencia, asunto || '...')}
                </span>
              </div>
            )}
            <input
              className="input"
              placeholder="Ej: Reunión de padres de familia — Mayo 2026"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Mensaje</label>
              <span className="text-[10px] text-gray-400 tabular-nums">{mensaje.length}/{MAX_CHARS}</span>
            </div>
            <textarea
              className="input resize-none"
              rows={6}
              placeholder="Redacta el comunicado oficial aquí..."
              value={mensaje}
              onChange={e => setMensaje(e.target.value.slice(0, MAX_CHARS))}
            />
          </div>

          {/* Adjunto */}
          {adjunto ? (
            <div className="flex items-center gap-2 bg-marino/5 rounded-xl px-3 py-2">
              <Paperclip size={14} className="text-marino flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">{adjunto.name}</span>
              <button type="button" onClick={() => setAdjunto(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-marino transition-colors px-3 py-2 rounded-xl border border-dashed border-gray-200 hover:border-marino/30"
              >
                <Paperclip size={13} /> Adjuntar
              </button>
              {esNativo && (
                <>
                  <button type="button" onClick={handleEscanear}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-marino transition-colors px-3 py-2 rounded-xl border border-dashed border-gray-200 hover:border-marino/30">
                    <ScanLine size={13} /> Escanear
                  </button>
                  <button type="button" onClick={handleFoto}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-marino transition-colors px-3 py-2 rounded-xl border border-dashed border-gray-200 hover:border-marino/30">
                    <Camera size={13} /> Foto
                  </button>
                </>
              )}
              <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf"
                onChange={e => e.target.files?.[0] && setAdjunto(e.target.files[0])} />
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            disabled={!puedeEnviar || enviando}
            onClick={() => setConfirmando(true)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {enviado ? (
              <><CheckCircle size={16} /> Circular enviada</>
            ) : (
              <><ChevronRight size={16} /> Revisar y enviar</>
            )}
          </button>
        </div>
      </div>

      {/* Historial — columna derecha en desktop, debajo en mobile */}
      <section
        className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={14} className="text-gray-400" />
          <p className="section-title mb-0">Circulares enviadas</p>
        </div>
        {cargandoLista ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : circulares.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-card">
            <Stamp size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-500">Aún no has enviado circulares</p>
            <p className="text-xs text-gray-400 mt-0.5">Las circulares aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {circulares.map(c => <TarjetaCircular key={c.id} circular={c} />)}
          </div>
        )}
      </section>

      {/* Cierre del grid desktop */}
      </div>

      {/* Modal de confirmación */}
      {confirmando && (
        <ModalConfirmacion
          cargo={cargo}
          destLabel={destLabel}
          asunto={asunto}
          mensaje={mensaje}
          urgencia={urgencia}
          adjunto={adjunto}
          enviando={enviando}
          onConfirmar={handleConfirmar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
