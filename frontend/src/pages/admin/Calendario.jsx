import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, X,
  CalendarDays, Bell, BellOff, List,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, isWeekend, parseISO, addMonths, subMonths,
  eachDayOfInterval as eachDay,
} from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Tipos ───────────────────────────────────────────────────────────────────
const TIPOS = [
  { v: 'feriado',  label: 'Feriado',  color: 'bg-red-500',   light: 'bg-red-100 text-red-700',    dot: 'bg-red-500'   },
  { v: 'vacacion', label: 'Vacación', color: 'bg-amber-400', light: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  { v: 'evento',   label: 'Evento',   color: 'bg-blue-500',  light: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'  },
]
const tipoCfg = (v) => TIPOS.find((t) => t.v === v) || TIPOS[2]

import { GRADOS_POR_NIVEL, getSecciones, formatGrado } from '../../lib/nivelAcademico'

const NIVEL_BADGE = {
  todos:      { label: 'Todos los niveles', cls: 'bg-gray-100 text-gray-600' },
  inicial:    { label: 'Inicial',           cls: 'bg-green-100 text-green-700' },
  primaria:   { label: 'Primaria',          cls: 'bg-blue-100 text-blue-700' },
  secundaria: { label: 'Secundaria',        cls: 'bg-purple-100 text-purple-700' },
}

function audienciaLabel(nivel, grado, seccion) {
  const base = NIVEL_BADGE[nivel]?.label || nivel
  if (!grado) return base
  return `${base} · ${grado}°${seccion ? ` "${seccion}"` : ''}`
}

// ─── Días escolares del año ───────────────────────────────────────────────────
function calcularDiasEscolares(anio, diasMarcados) {
  const marcados = new Set(diasMarcados.map((d) => d.fecha))
  let count = 0
  let cursor = new Date(anio, 0, 1)
  const fin = new Date(anio, 11, 31)
  while (cursor <= fin) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6 && !marcados.has(format(cursor, 'yyyy-MM-dd'))) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

// ─── Agrupación de días consecutivos ─────────────────────────────────────────
function agruparDias(dias) {
  if (!dias.length) return []
  const grupos = []
  let grupo = { ...dias[0], fecha_fin: dias[0].fecha }
  for (let i = 1; i < dias.length; i++) {
    const diff = Math.round(
      (parseISO(dias[i].fecha) - parseISO(grupo.fecha_fin)) / 86400000
    )
    const mismo =
      diff === 1 &&
      dias[i].tipo    === grupo.tipo    &&
      dias[i].motivo  === grupo.motivo  &&
      dias[i].nivel   === grupo.nivel   &&
      dias[i].grado   === grupo.grado   &&
      dias[i].seccion === grupo.seccion
    if (mismo) {
      grupo.fecha_fin = dias[i].fecha
      grupo._ids = grupo._ids ? [...grupo._ids, dias[i].id] : [grupo.id, dias[i].id]
    } else {
      grupos.push(grupo)
      grupo = { ...dias[i], fecha_fin: dias[i].fecha }
    }
  }
  grupos.push(grupo)
  return grupos
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Calendario() {
  // ── Estado principal ──────────────────────────────────────────────────────
  const [diasMarcados, setDiasMarcados]   = useState([])
  const [mes,          setMes]            = useState(new Date())
  const [cargando,     setCargando]       = useState(true)

  // Estado del formulario
  const [tipoNuevo,    setTipoNuevo]      = useState('feriado')
  const [nivelNuevo,   setNivelNuevo]     = useState('todos')
  const [gradoNuevo,   setGradoNuevo]     = useState('')
  const [seccionNuevo, setSeccionNuevo]   = useState('')
  const [notificar,    setNotificar]      = useState(true)
  const [descripcion,  setDescripcion]    = useState('')
  const [fechaInicio,  setFechaInicio]    = useState('')
  const [fechaFin,     setFechaFin]       = useState('')
  const [guardando,    setGuardando]      = useState(false)

  // UI overlays
  const [drawerOpen,   setDrawerOpen]     = useState(false)
  const [sheetOpen,    setSheetOpen]      = useState(false)
  const [filtroDrawer, setFiltroDrawer]   = useState('todos')
  const [confirmarId,  setConfirmarId]    = useState(null)

  const anio = mes.getFullYear()

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/admin/dias-no-laborables', { params: { anio } })
      setDiasMarcados(data)
    } catch {
      toast.error('Error al cargar el calendario')
    } finally {
      setCargando(false)
    }
  }, [anio])

  useEffect(() => { cargar() }, [cargar])

  // ── Helpers de formulario ─────────────────────────────────────────────────
  const resetForm = () => {
    setFechaInicio(''); setFechaFin(''); setDescripcion('')
    setNivelNuevo('todos'); setGradoNuevo(''); setSeccionNuevo('')
    setNotificar(true); setTipoNuevo('feriado')
  }

  const handleMarcar = async (e) => {
    e.preventDefault()
    if (!fechaInicio) return toast.error('Selecciona una fecha')
    if (!descripcion.trim()) return toast.error('Escribe una descripción')
    setGuardando(true)
    try {
      const { data } = await api.post('/admin/dias-no-laborables', {
        fecha_inicio: fechaInicio,
        fecha_fin:    fechaFin || fechaInicio,
        tipo:         tipoNuevo,
        nivel:        nivelNuevo,
        grado:        gradoNuevo  || null,
        seccion:      seccionNuevo || null,
        descripcion,
        notificar,
      })
      const msg = data.omitidos > 0
        ? `${data.creados} día(s) marcado(s) · ${data.omitidos} ya existían`
        : `${data.creados} día(s) marcado(s)`
      toast.success(msg)
      resetForm()
      setSheetOpen(false)
      // Si el rango marcado es de un año distinto al que se está viendo,
      // navegar a ese mes para que el drawer muestre los días correctos
      const anioMarcado = parseISO(fechaInicio).getFullYear()
      if (anioMarcado !== anio) {
        setMes(parseISO(fechaInicio))
      } else {
        cargar()
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al marcar')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (ids) => {
    const lista = Array.isArray(ids) ? ids : [ids]
    try {
      await Promise.all(lista.map((id) => api.delete(`/admin/dias-no-laborables/${id}`)))
      toast.success(`${lista.length} día(s) eliminado(s)`)
      setConfirmarId(null)
      cargar()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // Click en celda del calendario
  const handleClickDia = (dia) => {
    if (isWeekend(dia)) return
    setFechaInicio(format(dia, 'yyyy-MM-dd'))
    setFechaFin('')
    // En móvil abre el bottom sheet; en desktop ya está visible el formulario
    if (window.innerWidth < 1024) setSheetOpen(true)
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const diasDelMes   = eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) })
  const primerDia    = getDay(startOfMonth(mes))
  const vacios       = Array(primerDia === 0 ? 6 : primerDia - 1).fill(null)
  const marcadoSet   = new Map(diasMarcados.map((d) => [d.fecha, d]))
  const diasEscolares = calcularDiasEscolares(anio, diasMarcados)

  const rangoPreview = (() => {
    if (!fechaInicio) return new Set()
    const ini = parseISO(fechaInicio)
    const fin = fechaFin ? parseISO(fechaFin) : ini
    if (fin < ini) return new Set()
    return new Set(eachDay({ start: ini, end: fin }).map((d) => format(d, 'yyyy-MM-dd')))
  })()

  const grupos = agruparDias(diasMarcados)
  const gruposFiltrados = filtroDrawer === 'todos'
    ? grupos
    : grupos.filter((g) => g.tipo === filtroDrawer)

  // Agrupación por mes para el drawer
  const gruposPorMes = gruposFiltrados.reduce((acc, g) => {
    const k = g.fecha.slice(0, 7)
    acc[k] = acc[k] ? [...acc[k], g] : [g]
    return acc
  }, {})

  // ── JSX del formulario (compartido entre desktop y mobile sheet) ──────────
  const formJSX = (
    <form onSubmit={handleMarcar} className="space-y-4">

      {/* Tipo */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Tipo</label>
        <div className="flex gap-2 flex-wrap">
          {TIPOS.map(({ v, label, light, dot }) => (
            <button
              key={v} type="button"
              onClick={() => setTipoNuevo(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                tipoNuevo === v
                  ? `${light} border-transparent shadow-sm`
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
        <input
          className="input"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Día del Maestro"
          required
        />
      </div>

      {/* Audiencia — nivel */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Aplica a</label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(NIVEL_BADGE).map(([v, { label, cls }]) => (
            <button
              key={v} type="button"
              onClick={() => { setNivelNuevo(v); setGradoNuevo(''); setSeccionNuevo('') }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                nivelNuevo === v
                  ? `${cls} border-transparent shadow-sm`
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grado / Sección (si nivel ≠ todos) */}
      {nivelNuevo !== 'todos' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Grado <span className="text-gray-300">(opcional)</span>
            </label>
            <select
              className="input text-sm"
              value={gradoNuevo}
              onChange={(e) => { setGradoNuevo(e.target.value); setSeccionNuevo('') }}
            >
              <option value="">Todos</option>
              {(GRADOS_POR_NIVEL[nivelNuevo] || []).map((g) => (
                <option key={g} value={g}>{formatGrado(nivelNuevo, g)}</option>
              ))}
            </select>
          </div>
          {gradoNuevo && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Sección <span className="text-gray-300">(opcional)</span>
              </label>
              <select
                className="input text-sm"
                value={seccionNuevo}
                onChange={(e) => setSeccionNuevo(e.target.value)}
              >
                <option value="">Todas</option>
                {getSecciones(nivelNuevo, gradoNuevo).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input
            type="date" className="input"
            value={fechaInicio}
            onChange={(e) => {
              setFechaInicio(e.target.value)
              if (fechaFin && fechaFin < e.target.value) setFechaFin('')
            }}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Hasta <span className="text-gray-300">(opcional)</span>
          </label>
          <input
            type="date" className="input"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            min={fechaInicio}
          />
        </div>
      </div>

      {rangoPreview.size > 1 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          {rangoPreview.size} días seleccionados
        </div>
      )}

      {/* Notificar */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={notificar}
          onChange={(e) => setNotificar(e.target.checked)}
          className="w-4 h-4 accent-marino rounded"
        />
        <div className="flex items-center gap-1.5">
          {notificar
            ? <Bell size={13} className="text-marino" />
            : <BellOff size={13} className="text-gray-400" />
          }
          <span className={`text-xs font-medium ${notificar ? 'text-marino' : 'text-gray-400'}`}>
            {notificar ? 'Notificar a apoderados' : 'Sin notificación'}
          </span>
        </div>
      </label>

      <button
        type="submit"
        disabled={guardando}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {guardando
          ? <><span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Guardando...</>
          : <><Plus size={15} /> Marcar días</>
        }
      </button>
    </form>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24 lg:pb-0">

      {/* ── Cabecera ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-marino">Calendario Escolar</h1>

        <div className="flex items-center gap-2">
          {/* Contador días escolares */}
          <div className="flex items-center gap-2 bg-marino/5 px-3 py-1.5 rounded-xl">
            <CalendarDays size={15} className="text-marino" />
            <span className="text-sm font-semibold text-marino">{diasEscolares}</span>
            <span className="text-xs text-gray-500 hidden sm:inline">días escolares {anio}</span>
          </div>

          {/* Botón que abre el drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-marino/40 hover:text-marino text-sm font-medium text-gray-600 transition-all shadow-sm"
          >
            <List size={15} />
            <span className="hidden sm:inline text-sm">Días marcados</span>
            {diasMarcados.length > 0 && (
              <span className="bg-marino text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {diasMarcados.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Calendario */}
        <div className="lg:col-span-2">
          <div className="card">

            {/* Navegación de mes */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setMes(subMonths(mes, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeft size={17} />
              </button>
              <h3 className="font-bold text-marino capitalize text-base">
                {format(mes, 'MMMM yyyy', { locale: es })}
              </h3>
              <button
                onClick={() => setMes(addMonths(mes, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            {/* Cabeceras de semana */}
            <div className="grid grid-cols-7 mb-1">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Celdas */}
            <div className="grid grid-cols-7 gap-1">
              {vacios.map((_, i) => <div key={`v${i}`} />)}
              {diasDelMes.map((dia) => {
                const key     = format(dia, 'yyyy-MM-dd')
                const info    = marcadoSet.get(key)
                const cfg     = info ? tipoCfg(info.tipo) : null
                const finde   = isWeekend(dia)
                const hoy     = isToday(dia)
                const preview = rangoPreview.has(key) && !info

                return (
                  <button
                    key={key}
                    type="button"
                    title={info ? info.motivo : format(dia, 'd MMMM', { locale: es })}
                    onClick={() => handleClickDia(dia)}
                    className={[
                      'aspect-square rounded-xl flex items-center justify-center text-xs font-medium transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-dorado/50',
                      cfg
                        ? `${cfg.color} text-white shadow-sm`
                        : preview
                          ? 'bg-dorado/30 text-marino ring-1 ring-dorado'
                          : hoy
                            ? 'ring-2 ring-marino text-marino font-bold bg-white'
                            : finde
                              ? 'text-gray-300 bg-gray-50 cursor-default'
                              : 'text-gray-600 hover:bg-marino/5 hover:text-marino cursor-pointer',
                    ].join(' ')}
                  >
                    {format(dia, 'd')}
                  </button>
                )
              })}
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100">
              {TIPOS.map(({ v, label, dot }) => (
                <div key={v} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  {label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
                <div className="w-2.5 h-2.5 rounded-full bg-dorado/40" />
                Seleccionado
              </div>
            </div>

            {/* Hint móvil */}
            <p className="lg:hidden text-center text-xs text-gray-400 mt-3">
              Toca un día para marcarlo
            </p>
          </div>
        </div>

        {/* Formulario — solo visible en desktop (columna derecha) */}
        <div className="hidden lg:block">
          <div className="card space-y-4 sticky top-4">
            <div>
              <h2 className="font-bold text-marino">Marcar días</h2>
              <p className="text-xs text-gray-400 mt-1">
                Haz clic en un día del calendario para pre-seleccionar la fecha.
              </p>
            </div>
            {formJSX}
          </div>
        </div>
      </div>

      {/* ── FAB: solo móvil ───────────────────────────────── */}
      <button
        onClick={() => { resetForm(); setSheetOpen(true) }}
        className="lg:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-marino text-white rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Marcar días"
      >
        <Plus size={22} />
      </button>

      {/* ══════════════════════════════════════════════════════
          BOTTOM SHEET — Formulario (móvil)
      ══════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          sheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSheetOpen(false)}
      />

      {/* Panel */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 max-h-[92vh] flex flex-col ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-marino">Marcar días</h2>
          <button
            onClick={() => setSheetOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={18} />
          </button>
        </div>
        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 pb-8">
          {formJSX}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          DRAWER — Días marcados (desktop: desliza derecha / móvil: bottom sheet)
      ══════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => { setDrawerOpen(false); setConfirmarId(null) }}
      />

      {/* Panel */}
      <div
        className={[
          'fixed z-50 bg-white shadow-2xl transition-transform duration-300 flex flex-col',
          // Móvil: bottom sheet
          'bottom-0 left-0 right-0 rounded-t-2xl max-h-[88vh]',
          // Desktop: drawer derecho
          'lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:w-[22rem] lg:max-h-full lg:rounded-none',
          drawerOpen
            ? 'translate-y-0 lg:translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full',
        ].join(' ')}
      >
        {/* Handle — solo móvil */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header del drawer */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-marino">Días marcados</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {diasMarcados.length} día{diasMarcados.length !== 1 ? 's' : ''} no laborables — {anio}
            </p>
          </div>
          <button
            onClick={() => { setDrawerOpen(false); setConfirmarId(null) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs de filtro */}
        <div className="flex gap-1 px-4 py-2.5 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {[{ v: 'todos', label: 'Todos', light: 'bg-marino/10 text-marino' }, ...TIPOS].map(
            ({ v, label, light }) => (
              <button
                key={v}
                onClick={() => setFiltroDrawer(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  filtroDrawer === v
                    ? light
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
                {v !== 'todos' && (
                  <span className="ml-1 opacity-50">
                    ({grupos.filter((g) => g.tipo === v).length})
                  </span>
                )}
              </button>
            )
          )}
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1">
          {cargando ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
              Cargando...
            </div>
          ) : gruposFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <CalendarDays size={36} strokeWidth={1.5} className="opacity-30" />
              <p className="text-sm">Sin días marcados</p>
              <p className="text-xs text-center px-8 text-gray-300">
                {filtroDrawer === 'todos'
                  ? 'Aún no hay días no laborables registrados para este año.'
                  : `No hay entradas de tipo "${TIPOS.find(t => t.v === filtroDrawer)?.label}".`}
              </p>
            </div>
          ) : (
            Object.entries(gruposPorMes).map(([mesKey, items]) => {
              const [y, m] = mesKey.split('-')
              const mesLabel = format(new Date(+y, +m - 1, 1), 'MMMM yyyy', { locale: es })
              return (
                <div key={mesKey}>
                  {/* Cabecera de mes */}
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                    <span className="text-xs font-semibold text-gray-500 capitalize">{mesLabel}</span>
                    <span className="ml-2 text-[11px] text-gray-400">
                      {items.length} entrada{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Entradas */}
                  {items.map((g) => {
                    const esRango = g.fecha !== g.fecha_fin
                    const fechaLabel = esRango
                      ? `${format(parseISO(g.fecha), 'd MMM', { locale: es })} — ${format(parseISO(g.fecha_fin), 'd MMM', { locale: es })}`
                      : format(parseISO(g.fecha), "EEEE d", { locale: es })
                    const idsAEliminar = g._ids || [g.id]
                    const cfg = tipoCfg(g.tipo)
                    const audBadge = NIVEL_BADGE[g.nivel] || NIVEL_BADGE.todos

                    return (
                      <div
                        key={g.id}
                        className={`flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 transition-colors ${
                          confirmarId === g.id ? 'bg-red-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Barra de color por tipo */}
                        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${cfg.color}`} />

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{g.motivo}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400 capitalize">{fechaLabel}</span>
                            <span className="text-gray-200 text-xs">·</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${audBadge.cls}`}>
                              {audienciaLabel(g.nivel, g.grado, g.seccion)}
                            </span>
                          </div>
                        </div>

                        {/* Confirmar eliminación inline */}
                        {confirmarId === g.id ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleEliminar(idsAEliminar)}
                              className="text-xs bg-red-500 text-white px-2.5 py-1.5 rounded-lg font-medium hover:bg-red-600 transition-colors"
                            >
                              Eliminar
                            </button>
                            <button
                              onClick={() => setConfirmarId(null)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmarId(g.id)}
                            className="p-2 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
