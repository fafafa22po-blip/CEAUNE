import { useState, useEffect, useCallback, useMemo } from 'react'
import { abrirWhatsApp } from '../../lib/externo'
import { useNavigate } from 'react-router-dom'
import {
  Search, QrCode, X, GraduationCap, AlertTriangle,
  Phone, Copy, Send, CheckCircle,
  ArrowLeft, ChevronRight, Heart, Users, UserCheck, ShieldCheck,
} from 'lucide-react'

function IconWhatsApp({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { obtenerUsuario } from '../../lib/auth'
import QRScanner from '../../components/QRScanner'

// ─── Config ───────────────────────────────────────────────────────────────────

const NIVEL_CFG = {
  inicial:    { label: 'Inicial',    bg: 'bg-violet-100', text: 'text-violet-700', avatar: 'bg-violet-600' },
  primaria:   { label: 'Primaria',   bg: 'bg-sky-100',    text: 'text-sky-700',    avatar: 'bg-sky-600'    },
  secundaria: { label: 'Secundaria', bg: 'bg-emerald-100',text: 'text-emerald-700',avatar: 'bg-emerald-600'},
}

const NIVEL_POR_ROL = {
  'i-auxiliar': 'inicial',
  'p-auxiliar': 'primaria',
  's-auxiliar': 'secundaria',
}

const ESTADO_CELL = {
  puntual:  { bg: 'bg-green-100 text-green-700',   titulo: 'Puntual'  },
  tardanza: { bg: 'bg-yellow-100 text-yellow-700', titulo: 'Tardanza' },
  falta:    { bg: 'bg-red-100 text-red-700',       titulo: 'Falta'    },
  especial: { bg: 'bg-orange-100 text-orange-700', titulo: 'Especial' },
}

const TAGS = [
  { id: 'conflicto', label: '😤 Conflicto',  msg: 'Se observó una situación de conflicto.' },
  { id: 'llanto',    label: '😢 Llanto',      msg: 'El alumno presentó llanto durante el dia.' },
  { id: 'salud',     label: '🤒 Salud',       msg: 'Se observaron signos de malestar o salud.' },
  { id: 'agresivo',  label: '😠 Agresividad', msg: 'Se detectó comportamiento agresivo.' },
  { id: 'positivo',  label: '✅ Positivo',    msg: 'El alumno tuvo un comportamiento destacado.' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function iniciales(nombre = '', apellido = '') {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
}

// ─── Calendario mensual ───────────────────────────────────────────────────────

function CalendarioMes({ estados = {}, mes, anio }) {
  const hoy       = new Date()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const primerDia = new Date(anio, mes, 1)
  const offset    = (primerDia.getDay() + 6) % 7

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map((d, i) => (
          <div key={i} className={`text-center text-[11px] font-bold py-1 ${i >= 5 ? 'text-gray-300' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: diasEnMes }).map((_, i) => {
          const dia      = i + 1
          const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const fecha    = new Date(anio, mes, dia)
          const esFin    = fecha.getDay() === 0 || fecha.getDay() === 6
          const esFuturo = fecha > hoy
          const esHoy    = fecha.toDateString() === hoy.toDateString()
          const estado   = estados[fechaStr]
          const cellCfg  = ESTADO_CELL[estado]

          let cls = 'bg-gray-50 text-gray-300'
          if (cellCfg)       cls = cellCfg.bg
          else if (esFuturo) cls = 'bg-gray-50 text-gray-300'
          else if (esFin)    cls = 'bg-gray-50 text-gray-200'
          else               cls = 'bg-gray-100 text-gray-400'

          return (
            <div
              key={dia}
              title={cellCfg ? `${fechaStr} — ${cellCfg.titulo}` : fechaStr}
              className={`rounded-lg aspect-square flex items-center justify-center text-xs font-semibold ${cls} ${esHoy ? 'ring-2 ring-marino ring-offset-1' : ''}`}
            >
              {dia}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(ESTADO_CELL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${v.bg}`} />
            <span className="text-[11px] text-gray-400">{v.titulo}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100" />
          <span className="text-[11px] text-gray-400">Sin registro</span>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de perfil (2 pasos) ────────────────────────────────────────────────

function ModalPerfil({ perfil, onCerrar }) {
  const navigate = useNavigate()
  const [paso, setPaso]           = useState(1)
  const [resumenMes, setResumenMes]     = useState(null)
  const [cargandoMes, setCargandoMes]   = useState(true)
  const [tagActivo, setTagActivo]       = useState(null)
  const [nota, setNota]                 = useState('')
  const [mensajeWA, setMensajeWA]       = useState('')
  const [tabActivo, setTabActivo]       = useState('asistencia')

  const { estudiante, tardanzas_mes, faltas_mes, apoderados, recojo_info } = perfil
  const cfg          = NIVEL_CFG[estudiante.nivel] || NIVEL_CFG.primaria
  const esInicial    = estudiante.nivel === 'inicial'
  const conTelefono  = (apoderados || []).filter((a) => a.telefono)
  const hayAlerta    = tardanzas_mes >= 3 || faltas_mes >= 3
  const haySalud     = !!(estudiante.atencion_medica || estudiante.tiene_alergias || estudiante.condicion_mental_nee || estudiante.contacto_emergencia)
  const hayCritico   = !!(estudiante.tiene_alergias || estudiante.contacto_emergencia)

  const ahora        = new Date()
  const mesActual    = ahora.getMonth()
  const anioActual   = ahora.getFullYear()
  const pctMes = resumenMes?.pct ?? 0

  useEffect(() => {
    api.get(`/asistencia/estudiante/${estudiante.id}/resumen-mes`)
      .then(({ data }) => setResumenMes(data))
      .catch(() => {})
      .finally(() => setCargandoMes(false))
  }, [estudiante.id])

  // Mensaje WhatsApp dinámico (se actualiza cuando cambia tag o nota)
  useEffect(() => {
    const tagMsg    = tagActivo ? TAGS.find((t) => t.id === tagActivo)?.msg || '' : ''
    const notaExtra = nota.trim() ? `\n${nota.trim()}` : ''
    setMensajeWA(
      `Estimado/a apoderado/a,\nLe contactamos respecto a *${estudiante.nombre} ${estudiante.apellido}* ` +
      `(${cfg.label} — ${estudiante.grado} "${estudiante.seccion}").` +
      (tagMsg ? `\n\n${tagMsg}` : '') +
      notaExtra +
      `\n\n_Colegio CEAUNE_`
    )
  }, [tagActivo, nota, estudiante, cfg])

  const copiar      = (apo) => { navigator.clipboard.writeText(`+51${apo.telefono}`); toast.success('Número copiado') }
  const abrirWA     = (apo) => abrirWhatsApp(apo.telefono, mensajeWA)
  const irAComunicar = () => { onCerrar(); navigate('/auxiliar/comunicados', { state: { alumno: estudiante } }) }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >

        {paso === 1 ? (
          <>
            {/* ── Paso 1: Resumen ────────────────────────────────────── */}

            {/* Cabecera coloreada sticky */}
            <div className={`flex-shrink-0 ${cfg.avatar} px-5 py-4 rounded-t-2xl`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-white/40">
                    {estudiante.foto_url
                      ? <img src={estudiante.foto_url} alt={estudiante.nombre} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-white/20 flex items-center justify-center">
                          <span className="text-white font-bold text-base">{iniciales(estudiante.nombre, estudiante.apellido)}</span>
                        </div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-base leading-tight truncate">
                      {estudiante.nombre} {estudiante.apellido}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{cfg.label}</span>
                      <span className="text-white/80 text-xs flex items-center gap-1">
                        <GraduationCap size={11} /> {estudiante.grado} · Sec. {estudiante.seccion}
                      </span>
                      <span className="text-white/60 text-xs font-mono">DNI {estudiante.dni}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onCerrar}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-2"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            {/* Alerta crítica — siempre visible si hay protocolo o alergias */}
            {hayCritico && (
              <div className="flex-shrink-0 flex items-start gap-2.5 bg-red-50 border-b border-red-200 px-5 py-3">
                <span className="text-base leading-none mt-0.5 flex-shrink-0">🚨</span>
                <div className="min-w-0">
                  {estudiante.tiene_alergias && estudiante.alergias_detalle && (
                    <p className="text-xs font-bold text-red-800 leading-snug">⚠️ {estudiante.alergias_detalle}</p>
                  )}
                  {estudiante.contacto_emergencia && (
                    <p className="text-xs text-red-700 mt-0.5">📞 {estudiante.contacto_emergencia}</p>
                  )}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex-shrink-0 flex gap-1 px-5 pt-3 pb-3 bg-white border-b border-gray-100">
              <button
                onClick={() => setTabActivo('asistencia')}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
                  tabActivo === 'asistencia'
                    ? 'bg-marino text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Asistencia
              </button>
              <button
                onClick={() => setTabActivo('salud')}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors ${
                  tabActivo === 'salud'
                    ? 'bg-marino text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Salud
                {haySalud && tabActivo !== 'salud' && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                )}
              </button>
              {esInicial && (
                <button
                  onClick={() => setTabActivo('recojo')}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors ${
                    tabActivo === 'recojo'
                      ? 'bg-marino text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Recojo
                  {recojo_info?.recojo_hoy && tabActivo !== 'recojo' && (
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  )}
                </button>
              )}
            </div>

            {/* Cuerpo scrolleable */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {tabActivo === 'asistencia' ? (
                <>
                  {/* Stats del mes */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumen del mes</p>
                    {hayAlerta && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
                        <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-700 font-medium">
                          Patrón de inasistencia —{' '}
                          {tardanzas_mes >= 3 && `${tardanzas_mes} tardanzas`}
                          {tardanzas_mes >= 3 && faltas_mes >= 3 && ' · '}
                          {faltas_mes >= 3 && `${faltas_mes} faltas`}
                          {' '}este mes
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`rounded-xl p-3 text-center ${pctMes < 75 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                        <p className={`text-2xl font-bold ${pctMes < 75 ? 'text-red-600' : 'text-green-600'}`}>{pctMes}%</p>
                        <p className="text-[11px] mt-0.5 text-gray-500 font-medium">asistencia</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${tardanzas_mes >= 3 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                        <p className={`text-2xl font-bold ${tardanzas_mes >= 3 ? 'text-yellow-700' : 'text-marino'}`}>{tardanzas_mes}</p>
                        <p className={`text-[11px] mt-0.5 font-medium ${tardanzas_mes >= 3 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          tardanza{tardanzas_mes !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${faltas_mes >= 3 ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                        <p className={`text-2xl font-bold ${faltas_mes >= 3 ? 'text-red-700' : 'text-marino'}`}>{faltas_mes}</p>
                        <p className={`text-[11px] mt-0.5 font-medium ${faltas_mes >= 3 ? 'text-red-600' : 'text-gray-400'}`}>
                          falta{faltas_mes !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Calendario mensual */}
                  <div className="border-t border-gray-100 pt-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Asistencia — {MESES[mesActual]} {anioActual}
                    </p>
                    {cargandoMes ? (
                      <div className="flex items-center justify-center h-28 gap-2 text-gray-400 text-sm">
                        <span className="animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />
                        Cargando calendario...
                      </div>
                    ) : (
                      <CalendarioMes estados={resumenMes?.estados ?? {}} mes={mesActual} anio={anioActual} />
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Tab Salud */}
                  {haySalud ? (
                    <div className="space-y-2">

                      {/* Alergias — máxima prioridad */}
                      {estudiante.tiene_alergias && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
                          <span className="text-base leading-none mt-0.5">⚠️</span>
                          <div>
                            <p className="text-xs font-semibold text-red-800">Alergias</p>
                            <p className="text-xs text-gray-600 mt-0.5">{estudiante.alergias_detalle || 'Alergias registradas (sin detalle)'}</p>
                          </div>
                        </div>
                      )}

                      {/* Contacto de emergencia */}
                      {estudiante.contacto_emergencia && (
                        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-3">
                          <span className="text-base leading-none mt-0.5">📞</span>
                          <div>
                            <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">Contacto de emergencia</p>
                            <p className="text-xs text-gray-700 mt-0.5">{estudiante.contacto_emergencia}</p>
                          </div>
                        </div>
                      )}

                      {/* Atención médica */}
                      {estudiante.atencion_medica && (
                        <div className="flex items-start gap-3 bg-sky-50 rounded-xl px-3.5 py-3">
                          <span className="text-base leading-none mt-0.5">🏥</span>
                          <div>
                            <p className="text-xs font-semibold text-sky-800">Atención médica</p>
                            <p className="text-xs text-gray-600 mt-0.5">{estudiante.atencion_medica}</p>
                          </div>
                        </div>
                      )}

                      {/* Salud mental / NEE */}
                      {estudiante.condicion_mental_nee && (
                        <div className="flex items-start gap-3 bg-purple-50 rounded-xl px-3.5 py-3">
                          <span className="text-base leading-none mt-0.5">🧠</span>
                          <div>
                            <p className="text-xs font-semibold text-purple-800">Salud mental / NEE</p>
                            <p className="text-xs text-gray-600 mt-0.5">{estudiante.condicion_mental_nee}</p>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Heart size={32} className="text-gray-200 mb-3" />
                      <p className="text-sm font-medium text-gray-400">No presenta ninguna condición de salud</p>
                      <p className="text-xs text-gray-300 mt-1">Sin condiciones registradas</p>
                    </div>
                  )}
                </>
              )}

              {tabActivo === 'recojo' && esInicial && (
                <>
                  {/* Banner: ya fue recogido hoy */}
                  {recojo_info?.recojo_hoy ? (
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                      <UserCheck size={18} className="text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-green-800">Ya fue recogido hoy</p>
                        <p className="text-xs text-green-700 mt-0.5">
                          {recojo_info.recojo_hoy.nombre} {recojo_info.recojo_hoy.apellido}
                          {' '}·{' '}{recojo_info.recojo_hoy.parentesco}
                          {' '}·{' '}{recojo_info.recojo_hoy.hora}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                      <ShieldCheck size={18} className="text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-semibold text-amber-800">Pendiente de recojo hoy</p>
                    </div>
                  )}

                  {/* Lista de autorizados */}
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Personas autorizadas
                  </p>

                  {(recojo_info?.autorizados || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Users size={32} className="text-gray-200 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Sin autorizados activos</p>
                      <p className="text-xs text-gray-300 mt-1">El apoderado no ha registrado ninguna persona</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recojo_info.autorizados.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                          {/* Foto o iniciales */}
                          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-gray-200">
                            {a.foto_url
                              ? <img src={a.foto_url} alt={a.nombre} className="w-full h-full object-cover" />
                              : <div className={`w-full h-full ${cfg.avatar} flex items-center justify-center`}>
                                  <span className="text-white font-bold text-sm">{iniciales(a.nombre, a.apellido)}</span>
                                </div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-marino leading-none truncate">
                              {a.nombre} {a.apellido}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 capitalize">{a.parentesco}</p>
                            <p className="text-xs text-gray-300 font-mono mt-0.5">DNI {a.dni}</p>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex-shrink-0">
                            Activo
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Footer paso 1 */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={() => setPaso(2)}
                disabled={conTelefono.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-marino text-white font-semibold rounded-xl hover:bg-marino/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone size={15} />
                Contactar apoderado
                <ChevronRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Paso 2: Contactar ──────────────────────────────────── */}
            <div className="flex-shrink-0 border-b border-gray-100 px-5 py-4 flex items-center gap-3">
              <button
                onClick={() => setPaso(1)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-marino hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-marino text-sm">Contactar apoderado</p>
                <p className="text-xs text-gray-400 truncate">
                  {estudiante.nombre} {estudiante.apellido}
                </p>
              </div>
              <button
                onClick={onCerrar}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo scrolleable */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

              {/* Observar comportamiento + motivo */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">¿Qué le comunicas?</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTagActivo((prev) => prev === t.id ? null : t.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        tagActivo === t.id
                          ? 'bg-marino text-white border-marino'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-marino/20 focus:border-marino transition-all bg-gray-50"
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Escribe el motivo de contacto..."
                />
              </div>

              {/* Botones WhatsApp — justo debajo del textarea */}
              {conTelefono.length === 0 ? (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                  Ningún apoderado tiene número registrado
                </p>
              ) : (
                <div className="space-y-2">
                  {conTelefono.map((apo) => (
                    <button
                      key={apo.id}
                      onClick={() => abrirWA(apo)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                      <IconWhatsApp size={17} />
                      {conTelefono.length > 1 ? `Enviar a ${apo.nombre}` : 'Enviar por WhatsApp'}
                    </button>
                  ))}
                </div>
              )}

              {/* Otras opciones — Copiar / Llamar */}
              {(apoderados || []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Otras opciones</p>
                  {(apoderados || []).map((apo) => (
                    <div key={apo.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${cfg.avatar} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {iniciales(apo.nombre, apo.apellido)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-marino leading-none truncate">{apo.nombre} {apo.apellido}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{apo.parentesco || apo.email || 'Apoderado'}</p>
                      </div>
                      {apo.telefono ? (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => copiar(apo)}
                            className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-marino transition-colors"
                            title="Copiar número"
                          >
                            <Copy size={13} />
                          </button>
                          <a
                            href={`tel:+51${apo.telefono}`}
                            className="w-8 h-8 flex items-center justify-center bg-blue-50 border border-blue-100 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                            title="Llamar"
                          >
                            <Phone size={13} />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">Sin número</span>
                      )}
                    </div>
                  ))}
                </div>
              )}


            </div>

            {/* Footer paso 2 */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={irAComunicar}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-marino text-marino text-sm font-semibold rounded-xl hover:bg-marino hover:text-white transition-colors"
              >
                <Send size={14} /> Enviar comunicado formal
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Inspeccion() {
  const nivelPropio = useMemo(() => {
    const u = obtenerUsuario()
    return NIVEL_POR_ROL[u?.rol] || null
  }, [])

  const [modoEntrada, setModoEntrada]       = useState('qr')
  const [camaraActiva, setCamaraActiva]     = useState(true)
  const [busqueda, setBusqueda]             = useState('')
  const [resultados, setResultados]         = useState([])
  const [buscando, setBuscando]             = useState(false)
  const [perfil, setPerfil]                 = useState(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(false)

  useEffect(() => {
    const q = busqueda.trim()
    if (!q) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const params = { q }
        if (nivelPropio) params.nivel = nivelPropio
        const { data } = await api.get('/estudiantes/', { params })
        setResultados(Array.isArray(data) ? data : (data.items || []))
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda, nivelPropio])

  const cargarPerfilPorQR = useCallback(async (qr_token) => {
    setCamaraActiva(false)
    setCargandoPerfil(true)
    try {
      const { data } = await api.get(`/asistencia/perfil-qr/${qr_token}`)
      setPerfil(data)
    } catch (err) {
      const msg = err.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'QR no reconocido')
      setTimeout(() => setCamaraActiva(true), 1500)
    } finally {
      setCargandoPerfil(false)
    }
  }, [])

  const cargarPerfilPorId = async (id) => {
    setBusqueda('')
    setResultados([])
    setCargandoPerfil(true)
    try {
      const { data } = await api.get(`/asistencia/perfil-alumno/${id}`)
      setPerfil(data)
    } catch (err) {
      const msg = err.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Error al cargar perfil')
    } finally {
      setCargandoPerfil(false)
    }
  }

  const cerrarPerfil = () => {
    setPerfil(null)
    setCamaraActiva(true)
    setBusqueda('')
    setResultados([])
  }

  const cambiarModo = (m) => {
    setModoEntrada(m)
    cerrarPerfil()
  }

  return (
    <div className="max-w-xl space-y-5">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-marino">Inspección</h1>
        <p className="text-xs text-gray-400 mt-0.5">Consulta el perfil de un alumno sin registrar asistencia</p>
      </div>

      {/* Aviso solo lectura */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <CheckCircle size={14} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          <strong>Modo solo lectura</strong> — ningún escaneo aquí registra asistencia
        </p>
      </div>

      {/* Toggle QR / Búsqueda */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'qr',       icon: QrCode, label: 'Escanear QR'   },
          { id: 'busqueda', icon: Search, label: 'Buscar alumno' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => cambiarModo(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              modoEntrada === id ? 'bg-white text-marino shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* QR Scanner */}
      {modoEntrada === 'qr' && (
        <div className="card">
          {cargandoPerfil ? (
            <div className="flex items-center justify-center gap-3 py-10 text-gray-400">
              <span className="animate-spin w-5 h-5 border-2 border-dorado border-t-transparent rounded-full" />
              <span className="text-sm">Cargando perfil...</span>
            </div>
          ) : (
            <QRScanner onResult={cargarPerfilPorQR} activo={camaraActiva} />
          )}
        </div>
      )}

      {/* Búsqueda */}
      {modoEntrada === 'busqueda' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-10 py-3.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-marino/30 focus:border-marino transition-all shadow-sm"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, apellido o DNI..."
              autoFocus
            />
            {buscando && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />
              </span>
            )}
            {busqueda && !buscando && (
              <button onClick={() => setBusqueda('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            )}
          </div>

          {cargandoPerfil && (
            <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
              <span className="animate-spin w-5 h-5 border-2 border-dorado border-t-transparent rounded-full" />
              <span className="text-sm">Cargando perfil...</span>
            </div>
          )}

          {resultados.length > 0 && !cargandoPerfil && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 px-1">{resultados.length} resultado{resultados.length !== 1 ? 's' : ''}</p>
              {resultados.map((est) => {
                const cfg = NIVEL_CFG[est.nivel] || NIVEL_CFG.primaria
                return (
                  <button
                    key={est.id}
                    onClick={() => cargarPerfilPorId(est.id)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-dorado/40 hover:-translate-y-0.5 transition-all p-4 flex items-center gap-4 group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${cfg.avatar} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white font-bold text-sm">{iniciales(est.nombre, est.apellido)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate group-hover:text-marino transition-colors">
                        {est.nombre} {est.apellido}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-400">{est.grado} · Sec. {est.seccion}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-dorado opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          )}

          {busqueda && !buscando && resultados.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">Sin resultados para "{busqueda}"</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de perfil */}
      {perfil && <ModalPerfil perfil={perfil} onCerrar={cerrarPerfil} />}

    </div>
  )
}
