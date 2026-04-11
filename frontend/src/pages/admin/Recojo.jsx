import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Search, CheckCircle2, Clock, UserX,
  Printer, X, ChevronDown, AlertCircle, Eye,
  ShieldX, CalendarCheck, QrCode,
  RotateCcw, UserCheck, Users, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ModalImprimirFotochecks from './ModalImprimirFotochecks'

// ── Constantes ────────────────────────────────────────────────────────────────
const PARENTESCOS = [
  'padre', 'madre', 'abuelo', 'abuela', 'tío', 'tía',
  'hermano', 'hermana', 'tutor legal', 'otro',
]
const ESTADO_CFG = {
  pendiente: {
    label: 'Pendiente',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
    borderCard: 'border-l-amber-400',
    statBg: 'bg-amber-50 border-amber-200',
    statText: 'text-amber-700',
    statNum: 'text-amber-600',
    Icon: Clock,
  },
  activo: {
    label: 'Activo',
    badge: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
    borderCard: 'border-l-green-500',
    statBg: 'bg-green-50 border-green-200',
    statText: 'text-green-700',
    statNum: 'text-green-600',
    Icon: CheckCircle2,
  },
  revocado: {
    label: 'Revocado',
    badge: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-400',
    borderCard: 'border-l-red-300',
    statBg: 'bg-red-50 border-red-200',
    statText: 'text-red-700',
    statNum: 'text-red-500',
    Icon: UserX,
  },
  sin_fotocheck: {
    label: 'Sin QR',
    badge: 'bg-gray-50 text-gray-500 border-gray-200',
    dot: 'bg-gray-300',
    borderCard: 'border-l-gray-200',
    Icon: QrCode,
  },
}

const TABS_SOL = [
  { key: 'pendiente', label: 'Pendientes', Icon: Clock },
  { key: 'activo',    label: 'Activos',    Icon: CheckCircle2 },
  { key: 'revocado',  label: 'Revocados',  Icon: UserX },
]

