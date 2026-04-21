import { useState, useMemo } from 'react'
import { formatGradoSeccion } from '../../lib/nivelAcademico'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Search, CheckCircle2, Clock, UserX,
  Printer, X, ChevronDown, AlertCircle, Eye,
  ShieldX, CalendarCheck, QrCode,
  UserCheck, Users, ChevronRight, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ModalImprimirFotochecks from './ModalImprimirFotochecks'
import { imprimirFotocheckApoderadoInicial } from '../../utils/imprimirFotocheckApoderadoInicial'

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

const ESTADO_ORDER = { pendiente: 0, activo: 1, revocado: 2 }

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
// ── Panel detalle QR de Apoderado (nivel inicial) ────────────────────────────
function PanelDetalleRecojo({ apoderado, estudiante, onClose, onQrGenerado, inline = false }) {
  const tieneQR = !!apoderado.qr_token_inicial
  const [loading, setLoading] = useState(false)

  const generarQR = async () => {
    setLoading(true)
    try {
      await api.post(`/inicial/admin/generar-qr/${apoderado.usuario_id}`)
      toast.success('QR de apoderado generado')
      onQrGenerado?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar QR')
    } finally {
      setLoading(false)
    }
  }

  const imprimirFotocheck = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/inicial/admin/${apoderado.usuario_id}/qr-solo`)
      await imprimirFotocheckApoderadoInicial([{
        nombre:     apoderado.nombre,
        apellido:   apoderado.apellido,
        parentesco: apoderado.parentesco || 'Apoderado',
        estudiante,
        qrBase64:   data.imagen_base64,
      }])
    } catch {
      toast.error('Error al preparar el fotocheck')
    } finally {
      setLoading(false)
    }
  }

  const tokenShort = apoderado.qr_token_inicial
    ? apoderado.qr_token_inicial.slice(0, 16) + '…'
    : null

  const contenido = (
    <>
      {/* Foto + identidad */}
      <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center border-b border-gray-100">
        <Foto foto_url={apoderado.foto_url} nombre={apoderado.nombre} className="w-20 h-20" square />
        <h2 className="font-black text-[#0a1f3d] text-lg mt-3 leading-tight">
          {apoderado.nombre} {apoderado.apellido}
        </h2>
        <p className="text-gray-400 text-xs font-mono mt-1">DNI {apoderado.dni}</p>
        {apoderado.telefono && <p className="text-gray-500 text-xs mt-0.5">{apoderado.telefono}</p>}
        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
            tieneQR ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tieneQR ? 'bg-green-500' : 'bg-gray-300'}`} />
            {tieneQR ? 'QR activo' : 'Sin QR'}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Nivel Inicial
          </span>
        </div>
      </div>

      {/* Alumno vinculado */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Alumno vinculado</p>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
          <Foto foto_url={estudiante.foto_url} nombre={estudiante.nombre} className="w-10 h-10" square />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{estudiante.nombre} {estudiante.apellido}</p>
            <p className="text-xs text-gray-500 capitalize">{formatGradoSeccion(estudiante.nivel, estudiante.grado, estudiante.seccion)}</p>
          </div>
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        </div>
      </div>

      {/* Estado del QR */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">QR de apoderado</p>

        {tieneQR ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 overflow-hidden">
            {/* Header estado */}
            <div className="flex items-center justify-between px-4 py-3 bg-green-100/60 border-b border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-bold text-green-800">QR activo</span>
              </div>
              <span className="text-[10px] font-mono text-green-600 bg-white px-2 py-0.5 rounded-full border border-green-200">
                {tokenShort}
              </span>
            </div>
            {/* Capacidades */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-700">
                <CalendarCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Registro de <strong>asistencia</strong> al ingresar</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-700">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Autorización de <strong>recojo</strong> a la salida</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-600 mt-1 pt-2 border-t border-green-200">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Si tiene 2+ hijos en inicial, verá un selector de alumno</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-5 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Sin QR generado</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Al generar el QR, el apoderado podrá escanear en la puerta para
                registrar asistencia y autorizar el recojo de su hijo/a.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
              <span className="flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Asistencia</span>
              <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Recojo</span>
            </div>
          </div>
        )}
      </div>

      {/* Acción principal */}
      <div className="px-5 py-4 space-y-2.5">
        {tieneQR ? (
          <>
            <button onClick={imprimirFotocheck} disabled={loading}
              className="w-full py-3 bg-[#0a1f3d] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#0a1f3d]/90 transition-colors disabled:opacity-60">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Preparando...</>
                : <><Printer className="w-4 h-4" /> Imprimir Fotocheck</>
              }
            </button>
            {/* Zona de peligro */}
            <div className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-3 space-y-2">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Zona de peligro</p>
              <p className="text-xs text-red-500 leading-relaxed">
                Regenerar invalida el QR anterior. El apoderado deberá volver a descargar el nuevo código.
              </p>
              <button onClick={generarQR} disabled={loading}
                className="w-full py-2 border border-red-200 text-red-600 bg-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50">
                {loading
                  ? <><span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> Regenerando...</>
                  : <><RefreshCw className="w-3 h-3" /> Regenerar QR</>}
              </button>
            </div>
          </>
        ) : (
          <button onClick={generarQR} disabled={loading}
            className="w-full py-3 bg-green-600 text-white rounded-2xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-green-700 transition-colors">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando QR...</>
              : <><QrCode className="w-4 h-4" /> Generar QR de apoderado</>}
          </button>
        )}
      </div>
    </>
  )

  if (inline) return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden relative">
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
        <X className="w-4 h-4 text-gray-500" />
      </button>
      {contenido}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,31,61,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-[#0a1f3d] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Foto foto_url={apoderado.foto_url} nombre={apoderado.nombre} className="w-10 h-10" square />
            <div>
              <p className="text-white font-bold leading-tight">{apoderado.nombre} {apoderado.apellido}</p>
              <p className="text-white/50 text-xs mt-0.5 font-mono">DNI {apoderado.dni}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {contenido}
        </div>
      </div>
    </div>
  )
}

