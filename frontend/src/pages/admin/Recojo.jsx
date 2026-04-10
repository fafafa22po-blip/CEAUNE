import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Search, CheckCircle2, Clock, UserX,
  Printer, X, ChevronDown, AlertCircle, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ModalImprimirFotochecks from './ModalImprimirFotochecks'

// ── Helpers ───────────────────────────────────────────────────────────────────
const ESTADO_CFG = {
  pendiente: {
    label: 'Pendiente',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot:   'bg-amber-400',
  },
  activo: {
    label: 'Activo',
    badge: 'bg-green-50 text-green-700 border-green-200',
    dot:   'bg-green-500',
  },
  revocado: {
    label: 'Revocado',
    badge: 'bg-red-50 text-red-700 border-red-200',
    dot:   'bg-red-400',
  },
}

function FotoPersona({ foto_url, nombre }) {
  if (foto_url) {
    return (
      <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
        <img src={foto_url} alt={nombre} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-400 flex-shrink-0 text-base">
      {nombre?.charAt(0) || '?'}
    </div>
  )
}

// ── Modal detalle / activar ───────────────────────────────────────────────────
function ModalDetalle({ persona, onClose, onActivar, onRevocar }) {
  const [precio, setPrecio]   = useState('5.00')
  const [obsAdmin, setObsAdmin] = useState(persona.observacion_admin || '')
  const [loading, setLoading]   = useState(false)

  const activar = async () => {
    setLoading(true)
    await onActivar(persona.id, precio, obsAdmin)
    setLoading(false)
  }

  const est   = persona.estudiante || {}
  const apo   = persona.apoderado  || {}
  const cfg   = ESTADO_CFG[persona.estado] || ESTADO_CFG.pendiente

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,31,61,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-marino px-5 py-4 flex items-center justify-between flex-shrink-0">
          <p className="text-white font-bold">Detalle de solicitud</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Persona autorizada */}
          <div className="flex items-start gap-3">
            <FotoPersona foto_url={persona.foto_url} nombre={persona.nombre} />
            <div>
              <p className="font-bold text-gray-900">{persona.nombre} {persona.apellido}</p>
              <p className="text-xs text-gray-500">DNI: {persona.dni} · {persona.parentesco}</p>
              <span className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Alumno */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Alumno</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-medium text-gray-900 text-sm">{est.nombre} {est.apellido}</p>
              <p className="text-xs text-gray-500">{est.nivel} · {est.grado} {est.seccion}</p>
            </div>
          </div>

          {/* Apoderado titular */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Apoderado titular</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-medium text-gray-900 text-sm">{apo.nombre} {apo.apellido}</p>
              {apo.telefono && <p className="text-xs text-gray-500">{apo.telefono}</p>}
            </div>
          </div>

          {/* Fecha solicitud */}
          {persona.created_at && (
            <p className="text-xs text-gray-400">
              Solicitado el{' '}
              {new Date(persona.created_at).toLocaleDateString('es-PE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          )}

          {/* Acciones según estado */}
          {persona.estado === 'pendiente' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700">Activar fotocheck</p>

              <div>
                <label className="text-xs text-gray-500">Precio cobrado (S/.)</label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={precio}
                  onChange={e => setPrecio(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-marino/30"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Observación (opcional)</label>
                <textarea
                  value={obsAdmin}
                  onChange={e => setObsAdmin(e.target.value)}
                  rows={2}
                  placeholder="Notas internas..."
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-marino/30 resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Verifica el DNI original de la persona antes de activar.
                  Al activar se genera el QR del fotocheck.
                </p>
              </div>

              <button
                onClick={activar}
                disabled={loading}
                className="w-full py-3 bg-green-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-60"
              >
                {loading ? 'Activando...' : 'Confirmar pago y activar fotocheck'}
              </button>
            </div>
          )}

          {persona.estado === 'activo' && (
            <div className="border-t border-gray-100 pt-4 space-y-2">
              {persona.vigencia_hasta && (
                <p className="text-xs text-gray-500">
                  Vigente hasta:{' '}
                  {new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </p>
              )}
              <button
                onClick={() => onRevocar(persona)}
                className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium"
              >
                Revocar este fotocheck
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card solicitud ────────────────────────────────────────────────────────────
function CardSolicitud({ persona, onDetalle, onImprimir, onRevocarDirecto }) {
  const cfg = ESTADO_CFG[persona.estado] || ESTADO_CFG.pendiente
  const est = persona.estudiante || {}

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <FotoPersona foto_url={persona.foto_url} nombre={persona.nombre} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-gray-900">
                {persona.nombre} {persona.apellido}
              </p>
              <p className="text-xs text-gray-500">{persona.parentesco} · DNI {persona.dni}</p>
            </div>
            <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>

          <div className="mt-2 bg-gray-50 rounded-xl p-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">Alumno:</span>
            <span className="text-xs font-medium text-gray-700">
              {est.nombre} {est.apellido} · {est.nivel} {est.grado}{est.seccion}
            </span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => onDetalle(persona)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600"
        >
          <Eye className="w-3.5 h-3.5" />
          {persona.estado === 'pendiente' ? 'Ver / Activar' : 'Ver detalle'}
        </button>

        {persona.estado === 'activo' && (
          <button
            onClick={() => onImprimir(persona)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-marino text-white rounded-xl text-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir fotocheck
          </button>
        )}

        {persona.estado !== 'revocado' && (
          <button
            onClick={() => onRevocarDirecto(persona)}
            className="w-9 flex items-center justify-center py-2 border border-red-100 rounded-xl text-red-400"
            title="Revocar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'pendiente', label: 'Pendientes', Icon: Clock },
  { key: 'activo',    label: 'Activos',    Icon: CheckCircle2 },
  { key: 'revocado',  label: 'Revocados',  Icon: UserX },
]

export default function AdminRecojo() {
  const queryClient = useQueryClient()
  const [tab,     setTab]     = useState('pendiente')
  const [buscar,  setBuscar]  = useState('')
  const [detalle, setDetalle] = useState(null)
  const [confirmRev,    setConfirmRev]    = useState(null)
  const [loadRev,       setLoadRev]       = useState(false)
  const [modalImprimir, setModalImprimir] = useState(null)  // null | 'seccion' | persona

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['admin-recojo', tab],
    queryFn: () =>
      api.get('/recojo/admin/solicitudes', { params: { estado: tab } })
        .then(r => r.data),
  })

  // Filtro local por búsqueda
  const filtradas = solicitudes.filter(p => {
    if (!buscar) return true
    const q = buscar.toLowerCase()
    return (
      p.nombre?.toLowerCase().includes(q) ||
      p.apellido?.toLowerCase().includes(q) ||
      p.dni?.includes(q) ||
      p.estudiante?.nombre?.toLowerCase().includes(q) ||
      p.estudiante?.apellido?.toLowerCase().includes(q)
    )
  })

  const activar = async (id, precio, obs) => {
    try {
      await api.put(`/recojo/admin/${id}/activar`, { precio, observacion: obs })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo'] })
      toast.success('Fotocheck activado correctamente')
      setDetalle(null)
      // Redirigir a tab activos para imprimir
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
      toast.success('Fotocheck revocado')
      setConfirmRev(null)
      setDetalle(null)
    } catch {
      toast.error('Error al revocar')
    } finally {
      setLoadRev(false)
    }
  }

  const imprimir = (persona) => setModalImprimir(persona)

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-marino flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recojo Responsable</h1>
            <p className="text-xs text-gray-500">Gestión de fotochecks de recojo</p>
          </div>
        </div>
        <button
          onClick={() => setModalImprimir('seccion')}
          className="flex items-center gap-1.5 px-3 py-2 bg-marino text-white rounded-xl text-xs font-medium flex-shrink-0"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir por sección
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, DNI o alumno..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-marino/30"
        />
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        {TABS.map(({ key, label, Icon }) => {
          const count = key === tab ? filtradas.length : solicitudes.filter(p => p.estado === key).length
          return (
            <button
              key={key}
              onClick={() => { setTab(key); setBuscar('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === key
                  ? 'bg-white shadow text-marino'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  tab === key ? 'bg-marino text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ShieldCheck className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">
            {buscar ? 'Sin resultados para tu búsqueda' : `Sin solicitudes ${TABS.find(t => t.key === tab)?.label.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(p => (
            <CardSolicitud
              key={p.id}
              persona={p}
              onDetalle={setDetalle}
              onImprimir={imprimir}
              onRevocarDirecto={setConfirmRev}
            />
          ))}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,31,61,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-base mb-2">¿Revocar fotocheck?</h3>
            <p className="text-sm text-gray-600 mb-5">
              El fotocheck de{' '}
              <strong>{confirmRev.nombre} {confirmRev.apellido}</strong>{' '}
              quedará inactivo. El QR dejará de funcionar inmediatamente.
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
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60"
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
