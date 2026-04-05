import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, CalendarClock, AlertTriangle, X } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format, parseISO, isToday, isPast } from 'date-fns'
import { es } from 'date-fns/locale'

const NIVELES = ['inicial', 'primaria', 'secundaria']
const NIVEL_LABEL = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' }

const NIVEL_OPCIONES = [
  { v: 'inicial',    label: 'Solo Inicial'    },
  { v: 'primaria',   label: 'Solo Primaria'   },
  { v: 'secundaria', label: 'Solo Secundaria' },
  { v: 'todos',      label: 'Todos los niveles' },
]

// Convierte "HH:MM:SS" → "HH:MM" para input[type=time]
const toHHMM = (v) => (v ? v.substring(0, 5) : '')
// Convierte "HH:MM" → "HH:MM:SS"
const toHHMMSS = (v) => (v ? `${v}:00` : null)

// ─── Sección horario base ──────────────────────────────────────────────────────
function HorarioBase() {
  const [nivelActivo, setNivelActivo] = useState('primaria')
  const [horarios, setHorarios]       = useState([])
  const [form, setForm]               = useState(null)
  const [guardando, setGuardando]     = useState(false)
  const [cargando, setCargando]       = useState(true)

  useEffect(() => {
    setCargando(true)
    api.get('/admin/horarios')
      .then(r => {
        setHorarios(r.data)
        const h = r.data.find(d => d.nivel === nivelActivo)
        if (h) setForm({
          hora_ingreso_inicio: toHHMM(h.hora_ingreso_inicio),
          hora_ingreso_fin:    toHHMM(h.hora_ingreso_fin),
          hora_salida_inicio:  toHHMM(h.hora_salida_inicio),
          hora_salida_fin:     toHHMM(h.hora_salida_fin),
          hora_cierre_faltas:  toHHMM(h.hora_cierre_faltas),
        })
      })
      .catch(() => toast.error('Error al cargar horarios'))
      .finally(() => setCargando(false))
  }, [nivelActivo])

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await api.put(`/admin/horarios/${nivelActivo}`, {
        hora_ingreso_inicio: toHHMMSS(form.hora_ingreso_inicio),
        hora_ingreso_fin:    toHHMMSS(form.hora_ingreso_fin),
        hora_salida_inicio:  toHHMMSS(form.hora_salida_inicio),
        hora_salida_fin:     toHHMMSS(form.hora_salida_fin),
        hora_cierre_faltas:  toHHMMSS(form.hora_cierre_faltas),
      })
      toast.success(`Horario de ${NIVEL_LABEL[nivelActivo]} actualizado`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {NIVELES.map(n => (
          <button
            key={n}
            onClick={() => setNivelActivo(n)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              nivelActivo === n ? 'bg-marino text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {NIVEL_LABEL[n]}
          </button>
        ))}
      </div>

      {cargando || !form ? (
        <div className="card text-center text-gray-400 py-8">Cargando...</div>
      ) : (
        <form onSubmit={guardar} className="card space-y-5">
          <h3 className="font-semibold text-marino">Horario base — {NIVEL_LABEL[nivelActivo]}</h3>

          {/* Ingreso */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ingreso</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Apertura de puertas</label>
                <input type="time" className="input" value={form.hora_ingreso_inicio}
                  onChange={e => setForm({ ...form, hora_ingreso_inicio: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Límite puntual <span className="text-amber-500">(tardanza después de aquí)</span>
                </label>
                <input type="time" className="input" value={form.hora_ingreso_fin}
                  onChange={e => setForm({ ...form, hora_ingreso_fin: e.target.value })} required />
              </div>
            </div>
          </div>

          {/* Salida */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Salida</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Inicio salida regular <span className="text-amber-500">(anticipada antes de aquí)</span>
                </label>
                <input type="time" className="input" value={form.hora_salida_inicio}
                  onChange={e => setForm({ ...form, hora_salida_inicio: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cierre de puertas</label>
                <input type="time" className="input" value={form.hora_salida_fin}
                  onChange={e => setForm({ ...form, hora_salida_fin: e.target.value })} required />
              </div>
            </div>
          </div>

          {/* Cierre de faltas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cierre de registro de faltas
              <span className="ml-1 text-gray-400 font-normal">(hora en que se marcan ausencias automáticas)</span>
            </label>
            <input type="time" className="input max-w-xs" value={form.hora_cierre_faltas}
              onChange={e => setForm({ ...form, hora_cierre_faltas: e.target.value })} required />
          </div>

          <button type="submit" disabled={guardando} className="btn-primary flex items-center gap-2">
            {guardando
              ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              : <Save size={15} />}
            {guardando ? 'Guardando...' : 'Guardar horario base'}
          </button>
        </form>
      )}

      {/* Resumen de los 3 niveles */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Nivel', 'Apertura', 'Límite puntual', 'Inicio salida', 'Cierre faltas'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horarios.map(h => (
              <tr key={h.nivel} className={`border-b border-gray-50 ${h.nivel === nivelActivo ? 'bg-yellow-50' : ''}`}>
                <td className="px-4 py-3 font-semibold text-marino capitalize">{h.nivel}</td>
                <td className="px-4 py-3 text-gray-600 tabular-nums">{toHHMM(h.hora_ingreso_inicio)}</td>
                <td className="px-4 py-3 text-amber-600 font-semibold tabular-nums">{toHHMM(h.hora_ingreso_fin)}</td>
                <td className="px-4 py-3 text-blue-600 font-semibold tabular-nums">{toHHMM(h.hora_salida_inicio)}</td>
                <td className="px-4 py-3 text-gray-600 tabular-nums">{toHHMM(h.hora_cierre_faltas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Formulario nueva excepción ────────────────────────────────────────────────
function FormExcepcion({ onCreada }) {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({
    nivel: 'todos',
    fecha: hoy,
    hora_ingreso_fin:   '',
    hora_salida_inicio: '',
    hora_cierre_faltas: '',
    motivo: '',
  })
  const [guardando, setGuardando] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.hora_ingreso_fin && !form.hora_salida_inicio && !form.hora_cierre_faltas) {
      toast.error('Modifica al menos un horario (ingreso, salida o cierre)')
      return
    }
    setGuardando(true)
    try {
      await api.post('/admin/horarios/excepciones', {
        nivel:              form.nivel,
        fecha:              form.fecha,
        hora_ingreso_fin:   form.hora_ingreso_fin   ? toHHMMSS(form.hora_ingreso_fin)   : null,
        hora_salida_inicio: form.hora_salida_inicio ? toHHMMSS(form.hora_salida_inicio) : null,
        hora_cierre_faltas: form.hora_cierre_faltas ? toHHMMSS(form.hora_cierre_faltas) : null,
        motivo: form.motivo,
      })
      toast.success('Excepción creada')
      setForm({ nivel: 'todos', fecha: hoy, hora_ingreso_fin: '', hora_salida_inicio: '', hora_cierre_faltas: '', motivo: '' })
      onCreada()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear excepción')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 border-2 border-dashed border-violet-200 bg-violet-50/30">
      <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Nueva excepción</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input type="date" className="input" value={form.fecha} min={hoy}
            onChange={e => set('fecha', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Aplica a</label>
          <select className="input" value={form.nivel} onChange={e => set('nivel', e.target.value)}>
            {NIVEL_OPCIONES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Motivo del evento <span className="text-red-500">*</span>
        </label>
        <input className="input" value={form.motivo} onChange={e => set('motivo', e.target.value)}
          placeholder="Ej: Día del maestro, Simulacro, Actividad deportiva..." required />
      </div>

      <p className="text-xs text-gray-500 font-medium">Campos a modificar — deja vacío lo que no cambia:</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nuevo límite puntual</label>
          <input type="time" className="input" value={form.hora_ingreso_fin}
            onChange={e => set('hora_ingreso_fin', e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-0.5">Tardanza después de esta hora</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nuevo inicio de salida</label>
          <input type="time" className="input" value={form.hora_salida_inicio}
            onChange={e => set('hora_salida_inicio', e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-0.5">Salida anticipada antes de aquí</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nuevo cierre de faltas</label>
          <input type="time" className="input" value={form.hora_cierre_faltas}
            onChange={e => set('hora_cierre_faltas', e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-0.5">Hora de registro automático</p>
        </div>
      </div>

      <button type="submit" disabled={guardando} className="btn-primary flex items-center gap-2 text-sm">
        {guardando
          ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          : <Plus size={15} />}
        {guardando ? 'Guardando...' : 'Crear excepción'}
      </button>
    </form>
  )
}

// ─── Lista de excepciones ──────────────────────────────────────────────────────
function ListaExcepciones({ excepciones, onEliminada }) {
  const [eliminando, setEliminando] = useState(null)

  const eliminar = async (id) => {
    setEliminando(id)
    try {
      await api.delete(`/admin/horarios/excepciones/${id}`)
      toast.success('Excepción eliminada')
      onEliminada()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setEliminando(null)
    }
  }

  if (excepciones.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No hay excepciones programadas
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {excepciones.map(exc => {
        const esHoyFlag = isToday(parseISO(exc.fecha))
        const pasado    = isPast(parseISO(exc.fecha)) && !esHoyFlag
        return (
          <div
            key={exc.id}
            className={`flex items-start gap-3 rounded-xl p-3.5 border transition-all ${
              esHoyFlag ? 'bg-amber-50 border-amber-200' : pasado ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100'
            }`}
          >
            {/* Fecha */}
            <div className="flex-shrink-0 text-center w-12">
              <p className="text-xs font-bold text-gray-400 uppercase">
                {format(parseISO(exc.fecha), 'MMM', { locale: es })}
              </p>
              <p className="text-2xl font-black text-marino leading-none">
                {format(parseISO(exc.fecha), 'd')}
              </p>
              {esHoyFlag && <span className="text-[10px] font-bold text-amber-600 uppercase">Hoy</span>}
            </div>

            {/* Detalle */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  exc.nivel === 'todos' ? 'bg-marino text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {exc.nivel === 'todos' ? 'Todos los niveles' : NIVEL_LABEL[exc.nivel]}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-1">{exc.motivo}</p>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {exc.hora_ingreso_fin && (
                  <span className="text-xs text-amber-600 font-medium">
                    Límite ingreso: {toHHMM(exc.hora_ingreso_fin)}
                  </span>
                )}
                {exc.hora_salida_inicio && (
                  <span className="text-xs text-blue-600 font-medium">
                    Inicio salida: {toHHMM(exc.hora_salida_inicio)}
                  </span>
                )}
                {exc.hora_cierre_faltas && (
                  <span className="text-xs text-gray-500 font-medium">
                    Cierre faltas: {toHHMM(exc.hora_cierre_faltas)}
                  </span>
                )}
              </div>
            </div>

            {/* Eliminar */}
            {!pasado && (
              <button
                onClick={() => eliminar(exc.id)}
                disabled={eliminando === exc.id}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar excepción"
              >
                {eliminando === exc.id
                  ? <span className="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full" />
                  : <Trash2 size={15} />}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function Horarios() {
  const [excepciones, setExcepciones]   = useState([])
  const [cargandoExc, setCargandoExc]   = useState(true)
  const [mostrarForm, setMostrarForm]   = useState(false)

  const cargarExcepciones = () => {
    setCargandoExc(true)
    api.get('/admin/horarios/excepciones')
      .then(r => setExcepciones(r.data || []))
      .catch(() => toast.error('Error al cargar excepciones'))
      .finally(() => setCargandoExc(false))
  }

  useEffect(() => { cargarExcepciones() }, [])

  const excHoy = excepciones.filter(e => isToday(parseISO(e.fecha)))

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-bold text-marino">Horarios</h1>

      {/* Alerta si hay excepción activa hoy */}
      {excHoy.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Horario modificado hoy</p>
            {excHoy.map(e => (
              <p key={e.id} className="text-xs text-amber-700 mt-0.5">
                <span className="font-semibold capitalize">{e.nivel === 'todos' ? 'Todos los niveles' : e.nivel}</span>
                {' '}— {e.motivo}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Horario base ── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-gray-700">Horario base</h2>
        <HorarioBase />
      </section>

      {/* ── Excepciones ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-700">Excepciones por evento</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Modifica el horario para fechas específicas sin alterar el horario base.
            </p>
          </div>
          <button
            onClick={() => setMostrarForm(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mostrarForm ? 'bg-gray-100 text-gray-600' : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {mostrarForm ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Nueva excepción</>}
          </button>
        </div>

        {mostrarForm && (
          <FormExcepcion onCreada={() => { cargarExcepciones(); setMostrarForm(false) }} />
        )}

        <div className="card space-y-1 p-3">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={15} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Próximas excepciones ({excepciones.length})
            </p>
          </div>
          {cargandoExc ? (
            <div className="text-center py-6 text-gray-400 text-sm">Cargando...</div>
          ) : (
            <ListaExcepciones excepciones={excepciones} onEliminada={cargarExcepciones} />
          )}
        </div>
      </section>
    </div>
  )
}
