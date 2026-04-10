import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Search, CheckCircle2, Clock, UserX,
  Printer, X, ChevronDown, AlertCircle, Eye,
  ShieldX, CalendarCheck, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ModalImprimirFotochecks from './ModalImprimirFotochecks'

// ── Helpers ───────────────────────────────────────────────────────────────────
const ESTADO_CFG = {
  pendiente: {
    label:      'Pendiente',
    badge:      'bg-amber-50 text-amber-700 border-amber-200',
    dot:        'bg-amber-400',
    borderCard: 'border-l-amber-400',
    statBg:     'bg-amber-50 border-amber-200',
    statText:   'text-amber-700',
    statNum:    'text-amber-600',
    Icon:       Clock,
  },
  activo: {
    label:      'Activo',
    badge:      'bg-green-50 text-green-700 border-green-200',
    dot:        'bg-green-500',
    borderCard: 'border-l-green-500',
    statBg:     'bg-green-50 border-green-200',
    statText:   'text-green-700',
    statNum:    'text-green-600',
    Icon:       CheckCircle2,
  },
  revocado: {
    label:      'Revocado',
    badge:      'bg-red-50 text-red-700 border-red-200',
    dot:        'bg-red-400',
    borderCard: 'border-l-red-300',
    statBg:     'bg-red-50 border-red-200',
    statText:   'text-red-700',
    statNum:    'text-red-500',
    Icon:       UserX,
  },
}

const NIVELES = ['inicial', 'primaria', 'secundaria']

