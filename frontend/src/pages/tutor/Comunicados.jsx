import { useState, useEffect, useMemo } from 'react'
import {
  Send, Users, User, Eye, Paperclip, X, Search,
  ChevronLeft, Check, CheckCircle2, MessageSquare,
  Inbox, School, ChevronDown, Reply, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'

const MAX_CHARS = 1000

// ─── Helpers de fecha ────────────────────────────────────────────────────────

function formatCorto(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (isToday(d))     return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM', { locale: es })
}

function formatLargo(fecha) {
  if (!fecha) return ''
  return format(new Date(fecha), "d 'de' MMMM, HH:mm", { locale: es })
}

const NIVEL_COLOR = {
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100 text-blue-700',
  secundaria: 'bg-amber-100 text-amber-700',
}

// ─── Bandeja ─────────────────────────────────────────────────────────────────

function FilaComunicado({ com, activa, tieneRespuesta, onClick }) {
  const total  = com.total_destinatarios ?? 0
  const leidos = com.leidos ?? 0
  const todosLeyeron = total > 0 && leidos === total
  const TipoIcon = com.tipo_envio === 'individual' ? User : Users

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 transition-all border-l-[3px] ${
        activa
          ? 'bg-amber-50 border-dorado'
          : tieneRespuesta
          ? 'bg-blue-50/50 border-blue-400 hover:bg-blue-50/70'
          : 'border-transparent hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-marino/10 flex items-center justify-center flex-shrink-0">
          <TipoIcon size={16} className="text-marino" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">{com.asunto}</p>
            <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
              {formatCorto(com.created_at)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {com.tipo_envio === 'individual' ? 'Estudiantes específicos' : 'Toda mi aula'}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] ${todosLeyeron ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
              {todosLeyeron ? '✓✓ Todos leyeron' : `${leidos}/${total} leyeron`}
            </span>
            {com.adjunto_nombre && <Paperclip size={10} className="text-dorado flex-shrink-0" />}
            {tieneRespuesta && (
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                Respuesta
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function PanelDetalle({ com, onVolver }) {
  if (!com) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4 h-full text-center px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <MessageSquare size={28} className="text-gray-200" />
        </div>
        <div>
          <p className="font-semibold text-gray-400">Selecciona un comunicado</p>
          <p className="text-xs text-gray-300 mt-1">para ver el mensaje y los destinatarios</p>
        </div>
      </div>
    )
  }

  const destinatarios = com.destinatarios || []

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header marino */}
      <div className="flex items-center gap-3 px-5 py-4 bg-marino text-white flex-shrink-0">
        <button
          className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
          onClick={onVolver}
        >
          <ChevronLeft size={19} />
        </button>
        <div className="w-9 h-9 rounded-full bg-dorado/25 flex items-center justify-center flex-shrink-0">
          <School size={16} className="text-dorado" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{com.asunto}</p>
          <p className="text-xs text-white/60 mt-0.5">{formatLargo(com.created_at)}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/90 flex-shrink-0">
          {com.tipo_envio === 'individual' ? 'Individual' : 'Mi Aula'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Mensaje enviado */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Mensaje enviado</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{com.mensaje}</p>
          </div>
          {com.adjunto_drive_url && (
            <a
              href={com.adjunto_drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 flex items-center gap-3 w-fit bg-dorado/10 hover:bg-dorado/20 active:bg-dorado/30 border border-dorado/25 rounded-xl px-3.5 py-2.5 transition-colors"
            >
              <div className="w-7 h-7 bg-dorado rounded-lg flex items-center justify-center flex-shrink-0">
                <Paperclip size={13} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-marino">Ver documento</p>
                {com.adjunto_nombre && (
                  <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{com.adjunto_nombre}</p>
                )}
              </div>
            </a>
          )}
        </div>

        {/* Skeleton */}
        {com.cargandoDetalle && (
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Destinatarios */}
        {!com.cargandoDetalle && destinatarios.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
              Destinatarios ({destinatarios.length})
            </p>
            <div className="space-y-0 max-h-48 overflow-y-auto">
              {destinatarios.map((d) => {
                const est   = d.estudiante
                const nivel = est?.nivel || 'primaria'
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
                        {est?.nombre?.[0] ?? '?'}
                      </div>
                      <span className="text-xs text-gray-700 truncate">
                        {est?.nombre} {est?.apellido}
                      </span>
                    </div>
                    <span className={`text-[10px] flex items-center gap-0.5 flex-shrink-0 ${d.leido_apoderado ? 'text-dorado' : 'text-gray-300'}`}>
                      <Check size={9} /><Check size={9} />
                      <span className="ml-0.5">{d.leido_apoderado ? 'Leído' : 'No leído'}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Fila de respuesta individual ────────────────────────────────────────────

function FilaRespuesta({ r, activa, onClick }) {
  const est     = r.estudiante
  const nivel   = est?.nivel || 'primaria'
  const noLeida = !r.leido_auxiliar

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 transition-all border-l-[3px] ${
        activa
          ? 'bg-amber-50 border-dorado'
          : noLeida
          ? 'bg-blue-50/40 border-blue-400 hover:bg-blue-50/60'
          : 'border-transparent hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
            {est?.nombre?.[0] ?? '?'}
          </div>
          {noLeida && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm truncate ${noLeida ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
              {est?.nombre} {est?.apellido}
            </p>
            <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
              {formatCorto(r.created_at)}
            </span>
          </div>
          {est?.grado && (
            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
              {est.grado}° {est.seccion}
            </span>
          )}
          <p className="text-[11px] text-gray-400 mt-1 truncate">Re: {r.asunto}</p>
          <p className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${noLeida ? 'text-gray-700' : 'text-gray-400'}`}>
            {r.mensaje}
          </p>
        </div>
      </div>
    </button>
  )
}

// ─── Panel de respuesta individual ───────────────────────────────────────────

function PanelRespuestaIndividual({ r, onVolver, onMarcarLeida }) {
  const [contextoExpandido, setContextoExpandido] = useState(false)

  useEffect(() => { setContextoExpandido(false) }, [r?.id])

  if (!r) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-5 h-full text-center px-8">
        <div className="w-20 h-20 bg-marino/5 rounded-full flex items-center justify-center">
          <Reply size={32} className="text-marino/20" />
        </div>
        <div>
          <p className="font-semibold text-gray-400">Selecciona una respuesta</p>
          <p className="text-xs text-gray-300 mt-1">El mensaje del apoderado aparecerá aquí</p>
        </div>
      </div>
    )
  }

  const est   = r.estudiante
  const nivel = est?.nivel || 'primaria'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-marino text-white flex-shrink-0">
        <button
          className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
          onClick={onVolver}
        >
          <ChevronLeft size={19} />
        </button>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border-2 border-white/20 ${NIVEL_COLOR[nivel] ?? 'bg-gray-200 text-gray-700'}`}>
          {est?.nombre?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{est?.nombre} {est?.apellido}</p>
          <p className="text-xs text-white/60 mt-0.5">
            {est?.grado}° {est?.seccion}
            {est?.nivel && <span className="ml-1 capitalize">· {est.nivel}</span>}
          </p>
        </div>
        <span className="text-[10px] text-white/50 flex-shrink-0 tabular-nums text-right leading-tight">
          {formatLargo(r.created_at)}
        </span>
      </div>

      {/* Franja de estado */}
      <div className={`flex items-center gap-2 px-5 py-2 flex-shrink-0 border-b ${
        r.leido_auxiliar ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'
      }`}>
        {r.leido_auxiliar ? (
          <>
            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
            <p className="text-xs text-emerald-700 font-medium">
              Leída{r.leido_auxiliar_at ? ` el ${formatLargo(r.leido_auxiliar_at)}` : ''}
            </p>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700 font-semibold flex-1">Respuesta sin leer</p>
            <button
              type="button"
              onClick={() => onMarcarLeida(r.dest_id)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors flex-shrink-0"
            >
              <Check size={12} /> Marcar leída
            </button>
          </>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* Comunicado original colapsable */}
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setContextoExpandido(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={13} className="text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide leading-none mb-0.5">
                  Comunicado original
                </p>
                <p className="text-xs font-semibold text-gray-700 truncate">{r.asunto}</p>
              </div>
            </div>
            <ChevronDown
              size={13}
              className={`text-gray-400 flex-shrink-0 ml-3 transition-transform ${contextoExpandido ? 'rotate-180' : ''}`}
            />
          </button>
          {contextoExpandido && (
            <div className="px-4 py-3.5 border-t border-gray-100">
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{r.mensaje_comunicado}</p>
              {r.adjunto_comunicado_url && (
                <a href={r.adjunto_comunicado_url} target="_blank" rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 text-dorado hover:underline">
                  <Paperclip size={11} />
                  <span className="text-xs">{r.adjunto_comunicado_nombre || 'Ver adjunto'}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Respuesta del apoderado */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Respuesta del apoderado
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-4">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{r.mensaje}</p>
            {r.adjunto_drive_url && (
              <a href={r.adjunto_drive_url} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-dorado hover:underline">
                <Paperclip size={11} />
                <span className="text-xs">{r.adjunto_nombre || 'Ver adjunto'}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Bandeja() {
  // ── Pestañas
  const [pestana, setPestana] = useState('enviados')  // 'enviados' | 'respuestas'

  // ── Enviados
  const [lista,         setLista]         = useState([])
  const [seleccionado,  setSeleccionado]  = useState(null)
  const [pagina,        setPagina]        = useState(1)
  const [total,         setTotal]         = useState(0)
  const [cargando,      setCargando]      = useState(true)

  // ── Respuestas
  const [soloNoLeidas,     setSoloNoLeidas]     = useState(false)
  const [listaResp,        setListaResp]        = useState([])
  const [respSeleccionada, setRespSeleccionada] = useState(null)
  const [respPagina,       setRespPagina]       = useState(1)
  const [respTotal,        setRespTotal]        = useState(0)
  const [respNoLeidas,     setRespNoLeidas]     = useState(0)
  const [respCargando,     setRespCargando]     = useState(false)

  // ── Móvil
  const [viendoDetalle, setViendoDetalle] = useState(false)

  const POR_PAGINA = 20

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/tutor/comunicados/bandeja', {
        params: { pagina, por_pagina: POR_PAGINA },
      })
      const items      = data.items || data
      const totalCount = data.total  || items.length
      setLista(items)
      setTotal(totalCount)
    } catch {
      toast.error('Error al cargar la bandeja')
    } finally {
      setCargando(false)
    }
  }

  const cargarRespuestas = async () => {
    setRespCargando(true)
    try {
      const { data } = await api.get('/tutor/comunicados/respuestas', {
        params: { pagina: respPagina, por_pagina: POR_PAGINA, solo_no_leidas: soloNoLeidas },
      })
      setListaResp(data.items     || [])
      setRespTotal(data.total     || 0)
      setRespNoLeidas(data.no_leidas || 0)
    } catch {
      toast.error('Error al cargar las respuestas')
    } finally {
      setRespCargando(false)
    }
  }

  useEffect(() => { cargar() },           [pagina])           // eslint-disable-line
  useEffect(() => { cargarRespuestas() }, [respPagina, soloNoLeidas]) // eslint-disable-line

  const cambiarPestana = (nueva) => {
    setPestana(nueva)
    setViendoDetalle(false)
    if (nueva === 'respuestas') cargarRespuestas()
  }

  const abrirDetalle = async (com) => {
    setSeleccionado({ ...com, cargandoDetalle: true, destinatarios: [] })
    setViendoDetalle(true)
    try {
      const { data: dests } = await api.get(`/tutor/comunicados/${com.id}/destinatarios`)
      setSeleccionado(prev => ({ ...prev, destinatarios: dests, cargandoDetalle: false }))
    } catch {
      setSeleccionado(prev => ({ ...prev, cargandoDetalle: false }))
    }
  }

  const marcarRespuestaLeida = async (destId) => {
    try {
      await api.put(`/tutor/comunicados/destinatarios/${destId}/marcar-leido`)
      const ahora = new Date().toISOString()
      const cuantas = listaResp.filter(r => r.dest_id === destId && !r.leido_auxiliar).length
      setListaResp(prev =>
        prev.map(r => r.dest_id === destId ? { ...r, leido_auxiliar: true, leido_auxiliar_at: ahora } : r)
      )
      setRespSeleccionada(prev =>
        prev?.dest_id === destId ? { ...prev, leido_auxiliar: true, leido_auxiliar_at: ahora } : prev
      )
      setRespNoLeidas(prev => Math.max(0, prev - cuantas))
    } catch {
      // no crítico
    }
  }

  const totalPaginas     = Math.ceil(total     / POR_PAGINA)
  const respTotalPaginas = Math.ceil(respTotal / POR_PAGINA)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 11rem)' }}>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">

        {/* ══ PANEL IZQUIERDO ══ */}
        <div className={`lg:col-span-2 min-h-0 flex flex-col ${viendoDetalle ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">

            {/* Pestañas */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              <button
                onClick={() => cambiarPestana('enviados')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  pestana === 'enviados' ? 'text-marino border-b-2 border-marino' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Enviados
              </button>
              <button
                onClick={() => cambiarPestana('respuestas')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  pestana === 'respuestas' ? 'text-marino border-b-2 border-marino' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Respuestas
                {respNoLeidas > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                    {respNoLeidas}
                  </span>
                )}
              </button>
            </div>

            {/* ── Contenido: Enviados ── */}
            {pestana === 'enviados' && (
              <>
                {cargando ? (
                  <div className="flex-1 overflow-hidden divide-y divide-gray-50">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-3 px-4 py-3.5 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 bg-gray-100 rounded w-3/4" />
                          <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                          <div className="h-2 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : lista.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                      <Inbox size={26} className="text-gray-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-500">Bandeja vacía</p>
                      <p className="text-xs text-gray-400 mt-0.5">Aún no has enviado comunicados</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {lista.map((com) => (
                      <FilaComunicado
                        key={com.id}
                        com={com}
                        activa={seleccionado?.id === com.id}
                        tieneRespuesta={com._tieneRespuesta || false}
                        onClick={() => abrirDetalle(com)}
                      />
                    ))}
                  </div>
                )}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 flex-shrink-0">
                    <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Anterior</button>
                    <span className="text-xs text-gray-400">{pagina} / {totalPaginas}</span>
                    <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Siguiente</button>
                  </div>
                )}
              </>
            )}

            {/* ── Contenido: Respuestas ── */}
            {pestana === 'respuestas' && (
              <>
                {/* Filtros */}
                <div className="flex gap-1.5 px-4 py-2.5 border-b border-gray-50 flex-shrink-0">
                  <button
                    onClick={() => { setSoloNoLeidas(false); setRespPagina(1) }}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      !soloNoLeidas ? 'bg-marino text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Todas {respTotal > 0 ? `(${respTotal})` : ''}
                  </button>
                  <button
                    onClick={() => { setSoloNoLeidas(true); setRespPagina(1) }}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 ${
                      soloNoLeidas ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {!soloNoLeidas && respNoLeidas > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    )}
                    Sin leer {respNoLeidas > 0 ? `(${respNoLeidas})` : ''}
                  </button>
                </div>

                {respCargando ? (
                  <div className="flex-1 overflow-hidden divide-y divide-gray-50">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-3 px-4 py-3.5 animate-pulse">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 bg-gray-100 rounded w-2/3" />
                          <div className="h-2 bg-gray-100 rounded w-1/4" />
                          <div className="h-2.5 bg-gray-100 rounded w-full" />
                          <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : listaResp.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                      {soloNoLeidas
                        ? <CheckCircle2 size={26} className="text-emerald-300" />
                        : <Reply size={26} className="text-gray-300" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-500">
                        {soloNoLeidas ? 'Todo al día' : 'Sin respuestas'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {soloNoLeidas ? 'No tienes respuestas sin leer' : 'Los apoderados aún no han respondido'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {listaResp.map((r) => (
                      <FilaRespuesta
                        key={r.id}
                        r={r}
                        activa={respSeleccionada?.id === r.id}
                        onClick={() => { setRespSeleccionada(r); setViendoDetalle(true) }}
                      />
                    ))}
                  </div>
                )}

                {respTotalPaginas > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 flex-shrink-0">
                    <button onClick={() => setRespPagina(p => Math.max(1, p - 1))} disabled={respPagina === 1}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Anterior</button>
                    <span className="text-xs text-gray-400">{respPagina} / {respTotalPaginas}</span>
                    <button onClick={() => setRespPagina(p => Math.min(respTotalPaginas, p + 1))} disabled={respPagina === respTotalPaginas}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Siguiente</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ══ PANEL DERECHO ══ */}
        <div className={`lg:col-span-3 min-h-0 flex flex-col ${viendoDetalle ? 'flex' : 'hidden lg:flex'}`}>
          {pestana === 'enviados' ? (
            <PanelDetalle
              com={seleccionado}
              onVolver={() => setViendoDetalle(false)}
            />
          ) : (
            <PanelRespuestaIndividual
              r={respSeleccionada}
              onVolver={() => setViendoDetalle(false)}
              onMarcarLeida={marcarRespuestaLeida}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sheet selección de alumnos ──────────────────────────────────────────────

function SheetSeleccionAlumnos({ estudiantes, seleccionados, setSeleccionados, onClose }) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(
    () => estudiantes.filter(e =>
      `${e.apellido} ${e.nombre}`.toLowerCase().includes(busqueda.toLowerCase())
    ),
    [estudiantes, busqueda]
  )

  const toggleAlumno = (id) =>
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Handle */}
        <div className="flex-shrink-0 pt-3 flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-3 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-marino text-sm">Seleccionar alumnos</h3>
            <p className="text-[11px] text-gray-400">{estudiantes.length} en el aula</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Buscador */}
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            placeholder="Buscar por nombre o apellido…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')}>
              <X size={13} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Chips de seleccionados */}
        {seleccionados.length > 0 && (
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-marino/5">
            <p className="text-[10px] font-semibold text-marino uppercase tracking-wide mb-1.5">
              Seleccionados · {seleccionados.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {estudiantes
                .filter(e => seleccionados.includes(e.id))
                .map(e => (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-marino text-white text-[11px] font-medium"
                  >
                    {e.apellido}
                    <button
                      type="button"
                      onClick={() => toggleAlumno(e.id)}
                      className="ml-0.5 hover:bg-white/25 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-colors"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))
              }
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-gray-50/50 border-b border-gray-50">
          <span className="text-[11px] text-gray-400">
            {seleccionados.length > 0
              ? `${seleccionados.length} de ${estudiantes.length} seleccionados`
              : `${filtrados.length} alumnos`
            }
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSeleccionados(filtrados.map(e => e.id))}
              className="text-[11px] text-marino font-semibold hover:underline"
            >
              Sel. todos
            </button>
            {seleccionados.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={() => setSeleccionados([])}
                  className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
                >
                  Limpiar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Grid de alumnos */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Search size={24} className="mb-2 opacity-40" />
              <p className="text-sm">Sin resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {filtrados.map(e => {
                const checked = seleccionados.includes(e.id)
                const initials = `${e.apellido?.[0] || ''}${e.nombre?.[0] || ''}`.toUpperCase()
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleAlumno(e.id)}
                    className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl border-2 text-left transition-all ${
                      checked
                        ? 'border-marino bg-marino/10 text-marino'
                        : 'border-gray-100 hover:border-gray-200 text-gray-700 bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      checked ? 'bg-marino text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {checked
                        ? <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <span className="text-[10px] font-bold">{initials}</span>
                      }
                    </div>
                    <span className="text-xs leading-tight min-w-0 flex-1 overflow-hidden">
                      <span className="font-semibold block truncate">{e.apellido}</span>
                      <span className="text-gray-400 block truncate">{e.nombre}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer confirmar */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={seleccionados.length === 0}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={15} />
            {seleccionados.length === 0
              ? 'Selecciona al menos un alumno'
              : seleccionados.length === 1
                ? 'Confirmar · 1 alumno'
                : `Confirmar · ${seleccionados.length} alumnos`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Formulario de envío ─────────────────────────────────────────────────────

function FormEnviar({ aula, onEnviado }) {
  const [tipoEnvio,       setTipoEnvio]       = useState('aula')
  const [seleccionados,   setSeleccionados]   = useState([])
  const [estudiantesAula, setEstudiantesAula] = useState([])
  const [asunto,          setAsunto]          = useState('')
  const [mensaje,         setMensaje]         = useState('')
  const [adjunto,         setAdjunto]         = useState(null)
  const [verModal,        setVerModal]        = useState(false)
  const [sheetAlumnos,    setSheetAlumnos]    = useState(false)
  const [enviando,        setEnviando]        = useState(false)
  const [subiendoAdj,     setSubiendoAdj]     = useState(false)

  // Cargar lista de estudiantes del aula
  useEffect(() => {
    api.get('/tutor/mi-aula/estudiantes').then(({ data }) => {
      setEstudiantesAula(data.estudiantes || [])
    }).catch(() => {})
  }, [])

  const enviar = async () => {
    if (!asunto.trim())  { toast.error('El asunto es obligatorio');            return false }
    if (!mensaje.trim()) { toast.error('El mensaje es obligatorio');           return false }
    if (tipoEnvio === 'individual' && seleccionados.length === 0) {
      toast.error('Seleccione al menos un estudiante'); return false
    }
    setEnviando(true)
    try {
      let adjunto_nombre = null
      let adjunto_drive_url = null
      if (adjunto) {
        setSubiendoAdj(true)
        const fd = new FormData()
        fd.append('archivo', adjunto)
        const { data: dr } = await api.post('/tutor/comunicados/subir-adjunto', fd)
        adjunto_nombre    = dr.nombre
        adjunto_drive_url = dr.url
        setSubiendoAdj(false)
      }
      const payload = { tipo_envio: tipoEnvio, asunto, mensaje, adjunto_nombre, adjunto_drive_url }
      if (tipoEnvio === 'individual') payload.estudiantes_ids = seleccionados
      await api.post('/tutor/comunicados/enviar', payload)
      toast.success('Comunicado enviado correctamente')
      setAsunto(''); setMensaje(''); setSeleccionados([]); setAdjunto(null)
      setVerModal(false)
      onEnviado?.()
      return true
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar')
      return false
    } finally {
      setEnviando(false)
      setSubiendoAdj(false)
    }
  }

  const labelBtn = subiendoAdj ? 'Subiendo adjunto...' : enviando ? 'Enviando...' : 'Enviar comunicado'

  const labelDestinatarios = () => {
    if (tipoEnvio === 'aula') {
      return `Este comunicado llegará a todos los apoderados de ${aula?.grado}° ${aula?.seccion}`
    }
    return `Este comunicado llegará a ${seleccionados.length} apoderado${seleccionados.length !== 1 ? 's' : ''}`
  }

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); enviar() }} className="space-y-5">

        {/* Tipo de envío */}
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Tipo de envío</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'aula',       icon: Users, label: 'Toda mi aula',
                desc: aula ? `${aula.grado}° ${aula.seccion} — ${aula.nivel}` : 'Mi aula completa' },
              { id: 'individual', icon: User,  label: 'Estudiantes específicos',
                desc: 'Seleccionar manualmente' },
            ].map(({ id, icon: Icon, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTipoEnvio(id); setSeleccionados([]) }}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  tipoEnvio === id
                    ? 'border-dorado bg-yellow-50 text-marino'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Icon size={17} className={tipoEnvio === id ? 'text-dorado' : ''} />
                <span>{label}</span>
                <span className="text-[10px] font-normal text-gray-400 leading-tight text-center">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selección individual → abre sheet */}
        {tipoEnvio === 'individual' && (
          <div className="card">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Alumnos *
            </label>
            <button
              type="button"
              onClick={() => setSheetAlumnos(true)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                seleccionados.length > 0
                  ? 'border-marino/40 bg-marino/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                seleccionados.length > 0 ? 'bg-marino/10' : 'bg-gray-100'
              }`}>
                <User size={15} className={seleccionados.length > 0 ? 'text-marino' : 'text-gray-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium block ${seleccionados.length > 0 ? 'text-marino' : 'text-gray-500'}`}>
                  {seleccionados.length === 0
                    ? 'Seleccionar alumnos individualmente'
                    : seleccionados.length === 1
                      ? '1 alumno seleccionado'
                      : `${seleccionados.length} alumnos seleccionados`
                  }
                </span>
                {seleccionados.length > 0 && (
                  <span className="text-xs text-gray-400 block truncate mt-0.5">
                    {estudiantesAula
                      .filter(e => seleccionados.includes(e.id))
                      .map(e => e.apellido)
                      .join(', ')
                    }
                  </span>
                )}
              </div>
              <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
            </button>
          </div>
        )}

        {/* Contador */}
        {(tipoEnvio === 'aula' || seleccionados.length > 0) && (
          <div className="flex items-center gap-2.5 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
            <Users size={15} className="text-dorado flex-shrink-0" />
            <p className="text-sm text-marino font-medium">{labelDestinatarios()}</p>
          </div>
        )}

        {/* Contenido */}
        <div className="card space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Asunto <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Asunto del comunicado"
              maxLength={200}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">
                Mensaje <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs tabular-nums ${mensaje.length > MAX_CHARS * 0.9 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {mensaje.length}/{MAX_CHARS}
              </span>
            </div>
            <textarea
              className="input resize-none"
              rows={5}
              value={mensaje}
              onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setMensaje(e.target.value) }}
              placeholder="Escriba el mensaje aquí..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Adjunto <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="flex items-center gap-3">
              <label className="btn-secondary cursor-pointer flex items-center gap-2 text-sm">
                <Paperclip size={14} />
                {adjunto ? adjunto.name : 'Seleccionar archivo'}
                <input type="file" className="hidden" onChange={(e) => setAdjunto(e.target.files[0])} />
              </label>
              {adjunto && (
                <button type="button" onClick={() => setAdjunto(null)} className="text-red-400 hover:text-red-600">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setVerModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Eye size={15} /> Vista previa
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="btn-primary flex items-center gap-2 flex-1 justify-center"
          >
            {enviando
              ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {labelBtn}</>
              : <><Send size={15} /> Enviar comunicado</>
            }
          </button>
        </div>
      </form>

      {/* Sheet selección alumnos */}
      {sheetAlumnos && (
        <SheetSeleccionAlumnos
          estudiantes={estudiantesAula}
          seleccionados={seleccionados}
          setSeleccionados={setSeleccionados}
          onClose={() => setSheetAlumnos(false)}
        />
      )}

      {/* Modal Vista Previa */}
      {verModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-marino">Vista previa</h3>
              <button onClick={() => setVerModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm text-gray-600">
              {tipoEnvio === 'aula' && aula && (
                <p>
                  <span className="font-medium text-gray-700">Para:</span>{' '}
                  Todos los estudiantes de {aula.grado}° {aula.seccion} — {aula.nivel}
                </p>
              )}
              {tipoEnvio === 'individual' && seleccionados.length > 0 && (
                <p>
                  <span className="font-medium text-gray-700">Para:</span>{' '}
                  {estudiantesAula
                    .filter(e => seleccionados.includes(e.id))
                    .map(e => `${e.apellido}, ${e.nombre}`)
                    .join(' · ')
                  }
                </p>
              )}
              {tipoEnvio === 'individual' && seleccionados.length === 0 && (
                <p className="text-red-400">Sin destinatarios seleccionados</p>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="font-semibold text-marino">
                {asunto || <span className="text-gray-300 font-normal italic">Sin asunto</span>}
              </p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {mensaje || <span className="text-gray-300 italic">Sin mensaje</span>}
              </p>
              {adjunto && (
                <p className="text-xs text-dorado flex items-center gap-1.5">
                  <Paperclip size={12} /> {adjunto.name}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setVerModal(false)} className="btn-secondary flex-1">Editar</button>
              <button
                onClick={enviar}
                disabled={enviando}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {enviando
                  ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {labelBtn}</>
                  : <><Send size={15} /> Enviar</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TutorComunicados() {
  const [tab,  setTab]  = useState('enviar')
  const [aula, setAula] = useState(null)
  const [bandejaKey, setBandejaKey] = useState(0)

  useEffect(() => {
    api.get('/tutor/mi-aula').then(({ data }) => setAula(data)).catch(() => {})
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marino">Comunicados</h1>
          {aula && (
            <p className="text-sm text-gray-400 mt-0.5 capitalize">
              {aula.nivel} — {aula.grado}° {aula.seccion}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'enviar',  label: 'Nuevo comunicado' },
          { id: 'bandeja', label: 'Bandeja' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white text-marino shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'enviar' && (
        <FormEnviar
          aula={aula}
          onEnviado={() => {
            setBandejaKey(k => k + 1)
            setTab('bandeja')
          }}
        />
      )}
      {tab === 'bandeja' && <Bandeja key={bandejaKey} />}
    </div>
  )
}
