import { useState, useEffect } from 'react'
import {
  ChevronLeft, ChevronDown, Check, CheckCircle2, MessageSquare, Paperclip,
  Inbox, School, Users, User, Send, Bell, Clock, FileText, Reply,
} from 'lucide-react'
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

// ── Fila de comunicado enviado ────────────────────────────────────────────────
function FilaComunicado({ com, activa, tieneRespuesta, onClick }) {
  const TipoIcon = TIPO_ICON[com.tipo_envio] || School
  const total    = com.total_destinatarios ?? 0
  const leidos   = com.leidos ?? 0
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
          {com.es_solicitud_doc
            ? <FileText size={16} className="text-blue-500" />
            : <TipoIcon size={16} className="text-marino" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">{com.asunto}</p>
            <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
              {formatCorto(com.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-gray-500">{TIPO_LABEL[com.tipo_envio] ?? com.tipo_envio}</p>
            {com.es_solicitud_doc && (
              <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                Solicitud doc.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] ${todosLeyeron ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
              {todosLeyeron ? '✓✓ Todos leyeron' : `${leidos}/${total} leyeron`}
            </span>
            {com.adjunto_nombre && <Paperclip size={10} className="text-dorado flex-shrink-0" />}
            {tieneRespuesta && (
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                {com.es_solicitud_doc ? 'Entregas' : 'Respuesta'}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Panel de recolección de documentos ───────────────────────────────────────
function PanelRecoleccion({ destinatarios, totalDests, comId, recordando, onRecordar }) {
  const [filtro, setFiltro] = useState('todos')

  const entregados = destinatarios.filter(d => (d.respuestas || []).length > 0)
  const pendientes = destinatarios.filter(d => (d.respuestas || []).length === 0)

  const filtrados = filtro === 'entregados' ? entregados
    : filtro === 'pendientes' ? pendientes
    : destinatarios

  const totalConResp  = entregados.length
  const totalSinResp  = (totalDests || destinatarios.length) - totalConResp
  const pct           = totalDests > 0 ? Math.round(totalConResp / totalDests * 100) : 0

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700">
            {totalConResp} de {totalDests || destinatarios.length} documentos recibidos
          </p>
          <span className={`text-sm font-black ${pct === 100 ? 'text-emerald-600' : 'text-gray-500'}`}>
            {pct}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-dorado'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {[
            { key: 'todos',      label: `Todos (${destinatarios.length})` },
            { key: 'entregados', label: `Entregados (${entregados.length})` },
            { key: 'pendientes', label: `Pendientes (${pendientes.length})` },
          ].map(f => (
            <button key={f.key} type="button" onClick={() => setFiltro(f.key)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                filtro === f.key
                  ? 'bg-marino text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {pendientes.length > 0 && (
          <button type="button" onClick={onRecordar} disabled={recordando}
            className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800 disabled:opacity-50 transition-colors flex-shrink-0">
            {recordando
              ? <><span className="animate-spin w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full" /> Enviando...</>
              : <><Bell size={12} /> Recordar ({totalSinResp})</>
            }
          </button>
        )}
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filtrados.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Sin resultados para este filtro</p>
        )}
        {filtrados.map(d => {
          const est       = d.estudiante
          const nivel     = est?.nivel || 'primaria'
          const respuesta = (d.respuestas || [])[0]
          const entregado = !!respuesta

          return (
            <div key={d.id} className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
                {est?.nombre?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate">
                  {est?.nombre} {est?.apellido}
                </p>
              </div>
              {est?.grado && (
                <span className="text-[10px] font-bold bg-marino/10 text-marino px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {est.grado}° {est.seccion}
                </span>
              )}
              {entregado ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                    <CheckCircle2 size={11} /> {formatCorto(respuesta.created_at)}
                  </span>
                  {respuesta.adjunto_drive_url && (
                    <a href={respuesta.adjunto_drive_url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 transition-colors">
                      <Paperclip size={10} /> Ver
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                  <Clock size={10} /> Pendiente
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Panel de detalle de un comunicado enviado ─────────────────────────────────
function PanelDetalle({ com, onVolver }) {
  const [destsExpandido, setDestsExpandido] = useState(false)
  const [filtroDests,    setFiltroDests]    = useState('todos')
  const [recordando,     setRecordando]     = useState(false)

  useEffect(() => {
    setDestsExpandido(false)
    setFiltroDests('todos')
    setRecordando(false)
  }, [com?.id])

  const recordarPendientes = async () => {
    if (!com?.id) return
    setRecordando(true)
    try {
      const pendientes = (com.destinatarios || []).filter(d => !(d.respuestas || []).length)
      await api.post(`/comunicados/${com.id}/recordar`, {
        destinatarios_ids: pendientes.map(d => d.id),
      })
      toast.success(`Recordatorio enviado a ${pendientes.length} apoderados`)
    } catch {
      toast.error('No se pudo enviar el recordatorio')
    } finally {
      setRecordando(false)
    }
  }

  if (!com) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-5 h-full text-center px-8">
        <div className="w-20 h-20 bg-marino/5 rounded-full flex items-center justify-center">
          <MessageSquare size={32} className="text-marino/20" />
        </div>
        <div>
          <p className="font-semibold text-gray-400">Selecciona un comunicado</p>
          <p className="text-xs text-gray-300 mt-1">El detalle y las respuestas aparecerán aquí</p>
        </div>
        <div className="flex gap-6 text-center">
          {[
            { label: 'Ver mensaje',    icon: '📄' },
            { label: 'Ver leídos',     icon: '✓✓' },
            { label: 'Ver respuestas', icon: '💬' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <span className="text-lg opacity-30">{item.icon}</span>
              <span className="text-[10px] text-gray-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const destinatarios = com.destinatarios || []
  const esSolicitud   = com.es_solicitud_doc === true

  const totalDests  = com.total_destinatarios ?? destinatarios.length
  const leidosDests = com.leidos ?? destinatarios.filter(d => d.leido_apoderado).length
  const pct         = totalDests > 0 ? Math.round(leidosDests / totalDests * 100) : 0
  const entregados  = esSolicitud ? destinatarios.filter(d => (d.respuestas || []).length > 0) : []
  const totalResps  = com.respuestas?.length ?? 0

  const destsFiltrados = destinatarios.filter(d => {
    if (filtroDests === 'leidos')    return  d.leido_apoderado
    if (filtroDests === 'no_leidos') return !d.leido_apoderado
    return true
  })

  const esMasivo = com.tipo_envio === 'masivo'
  const aulaGroups = !esSolicitud && esMasivo && destinatarios.length > 0
    ? (() => {
        const map = {}
        destinatarios.forEach(d => {
          const est = d.estudiante
          const key = `${est?.grado}°${est?.seccion}`
          if (!map[key]) map[key] = { key, total: 0, leidos: 0 }
          map[key].total++
          if (d.leido_apoderado) map[key].leidos++
        })
        return Object.values(map).sort((a, b) =>
          a.key.localeCompare(b.key, undefined, { numeric: true })
        )
      })()
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-marino text-white flex-shrink-0">
        <button
          className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
          onClick={onVolver}
        >
          <ChevronLeft size={19} />
        </button>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${esSolicitud ? 'bg-blue-400/30' : 'bg-dorado/25'}`}>
          {esSolicitud
            ? <FileText size={16} className="text-blue-200" />
            : <School size={16} className="text-dorado" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{com.asunto}</p>
          <p className="text-xs text-white/60 mt-0.5">{formatLargo(com.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/90">
            {TIPO_LABEL[com.tipo_envio] ?? com.tipo_envio}
          </span>
          {esSolicitud && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/30 text-blue-100">
              Solicitud doc.
            </span>
          )}
        </div>
      </div>

      {com.cargandoDetalle ? (
        <div className="flex divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 px-4 py-3 space-y-2">
              <div className="h-2 bg-gray-100 rounded w-2/3" />
              <div className="h-5 bg-gray-100 rounded w-1/2" />
              <div className="h-1.5 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-stretch divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Enviado a</p>
            <p className="text-xl font-black text-marino mt-0.5 leading-none">{totalDests}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">destinatarios</p>
          </div>

          <div className="flex-1 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Leídos</p>
            <p className={`text-xl font-black mt-0.5 leading-none ${
              pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-dorado' : 'text-gray-600'
            }`}>
              {leidosDests}
              <span className="text-xs font-semibold text-gray-400 ml-1">({pct}%)</span>
            </p>
            <div className="h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-dorado' : 'bg-gray-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {esSolicitud ? (
            <div className="flex-1 px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Documentos</p>
              <p className={`text-xl font-black mt-0.5 leading-none ${
                entregados.length === totalDests && totalDests > 0 ? 'text-emerald-600' : 'text-blue-600'
              }`}>
                {entregados.length}
                <span className="text-xs font-semibold text-gray-400 ml-1">/{totalDests}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">recibidos</p>
            </div>
          ) : (
            <div className="flex-1 px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Respuestas</p>
              <p className={`text-xl font-black mt-0.5 leading-none ${totalResps > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {totalResps}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">de apoderados</p>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            {esSolicitud ? 'Instrucciones enviadas' : 'Mensaje enviado'}
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{com.mensaje}</p>
          </div>
          {com.adjunto_drive_url && (
            <a href={com.adjunto_drive_url} target="_blank" rel="noopener noreferrer"
              className={`mt-2.5 flex items-center gap-3 w-fit border rounded-xl px-3.5 py-2.5 transition-colors ${
                esSolicitud
                  ? 'bg-blue-50 hover:bg-blue-100 border-blue-200'
                  : 'bg-dorado/10 hover:bg-dorado/20 border-dorado/25'
              }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${esSolicitud ? 'bg-blue-500' : 'bg-dorado'}`}>
                <Paperclip size={13} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${esSolicitud ? 'text-blue-700' : 'text-marino'}`}>
                  {esSolicitud ? 'Documento a firmar' : 'Ver documento'}
                </p>
                {com.adjunto_nombre && (
                  <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{com.adjunto_nombre}</p>
                )}
              </div>
            </a>
          )}
        </div>

        {com.cargandoDetalle && (
          <div className="space-y-2.5 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!com.cargandoDetalle && esSolicitud && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">
              Recolección de documentos
            </p>
            <PanelRecoleccion
              destinatarios={destinatarios}
              totalDests={totalDests}
              comId={com.id}
              recordando={recordando}
              onRecordar={recordarPendientes}
            />
          </div>
        )}

        {!com.cargandoDetalle && !esSolicitud && (
          <>
            {totalDests > 0 && (
              <div>
                <button type="button"
                  onClick={() => setDestsExpandido(v => !v)}
                  className="w-full flex items-center justify-between group mb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide group-hover:text-gray-600 transition-colors">
                    Destinatarios ({totalDests})
                  </p>
                  <span className="text-xs text-marino font-semibold flex items-center gap-1 group-hover:underline">
                    {destsExpandido ? 'Ocultar' : 'Ver lista'}
                    <ChevronDown size={12} className={`transition-transform ${destsExpandido ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {destsExpandido && destinatarios.length > 0 && (
                  aulaGroups ? (
                    <div className="grid grid-cols-2 gap-2">
                      {aulaGroups.map(ag => {
                        const agPct = ag.total > 0 ? Math.round(ag.leidos / ag.total * 100) : 0
                        return (
                          <div key={ag.key} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-marino">{ag.key}</span>
                              <span className={`text-[10px] font-semibold ${agPct === 100 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {ag.leidos}/{ag.total}
                              </span>
                            </div>
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${agPct === 100 ? 'bg-emerald-500' : 'bg-dorado'}`}
                                style={{ width: `${agPct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1 mb-3">
                        {[
                          { key: 'todos',     label: `Todos (${destinatarios.length})` },
                          { key: 'leidos',    label: `Leídos (${destinatarios.filter(d =>  d.leido_apoderado).length})` },
                          { key: 'no_leidos', label: `No leídos (${destinatarios.filter(d => !d.leido_apoderado).length})` },
                        ].map(f => (
                          <button key={f.key} type="button"
                            onClick={() => setFiltroDests(f.key)}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                              filtroDests === f.key
                                ? 'bg-marino text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-0 max-h-52 overflow-y-auto">
                        {destsFiltrados.map((d) => {
                          const est   = d.estudiante
                          const nivel = est?.nivel || 'primaria'
                          return (
                            <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {est?.nombre?.[0] ?? '?'}
                                </div>
                                <span className="text-xs text-gray-700 truncate">
                                  {est?.nombre} {est?.apellido}
                                </span>
                                {est?.grado && (
                                  <span className="text-[10px] font-bold bg-marino text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    {est.grado}° {est.seccion}
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
                    </>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Fila de respuesta individual (inbox de respuestas) ────────────────────────
function FilaRespuesta({ r, activa, onClick }) {
  const est    = r.estudiante
  const nivel  = est?.nivel || 'primaria'
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
        {/* Avatar con punto de no leída */}
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
            {est?.nombre?.[0] ?? '?'}
          </div>
          {noLeida && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Nombre + hora */}
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm truncate ${noLeida ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
              {est?.nombre} {est?.apellido}
            </p>
            <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
              {formatCorto(r.created_at)}
            </span>
          </div>

          {/* Grado */}
          {est?.grado && (
            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
              {est.grado}° {est.seccion}
            </span>
          )}

          {/* Asunto del comunicado al que responde */}
          <p className="text-[11px] text-gray-400 mt-1 truncate">
            Re: {r.asunto}
          </p>

          {/* Preview del mensaje */}
          <p className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${noLeida ? 'text-gray-700' : 'text-gray-400'}`}>
            {r.mensaje}
          </p>
        </div>
      </div>
    </button>
  )
}

// ── Panel de respuesta individual ─────────────────────────────────────────────
function PanelRespuestaIndividual({ r, onVolver, onMarcarLeida }) {
  const [contextoExpandido, setContextoExpandido] = useState(false)

  useEffect(() => {
    setContextoExpandido(false)
  }, [r?.id])

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
        <div className="flex gap-6 text-center">
          {[
            { label: 'Quién respondió', icon: '👤' },
            { label: 'Su mensaje',      icon: '💬' },
            { label: 'El comunicado',   icon: '📄' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <span className="text-lg opacity-30">{item.icon}</span>
              <span className="text-[10px] text-gray-300">{item.label}</span>
            </div>
          ))}
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
          <p className="font-semibold text-sm leading-tight truncate">
            {est?.nombre} {est?.apellido}
          </p>
          <p className="text-xs text-white/60 mt-0.5">
            {est?.grado}° {est?.seccion}
            {est?.nivel && <span className="ml-1 capitalize">· {est.nivel}</span>}
          </p>
        </div>
        <span className="text-[10px] text-white/50 flex-shrink-0 tabular-nums text-right leading-tight">
          {formatLargo(r.created_at)}
        </span>
      </div>

      {/* Estado de lectura — franja bajo el header */}
      <div className={`flex items-center gap-2 px-5 py-2 flex-shrink-0 border-b ${
        r.leido_auxiliar
          ? 'bg-emerald-50 border-emerald-100'
          : 'bg-blue-50 border-blue-100'
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

        {/* Comunicado original (colapsable) */}
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
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {r.mensaje_comunicado}
              </p>
              {r.adjunto_comunicado_url && (
                <a
                  href={r.adjunto_comunicado_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 text-dorado hover:underline"
                >
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
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {r.mensaje}
            </p>
            {r.adjunto_drive_url && (
              <a
                href={r.adjunto_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-dorado hover:underline"
              >
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

// ── Fila pendiente (quien no respondió) ──────────────────────────────────────
function FilaPendiente({ p, activa, onClick }) {
  const est   = p.estudiante
  const nivel = est?.nivel || 'primaria'
  const leyo  = p.leido_apoderado

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 transition-all border-l-[3px] ${
        activa
          ? 'bg-amber-50 border-dorado'
          : leyo
          ? 'bg-amber-50/30 border-amber-300 hover:bg-amber-50/50'
          : 'bg-orange-50/30 border-orange-300 hover:bg-orange-50/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
            {est?.nombre?.[0] ?? '?'}
          </div>
          <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${leyo ? 'bg-amber-400' : 'bg-orange-400'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {est?.nombre} {est?.apellido}
            </p>
            <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
              {formatCorto(p.created_at)}
            </span>
          </div>

          {est?.grado && (
            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
              {est.grado}° {est.seccion}
            </span>
          )}

          <p className="text-[11px] text-gray-400 mt-1 truncate">Re: {p.asunto}</p>

          <p className={`text-xs mt-0.5 font-medium ${leyo ? 'text-amber-600' : 'text-orange-500'}`}>
            {leyo ? 'Leyó pero no respondió' : 'No ha leído el comunicado'}
          </p>
        </div>
      </div>
    </button>
  )
}

// ── Panel de pendiente ────────────────────────────────────────────────────────
function PanelPendiente({ p, onVolver }) {
  const [contextoExpandido, setContextoExpandido] = useState(false)

  useEffect(() => { setContextoExpandido(false) }, [p?.dest_id])

  if (!p) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-5 h-full text-center px-8">
        <div className="w-20 h-20 bg-marino/5 rounded-full flex items-center justify-center">
          <Clock size={32} className="text-marino/20" />
        </div>
        <div>
          <p className="font-semibold text-gray-400">Selecciona un pendiente</p>
          <p className="text-xs text-gray-300 mt-1">Verás el estado de lectura y el comunicado enviado</p>
        </div>
      </div>
    )
  }

  const est  = p.estudiante
  const nivel = est?.nivel || 'primaria'
  const leyo  = p.leido_apoderado

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
          <p className="font-semibold text-sm leading-tight truncate">
            {est?.nombre} {est?.apellido}
          </p>
          <p className="text-xs text-white/60 mt-0.5">
            {est?.grado}° {est?.seccion}
            {est?.nivel && <span className="ml-1 capitalize">· {est.nivel}</span>}
          </p>
        </div>
        <span className="text-[10px] text-white/50 flex-shrink-0 tabular-nums text-right">
          {formatLargo(p.created_at)}
        </span>
      </div>

      {/* Banner de estado */}
      <div className={`flex items-center gap-3 px-5 py-3 flex-shrink-0 border-b ${
        leyo
          ? 'bg-amber-50 border-amber-100'
          : 'bg-orange-50 border-orange-100'
      }`}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${leyo ? 'bg-amber-400' : 'bg-orange-400'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${leyo ? 'text-amber-800' : 'text-orange-700'}`}>
            {leyo ? 'Leyó el comunicado pero no respondió' : 'Aún no ha leído el comunicado'}
          </p>
          {leyo && p.leido_apoderado_at && (
            <p className={`text-[10px] mt-0.5 ${leyo ? 'text-amber-600' : 'text-orange-500'}`}>
              Leyó el {formatLargo(p.leido_apoderado_at)}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
          leyo ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-600'
        }`}>
          Sin respuesta
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* Comunicado original (colapsable) */}
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
                  Comunicado enviado
                </p>
                <p className="text-xs font-semibold text-gray-700 truncate">{p.asunto}</p>
              </div>
            </div>
            <ChevronDown
              size={13}
              className={`text-gray-400 flex-shrink-0 ml-3 transition-transform ${contextoExpandido ? 'rotate-180' : ''}`}
            />
          </button>

          {contextoExpandido && (
            <div className="px-4 py-3.5 border-t border-gray-100">
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {p.mensaje_comunicado}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Bandeja() {
  // ── Tab activa
  const [pestana, setPestana] = useState('enviados')   // 'enviados' | 'respuestas'

  // ── Estado: pestaña Enviados
  const [lista,         setLista]         = useState([])
  const [seleccionado,  setSeleccionado]  = useState(null)
  const [pagina,        setPagina]        = useState(1)
  const [total,         setTotal]         = useState(0)
  const [cargando,      setCargando]      = useState(true)

  // ── Estado: pestaña Respuestas
  const [filtroResp,       setFiltroResp]       = useState('todas')  // 'todas' | 'sin_leer' | 'pendientes'
  const [listaResp,        setListaResp]        = useState([])
  const [respSeleccionada, setRespSeleccionada] = useState(null)
  const [respPagina,       setRespPagina]       = useState(1)
  const [respTotal,        setRespTotal]        = useState(0)
  const [respNoLeidas,     setRespNoLeidas]     = useState(0)
  const [respCargando,     setRespCargando]     = useState(false)
  const [listaPend,        setListaPend]        = useState([])
  const [pendSeleccionada, setPendSeleccionada] = useState(null)
  const [pendPagina,       setPendPagina]       = useState(1)
  const [pendTotal,        setPendTotal]        = useState(0)
  const [pendCargando,     setPendCargando]     = useState(false)

  // ── Móvil: controla si se muestra el panel derecho
  const [viendoDetalle, setViendoDetalle] = useState(false)

  const POR_PAGINA = 20

  // ── Carga comunicados enviados
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

  // ── Carga inbox de respuestas (todas o sin leer)
  const cargarRespuestas = async () => {
    setRespCargando(true)
    try {
      const { data } = await api.get('/comunicados/respuestas', {
        params: { pagina: respPagina, por_pagina: POR_PAGINA, solo_no_leidas: filtroResp === 'sin_leer' },
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

  // ── Carga pendientes (sin respuesta)
  const cargarPendientes = async () => {
    setPendCargando(true)
    try {
      const { data } = await api.get('/comunicados/pendientes', {
        params: { pagina: pendPagina, por_pagina: POR_PAGINA },
      })
      setListaPend(data.items || [])
      setPendTotal(data.total || 0)
    } catch {
      toast.error('Error al cargar los pendientes')
    } finally {
      setPendCargando(false)
    }
  }

  useEffect(() => { cargar() }, [pagina])
  useEffect(() => {
    if (filtroResp !== 'pendientes') cargarRespuestas()
  }, [respPagina, filtroResp])
  useEffect(() => {
    if (filtroResp === 'pendientes') cargarPendientes()
  }, [pendPagina, filtroResp])

  // ── Cambiar pestaña
  const cambiarPestana = (nueva) => {
    setPestana(nueva)
    setViendoDetalle(false)
    if (nueva === 'respuestas') {
      if (filtroResp !== 'pendientes') cargarRespuestas()
      else cargarPendientes()
    }
  }

  // ── Cambiar filtro dentro de la pestaña Respuestas
  const cambiarFiltro = (nuevo) => {
    setFiltroResp(nuevo)
    setViendoDetalle(false)
    setRespSeleccionada(null)
    setPendSeleccionada(null)
    if (nuevo !== 'pendientes') setRespPagina(1)
    else setPendPagina(1)
  }

  // ── Abrir detalle de comunicado enviado
  const abrirDetalle = async (com) => {
    setSeleccionado({ ...com, cargandoDetalle: true, destinatarios: [], respuestas: [] })
    setViendoDetalle(true)
    try {
      const { data: dests } = await api.get(`/comunicados/${com.id}/destinatarios`)
      const respuestas = dests.flatMap(d =>
        (d.respuestas || []).map(r => ({
          ...r,
          estudiante: d.estudiante,
          dest_id:    d.id,
        }))
      )
      setSeleccionado(prev => ({
        ...prev,
        destinatarios:   dests,
        respuestas,
        cargandoDetalle: false,
      }))
      if (respuestas.length > 0) {
        setLista(prev => prev.map(c => c.id === com.id ? { ...c, _tieneRespuesta: true } : c))
      }
    } catch {
      setSeleccionado(prev => ({ ...prev, cargandoDetalle: false }))
    }
  }

  // ── Marcar leída desde PanelRespuestaIndividual
  const marcarRespuestaLeida = async (destId) => {
    try {
      await api.put(`/comunicados/destinatarios/${destId}/marcar-leido`)
      const ahora = new Date().toISOString()
      const cuantasEranNoLeidas = listaResp.filter(r => r.dest_id === destId && !r.leido_auxiliar).length
      setListaResp(prev =>
        prev.map(r => r.dest_id === destId ? { ...r, leido_auxiliar: true, leido_auxiliar_at: ahora } : r)
      )
      setRespSeleccionada(prev =>
        prev?.dest_id === destId ? { ...prev, leido_auxiliar: true, leido_auxiliar_at: ahora } : prev
      )
      setRespNoLeidas(prev => Math.max(0, prev - cuantasEranNoLeidas))
    } catch {
      // no crítico
    }
  }

  const totalPaginas     = Math.ceil(total     / POR_PAGINA)
  const respTotalPaginas = Math.ceil(respTotal / POR_PAGINA)
  const pendTotalPaginas = Math.ceil(pendTotal / POR_PAGINA)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>

      <div className="flex-shrink-0 mb-4">
        <h1 className="text-xl font-bold text-marino">Bandeja</h1>
        <p className="text-sm text-gray-400 mt-0.5">Comunicados enviados y respuestas de apoderados</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">

        {/* ══ PANEL IZQUIERDO ══ */}
        <div className={`lg:col-span-2 min-h-0 flex flex-col ${viendoDetalle ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">

            {/* ── Pestañas ── */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              <button
                onClick={() => cambiarPestana('enviados')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  pestana === 'enviados'
                    ? 'text-marino border-b-2 border-marino'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Enviados
              </button>
              <button
                onClick={() => cambiarPestana('respuestas')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  pestana === 'respuestas'
                    ? 'text-marino border-b-2 border-marino'
                    : 'text-gray-400 hover:text-gray-600'
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

            {/* ══ CONTENIDO: ENVIADOS ══ */}
            {pestana === 'enviados' && (
              <>
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
                    <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                      Anterior
                    </button>
                    <span className="text-xs text-gray-400">{pagina} / {totalPaginas}</span>
                    <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                      Siguiente
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══ CONTENIDO: RESPUESTAS ══ */}
            {pestana === 'respuestas' && (
              <>
                {/* Filtros */}
                <div className="flex gap-1.5 px-4 py-2.5 border-b border-gray-50 flex-shrink-0 flex-wrap">
                  <button
                    onClick={() => cambiarFiltro('todas')}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      filtroResp === 'todas' ? 'bg-marino text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Todas {respTotal > 0 ? `(${respTotal})` : ''}
                  </button>
                  <button
                    onClick={() => cambiarFiltro('sin_leer')}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 ${
                      filtroResp === 'sin_leer' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {filtroResp !== 'sin_leer' && respNoLeidas > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    )}
                    Sin leer {respNoLeidas > 0 ? `(${respNoLeidas})` : ''}
                  </button>
                  <button
                    onClick={() => cambiarFiltro('pendientes')}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 ${
                      filtroResp === 'pendientes' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {filtroResp !== 'pendientes' && pendTotal > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                    )}
                    Pendientes {pendTotal > 0 ? `(${pendTotal})` : ''}
                  </button>
                </div>

                {/* Lista según filtro activo */}
                {filtroResp !== 'pendientes' ? (
                  <>
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
                          {filtroResp === 'sin_leer'
                            ? <CheckCircle2 size={26} className="text-emerald-300" />
                            : <Reply size={26} className="text-gray-300" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-500">
                            {filtroResp === 'sin_leer' ? 'Todo al día' : 'Sin respuestas'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {filtroResp === 'sin_leer'
                              ? 'No tienes respuestas sin leer'
                              : 'Los apoderados aún no han respondido'
                            }
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
                          className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                          Anterior
                        </button>
                        <span className="text-xs text-gray-400">{respPagina} / {respTotalPaginas}</span>
                        <button onClick={() => setRespPagina(p => Math.min(respTotalPaginas, p + 1))} disabled={respPagina === respTotalPaginas}
                          className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {pendCargando ? (
                      <div className="flex-1 overflow-hidden divide-y divide-gray-50">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex gap-3 px-4 py-3.5 animate-pulse">
                            <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
                            <div className="flex-1 space-y-2 py-1">
                              <div className="h-3 bg-gray-100 rounded w-2/3" />
                              <div className="h-2 bg-gray-100 rounded w-1/4" />
                              <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : listaPend.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={26} className="text-emerald-300" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-500">Sin pendientes</p>
                          <p className="text-xs text-gray-400 mt-0.5">Todos los apoderados han respondido</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                        {listaPend.map((p) => (
                          <FilaPendiente
                            key={p.dest_id}
                            p={p}
                            activa={pendSeleccionada?.dest_id === p.dest_id}
                            onClick={() => { setPendSeleccionada(p); setViendoDetalle(true) }}
                          />
                        ))}
                      </div>
                    )}

                    {pendTotalPaginas > 1 && (
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 flex-shrink-0">
                        <button onClick={() => setPendPagina(p => Math.max(1, p - 1))} disabled={pendPagina === 1}
                          className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                          Anterior
                        </button>
                        <span className="text-xs text-gray-400">{pendPagina} / {pendTotalPaginas}</span>
                        <button onClick={() => setPendPagina(p => Math.min(pendTotalPaginas, p + 1))} disabled={pendPagina === pendTotalPaginas}
                          className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
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
          ) : filtroResp === 'pendientes' ? (
            <PanelPendiente
              p={pendSeleccionada}
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
