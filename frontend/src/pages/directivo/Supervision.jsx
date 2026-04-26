import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Users, QrCode, FileCheck, MessageSquare, CalendarCheck,
  AlertOctagon, Activity, BookOpen, ChevronRight,
  Clock, Bell, BarChart2, ShieldCheck, AlertTriangle, Calendar,
} from 'lucide-react'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import {
  NIVEL_COLOR, NIVEL_LABEL, NIVEL_ICON,
  getSemaforoAux, getSemaforoTutor,
  ini, ORDEN, HOY_STR, RingProgress, DateNavigator,
} from './_supervisionUtils'

// ── HOOK ──────────────────────────────────────────────────────────────────────
function useIsDesktop() {
  const [v, setV] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const fn = () => setV(window.innerWidth >= 1024)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return v
}

// ── TARJETA AUXILIAR ──────────────────────────────────────────────────────────
function TarjetaAuxiliar({ aux, onClick }) {
  const sem     = getSemaforoAux(aux)
  const esRojo  = sem === 'rojo'
  const esAmbar = sem === 'ambar'
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98] group ${
        esRojo  ? 'bg-white border-l-4 border-red-400 shadow-card'
        : esAmbar ? 'bg-amber-50/50 border-l-4 border-amber-400 shadow-card'
        : 'bg-white border-l-4 border-emerald-400 shadow-card'
      }`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${NIVEL_COLOR[aux.nivel] ?? 'bg-gray-100 text-gray-600'}`}>
          {ini(aux.nombre, aux.apellido)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{aux.nombre} {aux.apellido}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${esRojo ? 'text-red-500' : esAmbar ? 'text-amber-600' : 'text-emerald-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${esRojo ? 'bg-red-500' : esAmbar ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {esRojo ? 'Sin actividad hoy' : esAmbar ? 'Atención' : 'Activo'}
            </span>
          </div>
        </div>
        <ChevronRight size={15} className="flex-shrink-0 text-gray-300 group-hover:text-marino transition-colors" />
      </div>

      {!esRojo && (
        <div className="mt-2.5 flex items-center gap-4 text-xs pl-14">
          <span className="flex items-center gap-1">
            <QrCode size={12} className="text-marino" />
            <strong className="text-marino">{aux.escaneos_hoy}</strong>
            <span className="text-gray-400">alumnos</span>
          </span>
          {aux.primer_escaneo && (
            <span className="flex items-center gap-1 text-gray-400">
              <Clock size={11} />desde {aux.primer_escaneo}
            </span>
          )}
          {aux.justif_pendientes > 0 && (
            <span className="flex items-center gap-1">
              <FileCheck size={11} className="text-amber-500" />
              <strong className="text-amber-600">{aux.justif_pendientes}</strong>
              <span className="text-gray-400">pend.</span>
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ── TARJETA TUTOR ─────────────────────────────────────────────────────────────
function TarjetaTutor({ tutor, onClick }) {
  const sem     = getSemaforoTutor(tutor)
  const esRojo  = sem === 'rojo'
  const esAmbar = sem === 'ambar'
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98] group ${
        esRojo  ? 'bg-white border-l-4 border-red-400 shadow-card'
        : esAmbar ? 'bg-amber-50/50 border-l-4 border-amber-400 shadow-card'
        : 'bg-white border-l-4 border-emerald-400 shadow-card'
      }`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${NIVEL_COLOR[tutor.nivel] ?? 'bg-gray-100 text-gray-600'}`}>
          {ini(tutor.nombre, tutor.apellido)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{tutor.nombre} {tutor.apellido}</p>
          <p className="text-xs text-gray-400 mt-0.5">{NIVEL_LABEL[tutor.nivel] ?? tutor.nivel} · {tutor.grado}° {tutor.seccion}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${esRojo ? 'text-red-500' : esAmbar ? 'text-amber-600' : 'text-emerald-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${esRojo ? 'bg-red-500' : esAmbar ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {esRojo ? 'Sin comunicados' : esAmbar ? 'Actividad baja' : 'Activo'}
          </span>
          <ChevronRight size={13} className="text-gray-300 group-hover:text-marino transition-colors" />
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-4 text-xs pl-14">
        <span className="flex items-center gap-1">
          <MessageSquare size={12} className="text-marino" />
          <strong className="text-marino">{tutor.comunicados_semana}</strong>
          <span className="text-gray-400">esta semana</span>
        </span>
        <span className="flex items-center gap-1">
          <CalendarCheck size={12} className="text-dorado-600" />
          <strong className="text-dorado-600">{tutor.reuniones_semana}</strong>
          <span className="text-gray-400">{tutor.reuniones_semana === 1 ? 'reunión' : 'reuniones'}</span>
        </span>
      </div>
    </button>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function Supervision() {
  const navigate   = useNavigate()
  const isDesktop  = useIsDesktop()
  const [tab,      setTab]      = useState('auxiliares')
  const [fechaRef, setFechaRef] = useState(HOY_STR)

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: QK.directivoSupervision(fechaRef),
    queryFn:  () => api.get('/directivo/supervision', { params: { fecha: fechaRef } }).then(r => r.data),
    staleTime:        2 * 60_000,
    keepPreviousData: true,
  })

  const { resumen, niveles_stats = {}, recojo_hoy } = data || {}
  const auxiliares = [...(data?.auxiliares ?? [])].sort((a, b) => ORDEN[getSemaforoAux(a)] - ORDEN[getSemaforoAux(b)])
  const tutores    = [...(data?.tutores    ?? [])].sort((a, b) => ORDEN[getSemaforoTutor(a)] - ORDEN[getSemaforoTutor(b)])

  const esHoy      = fechaRef === HOY_STR()
  const fechaLabel = format(parseISO(fechaRef), "EEEE d 'de' MMMM yyyy", { locale: es })

  const alertasAux   = auxiliares.filter(a => getSemaforoAux(a)   === 'rojo').length
  const alertasTutor = tutores.filter(t => getSemaforoTutor(t)    === 'rojo').length
  const totalAlertas = alertasAux + alertasTutor

  const auxAtencion  = auxiliares.filter(a => getSemaforoAux(a)   === 'rojo')
  const auxActivos   = auxiliares.filter(a => getSemaforoAux(a)   !== 'rojo')
  const tutAtencion  = tutores.filter(t => getSemaforoTutor(t)    === 'rojo')
  const tutActivos   = tutores.filter(t => getSemaforoTutor(t)    !== 'rojo')

  const listaAtencion = tab === 'auxiliares' ? auxAtencion : tutAtencion
  const listaActivos  = tab === 'auxiliares' ? auxActivos  : tutActivos

  const irAuxiliar = (aux)   => navigate(`auxiliar/${aux.id}`,   { state: { aux } })
  const irTutor    = (tutor) => navigate(`tutor/${tutor.id}`,    { state: { tutor } })

  const nivelesDisponibles = Object.keys(niveles_stats)

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-6 bg-gray-100 rounded-xl w-1/3 animate-pulse" />
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertOctagon size={32} className="text-red-400" />
      <p className="text-sm font-semibold text-gray-600">Error al cargar supervisión</p>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-marino">Supervisión</h1>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {esHoy ? 'Vista de hoy' : fechaLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {totalAlertas > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
              <Bell size={13} className="text-red-500" />
              <span className="text-xs font-black text-red-600">{totalAlertas} alerta{totalAlertas > 1 ? 's' : ''}</span>
            </div>
          )}
          <DateNavigator fecha={fechaRef} onChange={setFechaRef} compact={!isDesktop} isFetching={isFetching} />
        </div>
      </div>

      {/* ── AVISO HISTÓRICO ──────────────────────────────────────────────── */}
      {!esHoy && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <Calendar size={13} className="text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 font-semibold capitalize truncate">
            Datos históricos · {fechaLabel}
          </span>
        </div>
      )}

      {/* ── KPI POR NIVEL — más grandes en desktop ───────────────────────── */}
      {nivelesDisponibles.length > 0 && (
        <div className={`grid gap-3 ${
          nivelesDisponibles.length === 1 ? 'grid-cols-1'
          : nivelesDisponibles.length === 2 ? 'grid-cols-2'
          : 'grid-cols-3'
        }`}>
          {nivelesDisponibles.map(nivel => {
            const stats = niveles_stats[nivel]
            const pct   = stats.pct
            const color = pct >= 85 ? 'text-emerald-500' : pct >= 70 ? 'text-amber-500' : 'text-red-500'
            const bgBar = pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
            return (
              <div key={nivel} className="bg-white rounded-2xl shadow-card p-4 lg:p-5">
                {/* Mobile: centrado compacto */}
                <div className="lg:hidden flex flex-col items-center gap-1.5">
                  <p className="text-xs font-bold text-marino">{NIVEL_LABEL[nivel]}</p>
                  <div className="relative flex items-center justify-center">
                    <RingProgress pct={pct} color={color} size={70} />
                    <span className={`absolute text-base font-black ${color}`}>{pct}%</span>
                  </div>
                  <p className="text-xs font-bold text-gray-700">{stats.presentes}/{stats.total}</p>
                  {stats.tardanzas > 0 && (
                    <p className="text-[10px] font-semibold text-amber-600">{stats.tardanzas} tard.</p>
                  )}
                  {stats.ausentes > 0 && (
                    <p className="text-[10px] font-semibold text-red-500">{stats.ausentes} falta{stats.ausentes > 1 ? 's' : ''}</p>
                  )}
                </div>
                {/* Desktop: horizontal con más info */}
                <div className="hidden lg:flex items-center gap-5">
                  <div className="relative flex-shrink-0">
                    <RingProgress pct={pct} color={color} size={90} />
                    <span className={`absolute inset-0 flex items-center justify-center text-xl font-black ${color}`}>{pct}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{NIVEL_ICON[nivel]}</span>
                      <p className="text-base font-black text-marino">{NIVEL_LABEL[nivel]}</p>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden mb-3">
                      <div className={`h-full rounded-full transition-all duration-700 ${bgBar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <div className="text-center">
                        <p className="text-lg font-black text-emerald-600">{stats.presentes}</p>
                        <p className="text-[10px] text-gray-400">escaneados</p>
                      </div>
                      {stats.tardanzas > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-black text-amber-600">{stats.tardanzas}</p>
                          <p className="text-[10px] text-gray-400">tardanzas</p>
                        </div>
                      )}
                      {stats.ausentes > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-black text-red-500">{stats.ausentes}</p>
                          <p className="text-[10px] text-gray-400">faltas</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── STATS GLOBALES ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            Icon: Users,
            val:   `${resumen?.aux_activos_hoy ?? 0}/${resumen?.total_auxiliares ?? 0}`,
            label: 'Aux. activos hoy',
            alert: (resumen?.aux_activos_hoy ?? 0) < (resumen?.total_auxiliares ?? 0),
          },
          {
            Icon:  QrCode,
            val:   `${resumen?.presentes_inst ?? 0}/${resumen?.total_alumnos_inst ?? 0}`,
            label: 'Alumnos hoy',
            alert: false,
            sub:   resumen?.pct_asistencia_inst != null ? `${resumen.pct_asistencia_inst}% asistencia` : null,
          },
          {
            Icon:  FileCheck,
            val:   resumen?.justif_pendientes ?? 0,
            label: 'Justif. pendientes',
            alert: (resumen?.justif_pendientes ?? 0) > 0,
          },
          ...(recojo_hoy != null ? [{
            Icon:  ShieldCheck,
            val:   recojo_hoy.confirmados,
            label: 'Recojo inicial',
            alert: false,
            sub:   `de ${recojo_hoy.total_alumnos} alumnos`,
          }] : [{
            Icon:  BarChart2,
            val:   tutores.length,
            label: 'Tutores total',
            alert: false,
          }]),
        ].map(({ Icon, val, label, alert, sub }) => (
          <div key={label} className={`rounded-2xl px-4 py-4 shadow-card flex flex-col gap-1.5 ${alert ? 'bg-amber-50' : 'bg-white'}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${alert ? 'bg-amber-100' : 'bg-marino/10'}`}>
              <Icon size={16} className={alert ? 'text-amber-600' : 'text-marino'} />
            </div>
            <p className={`text-2xl font-black leading-none mt-0.5 ${alert ? 'text-amber-600' : 'text-marino'}`}>{val}</p>
            <p className="text-xs text-gray-400 leading-tight">{label}</p>
            {sub && <p className="text-xs text-gray-500 font-semibold leading-none">{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── TABS AUXILIARES / TUTORES ─────────────────────────────────────── */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl">
        {[
          { key: 'auxiliares', Icon: Activity,  label: 'Auxiliares', count: alertasAux   },
          { key: 'tutores',    Icon: BookOpen,   label: 'Tutores',    count: alertasTutor },
        ].map(({ key, Icon, label, count }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === key ? 'bg-white text-marino shadow-sm' : 'text-gray-500'}`}>
            <Icon size={14} />{label}
            {count > 0 && (
              <span className="min-w-[16px] px-1 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── LISTA ────────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {listaAtencion.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle size={12} className="text-red-500" />
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Requieren atención</p>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {listaAtencion.map(item =>
                tab === 'auxiliares'
                  ? <TarjetaAuxiliar key={item.id} aux={item}   onClick={() => irAuxiliar(item)} />
                  : <TarjetaTutor    key={item.id} tutor={item} onClick={() => irTutor(item)} />
              )}
            </div>
          </div>
        )}

        {listaActivos.length > 0 && (
          <div className="space-y-3">
            {listaAtencion.length > 0 && (
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Activos</p>
            )}
            <div className="grid gap-2 lg:grid-cols-2">
              {listaActivos.map(item =>
                tab === 'auxiliares'
                  ? <TarjetaAuxiliar key={item.id} aux={item}   onClick={() => irAuxiliar(item)} />
                  : <TarjetaTutor    key={item.id} tutor={item} onClick={() => irTutor(item)} />
              )}
            </div>
          </div>
        )}

        {listaAtencion.length === 0 && listaActivos.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-card">
            {tab === 'auxiliares'
              ? <Users size={32} className="text-gray-200 mx-auto mb-3" />
              : <BookOpen size={32} className="text-gray-200 mx-auto mb-3" />}
            <p className="text-sm text-gray-400">Sin {tab} registrados</p>
          </div>
        )}
      </div>
    </div>
  )
}
