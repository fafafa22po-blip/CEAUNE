import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft, Activity, MessageSquare, FileCheck,
  QrCode, Clock, AlertOctagon, Calendar,
} from 'lucide-react'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import {
  NIVEL_COLOR, NIVEL_LABEL, HOY_STR, ini, getSemaforoAux,
  DateNavigator, MiniBarChart, AvisoRapido, TabComunicados, TabJustificaciones,
  relativo,
} from './_supervisionUtils'

const TABS = [
  { key: 'resumen',         label: 'Resumen',         Icon: Activity },
  { key: 'comunicados',     label: 'Comunicados',     Icon: MessageSquare },
  { key: 'justificaciones', label: 'Justificaciones', Icon: FileCheck },
]

export default function SupervisionAuxiliar() {
  const { id }    = useParams()
  const { state } = useLocation()
  const navigate  = useNavigate()
  const qc        = useQueryClient()

  // Intentar obtener datos básicos del cache si no vienen por state
  const cachedData    = qc.getQueryData(QK.directivoSupervision(HOY_STR()))
  const auxFromCache  = cachedData?.auxiliares?.find(a => String(a.id) === String(id))
  const aux           = state?.aux ?? auxFromCache

  const [tab,      setTab]      = useState('resumen')
  const [fechaRef, setFechaRef] = useState(HOY_STR)

  const { data: detalle, isLoading, isFetching } = useQuery({
    queryKey: QK.directivoAuxDetalle(id, fechaRef),
    queryFn:  () => api.get(`/directivo/supervision/auxiliar/${id}`, {
      params: { fecha_ref: fechaRef },
    }).then(r => r.data),
    staleTime: 60_000,
    keepPreviousData: true,
  })

  const esHoy    = fechaRef === HOY_STR()
  const diaLabel = esHoy ? 'Hoy' : format(parseISO(fechaRef), "EEEE d 'de' MMMM", { locale: es })
  const hoy      = detalle?.hoy

  const sem      = aux ? getSemaforoAux(aux) : null
  const semBg    = sem === 'rojo' ? 'bg-red-100 text-red-600' : sem === 'ambar' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
  const semDot   = sem === 'rojo' ? 'bg-red-500' : sem === 'ambar' ? 'bg-amber-500' : 'bg-emerald-500'
  const semLabel = sem === 'rojo' ? 'Sin actividad hoy' : sem === 'ambar' ? 'Requiere atención' : 'Activo'

  return (
    <div className="space-y-5 pb-10">

      {/* ── BREADCRUMB ───────────────────────────────────────────────────── */}
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-marino hover:text-marino/70 transition-colors active:scale-95">
        <ChevronLeft size={16} />
        Volver a Supervisión
      </button>

      {/* ── HEADER PERSONA ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card px-5 py-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0 ${NIVEL_COLOR[aux?.nivel] ?? 'bg-gray-100 text-gray-600'}`}>
            {aux ? ini(aux.nombre, aux.apellido) : '?'}
          </div>

          <div className="flex-1 min-w-0">
            {aux ? (
              <>
                <h1 className="text-xl font-black text-gray-900 leading-tight">{aux.nombre} {aux.apellido}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Auxiliar · {NIVEL_LABEL[aux.nivel] ?? aux.nivel}
                </p>
                <span className={`inline-flex items-center gap-1.5 mt-2 text-xs font-bold px-3 py-1 rounded-full ${semBg}`}>
                  <span className={`w-2 h-2 rounded-full ${semDot}`} />
                  {semLabel}
                </span>
              </>
            ) : (
              <div className="space-y-2">
                <div className="h-6 bg-gray-100 rounded-xl w-48 animate-pulse" />
                <div className="h-4 bg-gray-100 rounded-xl w-32 animate-pulse" />
              </div>
            )}
          </div>

          {/* Date navigator solo visible en tab resumen */}
          {tab === 'resumen' && (
            <div className="flex-shrink-0">
              <DateNavigator fecha={fechaRef} onChange={setFechaRef} isFetching={isFetching} />
            </div>
          )}
        </div>

        {tab === 'resumen' && !esHoy && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <Calendar size={13} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-700 font-semibold capitalize">
              Datos históricos · {format(parseISO(fechaRef), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </span>
          </div>
        )}
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
            <span className="sm:hidden">{t.label === 'Justificaciones' ? 'Justif.' : t.label}</span>
            {t.key === 'justificaciones' && aux?.justif_pendientes > 0 && (
              <span className="min-w-[18px] h-4 px-1 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {aux.justif_pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ─────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.2fr_1fr]">

          {/* Columna izquierda */}
          <div className="space-y-5">

            {/* Actividad del día */}
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 capitalize">{diaLabel}</p>
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                    <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                  </div>
                </div>
              ) : hoy?.total > 0 ? (
                <div className="space-y-3">
                  {/* Fila principal: escaneados, puntuales, tardanzas */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-marino/5 rounded-2xl p-3 text-center">
                      <QrCode size={18} className="text-marino mx-auto mb-1.5" />
                      <p className="text-2xl font-black text-marino leading-none">{hoy.total}</p>
                      <p className="text-[10px] text-gray-400 mt-1">escaneados</p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-emerald-600 leading-none mt-1">{hoy.puntuales ?? (hoy.total - (hoy.tardanzas ?? 0))}</p>
                      <p className="text-[10px] text-gray-400 mt-1">puntuales</p>
                    </div>
                    <div className={`rounded-2xl p-3 text-center ${(hoy.tardanzas ?? 0) > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <p className={`text-2xl font-black leading-none mt-1 ${(hoy.tardanzas ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {hoy.tardanzas ?? 0}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">tardanzas</p>
                    </div>
                  </div>
                  {/* Fila horarios */}
                  {hoy.primer_escaneo && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                      <Clock size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">
                        Primer escaneo <strong className="text-gray-800">{hoy.primer_escaneo}</strong>
                        {hoy.ultimo_escaneo && hoy.ultimo_escaneo !== hoy.primer_escaneo && (
                          <> · Último <strong className="text-gray-800">{hoy.ultimo_escaneo}</strong></>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 gap-3">
                  <AlertOctagon size={36} className="text-red-200" />
                  <p className="text-sm font-semibold text-red-500">Sin escaneos registrados</p>
                  <p className="text-xs text-gray-400">No hay actividad en esta fecha</p>
                </div>
              )}
            </div>

            {/* Historial 7 días */}
            {!isLoading && detalle?.historial_7dias?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-card p-5">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                  {esHoy ? 'Últimos 7 días' : `7 días hasta el ${format(parseISO(fechaRef), 'd MMM', { locale: es })}`}
                </p>
                <MiniBarChart historial={detalle.historial_7dias} />
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
                  {detalle.ultimos_comunicados.slice(0, 3).map(c => (
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
                <div className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
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

      {/* ── TAB: JUSTIFICACIONES ─────────────────────────────────────────── */}
      {tab === 'justificaciones' && (
        <div className="bg-white rounded-2xl shadow-card p-5 lg:p-7">
          <h2 className="text-base font-black text-gray-700 mb-5">
            Justificaciones · {NIVEL_LABEL[aux?.nivel] ?? 'cargando...'}
          </h2>
          {aux?.nivel
            ? <TabJustificaciones nivel={aux.nivel} />
            : <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          }
        </div>
      )}
    </div>
  )
}
