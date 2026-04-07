import { useState, useEffect } from 'react'
import { abrirWhatsApp } from '../../lib/externo'
import {
  Users, Clock, X, CheckCircle, LogOut, RefreshCw,
  Mail, MailX, AlertTriangle, Phone, Copy,
  ArrowLeft, ChevronRight, ChevronLeft, CalendarDays,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

// ─── Constantes ───────────────────────────────────────────────────────────────
const MOTIVO_LABEL = {
  marcha:                  'Marcha / Movilización',
  juegos_deportivos:       'Juegos deportivos',
  enfermedad:              'Enfermedad / Malestar',
  permiso_apoderado:       'Permiso del apoderado',
  actividad_institucional: 'Actividad institucional',
  tardanza_justificada:    'Tardanza justificada',
  otro:                    'Otro motivo',
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_CORTO = ['Lu','Ma','Mi','Ju','Vi']

const ESTADO_CFG = {
  puntual:      { label: 'Puntual',  badge: 'badge-verde',    rowBg: '',                avatarBg: 'bg-green-100 text-green-700'   },
  tardanza:     { label: 'Tardanza', badge: 'badge-amarillo', rowBg: 'bg-yellow-50/60', avatarBg: 'bg-yellow-100 text-yellow-700' },
  falta:        { label: 'Falta',    badge: 'badge-rojo',     rowBg: 'bg-red-50/60',    avatarBg: 'bg-red-100 text-red-700'       },
  especial:     { label: 'Especial', badge: 'badge-naranja',  rowBg: 'bg-orange-50/60', avatarBg: 'bg-orange-100 text-orange-700' },
}

const ESTADO_CELL = {
  puntual:      { bg: 'bg-green-100 text-green-700',   short: 'P'  },
  tardanza:     { bg: 'bg-yellow-100 text-yellow-700', short: 'T'  },
  falta:        { bg: 'bg-red-100 text-red-700',       short: 'F'  },
  especial:     { bg: 'bg-orange-100 text-orange-700', short: 'E'  },
}

const CARDS = [
  { key: 'asistencia', label: 'Asistencia',  icon: CheckCircle, bg: 'bg-green-500'  },
  { key: 'tardanzas',  label: 'Tardanzas',   icon: Clock,       bg: 'bg-yellow-400' },
  { key: 'faltas',     label: 'Faltas',      icon: X,           bg: 'bg-red-500'    },
  { key: 'con_salida', label: 'Con salida',  icon: LogOut,      bg: 'bg-blue-500'   },
  { key: 'total',      label: 'Total',       icon: Users,       bg: 'bg-marino'     },
]

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
const fmtISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const esHoy = (d) => fmtISO(d) === fmtISO(new Date())

// Lunes a viernes de la semana que contiene `d`
const diasDeSemana = (d) => {
  const base = new Date(d)
  const dow = base.getDay()
  base.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(base)
    x.setDate(base.getDate() + i)
    return x
  })
}

