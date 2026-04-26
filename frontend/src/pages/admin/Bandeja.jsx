import { useState, useEffect } from 'react'
import {
  ChevronLeft, Check, CheckCircle2, MessageSquare, Paperclip,
  Inbox, School, Users, User, Send,
} from 'lucide-react'
import { formatGradoSeccion } from '../../lib/nivelAcademico'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_LABEL = { individual: 'Individual', aula: 'Aula', masivo: 'Masivo' }
const TIPO_ICON  = { individual: User, aula: Users, masivo: Send }

const NIVEL_COLOR = {
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100 text-blue-700',
  secundaria: 'bg-amber-100 text-amber-700',
}

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

// ── Fila de la lista ──────────────────────────────────────────────────────────
function FilaComunicado({ com, activa, tieneRespuesta, onClick }) {
  const TipoIcon     = TIPO_ICON[com.tipo_envio] || School
  const total        = com.total_destinatarios ?? 0
  const leidos       = com.leidos ?? 0
  const todosLeyeron = total > 0 && leidos === total

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
          <p className="text-xs text-gray-500 mt-0.5">{TIPO_LABEL[com.tipo_envio] ?? com.tipo_envio}</p>
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

// ── Panel de detalle ──────────────────────────────────────────────────────────
function PanelDetalle({ com, onVolver, onMarcarLeida }) {
  if (!com) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4 h-full text-center px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <MessageSquare size={28} className="text-gray-200" />
        </div>
        <div>
          <p className="font-semibold text-gray-400">Selecciona un comunicado</p>
          <p className="text-xs text-gray-300 mt-1">para ver el detalle y las respuestas</p>
        </div>
      </div>
    )
  }

  const respuestas    = com.respuestas    || []
  const destinatarios = com.destinatarios || []

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
        <div className="w-9 h-9 rounded-full bg-dorado/25 flex items-center justify-center flex-shrink-0">
          <School size={16} className="text-dorado" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{com.asunto}</p>
          <p className="text-xs text-white/60 mt-0.5">{formatLargo(com.created_at)}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/90 flex-shrink-0">
          {TIPO_LABEL[com.tipo_envio] ?? com.tipo_envio}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {/* Mensaje */}
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
              className="mt-2.5 flex items-center gap-3 w-fit bg-dorado/10 hover:bg-dorado/20 border border-dorado/25 rounded-xl px-3.5 py-2.5 transition-colors"
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

        {/* Respuestas */}
        {!com.cargandoDetalle && respuestas.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2">
                Respuestas ({respuestas.length})
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-3">
              {respuestas.map((r) => {
                const est   = r.estudiante
                const nivel = est?.nivel || 'primaria'
                return (
                  <div
                    key={r.id}
                    className={`border rounded-xl p-4 transition-colors ${
                      r.leido_auxiliar ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
                          {est?.nombre?.[0] ?? '?'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-marino leading-tight">
                            {est?.nombre} {est?.apellido}
                          </p>
                          {est?.grado && (
                            <span className="text-[10px] font-bold bg-marino text-white px-1.5 py-0.5 rounded-full">
                              {formatGradoSeccion(est.nivel, est.grado, est.seccion)}
                            </span>
                          )}
                        </div>
                      </div>
                      {!r.leido_auxiliar ? (
                        <button
                          onClick={() => onMarcarLeida(r.dest_id)}
                          className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-800 flex-shrink-0 transition-colors"
                        >
                          <Check size={11} /> Marcar leída
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                          <CheckCircle2 size={11} /> Leída
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{r.mensaje}</p>
                    {r.adjunto_drive_url && (
                      <a
                        href={r.adjunto_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-dorado hover:underline"
                      >
                        <Paperclip size={11} />
                        <span className="text-xs truncate max-w-[160px]">{r.adjunto_nombre || 'Ver adjunto'}</span>
                      </a>
                    )}
                    <p className="text-[10px] text-gray-400 mt-2">{formatCorto(r.created_at)}</p>
                  </div>
                )
              })}
            </div>
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
                      <span className="text-xs text-gray-700 truncate">{est?.nombre} {est?.apellido}</span>
                      {est?.grado && (
                        <span className="text-[10px] font-bold bg-marino text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {formatGradoSeccion(est.nivel, est.grado, est.seccion)}
                        </span>
                      )}
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

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminBandeja({ inTab = false } = {}) {
  const [lista,         setLista]         = useState([])
  const [seleccionado,  setSeleccionado]  = useState(null)
  const [pagina,        setPagina]        = useState(1)
  const [total,         setTotal]         = useState(0)
  const [cargando,      setCargando]      = useState(true)
  const [viendoDetalle, setViendoDetalle] = useState(false)
  const POR_PAGINA = 20

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/comunicados/bandeja', {
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

  useEffect(() => { cargar() }, [pagina]) // eslint-disable-line react-hooks/exhaustive-deps

  const abrirDetalle = async (com) => {
    setSeleccionado({ ...com, cargandoDetalle: true, destinatarios: [], respuestas: [] })
    setViendoDetalle(true)
    try {
      const { data: dests } = await api.get(`/comunicados/${com.id}/destinatarios`)
      const respuestas = dests.flatMap(d =>
        (d.respuestas || []).map(r => ({ ...r, estudiante: d.estudiante, dest_id: d.id }))
      )
      setSeleccionado(prev => ({ ...prev, destinatarios: dests, respuestas, cargandoDetalle: false }))
      if (respuestas.length > 0) {
        setLista(prev => prev.map(c => c.id === com.id ? { ...c, _tieneRespuesta: true } : c))
      }
    } catch {
      setSeleccionado(prev => ({ ...prev, cargandoDetalle: false }))
    }
  }

  const marcarLeida = async (destId) => {
    try {
      await api.put(`/comunicados/destinatarios/${destId}/marcar-leido`)
      setSeleccionado(prev => ({
        ...prev,
        respuestas: (prev.respuestas || []).map(r =>
          r.dest_id === destId ? { ...r, leido_auxiliar: true } : r
        ),
      }))
    } catch {
      // no crítico
    }
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div
      className={inTab ? 'flex flex-col flex-1 min-h-0' : 'flex flex-col'}
      style={inTab ? undefined : { height: 'calc(100vh - 7rem)' }}
    >

      {!inTab && (
        <div className="flex-shrink-0 mb-4">
          <h1 className="text-xl font-bold text-marino">Bandeja de salida</h1>
          <p className="text-sm text-gray-400 mt-0.5">Comunicados enviados a apoderados</p>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">

        {/* Lista */}
        <div className={`lg:col-span-2 min-h-0 flex flex-col ${viendoDetalle ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
            {cargando ? (
              <div className="flex-1 overflow-hidden divide-y divide-gray-50">
                {[...Array(6)].map((_, i) => (
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
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-400">{pagina} / {totalPaginas}</span>
                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detalle */}
        <div className={`lg:col-span-3 min-h-0 flex flex-col ${viendoDetalle ? 'flex' : 'hidden lg:flex'}`}>
          <PanelDetalle
            com={seleccionado}
            onVolver={() => setViendoDetalle(false)}
            onMarcarLeida={marcarLeida}
          />
        </div>
      </div>
    </div>
  )
}
