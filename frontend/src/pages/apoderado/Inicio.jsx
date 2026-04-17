import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHijo } from '../../context/HijoContext'
import {
  CheckCircle2, Clock, XCircle, HelpCircle,
  MessageSquare, AlertTriangle, BookOpen,
  ChevronRight, GraduationCap, BellOff,
} from 'lucide-react'
import { BarraAsistencia } from '../../components/BarraAsistencia'
import { formatGradoSeccion } from '../../lib/nivelAcademico'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { onPushRecibido, abrirAjustesNotificaciones } from '../../lib/pushNotifications'
import { obtenerUsuario } from '../../lib/auth'
import { abrirWhatsApp } from '../../lib/externo'
import { QK } from '../../lib/queryKeys'
import { SkeletonTarjetaHijo, SkeletonSaludo } from '../../components/Skeleton'

function IconWhatsApp({ size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ── config visual por estado del día ──────────────────────────────────────────
const HOY_CFG = {
  puntual:  { Icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200', label: 'Puntual hoy'      },
  especial: { Icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200', label: 'Puntual hoy'      },
  tardanza: { Icon: Clock,        color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200', label: 'Tardanza hoy'     },
  falta:    { Icon: XCircle,      color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200',   label: 'Falta registrada' },
  null:     { Icon: HelpCircle,   color: 'text-gray-400',  bg: 'bg-gray-50',   border: 'border-gray-200',  label: 'Sin datos hoy'    },
}

function pctTextColor(pct) {
  if (pct >= 90) return 'text-green-600'
  if (pct >= 70) return 'text-amber-600'
  return 'text-red-600'
}

// ── hook: carga datos de asistencias + observaciones de un hijo ───────────────
function useHijoDatos(hijoId) {
  const hoy    = new Date()
  const inicio = format(startOfMonth(hoy), 'yyyy-MM-dd')
  const fin    = format(endOfMonth(hoy),   'yyyy-MM-dd')
  const hoyStr = format(hoy, 'yyyy-MM-dd')
  const mesMes = hoy.getMonth() + 1
  const mesAnio = hoy.getFullYear()

  return useQuery({
    queryKey: QK.datosHijo(hijoId),
    queryFn: async () => {
      const [asistRes, obsRes, resumenRes] = await Promise.all([
        api.get(`/apoderado/hijo/${hijoId}/asistencias`, {
          params: { fecha_inicio: inicio, fecha_fin: fin },
        }),
        api.get(`/apoderado/hijo/${hijoId}/timeline`, {
          params: { tipo: 'observacion' },
        }).catch(() => ({ data: [] })),
        api.get(`/apoderado/hijo/${hijoId}/resumen-mes`, {
          params: { mes: mesMes, anio: mesAnio },
        }),
      ])

      const asistencias   = Array.isArray(asistRes.data) ? asistRes.data : []
      const observaciones = Array.isArray(obsRes.data)
        ? obsRes.data.filter(e => e.tipo === 'observacion')
        : []
      const resumen = resumenRes.data

      // mapa fecha → estado (solo ingresos) — para estado del día de hoy
      const mapa = {}
      asistencias
        .filter(r => r.tipo === 'ingreso' || r.tipo === 'ingreso_especial')
        .forEach(r => {
          const f = typeof r.fecha === 'string' ? r.fecha : format(new Date(r.fecha), 'yyyy-MM-dd')
          if (!mapa[f] || r.estado === 'tardanza') mapa[f] = r.estado
        })

      // estado de hoy: si no hay registro y es día laborable (L-V), es falta
      const hoyDow = new Date(hoyStr + 'T12:00:00').getDay()
      const estadoHoy = mapa[hoyStr] ?? (hoyDow >= 1 && hoyDow <= 5 ? 'falta' : null)
      const ingresoHoy = asistencias.find(r =>
        (r.tipo === 'ingreso' || r.tipo === 'ingreso_especial') &&
        (typeof r.fecha === 'string' ? r.fecha : format(new Date(r.fecha), 'yyyy-MM-dd')) === hoyStr
      )
      const horaIngreso = ingresoHoy?.hora
        ? format(parseISO(
            typeof ingresoHoy.hora === 'string' ? ingresoHoy.hora : ingresoHoy.hora.toISOString()
          ), 'HH:mm')
        : null

      return {
        estadoHoy,
        horaIngreso,
        pct:      resumen.pct,
        presentes: resumen.presentes,
        tardanzas: resumen.tardanzas,
        asistidos: resumen.asistidos,
        diasLab:   resumen.dias_lab,
        faltas:    resumen.faltas,
        observaciones,
      }
    },
    enabled: !!hijoId,
    staleTime: 30_000,
  })
}

// ── tarjeta por hijo ──────────────────────────────────────────────────────────
function TarjetaHijo({ hijo, comunicadosSinLeer, nav, onAlertChange }) {
  const { data: datos, isPending } = useHijoDatos(hijo.id)

  const { data: contactos } = useQuery({
    queryKey: QK.contactos(hijo.id),
    queryFn:  () => api.get(`/apoderado/hijo/${hijo.id}/contactos`).then(r => r.data),
    staleTime: 10 * 60_000,
  })

  const abrirTutor = () => {
    if (!contactos?.tutor?.telefono) return toast.error('El tutor no tiene número registrado')
    const { nombre, apellido } = contactos.tutor
    const msg = `Estimado/a Prof. ${nombre} ${apellido}, soy apoderado/a de *${hijo.nombre} ${hijo.apellido}* (${formatGradoSeccion(hijo.nivel, hijo.grado, hijo.seccion)} - ${hijo.nivel}). Le contacto para consultar...`
    abrirWhatsApp(contactos.tutor.telefono, msg)
  }

  const abrirAuxiliar = () => {
    if (!contactos?.auxiliar?.telefono) return toast.error('El auxiliar no tiene número registrado')
    const msg = `Hola, soy apoderado/a de *${hijo.nombre} ${hijo.apellido}* (${hijo.grado}° ${hijo.seccion} - ${hijo.nivel}). Le contacto respecto a la asistencia de mi hijo/a.`
    abrirWhatsApp(contactos.auxiliar.telefono, msg)
  }

  // Hooks siempre antes de cualquier return condicional
  const numObs       = datos?.observaciones?.length ?? 0
  const tieneAlertas = (datos?.faltas > 0) || (comunicadosSinLeer > 0) || (numObs > 0)

  useEffect(() => {
    if (!isPending) onAlertChange?.(hijo.id, tieneAlertas)
  }, [hijo.id, tieneAlertas, isPending, onAlertChange])

  if (isPending) return <SkeletonTarjetaHijo />

  const cfg = HOY_CFG[datos?.estadoHoy ?? 'null'] || HOY_CFG['null']
  const { Icon } = cfg

  // Urgencia → borde izquierdo de la card
  const urgencia  = tieneAlertas ? 'danger' : (datos?.tardanzas > 0) ? 'warning' : 'ok'
  const borderIzq = {
    danger:  'border-l-4 border-l-red-400',
    warning: 'border-l-4 border-l-amber-400',
    ok:      'border-l-4 border-l-green-400',
  }[urgencia]

  return (
    <div className={`card space-y-4 ${borderIzq}`}>

      {/* ── encabezado hijo ── */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-marino text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
          {hijo.nombre?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-marino truncate">{hijo.nombre} {hijo.apellido}</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
            <GraduationCap size={12} />
            <span className="capitalize">{hijo.nivel}</span>
            <span>·</span>
            <span>{formatGradoSeccion(hijo.nivel, hijo.grado, hijo.seccion)}</span>
          </div>
        </div>
        {/* Indicador de alerta activa */}
        {urgencia === 'danger' && (
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0 animate-pulse" />
        )}
        {urgencia === 'warning' && (
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
        )}
      </div>

      {datos ? (
        <>
          {/* ── estado de hoy ── */}
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${cfg.bg} ${cfg.border}`}>
            <Icon size={22} className={`flex-shrink-0 ${cfg.color}`} />
            <div className="flex-1">
              <p className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</p>
              {datos.horaIngreso && (
                <p className="text-xs text-gray-400">Ingreso registrado a las {datos.horaIngreso}</p>
              )}
            </div>
          </div>

          {/* ── progreso del mes ── */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500 font-medium capitalize">
                {format(new Date(), 'MMMM yyyy', { locale: es })}
              </p>
              <p className="text-xs font-bold text-gray-600">
                {datos.asistidos}/{datos.diasLab} días
              </p>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-2xl font-black ${pctTextColor(datos.pct)}`}>
                {datos.pct}%
              </span>
              <span className="text-xs text-gray-400">de asistencia</span>
            </div>

            <BarraAsistencia
              pct={datos.pct}
              diasLab={datos.diasLab}
              faltas={datos.faltas}
              size="sm"
            />

            {/* Chips de estadísticas del mes */}
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <div className="flex flex-col items-center gap-0.5 bg-green-50 border border-green-100 rounded-xl py-2">
                <CheckCircle2 size={13} className="text-green-500" />
                <span className="text-sm font-black text-green-700">{datos.presentes}</span>
                <span className="text-[10px] text-green-600 font-medium">presentes</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-amber-50 border border-amber-100 rounded-xl py-2">
                <Clock size={13} className="text-amber-500" />
                <span className="text-sm font-black text-amber-700">{datos.tardanzas}</span>
                <span className="text-[10px] text-amber-600 font-medium">tardanzas</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-red-50 border border-red-100 rounded-xl py-2">
                <XCircle size={13} className="text-red-500" />
                <span className="text-sm font-black text-red-700">{datos.faltas}</span>
                <span className="text-[10px] text-red-600 font-medium">faltas</span>
              </div>
            </div>
          </div>

          {/* ── alertas ── */}
          {tieneAlertas && (
            <div className="space-y-2 pt-1 border-t border-gray-100">

              {comunicadosSinLeer > 0 && (
                <button
                  onClick={() => nav('/apoderado/comunicados')}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 active:bg-indigo-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-700">
                      {comunicadosSinLeer === 1
                        ? '1 comunicado sin leer'
                        : `${comunicadosSinLeer} comunicados sin leer`}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-indigo-400" />
                </button>
              )}

              {datos.faltas > 0 && (
                <button
                  onClick={() => nav('/apoderado/justificar')}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700">
                      {datos.faltas === 1
                        ? '1 falta sin justificar'
                        : `${datos.faltas} faltas sin justificar`}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-amber-400" />
                </button>
              )}

              {numObs > 0 && (
                <button
                  onClick={() => nav('/apoderado/asistencias')}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 active:bg-orange-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className="text-orange-500" />
                    <span className="text-xs font-semibold text-orange-700">
                      {numObs === 1
                        ? '1 observación del tutor'
                        : `${numObs} observaciones del tutor`}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-orange-400" />
                </button>
              )}
            </div>
          )}

          {!tieneAlertas && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl">
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="text-xs font-semibold text-green-700">Todo en orden este mes</span>
            </div>
          )}
        </>
      ) : null}

      {/* ── Contacto rápido WhatsApp ── */}
      {contactos && (contactos.tutor || contactos.auxiliar) && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Contacto rápido
          </p>
          <div className="grid grid-cols-2 gap-2">
            {contactos.tutor && (
              <button
                onClick={abrirTutor}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl transition-colors text-xs font-semibold"
              >
                <IconWhatsApp size={14} />
                <span>Tutor</span>
                {!contactos.tutor.telefono && (
                  <span className="opacity-60 text-[10px]">(sin nro.)</span>
                )}
              </button>
            )}
            {contactos.auxiliar && (
              <button
                onClick={abrirAuxiliar}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl transition-colors text-xs font-semibold"
              >
                <IconWhatsApp size={14} />
                <span>Auxiliar</span>
                {!contactos.auxiliar.telefono && (
                  <span className="opacity-60 text-[10px]">(sin nro.)</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── página principal ──────────────────────────────────────────────────────────
export default function Inicio() {
  const nav         = useNavigate()
  const queryClient = useQueryClient()
  const usuario     = obtenerUsuario()

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = usuario?.nombre ? `, ${usuario.nombre}` : ''

  // ── contexto de hijo (compartido con todas las páginas del apoderado) ────
  const { hijos, hijoActivo, seleccionar, cargando: cargandoHijos } = useHijo()

  // Badge de alertas por hijo (solo para los dots del selector en esta página)
  const [alertasPorHijo, setAlertasPorHijo] = useState({})

  // Banner: notificaciones desactivadas en Ajustes del sistema
  const [notifDesactivadas, setNotifDesactivadas] = useState(false)

  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform?.()) return
    let capListener = null

    async function verificarNotif() {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        const { display } = await LocalNotifications.checkPermissions()
        setNotifDesactivadas(display === 'denied')
      } catch (_) {}
    }

    async function setupListener() {
      try {
        const { App: CapApp } = await import('@capacitor/app')
        capListener = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) verificarNotif()
        })
      } catch (_) {}
    }

    verificarNotif()
    setupListener()
    return () => { capListener?.remove().catch(() => {}) }
  }, [])

  const handleAlertChange = useCallback((id, tiene) => {
    setAlertasPorHijo(prev => {
      if (prev[id] === tiene) return prev
      return { ...prev, [id]: tiene }
    })
  }, [])

  // ── comunicados: mapa { estudianteId → sinLeer } para cada tarjeta ───────
  const { data: comsPorHijo = {} } = useQuery({
    queryKey: QK.comunicados,
    queryFn:  () => api.get('/apoderado/comunicados').then(r => {
      return Array.isArray(r.data) ? r.data : (r.data.items || [])
    }),
    staleTime: 60_000,
    select: (items) => {
      const map = {}
      items.forEach(c => {
        if (!c.leido && c.estudiante?.id) {
          map[c.estudiante.id] = (map[c.estudiante.id] || 0) + 1
        }
      })
      return map
    },
  })

  // ── push notifications → invalida queries en tiempo real ─────────────────
  useEffect(() => {
    onPushRecibido((data) => {
      if (data.tipo === 'asistencia' || data.tipo === 'falta') {
        toast.success('Asistencia actualizada')
        queryClient.invalidateQueries({ queryKey: ['apoderado', 'datos-hijo'] })
      } else if (data.tipo === 'comunicado') {
        toast.success('Nuevo comunicado recibido')
        queryClient.invalidateQueries({ queryKey: QK.comunicados })
      } else if (data.tipo === 'observacion') {
        toast.success('Nueva observación del tutor')
        queryClient.invalidateQueries({ queryKey: ['apoderado', 'datos-hijo'] })
      }
    })
    return () => onPushRecibido(null)
  }, [queryClient])

  if (cargandoHijos) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <SkeletonSaludo />
        <SkeletonTarjetaHijo />
        <SkeletonTarjetaHijo />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* ── Banner de bienvenida ── */}
      <div className="relative overflow-hidden rounded-2xl bg-marino px-6 py-5">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute top-6 right-52    w-14 h-14 rounded-full bg-dorado/20  pointer-events-none" />
        <div className="absolute -bottom-20 right-32 w-56 h-56 rounded-full bg-dorado/10  pointer-events-none" />
        <div className="absolute bottom-6 right-8  w-8  h-8  rounded-full bg-white/10  pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-xs capitalize tracking-wide mb-1">
              {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
            <h1 className="text-2xl font-black text-white leading-tight">
              {saludo},<br />
              <span className="text-dorado">{usuario?.nombre ? usuario.nombre.split(' ')[0] : 'Apoderado'}</span>
            </h1>
            <p className="mt-1.5 text-white/55 text-sm">
              {hijos.length === 1
                ? <>Apoderado de <span className="font-semibold text-white/80">{hijos[0].nombre}</span></>
                : hijos.length > 1
                  ? <>Apoderado de <span className="font-semibold text-white/80">{hijos.length} estudiantes</span></>
                  : 'Apoderado'}
            </p>
            <button
              onClick={() => nav('/apoderado/asistencias')}
              className="mt-3 inline-flex items-center gap-2 bg-dorado text-marino text-sm font-bold px-4 py-2 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-dorado/20"
            >
              Ver asistencias <ChevronRight size={14} />
            </button>
          </div>

          <div className="hidden sm:block flex-shrink-0 w-32 h-32 sm:w-44 sm:h-44 opacity-90 select-none pointer-events-none">
            <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="80" cy="85" r="62" fill="white" fillOpacity="0.04"/>
              <circle cx="60" cy="48" r="18" fill="#c9a227" fillOpacity="0.80"/>
              <path d="M58 40 Q60 34 62 40" fill="#0a1f3d" fillOpacity="0.40"/>
              <circle cx="54" cy="48" r="2" fill="#0a1f3d" fillOpacity="0.50"/>
              <circle cx="66" cy="48" r="2" fill="#0a1f3d" fillOpacity="0.50"/>
              <path d="M54 57 Q60 62 66 57" stroke="#0a1f3d" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <rect x="44" y="68" width="32" height="36" rx="8" fill="#c9a227" fillOpacity="0.55"/>
              <path d="M44 80 Q30 88 26 104" stroke="#c9a227" strokeWidth="7" strokeLinecap="round"/>
              <path d="M76 80 Q90 88 94 104" stroke="#c9a227" strokeWidth="7" strokeLinecap="round"/>
              <circle cx="104" cy="52" r="14" fill="#c9a227" fillOpacity="0.60"/>
              <rect x="94" y="68" width="24" height="28" rx="6" fill="#c9a227" fillOpacity="0.40"/>
              <rect x="24" y="108" width="68" height="9"  rx="4" fill="white" fillOpacity="0.08"/>
              <circle cx="32" cy="62" r="5" fill="white" fillOpacity="0.10"/>
              <circle cx="20" cy="80" r="3" fill="white" fillOpacity="0.07"/>
              <path d="M140 28 L142.5 35 L150 35 L144 39.5 L146.5 46.5 L140 42 L133.5 46.5 L136 39.5 L130 35 L137.5 35 Z"
                fill="#c9a227" fillOpacity="0.45"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Banner: notificaciones desactivadas ── */}
      {notifDesactivadas && (
        <button
          onClick={abrirAjustesNotificaciones}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-[0.98] transition-transform text-left"
          style={{ background: 'rgba(231,76,60,0.08)', border: '1.5px solid rgba(231,76,60,0.22)' }}
        >
          <BellOff size={17} style={{ color: '#e74c3c', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold leading-tight" style={{ color: '#c0392b' }}>
              Notificaciones desactivadas
            </p>
            <p className="text-xs leading-tight mt-0.5" style={{ color: 'rgba(192,57,43,0.75)' }}>
              No recibirás alertas de asistencia en tiempo real
            </p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: '#e74c3c', color: 'white' }}
          >
            Activar
          </span>
        </button>
      )}

      {/* ── selector de hijo (solo si hay más de uno) ── */}
      {hijos.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
          {hijos.map(h => {
            const activo    = h.id === hijoActivo?.id
            const sinLeer   = comsPorHijo[h.id] ?? 0
            const conAlerta = alertasPorHijo[h.id] || sinLeer > 0
            return (
              <button
                key={h.id}
                onClick={() => seleccionar(h.id)}
                className={`
                  relative flex flex-col items-center gap-1.5 flex-shrink-0
                  px-4 py-3 rounded-2xl transition-all duration-200
                  ${activo
                    ? 'bg-marino shadow-lg shadow-marino/20 scale-[1.03]'
                    : 'bg-white border border-gray-200 hover:border-marino/30 active:scale-95'}
                `}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className={`
                    w-11 h-11 rounded-full flex items-center justify-center
                    text-lg font-black select-none
                    ${activo ? 'bg-dorado text-marino' : 'bg-marino/10 text-marino'}
                  `}>
                    {h.nombre?.charAt(0).toUpperCase()}
                  </div>
                  {/* Badge de alerta */}
                  {conAlerta && (
                    <span className={`
                      absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2
                      ${activo ? 'border-marino' : 'border-white'}
                      bg-red-500
                    `} />
                  )}
                </div>
                {/* Nombre corto */}
                <span className={`
                  text-xs font-semibold max-w-[72px] truncate leading-none
                  ${activo ? 'text-white' : 'text-gray-600'}
                `}>
                  {h.nombre?.split(' ')[0]}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── tarjetas (todas montadas para cachear, solo visible la activa) ── */}
      {hijos.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          No tienes hijos registrados
        </div>
      ) : (
        hijos.map(h => (
          <div key={h.id} className={h.id === hijoActivo?.id ? 'block' : 'hidden'}>
            <TarjetaHijo
              hijo={h}
              comunicadosSinLeer={comsPorHijo[h.id] ?? 0}
              nav={nav}
              onAlertChange={handleAlertChange}
            />
          </div>
        ))
      )}

    </div>
  )
}
