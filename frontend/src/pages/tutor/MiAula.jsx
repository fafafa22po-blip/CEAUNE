import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Clock, X, HelpCircle, RefreshCw, ChevronRight, ChevronLeft,
  MessageCircle, Calendar, BarChart2, Search, AlertTriangle, Download,
  BookOpen, Phone, PhoneCall, UserCircle2, Heart,
} from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import { formatGradoSeccion } from '../../lib/nivelAcademico'
import { abrirWhatsApp } from '../../lib/externo'
import { obtenerUsuario } from '../../lib/auth'
import { SkeletonTutorEstudiantes, SkeletonTutorHistorial } from '../../components/Skeleton'
import toast from 'react-hot-toast'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADOS = {
  presente: { label: 'Presente',      dot: 'bg-green-500',  pill: 'bg-green-100 text-green-700',  avatar: 'bg-green-100 text-green-700',  border: 'border-l-green-500' },
  tardanza: { label: 'Tardanza',      dot: 'bg-amber-400',  pill: 'bg-amber-100 text-amber-700',  avatar: 'bg-amber-100 text-amber-700',  border: 'border-l-amber-400' },
  falta:    { label: 'Falta',         dot: 'bg-red-400',    pill: 'bg-red-100 text-red-700',      avatar: 'bg-red-100 text-red-700',      border: 'border-l-red-400'   },
  sin_dato: { label: 'Sin registrar', dot: 'bg-gray-300',   pill: 'bg-gray-100 text-gray-500',    avatar: 'bg-gray-100 text-gray-500',    border: 'border-l-gray-200'  },
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TIPOS_OBS = [
  { v: 'academica',  label: 'Académica'  },
  { v: 'conductual', label: 'Conductual' },
  { v: 'salud',      label: 'Salud'      },
  { v: 'logro',      label: 'Logro'      },
  { v: 'otro',       label: 'Otro'       },
]

const pctColor = (p) => p >= 90 ? 'text-green-600' : p >= 75 ? 'text-amber-600' : 'text-red-600'
const pctBg    = (p) => p >= 90 ? 'bg-green-100'   : p >= 75 ? 'bg-amber-100'   : 'bg-red-100'
const pctBar   = (p) => p >= 90 ? 'bg-green-500'   : p >= 75 ? 'bg-amber-400'   : 'bg-red-500'

// ─── Modal ficha del alumno ───────────────────────────────────────────────────

function FichaModal({ estudianteId, nombreCompleto, grado, seccion, onCerrar }) {
  const usuario = obtenerUsuario()
  const tutor   = `${usuario?.nombre} ${usuario?.apellido}`
  const queryClient = useQueryClient()

  const [tabModal,    setTabModal]    = useState('asistencia')
  const [formObs,     setFormObs]     = useState({ tipo: '', descripcion: '' })
  const [selectorWsp, setSelectorWsp] = useState(false)

  const { data: ficha, isLoading: cargandoFicha } = useQuery({
    queryKey: QK.tutorFicha(estudianteId),
    queryFn:  () => api.get(`/tutor/estudiante/${estudianteId}/ficha`).then(r => r.data),
  })

  const crearObs = useMutation({
    mutationFn: (payload) => api.post('/tutor/observaciones', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.tutorFicha(estudianteId) })
      queryClient.invalidateQueries({ queryKey: ['tutor', 'observaciones'] })
      setFormObs({ tipo: '', descripcion: '' })
    },
  })

  const handleWspClick = (e) => {
    e.preventDefault()
    if (!formObs.tipo || !formObs.descripcion.trim()) {
      toast.error('Completa el tipo y la descripción')
      return
    }
    const conTelefono = (ficha?.apoderados || []).filter(a => a.telefono)
    if (conTelefono.length === 0) {
      toast.error('El alumno no tiene apoderado con teléfono registrado')
      return
    }
    if (conTelefono.length === 1) enviarObsWsp(conTelefono[0])
    else setSelectorWsp(true)
  }

  const enviarObsWsp = async (apo) => {
    setSelectorWsp(false)
    try {
      await crearObs.mutateAsync({
        estudiante_id:      estudianteId,
        tipo:               formObs.tipo,
        descripcion:        formObs.descripcion.trim(),
        enviar_a_apoderado: true,
      })
      const tipoLabel = TIPOS_OBS.find(t => t.v === formObs.tipo)?.label || formObs.tipo
      const msg =
        `Estimado/a ${apo.nombre}, le informamos sobre *${nombreCompleto}* (${grado}° ${seccion}):\n\n` +
        `📋 *Observación — ${tipoLabel}*\n${formObs.descripcion.trim()}\n\n` +
        `_${tutor} — CEAUNE_`
      abrirWhatsApp(apo.telefono, msg)
      toast.success('Observación guardada y enviada por WhatsApp')
    } catch {
      toast.error('Error al guardar la observación')
    }
  }

  const wspGenerico = (apo) => {
    const msg = `Estimado/a ${apo.nombre}, le contactamos respecto a *${nombreCompleto}* (${grado}° ${seccion}).\n\n_${tutor} — CEAUNE_`
    abrirWhatsApp(apo.telefono, msg)
  }

  const stats = ficha ? {
    presentes: ficha.asistencia_30dias.filter(d => d.estado === 'presente').length,
    tardanzas: ficha.asistencia_30dias.filter(d => d.estado === 'tardanza').length,
    faltas:    ficha.asistencia_30dias.filter(d => d.estado === 'falta').length,
  } : null

  const buildGrid = (dias) => {
    if (!dias.length) return []
    const mapa = {}
    dias.forEach(d => { mapa[d.fecha] = d.estado })
    const sorted = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const inicio = parseISO(sorted[0].fecha)
    const fin    = parseISO(sorted[sorted.length - 1].fecha)
    const dow    = inicio.getDay()
    const primerLunes = addDays(inicio, dow === 0 ? -6 : 1 - dow)
    const semanas = []
    let cur = new Date(primerLunes)
    while (cur <= fin) {
      const fila = []
      for (let i = 0; i < 5; i++) {
        const dia  = addDays(cur, i)
        const dStr = format(dia, 'yyyy-MM-dd')
        fila.push({ fecha: dia, dStr, mes: dia.getMonth(), dia: dia.getDate(),
          estado: mapa[dStr] ?? null, enRango: dia >= inicio && dia <= fin })
      }
      semanas.push(fila)
      cur = addDays(cur, 7)
    }
    return semanas
  }

  const TABS_MODAL = [
    { id: 'asistencia',    label: 'Asistencia',   icon: Calendar    },
    { id: 'observaciones', label: 'Observaciones', icon: BookOpen    },
    { id: 'apoderados',    label: 'Apoderados',    icon: UserCircle2 },
    { id: 'salud',         label: 'Salud',         icon: Heart       },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-marino px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {nombreCompleto.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight truncate">{nombreCompleto}</p>
            <p className="text-white/60 text-xs mt-0.5">{grado}° {seccion}</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/15 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-gray-100 bg-gray-50 flex-shrink-0">
          {TABS_MODAL.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTabModal(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                tabModal === id ? 'border-marino text-marino bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        {cargandoFicha ? (
          <div className="flex-1 flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <span className="animate-spin w-4 h-4 border-2 border-marino/20 border-t-marino rounded-full" />
            Cargando...
          </div>
        ) : !ficha ? (
          <div className="flex-1 flex items-center justify-center py-12 text-gray-400 text-sm text-center px-6">
            No se pudo cargar la información del alumno.<br />
            <span className="text-xs mt-1 block">Intenta cerrando y volviendo a abrir.</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* ── Asistencia ── */}
            {tabModal === 'asistencia' && (() => {
              const semanas = buildGrid(ficha.asistencia_30dias)
              const DIAS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
              const CELDA = {
                presente: { bg: 'bg-green-100 hover:bg-green-200', text: 'text-green-800' },
                tardanza: { bg: 'bg-amber-100 hover:bg-amber-200', text: 'text-amber-800' },
                falta:    { bg: 'bg-red-100   hover:bg-red-200',   text: 'text-red-800'   },
              }
              let mesVisible = null
              return (
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Días presentes', value: stats.presentes, bg: 'bg-green-50', num: 'text-green-700' },
                      { label: 'Tardanzas',       value: stats.tardanzas, bg: 'bg-amber-50', num: 'text-amber-700' },
                      { label: 'Faltas',          value: stats.faltas,    bg: 'bg-red-50',   num: 'text-red-700'   },
                    ].map(({ label, value, bg, num }) => (
                      <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                        <p className={`text-2xl font-bold ${num}`}>{value}</p>
                        <p className="text-xs mt-0.5 text-gray-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Este mes</p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-1">
                        <thead>
                          <tr>
                            <th className="w-10" />
                            {DIAS.map(d => <th key={d} className="text-center text-xs font-semibold text-gray-400 pb-1 w-10">{d}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {semanas.map((semana, si) => {
                            const primerEnRango = semana.find(c => c.enRango)
                            const mesEstaFila   = primerEnRango?.mes
                            const mostrarMes    = mesEstaFila !== undefined && mesEstaFila !== mesVisible
                            if (mostrarMes) mesVisible = mesEstaFila
                            return (
                              <tr key={si}>
                                <td className="text-right pr-2 align-middle">
                                  {mostrarMes && (
                                    <span className="text-xs font-semibold text-marino/70 whitespace-nowrap">
                                      {format(semana.find(c => c.enRango && c.mes === mesEstaFila).fecha, 'MMM', { locale: es })}
                                    </span>
                                  )}
                                </td>
                                {semana.map((celda, ci) => {
                                  if (!celda.enRango) return <td key={ci} className="w-10 h-10" />
                                  const cfg = CELDA[celda.estado]
                                  return (
                                    <td key={ci} className="w-10 h-10">
                                      <div title={`${format(celda.fecha, "EEEE d 'de' MMMM", { locale: es })}\n${ESTADOS[celda.estado]?.label ?? 'Sin registro'}`}
                                        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center cursor-default transition-colors select-none ${cfg ? `${cfg.bg} ${cfg.text}` : 'bg-gray-100 text-gray-400'}`}>
                                        <span className="text-sm font-bold leading-none">{celda.dia}</span>
                                        <span className="text-[9px] leading-none mt-0.5 opacity-70">
                                          {celda.estado === 'presente' ? 'ok' : celda.estado === 'tardanza' ? 'tard' : celda.estado === 'falta' ? 'falta' : '—'}
                                        </span>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Observaciones ── */}
            {tabModal === 'observaciones' && (
              <div className="p-5 space-y-4">
                {ficha.observaciones_recientes.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-4">Sin observaciones registradas</p>
                ) : (
                  <div className="space-y-2">
                    {ficha.observaciones_recientes.map((o, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-marino/10 text-marino capitalize">{o.tipo}</span>
                          <span className="text-xs text-gray-400 ml-auto">{o.fecha}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{o.descripcion}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Nueva observación</p>
                  <form className="space-y-3">
                    <select className="input text-sm" value={formObs.tipo} onChange={e => setFormObs(f => ({ ...f, tipo: e.target.value }))}>
                      <option value="">Seleccionar tipo...</option>
                      {TIPOS_OBS.map(({ v, label }) => <option key={v} value={v}>{label}</option>)}
                    </select>
                    <textarea className="input text-sm resize-none" rows={3} placeholder="Describe la observación..."
                      value={formObs.descripcion} onChange={e => setFormObs(f => ({ ...f, descripcion: e.target.value }))} />
                    {selectorWsp && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-semibold text-green-800 flex items-center gap-1.5"><MessageCircle size={13} /> ¿A quién enviar?</p>
                        {ficha.apoderados.filter(a => a.telefono).map(apo => (
                          <button key={apo.id} type="button" onClick={() => enviarObsWsp(apo)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-colors text-left">
                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">{apo.nombre.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{apo.nombre}</p>
                              <p className="text-xs text-gray-400">+51 {apo.telefono}</p>
                            </div>
                            <MessageCircle size={14} className="text-green-500 flex-shrink-0" />
                          </button>
                        ))}
                        <button type="button" onClick={() => setSelectorWsp(false)} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center pt-1">Cancelar</button>
                      </div>
                    )}
                    {!selectorWsp && (
                      <button type="button" onClick={handleWspClick} disabled={crearObs.isPending}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                        {crearObs.isPending ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <MessageCircle size={15} />}
                        {crearObs.isPending ? 'Enviando...' : 'Guardar y comunicar por WhatsApp'}
                      </button>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* ── Salud ── */}
            {tabModal === 'salud' && (() => {
              const est = ficha?.estudiante
              const tieneDatos = est?.atencion_medica || est?.tiene_alergias || est?.condicion_mental_nee || est?.contacto_emergencia
              return (
                <div className="p-5 space-y-3">
                  {!tieneDatos ? (
                    <div className="text-center py-10 space-y-2">
                      <Heart size={32} className="text-gray-200 mx-auto" />
                      <p className="text-gray-400 text-sm">No presenta ninguna condición de salud registrada</p>
                    </div>
                  ) : (
                    <>
                      {est.atencion_medica && (
                        <div className="bg-sky-50 rounded-xl p-3.5">
                          <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">Atención médica</p>
                          <p className="text-sm text-gray-700 font-medium">{est.atencion_medica}</p>
                        </div>
                      )}
                      {est.tiene_alergias && (
                        <div className="bg-red-50 rounded-xl p-3.5">
                          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">⚠️ Alergias</p>
                          <p className="text-sm text-gray-700">{est.alergias_detalle || 'Alergias registradas (sin detalle)'}</p>
                        </div>
                      )}
                      {est.condicion_mental_nee && (
                        <div className="bg-purple-50 rounded-xl p-3.5">
                          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Salud mental / NEE</p>
                          <p className="text-sm text-gray-700">{est.condicion_mental_nee}</p>
                        </div>
                      )}
                      {est.contacto_emergencia && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5">
                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">📞 Contacto de emergencia</p>
                          <p className="text-sm text-gray-700">{est.contacto_emergencia}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}

            {/* ── Apoderados ── */}
            {tabModal === 'apoderados' && (
              <div className="p-5">
                {ficha.apoderados.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <UserCircle2 size={36} className="text-gray-200 mx-auto" />
                    <p className="text-gray-400 text-sm">Sin apoderados registrados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ficha.apoderados.map((apo, idx) => (
                      <div key={apo.id} className="rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-marino/10 text-marino flex items-center justify-center font-bold text-base flex-shrink-0">{apo.nombre.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{apo.nombre}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{idx === 0 ? 'Apoderado principal' : 'Apoderado secundario'}</p>
                          </div>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          {apo.telefono ? (
                            <div className="flex items-center gap-2 text-sm text-gray-700"><Phone size={13} className="text-gray-400 flex-shrink-0" /><span className="font-mono">+51 {apo.telefono}</span></div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-400"><Phone size={13} className="flex-shrink-0" /><span>Sin teléfono registrado</span></div>
                          )}
                        </div>
                        {apo.telefono && (
                          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                            <a href={`tel:+51${apo.telefono}`} className="flex items-center justify-center gap-2 py-2.5 bg-marino/10 hover:bg-marino/20 text-marino text-xs font-semibold rounded-xl transition-colors">
                              <PhoneCall size={13} /> Llamar
                            </a>
                            <button onClick={() => wspGenerico(apo)} className="flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-xl transition-colors">
                              <MessageCircle size={13} /> WhatsApp
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Esta semana ─────────────────────────────────────────────────────────

function TabHistorial() {
  const { data: historial, isLoading: cargandoHistorial } = useQuery({
    queryKey: QK.tutorHistorial(10),
    queryFn:  () => api.get('/tutor/mi-aula/historial', { params: { dias: 10 } }).then(r => r.data),
  })
  const { data: statsData } = useQuery({
    queryKey: ['tutor', 'estadisticas-full'],
    queryFn:  () => api.get('/tutor/mi-aula/estadisticas').then(r => r.data),
  })

  if (cargandoHistorial) return <SkeletonTutorHistorial />
  if (!historial) return (
    <div className="card flex items-center justify-center py-12 text-gray-400 text-sm text-center">
      No se pudo cargar el historial semanal.<br />
      <span className="text-xs mt-1 block">Actualiza la página e intenta de nuevo.</span>
    </div>
  )

  const statsMap = {}
  statsData?.estudiantes?.forEach(e => { statsMap[e.id] = e })

  const CELDA = {
    presente: { bg: 'bg-green-100', text: 'text-green-700', badge: 'ok' },
    tardanza: { bg: 'bg-amber-100', text: 'text-amber-700', badge: 'T'  },
    falta:    { bg: 'bg-red-100',   text: 'text-red-700',   badge: 'F'  },
  }

  const totalesDia = {}
  historial.fechas.forEach(f => {
    totalesDia[f] = historial.estudiantes.filter(e => e.dias[f] === 'presente' || e.dias[f] === 'tardanza').length
  })
  const totalAlumnos = historial.estudiantes.length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 flex-wrap">
        {[
          { bg: 'bg-green-100', text: 'text-green-700', label: 'Presente' },
          { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Tardanza' },
          { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Falta'    },
          { bg: 'bg-gray-100',  text: 'text-gray-400',  label: 'Sin dato' },
        ].map(({ bg, text, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-6 h-6 rounded-md inline-flex items-center justify-center ${bg}`}>
              <span className={`text-[9px] font-bold ${text}`}>14</span>
            </span>
            {label}
          </span>
        ))}
        {statsData && (
          <span className="ml-auto text-xs text-gray-400 hidden sm:block">
            <span className="font-semibold text-marino">% mes</span> = asistencia acumulada en {MESES[statsData.mes - 1]}
          </span>
        )}
      </div>

      <div className="card p-0 overflow-x-auto rounded-2xl">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="bg-marino">
              <th className="text-left pl-4 pr-3 py-3 text-white/70 font-semibold sticky left-0 bg-marino min-w-[170px] rounded-tl-2xl">Alumno</th>
              {historial.fechas.map((f, i) => (
                <th key={f} className={`px-1 py-3 text-center min-w-[44px] ${i === historial.fechas.length - 1 && !statsData ? 'rounded-tr-2xl' : ''}`}>
                  <div className="text-white/50 font-normal capitalize text-[10px] leading-none">{format(parseISO(f), 'EEE', { locale: es })}</div>
                  <div className="font-bold text-white text-sm leading-none mt-0.5">{format(parseISO(f), 'd')}</div>
                </th>
              ))}
              {statsData && <th className="px-3 py-3 text-center text-white/70 font-semibold min-w-[60px] rounded-tr-2xl">% mes</th>}
            </tr>
          </thead>
          <tbody>
            {historial.estudiantes.map((est, idx) => {
              const faltasSemana = historial.fechas.filter(f => est.dias[f] === 'falta').length
              const enRiesgo     = faltasSemana >= 2
              const estStats     = statsMap[est.id]
              const pct          = estStats?.porcentaje ?? null
              const rowBase      = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
              return (
                <tr key={est.id} className={`group transition-colors ${enRiesgo ? 'bg-red-50/60 hover:bg-red-50' : `${rowBase} hover:bg-blue-50/30`}`}>
                  <td className={`pl-4 pr-3 py-2 sticky left-0 transition-colors ${enRiesgo ? 'bg-red-50/60 group-hover:bg-red-50' : `${rowBase} group-hover:bg-blue-50/30`} border-b border-gray-100/80`}>
                    <div className="flex items-center gap-2">
                      {enRiesgo ? <AlertTriangle size={12} className="text-red-500 flex-shrink-0" /> : <div className="w-3 flex-shrink-0" />}
                      <span className={`font-medium truncate text-[12px] ${enRiesgo ? 'text-red-800' : 'text-gray-700'}`}>{est.apellido}, {est.nombre}</span>
                    </div>
                  </td>
                  {historial.fechas.map(f => {
                    const estado = est.dias[f]
                    const cfg    = CELDA[estado]
                    return (
                      <td key={f} className="px-1 py-1.5 text-center border-b border-gray-100/80">
                        <div title={`${format(parseISO(f), "EEEE d 'de' MMMM", { locale: es })} · ${ESTADOS[estado]?.label || 'Sin registro'}`}
                          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center mx-auto cursor-default select-none transition-transform hover:scale-105 ${cfg ? `${cfg.bg} ${cfg.text}` : 'bg-gray-100 text-gray-400'}`}>
                          <span className="text-[11px] font-bold leading-none">{format(parseISO(f), 'd')}</span>
                          <span className="text-[8px] leading-none mt-[2px] opacity-80">{cfg?.badge ?? '—'}</span>
                        </div>
                      </td>
                    )
                  })}
                  {statsData && (
                    <td className="px-3 py-2 text-center border-b border-gray-100/80">
                      {pct !== null ? (
                        <span className={`text-[11px] font-black tabular-nums px-2 py-1 rounded-lg inline-block ${pct >= 90 ? 'bg-green-100 text-green-700' : pct >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{pct}%</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr className="bg-marino/5">
              <td className="pl-4 pr-3 py-2.5 sticky left-0 bg-marino/5 rounded-bl-2xl">
                <span className="text-[10px] font-bold text-marino/50 uppercase tracking-widest">Asistieron</span>
              </td>
              {historial.fechas.map((f, i) => {
                const n   = totalesDia[f]
                const pct = Math.round((n / totalAlumnos) * 100)
                return (
                  <td key={f} className={`px-1 py-2.5 text-center ${i === historial.fechas.length - 1 && !statsData ? 'rounded-br-2xl' : ''}`}>
                    <span className={`text-xs font-black tabular-nums ${pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{n}</span>
                    <span className="text-[9px] text-gray-400 block leading-none mt-0.5">/{totalAlumnos}</span>
                  </td>
                )
              })}
              {statsData && <td className="rounded-br-2xl" />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Este mes ────────────────────────────────────────────────────────────

function TabEstadisticas() {
  const hoy = new Date()
  const [mes,  setMes]  = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear()

  const cambiarMes = (delta) => {
    let m = mes + delta, a = anio
    if (m > 12) { m = 1;  a++ }
    if (m < 1)  { m = 12; a-- }
    setMes(m); setAnio(a)
  }

  const { data, isLoading } = useQuery({
    queryKey: QK.tutorEstadisticas(mes, anio),
    queryFn:  () => api.get('/tutor/mi-aula/estadisticas', { params: { mes, anio } }).then(r => r.data),
  })

  const [cargandoPDF, setCargandoPDF] = useState(false)

  const exportarPDF = async () => {
    if (!data) return
    setCargandoPDF(true)
    try {
      const resp = await api.get('/tutor/mi-aula/estadisticas-pdf', {
        params: { mes, anio },
        responseType: 'blob',
        timeout: 40000,
      })
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a   = document.createElement('a')
      a.href     = url
      a.download = `Asistencia_${MESES[data.mes - 1]}${data.anio}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setCargandoPDF(false)
    }
  }

  if (isLoading) return (
    <div className="card flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
      <span className="animate-spin w-4 h-4 border-2 border-marino/20 border-t-marino rounded-full" />
      Cargando estadísticas...
    </div>
  )
  if (!data) return (
    <div className="card flex items-center justify-center py-12 text-gray-400 text-sm text-center">
      No se pudo cargar las estadísticas del mes.<br />
      <span className="text-xs mt-1 block">Actualiza la página e intenta de nuevo.</span>
    </div>
  )

  const total     = data.estudiantes.length
  const dt        = data.dias_transcurridos || 0
  const pctReal   = (e) => dt > 0 ? Math.round((dt - Math.min(e.faltas, dt)) / dt * 100) : 100
  const riesgo    = [...data.estudiantes].filter(e => pctReal(e) < 75).sort((a, b) => pctReal(a) - pctReal(b))
  const atencion  = [...data.estudiantes].filter(e => pctReal(e) >= 75 && pctReal(e) < 90).sort((a, b) => pctReal(a) - pctReal(b))
  const excelente = [...data.estudiantes].filter(e => pctReal(e) >= 90).sort((a, b) => pctReal(b) - pctReal(a))
  const sinFaltas = data.estudiantes.filter(e => e.faltas === 0).length
  const promedio  = total > 0 ? Math.round(data.estudiantes.reduce((s, e) => s + e.porcentaje, 0) / total) : 0

  const GrupoHeader = ({ emoji, label, count, colorText, colorBg }) => (
    <div className={`flex items-center justify-between px-4 py-2.5 ${colorBg} border-b border-gray-100`}>
      <div className="flex items-center gap-2">
        <span className="text-sm">{emoji}</span>
        <span className={`text-xs font-bold uppercase tracking-wider ${colorText}`}>{label}</span>
      </div>
      <span className={`text-xs font-semibold ${colorText} opacity-60`}>{count} alumno{count !== 1 ? 's' : ''}</span>
    </div>
  )

  const FilaEstudiante = ({ est }) => (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${pctBg(est.porcentaje)} ${pctColor(est.porcentaje)}`}>{est.apellido.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate leading-tight">{est.apellido}, {est.nombre}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[180px]">
            <div className={`h-2 rounded-full transition-all duration-500 ${pctBar(est.porcentaje)}`} style={{ width: `${est.porcentaje}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums">{est.presentes}P</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {est.tardanzas > 0 && <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">{est.tardanzas}T</span>}
        {est.faltas > 0    && <span className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">{est.faltas}F</span>}
        {est.faltas === 0 && est.tardanzas === 0 && <span className="bg-green-50 border border-green-200 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded-full">✓</span>}
      </div>
      <span className={`text-base font-black tabular-nums w-12 text-right flex-shrink-0 ${pctColor(est.porcentaje)}`}>{est.porcentaje}%</span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => cambiarMes(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-gray-500 transition-colors"><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold text-marino px-3 min-w-[140px] text-center">{MESES[data.mes - 1]} {data.anio}</span>
          <button onClick={() => cambiarMes(1)} disabled={esMesActual} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={15} /></button>
        </div>
        <button
          onClick={exportarPDF}
          disabled={cargandoPDF}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-marino border border-gray-200 hover:border-marino/30 px-3 py-2 rounded-xl transition-colors bg-white disabled:opacity-50"
        >
          {cargandoPDF
            ? <><span className="animate-spin w-3 h-3 border-2 border-marino/30 border-t-marino rounded-full" /> Generando...</>
            : <><Download size={13} /> Exportar PDF</>
          }
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card py-4 text-center space-y-1">
          <p className={`text-4xl font-black tabular-nums leading-none ${pctColor(promedio)}`}>{promedio}%</p>
          <p className="text-xs font-semibold text-gray-500">Promedio del aula</p>
          <p className="text-[10px] text-gray-400">{data.dias_laborables} días hábiles</p>
        </div>
        <div className={`card py-4 text-center space-y-1 ${riesgo.length > 0 ? 'border-red-200' : ''}`}>
          <p className={`text-4xl font-black tabular-nums leading-none ${riesgo.length > 0 ? 'text-red-600' : 'text-gray-300'}`}>{riesgo.length}</p>
          <p className="text-xs font-semibold text-gray-500">En riesgo</p>
          <p className="text-[10px] text-gray-400">menos de 75%</p>
        </div>
        <div className={`card py-4 text-center space-y-1 ${sinFaltas > 0 ? 'border-green-200' : ''}`}>
          <p className={`text-4xl font-black tabular-nums leading-none ${sinFaltas > 0 ? 'text-green-600' : 'text-gray-300'}`}>{sinFaltas}</p>
          <p className="text-xs font-semibold text-gray-500">Sin faltas</p>
          <p className="text-[10px] text-gray-400">asistencia perfecta</p>
        </div>
      </div>

      {riesgo.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <GrupoHeader emoji="🔴" label="En riesgo" count={riesgo.length} colorText="text-red-700" colorBg="bg-red-50" />
          {riesgo.map(est => <FilaEstudiante key={est.id} est={est} />)}
        </div>
      )}
      {atencion.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <GrupoHeader emoji="🟡" label="Necesitan atención" count={atencion.length} colorText="text-amber-700" colorBg="bg-amber-50" />
          {atencion.map(est => <FilaEstudiante key={est.id} est={est} />)}
        </div>
      )}
      {excelente.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <GrupoHeader emoji="🟢" label="Excelente asistencia" count={excelente.length} colorText="text-green-700" colorBg="bg-green-50" />
          {excelente.map(est => <FilaEstudiante key={est.id} est={est} />)}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MiAula() {
  const [tab,     setTab]     = useState('hoy')
  const [busqueda, setBusqueda] = useState('')
  const [filtro,   setFiltro]   = useState('')
  const [fichaId,  setFichaId]  = useState(null)
  const queryClient = useQueryClient()
  const usuario = obtenerUsuario()
  const tutor   = `${usuario?.nombre} ${usuario?.apellido}`

  const { data: aula } = useQuery({
    queryKey: QK.tutorAula,
    queryFn:  () => api.get('/tutor/mi-aula').then(r => r.data),
  })

  const { data: rawEstudiantes, isLoading, refetch } = useQuery({
    queryKey: QK.tutorEstudiantes(),
    queryFn:  () => api.get('/tutor/mi-aula/estudiantes').then(r => r.data?.estudiantes || []),
    refetchInterval: 30_000,
  })

  const { data: estadisticasData } = useQuery({
    queryKey: ['tutor', 'estadisticas-full'],
    queryFn:  () => api.get('/tutor/mi-aula/estadisticas').then(r => r.data),
  })

  const estudiantes = (rawEstudiantes || []).map(est => ({
    ...est,
    nombre_completo: `${est.nombre} ${est.apellido}`,
    estado: est.estado_dia ?? 'sin_dato',
    hora_ingreso: est.registros_hoy?.find(r => r.tipo === 'ingreso' || r.tipo === 'ingreso_especial')?.hora?.slice(11, 16) ?? null,
  }))

  const alertaRiesgo = estadisticasData?.estudiantes?.filter(e => e.porcentaje < 75).length || 0

  const filtrados = estudiantes.filter(e => {
    const okFiltro   = !filtro   || e.estado === filtro
    const okBusqueda = !busqueda || e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
    return okFiltro && okBusqueda
  })

  const conteo = {
    presente: estudiantes.filter(e => e.estado === 'presente').length,
    tardanza: estudiantes.filter(e => e.estado === 'tardanza').length,
    falta:    estudiantes.filter(e => e.estado === 'falta').length,
    sin_dato: estudiantes.filter(e => !e.estado || e.estado === 'sin_dato').length,
  }

  const estudianteFicha = fichaId ? estudiantes.find(e => e.id === fichaId) : null
  const fechaHoy = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })

  if (isLoading && !rawEstudiantes) return <SkeletonTutorEstudiantes />

  return (
    <>
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="bg-marino rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-white/50 text-xs capitalize tracking-wide">{fechaHoy}</p>
          <h1 className="text-white font-bold text-xl mt-0.5">
            {aula ? formatGradoSeccion(aula.nivel, aula.grado, aula.seccion) : 'Mi Aula'}
            <span className="ml-2 text-white/40 font-normal text-sm capitalize">· {aula?.nivel}</span>
          </h1>
          <p className="text-white/40 text-xs mt-0.5">{estudiantes.length} alumnos</p>
        </div>
        <button onClick={() => refetch()} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" title="Actualizar datos">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'hoy',          icon: Users,    label: 'Hoy'         },
          { id: 'historial',    icon: Calendar, label: 'Esta semana' },
          { id: 'estadisticas', icon: BarChart2, label: 'Este mes'   },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-white text-marino shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab Hoy ── */}
      {tab === 'hoy' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'presente', label: 'Presentes',     Icon: Users,      numCls: 'text-green-700', border: 'border-l-green-500', iconCls: 'text-green-400' },
              { key: 'tardanza', label: 'Tardanzas',     Icon: Clock,      numCls: 'text-amber-700', border: 'border-l-amber-400', iconCls: 'text-amber-400' },
              { key: 'falta',    label: 'Faltas',        Icon: X,          numCls: 'text-red-700',   border: 'border-l-red-400',   iconCls: 'text-red-400'   },
              { key: 'sin_dato', label: 'Sin registrar', Icon: HelpCircle, numCls: 'text-gray-600',  border: 'border-l-gray-200',  iconCls: 'text-gray-300'  },
            ].map(({ key, label, Icon, numCls, border, iconCls }) => (
              <button key={key} onClick={() => setFiltro(filtro === key ? '' : key)}
                className={`card border-l-4 ${border} text-left transition-all hover:shadow-md ${filtro === key ? 'ring-2 ring-dorado ring-offset-1' : ''}`}>
                <Icon size={17} className={`${iconCls} mb-2`} />
                <p className={`text-3xl font-bold ${numCls}`}>{conteo[key]}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </button>
            ))}
          </div>

          {alertaRiesgo > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{alertaRiesgo} alumno{alertaRiesgo !== 1 ? 's' : ''} con asistencia crítica este mes</p>
                <p className="text-xs text-amber-600 mt-0.5">Menos del 75% — ve a <strong>Este mes</strong> para ver el detalle</p>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input className="input pl-9 text-sm" placeholder="Buscar alumno por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {filtro ? <span className="font-medium text-marino">{ESTADOS[filtro]?.label}</span> : 'Todos'}
                  {' · '}<span className="font-medium">{filtrados.length}</span> alumnos
                </p>
                {(filtro || busqueda) && (
                  <button onClick={() => { setFiltro(''); setBusqueda('') }} className="text-xs text-dorado hover:underline">Limpiar</button>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {filtrados.map(est => {
                const cfg = ESTADOS[est.estado] || ESTADOS.sin_dato
                return (
                  <button key={est.id} onClick={() => setFichaId(est.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 text-left transition-colors group">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg.avatar}`}>{est.nombre_completo?.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{est.apellido}, {est.nombre}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {est.hora_ingreso && (
                        <span className="text-xs text-gray-400 hidden sm:flex items-center gap-1"><Clock size={11} /> {est.hora_ingreso}</span>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.pill}`}>{cfg.label}</span>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                    </div>
                  </button>
                )
              })}
              {filtrados.length === 0 && (
                <div className="text-center text-gray-400 py-10 text-sm">
                  {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin alumnos en esta categoría'}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'historial'    && <TabHistorial />}
      {tab === 'estadisticas' && <TabEstadisticas />}

    </div>

    {fichaId && estudianteFicha && (
      <FichaModal
        estudianteId={fichaId}
        nombreCompleto={estudianteFicha.nombre_completo}
        grado={aula?.grado}
        seccion={aula?.seccion}
        onCerrar={() => setFichaId(null)}
        tutor={tutor}
      />
    )}
    </>
  )
}
