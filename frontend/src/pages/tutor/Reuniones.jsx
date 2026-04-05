import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarCheck, Plus, X, Clock, MapPin, Video, Users,
  CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp,
  Pencil, Trash2, CalendarDays, User, Search,
} from 'lucide-react'
import { format, parseISO, isAfter, isBefore, isToday, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import toast from 'react-hot-toast'

// ── Configs de estado ──────────────────────────────────────────────────────────
const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  confirmada: { label: 'Confirmada', bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  realizada:  { label: 'Realizada',  bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  dot: 'bg-green-500'  },
  cancelada:  { label: 'Cancelada',  bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
}

const ESTADO_ACCIONES = {
  pendiente:  ['confirmada', 'cancelada'],
  confirmada: ['realizada',  'cancelada'],
  realizada:  [],
  cancelada:  [],
}

// ── Badge de estado ────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Sheet selección de alumnos ─────────────────────────────────────────────────
function SheetSeleccionAlumnos({ estudiantes, seleccionados, setSeleccionados, onClose }) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(
    () => estudiantes.filter(e =>
      `${e.apellido} ${e.nombre}`.toLowerCase().includes(busqueda.toLowerCase())
    ),
    [estudiantes, busqueda]
  )

  const toggleAlumno = (id) =>
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Handle */}
        <div className="flex-shrink-0 pt-3 flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-3 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-marino text-sm">Seleccionar alumnos</h3>
            <p className="text-[11px] text-gray-400">{estudiantes.length} en el aula</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Buscador */}
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            placeholder="Buscar por nombre o apellido…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')}>
              <X size={13} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Chips de seleccionados */}
        {seleccionados.length > 0 && (
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-marino/5">
            <p className="text-[10px] font-semibold text-marino uppercase tracking-wide mb-1.5">
              Seleccionados · {seleccionados.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {estudiantes
                .filter(e => seleccionados.includes(e.id))
                .map(e => (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-marino text-white text-[11px] font-medium"
                  >
                    {e.apellido}
                    <button
                      type="button"
                      onClick={() => toggleAlumno(e.id)}
                      className="ml-0.5 hover:bg-white/25 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-colors"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))
              }
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-gray-50/50 border-b border-gray-50">
          <span className="text-[11px] text-gray-400">
            {seleccionados.length > 0
              ? `${seleccionados.length} de ${estudiantes.length} seleccionados`
              : `${filtrados.length} alumnos`
            }
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSeleccionados(filtrados.map(e => e.id))}
              className="text-[11px] text-marino font-semibold hover:underline"
            >
              Sel. todos
            </button>
            {seleccionados.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={() => setSeleccionados([])}
                  className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
                >
                  Limpiar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Grid de alumnos */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Search size={24} className="mb-2 opacity-40" />
              <p className="text-sm">Sin resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {filtrados.map(e => {
                const checked = seleccionados.includes(e.id)
                const initials = `${e.apellido?.[0] || ''}${e.nombre?.[0] || ''}`.toUpperCase()
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleAlumno(e.id)}
                    className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl border-2 text-left transition-all ${
                      checked
                        ? 'border-marino bg-marino/10 text-marino'
                        : 'border-gray-100 hover:border-gray-200 text-gray-700 bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      checked ? 'bg-marino text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {checked
                        ? <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <span className="text-[10px] font-bold">{initials}</span>
                      }
                    </div>
                    <span className="text-xs leading-tight min-w-0 flex-1 overflow-hidden">
                      <span className="font-semibold block truncate">{e.apellido}</span>
                      <span className="text-gray-400 block truncate">{e.nombre}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer confirmar */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={seleccionados.length === 0}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={15} />
            {seleccionados.length === 0
              ? 'Selecciona al menos un alumno'
              : seleccionados.length === 1
                ? 'Confirmar · 1 alumno'
                : `Confirmar · ${seleccionados.length} alumnos`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal crear reunión ────────────────────────────────────────────────────────
function ModalCrear({ onClose, estudiantes }) {
  const qc = useQueryClient()
  const hoy = format(new Date(), 'yyyy-MM-dd')

  const [todos,         setTodos]         = useState(false)
  const [seleccionados, setSeleccionados] = useState([])
  const [sheetAlumnos,  setSheetAlumnos]  = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    fecha: hoy,
    hora: '08:00',
    modalidad: 'presencial',
    lugar: '',
  })

  const crear = useMutation({
    mutationFn: (body) => api.post('/tutor/reuniones', body).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK.tutorReuniones({}) })
      toast.success(
        data.creadas === 1
          ? 'Reunión agendada'
          : `${data.creadas} reuniones agendadas`
      )
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al agendar'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleTodos = () => {
    setTodos(t => !t)
    setSeleccionados([])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!todos && seleccionados.length === 0) return toast.error('Selecciona al menos un alumno')
    if (!form.titulo.trim()) return toast.error('El título es obligatorio')
    if (!form.fecha || !form.hora) return toast.error('Fecha y hora son obligatorias')
    crear.mutate({ ...form, estudiante_ids: seleccionados, todos })
  }

  const cantLabel = todos
    ? `Todos los alumnos (${estudiantes.length})`
    : seleccionados.length === 0
      ? 'Ningún alumno seleccionado'
      : seleccionados.length === 1
        ? '1 alumno seleccionado'
        : `${seleccionados.length} alumnos seleccionados`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
              <CalendarCheck size={18} className="text-purple-500" />
            </div>
            <div>
              <h2 className="font-bold text-marino text-base leading-tight">Nueva reunión</h2>
              <p className="text-[11px] text-gray-400">{cantLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ── Selección de alumnos ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Alumnos *
            </label>

            {/* Todos los apoderados */}
            <button
              type="button"
              onClick={toggleTodos}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all mb-2 ${
                todos
                  ? 'border-marino bg-marino/5 text-marino'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                todos ? 'border-marino bg-marino' : 'border-gray-300'
              }`}>
                {todos && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <Users size={15} className={todos ? 'text-marino' : 'text-gray-400'} />
              <span>Todos los apoderados del aula</span>
              {todos && (
                <span className="ml-auto text-xs bg-marino text-white rounded-full px-2 py-0.5">
                  {estudiantes.length}
                </span>
              )}
            </button>

            {/* Trigger selección individual → abre sheet */}
            {!todos && (
              <button
                type="button"
                onClick={() => setSheetAlumnos(true)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                  seleccionados.length > 0
                    ? 'border-marino/40 bg-marino/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  seleccionados.length > 0 ? 'bg-marino/10' : 'bg-gray-100'
                }`}>
                  <User size={15} className={seleccionados.length > 0 ? 'text-marino' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium block ${seleccionados.length > 0 ? 'text-marino' : 'text-gray-500'}`}>
                    {seleccionados.length === 0
                      ? 'Seleccionar alumnos individualmente'
                      : seleccionados.length === 1
                        ? '1 alumno seleccionado'
                        : `${seleccionados.length} alumnos seleccionados`
                    }
                  </span>
                  {seleccionados.length > 0 && (
                    <span className="text-xs text-gray-400 block truncate mt-0.5">
                      {estudiantes
                        .filter(e => seleccionados.includes(e.id))
                        .map(e => e.apellido)
                        .join(', ')
                      }
                    </span>
                  )}
                </div>
                <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
              </button>
            )}
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motivo / Título *</label>
            <input
              className="input"
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Ej: Seguimiento de asistencia, Rendimiento académico…"
              required
            />
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha *</label>
              <input
                type="date" className="input"
                value={form.fecha} min={hoy}
                onChange={e => set('fecha', e.target.value)} required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hora *</label>
              <input
                type="time" className="input"
                value={form.hora}
                onChange={e => set('hora', e.target.value)} required
              />
            </div>
          </div>

          {/* Modalidad */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Modalidad</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'presencial', label: 'Presencial', Icon: MapPin },
                { v: 'virtual',    label: 'Virtual',    Icon: Video  },
              ].map(({ v, label, Icon }) => (
                <button
                  key={v} type="button"
                  onClick={() => set('modalidad', v)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.modalidad === v
                      ? 'border-dorado bg-yellow-50 text-marino'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Lugar / Link */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {form.modalidad === 'presencial' ? 'Lugar / Sala' : 'Enlace de reunión'}
            </label>
            <input
              className="input"
              value={form.lugar}
              onChange={e => set('lugar', e.target.value)}
              placeholder={form.modalidad === 'presencial' ? 'Ej: Dirección, Aula 3B…' : 'Ej: meet.google.com/xxx…'}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción adicional</label>
            <textarea
              className="input resize-none" rows={3}
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Contexto, puntos a tratar, documentos a presentar…"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-1 pb-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={crear.isPending}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {crear.isPending
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CalendarCheck size={15} />
              }
              {crear.isPending
                ? 'Agendando…'
                : todos
                  ? `Agendar para todos (${estudiantes.length})`
                  : seleccionados.length > 1
                    ? `Agendar ${seleccionados.length} reuniones`
                    : 'Agendar reunión'
              }
            </button>
          </div>
        </form>
      </div>

      {/* Sheet de selección de alumnos (encima del modal) */}
      {sheetAlumnos && (
        <SheetSeleccionAlumnos
          estudiantes={estudiantes}
          seleccionados={seleccionados}
          setSeleccionados={setSeleccionados}
          onClose={() => setSheetAlumnos(false)}
        />
      )}
    </div>
  )
}

// ── Card de reunión ────────────────────────────────────────────────────────────
function ReunionCard({ reunion, onCambiarEstado, onEliminar }) {
  const [expandido, setExpandido] = useState(false)
  const [cambiando, setCambiando] = useState(false)

  const fecha = reunion.fecha ? parseISO(reunion.fecha) : null
  const esHoy = fecha && isToday(fecha)
  const esPasada = fecha && isBefore(startOfDay(fecha), startOfDay(new Date()))
  const cfg = ESTADO_CFG[reunion.estado] || ESTADO_CFG.pendiente
  const acciones = ESTADO_ACCIONES[reunion.estado] || []

  const handleAccion = async (nuevoEstado) => {
    setCambiando(true)
    await onCambiarEstado(reunion.id, nuevoEstado)
    setCambiando(false)
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${
      esHoy ? 'border-dorado/40 shadow-dorado/10' : 'border-gray-100'
    } ${reunion.estado === 'cancelada' ? 'opacity-60' : ''}`}>

      {/* Banda de color superior */}
      <div className={`h-1 rounded-t-2xl ${
        reunion.estado === 'pendiente'  ? 'bg-amber-400'  :
        reunion.estado === 'confirmada' ? 'bg-blue-500'   :
        reunion.estado === 'realizada'  ? 'bg-green-500'  : 'bg-gray-300'
      }`} />

      <div className="p-4">
        {/* Fila principal */}
        <div className="flex items-start gap-3">

          {/* Icono fecha */}
          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
            esHoy ? 'bg-dorado text-marino' : 'bg-gray-50 text-gray-600'
          }`}>
            <span className="text-[10px] font-semibold uppercase leading-none">
              {fecha ? format(fecha, 'MMM', { locale: es }) : '—'}
            </span>
            <span className="text-xl font-black leading-none tabular-nums">
              {fecha ? format(fecha, 'd') : '—'}
            </span>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-marino text-sm leading-tight truncate">{reunion.titulo}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <User size={11} className="text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500 truncate">{reunion.nombre_estudiante}</p>
                </div>
              </div>
              <EstadoBadge estado={reunion.estado} />
            </div>

            {/* Hora + Modalidad + Lugar */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={11} className="text-gray-400" />
                {reunion.hora?.slice(0, 5) || '—'}
                {esHoy && <span className="ml-1 font-bold text-dorado">· Hoy</span>}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                {reunion.modalidad === 'virtual'
                  ? <Video size={11} className="text-blue-400" />
                  : <MapPin size={11} className="text-gray-400" />
                }
                {reunion.modalidad === 'presencial' ? 'Presencial' : 'Virtual'}
              </span>
              {reunion.lugar && (
                <span className="text-xs text-gray-400 truncate max-w-[120px]" title={reunion.lugar}>
                  {reunion.lugar}
                </span>
              )}
            </div>
          </div>

          {/* Toggle detalles */}
          <button
            onClick={() => setExpandido(p => !p)}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0"
          >
            {expandido
              ? <ChevronUp size={15} className="text-gray-400" />
              : <ChevronDown size={15} className="text-gray-400" />
            }
          </button>
        </div>

        {/* Detalles expandidos */}
        {expandido && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            {reunion.descripcion && (
              <p className="text-sm text-gray-600 leading-relaxed">{reunion.descripcion}</p>
            )}

            {/* Acciones de estado */}
            {acciones.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {acciones.map(acc => {
                  const c = ESTADO_CFG[acc]
                  return (
                    <button
                      key={acc}
                      onClick={() => handleAccion(acc)}
                      disabled={cambiando}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${c.bg} ${c.border} ${c.text} hover:brightness-95`}
                    >
                      {cambiando
                        ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        : acc === 'confirmada' ? <CheckCircle2 size={12} />
                        : acc === 'realizada'  ? <CheckCircle2 size={12} />
                        : <XCircle size={12} />
                      }
                      Marcar como {c.label.toLowerCase()}
                    </button>
                  )
                })}
                <button
                  onClick={() => onEliminar(reunion.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            )}

            {/* Estado final */}
            {acciones.length === 0 && reunion.estado !== 'cancelada' && (
              <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                <CheckCircle2 size={14} /> Reunión finalizada
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Reuniones() {
  const qc = useQueryClient()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [verPasadas, setVerPasadas] = useState(false)

  const { data: reuniones = [], isLoading } = useQuery({
    queryKey: QK.tutorReuniones({}),
    queryFn: () => api.get('/tutor/reuniones').then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: estudiantes = [] } = useQuery({
    queryKey: QK.tutorEstudiantes(),
    queryFn: () => api.get('/tutor/mi-aula/estudiantes').then(r => r.data?.estudiantes || []),
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }) => api.patch(`/tutor/reuniones/${id}`, { estado }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.tutorReuniones({}) }),
    onError: () => toast.error('Error al actualizar'),
  })

  const eliminar = useMutation({
    mutationFn: (id) => api.delete(`/tutor/reuniones/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.tutorReuniones({}) })
      toast.success('Reunión eliminada')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const handleEliminar = (id) => {
    if (confirm('¿Eliminar esta reunión?')) eliminar.mutate(id)
  }

  const handleCambiarEstado = async (id, estado) => {
    await cambiarEstado.mutateAsync({ id, estado })
  }

  // Separar próximas vs pasadas
  const hoy = startOfDay(new Date())
  const proximas = reuniones.filter(r =>
    r.estado !== 'cancelada' && r.estado !== 'realizada' &&
    (r.fecha ? !isBefore(startOfDay(parseISO(r.fecha)), hoy) : true)
  )
  const pasadas = reuniones.filter(r =>
    r.estado === 'realizada' || r.estado === 'cancelada' ||
    (r.fecha && isBefore(startOfDay(parseISO(r.fecha)), hoy) && r.estado === 'pendiente')
  )

  // KPIs
  const kpis = useMemo(() => ({
    proximas:   proximas.length,
    hoy:        reuniones.filter(r => r.fecha && isToday(parseISO(r.fecha)) && r.estado !== 'cancelada').length,
    realizadas: reuniones.filter(r => r.estado === 'realizada').length,
    pendientes: reuniones.filter(r => r.estado === 'pendiente').length,
  }), [reuniones])

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-marino">Reuniones con Apoderados</h1>
          <p className="text-sm text-gray-400 mt-0.5">Agenda y seguimiento de citas con familias</p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-2 bg-marino text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-marino/90 active:scale-95 transition-all shadow-sm flex-shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nueva reunión</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Próximas',   val: kpis.proximas,   icon: CalendarDays,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Hoy',        val: kpis.hoy,         icon: Clock,         color: 'text-dorado',     bg: 'bg-yellow-50' },
          { label: 'Pendientes', val: kpis.pendientes,  icon: AlertCircle,   color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: 'Realizadas', val: kpis.realizadas,  icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50'  },
        ].map(({ label, val, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-3 py-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className={`text-2xl font-black tabular-nums leading-none ${color}`}>{val}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Próximas reuniones ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse h-24 bg-gray-50" />
          ))}
        </div>
      ) : proximas.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
            <CalendarCheck size={26} className="text-purple-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-600">Sin reuniones programadas</p>
            <p className="text-sm text-gray-400 mt-1">Agenda una reunión con el apoderado de un alumno</p>
          </div>
          <button
            onClick={() => setModalAbierto(true)}
            className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-dorado hover:underline"
          >
            <Plus size={14} /> Agendar primera reunión
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Próximas · {proximas.length}
          </p>
          {proximas.map(r => (
            <ReunionCard
              key={r.id}
              reunion={r}
              onCambiarEstado={handleCambiarEstado}
              onEliminar={handleEliminar}
            />
          ))}
        </div>
      )}

      {/* ── Pasadas / Realizadas ───────────────────────────────────────────── */}
      {pasadas.length > 0 && (
        <div>
          <button
            onClick={() => setVerPasadas(p => !p)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
          >
            {verPasadas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Historial · {pasadas.length}
          </button>

          {verPasadas && (
            <div className="mt-3 space-y-3">
              {pasadas.map(r => (
                <ReunionCard
                  key={r.id}
                  reunion={r}
                  onCambiarEstado={handleCambiarEstado}
                  onEliminar={handleEliminar}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {modalAbierto && (
        <ModalCrear
          onClose={() => setModalAbierto(false)}
          estudiantes={estudiantes}
        />
      )}
    </div>
  )
}