function FotoPersona({ foto_url, nombre, size = 'md', revocado = false }) {
  const dim = size === 'lg' ? 'w-20 h-20 rounded-2xl text-3xl' : 'w-14 h-14 rounded-xl text-xl'
  const filter = revocado ? 'grayscale opacity-60' : ''
  if (foto_url) {
    return (
      <div className={`${dim} overflow-hidden flex-shrink-0 bg-gray-100 ${filter}`}>
        <img src={foto_url} alt={nombre} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${dim} bg-gray-100 flex items-center justify-center font-bold text-gray-400 flex-shrink-0 ${filter}`}>
      {nombre?.charAt(0) || '?'}
    </div>
  )
}

// ── Modal detalle / activar ───────────────────────────────────────────────────
function ModalDetalle({ persona, onClose, onActivar, onRevocar }) {
  const [precio,   setPrecio]   = useState(persona.precio_fotocheck || '5.00')
  const [obsAdmin, setObsAdmin] = useState(persona.observacion_admin || '')
  const [loading,  setLoading]  = useState(false)

  const activar = async () => {
    setLoading(true)
    await onActivar(persona.id, precio, obsAdmin)
    setLoading(false)
  }

  const est = persona.estudiante || {}
  const apo = persona.apoderado  || {}
  const cfg = ESTADO_CFG[persona.estado] || ESTADO_CFG.pendiente

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,31,61,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#0a1f3d] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-white/70" />
            <p className="text-white font-bold">Detalle de solicitud</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {/* Persona autorizada — foto grande */}
          <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
            <FotoPersona foto_url={persona.foto_url} nombre={persona.nombre} size="lg" revocado={persona.estado === 'revocado'} />
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-900 text-base leading-tight">
                {persona.nombre} {persona.apellido}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{persona.parentesco}</p>
              <p className="text-xs text-gray-400 mt-0.5">DNI: {persona.dni}</p>
              <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Alumno */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Alumno</p>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              {est.foto_url ? (
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={est.foto_url} alt={est.nombre} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#0a1f3d]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#0a1f3d]">{est.nombre?.charAt(0)}</span>
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm">{est.nombre} {est.apellido}</p>
                <p className="text-xs text-gray-500 capitalize">{est.nivel} · {est.grado}° "{est.seccion}"</p>
              </div>
            </div>
          </div>

          {/* Apoderado */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Apoderado titular</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-medium text-gray-900 text-sm">{apo.nombre} {apo.apellido}</p>
              {apo.telefono && <p className="text-xs text-gray-500 mt-0.5">{apo.telefono}</p>}
            </div>
          </div>

          {/* Fecha solicitud */}
          {persona.created_at && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" />
              Solicitado el{' '}
              {new Date(persona.created_at).toLocaleDateString('es-PE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          )}

          {/* ── Estado: PENDIENTE → formulario activación ── */}
          {persona.estado === 'pendiente' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-bold text-gray-800">Activar fotocheck</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Precio cobrado (S/.)</label>
                  <input
                    type="number" step="0.50" min="0"
                    value={precio}
                    onChange={e => setPrecio(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Vigencia hasta</label>
                  <input
                    type="text" readOnly
                    value="31/12/2025"
                    className="mt-1 w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium">Observación (opcional)</label>
                <textarea
                  value={obsAdmin}
                  onChange={e => setObsAdmin(e.target.value)}
                  rows={2}
                  placeholder="Notas internas..."
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Verifica el DNI original de <strong>{persona.nombre}</strong> antes de activar.
                </p>
              </div>

              <button
                onClick={activar}
                disabled={loading}
                className="w-full py-3 bg-green-600 text-white rounded-2xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Activando...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Confirmar pago y activar</>
                }
              </button>
            </div>
          )}

          {/* ── Estado: ACTIVO → vigencia + zona peligro ── */}
          {persona.estado === 'activo' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              {persona.vigencia_hasta && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-green-700 font-medium">
                    Vigente hasta{' '}
                    {new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {persona.precio_fotocheck && (
                <p className="text-xs text-gray-400">Pago registrado: S/. {persona.precio_fotocheck}</p>
              )}

              {/* Zona peligro */}
              <div className="border border-red-100 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wide">Zona de riesgo</p>
                <p className="text-xs text-gray-500">
                  Revocar desactivará el QR inmediatamente. La persona no podrá recoger al alumno.
                </p>
                <button
                  onClick={() => onRevocar(persona)}
                  className="w-full py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <ShieldX className="w-4 h-4" />
                  Revocar este fotocheck
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card solicitud ────────────────────────────────────────────────────────────
function CardSolicitud({ persona, onDetalle, onImprimir }) {
  const cfg = ESTADO_CFG[persona.estado] || ESTADO_CFG.pendiente
  const est = persona.estudiante || {}
  const esPendiente = persona.estado === 'pendiente'
  const esActivo    = persona.estado === 'activo'
  const esRevocado  = persona.estado === 'revocado'

  const diasDesde = persona.created_at
    ? Math.floor((Date.now() - new Date(persona.created_at)) / 86_400_000)
    : null

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${cfg.borderCard} shadow-sm overflow-hidden ${esRevocado ? 'opacity-70' : ''}`}>
      <div className="p-4 flex items-start gap-3">
        <FotoPersona foto_url={persona.foto_url} nombre={persona.nombre} revocado={esRevocado} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-900 leading-tight">
                {persona.nombre} {persona.apellido}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{persona.parentesco} · DNI {persona.dni}</p>
            </div>
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>

          {/* Alumno */}
          <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Alumno</span>
            <span className="text-xs font-semibold text-gray-700 truncate">
              {est.nombre} {est.apellido}
            </span>
            <span className="text-[10px] text-gray-400 capitalize flex-shrink-0">
              {est.nivel} · {est.grado}°{est.seccion}
            </span>
          </div>

          {/* Info extra según estado */}
          {esPendiente && diasDesde !== null && (
            <p className={`text-[10px] mt-1.5 font-medium ${diasDesde >= 2 ? 'text-amber-500' : 'text-gray-400'}`}>
              {diasDesde === 0 ? 'Solicitado hoy' : diasDesde === 1 ? 'Solicitado ayer' : `Solicitado hace ${diasDesde} días`}
              {diasDesde >= 2 && ' · Esperando atención'}
            </p>
          )}
          {esActivo && persona.vigencia_hasta && (
            <p className="text-[10px] text-green-600 font-medium mt-1.5">
              Vigente hasta {new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className={`flex gap-2 px-4 pb-4 ${esPendiente ? 'flex-col' : 'flex-row'}`}>
        {esPendiente && (
          <button
            onClick={() => onDetalle(persona)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Activar fotocheck
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onDetalle(persona)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600"
          >
            <Eye className="w-3.5 h-3.5" />
            {esPendiente ? 'Ver detalle' : 'Ver detalle'}
          </button>
          {esActivo && (
            <button
              onClick={() => onImprimir(persona)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0a1f3d] text-white rounded-xl text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'pendiente', label: 'Pendientes', Icon: Clock        },
  { key: 'activo',    label: 'Activos',    Icon: CheckCircle2 },
  { key: 'revocado',  label: 'Revocados',  Icon: UserX        },
]

export default function AdminRecojo() {
  const queryClient = useQueryClient()
  const [tab,     setTab]     = useState('pendiente')
  const [buscar,  setBuscar]  = useState('')
  const [nivel,   setNivel]   = useState('')
  const [detalle, setDetalle] = useState(null)
  const [confirmRev,    setConfirmRev]    = useState(null)
  const [loadRev,       setLoadRev]       = useState(false)
  const [modalImprimir, setModalImprimir] = useState(null)
  const [filtrosOpen,   setFiltrosOpen]   = useState(false)

  // Stats globales
  const { data: stats = { pendiente: 0, activo: 0, revocado: 0 } } = useQuery({
    queryKey: ['admin-recojo-stats'],
    queryFn:  () => api.get('/recojo/admin/stats').then(r => r.data),
    refetchInterval: 30_000,
  })

  // Lista filtrada por tab
  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['admin-recojo', tab],
    queryFn: () =>
      api.get('/recojo/admin/solicitudes', { params: { estado: tab } })
        .then(r => r.data),
  })

  // Filtro local
  const filtradas = solicitudes.filter(p => {
    const q = buscar.toLowerCase()
    const matchQ = !buscar ||
      p.nombre?.toLowerCase().includes(q) ||
      p.apellido?.toLowerCase().includes(q) ||
      p.dni?.includes(q) ||
      p.estudiante?.nombre?.toLowerCase().includes(q) ||
      p.estudiante?.apellido?.toLowerCase().includes(q)
    const matchNivel = !nivel || p.estudiante?.nivel === nivel
    return matchQ && matchNivel
  })

  const activar = async (id, precio, obs) => {
    try {
      await api.put(`/recojo/admin/${id}/activar`, { precio, observacion: obs })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo'] })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-stats'] })
      toast.success('Fotocheck activado correctamente')
      setDetalle(null)
      setTab('activo')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al activar')
    }
  }

  const revocar = async (persona) => {
    setLoadRev(true)
    try {
      await api.put(`/recojo/admin/${persona.id}/revocar`, { motivo: 'Revocado por admin' })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo'] })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-stats'] })
      toast.success('Fotocheck revocado')
      setConfirmRev(null)
      setDetalle(null)
    } catch {
      toast.error('Error al revocar')
    } finally {
      setLoadRev(false)
    }
  }

  const hayFiltros = !!nivel

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0a1f3d] flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recojo Responsable</h1>
            <p className="text-xs text-gray-500">Gestión de fotochecks</p>
          </div>
        </div>
        <button
          onClick={() => setModalImprimir('seccion')}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1f3d] text-white rounded-xl text-xs font-medium flex-shrink-0"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir por sección
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {TABS.map(({ key, label, Icon }) => {
          const cfg     = ESTADO_CFG[key]
          const activo  = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-2xl border p-3.5 flex flex-col gap-1 text-left transition-all ${
                activo
                  ? `${cfg.statBg} ${cfg.statText} border-current shadow-sm`
                  : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-black leading-none ${activo ? cfg.statNum : 'text-gray-700'}`}>
                  {stats[key] ?? 0}
                </span>
                <Icon className={`w-4 h-4 ${activo ? cfg.statText : 'text-gray-300'}`} />
              </div>
              <span className="text-[11px] font-semibold leading-tight opacity-80">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Búsqueda + filtros */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por nombre, DNI o alumno..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-marino/30"
            />
          </div>
          <button
            onClick={() => setFiltrosOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              hayFiltros
                ? 'bg-[#0a1f3d] text-white border-[#0a1f3d]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {hayFiltros ? 'Filtros activos' : 'Filtrar'}
          </button>
        </div>

        {filtrosOpen && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 relative">
              <select
                value={nivel}
                onChange={e => setNivel(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none appearance-none focus:ring-2 focus:ring-marino/30"
              >
                <option value="">Todos los niveles</option>
                {NIVELES.map(n => (
                  <option key={n} value={n} className="capitalize">{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {hayFiltros && (
              <button
                onClick={() => setNivel('')}
                className="text-xs text-red-500 font-medium whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setBuscar('') }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === key
                ? 'bg-white shadow text-[#0a1f3d]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {stats[key] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === key ? 'bg-[#0a1f3d] text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {stats[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ShieldCheck className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {buscar || hayFiltros ? 'Sin resultados para tu búsqueda' : `Sin solicitudes ${TABS.find(t => t.key === tab)?.label.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(p => (
            <CardSolicitud
              key={p.id}
              persona={p}
              onDetalle={setDetalle}
              onImprimir={p => setModalImprimir(p)}
            />
          ))}
          <p className="text-center text-xs text-gray-400 pt-1">
            {filtradas.length} {filtradas.length === 1 ? 'resultado' : 'resultados'}
          </p>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <ModalDetalle
          persona={detalle}
          onClose={() => setDetalle(null)}
          onActivar={activar}
          onRevocar={setConfirmRev}
        />
      )}

      {/* Modal imprimir fotochecks */}
      {modalImprimir && (
        <ModalImprimirFotochecks
          onClose={() => setModalImprimir(null)}
          personaInicial={modalImprimir !== 'seccion' ? modalImprimir : null}
        />
      )}

      {/* Modal confirmar revocar */}
      {confirmRev && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(10,31,61,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center mb-1">¿Revocar fotocheck?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              El QR de{' '}
              <strong className="text-gray-800">{confirmRev.nombre} {confirmRev.apellido}</strong>{' '}
              dejará de funcionar inmediatamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRev(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => revocar(confirmRev)}
                disabled={loadRev}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-60"
              >
                {loadRev ? 'Revocando...' : 'Sí, revocar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
