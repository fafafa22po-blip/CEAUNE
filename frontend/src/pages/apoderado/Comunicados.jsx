import { useState, useEffect, useRef } from 'react'
import { Paperclip, Send, ChevronLeft, MessageSquare, X, School, Stamp } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nombreCompleto(est) {
  if (!est) return ''
  return `${est.nombre} ${est.apellido}`
}

function iniciales(est) {
  if (!est) return '?'
  return `${est.nombre?.[0] ?? ''}${est.apellido?.[0] ?? ''}`.toUpperCase()
}

function formatFechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isToday(d))     return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM', { locale: es })
}

function formatFechaLarga(iso) {
  if (!iso) return ''
  return format(new Date(iso), "d 'de' MMMM, HH:mm", { locale: es })
}

const AVATAR_NIVEL = {
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100   text-blue-700',
  secundaria: 'bg-amber-100  text-amber-700',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ComunicadosApoderado() {
  const [lista,         setLista]         = useState([])
  const [seleccionado,  setSeleccionado]  = useState(null)
  const [respuesta,     setRespuesta]     = useState('')
  const [adjuntoResp,   setAdjuntoResp]   = useState(null)
  const [enviandoResp,  setEnviandoResp]  = useState(false)
  const [pagina,        setPagina]        = useState(1)
  const [total,         setTotal]         = useState(0)
  const [cargando,      setCargando]      = useState(true)
  const [viendoDetalle, setViendoDetalle] = useState(false)

  const fileRef    = useRef()
  const POR_PAGINA = 20

  // ── Carga lista ─────────────────────────────────────────────────────────────
  const cargarLista = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/apoderado/comunicados', {
        params: { pagina, por_pagina: POR_PAGINA },
      })
      const items = (data.items || data).slice().sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )
      setLista(items)
      setTotal(data.total || items.length)
    } catch {
      toast.error('Error al cargar comunicados')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarLista() }, [pagina])

  // ── Abrir comunicado ────────────────────────────────────────────────────────
  const abrirComunicado = async (item) => {
    try {
      const { data } = await api.get(`/apoderado/comunicados/${item.dest_id}`)
      setSeleccionado(data)
      setRespuesta('')
      setAdjuntoResp(null)
      setViendoDetalle(true)
      setLista((prev) =>
        prev.map((c) => c.dest_id === item.dest_id ? { ...c, leido: true } : c)
      )
    } catch {
      toast.error('Error al abrir comunicado')
    }
  }

  // ── Enviar respuesta ────────────────────────────────────────────────────────
  const handleResponder = async (e) => {
    e.preventDefault()
    if (!respuesta.trim()) return toast.error('Escribe tu respuesta')
    setEnviandoResp(true)
    try {
      let adjunto_nombre    = null
      let adjunto_drive_url = null

      if (adjuntoResp) {
        const fd = new FormData()
        fd.append('archivo', adjuntoResp)
        const { data: driveResult } = await api.post('/comunicados/subir-adjunto', fd)
        adjunto_nombre    = driveResult.nombre
        adjunto_drive_url = driveResult.url
      }

      await api.post(`/apoderado/comunicados/${seleccionado.dest_id}/responder`, {
        mensaje: respuesta,
        adjunto_nombre,
        adjunto_drive_url,
      })

      toast.success('Respuesta enviada')
      setSeleccionado((prev) => ({
        ...prev,
        respuestas: [
          ...(prev.respuestas || []),
          {
            mensaje: respuesta,
            adjunto_nombre,
            adjunto_drive_url,
            created_at: new Date().toISOString(),
            leido_auxiliar: false,
          },
        ],
      }))
      setRespuesta('')
      setAdjuntoResp(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar respuesta')
    } finally {
      setEnviandoResp(false)
    }
  }

  const noLeidos     = lista.filter((c) => !c.leido).length
  const totalPaginas = Math.ceil(total / POR_PAGINA)
  const yaRespondio  = (seleccionado?.respuestas || []).length > 0

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* Título */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-marino">Comunicados</h1>
        {noLeidos > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
            {noLeidos}
          </span>
        )}
      </div>

      {/* Layout split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0" data-tour="comunicados-lista">

        {/* ══ LISTA ══ */}
        <div className={`lg:col-span-2 min-h-0 flex flex-col ${viendoDetalle ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">

            {cargando ? (
              /* Skeleton */
              <div className="flex-1 overflow-hidden divide-y divide-gray-50">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3.5 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                      <div className="h-2 bg-gray-100 rounded w-5/6" />
                    </div>
                  </div>
                ))}
              </div>

            ) : lista.length === 0 ? (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <MessageSquare size={26} className="text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500">Sin comunicados</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Aquí aparecerán los mensajes del colegio
                  </p>
                </div>
              </div>

            ) : (
              /* Lista de mensajes */
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {lista.map((com) => {
                  const est    = com.estudiante
                  const nivel  = est?.nivel || 'primaria'
                  const activo = seleccionado?.dest_id === com.dest_id

                  return (
                    <button
                      key={com.dest_id}
                      onClick={() => abrirComunicado(com)}
                      className={`w-full text-left px-4 py-3.5 transition-all border-l-[3px] ${
                        activo
                          ? 'bg-amber-50 border-dorado'
                          : !com.leido
                          ? 'bg-blue-50/40 border-marino hover:bg-blue-50/60'
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        {/* Avatar con iniciales del estudiante */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_NIVEL[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
                          {iniciales(est)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <p className={`text-sm truncate ${!com.leido ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                              {com.asunto}
                            </p>
                            <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
                              {formatFechaCorta(com.created_at)}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 truncate">
                            {est ? `${nombreCompleto(est)} · ${est.grado}° ${est.seccion}` : ''}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1">
                            {com.tipo === 'circular' && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-marino bg-marino/10 px-1.5 py-0.5 rounded-full">
                                <Stamp size={9} /> Circular
                              </span>
                            )}
                            {com.adjunto_nombre && (
                              <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                <Paperclip size={9} /> Adjunto
                              </span>
                            )}
                            {!com.leido && (
                              <span className="ml-auto w-2 h-2 rounded-full bg-marino" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-400">{pagina} / {totalPaginas}</span>
                <button
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══ DETALLE ══ */}
        <div className={`lg:col-span-3 min-h-0 flex flex-col ${viendoDetalle ? 'flex' : 'hidden lg:flex'}`}>

          {seleccionado ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden animate-in">

              {/* Cabecera marino */}
              <div className="flex items-center gap-3 px-5 py-4 bg-marino text-white flex-shrink-0">
                <button
                  className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  onClick={() => setViendoDetalle(false)}
                >
                  <ChevronLeft size={19} />
                </button>

                <div className="w-9 h-9 rounded-full bg-dorado/25 flex items-center justify-center flex-shrink-0">
                  <School size={16} className="text-dorado" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">
                    {seleccionado.asunto}
                  </p>
                  <p className="text-xs text-white/55 mt-0.5">
                    {formatFechaLarga(seleccionado.created_at)}
                  </p>
                </div>
              </div>

              {/* Cuerpo scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

                {/* Burbuja del mensaje del colegio */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-dorado/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <School size={14} className="text-dorado" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Colegio CEAUNE
                    </p>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3.5">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {seleccionado.mensaje}
                      </p>
                    </div>

                    {/* Adjunto del comunicado */}
                    {seleccionado.adjunto_drive_url && (
                      <a
                        href={seleccionado.adjunto_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 flex items-center gap-2.5 w-fit bg-dorado/10 hover:bg-dorado/20 border border-dorado/25 rounded-xl px-3.5 py-2.5 transition-colors"
                      >
                        <div className="w-7 h-7 bg-dorado rounded-lg flex items-center justify-center flex-shrink-0">
                          <Paperclip size={13} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-marino">Ver documento</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                            {seleccionado.adjunto_nombre}
                          </p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>

                {/* Respuestas del apoderado */}
                {(seleccionado.respuestas || []).length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide px-2">
                        Tu respuesta
                      </span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {seleccionado.respuestas.map((r, i) => (
                      <div key={i} className="flex justify-end gap-2">
                        <div className="max-w-[85%]">
                          <div className="bg-marino text-white rounded-2xl rounded-br-sm px-4 py-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {r.mensaje}
                            </p>
                            {r.adjunto_drive_url && (
                              <a
                                href={r.adjunto_drive_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 mt-2 text-dorado hover:underline"
                              >
                                <Paperclip size={11} />
                                <span className="text-xs truncate max-w-[140px]">{r.adjunto_nombre}</span>
                              </a>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                            <span className="text-[10px] text-gray-400">
                              {r.created_at ? format(new Date(r.created_at), 'HH:mm') : ''}
                            </span>
                            <span className={`text-[10px] ${r.leido_auxiliar ? 'text-dorado' : 'text-gray-300'}`}>
                              {r.leido_auxiliar ? '✓✓' : '✓'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Caja de respuesta ── */}
              {!yaRespondio && (
                <form
                  onSubmit={handleResponder}
                  className="flex-shrink-0 border-t border-gray-100 bg-gray-50/60 px-4 pt-3 pb-3"
                >
                  {/* Preview adjunto */}
                  {adjuntoResp && (
                    <div className="flex items-center gap-2 mb-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                      <Paperclip size={11} className="text-dorado flex-shrink-0" />
                      <span className="text-xs text-gray-600 flex-1 truncate">{adjuntoResp.name}</span>
                      <button type="button" onClick={() => setAdjuntoResp(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <textarea
                      className="input flex-1 resize-none py-2.5 text-sm min-h-[40px] max-h-28"
                      rows={2}
                      value={respuesta}
                      onChange={(e) => setRespuesta(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleResponder(e)
                        }
                      }}
                    />

                    {/* Botón adjuntar */}
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      title="Adjuntar archivo"
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Paperclip size={15} className="text-gray-500" />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => setAdjuntoResp(e.target.files[0] || null)}
                    />

                    {/* Botón enviar */}
                    <button
                      type="submit"
                      disabled={enviandoResp || !respuesta.trim()}
                      title="Enviar respuesta"
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-marino hover:bg-marino/90 disabled:opacity-40 transition-colors"
                    >
                      {enviandoResp
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Send size={15} className="text-white" />
                      }
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-400 mt-1.5 pl-1 select-none">
                    Enter para enviar · Shift + Enter nueva línea
                  </p>
                </form>
              )}

              {/* Ya respondió */}
              {yaRespondio && (
                <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3 bg-gray-50/60 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <p className="text-xs text-gray-500">Respondiste a este comunicado</p>
                </div>
              )}
            </div>

          ) : (
            /* Placeholder cuando no hay selección */
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4 h-full text-center px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <MessageSquare size={28} className="text-gray-200" />
              </div>
              <div>
                <p className="font-semibold text-gray-400">Selecciona un comunicado</p>
                <p className="text-xs text-gray-300 mt-1">
                  Toca un mensaje para leerlo
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