// Último día del mes (o hoy si es el mes actual)
const finDeMes = (d) => {
  const hoy = new Date()
  const mismoMes = d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()
  if (mismoMes) return hoy
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

const labelNavegacion = (d, modo) => {
  if (modo === 'dia') {
    if (esHoy(d)) return 'Hoy'
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
    if (fmtISO(d) === fmtISO(ayer)) return 'Ayer'
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (modo === 'semana') {
    const dias = diasDeSemana(d)
    const ini = dias[0], fin = dias[4]
    if (ini.getMonth() === fin.getMonth())
      return `${ini.getDate()} – ${fin.getDate()} ${MESES[ini.getMonth()]} ${ini.getFullYear()}`
    return `${ini.getDate()} ${MESES[ini.getMonth()].slice(0,3)} – ${fin.getDate()} ${MESES[fin.getMonth()].slice(0,3)} ${fin.getFullYear()}`
  }
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

const avanzar = (d, modo, dir) => {
  const x = new Date(d)
  if (modo === 'dia')    x.setDate(x.getDate() + dir)
  if (modo === 'semana') x.setDate(x.getDate() + dir * 7)
  if (modo === 'mes')    x.setMonth(x.getMonth() + dir)
  return x
}

// ─── Icono WhatsApp ───────────────────────────────────────────────────────────
function IconWhatsApp({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ─── Calendario mensual (modal perfil) ────────────────────────────────────────
// `estados` es el dict { "yyyy-MM-dd": "falta"|"puntual"|"tardanza"|"especial" }
// que devuelve el servicio canónico del backend.
function CalendarioMes({ estados = {}, mes, anio }) {
  const hoy       = new Date()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const offset    = (new Date(anio, mes, 1).getDay() + 6) % 7
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map((d, i) => (
          <div key={i} className={`text-center text-[11px] font-bold py-1 ${i >= 5 ? 'text-gray-300' : 'text-gray-400'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: diasEnMes }).map((_, i) => {
          const dia      = i + 1
          const fechaStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
          const fecha    = new Date(anio, mes, dia)
          const esFin    = fecha.getDay() === 0 || fecha.getDay() === 6
          const esFuturo = fecha > hoy
          const esHoyD   = fecha.toDateString() === hoy.toDateString()
          const estado   = estados[fechaStr]
          const cellCfg  = ESTADO_CELL[estado]
          let cls = esFuturo ? 'bg-gray-50 text-gray-300' : esFin ? 'bg-gray-50 text-gray-200' : cellCfg ? cellCfg.bg : 'bg-gray-100 text-gray-400'
          return (
            <div key={dia} title={fechaStr}
              className={`rounded-lg aspect-square flex items-center justify-center text-xs font-semibold ${cls} ${esHoyD ? 'ring-2 ring-marino ring-offset-1' : ''}`}>
              {dia}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(ESTADO_CELL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${v.bg}`} />
            <span className="text-[11px] text-gray-400">{ESTADO_CFG[k]?.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Modal perfil ─────────────────────────────────────────────────────────────
const TAGS = [
  { id: 'conflicto', label: '😤 Conflicto',  msg: 'Se observó una situación de conflicto.' },
  { id: 'llanto',    label: '😢 Llanto',      msg: 'El alumno presentó llanto durante el día.' },
  { id: 'salud',     label: '🤒 Salud',       msg: 'Se observaron signos de malestar o salud.' },
  { id: 'agresivo',  label: '😠 Agresividad', msg: 'Se detectó comportamiento agresivo.' },
  { id: 'positivo',  label: '✅ Positivo',    msg: 'El alumno tuvo un comportamiento destacado.' },
]

function ModalPerfil({ estudiante, estadoDia, onClose, nav }) {
  const [paso, setPaso]         = useState(1)
  const [perfil, setPerfil]     = useState(null)
  const [resumen, setResumen]   = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tagActivo, setTagActivo] = useState(null)
  const [motivo, setMotivo]     = useState('')

  const cfg = ESTADO_CFG[estadoDia] || ESTADO_CFG.puntual

  useEffect(() => {
    Promise.all([
      api.get(`/asistencia/perfil-alumno/${estudiante.id}`),
      api.get(`/asistencia/estudiante/${estudiante.id}/resumen-mes`),
    ])
      .then(([pRes, rRes]) => { setPerfil(pRes.data); setResumen(rRes.data) })
      .catch(() => toast.error('Error al cargar perfil'))
      .finally(() => setCargando(false))
  }, [estudiante.id])

  const copiar  = (tel) => { navigator.clipboard.writeText(`+51${tel}`); toast.success('Número copiado') }
  const abrirWA = (tel) => {
    const tagMsg = tagActivo ? TAGS.find(t => t.id === tagActivo)?.msg || '' : ''
    const extras = [tagMsg, motivo.trim()].filter(Boolean).join('\n')
    abrirWhatsApp(tel,
      `Estimado/a apoderado/a,\nLe contactamos respecto a *${estudiante.nombre} ${estudiante.apellido}* ` +
      `(${estudiante.grado} - Sección ${estudiante.seccion}).` +
      (extras ? `\n\n${extras}` : '') + `\n\n_Colegio CEAUNE_`)
  }

  // Datos del resumen canónico (mismo servicio que apoderado)
  const pctMes  = resumen?.pct       ?? 100
  const faltMes = resumen?.faltas    ?? 0
  const tarMes  = resumen?.tardanzas ?? 0
  const tieneAlerta = tarMes >= 3 || faltMes >= 3

  const ahora      = new Date()
  const mesActual  = ahora.getMonth()
  const anioActual = ahora.getFullYear()

  const apoderados  = perfil?.apoderados || []
  const conTelefono = apoderados.filter(a => a.telefono)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {paso === 1 ? (
          <>
            <div className="flex-shrink-0 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg.avatarBg}`}>
                    {estudiante.nombre?.[0]}{estudiante.apellido?.[0]}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-marino text-base leading-tight truncate">{estudiante.nombre} {estudiante.apellido}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{estudiante.grado} · Sec. {estudiante.seccion} · DNI {estudiante.dni || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cfg.badge}>{cfg.label}</span>
                  <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumen del mes</p>
                {tieneAlerta && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700 font-medium">Patrón de inasistencia detectado este mes</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`rounded-xl p-3 text-center ${pctMes < 75 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                    <p className={`text-2xl font-bold ${pctMes < 75 ? 'text-red-600' : 'text-green-600'}`}>{pctMes}%</p>
                    <p className="text-[11px] mt-0.5 text-gray-500 font-medium">asistencia</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${tarMes >= 3 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                    <p className={`text-2xl font-bold ${tarMes >= 3 ? 'text-yellow-700' : 'text-marino'}`}>{tarMes}</p>
                    <p className={`text-[11px] mt-0.5 font-medium ${tarMes >= 3 ? 'text-yellow-600' : 'text-gray-400'}`}>tardanza{tarMes !== 1 ? 's' : ''}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${faltMes >= 3 ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <p className={`text-2xl font-bold ${faltMes >= 3 ? 'text-red-700' : 'text-marino'}`}>{faltMes}</p>
                    <p className={`text-[11px] mt-0.5 font-medium ${faltMes >= 3 ? 'text-red-600' : 'text-gray-400'}`}>falta{faltMes !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Asistencia — {MESES[mesActual]} {anioActual}
                </p>
                {cargando
                  ? <div className="flex items-center justify-center h-32 gap-2 text-gray-400 text-sm"><span className="animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />Cargando...</div>
                  : <CalendarioMes estados={resumen?.estados ?? {}} mes={mesActual} anio={anioActual} />}
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
              <button onClick={() => setPaso(2)} className="w-full flex items-center justify-center gap-2 py-3 bg-marino text-white font-semibold rounded-xl hover:bg-marino/90 text-sm">
                <Phone size={15} /> Contactar apoderado <ChevronRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-shrink-0 border-b border-gray-100 px-5 py-4 flex items-center gap-3">
              <button onClick={() => setPaso(1)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-marino hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} /></button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-marino text-sm">Contactar apoderado</p>
                <p className="text-xs text-gray-400 truncate">{estudiante.nombre} {estudiante.apellido}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">¿Qué le comunicas?</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(t => (
                    <button key={t.id} onClick={() => setTagActivo(p => p === t.id ? null : t.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${tagActivo === t.id ? 'bg-marino text-white border-marino' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-marino/20 focus:border-marino bg-gray-50" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Escribe el motivo de contacto..." />
                {!cargando && conTelefono.map(apo => (
                  <button key={apo.id} onClick={() => abrirWA(apo.telefono)} className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl text-sm">
                    <IconWhatsApp size={17} /> {conTelefono.length > 1 ? `Enviar a ${apo.nombre}` : 'Enviar por WhatsApp'}
                  </button>
                ))}
              </div>
              {cargando
                ? <div className="flex items-center justify-center h-20 gap-2 text-gray-400 text-sm"><span className="animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />Cargando...</div>
                : apoderados.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Sin apoderados registrados</p>
                : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Otras opciones</p>
                    {apoderados.map(apo => (
                      <div key={apo.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-marino flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{apo.nombre?.[0]}{apo.apellido?.[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-marino leading-none truncate">{apo.nombre} {apo.apellido}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{apo.email || 'Apoderado'}</p>
                        </div>
                        {apo.telefono ? (
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => copiar(apo.telefono)} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-marino" title="Copiar"><Copy size={13} /></button>
                            <a href={`tel:+51${apo.telefono}`} className="w-8 h-8 flex items-center justify-center bg-blue-50 border border-blue-100 rounded-lg text-blue-600 hover:bg-blue-100" title="Llamar"><Phone size={13} /></a>
                          </div>
                        ) : <span className="text-xs text-gray-300">Sin número</span>}
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
              <button onClick={() => { nav(`/auxiliar/comunicar?estudianteId=${estudiante.id}`); onClose() }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-marino text-marino text-sm font-semibold rounded-xl hover:bg-marino hover:text-white transition-colors">
                <Mail size={15} /> Enviar comunicado formal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Vista Semana ─────────────────────────────────────────────────────────────
function VistaSemana({ semanaData, dias, onSelectEstudiante }) {
  // Construir lista unificada de alumnos y sus estados por día
  const estudiantesMap = {}
  dias.forEach((dia, idx) => {
    const key = fmtISO(dia)
    const registros = semanaData[key] || []
    registros.forEach(r => {
      const id = r.estudiante?.id
      if (!id) return
      if (!estudiantesMap[id]) estudiantesMap[id] = { estudiante: r.estudiante, dias: {}, tardanzasMes: r.tardanzas_mes ?? 0, faltasMes: r.faltas_mes ?? 0 }
      estudiantesMap[id].dias[key] = r.estado_dia
    })
  })

  const filas = Object.values(estudiantesMap).sort((a, b) =>
    `${a.estudiante.apellido} ${a.estudiante.nombre}`.localeCompare(`${b.estudiante.apellido} ${b.estudiante.nombre}`)
  )

  const hoy = new Date()

  if (filas.length === 0)
    return <div className="card text-center py-16 text-gray-400"><Users size={28} className="mx-auto mb-2 text-gray-300" />Sin datos para esta semana</div>

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Alumno</th>
            {dias.map((dia, i) => {
              const esHoyCol = fmtISO(dia) === fmtISO(hoy)
              const esFuturo = dia > hoy
              return (
                <th key={i} className={`text-center text-xs font-semibold uppercase tracking-wide px-3 py-3 ${esHoyCol ? 'text-marino' : esFuturo ? 'text-gray-200' : 'text-gray-400'}`}>
                  <div>{DIAS_CORTO[i]}</div>
                  <div className={`text-[10px] font-normal mt-0.5 ${esHoyCol ? 'text-marino font-bold' : ''}`}>{dia.getDate()}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ estudiante, dias: estadosDia, tardanzasMes, faltasMes }) => {
            const tieneAlerta = tardanzasMes >= 3 || faltasMes >= 3
            return (
              <tr key={estudiante.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onSelectEstudiante({ estudiante, estado_dia: estadosDia[fmtISO(new Date())] || 'falta', tardanzas_mes: tardanzasMes, faltas_mes: faltasMes })}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800 text-sm">{estudiante.nombre} {estudiante.apellido}</p>
                    {tieneAlerta && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{estudiante.grado}° {estudiante.seccion}</p>
                </td>
                {dias.map((dia, i) => {
                  const key = fmtISO(dia)
                  const estado = estadosDia[key]
                  const esFuturo = dia > hoy
                  const cell = ESTADO_CELL[estado]
                  return (
                    <td key={i} className="px-2 py-3 text-center">
                      {esFuturo
                        ? <span className="text-gray-200 text-xs">—</span>
                        : cell
                        ? <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${cell.bg}`}>{cell.short}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-50">
        {Object.entries(ESTADO_CELL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${v.bg}`}>{v.short}</span>
            <span className="text-[11px] text-gray-400">{ESTADO_CFG[k]?.label || k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vista Mes ────────────────────────────────────────────────────────────────
function VistaMes({ lista, mes, anio, onSelectEstudiante }) {
  const [ordenPor, setOrdenPor] = useState('apellido')

  const hoy = new Date()
  const diasLab = (() => {
    const fin = mes === hoy.getMonth() && anio === hoy.getFullYear() ? hoy.getDate() : new Date(anio, mes + 1, 0).getDate()
    let c = 0
    for (let d = 1; d <= fin; d++) { const dw = new Date(anio, mes, d).getDay(); if (dw !== 0 && dw !== 6) c++ }
    return c
  })()

  const filas = [...lista].map(r => ({
    ...r,
    pct: diasLab > 0 ? Math.round(((diasLab - (r.faltas_mes ?? 0)) / diasLab) * 100) : 100,
  })).sort((a, b) => {
    if (ordenPor === 'faltas')   return (b.faltas_mes ?? 0) - (a.faltas_mes ?? 0)
    if (ordenPor === 'tardanzas') return (b.tardanzas_mes ?? 0) - (a.tardanzas_mes ?? 0)
    if (ordenPor === 'pct')      return a.pct - b.pct
    return `${a.estudiante?.apellido} ${a.estudiante?.nombre}`.localeCompare(`${b.estudiante?.apellido} ${b.estudiante?.nombre}`)
  })

  const ColHeader = ({ label, campo }) => (
    <th
      onClick={() => setOrdenPor(campo)}
      className={`text-right text-xs font-semibold uppercase tracking-wide px-4 py-3 cursor-pointer select-none ${ordenPor === campo ? 'text-marino' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {label} {ordenPor === campo ? '↓' : ''}
    </th>
  )

  if (filas.length === 0)
    return <div className="card text-center py-16 text-gray-400"><Users size={28} className="mx-auto mb-2 text-gray-300" />Sin datos para este mes</div>

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Alumno</th>
            <ColHeader label="% Asist."   campo="pct"       />
            <ColHeader label="Tardanzas"  campo="tardanzas" />
            <ColHeader label="Faltas"     campo="faltas"    />
          </tr>
        </thead>
        <tbody>
          {filas.map(({ estudiante, tardanzas_mes, faltas_mes, pct, estado_dia }) => {
            const tieneAlerta = (tardanzas_mes ?? 0) >= 3 || (faltas_mes ?? 0) >= 3
            const pctBajo     = pct < 75
            return (
              <tr key={estudiante?.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onSelectEstudiante({ estudiante, estado_dia: estado_dia || 'falta', tardanzas_mes: tardanzas_mes ?? 0, faltas_mes: faltas_mes ?? 0 })}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800">{estudiante?.nombre} {estudiante?.apellido}</p>
                    {tieneAlerta && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{estudiante?.grado}° {estudiante?.seccion}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold text-sm ${pctBajo ? 'text-red-600' : 'text-green-600'}`}>{pct}%</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold ${(tardanzas_mes ?? 0) >= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                    {tardanzas_mes ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold ${(faltas_mes ?? 0) >= 3 ? 'text-red-600' : 'text-gray-600'}`}>
                    {faltas_mes ?? 0}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-50">
        {diasLab} días laborables en {MESES[mes]} {anio} · Toca una columna para ordenar
      </p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Asistencia() {
  const nav = useNavigate()

  // Navegación temporal
  const [modo, setModo]         = useState('dia')        // 'dia' | 'semana' | 'mes'
  const [fechaRef, setFechaRef] = useState(new Date())

  // Datos vista día
  const [datos, setDatos]         = useState(null)
  const [lista, setLista]         = useState([])

  // Datos vista semana: { [fechaISO]: RegistroDia[] }
  const [semanaData, setSemanaData] = useState({})

  // Filtros (solo vista día)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroGrado, setFiltroGrado]   = useState('')

  // Modal perfil
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando, setCargando]         = useState(true)

  // ── Carga de datos ──────────────────────────────────────────────────────────
  const cargarDia = async (fecha) => {
    setCargando(true)
    try {
      const f = fmtISO(fecha)
      const [resumen, detalle] = await Promise.all([
        api.get('/asistencia/hoy/resumen', { params: { fecha: f } }),
        api.get('/asistencia/hoy',         { params: { fecha: f } }),
      ])
      setDatos(resumen.data)
      setLista(detalle.data)
    } catch {
      toast.error('Error al cargar asistencia')
    } finally {
      setCargando(false)
    }
  }

  const cargarSemana = async (fecha) => {
    setCargando(true)
    try {
      const dias = diasDeSemana(fecha)
      const responses = await Promise.all(
        dias.map(d => api.get('/asistencia/hoy', { params: { fecha: fmtISO(d) } }).then(r => ({ fecha: fmtISO(d), data: r.data })))
      )
      const mapa = {}
      responses.forEach(({ fecha, data }) => { mapa[fecha] = data })
      setSemanaData(mapa)
    } catch {
      toast.error('Error al cargar semana')
    } finally {
      setCargando(false)
    }
  }

  const cargarMes = async (fecha) => {
    setCargando(true)
    try {
      const fin = finDeMes(fecha)
      const detalle = await api.get('/asistencia/hoy', { params: { fecha: fmtISO(fin) } })
      setLista(detalle.data)
    } catch {
      toast.error('Error al cargar mes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    setFiltroEstado('')
    setFiltroGrado('')
    if (modo === 'dia')    cargarDia(fechaRef)
    if (modo === 'semana') cargarSemana(fechaRef)
    if (modo === 'mes')    cargarMes(fechaRef)
  }, [modo, fechaRef.toDateString()])

  // ── Cambio de modo: resetear fechaRef a hoy ─────────────────────────────────
  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo)
    setFechaRef(new Date())
  }

  // ── Conteos para tabs (vista día) ───────────────────────────────────────────
  const conteo = {
    puntual:      lista.filter(a => a.estado_dia === 'puntual').length,
    tardanza:     lista.filter(a => a.estado_dia === 'tardanza').length,
    falta:        lista.filter(a => a.estado_dia === 'falta').length,
    especial:     lista.filter(a => a.estado_dia === 'especial' || a.salida?.tipo?.includes('especial')).length,
  }
  const grados        = [...new Set(lista.map(a => a.estudiante?.grado).filter(Boolean))].sort()
  const listaFiltrada = lista.filter(a => {
    if (filtroEstado === 'especial' && !(a.estado_dia === 'especial' || a.salida?.tipo?.includes('especial'))) return false
    if (filtroEstado && filtroEstado !== 'especial' && a.estado_dia !== filtroEstado) return false
    if (filtroGrado  && a.estudiante?.grado !== filtroGrado) return false
    return true
  })
  const porcentaje = datos && datos.total_estudiantes > 0
    ? Math.round(((datos.puntuales + datos.tardanzas) / datos.total_estudiantes) * 100) : 0

  const valorCard = (key) => {
    if (key === 'asistencia') return `${porcentaje}%`
    if (key === 'tardanzas')  return datos?.tardanzas         ?? 0
    if (key === 'faltas')     return datos?.faltas            ?? 0
    if (key === 'con_salida') return datos?.con_salida        ?? 0
    if (key === 'total')      return datos?.total_estudiantes ?? 0
  }
  const subCard = (key) => {
    if (key === 'asistencia') return `${(datos?.puntuales ?? 0) + (datos?.tardanzas ?? 0)} presentes`
    if (key === 'tardanzas')  return `${conteo.tardanza} alumnos`
    if (key === 'faltas')     return `${conteo.falta} alumnos`
    if (key === 'con_salida') return 'registros de salida'
    if (key === 'total')      return 'matriculados'
  }

  const esFechaFutura = fechaRef > new Date() && modo === 'dia'

  return (
    <div className="space-y-5">

      {/* ── Cabecera con título y botón actualizar ── */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-marino flex items-center gap-2">
          <CalendarDays size={20} className="text-dorado" />
          Asistencia
        </h1>
        <button
          onClick={() => {
            if (modo === 'dia')    cargarDia(fechaRef)
            if (modo === 'semana') cargarSemana(fechaRef)
            if (modo === 'mes')    cargarMes(fechaRef)
          }}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} /> <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* ── Selector de vista ── */}
      <div className="flex gap-2">
        {[
          { id: 'dia',    label: 'Por día'    },
          { id: 'semana', label: 'Por semana' },
          { id: 'mes',    label: 'Por mes'    },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => cambiarModo(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              modo === id ? 'bg-marino text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Barra de navegación temporal ── */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
        <button
          onClick={() => setFechaRef(d => avanzar(d, modo, -1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <p className="flex-1 text-center text-sm font-semibold text-marino capitalize">
          {labelNavegacion(fechaRef, modo)}
        </p>

        <button
          onClick={() => setFechaRef(d => avanzar(d, modo, +1))}
          disabled={esFechaFutura}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>

        {!esHoy(fechaRef) && (
          <button
            onClick={() => setFechaRef(new Date())}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-dorado/10 text-dorado hover:bg-dorado/20 transition-colors"
          >
            Hoy
          </button>
        )}
      </div>

      {/* ── Cargando ── */}
      {cargando && (
        <div className="flex items-center justify-center h-48 text-gray-400 gap-3">
          <span className="animate-spin w-5 h-5 border-2 border-dorado border-t-transparent rounded-full" />
          Cargando...
        </div>
      )}

      {/* ── Vista: Día ── */}
      {!cargando && modo === 'dia' && (
        <>
          {/* Tarjetas resumen */}
          {datos && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {CARDS.map(({ key, label, icon: Icon, bg }) => (
                <div key={key} className={`rounded-2xl p-4 ${bg} shadow-sm`}>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white opacity-80">{label}</p>
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white">{valorCard(key)}</p>
                  <p className="text-xs mt-1 text-white opacity-70">{subCard(key)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filtros */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFiltroEstado('')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtroEstado === '' ? 'bg-marino text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                Todos
                <span className={`text-xs px-1.5 py-0.5 rounded-lg font-bold ${filtroEstado === '' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{lista.length}</span>
              </button>
              {[
                { k: 'puntual',      label: 'Puntuales',  dot: 'bg-green-500',  active: 'bg-green-500',  inactive: 'border-green-200 hover:bg-green-50'  },
                { k: 'tardanza',     label: 'Tardanzas',  dot: 'bg-yellow-400', active: 'bg-yellow-400', inactive: 'border-yellow-200 hover:bg-yellow-50' },
                { k: 'falta',        label: 'Faltas',     dot: 'bg-red-500',    active: 'bg-red-500',    inactive: 'border-red-200 hover:bg-red-50'       },
                { k: 'especial',     label: 'Especiales', dot: 'bg-orange-400', active: 'bg-orange-400', inactive: 'border-orange-200 hover:bg-orange-50' },
              ].map(({ k, label, dot, active, inactive }) => (
                <button key={k}
                  onClick={() => setFiltroEstado(filtroEstado === k ? '' : k)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${filtroEstado === k ? `${active} text-white border-transparent shadow-sm` : `bg-white ${inactive} text-gray-600`}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${filtroEstado === k ? 'bg-white/50' : dot}`} />
                  {label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-lg font-bold ${filtroEstado === k ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{conteo[k]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <select className="input w-auto text-sm" value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)}>
                <option value="">Todos los grados</option>
                {grados.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <span className="text-xs text-gray-400 ml-auto">
                Mostrando <span className="font-semibold text-marino">{listaFiltrada.length}</span> de <span className="font-semibold text-marino">{lista.length}</span> alumnos
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  {['Alumno','Grado','Sección','Hora','Estado','Correo'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-12"><Users size={28} className="mx-auto mb-2 text-gray-300" />Sin registros para este filtro</td></tr>
                ) : listaFiltrada.map(a => {
                  const cfg      = ESTADO_CFG[a.estado_dia] || ESTADO_CFG.puntual
                  const registro = a.ingreso || a.salida
                  const iniciales = `${a.estudiante?.nombre?.[0] ?? ''}${a.estudiante?.apellido?.[0] ?? ''}`
                  const tieneAlerta = (a.tardanzas_mes ?? 0) >= 3 || (a.faltas_mes ?? 0) >= 3
                  return (
                    <tr key={a.estudiante?.id}
                      className={`border-b border-gray-50 hover:brightness-95 transition-all cursor-pointer ${cfg.rowBg}`}
                      onClick={() => setSeleccionado(a)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${cfg.avatarBg}`}>{iniciales}</div>
                          <div>
                            <p className="font-medium text-gray-800 leading-none">{a.estudiante?.nombre} {a.estudiante?.apellido}</p>
                            {tieneAlerta && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <AlertTriangle size={10} className="text-red-500" />
                                <span className="text-[10px] text-red-500 font-semibold">
                                  {(a.tardanzas_mes ?? 0) >= 3 && `${a.tardanzas_mes} tard.`}
                                  {(a.tardanzas_mes ?? 0) >= 3 && (a.faltas_mes ?? 0) >= 3 && ' · '}
                                  {(a.faltas_mes ?? 0) >= 3 && `${a.faltas_mes} faltas`}
                                  {' '}este mes
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{a.estudiante?.grado}</td>
                      <td className="px-4 py-3 text-gray-500">{a.estudiante?.seccion}</td>
                      <td className="px-4 py-3">
                        {registro?.hora
                          ? <div className="flex items-center gap-1.5 text-gray-600"><Clock size={13} className="text-gray-400" /><span>{registro.hora}</span></div>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cfg.badge}>{cfg.label}</span>
                        {(() => {
                          const regEsp = [a.ingreso, a.salida].find(r => r?.tipo?.includes('especial') && r?.motivo_especial)
                          return regEsp ? <p className="text-[10px] text-violet-600 font-medium mt-0.5">{MOTIVO_LABEL[regEsp.motivo_especial] || regEsp.motivo_especial}</p> : null
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {registro?.correo_enviado
                          ? <div className="flex items-center gap-1.5 text-dorado"><Mail size={14} /><span className="text-xs font-medium">Enviado</span></div>
                          : <div className="flex items-center gap-1.5 text-gray-300"><MailX size={14} /><span className="text-xs">—</span></div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Vista: Semana ── */}
      {!cargando && modo === 'semana' && (
        <VistaSemana
          semanaData={semanaData}
          dias={diasDeSemana(fechaRef)}
          onSelectEstudiante={setSeleccionado}
        />
      )}

      {/* ── Vista: Mes ── */}
      {!cargando && modo === 'mes' && (
        <VistaMes
          lista={lista}
          mes={fechaRef.getMonth()}
          anio={fechaRef.getFullYear()}
          onSelectEstudiante={setSeleccionado}
        />
      )}

      {/* Modal perfil (igual en las 3 vistas) */}
      {seleccionado && (
        <ModalPerfil
          estudiante={seleccionado.estudiante}
          estadoDia={seleccionado.estado_dia}
          onClose={() => setSeleccionado(null)}
          nav={nav}
        />
      )}
    </div>
  )
}
