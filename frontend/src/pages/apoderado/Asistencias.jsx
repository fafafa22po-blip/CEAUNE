import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, AlertTriangle, X, Clock, ArrowDownLeft, ArrowUpRight, CalendarOff } from 'lucide-react'
import { BarraAsistencia } from '../../components/BarraAsistencia'
import { useHijo } from '../../context/HijoContext'

const MOTIVO_LABEL = {
  marcha:                   'Marcha / Movilización',
  juegos_deportivos:        'Juegos deportivos',
  enfermedad:               'Enfermedad / Malestar',
  permiso_apoderado:        'Permiso del apoderado',
  actividad_institucional:  'Actividad institucional',
  tardanza_justificada:     'Tardanza justificada',
  otro:                     'Otro motivo',
}
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isToday, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { QK } from '../../lib/queryKeys'
import { SkeletonCalendario, SkeletonGrillaCalendario } from '../../components/Skeleton'

const ESTADO_CFG = {
  puntual:  { bg: 'bg-green-100', text: 'text-green-700', icon: '✓' },
  especial: { bg: 'bg-green-100', text: 'text-green-700', icon: '✓' },
  tardanza: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '!' },
  falta:    { bg: 'bg-red-100',   text: 'text-red-600',   icon: '✗' },
}

const ESTADO_LABEL = { puntual: 'Puntual', tardanza: 'Tardanza', falta: 'Falta', especial: 'Especial' }
function etiquetarRegistro(tipo, estado, motivo_especial) {
  if (tipo === 'ingreso')          return estado === 'tardanza' ? 'Tardanza' : 'Ingreso'
  if (tipo === 'ingreso_especial') return estado === 'tardanza' ? 'Tardanza' : 'Regreso al colegio'
  if (tipo === 'salida')           return 'Salida'
  if (tipo === 'salida_especial') {
    if (motivo_especial === 'permiso_apoderado') return 'Recogido'
    return 'Salida anticipada'
  }
  return tipo || 'Registro'
}

