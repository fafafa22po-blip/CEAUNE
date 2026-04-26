import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileCheck, MessageSquare, AlertTriangle,
  Clock, CheckCircle, ArrowRight, RefreshCw,
  Bell, TrendingDown, ChevronRight,
} from 'lucide-react'
import api from '../../lib/api'
import { obtenerUsuario } from '../../lib/auth'
import toast from 'react-hot-toast'
import { SkeletonAuxiliarInicio } from '../../components/Skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const NIVEL_LABEL = {
  'i-auxiliar': 'Inicial',
  'p-auxiliar': 'Primaria',
  's-auxiliar': 'Secundaria',
}

const CARGO_DIRECTIVO = {
  'inicial':    'Directora de Inicial',
  'primaria':   'Subdirector de Primaria',
  'secundaria': 'Subdirector de Secundaria',
  'formacion':  'Subdir. Form. General',
  'todos':      'Director del CEAUNE',
}

function getCargo(rol, nivel) {
  if (rol === 'directivo') return CARGO_DIRECTIVO[nivel] || 'Directivo'
  return `Auxiliar de ${NIVEL_LABEL[rol] ?? 'nivel'}`
}

const DIST_CFG = [
  { key: 'puntual',  label: 'Puntuales',  color: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50'  },
  { key: 'tardanza', label: 'Tardanzas',  color: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  { key: 'falta',    label: 'Faltas',     color: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    },
  { key: 'especial', label: 'Especiales', color: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
]

export default function InicioAuxiliar() {
  const nav = useNavigate()
  const usuario = obtenerUsuario()
  const [cargando, setCargando] = useState(true)
  const [resumen, setResumen] = useState(null)
  const [justificaciones, setJustificaciones] = useState([])
  const [mensajesPendientes, setMensajesPendientes] = useState(0)
  const [incidenciasHoy, setIncidenciasHoy] = useState([])
  const [distribucion, setDistribucion] = useState({})
  const [rankingGrados, setRankingGrados] = useState([])

  const cargar = async () => {
    setCargando(true)
    try {
      const [resumenRes, justRes, bandejaRes, hoyRes] = await Promise.all([
        api.get('/asistencia/hoy/resumen'),
        api.get('/justificaciones/pendientes', { params: { estado: 'pendiente' } }),
        api.get('/comunicados/bandeja', { params: { pagina: 1, por_pagina: 50, filtro: 'respuesta' } }),
        api.get('/asistencia/hoy'),
      ])

      setResumen(resumenRes.data)
      setJustificaciones(justRes.data?.slice(0, 4) || [])

      const itemsBandeja = bandejaRes.data?.items ?? bandejaRes.data ?? []
      setMensajesPendientes(Array.isArray(itemsBandeja) ? itemsBandeja.length : 0)

      const registros = Array.isArray(hoyRes.data) ? hoyRes.data : []

      // Incidencias para la lista inferior
      setIncidenciasHoy(
        registros.filter((r) => r.estado_dia === 'tardanza' || r.estado_dia === 'falta').slice(0, 5)
      )

      // Distribución por estado
      const dist = { puntual: 0, tardanza: 0, falta: 0, especial: 0 }
      registros.forEach((r) => {
        if (dist[r.estado_dia] !== undefined) dist[r.estado_dia]++
      })
      setDistribucion(dist)

      // Ranking de grados por incidencias
      const porGrado = {}
      registros.forEach((r) => {
        const grado = r.estudiante?.grado
        if (!grado) return
        if (!porGrado[grado]) porGrado[grado] = { tardanzas: 0, faltas: 0 }
        if (r.estado_dia === 'tardanza') porGrado[grado].tardanzas++
        if (r.estado_dia === 'falta') porGrado[grado].faltas++
      })
      const ranking = Object.entries(porGrado)
        .map(([grado, { tardanzas, faltas }]) => ({ grado, tardanzas, faltas, total: tardanzas + faltas }))
        .filter((g) => g.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
      setRankingGrados(ranking)

    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const totalRegistros = Object.values(distribucion).reduce((a, b) => a + b, 0)
  const porcentaje =
    resumen && resumen.total_estudiantes > 0
      ? Math.round(((resumen.puntuales + resumen.tardanzas) / resumen.total_estudiantes) * 100)
      : 0
  const totalIncidencias = (resumen?.tardanzas ?? 0) + (resumen?.faltas ?? 0)
  const maxGrado = rankingGrados[0]?.total || 1
  const hoyStr = format(new Date(), "EEEE d 'de' MMMM", { locale: es })

  if (cargando) return <SkeletonAuxiliarInicio />

  return (
    <div className="space-y-6">

      {/* ── Banner de bienvenida ── */}
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
              {(() => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches' })()},<br />
              <span className="text-dorado">{usuario?.nombre ? usuario.nombre.split(' ')[0] : 'Auxiliar'}</span>
            </h1>
            <p className="mt-2 text-sm font-semibold text-white/75">
              {getCargo(usuario?.rol, usuario?.nivel)}
            </p>
            <button
              onClick={() => nav('/auxiliar/escanear')}
              className="mt-5 inline-flex items-center gap-2 bg-dorado text-marino text-sm font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-dorado/20"
            >
              Registrar asistencia <ChevronRight size={14} />
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

      <div className="flex justify-end">
        <button onClick={cargar} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Tarjetas de estado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav('/auxiliar/asistencia')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Asistencia hoy</p>
              <p className="text-3xl font-bold text-marino mt-1">{porcentaje}%</p>
              <p className="text-xs text-gray-400 mt-1">{resumen?.puntuales ?? 0} de {resumen?.total_estudiantes ?? 0} alumnos</p>
            </div>
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle size={20} className="text-green-600" />
            </div>
          </div>
          <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-dorado h-1.5 rounded-full transition-all" style={{ width: `${porcentaje}%` }} />
          </div>
        </div>

        <div className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav('/auxiliar/justificaciones')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Justificaciones</p>
              <p className="text-3xl font-bold text-marino mt-1">{justificaciones.length}</p>
              <p className="text-xs text-gray-400 mt-1">pendientes de revisar</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${justificaciones.length > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
              <FileCheck size={20} className={justificaciones.length > 0 ? 'text-yellow-600' : 'text-gray-400'} />
            </div>
          </div>
          {justificaciones.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <Bell size={12} className="text-yellow-500" />
              <span className="text-xs text-yellow-600 font-medium">Requiere atención</span>
            </div>
          )}
        </div>

        <div className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav('/auxiliar/comunicados')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Respuestas</p>
              <p className="text-3xl font-bold text-marino mt-1">{mensajesPendientes}</p>
              <p className="text-xs text-gray-400 mt-1">de apoderados</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mensajesPendientes > 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <MessageSquare size={20} className={mensajesPendientes > 0 ? 'text-blue-600' : 'text-gray-400'} />
            </div>
          </div>
          {mensajesPendientes > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <Bell size={12} className="text-blue-500" />
              <span className="text-xs text-blue-600 font-medium">Nuevas respuestas</span>
            </div>
          )}
        </div>

        <div className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav('/auxiliar/asistencia')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tardanzas/Faltas</p>
              <p className="text-3xl font-bold text-marino mt-1">{totalIncidencias}</p>
              <p className="text-xs text-gray-400 mt-1">{resumen?.tardanzas ?? 0} tard. · {resumen?.faltas ?? 0} faltas</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${totalIncidencias > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <TrendingDown size={20} className={totalIncidencias > 0 ? 'text-red-500' : 'text-gray-400'} />
            </div>
          </div>
          {(resumen?.faltas ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-xs text-red-500 font-medium">{resumen.faltas} alumno(s) ausente(s)</span>
            </div>
          )}
        </div>

      </div>

      {/* Métricas estadísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Distribución por estado */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-marino">Distribución de asistencia</h2>
            <span className="text-xs text-gray-400">{totalRegistros} registros hoy</span>
          </div>

          {totalRegistros === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">Sin registros por el momento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {DIST_CFG.map(({ key, label, color, text, bg }) => {
                const valor = distribucion[key] ?? 0
                const pct = totalRegistros > 0 ? Math.round((valor / totalRegistros) * 100) : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>{valor}</span>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${color} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Ranking de grados por incidencias */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-marino">Incidencias por grado</h2>
            <button
              onClick={() => nav('/auxiliar/asistencia')}
              className="text-xs text-dorado font-medium flex items-center gap-1 hover:underline"
            >
              Ver detalle <ArrowRight size={12} />
            </button>
          </div>

          {rankingGrados.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <CheckCircle size={28} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm">Sin incidencias por grado hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rankingGrados.map(({ grado, tardanzas, faltas, total }) => {
                const pct = Math.round((total / maxGrado) * 100)
                return (
                  <div key={grado}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{grado}</span>
                      <div className="flex items-center gap-2 text-xs">
                        {tardanzas > 0 && (
                          <span className="bg-yellow-50 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">
                            {tardanzas} tard.
                          </span>
                        )}
                        {faltas > 0 && (
                          <span className="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                            {faltas} falt.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-marino h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Listas inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Incidencias de hoy */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-marino">Incidencias de hoy</h2>
            <button
              onClick={() => nav('/auxiliar/asistencia')}
              className="text-xs text-dorado font-medium flex items-center gap-1 hover:underline"
            >
              Ver todos <ArrowRight size={12} />
            </button>
          </div>

          {incidenciasHoy.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle size={28} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm">Sin tardanzas ni faltas hoy</p>
            </div>
          ) : (
            <div className="space-y-1">
              {incidenciasHoy.map((r) => {
                const isTardanza = r.estado_dia === 'tardanza'
                return (
                  <div key={r.estudiante?.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isTardanza ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.estudiante?.nombre?.[0]}{r.estudiante?.apellido?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 leading-none">
                          {r.estudiante?.nombre} {r.estudiante?.apellido}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{r.estudiante?.grado} · {r.estudiante?.seccion}</p>
                      </div>
                    </div>
                    <span className={isTardanza ? 'badge-amarillo' : 'badge-rojo'}>
                      {isTardanza ? 'Tardanza' : 'Falta'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Justificaciones pendientes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-marino">Justificaciones pendientes</h2>
            <button
              onClick={() => nav('/auxiliar/justificaciones')}
              className="text-xs text-dorado font-medium flex items-center gap-1 hover:underline"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>

          {justificaciones.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileCheck size={28} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm">Sin justificaciones pendientes</p>
            </div>
          ) : (
            <div className="space-y-1">
              {justificaciones.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                  onClick={() => nav('/auxiliar/justificaciones')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <Clock size={14} className="text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-none">{j.nombre_estudiante}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{j.motivo}</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