// ── Foto ──────────────────────────────────────────────────────────────────────
function Foto({ foto_url, nombre, className = 'w-9 h-9', square = false }) {
  const shape = square ? 'rounded-xl' : 'rounded-full'
  if (foto_url) {
    return (
      <div className={`${className} ${shape} overflow-hidden flex-shrink-0 bg-gray-100`}>
        <img src={foto_url} alt={nombre} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${className} ${shape} bg-[#0a1f3d]/10 flex items-center justify-center font-bold text-[#0a1f3d]/40 flex-shrink-0 text-sm`}>
      {nombre?.charAt(0) || '?'}
    </div>
  )
}



// ── Panel detalle recojo ──────────────────────────────────────────────────────
function PanelDetalleRecojo({ apoderado, estudiante, onClose, onActivar, onImprimir, onRevocar }) {
  const ft     = apoderado.fotocheck
  const estado = ft?.estado || 'sin_fotocheck'
  const cfg    = ESTADO_CFG[estado]

  const [parentesco,  setParentesco]  = useState('padre')
  const [precio,      setPrecio]      = useState('5.00')
  const [observacion, setObservacion] = useState('')
  const [loading,     setLoading]     = useState(false)

  const handleActivar = async () => {
    setLoading(true)
    await onActivar({
      apoderado_id:  apoderado.usuario_id,
      estudiante_id: estudiante.id,
      parentesco, precio, observacion,
    })
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,31,61,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#0a1f3d] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Foto foto_url={apoderado.foto_url} nombre={apoderado.nombre} className="w-10 h-10" square />
            <div>
              <p className="text-white font-bold leading-tight">
                {apoderado.nombre} {apoderado.apellido}
              </p>
              <p className="text-white/50 text-xs mt-0.5 font-mono">DNI {apoderado.dni}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {/* Badges de contacto */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
              <UserCheck className="w-3 h-3" />
              Apoderado registrado
            </span>
            {apoderado.telefono && (
              <span className="text-xs text-gray-500">{apoderado.telefono}</span>
            )}
          </div>

          {/* Alumno */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <Foto foto_url={estudiante.foto_url} nombre={estudiante.nombre} className="w-10 h-10" square />
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {estudiante.nombre} {estudiante.apellido}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                Inicial · {estudiante.grado}° "{estudiante.seccion}"
              </p>
            </div>
          </div>

          {/* ── Estado: ACTIVO ── */}
          {estado === 'activo' && ft && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-bold text-green-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Fotocheck activo
                </p>
                <p className="text-xs text-green-600">
                  Parentesco: <strong>{ft.parentesco}</strong>
                  {ft.vigencia_hasta && (
                    <> · Vigente hasta{' '}
                      {new Date(ft.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </>
                  )}
                </p>
                {ft.precio_fotocheck && (
                  <p className="text-xs text-gray-400">Pago: S/. {ft.precio_fotocheck}</p>
                )}
              </div>

              <button
                onClick={() => onImprimir(apoderado)}
                className="w-full py-3 bg-[#0a1f3d] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir fotocheck
              </button>

              <div className="border border-red-100 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wide">Zona de riesgo</p>
                <p className="text-xs text-gray-500">
                  Revocar desactivará el QR inmediatamente.
                </p>
                <button
                  onClick={() => onRevocar(ft)}
                  className="w-full py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <ShieldX className="w-4 h-4" />
                  Revocar fotocheck
                </button>
              </div>
            </div>
          )}

          {/* ── Estado: SIN FOTOCHECK o REVOCADO → formulario ── */}
          {(estado === 'sin_fotocheck' || estado === 'revocado') && (
            <div className="space-y-3">
              {estado === 'revocado' && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <ShieldX className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-600">
                    Fotocheck revocado — genera uno nuevo para reactivar el acceso.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Parentesco</label>
                  <div className="relative mt-1">
                    <select
                      value={parentesco}
                      onChange={e => setParentesco(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0a1f3d]/20 appearance-none bg-white"
                    >
                      {PARENTESCOS.map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Precio cobrado (S/.)</label>
                  <input
                    type="number" step="0.50" min="0"
                    value={precio}
                    onChange={e => setPrecio(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium">Observación (opcional)</label>
                <textarea
                  value={observacion}
                  onChange={e => setObservacion(e.target.value)}
                  rows={2}
                  placeholder="Notas internas..."
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Verifica el DNI <strong>{apoderado.dni}</strong> antes de generar.
                </p>
              </div>

              <button
                onClick={handleActivar}
                disabled={loading}
                className="w-full py-3 bg-green-600 text-white rounded-2xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Generar fotocheck</>
                )}
              </button>
            </div>
          )}

          {/* ── Estado: PENDIENTE (solicitud de tercero existente) ── */}
          {estado === 'pendiente' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Este apoderado tiene una solicitud pendiente de revisión.
                Gestiona desde la pestaña <strong>Solicitudes</strong>.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Fila compacta: 1 apoderado + alumno ──────────────────────────────────────
function FilaRecojo({ apoderado, estudiante, onVerDetalle }) {
  const ft     = apoderado.fotocheck
  const estado = ft?.estado || 'sin_fotocheck'
  const cfg    = ESTADO_CFG[estado]

  return (
    <button
      onClick={() => onVerDetalle(apoderado, estudiante)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors text-left"
    >
      {/* Foto apoderado */}
      <Foto foto_url={apoderado.foto_url} nombre={apoderado.nombre} className="w-10 h-10 flex-shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
          {apoderado.nombre} {apoderado.apellido}
        </p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {ft?.parentesco
            ? ft.parentesco.charAt(0).toUpperCase() + ft.parentesco.slice(1)
            : 'Apoderado'
          }
          {' · '}
          <span className="text-gray-500 font-medium">
            {estudiante.apellido}, {estudiante.nombre}
          </span>
          {' · '}
          {estudiante.grado}°&nbsp;"{estudiante.seccion}"
        </p>
      </div>

      {/* Badge estado */}
      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    </button>
  )
}

// ── Modal Detalle (solicitudes de terceros) ───────────────────────────────────
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

          {/* Persona */}
          <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
            <Foto foto_url={persona.foto_url} nombre={persona.nombre} className="w-20 h-20" square />
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
              <Foto foto_url={est.foto_url} nombre={est.nombre} className="w-10 h-10" square />
              <div>
                <p className="font-semibold text-gray-900 text-sm">{est.nombre} {est.apellido}</p>
                <p className="text-xs text-gray-500 capitalize">{est.nivel} · {est.grado}° "{est.seccion}"</p>
              </div>
            </div>
          </div>

          {/* Apoderado titular */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Solicitado por</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-medium text-gray-900 text-sm">{apo.nombre} {apo.apellido}</p>
              {apo.telefono && <p className="text-xs text-gray-500 mt-0.5">{apo.telefono}</p>}
            </div>
          </div>

          {persona.created_at && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" />
              Solicitado el{' '}
              {new Date(persona.created_at).toLocaleDateString('es-PE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          )}

          {/* Activar (pendiente) */}
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
                    type="text" readOnly value="31/12/2025"
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

          {/* Activo → zona peligro */}
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

// ── Card Solicitud (terceros) ─────────────────────────────────────────────────
function CardSolicitud({ persona, onDetalle, onImprimir }) {
  const cfg        = ESTADO_CFG[persona.estado] || ESTADO_CFG.pendiente
  const est        = persona.estudiante || {}
  const esPendiente = persona.estado === 'pendiente'
  const esActivo    = persona.estado === 'activo'
  const esRevocado  = persona.estado === 'revocado'

  const diasDesde = persona.created_at
    ? Math.floor((Date.now() - new Date(persona.created_at)) / 86_400_000)
    : null

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${cfg.borderCard} shadow-sm overflow-hidden ${esRevocado ? 'opacity-70' : ''}`}>
      <div className="p-4 flex items-start gap-3">
        <Foto foto_url={persona.foto_url} nombre={persona.nombre} className="w-14 h-14" square />

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

          <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Alumno</span>
            <span className="text-xs font-semibold text-gray-700 truncate">
              {est.nombre} {est.apellido}
            </span>
            <span className="text-[10px] text-gray-400 capitalize flex-shrink-0">
              {est.nivel} · {est.grado}°{est.seccion}
            </span>
          </div>

          {esPendiente && diasDesde !== null && (
            <p className={`text-[10px] mt-1.5 font-medium ${diasDesde >= 2 ? 'text-amber-500' : 'text-gray-400'}`}>
              {diasDesde === 0 ? 'Solicitado hoy' : diasDesde === 1 ? 'Solicitado ayer' : `Solicitado hace ${diasDesde} días`}
              {diasDesde >= 2 && ' · Esperando atención'}
            </p>
          )}
          {esActivo && persona.vigencia_hasta && (
            <p className="text-[10px] text-green-600 font-medium mt-1.5">
              Vigente hasta{' '}
              {new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

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
            Ver detalle
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
export default function AdminRecojo() {
  const queryClient = useQueryClient()

  // Vista: 'panel' (por alumno) | 'solicitudes' (terceros)
  const [vista,  setVista]  = useState('panel')
  const [buscar, setBuscar] = useState('')

  // Modals
  const [panelDetalle,  setPanelDetalle]  = useState(null)  // { apoderado, estudiante }
  const [modalImprimir, setModalImprimir] = useState(null)
  const [detalle,       setDetalle]       = useState(null)
  const [confirmRev,    setConfirmRev]    = useState(null)
  const [loadRev,       setLoadRev]       = useState(false)

  // Tab solicitudes
  const [tabSol, setTabSol] = useState('pendiente')

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: stats = { pendiente: 0, activo: 0, revocado: 0 } } = useQuery({
    queryKey: ['admin-recojo-stats'],
    queryFn:  () => api.get('/recojo/admin/stats').then(r => r.data),
    refetchInterval: 30_000,
  })

  // Recojo seguro es exclusivo del nivel inicial
  const { data: panel = [], isLoading: panelLoading } = useQuery({
    queryKey: ['admin-recojo-panel'],
    queryFn:  () =>
      api.get('/recojo/admin/panel-apoderados', {
        params: { nivel: 'inicial' },
      }).then(r => r.data),
  })

  const { data: solicitudes = [], isLoading: solLoading } = useQuery({
    queryKey: ['admin-recojo', tabSol],
    queryFn:  () =>
      api.get('/recojo/admin/solicitudes', { params: { estado: tabSol } })
        .then(r => r.data),
    enabled: vista === 'solicitudes',
  })

  // ── Filtros locales ────────────────────────────────────────────────────────
  // Aplanar panel: 1 fila por cada par apoderado-alumno
  const filas = useMemo(() => {
    const rows = []
    panel.forEach(alumno =>
      alumno.apoderados.forEach(apo =>
        rows.push({ estudiante: alumno, apoderado: apo })
      )
    )
    return rows
  }, [panel])

  const filasFiltradas = useMemo(() => {
    if (!buscar) return filas
    const q = buscar.toLowerCase()
    return filas.filter(({ estudiante, apoderado }) =>
      estudiante.nombre?.toLowerCase().includes(q) ||
      estudiante.apellido?.toLowerCase().includes(q) ||
      apoderado.nombre?.toLowerCase().includes(q) ||
      apoderado.apellido?.toLowerCase().includes(q) ||
      apoderado.dni?.includes(q)
    )
  }, [filas, buscar])

  const solFiltradas = useMemo(() => {
    if (!buscar) return solicitudes
    const q = buscar.toLowerCase()
    return solicitudes.filter(p =>
      p.nombre?.toLowerCase().includes(q) ||
      p.apellido?.toLowerCase().includes(q) ||
      p.dni?.includes(q) ||
      p.estudiante?.nombre?.toLowerCase().includes(q) ||
      p.estudiante?.apellido?.toLowerCase().includes(q)
    )
  }, [solicitudes, buscar])

  // Stats del panel (calculados del lado cliente)
  const panelStats = useMemo(() => ({
    conQR: filas.filter(f => f.apoderado.fotocheck?.estado === 'activo').length,
    sinQR: filas.filter(f => f.apoderado.fotocheck?.estado !== 'activo').length,
  }), [filas])

  // ── Acciones ───────────────────────────────────────────────────────────────
  const activarDirecto = async (data) => {
    try {
      await api.post('/recojo/admin/activar-directo', data)
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-panel'] })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-stats'] })
      toast.success('Fotocheck generado correctamente')
      setPanelDetalle(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar fotocheck')
    }
  }

  const activar = async (id, precio, obs) => {
    try {
      await api.put(`/recojo/admin/${id}/activar`, { precio, observacion: obs })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo'] })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-stats'] })
      toast.success('Fotocheck activado correctamente')
      setDetalle(null)
      setTabSol('activo')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al activar')
    }
  }

  const revocar = async (persona) => {
    setLoadRev(true)
    try {
      await api.put(`/recojo/admin/${persona.id}/revocar`, { motivo: 'Revocado por admin' })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo'] })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-panel'] })
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
        {/* Con QR */}
        <div className="rounded-2xl border bg-green-50 border-green-200 p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-black leading-none text-green-600">
              {panelStats.conQR}
            </span>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-[11px] font-semibold text-green-700 leading-tight">Con QR</span>
        </div>

        {/* Sin QR */}
        <div className="rounded-2xl border bg-white border-gray-100 p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className={`text-3xl font-black leading-none ${panelStats.sinQR > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
              {panelStats.sinQR}
            </span>
            <QrCode className={`w-4 h-4 ${panelStats.sinQR > 0 ? 'text-gray-400' : 'text-gray-200'}`} />
          </div>
          <span className="text-[11px] font-semibold text-gray-500 leading-tight">Sin QR</span>
        </div>

        {/* Solicitudes de terceros — clickable */}
        <button
          onClick={() => { setVista('solicitudes'); setTabSol('pendiente') }}
          className={`rounded-2xl border p-3.5 flex flex-col gap-1 text-left transition-all ${
            stats.pendiente > 0
              ? 'bg-amber-50 border-amber-200 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-3xl font-black leading-none ${stats.pendiente > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
              {stats.pendiente}
            </span>
            <Clock className={`w-4 h-4 ${stats.pendiente > 0 ? 'text-amber-400' : 'text-gray-200'}`} />
          </div>
          <span className={`text-[11px] font-semibold leading-tight ${stats.pendiente > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            Solicitudes
          </span>
        </button>
      </div>

      {/* Banner de alerta — solicitudes pendientes */}
      {stats.pendiente > 0 && vista === 'panel' && (
        <button
          onClick={() => { setVista('solicitudes'); setTabSol('pendiente') }}
          className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left"
        >
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {stats.pendiente} solicitud{stats.pendiente !== 1 ? 'es' : ''} de terceros pendiente{stats.pendiente !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-600">
              Personas no registradas que esperan activación manual
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
        </button>
      )}

      {/* Vista tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        <button
          onClick={() => { setVista('panel'); setBuscar('') }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            vista === 'panel'
              ? 'bg-white shadow text-[#0a1f3d]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Por alumno
        </button>
        <button
          onClick={() => { setVista('solicitudes'); setBuscar('') }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            vista === 'solicitudes'
              ? 'bg-white shadow text-[#0a1f3d]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Solicitudes
          {(stats.pendiente + stats.activo + stats.revocado) > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              vista === 'solicitudes' ? 'bg-[#0a1f3d] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {stats.pendiente + stats.activo + stats.revocado}
            </span>
          )}
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar apoderado o alumno..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0a1f3d]/20"
        />
      </div>

      {/* ── Vista: Por alumno (lista plana) ── */}
      {vista === 'panel' && (
        panelLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-100 rounded animate-pulse w-40" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : filasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">
              {buscar ? 'Sin resultados para tu búsqueda' : 'No hay alumnos de inicial registrados'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {filasFiltradas.map(({ estudiante, apoderado }) => (
                <FilaRecojo
                  key={`${estudiante.id}-${apoderado.usuario_id}`}
                  apoderado={apoderado}
                  estudiante={estudiante}
                  onVerDetalle={(apo, est) => setPanelDetalle({ apoderado: apo, estudiante: est })}
                />
              ))}
            </div>
            <p className="text-center text-xs text-gray-400">
              {filasFiltradas.length}{' '}
              {filasFiltradas.length === 1 ? 'apoderado' : 'apoderados'}
            </p>
          </>
        )
      )}

      {/* ── Vista: Solicitudes (terceros) ── */}
      {vista === 'solicitudes' && (
        <div className="space-y-4">

          {/* Sub-tabs */}
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
            {TABS_SOL.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => { setTabSol(key); setBuscar('') }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  tabSol === key
                    ? 'bg-white shadow text-[#0a1f3d]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {stats[key] > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    tabSol === key ? 'bg-[#0a1f3d] text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {stats[key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {solLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : solFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ShieldCheck className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">
                {buscar
                  ? 'Sin resultados'
                  : `Sin solicitudes ${TABS_SOL.find(t => t.key === tabSol)?.label.toLowerCase()}`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {solFiltradas.map(p => (
                <CardSolicitud
                  key={p.id}
                  persona={p}
                  onDetalle={setDetalle}
                  onImprimir={p => setModalImprimir(p)}
                />
              ))}
              <p className="text-center text-xs text-gray-400 pt-1">
                {solFiltradas.length}{' '}
                {solFiltradas.length === 1 ? 'resultado' : 'resultados'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Panel detalle apoderado (panel view) */}
      {panelDetalle && (
        <PanelDetalleRecojo
          apoderado={panelDetalle.apoderado}
          estudiante={panelDetalle.estudiante}
          onClose={() => setPanelDetalle(null)}
          onActivar={activarDirecto}
          onImprimir={apo => {
            if (!apo.fotocheck) return
            setPanelDetalle(null)
            setModalImprimir({
              ...apo.fotocheck,
              nombre:   apo.nombre,
              apellido: apo.apellido,
              foto_url: apo.foto_url,
            })
          }}
          onRevocar={ft => {
            setPanelDetalle(null)
            setConfirmRev(ft)
          }}
        />
      )}

      {/* Detalle solicitud de tercero */}
      {detalle && (
        <ModalDetalle
          persona={detalle}
          onClose={() => setDetalle(null)}
          onActivar={activar}
          onRevocar={setConfirmRev}
        />
      )}

      {/* Imprimir fotochecks */}
      {modalImprimir && (
        <ModalImprimirFotochecks
          onClose={() => setModalImprimir(null)}
          personaInicial={modalImprimir !== 'seccion' ? modalImprimir : null}
        />
      )}

      {/* Confirmar revocar */}
      {confirmRev && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(10,31,61,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-base text-center mb-1">
              ¿Revocar fotocheck?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              El QR de{' '}
              <strong className="text-gray-800">
                {confirmRev.nombre} {confirmRev.apellido}
              </strong>{' '}
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
