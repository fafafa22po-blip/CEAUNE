import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Plus, X, Camera, AlertCircle, CheckCircle2,
  Clock, UserX, ChevronDown, Info, Upload,
  CalendarDays, Flag, AlertTriangle,
  ChevronLeft, ChevronRight, CalendarOff,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isToday, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useHijo } from '../../context/HijoContext'
import { QK } from '../../lib/queryKeys'

// ── Configuración visual por estado ──────────────────────────────────────────
const ESTADO_CFG = {
  pendiente: {
    label: 'Pendiente de pago',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot:   'bg-amber-400',
    Icon:  Clock,
  },
  activo: {
    label: 'Activo',
    color: 'bg-green-50 text-green-700 border-green-200',
    dot:   'bg-green-500',
    Icon:  CheckCircle2,
  },
  revocado: {
    label: 'Revocado',
    color: 'bg-red-50 text-red-700 border-red-200',
    dot:   'bg-red-400',
    Icon:  UserX,
  },
}

const PARENTESCOS = [
  'Madre', 'Padre', 'Abuelo/a', 'Tío/a', 'Hermano/a mayor',
  'Empleada del hogar', 'Otro familiar', 'Otro',
]


// ── Componente foto persona ───────────────────────────────────────────────────
function FotoPersona({ foto_url, nombre, size = 'md' }) {
  const dim = size === 'lg'
    ? 'w-20 h-20 rounded-2xl text-3xl'
    : size === 'xl'
    ? 'w-24 h-24 rounded-2xl text-4xl'
    : 'w-12 h-12 rounded-xl text-xl'
  if (foto_url) {
    return (
      <div className={`${dim} overflow-hidden flex-shrink-0 bg-gray-100`}>
        <img src={foto_url} alt={nombre} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${dim} bg-gray-100 flex items-center justify-center font-bold text-gray-400 flex-shrink-0`}>
      {nombre?.charAt(0) || '?'}
    </div>
  )
}

// ── Modal de confirmación de solicitud ────────────────────────────────────────
function ModalConfirmacionSolicitud({ persona, estudiante, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,31,61,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-green-500 px-6 py-5 text-center">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-bold text-lg">¡Solicitud registrada!</p>
          <p className="text-white/80 text-sm mt-1">
            {persona.nombre} {persona.apellido}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  Próximos pasos obligatorios
                </p>
                <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                  <li>Preséntate en <strong>secretaría</strong> del colegio</li>
                  <li>Lleva a <strong>{persona.nombre} {persona.apellido}</strong> con su <strong>DNI original</strong></li>
                  <li>Realiza el <strong>pago del fotocheck</strong></li>
                  <li>El personal activará el QR y entregará el fotocheck impreso</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-marino flex-shrink-0" />
            <p className="text-sm text-gray-600">
              Autorizado para recoger a{' '}
              <strong>{estudiante.nombre} {estudiante.apellido}</strong>
            </p>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Sin el fotocheck físico activo, no se permitirá el recojo.
          </p>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 bg-marino text-white rounded-2xl font-semibold text-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal formulario nueva solicitud ─────────────────────────────────────────
function ModalNuevaSolicitud({ hijo, onClose, onSuccess }) {
  const [form, setForm]       = useState({ nombre: '', apellido: '', dni: '', parentesco: '' })
  const [fotoPreview, setFotoPreview] = useState(null)
  const [fotoB64, setFotoB64]         = useState(null)
  const [enviando, setEnviando]       = useState(false)
  const [errores, setErrores]         = useState({})
  const fileRef = useRef()

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrores(e => ({ ...e, [k]: undefined }))
  }

  const handleFoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('La foto no debe superar 5 MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => { setFotoPreview(ev.target.result); setFotoB64(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim())         e.nombre     = 'Requerido'
    if (!form.apellido.trim())       e.apellido   = 'Requerido'
    if (!/^\d{8}$/.test(form.dni))  e.dni        = 'DNI debe tener 8 dígitos'
    if (!form.parentesco)            e.parentesco = 'Selecciona parentesco'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const enviar = async () => {
    if (!validar()) return
    setEnviando(true)
    try {
      const { data } = await api.post('/recojo/solicitar', {
        estudiante_id: hijo.id,
        nombre:        form.nombre.trim(),
        apellido:      form.apellido.trim(),
        dni:           form.dni.trim(),
        parentesco:    form.parentesco,
        foto_url:      fotoB64 || null,
      })
      onSuccess(data, hijo)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,31,61,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="bg-marino px-5 py-4 rounded-t-3xl sm:rounded-t-3xl flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-white font-bold text-base">Nueva persona autorizada</p>
            <p className="text-white/60 text-xs mt-0.5">Para recoger a {hijo.nombre} {hijo.apellido}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-marino transition-colors"
            >
              {fotoPreview
                ? <img src={fotoPreview} alt="preview" className="w-full h-full object-cover" />
                : <div className="flex flex-col items-center gap-1 text-gray-400"><Camera className="w-7 h-7" /><span className="text-xs">Foto</span></div>
              }
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-marino font-medium flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              {fotoPreview ? 'Cambiar foto' : 'Subir foto (recomendado)'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleFoto} className="hidden" />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              La foto solo es visible al escanear el fotocheck en el colegio.
              <strong> No aparece impresa en el carnet</strong> por seguridad.
            </p>
          </div>

          {[
            { key: 'nombre',   label: 'Nombre *',   placeholder: 'Nombre de la persona' },
            { key: 'apellido', label: 'Apellido *',  placeholder: 'Apellido de la persona' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
              <input
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-marino/30 ${errores[key] ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errores[key] && <p className="text-xs text-red-500 mt-1">{errores[key]}</p>}
            </div>
          ))}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DNI *</label>
            <input
              value={form.dni}
              onChange={e => set('dni', e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="8 dígitos"
              inputMode="numeric"
              maxLength={8}
              className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-marino/30 ${errores.dni ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errores.dni && <p className="text-xs text-red-500 mt-1">{errores.dni}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parentesco *</label>
            <div className="relative mt-1">
              <select
                value={form.parentesco}
                onChange={e => set('parentesco', e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none appearance-none focus:ring-2 focus:ring-marino/30 ${errores.parentesco ? 'border-red-400' : 'border-gray-200'} ${!form.parentesco ? 'text-gray-400' : 'text-gray-800'}`}
              >
                <option value="">Seleccionar parentesco</option>
                {PARENTESCOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {errores.parentesco && <p className="text-xs text-red-500 mt-1">{errores.parentesco}</p>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button onClick={enviar} disabled={enviando} className="w-full py-3 bg-marino text-white rounded-2xl font-semibold text-sm disabled:opacity-60">
            {enviando ? 'Registrando...' : 'Registrar solicitud'}
          </button>
          <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-500 font-medium">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Card de persona autorizada ────────────────────────────────────────────────
function CardPersona({ persona, onRevocar }) {
  const cfg = ESTADO_CFG[persona.estado] || ESTADO_CFG.pendiente
  const { Icon } = cfg

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <FotoPersona foto_url={persona.foto_url} nombre={persona.nombre} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{persona.nombre} {persona.apellido}</p>
          <p className="text-xs text-gray-500 mt-0.5">{persona.parentesco} · DNI {persona.dni}</p>
          <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          {persona.vigencia_hasta && persona.estado === 'activo' && (
            <p className="text-xs text-gray-400 mt-1">
              Vigente hasta {new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        {persona.estado !== 'revocado' && (
          <button onClick={() => onRevocar(persona)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0" title="Revocar autorización">
            <X className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
      {persona.estado === 'pendiente' && (
        <div className="bg-amber-50 border-t border-amber-100 px-4 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Preséntate en secretaría con esta persona y su DNI para pagar y activar el fotocheck.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Modal reportar irregularidad ─────────────────────────────────────────────
function ModalReportar({ log, onClose, onSuccess }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    if (!motivo.trim()) { toast.error('Describe el motivo'); return }
    setEnviando(true)
    try {
      await api.post(`/recojo/reportar/${log.id}`, { motivo: motivo.trim() })
      toast.success('Irregularidad reportada al colegio')
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al reportar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(10,31,61,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-red-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white" />
            <p className="text-white font-bold">Reportar irregularidad</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Info del log */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <p className="font-semibold text-gray-800">{log.responsable?.nombre} {log.responsable?.apellido}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Recogió a {log.estudiante?.nombre} {log.estudiante?.apellido} el {log.fecha} a las {log.hora}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Describe la irregularidad *
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={4}
              placeholder="Ej: No reconozco a esta persona, nunca la autoricé para recoger a mi hijo..."
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              El colegio recibirá esta alerta de inmediato y tomará las acciones correspondientes.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button onClick={enviar} disabled={enviando} className="w-full py-3 bg-red-500 text-white rounded-2xl font-semibold text-sm disabled:opacity-60">
            {enviando ? 'Enviando...' : 'Enviar reporte'}
          </button>
          <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-500 font-medium">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Hero card: estado de hoy ──────────────────────────────────────────────────
function CardHoy({ hijoActivo }) {
  const { data: estadoHoy = [], isLoading } = useQuery({
    queryKey: ['recojo-estado-hoy'],
    queryFn:  () => api.get('/recojo/estado-hoy').then(r => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading) return <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />

  const hijo = hijoActivo
    ? estadoHoy.find(h => h.estudiante.id === hijoActivo.id)
    : estadoHoy[0]

  if (!hijo) return null

  const { ingreso, recojo } = hijo

  // Determinar estado y paleta
  const recogido  = !!recojo
  const asistio   = !!ingreso
  const borderCol = recogido ? 'border-l-green-500' : asistio ? 'border-l-amber-400' : 'border-l-gray-300'

  return (
    <div className={`card border-l-4 ${borderCol}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Hoy</p>
        <p className="text-xs text-gray-400 capitalize">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {recogido ? (
        /* ── Ya fue recogido ── */
        <div className="flex items-center gap-3 mt-2">
          {recojo.foto_snapshot ? (
            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
              <img src={recojo.foto_snapshot} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-black text-green-600">{recojo.nombre?.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-black text-green-700 text-base leading-tight">Ya fue recogido</p>
            <p className="text-sm text-gray-700 font-semibold mt-0.5">
              {recojo.nombre} {recojo.apellido}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{recojo.parentesco} · {recojo.hora}</p>
          </div>
          <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
        </div>
      ) : asistio ? (
        /* ── Asistió, pendiente de recojo ── */
        <div className="flex items-center gap-3 mt-2">
          <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-7 h-7 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-black text-amber-600 text-base leading-tight">Pendiente de recojo</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Ingresó a las {ingreso.hora}
              {ingreso.estado === 'tardanza' && <span className="text-amber-500 ml-1">· Tardanza</span>}
            </p>
          </div>
        </div>
      ) : (
        /* ── No asistió ── */
        <div className="flex items-center gap-3 mt-2">
          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <CalendarOff className="w-7 h-7 text-gray-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-500 text-base leading-tight">No asistió hoy</p>
            <p className="text-xs text-gray-400 mt-0.5">Sin registro de ingreso</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Autorizados ─────────────────────────────────────────────────────────
function TabAutorizados({ hijoActivo, cargandoHijo }) {
  const queryClient      = useQueryClient()
  const [modalNuevo, setModalNuevo]       = useState(false)
  const [confirmacion, setConfirmacion]   = useState(null)
  const [confirmRevocar, setConfirmRevocar] = useState(null)

  const { data: autorizados = [], isLoading } = useQuery({
    queryKey: ['recojo-autorizados', hijoActivo?.id],
    queryFn: () =>
      api.get('/recojo/mis-autorizados', {
        params: hijoActivo ? { estudiante_id: hijoActivo.id } : {},
      }).then(r => r.data),
    enabled: !cargandoHijo,
  })

  const mutRevocar = useMutation({
    mutationFn: (id) => api.delete(`/recojo/autorizado/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recojo-autorizados'] })
      toast.success('Autorización revocada')
      setConfirmRevocar(null)
    },
    onError: () => toast.error('No se pudo revocar'),
  })

  const handleSolicitudExitosa = (data, hijo) => {
    queryClient.invalidateQueries({ queryKey: ['recojo-autorizados'] })
    setModalNuevo(false)
    setConfirmacion({ persona: data, estudiante: hijo })
  }

  return (
    <>
      <div className="space-y-4">
        {/* Botón agregar */}
        <button
          onClick={() => setModalNuevo(true)}
          disabled={!hijoActivo}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-marino/30 rounded-2xl text-marino text-sm font-medium hover:border-marino/50 hover:bg-marino/5 transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Agregar persona autorizada
        </button>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">¿Cómo funciona?</p>
            <ol className="text-xs space-y-0.5 list-decimal list-inside">
              <li>Solicita aquí a la persona autorizada</li>
              <li>Ve a secretaría con esa persona y su DNI</li>
              <li>Paga el fotocheck y el colegio lo activa</li>
              <li>La persona presenta el fotocheck al recoger al niño</li>
            </ol>
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : autorizados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ShieldCheck className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Sin personas autorizadas</p>
            <p className="text-xs mt-1">Agrega a alguien de confianza para el recojo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {autorizados.map(p => (
              <CardPersona key={p.id} persona={p} onRevocar={setConfirmRevocar} />
            ))}
          </div>
        )}
      </div>

      {modalNuevo && (
        <ModalNuevaSolicitud
          hijo={hijoActivo}
          onClose={() => setModalNuevo(false)}
          onSuccess={handleSolicitudExitosa}
        />
      )}

      {confirmacion && (
        <ModalConfirmacionSolicitud
          persona={confirmacion.persona}
          estudiante={confirmacion.estudiante}
          onClose={() => setConfirmacion(null)}
        />
      )}

      {confirmRevocar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,31,61,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-base mb-2">¿Revocar autorización?</h3>
            <p className="text-sm text-gray-600 mb-5">
              El fotocheck de{' '}
              <strong>{confirmRevocar.nombre} {confirmRevocar.apellido}</strong>{' '}
              quedará inactivo inmediatamente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRevocar(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Cancelar</button>
              <button onClick={() => mutRevocar.mutate(confirmRevocar.id)} disabled={mutRevocar.isPending} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                {mutRevocar.isPending ? 'Revocando...' : 'Sí, revocar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Helpers calendario ───────────────────────────────────────────────────────
const CELDA_CFG = {
  recogido:   { bg: 'bg-green-100', text: 'text-green-700', icon: '✓' },
  pendiente:  { bg: 'bg-amber-100', text: 'text-amber-600', icon: '?' },
  sin_recojo: { bg: 'bg-gray-100',  text: 'text-gray-400',  icon: '—' },
  no_asistio: { bg: 'bg-red-100',   text: 'text-red-600',   icon: '✗' },
}

function construirSemanas(mes) {
  const diasLV = eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) })
    .filter(d => { const dow = getDay(d); return dow >= 1 && dow <= 5 })
  const semanas = []
  let prevKey = null, actual = null
  diasLV.forEach(d => {
    const dow = getDay(d)
    const lun = new Date(d)
    lun.setDate(d.getDate() - (dow - 1))
    const key = lun.toDateString()
    if (key !== prevKey) { prevKey = key; actual = [null,null,null,null,null]; semanas.push(actual) }
    actual[dow - 1] = d
  })
  return semanas
}

// ── Tab: Calendario de recojos ───────────────────────────────────────────────
function TabCalendario({ hijoActivo }) {
  const queryClient  = useQueryClient()
  const [mes, setMes] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [modalReportar, setModalReportar]     = useState(null)

  const mesMes  = mes.getMonth() + 1
  const mesYear = mes.getFullYear()
  const hoy     = new Date()
  const hoyStr  = format(hoy, 'yyyy-MM-dd')

  const { data: calData, isPending } = useQuery({
    queryKey: QK.recojoCalendario(hijoActivo?.id, mesMes, mesYear),
    queryFn:  () => api.get('/recojo/calendario-mes', {
      params: {
        mes:           mesMes,
        anio:          mesYear,
        estudiante_id: hijoActivo?.id,
      },
    }).then(r => r.data),
    enabled:   !!hijoActivo?.id,
    staleTime: 30_000,
  })

  // Cerrar detalle al cambiar mes o hijo
  useEffect(() => { setDiaSeleccionado(null) }, [mesMes, mesYear, hijoActivo?.id])

  const estados   = calData?.estados   ?? {}
  const detalle   = calData?.detalle   ?? {}
  const diasNoLab = calData?.dias_no_lab ?? {}
  const semanas   = construirSemanas(mes)

  const celdaCfg = (d) => {
    if (!d) return null
    const dStr = format(d, 'yyyy-MM-dd')
    if (dStr > hoyStr)       return { bg: 'bg-gray-50',  text: 'text-gray-200', icon: null }
    if (diasNoLab[dStr])     return { bg: 'bg-sky-50',   text: 'text-sky-400',  icon: 'L'  }
    const estado = estados[dStr]
    return estado ? CELDA_CFG[estado] : { bg: 'bg-gray-100', text: 'text-gray-300', icon: '—' }
  }

  // Detalle del día seleccionado
  const diaEstado = diaSeleccionado ? estados[diaSeleccionado] : null
  const diaDetalle = diaSeleccionado ? detalle[diaSeleccionado] : null
  const diaNoLab   = diaSeleccionado ? diasNoLab[diaSeleccionado] : null
  const diaCfg     = diaEstado ? CELDA_CFG[diaEstado] : null

  if (!hijoActivo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Selecciona un hijo para ver el historial</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Hero card: estado de hoy ── */}
      <CardHoy hijoActivo={hijoActivo} />

      {/* ── Calendario del mes ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Historial de recojos</p>
            <p className="font-bold text-marino capitalize text-lg">
              {format(mes, 'MMMM yyyy', { locale: es })}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{hijoActivo.nombre} {hijoActivo.apellido}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              disabled={mes.getFullYear() === hoy.getFullYear() && mes.getMonth() === hoy.getMonth()}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Cabecera días */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          {['Lun','Mar','Mié','Jue','Vie'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400">{d}</div>
          ))}
        </div>

        {/* Grilla */}
        {isPending ? (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {semanas.map((semana, si) => (
              <div key={si} className="grid grid-cols-5 gap-2">
                {semana.map((d, di) => {
                  const cfg  = celdaCfg(d)
                  if (!d || !cfg) return <div key={di} />
                  const dStr   = format(d, 'yyyy-MM-dd')
                  const esHoy  = isToday(d)
                  const futuro = dStr > hoyStr
                  return (
                    <div
                      key={di}
                      onClick={!futuro ? () => setDiaSeleccionado(dStr) : undefined}
                      className={`rounded-xl flex flex-col items-center justify-center py-3 gap-0.5 select-none ${cfg.bg} ${
                        esHoy ? 'ring-2 ring-marino ring-offset-1' : ''
                      } ${!futuro ? 'cursor-pointer active:scale-95 transition-transform' : ''} ${
                        diaSeleccionado === dStr ? 'ring-2 ring-dorado ring-offset-1' : ''
                      }`}
                    >
                      <span className={`text-sm font-bold leading-none ${cfg.text}`}>
                        {cfg.icon ?? ''}
                      </span>
                      <span className={`text-xs leading-none ${esHoy ? 'font-bold text-marino' : 'text-gray-400'}`}>
                        {format(d, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          {[
            { bg: 'bg-green-100', text: 'text-green-700', icon: '✓', label: 'Recogido'     },
            { bg: 'bg-amber-100', text: 'text-amber-600', icon: '?', label: 'Pendiente'    },
            { bg: 'bg-red-100',   text: 'text-red-600',   icon: '✗', label: 'No asistió'   },
            { bg: 'bg-gray-100',  text: 'text-gray-400',  icon: '—', label: 'Sin registro' },
            { bg: 'bg-sky-50',    text: 'text-sky-400',   icon: 'L', label: 'No laborable' },
          ].map(({ bg, text, icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${bg} ${text}`}>
                {icon}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom sheet: detalle del día ── */}
      {diaSeleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
          onClick={() => setDiaSeleccionado(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up sm:mx-4"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {/* Handle móvil */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pt-3 pb-5">
              {/* Cabecera */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xl font-black text-marino capitalize">
                    {format(parseISO(diaSeleccionado), "EEEE d", { locale: es })}
                  </p>
                  <p className="text-sm text-gray-400 capitalize">
                    {format(parseISO(diaSeleccionado), "MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <button
                  onClick={() => setDiaSeleccionado(null)}
                  className="p-2 -mr-2 -mt-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              {/* Badge estado */}
              {diaCfg && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold mb-4 ${diaCfg.bg} ${diaCfg.text}`}>
                  <span className="text-base">{diaCfg.icon}</span>
                  {{ recogido: 'Recogido', pendiente: 'Pendiente', sin_recojo: 'Sin recojo registrado', no_asistio: 'No asistió' }[diaEstado]}
                </div>
              )}

              {/* Contenido según estado */}
              {diaNoLab ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CalendarOff size={22} className="text-sky-300" />
                  </div>
                  <p className="text-sm font-semibold text-sky-500">Día no laborable</p>
                  <p className="text-xs text-gray-400 mt-1">{diaNoLab}</p>
                </div>
              ) : diaEstado === 'recogido' && diaDetalle ? (
                <div className="space-y-3">
                  {/* Responsable */}
                  <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-2xl p-4">
                    {diaDetalle.foto_snapshot ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={diaDetalle.foto_snapshot} alt="Responsable" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-green-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-black text-green-700">
                          {diaDetalle.nombre?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base">
                        {diaDetalle.nombre} {diaDetalle.apellido}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">{diaDetalle.parentesco}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        Recogido a las <strong className="text-gray-700 ml-0.5">{diaDetalle.hora}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Badge reportado */}
                  {diaDetalle.reportado && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                      <Flag size={14} className="text-red-500 flex-shrink-0" />
                      <p className="text-xs font-medium text-red-700">Este recojo fue reportado como irregularidad</p>
                    </div>
                  )}

                  {/* Botón reportar */}
                  {!diaDetalle.reportado && (
                    <button
                      onClick={() => {
                        setDiaSeleccionado(null)
                        setModalReportar({
                          id:           diaDetalle.log_id,
                          fecha:        format(parseISO(diaSeleccionado), "dd/MM/yyyy"),
                          hora:         diaDetalle.hora,
                          responsable:  { nombre: diaDetalle.nombre, apellido: diaDetalle.apellido },
                          estudiante:   { nombre: hijoActivo?.nombre, apellido: hijoActivo?.apellido },
                        })
                      }}
                      className="w-full text-xs text-red-500 font-medium flex items-center justify-center gap-1.5 py-2 hover:text-red-700 transition-colors"
                    >
                      <Flag size={12} />
                      Reportar irregularidad
                    </button>
                  )}
                </div>
              ) : diaEstado === 'pendiente' ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Clock size={22} className="text-amber-400" />
                  </div>
                  <p className="text-sm font-semibold text-amber-600">Pendiente de recojo</p>
                  <p className="text-xs text-gray-400 mt-1">Tu hijo asistió hoy y aún no ha sido recogido</p>
                </div>
              ) : diaEstado === 'sin_recojo' ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <UserX size={22} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Sin recojo registrado</p>
                  <p className="text-xs text-gray-400 mt-1">No se registró recojo vía sistema este día</p>
                </div>
              ) : diaEstado === 'no_asistio' ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CalendarOff size={22} className="text-red-300" />
                  </div>
                  <p className="text-sm font-medium text-red-500">No asistió este día</p>
                  <p className="text-xs text-gray-400 mt-1">No hay registro de ingreso</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Clock size={22} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">Sin información</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal reportar irregularidad */}
      {modalReportar && (
        <ModalReportar
          log={modalReportar}
          onClose={() => setModalReportar(null)}
          onSuccess={() => {
            setModalReportar(null)
            queryClient.invalidateQueries({ queryKey: QK.recojoCalendario(hijoActivo?.id, mesMes, mesYear) })
          }}
        />
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'recojo',      label: 'Recojo',      Icon: CalendarDays },
  { id: 'autorizados', label: 'Autorizados', Icon: ShieldCheck  },
]

export default function Recojo() {
  const { hijoActivo, cargando: cargandoHijo } = useHijo()
  const [tab, setTab] = useState('recojo')

  if (cargandoHijo) {
    return (
      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
        <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-28">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-marino" />
          Recojo Seguro
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {hijoActivo ? <>Seguimiento de <strong>{hijoActivo.nombre}</strong></> : 'Todos tus hijos'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === id
                ? 'bg-white text-marino shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'recojo'      && <TabCalendario  hijoActivo={hijoActivo} />}
      {tab === 'autorizados' && <TabAutorizados hijoActivo={hijoActivo} cargandoHijo={cargandoHijo} />}
    </div>
  )
}
