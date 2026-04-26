import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users, CheckCircle2, ChevronRight,
  TrendingDown, TrendingUp, FileText, AlertTriangle, BookOpen,
  MessageSquare, CalendarCheck, Download, Eye,
  ArrowUpRight, ArrowDownRight, Minus,
  ShieldCheck, UserCheck, Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import { obtenerUsuario } from '../../lib/auth'
import { SkeletonTutorInicio } from '../../components/Skeleton'

// ── config tipo observación ────────────────────────────────────────────────────
const OBS_CFG = {
  academica:  { color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-100', label: 'Académica'  },
  conductual: { color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100', label: 'Conductual' },
  salud:      { color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-100',    label: 'Salud'      },
  logro:      { color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-100',  label: 'Logro'      },
  otro:       { color: 'text-gray-500',   bg: 'bg-gray-50',    border: 'border-gray-100',   label: 'Otro'       },
}

const ALERTA_ICONO = {
  'alert-triangle': AlertTriangle,
  'trending-down':  TrendingDown,
  'calendar':       CalendarCheck,
}
const ALERTA_COLOR = {
  red:   { bg: 'bg-red-50',   border: 'border-red-100',   icon: 'text-red-500',   title: 'text-red-700'   },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500', title: 'text-amber-700' },
  blue:  { bg: 'bg-blue-50',  border: 'border-blue-100',  icon: 'text-blue-500',  title: 'text-blue-700'  },
}

const pctBarColor  = p => p >= 90 ? 'bg-green-500'  : p >= 75 ? 'bg-amber-400' : 'bg-red-500'
const pctNumColor  = p => p >= 90 ? 'text-green-600' : p >= 75 ? 'text-amber-600' : 'text-red-600'

export default function Inicio() {
  const nav = useNavigate()
  const usuario     = obtenerUsuario()
  const nombreTutor = usuario?.nombre ? usuario.nombre.split(' ')[0] : 'Tutor'

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: aula } = useQuery({
    queryKey: QK.tutorAula,
    queryFn: () => api.get('/tutor/mi-aula').then(r => r.data),
  })

  const { data: estudiantes = [] } = useQuery({
    queryKey: QK.tutorEstudiantes(),
    queryFn: () => api.get('/tutor/mi-aula/estudiantes').then(r => r.data?.estudiantes || []),
  })

  const { data: estadisticas = [], isLoading } = useQuery({
    queryKey: QK.tutorEstadisticas(),
    queryFn: () => api.get('/tutor/mi-aula/estadisticas').then(r => r.data?.estudiantes || []),
  })

  const { data: observaciones = [] } = useQuery({
    queryKey: QK.tutorObservaciones({ por_pagina: 5 }),
    queryFn: () => api.get('/tutor/observaciones', { params: { por_pagina: 5 } }).then(r =>
      Array.isArray(r.data) ? r.data : []
    ),
  })

  const { data: alertas = [] } = useQuery({
    queryKey: QK.tutorAlertas,
    queryFn: () => api.get('/tutor/alertas').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: comparativa } = useQuery({
    queryKey: QK.tutorComparativa(),
    queryFn: () => api.get('/tutor/mi-aula/comparativa').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: recojoHoy } = useQuery({
    queryKey: QK.tutorRecojoHoy,
    queryFn: () => api.get('/recojo/resumen-hoy', { params: { nivel: 'inicial' } }).then(r => r.data),
    enabled: aula?.nivel === 'inicial',
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  })

  // ── Derivados ─────────────────────────────────────────────────────────────
  const nombreMap = {}
  estudiantes.forEach(e => { nombreMap[e.id] = `${e.apellido}, ${e.nombre}` })

  const totalAula   = estudiantes.length
  const enRiesgo    = estadisticas.filter(e => e.porcentaje < 75)
  const enRiesgoTop = enRiesgo.slice(0, 5)
  const pctMensual  = estadisticas.length > 0
    ? Math.round(estadisticas.reduce((s, e) => s + e.porcentaje, 0) / estadisticas.length)
    : 0
  const faltasTotal = estadisticas.reduce((s, e) => s + (e.faltas || 0), 0)

  const aulaLabel = aula
    ? `${aula.grado}° ${aula.seccion} · ${aula.nivel.charAt(0).toUpperCase() + aula.nivel.slice(1)}`
    : ''

  // ── Delta badge helper ────────────────────────────────────────────────────
  const mesAnteriorNombre = (() => {
    const d = new Date()
    const nombre = format(new Date(d.getFullYear(), d.getMonth() - 1, 1), 'MMMM', { locale: es })
    return nombre.charAt(0).toUpperCase() + nombre.slice(1)
  })()

  const DeltaBadge = ({ value, invertColor = false, label }) => {
    if (value == null || value === 0) return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 font-medium">
        <Minus size={10} /> Igual que en {mesAnteriorNombre}
      </span>
    )
    const isImprovement = invertColor ? value < 0 : value > 0
    const absVal        = Math.abs(value)
    const subio         = value > 0
    const texto         = label ? label(absVal, subio) : `${absVal}`
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
        isImprovement ? 'text-green-600' : 'text-red-500'
      }`}>
        {isImprovement ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
        <span className="font-bold">{texto}</span>
        <span className="font-normal text-gray-400">que en {mesAnteriorNombre}</span>
      </span>
    )
  }

  if (isLoading) return <SkeletonTutorInicio />

  return (
    <div className="space-y-5">

      {/* ── Banner de bienvenida ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-marino px-8 py-7">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute top-6 right-52    w-14 h-14 rounded-full bg-dorado/20  pointer-events-none" />
        <div className="absolute -bottom-20 right-32 w-56 h-56 rounded-full bg-dorado/10  pointer-events-none" />
        <div className="absolute bottom-6 right-8  w-8  h-8  rounded-full bg-white/10  pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-xs capitalize tracking-wide mb-2">
              {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
            <h1 className="text-3xl font-black text-white leading-tight">
              {saludo},<br />
              <span className="text-dorado">{nombreTutor}</span>
            </h1>
            {aulaLabel && (
              <p className="mt-2 text-white/55 text-sm flex items-center gap-1.5">
                <Users size={13} className="text-dorado/70" />
                Tutor de <span className="font-semibold text-white/80 ml-1">{aulaLabel}</span>
              </p>
            )}
            <button
              onClick={() => nav('/tutor/mi-aula')}
              className="mt-5 inline-flex items-center gap-2 bg-dorado text-marino text-sm font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-dorado/20"
            >
              Ver mi aula <ChevronRight size={14} />
            </button>
          </div>

          <div className="hidden sm:block flex-shrink-0 w-32 h-32 sm:w-44 sm:h-44 opacity-90 select-none pointer-events-none">
            <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="80" cy="85" r="62" fill="white" fillOpacity="0.04"/>
              <rect x="18" y="108" width="72" height="11" rx="4" fill="#c9a227" fillOpacity="0.85"/>
              <rect x="22" y="94"  width="64" height="11" rx="4" fill="#c9a227" fillOpacity="0.60"/>
              <rect x="14" y="121" width="82" height="9"  rx="4" fill="#c9a227" fillOpacity="0.38"/>
              <line x1="26" y1="98"  x2="78" y2="98"  stroke="white" strokeWidth="1" strokeOpacity="0.25"/>
              <line x1="26" y1="102" x2="72" y2="102" stroke="white" strokeWidth="1" strokeOpacity="0.18"/>
              <rect x="82" y="68" width="36" height="40" rx="10" fill="#c9a227" fillOpacity="0.60"/>
              <circle cx="100" cy="47" r="20" fill="#c9a227" fillOpacity="0.80"/>
              <path d="M80 40 Q100 22 120 40" fill="#0a1f3d" fillOpacity="0.40"/>
              <circle cx="93"  cy="47" r="2.5" fill="#0a1f3d" fillOpacity="0.50"/>
              <circle cx="107" cy="47" r="2.5" fill="#0a1f3d" fillOpacity="0.50"/>
              <path d="M93 57 Q100 62 107 57" stroke="#0a1f3d" strokeWidth="2" strokeLinecap="round" fill="none" fillOpacity="0.40"/>
              <path d="M82 80 Q66 88 62 102"   stroke="#c9a227" strokeWidth="8" strokeLinecap="round"/>
              <path d="M118 80 Q134 88 138 102" stroke="#c9a227" strokeWidth="8" strokeLinecap="round"/>
              <path d="M140 28 L142.5 35 L150 35 L144 39.5 L146.5 46.5 L140 42 L133.5 46.5 L136 39.5 L130 35 L137.5 35 Z"
                fill="#c9a227" fillOpacity="0.50"/>
              <circle cx="32" cy="62" r="5"    fill="white" fillOpacity="0.10"/>
              <circle cx="20" cy="80" r="3"    fill="white" fillOpacity="0.07"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => nav('/tutor/mi-aula')}
          className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-dorado/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
            <MessageSquare size={16} className="text-indigo-500" />
          </div>
          <span className="text-xs font-semibold text-gray-700">Registrar observación</span>
        </button>

        <button onClick={() => nav('/tutor/mi-aula')}
          className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-dorado/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
            <Users size={16} className="text-green-500" />
          </div>
          <span className="text-xs font-semibold text-gray-700">Contactar apoderado</span>
        </button>

        <button onClick={() => nav('/tutor/seguimiento')}
          className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-dorado/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
            <Download size={16} className="text-blue-500" />
          </div>
          <span className="text-xs font-semibold text-gray-700">Descargar reporte</span>
        </button>

        <button onClick={() => nav('/tutor/reuniones')}
          className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-dorado/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
            <CalendarCheck size={16} className="text-purple-500" />
          </div>
          <span className="text-xs font-semibold text-gray-700">Agendar reunión</span>
        </button>
      </div>

      {/* ── Panel recojo del día (solo inicial) ──────────────────────────────── */}
      {aula?.nivel === 'inicial' && recojoHoy && (
        <div
          className="card border border-emerald-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav('/tutor/recojo')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-700">Recojo del día</p>
                <p className="text-xs text-gray-400">Estado actual de salidas</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* En el aula */}
            <div className="flex flex-col items-center gap-1.5 px-2 py-3 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users size={15} className="text-blue-600" />
              </div>
              <span className="text-2xl font-black text-blue-700 tabular-nums leading-none">
                {recojoHoy.total_presentes - recojoHoy.total_recogidos}
              </span>
              <span className="text-[10px] font-semibold text-blue-500 text-center leading-tight">En el aula</span>
            </div>

            {/* Ya recogidos */}
            <div className="flex flex-col items-center gap-1.5 px-2 py-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <UserCheck size={15} className="text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-emerald-700 tabular-nums leading-none">
                {recojoHoy.total_recogidos}
              </span>
              <span className="text-[10px] font-semibold text-emerald-500 text-center leading-tight">Recogidos</span>
            </div>

            {/* Pendientes */}
            <div className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border ${
              recojoHoy.total_pendientes > 0
                ? 'bg-amber-50 border-amber-100'
                : 'bg-gray-50 border-gray-100'
            }`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                recojoHoy.total_pendientes > 0 ? 'bg-amber-100' : 'bg-gray-100'
              }`}>
                <Clock size={15} className={recojoHoy.total_pendientes > 0 ? 'text-amber-600' : 'text-gray-400'} />
              </div>
              <span className={`text-2xl font-black tabular-nums leading-none ${
                recojoHoy.total_pendientes > 0 ? 'text-amber-700' : 'text-gray-400'
              }`}>
                {recojoHoy.total_pendientes}
              </span>
              <span className={`text-[10px] font-semibold text-center leading-tight ${
                recojoHoy.total_pendientes > 0 ? 'text-amber-500' : 'text-gray-400'
              }`}>
                Pendientes
              </span>
            </div>
          </div>

          {recojoHoy.total_presentes === 0 && (
            <p className="mt-3 text-xs text-gray-400 text-center">Sin ingresos registrados hoy</p>
          )}
        </div>
      )}

      {/* ── Alertas inteligentes ──────────────────────────────────────────────── */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.slice(0, 4).map((alerta, i) => {
            const Icono = ALERTA_ICONO[alerta.icono] || AlertTriangle
            const c = ALERTA_COLOR[alerta.color] || ALERTA_COLOR.amber
            return (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${c.bg} ${c.border} cursor-pointer hover:shadow-sm transition-shadow`}
                onClick={() => alerta.estudiante_id && nav('/tutor/seguimiento')}
              >
                <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icono size={16} className={c.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${c.title}`}>{alerta.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{alerta.detalle}</p>
                </div>
                {alerta.estudiante_id && <ChevronRight size={16} className="text-gray-300 mt-1 flex-shrink-0" />}
              </div>
            )
          })}
        </div>
      )}

      {/* ── KPIs mensuales con comparativa ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* % Asistencia mensual */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Asistencia mensual</p>
              <p className={`text-3xl font-black mt-1 tabular-nums ${pctNumColor(pctMensual)}`}>
                {pctMensual}<span className="text-lg">%</span>
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              pctMensual >= 90 ? 'bg-green-50' : pctMensual >= 75 ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              <TrendingUp size={18} className={pctNumColor(pctMensual)} />
            </div>
          </div>
          <div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`${pctBarColor(pctMensual)} h-1.5 rounded-full transition-all duration-700`}
                style={{ width: `${pctMensual}%` }}
              />
            </div>
            {comparativa
              ? <DeltaBadge
                  value={comparativa.delta_pct}
                  label={(n, up) => up ? `${n}% más` : `${n}% menos`}
                />
              : <p className="text-[10px] text-gray-400 mt-1">Promedio del aula este mes</p>
            }
          </div>
        </div>

        {/* Alumnos en riesgo */}
        <div className={`card flex flex-col gap-3 ${enRiesgo.length > 0 ? 'border border-red-100' : ''}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Alumnos en riesgo</p>
              <p className={`text-3xl font-black mt-1 tabular-nums ${
                enRiesgo.length > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {enRiesgo.length}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              enRiesgo.length > 0 ? 'bg-red-50' : 'bg-green-50'
            }`}>
              <AlertTriangle size={18} className={enRiesgo.length > 0 ? 'text-red-500' : 'text-green-500'} />
            </div>
          </div>
          {comparativa
            ? <DeltaBadge
                value={comparativa.delta_riesgo}
                invertColor
                label={(n, up) => up
                  ? `${n} ${n === 1 ? 'alumno' : 'alumnos'} más en riesgo`
                  : `${n} ${n === 1 ? 'alumno' : 'alumnos'} menos en riesgo`
                }
              />
            : <p className="text-[10px] text-gray-400">
                {enRiesgo.length > 0 ? 'Con menos del 75% de asistencia' : 'Ningún alumno en situación crítica'}
              </p>
          }
        </div>

        {/* Total del aula */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Total del aula</p>
              <p className="text-3xl font-black mt-1 text-marino tabular-nums">{totalAula}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <BookOpen size={18} className="text-blue-500" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            {aulaLabel || 'Alumnos matriculados'}
          </p>
        </div>

        {/* Faltas acumuladas */}
        <div className={`card flex flex-col gap-3 ${faltasTotal > 0 ? 'border border-orange-100' : ''}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Faltas acumuladas</p>
              <p className={`text-3xl font-black mt-1 tabular-nums ${
                faltasTotal === 0 ? 'text-green-600' : faltasTotal > 10 ? 'text-red-600' : 'text-orange-500'
              }`}>
                {faltasTotal}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              faltasTotal === 0 ? 'bg-green-50' : 'bg-orange-50'
            }`}>
              <TrendingDown size={18} className={faltasTotal === 0 ? 'text-green-500' : 'text-orange-500'} />
            </div>
          </div>
          {comparativa
            ? <DeltaBadge
                value={comparativa.delta_faltas}
                invertColor
                label={(n, up) => up
                  ? `${n} ${n === 1 ? 'falta' : 'faltas'} más`
                  : `${n} ${n === 1 ? 'falta' : 'faltas'} menos`
                }
              />
            : <p className="text-[10px] text-gray-400">Total de faltas del aula este mes</p>
          }
        </div>

      </div>

      {/* ── Grid: alumnos en riesgo + últimas observaciones ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Card: Alumnos en riesgo — detalle */}
        {enRiesgoTop.length > 0 ? (
          <div className="card border border-red-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="font-bold text-red-700">Alumnos en riesgo</p>
                  <p className="text-xs text-gray-400">Menos del 75% de asistencia</p>
                </div>
              </div>
              {enRiesgo.length > 5 && (
                <button
                  onClick={() => nav('/tutor/mi-aula')}
                  className="flex items-center gap-1 text-xs font-semibold text-dorado hover:underline"
                >
                  Ver todos ({enRiesgo.length}) <ChevronRight size={13} />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {enRiesgoTop.map(est => (
                <div
                  key={est.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => nav('/tutor/seguimiento')}
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {est.apellido?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {est.apellido}, {est.nombre}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-red-100 rounded-full h-1.5">
                        <div
                          className="bg-red-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${est.porcentaje}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-red-500 flex-shrink-0 tabular-nums">
                        {est.porcentaje}%
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {est.faltas} {est.faltas === 1 ? 'falta' : 'faltas'} · {est.tardanzas} tardanza{est.tardanzas !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card border border-green-100 bg-green-50 flex items-center gap-3">
            <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-700">Todo va bien este mes</p>
              <p className="text-xs text-gray-500 mt-0.5">Ningún alumno en situación de riesgo</p>
            </div>
          </div>
        )}

        {/* Card: Últimas observaciones */}
        {observaciones.length > 0 ? (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-indigo-500" />
                </div>
                <div>
                  <p className="font-bold text-marino">Últimas observaciones</p>
                  <p className="text-xs text-gray-400">Registradas por ti</p>
                </div>
              </div>
              <button
                onClick={() => nav('/tutor/seguimiento')}
                className="flex items-center gap-1 text-xs font-semibold text-dorado hover:underline"
              >
                Ver todo <ChevronRight size={13} />
              </button>
            </div>

            <div className="space-y-2">
              {observaciones.map(obs => {
                const cfg    = OBS_CFG[obs.tipo] || OBS_CFG.otro
                const nombre = nombreMap[obs.estudiante_id] || '—'
                const fecha  = obs.created_at
                  ? format(new Date(obs.created_at), "d 'de' MMM", { locale: es })
                  : ''
                return (
                  <div
                    key={obs.id}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-500 font-medium truncate">{nombre}</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {obs.descripcion}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
                      {fecha}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FileText size={22} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Sin observaciones recientes</p>
              <p className="text-xs text-gray-400 mt-1">Registra tu primera observación</p>
            </div>
            <button
              onClick={() => nav('/tutor/mi-aula')}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-dorado hover:underline"
            >
              <MessageSquare size={13} /> Registrar observación
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