// ── Fila compacta: 1 apoderado + alumno ──────────────────────────────────────
function FilaRecojo({ apoderado, estudiante, onVerDetalle }) {
  const tieneQR = !!apoderado.qr_token_inicial

  return (
    <button
      onClick={() => onVerDetalle(apoderado, estudiante)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors text-left"
    >
      <Foto foto_url={apoderado.foto_url} nombre={apoderado.nombre} className="w-10 h-10 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
          {apoderado.nombre} {apoderado.apellido}
        </p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          Apoderado · <span className="text-gray-500 font-medium">{estudiante.apellido}, {estudiante.nombre}</span>
          {' · '}{formatGradoSeccion(estudiante.nivel, estudiante.grado, estudiante.seccion)}
        </p>
      </div>

      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
        tieneQR
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-500 border-gray-200'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${tieneQR ? 'bg-green-500' : 'bg-gray-300'}`} />
        {tieneQR ? 'QR activo' : 'Sin QR'}
      </span>
    </button>
  )
}

// ── Modal Detalle (solicitudes de terceros) ───────────────────────────────────
function ModalDetalle({ persona, onClose, onActivar, onRevocar, inline = false }) {
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

  const card = (
      <div className={inline
        ? 'bg-white rounded-3xl border border-gray-200 shadow-xl w-full flex flex-col overflow-hidden'
        : 'bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden'
      }>

        <div className="bg-[#0a1f3d] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-white/70" />
            <p className="text-white font-bold">Detalle de solicitud</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className={`overflow-y-auto flex-1 px-5 py-5 space-y-4 ${inline ? 'max-h-[calc(100vh-220px)]' : ''}`}>

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
                <p className="text-xs text-gray-500 capitalize">{est.nivel} · {formatGradoSeccion(est.nivel, est.grado, est.seccion)}</p>
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
  )

  if (inline) return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden relative">
      {/* Botón cerrar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>

      {/* Foto + identidad */}
      <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center border-b border-gray-100">
        <Foto foto_url={persona.foto_url} nombre={persona.nombre} className="w-24 h-24" square />
        <h2 className="font-black text-[#0a1f3d] text-xl mt-4 leading-tight">
          {persona.nombre} {persona.apellido}
        </h2>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">{persona.parentesco}</p>
        <p className="text-gray-400 text-xs font-mono mt-0.5">DNI {persona.dni}</p>
        <span className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* Alumno + solicitante */}
      <div className="px-6 py-4 border-b border-gray-100 space-y-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Alumno</p>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <Foto foto_url={est.foto_url} nombre={est.nombre} className="w-10 h-10" square />
            <div>
              <p className="font-semibold text-gray-900 text-sm">{est.nombre} {est.apellido}</p>
              <p className="text-xs text-gray-500 capitalize">{est.nivel} · {formatGradoSeccion(est.nivel, est.grado, est.seccion)}</p>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Solicitado por</p>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="font-medium text-gray-900 text-sm">{apo.nombre} {apo.apellido}</p>
            {apo.telefono && <p className="text-xs text-gray-500 mt-0.5">{apo.telefono}</p>}
          </div>
        </div>
        {persona.created_at && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5" />
            Solicitado el{' '}
            {new Date(persona.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="px-6 py-4 space-y-3 overflow-y-auto max-h-[calc(100vh-520px)]">
        {persona.estado === 'pendiente' && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-800">Activar fotocheck</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Precio cobrado (S/.)</label>
                <input type="number" step="0.50" min="0" value={precio} onChange={e => setPrecio(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Vigencia hasta</label>
                <input type="text" readOnly value="31/12/2025"
                  className="mt-1 w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Observación (opcional)</label>
              <textarea value={obsAdmin} onChange={e => setObsAdmin(e.target.value)} rows={2}
                placeholder="Notas internas..." className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 resize-none" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Verifica el DNI original de <strong>{persona.nombre}</strong> antes de activar.</p>
            </div>
            <button onClick={activar} disabled={loading}
              className="w-full py-3 bg-green-600 text-white rounded-2xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Activando...</>
                : <><CheckCircle2 className="w-4 h-4" /> Confirmar pago y activar</>}
            </button>
          </div>
        )}
        {persona.estado === 'activo' && (
          <div className="space-y-3">
            {persona.vigencia_hasta && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-xs text-green-700 font-medium">
                  Vigente hasta{' '}
                  {new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
            {persona.precio_fotocheck && <p className="text-xs text-gray-400">Pago registrado: S/. {persona.precio_fotocheck}</p>}
            <div className="border border-red-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-500 uppercase tracking-wide">Zona de riesgo</p>
              <p className="text-xs text-gray-500">Revocar desactivará el QR inmediatamente.</p>
              <button onClick={() => onRevocar(persona)}
                className="w-full py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors">
                <ShieldX className="w-4 h-4" /> Revocar este fotocheck
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,31,61,0.75)', backdropFilter: 'blur(6px)' }}
    >
      {card}
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
              {est.nivel} · {formatGradoSeccion(est.nivel, est.grado, est.seccion)}
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

  // Chip filter solicitudes
  const [tabSol, setTabSol] = useState('todos')

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
    queryKey: ['admin-recojo-solicitudes'],
    queryFn:  () =>
      api.get('/recojo/admin/solicitudes')
        .then(r => r.data.slice().sort((a, b) => {
          const diff = (ESTADO_ORDER[a.estado] ?? 9) - (ESTADO_ORDER[b.estado] ?? 9)
          if (diff !== 0) return diff
          if (a.estado === 'pendiente') return new Date(a.created_at) - new Date(b.created_at)
          return 0
        })),
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
    let list = tabSol === 'todos' ? solicitudes : solicitudes.filter(p => p.estado === tabSol)
    if (!buscar) return list
    const q = buscar.toLowerCase()
    return list.filter(p =>
      p.nombre?.toLowerCase().includes(q) ||
      p.apellido?.toLowerCase().includes(q) ||
      p.dni?.includes(q) ||
      p.estudiante?.nombre?.toLowerCase().includes(q) ||
      p.estudiante?.apellido?.toLowerCase().includes(q)
    )
  }, [solicitudes, buscar, tabSol])

  // Stats del panel (calculados del lado cliente)
  const panelStats = useMemo(() => ({
    conQR: filas.filter(f => !!f.apoderado.qr_token_inicial).length,
    sinQR: filas.filter(f => !f.apoderado.qr_token_inicial).length,
  }), [filas])

  // ── Acciones ───────────────────────────────────────────────────────────────
  const activar = async (id, precio, obs) => {
    try {
      await api.put(`/recojo/admin/${id}/activar`, { precio, observacion: obs })
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-solicitudes'] })
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
      queryClient.invalidateQueries({ queryKey: ['admin-recojo-solicitudes'] })
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
    <div className="px-4 pt-5 pb-24">

      {/* Header — ancho completo */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0a1f3d] flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recojo Responsable</h1>
            <p className="text-xs text-gray-500">QR apoderado (inicial) · Fotochecks de terceros</p>
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

      {/* Grid master-detail */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start space-y-5 lg:space-y-0">

      {/* ── Columna izquierda ── */}
      <div className="space-y-5">

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
          <span className="text-[11px] font-semibold text-green-700 leading-tight">QR propio</span>
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
          onClick={() => { setVista('solicitudes'); setTabSol('todos') }}
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
          onClick={() => { setVista('solicitudes'); setTabSol('todos') }}
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
          <QrCode className="w-3.5 h-3.5" />
          QR Apoderado
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
          {stats.pendiente > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              vista === 'solicitudes' ? 'bg-[#0a1f3d] text-white' : 'bg-amber-500 text-white'
            }`}>
              {stats.pendiente}
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

          {/* Filter chips */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'todos',     label: 'Todos' },
              { key: 'pendiente', label: 'Pendientes' },
              { key: 'activo',    label: 'Activos'    },
              { key: 'revocado',  label: 'Revocados'  },
            ].map(({ key, label }) => {
              const active = tabSol === key
              const count  = key === 'todos'
                ? solicitudes.length
                : solicitudes.filter(p => p.estado === key).length
              return (
                <button
                  key={key}
                  onClick={() => setTabSol(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? key === 'pendiente'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : key === 'activo'
                        ? 'bg-green-600 text-white border-green-600'
                        : key === 'revocado'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-[#0a1f3d] text-white border-[#0a1f3d]'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      active ? 'bg-white/25 text-white' : key === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
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
                  ? 'Sin resultados para tu búsqueda'
                  : tabSol === 'todos'
                  ? 'Sin solicitudes registradas'
                  : `Sin solicitudes ${tabSol === 'pendiente' ? 'pendientes' : tabSol === 'activo' ? 'activas' : 'revocadas'}`
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

      </div> {/* fin columna izquierda */}

      {/* ── Columna derecha (solo desktop) ── */}
      <div className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-100px)] overflow-y-auto rounded-3xl bg-[#0a1f3d]/5 p-1.5">
          {panelDetalle ? (
            <PanelDetalleRecojo
              apoderado={panelDetalle.apoderado}
              estudiante={panelDetalle.estudiante}
              onClose={() => setPanelDetalle(null)}
              onQrGenerado={() => {
                queryClient.invalidateQueries({ queryKey: ['admin-recojo-panel'] })
                setPanelDetalle(null)
              }}
              inline
            />
          ) : detalle ? (
            <ModalDetalle
              persona={detalle}
              onClose={() => setDetalle(null)}
              onActivar={activar}
              onRevocar={setConfirmRev}
              inline
            />
          ) : (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
              {/* Franja navy decorativa */}
              <div className="bg-[#0a1f3d] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-white/60" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Panel de detalle</p>
                    <p className="text-white/40 text-xs">Recojo Responsable</p>
                  </div>
                </div>
              </div>
              {/* Cuerpo vacío */}
              <div className="px-6 py-12 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <Users className="w-7 h-7 text-gray-300" />
                </div>
                <div>
                  <p className="font-semibold text-gray-500 text-sm">Ningún registro seleccionado</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                    Haz clic en un apoderado de la lista para ver su detalle aquí
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      </div> {/* fin grid */}

      {/* ── Modals móvil (ocultos en desktop, ya que el panel derecho los reemplaza) ── */}

      {/* Panel detalle apoderado (mobile) */}
      <div className="lg:hidden">
        {panelDetalle && (
          <PanelDetalleRecojo
            apoderado={panelDetalle.apoderado}
            estudiante={panelDetalle.estudiante}
            onClose={() => setPanelDetalle(null)}
            onQrGenerado={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-recojo-panel'] })
              setPanelDetalle(null)
            }}
          />
        )}
      </div>

      {/* Detalle solicitud de tercero (mobile) */}
      <div className="lg:hidden">
        {detalle && (
          <ModalDetalle
            persona={detalle}
            onClose={() => setDetalle(null)}
            onActivar={activar}
            onRevocar={setConfirmRev}
          />
        )}
      </div>

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
