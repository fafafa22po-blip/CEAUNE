import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft, Activity, MessageSquare, UserX, CalendarCheck,
  Eye, AlertTriangle, CheckCircle2, AlertOctagon,
} from 'lucide-react'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import {
  NIVEL_COLOR, NIVEL_LABEL, HOY_STR, ini, getSemaforoTutor, relativo,
  BarChartSemana, AvisoRapido, TabComunicados,
} from './_supervisionUtils'

const TABS = [
  { key: 'resumen',     label: 'Resumen',     Icon: Activity },
  { key: 'comunicados', label: 'Comunicados', Icon: MessageSquare },
  { key: 'ausencias',   label: 'Ausencias',   Icon: UserX },
  { key: 'reuniones',   label: 'Reuniones',   Icon: CalendarCheck },
]

export default function SupervisionTutor() {
  const { id }    = useParams()
  const { state } = useLocation()
  const navigate  = useNavigate()
  const qc        = useQueryClient()

  // Intentar obtener datos básicos del cache si no vienen por state
  const cachedData   = qc.getQueryData(QK.directivoSupervision(HOY_STR()))
  const tutorCache   = cachedData?.tutores?.find(t => String(t.id) === String(id))
  const tutor        = state?.tutor ?? tutorCache

  const [tab, setTab] = useState('resumen')

  const { data: detalle, isLoading } = useQuery({
    queryKey: QK.directivoTutorDetalle(id),
    queryFn:  () => api.get(`/directivo/supervision/tutor/${id}`).then(r => r.data),
    staleTime: 60_000,
  })

  const sem      = tutor ? getSemaforoTutor(tutor) : null
  const semBg    = sem === 'rojo' ? 'bg-red-100 text-red-600' : sem === 'ambar' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
  const semDot   = sem === 'rojo' ? 'bg-red-500' : sem === 'ambar' ? 'bg-amber-500' : 'bg-emerald-500'
  const semLabel = sem === 'rojo' ? 'Sin comunicados esta semana' : sem === 'ambar' ? 'Actividad baja' : 'Activo'

  const hoy  = detalle?.aula_hoy
  const aula = detalle?.aula
  const com  = detalle?.comunicacion
  const pct  = hoy?.pct ?? 0

  const pctColor     = pct >= 85 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500'
  const pctBarColor  = pct >= 85 ? 'bg-emerald-500'   : pct >= 70 ? 'bg-amber-500'   : 'bg-red-500'

  return (
    <div className="space-y-5 pb-10">

      {/* ── BREADCRUMB ───────────────────────────────────────────────────── */}
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-marino hover:text-marino/70 transition-colors active:scale-95">
        <ChevronLeft size={16} />
        Volver a Supervisión
      </button>

      {/* ── HEADER PERSONA ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card px-5 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0 ${NIVEL_COLOR[tutor?.nivel] ?? 'bg-gray-100 text-gray-600'}`}>
            {tutor ? ini(tutor.nombre, tutor.apellido) : '?'}
          </div>

          <div className="flex-1 min-w-0">
            {tutor ? (
              <>
                <h1 className="text-xl font-black text-gray-900 leading-tight">{tutor.nombre} {tutor.apellido}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Tutor · {NIVEL_LABEL[tutor.nivel] ?? tutor.nivel}
                  {tutor.grado && <> · {tutor.grado}° {tutor.seccion}</>}
                </p>
                {sem && (
                  <span className={`inline-flex items-center gap-1.5 mt-2 text-xs font-bold px-3 py-1 rounded-full ${semBg}`}>
                    <span className={`w-2 h-2 rounded-full ${semDot}`} />
                    {semLabel}
                  </span>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="h-6 bg-gray-100 rounded-xl w-48 animate-pulse" />
                <div className="h-4 bg-gray-100 rounded-xl w-32 animate-pulse" />
              </div>
            )}
          </div>

          {/* Resumen rápido en el header */}
          {tutor && (
            <div className="flex gap-3 flex-shrink-0">
              <div className="text-center bg-marino/5 rounded-2xl px-4 py-3">
                <p className="text-2xl font-black text-marino">{tutor.comunicados_semana}</p>
                <p className="text-[10px] text-gray-400">comunicados</p>
                <p className="text-[10px] text-gray-400">esta semana</p>
              </div>
              <div className="text-center bg-gray-50 rounded-2xl px-4 py-3">
                <p className="text-2xl font-black text-dorado-600">{tutor.reuniones_semana}</p>
                <p className="text-[10px] text-gray-400">reuniones</p>
                <p className="text-[10px] text-gray-400">esta semana</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t.key ? 'bg-white text-marino shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.Icon size={14} />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.substring(0, 3)}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ─────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.2fr_1fr]">

          {/* Columna izquierda */}
          <div className="space-y-5">

            {/* Asistencia del aula hoy */}
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Asistencia del aula hoy
                {aula && <span className="ml-2 font-semibold text-marino">{aula.grado}° {aula.seccion}</span>}
              </p>
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-xl animate-pulse" />
                </div>
              ) : hoy?.total > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-4xl font-black text-marino leading-none">{hoy.presentes}</p>
                      <p className="text-sm text-gray-400 mt-1">de {hoy.total} presentes</p>
                    </div>
                    <span className={`text-4xl font-black ${pctColor}`}>{pct}%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${pctBarColor}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  {hoy.ausentes > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
                      <UserX size={14} className="text-red-400 flex-shrink-0" />
                      <p className="text-sm text-red-600">
                        <strong>{hoy.ausentes}</strong> alumno{hoy.ausentes > 1 ? 's' : ''} ausente{hoy.ausentes > 1 ? 's' : ''} hoy
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 gap-3">
                  <AlertOctagon size={36} className="text-gray-200" />
                  <p className="text-sm text-gray-400">Sin datos de asistencia disponibles</p>
                </div>
              )}
            </div>

            {/* Comunicación con familias */}
            {!isLoading && com && (
              <div className="bg-white rounded-2xl shadow-card p-5">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Comunicación con familias</p>

                <div className="space-y-2 mb-5">
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={15} className="text-marino" />
                      <span className="text-sm text-gray-700">Enviados esta semana</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-black ${com.semana_total >= 3 ? 'text-emerald-600' : com.semana_total >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                        {com.semana_total}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${com.semana_total >= 3 ? 'bg-emerald-100 text-emerald-700' : com.semana_total >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {com.semana_total >= 3 ? 'Bien' : com.semana_total >= 1 ? 'Bajo' : 'Ninguno'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Eye size={15} className="text-emerald-500" />
                      <span className="text-sm text-gray-700">Promedio de lectura</span>
                    </div>
                    <span className={`text-base font-black ${com.pct_lectura >= 70 ? 'text-emerald-600' : com.pct_lectura >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {com.pct_lectura}%
                    </span>
                  </div>

                  {com.familias_inactivas > 0 && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                      <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-700">
                        <strong>{com.familias_inactivas}</strong> familia{com.familias_inactivas > 1 ? 's' : ''} nunca abre{com.familias_inactivas === 1 ? '' : 'n'} los comunicados
                      </p>
                    </div>
                  )}
                </div>

                {com.por_dia?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Comunicados por día</p>
                    <BarChartSemana porDia={com.por_dia} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columna derecha */}
          <div className="space-y-5">

            {/* Últimos comunicados */}
            {!isLoading && detalle?.ultimos_comunicados?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Últimos comunicados</p>
                  <button onClick={() => setTab('comunicados')}
                    className="text-xs font-bold text-marino hover:underline">
                    Ver todos
                  </button>
                </div>
                <div className="space-y-3">
                  {detalle.ultimos_comunicados.map(c => (
                    <div key={c.id} className="bg-gray-50 rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-bold text-gray-800 leading-tight flex-1">{c.asunto}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{relativo(c.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-black text-emerald-600">{c.pct}%</span>
                        <span className="text-xs text-gray-400">leído · {c.total} familias</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aviso rápido */}
            {!isLoading && (
              <div className="bg-white rounded-2xl shadow-card p-5">
                <AvisoRapido personaId={id} avisosPrevios={detalle?.avisos_enviados ?? []} />
              </div>
            )}

            {isLoading && (
              <div className="space-y-5">
                <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: COMUNICADOS ─────────────────────────────────────────────── */}
      {tab === 'comunicados' && (
        <div className="bg-white rounded-2xl shadow-card p-5 lg:p-7">
          <h2 className="text-base font-black text-gray-700 mb-5">Historial completo de comunicados</h2>
          <TabComunicados personaId={id} />
        </div>
      )}

      {/* ── TAB: AUSENCIAS ───────────────────────────────────────────────── */}
      {tab === 'ausencias' && (
        <div className="bg-white rounded-2xl shadow-card p-5 lg:p-7">
          <h2 className="text-sm font-black text-gray-700 mb-5">Alumnos con 3 o más ausencias esta semana</h2>
          {isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : !detalle?.alumnos_riesgo?.length ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <CheckCircle2 size={44} className="text-emerald-200" />
              <p className="text-base font-semibold text-gray-400">Sin alumnos en riesgo esta semana</p>
              <p className="text-sm text-gray-300">Todos los alumnos tienen asistencia regular</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {detalle.alumnos_riesgo.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <UserX size={16} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{a.nombre}</p>
                    <p className="text-xs text-gray-500">{a.ausencias_semana} ausencias esta semana</p>
                  </div>
                  <span className="text-sm font-black text-red-600 bg-red-100 px-3 py-1 rounded-full flex-shrink-0">
                    {a.ausencias_semana}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: REUNIONES ───────────────────────────────────────────────── */}
      {tab === 'reuniones' && (
        <div className="bg-white rounded-2xl shadow-card p-5 lg:p-7">
          <h2 className="text-sm font-black text-gray-700 mb-5">Reuniones programadas esta semana</h2>
          {isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : !detalle?.reuniones_semana?.length ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <CalendarCheck size={44} className="text-gray-200" />
              <p className="text-base font-semibold text-gray-400">Sin reuniones esta semana</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {detalle.reuniones_semana.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-dorado/5 border border-dorado/15 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-dorado/10 flex items-center justify-center flex-shrink-0">
                    <CalendarCheck size={16} className="text-dorado-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-800 truncate">{r.titulo}</p>
                    <p className="text-xs text-gray-500">
                      {r.estudiante} · {format(parseISO(r.fecha), 'EEE d MMM', { locale: es })} {r.hora}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    r.estado === 'confirmada' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {r.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
