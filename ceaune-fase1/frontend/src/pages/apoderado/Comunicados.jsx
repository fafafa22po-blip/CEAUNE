import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import api from '../../lib/api'

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ─── Vista detalle + responder ────────────────────────────────────────────────
function DetalleComunicado({ destinatario_id, onVolver }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [respuesta, setRespuesta] = useState('')
  const [enviando,  setEnviando]  = useState(false)
  const [enviado,   setEnviado]   = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    api.get(`/comunicados/apoderado/${destinatario_id}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [destinatario_id])

  const handleResponder = async (e) => {
    e.preventDefault()
    if (!respuesta.trim()) return
    setEnviando(true); setError('')
    try {
      await api.post(`/comunicados/apoderado/${destinatario_id}/responder`, { mensaje: respuesta })
      setRespuesta('')
      setEnviado(true)
      setData(prev => ({ ...prev, tiene_respuesta_mia: true }))
    } catch {
      setError('No se pudo enviar la respuesta. Intente nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!data)   return <p className="text-center text-gray-400 py-12">No se encontró el comunicado</p>

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Volver */}
      <button onClick={onVolver} className="flex items-center gap-2 text-sm text-gray-500 hover:text-ceaune-navy transition-colors">
        ← Volver a comunicados
      </button>

      {/* Comunicado */}
      <div className="card space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-ceaune-navy/10 text-ceaune-navy px-2 py-0.5 rounded-full font-medium capitalize">
              {data.tipo_envio === 'individual' ? 'Individual' : data.tipo_envio === 'aula' ? 'Por aula' : 'Masivo'}
            </span>
            <span className="text-xs text-gray-400">
              Para: {data.estudiante_nombre} {data.estudiante_apellido}
            </span>
          </div>
          <h2 className="text-xl font-bold text-ceaune-navy">{data.asunto}</h2>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(data.created_at).toLocaleString('es-PE', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
          </p>
        </div>

        <div className="border-t border-gray-100" />

        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-4">
          {data.mensaje}
        </div>

        {data.adjunto_nombre && (
          <div className="flex items-center gap-2 text-sm text-ceaune-navy bg-blue-50 rounded-lg px-3 py-2">
            📎 {data.adjunto_nombre}
            {data.adjunto_drive_url && (
              <a href={data.adjunto_drive_url} target="_blank" rel="noreferrer"
                className="ml-auto text-xs text-ceaune-gold hover:underline font-medium">
                Ver archivo
              </a>
            )}
          </div>
        )}
      </div>

      {/* Responder */}
      <div className="card">
        <h3 className="font-semibold text-ceaune-navy mb-3">
          {data.tiene_respuesta_mia ? 'Ya respondiste este comunicado' : 'Responder al comunicado'}
        </h3>

        {enviado && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 mb-3">
            ✅ Tu respuesta fue enviada correctamente.
          </div>
        )}

        {!data.tiene_respuesta_mia || enviado ? (
          <form onSubmit={handleResponder} className="space-y-3">
            <textarea
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)}
              placeholder="Escriba su respuesta aquí..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ceaune-gold text-sm resize-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={enviando || !respuesta.trim()}
              className="btn-gold py-2 px-5 text-sm disabled:opacity-50 flex items-center gap-2">
              {enviando ? <><Spinner /> Enviando...</> : 'Enviar respuesta'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-500">Ya enviaste una respuesta. El auxiliar la revisará pronto.</p>
        )}
      </div>
    </div>
  )
}

// ─── Lista de comunicados ─────────────────────────────────────────────────────
function ListaComunicados({ onAbrir }) {
  const [lista,   setLista]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro,  setFiltro]  = useState('todos')

  const fetchLista = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/comunicados/apoderado/lista')
      setLista(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLista() }, [fetchLista])

  const listafiltrada = lista.filter(c => {
    if (filtro === 'noLeidos') return !c.leido_apoderado
    if (filtro === 'respondidos') return c.tiene_respuesta_mia
    return true
  })

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['todos','Todos'],['noLeidos','No leídos'],['respondidos','Respondidos']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filtro === v ? 'bg-white text-ceaune-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {l}
            {v === 'noLeidos' && lista.filter(c => !c.leido_apoderado).length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {lista.filter(c => !c.leido_apoderado).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {listafiltrada.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">No hay comunicados {filtro === 'noLeidos' ? 'sin leer' : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {listafiltrada.map(c => (
            <button key={c.destinatario_id} onClick={() => onAbrir(c.destinatario_id)}
              className={`w-full text-left rounded-xl px-4 py-3.5 border transition-all hover:shadow-sm ${
                !c.leido_apoderado
                  ? 'bg-ceaune-navy/5 border-ceaune-navy/20 hover:border-ceaune-navy'
                  : 'bg-white border-gray-200 hover:border-ceaune-navy'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!c.leido_apoderado && (
                      <span className="w-2 h-2 rounded-full bg-ceaune-gold shrink-0" />
                    )}
                    <p className={`text-sm truncate ${!c.leido_apoderado ? 'font-bold text-ceaune-navy' : 'font-medium text-gray-700'}`}>
                      {c.asunto}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    Para: {c.estudiante_nombre} {c.estudiante_apellido} ·{' '}
                    {new Date(c.created_at).toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {!c.leido_apoderado && (
                    <span className="text-xs bg-ceaune-gold text-white px-2 py-0.5 rounded-full font-medium">Nuevo</span>
                  )}
                  {c.tiene_respuesta_mia && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Respondido</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ComunicadosApoderado() {
  const [abierto, setAbierto] = useState(null)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {!abierto && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-ceaune-navy">Comunicados</h1>
            <p className="text-gray-400 text-sm mt-0.5">Mensajes enviados por el colegio</p>
          </div>
        )}

        {abierto
          ? <DetalleComunicado destinatario_id={abierto} onVolver={() => setAbierto(null)} />
          : <ListaComunicados onAbrir={setAbierto} />
        }
      </div>
    </Layout>
  )
}