function formatHora(horaISO) {
  if (!horaISO) return '—'
  const d = new Date(horaISO)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${ampm}`
}

function pctColores(pct) {
  if (pct >= 90) return { bar: 'bg-green-500', text: 'text-green-600', border: 'border-green-400' }
  if (pct >= 75) return { bar: 'bg-amber-400', text: 'text-amber-600', border: 'border-amber-400' }
  return               { bar: 'bg-red-500',   text: 'text-red-600',   border: 'border-red-400'   }
}

/** Agrupa los días L-V del mes en filas por semana calendario */
function construirSemanas(mes) {
  const diasLV = eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) })
    .filter(d => { const dow = getDay(d); return dow >= 1 && dow <= 5 })

  const semanas = []
  let prevKey = null
  let actual  = null

  diasLV.forEach(d => {
    const dow = getDay(d)
    const lun = new Date(d)
    lun.setDate(d.getDate() - (dow - 1))
    const key = lun.toDateString()

    if (key !== prevKey) {
      prevKey = key
      actual  = [null, null, null, null, null]
      semanas.push(actual)
    }
    actual[dow - 1] = d
  })

  return semanas
}

export default function Asistencias() {
  const { hijoActivo, cargando: cargandoHijos } = useHijo()
  const [mes,  setMes]                        = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)

  // ── asistencias del mes ───────────────────────────────────────────────────
  const mesAnio = format(mes, 'yyyy-MM')
  const mesMes  = mes.getMonth() + 1
  const mesYear = mes.getFullYear()

  const { data: registros = [], isPending: cargandoAsist, isError } = useQuery({
    queryKey: QK.asistencias(hijoActivo?.id, mesAnio),
    queryFn:  () => api.get(`/apoderado/hijo/${hijoActivo.id}/asistencias`, {
      params: {
        fecha_inicio: format(startOfMonth(mes), 'yyyy-MM-dd'),
        fecha_fin:    format(endOfMonth(mes),   'yyyy-MM-dd'),
      },
    }).then(r => Array.isArray(r.data) ? r.data : []),
    enabled:   !!hijoActivo?.id,
    staleTime: 30_000,
  })

  // ── resumen del mes (estadísticas con DNL excluidos) ─────────────────────
  const { data: resumen, isPending: cargandoResumen } = useQuery({
    queryKey: QK.resumenMes(hijoActivo?.id, mesMes, mesYear),
    queryFn:  () => api.get(`/apoderado/hijo/${hijoActivo.id}/resumen-mes`, {
      params: { mes: mesMes, anio: mesYear },
    }).then(r => r.data),
    enabled:   !!hijoActivo?.id,
    staleTime: 0,
  })

  // ── días no laborables del mes ───────────────────────────────────────────
  const { data: diasNoLabArr = [] } = useQuery({
    queryKey: QK.diasNoLab(hijoActivo?.id, mesMes, mesYear),
    queryFn:  () => api.get(`/apoderado/hijo/${hijoActivo.id}/dias-no-laborables`, {
      params: { mes: mesMes, anio: mesYear },
    }).then(r => Array.isArray(r.data) ? r.data : []),
    enabled:   !!hijoActivo?.id,
    staleTime: 5 * 60_000,
  })

  // Error al cargar asistencias
  useEffect(() => {
    if (isError) toast.error('Error al cargar asistencias')
  }, [isError])

  // ── mapa fecha → estado: viene del servidor (incluye faltas implícitas) ──
  const mapa = resumen?.estados ?? {}

  // ── mapa detallado: fecha → todos los registros del día ───────────────────
  const mapaDetalle = {}
  registros.forEach(r => {
    const f = typeof r.fecha === 'string' ? r.fecha : format(new Date(r.fecha), 'yyyy-MM-dd')
    if (!mapaDetalle[f]) mapaDetalle[f] = []
    mapaDetalle[f].push(r)
  })

  // ── mapa de días no laborables ───────────────────────────────────────────
  const mapaNoLab = {}
  diasNoLabArr.forEach(d => { mapaNoLab[d.fecha] = d.motivo })

  // ── estadísticas (del servidor, excluye días no laborables) ──────────────
  const hoy      = new Date()
  const pct      = resumen?.pct      ?? 100
  const diasLab  = resumen?.dias_lab  ?? 0
  const presentes = resumen?.presentes ?? 0
  const tardanzas = resumen?.tardanzas ?? 0
  const asistidos = resumen?.asistidos ?? 0
  const faltas    = resumen?.faltas    ?? 0
  const colores   = pctColores(pct)

  const semanas = construirSemanas(mes)
  const hoyStr  = format(hoy, 'yyyy-MM-dd')

  // Faltas sin justificar: días laborables sin ingreso registrado
  const hasta = mes.getMonth() === hoy.getMonth() && mes.getFullYear() === hoy.getFullYear()
    ? hoy : endOfMonth(mes)
  const faltasSJ = eachDayOfInterval({ start: startOfMonth(mes), end: hasta })
    .filter(d => {
      const dow = getDay(d)
      if (dow < 1 || dow > 5) return false
      const dStr = format(d, 'yyyy-MM-dd')
      if (dStr > hoyStr) return false
      if (mapaNoLab[dStr]) return false
      return mapa[dStr] === 'falta'
    })
    .map(d => ({ fecha: format(d, 'yyyy-MM-dd') }))

  const celdaCfg = (d) => {
    if (!d) return null
    const dStr = format(d, 'yyyy-MM-dd')
    if (dStr > hoyStr) return { bg: 'bg-gray-50', text: 'text-gray-200', icon: null }
    if (mapaNoLab[dStr]) return { bg: 'bg-sky-50', text: 'text-sky-400', icon: 'L' }
    const estado = mapa[dStr]
    return estado ? ESTADO_CFG[estado] : { bg: 'bg-gray-100', text: 'text-gray-400', icon: '—' }
  }

  const nombreHijo = hijoActivo ? `${hijoActivo.nombre} ${hijoActivo.apellido}` : ''

  // Cerrar detalle al cambiar mes o hijo
  useEffect(() => { setDiaSeleccionado(null) }, [mesAnio, hijoActivo?.id])

  // Bloquea touch events para que NO lleguen al pull-to-refresh del Layout
  const backdropRef = useRef(null)
  useEffect(() => {
    const el = backdropRef.current
    if (!el) return
    const stop = (e) => e.stopPropagation()
    el.addEventListener('touchstart', stop, { passive: true })
    el.addEventListener('touchmove',  stop, { passive: true })
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove',  stop)
    }
  }, [diaSeleccionado]) // re-ejecuta al abrir/cerrar el modal

  // ── datos del día seleccionado ──────────────────────────────────────────
  const regsDetalle      = diaSeleccionado ? (mapaDetalle[diaSeleccionado] || []) : []
  const detIngreso       = regsDetalle.find(r => r.tipo === 'ingreso' || r.tipo === 'ingreso_especial')
  const detSalida        = regsDetalle.find(r => r.tipo === 'salida' || r.tipo === 'salida_especial')
  const detEstado        = diaSeleccionado ? mapa[diaSeleccionado] : null
  const detCfg           = detEstado ? ESTADO_CFG[detEstado] : null
  const detObservaciones = regsDetalle.filter(r => r.observacion)
  const detNoLab         = diaSeleccionado ? mapaNoLab[diaSeleccionado] : null

  // ── skeleton inicial ──────────────────────────────────────────────────────
  if (cargandoHijos) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <SkeletonCalendario />
        <SkeletonGrillaCalendario />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* ── HERO ── */}
      <div className={`card border-l-4 ${colores.border}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Asistencia mensual</p>
            <p className="font-bold text-marino capitalize text-lg">
              {format(mes, 'MMMM yyyy', { locale: es })}
            </p>
            {nombreHijo && <p className="text-sm text-gray-500 mt-0.5">{nombreHijo}</p>}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              disabled={mes.getFullYear() === hoy.getFullYear() && mes.getMonth() === hoy.getMonth()}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Porcentaje grande */}
        <div className="flex items-end gap-3 mb-3">
          <span className={`text-5xl font-black ${colores.text}`}>{pct}%</span>
          <span className="text-sm text-gray-400 mb-1.5">de asistencia</span>
        </div>

        {/* Barra de zonas con marcador */}
        <div className="mb-4">
          <BarraAsistencia pct={pct} diasLab={diasLab} faltas={faltas} size="md" />
        </div>

        {/* Mini estadísticas */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Asistidos', val: asistidos, color: 'text-green-600' },
            { label: 'Tardanzas', val: tardanzas, color: 'text-amber-600' },
            { label: 'Faltas',    val: faltas,    color: 'text-red-600'   },
            { label: 'Días lab.', val: diasLab,   color: 'text-gray-600'  },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl py-3">
              <p className={`text-xl font-bold ${color}`}>{val}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── CALENDARIO L–V ── */}
      <div className="card">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Días de clase
        </p>

        {/* Cabecera días */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400">{d}</div>
          ))}
        </div>

        {(cargandoAsist || cargandoResumen) ? (
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
                  const cfg = celdaCfg(d)
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
            { bg: 'bg-green-100', text: 'text-green-700', icon: '✓', label: 'Puntual'       },
            { bg: 'bg-amber-100', text: 'text-amber-700', icon: '!', label: 'Tardanza'      },
            { bg: 'bg-red-100',   text: 'text-red-600',   icon: '✗', label: 'Falta'         },
            { bg: 'bg-gray-100',  text: 'text-gray-400',  icon: '—', label: 'Sin registro'  },
            { bg: 'bg-sky-50',    text: 'text-sky-400',   icon: 'L', label: 'No laborable'  },
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

      {/* ── ALERTAS: faltas sin justificar ── */}
      {faltasSJ.length > 0 && (
        <div className="card border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-700">
              {faltasSJ.length === 1
                ? '1 falta registrada este mes'
                : `${faltasSJ.length} faltas registradas este mes`}
            </p>
          </div>
          <div className="space-y-2">
            {faltasSJ.slice(0, 5).map(r => {
              const fechaStr = typeof r.fecha === 'string'
                ? r.fecha
                : format(new Date(r.fecha), 'yyyy-MM-dd')
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100"
                >
                  <p className="text-sm text-gray-700 capitalize">
                    {format(parseISO(fechaStr), "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                  <a
                    href="/apoderado/justificar"
                    className="text-xs font-semibold text-dorado hover:underline flex items-center gap-1 whitespace-nowrap ml-3"
                  >
                    <FileText size={11} /> Justificar
                  </a>
                </div>
              )
            })}
            {faltasSJ.length > 5 && (
              <p className="text-xs text-amber-600 text-center pt-1">
                +{faltasSJ.length - 5} más
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET: detalle del día seleccionado ───────────────────── */}
      {diaSeleccionado && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in modal-nav-offset"
          onClick={() => setDiaSeleccionado(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Panel */}
          <div
            className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up sm:mx-4 flex flex-col"
            style={{ maxHeight: 'calc(90vh - var(--nav-h) - env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle (solo móvil) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div
              className="px-5 pt-3 overflow-y-auto"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))', overscrollBehavior: 'contain' }}
            >
              {/* Cabecera: fecha + cerrar */}
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

              {/* Badge de estado */}
              {detCfg && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold mb-4 ${detCfg.bg} ${detCfg.text}`}>
                  <span className="text-base">{detCfg.icon}</span>
                  {ESTADO_LABEL[detEstado]}
                </div>
              )}

              {/* Registros del día */}
              {regsDetalle.length > 0 ? (
                <div className="space-y-3">
                  {/* Ingreso */}
                  {detIngreso && (
                    <div className={`flex items-center gap-3 rounded-xl p-3.5 ${detIngreso.tipo === 'ingreso_especial' ? 'bg-violet-50/70' : 'bg-blue-50/70'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${detIngreso.tipo === 'ingreso_especial' ? 'bg-violet-100' : 'bg-blue-100'}`}>
                        <ArrowDownLeft size={18} className={detIngreso.tipo === 'ingreso_especial' ? 'text-violet-600' : 'text-blue-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700">
                          {etiquetarRegistro(detIngreso.tipo, detIngreso.estado, detIngreso.motivo_especial)}
                        </p>
                        {detIngreso.motivo_especial && (
                          <p className="text-xs text-violet-600 font-medium mt-0.5">
                            {MOTIVO_LABEL[detIngreso.motivo_especial]}
                          </p>
                        )}
                      </div>
                      <p className="text-xl font-bold text-marino tabular-nums">
                        {formatHora(detIngreso.hora)}
                      </p>
                    </div>
                  )}

                  {/* Salida */}
                  {detSalida && (
                    <div className={`flex items-center gap-3 rounded-xl p-3.5 ${detSalida.tipo === 'salida_especial' ? 'bg-orange-50/70' : 'bg-purple-50/70'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${detSalida.tipo === 'salida_especial' ? 'bg-orange-100' : 'bg-purple-100'}`}>
                        <ArrowUpRight size={18} className={detSalida.tipo === 'salida_especial' ? 'text-orange-600' : 'text-purple-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700">
                          {etiquetarRegistro(detSalida.tipo, detSalida.estado, detSalida.motivo_especial)}
                        </p>
                        {detSalida.motivo_especial && (
                          <p className="text-xs text-orange-600 font-medium mt-0.5">
                            {MOTIVO_LABEL[detSalida.motivo_especial]}
                          </p>
                        )}
                      </div>
                      <p className="text-xl font-bold text-marino tabular-nums">
                        {formatHora(detSalida.hora)}
                      </p>
                    </div>
                  )}

                  {/* Observaciones del auxiliar */}
                  {detObservaciones.map((r, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                        Observación
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">{r.observacion}</p>
                    </div>
                  ))}
                </div>
              ) : detNoLab ? (
                /* Día no laborable */
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CalendarOff size={22} className="text-sky-300" />
                  </div>
                  <p className="text-sm font-semibold text-sky-500">Día no laborable</p>
                  <p className="text-xs text-gray-400 mt-1">{detNoLab}</p>
                </div>
              ) : (
                /* Sin registros */
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Clock size={22} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">Sin registro de asistencia</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Contacte al auxiliar para más información
                  </p>
                </div>
              )}

              {/* Botón justificar si es falta (no aplica en días no laborables) */}
              {detEstado === 'falta' && !detNoLab && (
                <Link
                  to="/apoderado/justificar"
                  onClick={() => setDiaSeleccionado(null)}
                  className="btn-primary w-full py-3 mt-4 font-semibold flex items-center justify-center gap-2"
                >
                  <FileText size={16} />
                  Justificar inasistencia
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
