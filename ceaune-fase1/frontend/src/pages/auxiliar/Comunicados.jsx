import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import api from '../../lib/api'

const GRADOS  = ['1ro', '2do', '3ro', '4to', '5to']
const SECCIONES = ['A', 'B', 'C', 'D', 'E']

const TIPO_LABEL = { individual: 'Individual', aula: 'Por aula', masivo: 'Masivo' }

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium text-white flex items-center gap-2 ${ok ? 'bg-green-600' : 'bg-red-600'}`}>
      {ok ? '✅' : '❌'} {msg}
    </div>
  )
}

// ─── Modal Detalle ────────────────────────────────────────────────────────────
function ModalDetalle({ comunicadoId, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/comunicados/${comunicadoId}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [comunicadoId])

  const marcarLeida = async (comunicadoId, respuestaId) => {
    await api.patch(`/comunicados/${comunicadoId}/respuestas/${respuestaId}/leida`)
    setData(prev => ({
      ...prev,
      respuestas: prev.respuestas.map(r =>
        r.id === respuestaId ? { ...r, leido_auxiliar: true } : r
      ),
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="bg-ceaune-navy text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <h3 className="font-semibold">Detalle del comunicado</h3>
          <button onClick={onClose} className="text-blue-200 hover:text-white text-lg">✕</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data ? (
          <p className="text-center py-8 text-gray-400">No se pudo cargar</p>
        ) : (
          <div className="p-6 space-y-5">
            {/* Encabezado */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Asunto</p>
              <p className="font-semibold text-ceaune-navy text-lg">{data.asunto}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(data.created_at).toLocaleString('es-PE')} · {TIPO_LABEL[data.tipo_envio]}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {data.mensaje}
            </div>

            {/* Destinatarios */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Destinatarios ({data.destinatarios.length})
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {data.destinatarios.map(d => (
                  <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 text-sm">
                    <span className="font-medium text-gray-800">
                      {d.estudiante_nombre} {d.estudiante_apellido}
                      <span className="ml-2 text-gray-400 font-normal text-xs">{d.estudiante_grado} &apos;{d.estudiante_seccion}&apos;</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {d.correo_enviado
                        ? <span className="text-xs text-green-600">✉ enviado</span>
                        : <span className="text-xs text-gray-400">sin correo</span>}
                      {d.leido_apoderado
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Leído</span>
                        : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pendiente</span>}
                      {d.tiene_respuesta && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Respondió</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Respuestas */}
            {data.respuestas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Respuestas de apoderados ({data.respuestas.length})
                </p>
                <div className="space-y-2">
                  {data.respuestas.map(r => {
                    const dest = data.destinatarios.find(d => d.id === r.destinatario_id)
                    return (
                      <div key={r.id} className={`rounded-xl p-4 border ${r.leido_auxiliar ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-medium text-gray-600">
                            {dest ? `${dest.estudiante_nombre} ${dest.estudiante_apellido}` : 'Apoderado'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(r.created_at).toLocaleString('es-PE')}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.mensaje}</p>
                        {!r.leido_auxiliar && (
                          <button
                            onClick={() => marcarLeida(data.id, r.id)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Marcar como leída
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button onClick={onClose} className="w-full btn-navy py-2 text-sm">Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Enviar ──────────────────────────────────────────────────────────────
function TabEnviar({ onEnviado }) {
  const [tipo,     setTipo]     = useState('aula')
  const [asunto,   setAsunto]   = useState('')
  const [mensaje,  setMensaje]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Individual
  const [alumnos,   setAlumnos]   = useState([])
  const [busqueda,  setBusqueda]  = useState('')
  const [seleccion, setSeleccion] = useState([]) // [{id, nombre, apellido, grado, seccion}]

  // Aula
  const [grado,   setGrado]   = useState('1ro')
  const [seccion, setSeccion] = useState('A')

  // Masivo
  const [aulasSeleccionadas, setAulasSeleccionadas] = useState([]) // ["1ro-A"]

  useEffect(() => {
    if (tipo === 'individual') {
      api.get('/estudiantes/').then(r => setAlumnos(r.data)).catch(() => {})
    }
  }, [tipo])

  const alumnosFiltrados = alumnos.filter(a => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return `${a.nombre} ${a.apellido} ${a.dni}`.toLowerCase().includes(q)
  }).slice(0, 8)

  const toggleAlumno = (a) => {
    setSeleccion(prev =>
      prev.find(x => x.id === a.id)
        ? prev.filter(x => x.id !== a.id)
        : [...prev, a]
    )
  }

  const toggleAula = (key) => {
    setAulasSeleccionadas(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!asunto.trim() || !mensaje.trim()) {
      setError('El asunto y el mensaje son obligatorios')
      return
    }
    if (tipo === 'individual' && seleccion.length === 0) {
      setError('Seleccione al menos un alumno')
      return
    }
    if (tipo === 'masivo' && aulasSeleccionadas.length === 0) {
      setError('Seleccione al menos un aula')
      return
    }

    setLoading(true)
    try {
      const payload = { tipo_envio: tipo, asunto, mensaje }
      if (tipo === 'individual') payload.estudiante_ids = seleccion.map(a => a.id)
      if (tipo === 'aula') { payload.grado = grado; payload.seccion = seccion }
      if (tipo === 'masivo') {
        payload.aulas = aulasSeleccionadas.map(k => {
          const [g, s] = k.split('-')
          return { grado: g, seccion: s }
        })
      }
      const { data } = await api.post('/comunicados/enviar', payload)
      setAsunto(''); setMensaje(''); setSeleccion([]); setAulasSeleccionadas([])
      onEnviado(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ceaune-gold text-sm"

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

      {/* Tipo */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo de envío</p>
        <div className="flex gap-2">
          {[['individual','Individual'],['aula','Por aula'],['masivo','Masivo']].map(([v, l]) => (
            <button key={v} type="button"
              onClick={() => setTipo(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                tipo === v
                  ? 'bg-ceaune-navy text-white border-ceaune-navy'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-ceaune-navy'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Destinatarios según tipo */}
      {tipo === 'individual' && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Alumnos</p>
          <input
            type="text" placeholder="Buscar por nombre o DNI..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className={inputCls}
          />
          {busqueda && (
            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
              {alumnosFiltrados.length === 0
                ? <p className="text-sm text-gray-400 px-3 py-2">Sin resultados</p>
                : alumnosFiltrados.map(a => {
                    const sel = seleccion.find(x => x.id === a.id)
                    return (
                      <button key={a.id} type="button"
                        onClick={() => { toggleAlumno(a); setBusqueda('') }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between items-center ${sel ? 'bg-ceaune-gold/10' : ''}`}
                      >
                        <span>{a.nombre} {a.apellido}</span>
                        <span className="text-gray-400 text-xs">{a.grado} &apos;{a.seccion}&apos;</span>
                      </button>
                    )
                  })
              }
            </div>
          )}
          {seleccion.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {seleccion.map(a => (
                <span key={a.id} className="flex items-center gap-1 bg-ceaune-navy text-white text-xs px-2.5 py-1 rounded-full">
                  {a.nombre} {a.apellido}
                  <button type="button" onClick={() => toggleAlumno(a)} className="text-blue-300 hover:text-white ml-0.5">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {tipo === 'aula' && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aula</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grado</label>
              <select value={grado} onChange={e => setGrado(e.target.value)} className={inputCls}>
                {GRADOS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sección</label>
              <select value={seccion} onChange={e => setSeccion(e.target.value)} className={inputCls}>
                {SECCIONES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {tipo === 'masivo' && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Aulas ({aulasSeleccionadas.length} seleccionadas)
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {GRADOS.map(g => SECCIONES.map(s => {
              const key = `${g}-${s}`
              const sel = aulasSeleccionadas.includes(key)
              return (
                <button key={key} type="button" onClick={() => toggleAula(key)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    sel ? 'bg-ceaune-navy text-white border-ceaune-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-ceaune-navy'
                  }`}
                >
                  {g}{s}
                </button>
              )
            }))}
          </div>
        </div>
      )}

      <div className="border-t border-dashed border-gray-200" />

      {/* Asunto y mensaje */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
        <input type="text" value={asunto} onChange={e => setAsunto(e.target.value)}
          placeholder="Asunto del comunicado" maxLength={200} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)}
          placeholder="Escriba el comunicado aquí..." rows={6}
          className={`${inputCls} resize-none`} />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
        📎 <strong>Adjuntos (Google Drive):</strong> próximamente disponible.
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full btn-gold py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <><Spinner /> Enviando...</> : 'Enviar comunicado'}
      </button>
    </form>
  )
}

// ─── Tab: Bandeja ─────────────────────────────────────────────────────────────
function TabBandeja() {
  const [lista,    setLista]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [detalle,  setDetalle]  = useState(null)
  const [pagina,   setPagina]   = useState(0)
  const POR_PAG = 20

  const fetchBandeja = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/comunicados/bandeja?skip=${pagina * POR_PAG}&limit=${POR_PAG}`)
      setLista(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [pagina])

  useEffect(() => { fetchBandeja() }, [fetchBandeja])

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  if (lista.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-sm">No has enviado comunicados aún</p>
    </div>
  )

  return (
    <>
      <div className="space-y-2">
        {lista.map(c => (
          <button key={c.id} onClick={() => setDetalle(c.id)}
            className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-ceaune-navy hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.tipo_envio === 'individual' ? 'bg-blue-100 text-blue-700' :
                    c.tipo_envio === 'aula'       ? 'bg-teal-100 text-teal-700' :
                                                    'bg-purple-100 text-purple-700'
                  }`}>
                    {TIPO_LABEL[c.tipo_envio]}
                  </span>
                  {c.respuestas_sin_leer > 0 && (
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                      {c.respuestas_sin_leer} resp. nueva{c.respuestas_sin_leer > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-gray-800 truncate">{c.asunto}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(c.created_at).toLocaleString('es-PE')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-ceaune-navy">{c.leidos}/{c.total_destinatarios}</p>
                <p className="text-xs text-gray-400">leídos</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {(pagina > 0 || lista.length === POR_PAG) && (
        <div className="flex justify-between mt-4">
          <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
            className="btn-navy py-1.5 px-4 text-sm disabled:opacity-40">
            ← Anterior
          </button>
          <button disabled={lista.length < POR_PAG} onClick={() => setPagina(p => p + 1)}
            className="btn-navy py-1.5 px-4 text-sm disabled:opacity-40">
            Siguiente →
          </button>
        </div>
      )}

      {detalle && <ModalDetalle comunicadoId={detalle} onClose={() => { setDetalle(null); fetchBandeja() }} />}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Comunicados() {
  const [tab,   setTab]   = useState('enviar')
  const [toast, setToast] = useState(null)

  const handleEnviado = (data) => {
    setToast({ ok: true, msg: `Comunicado enviado a ${data.total_destinatarios} alumno(s) · ${data.correos_enviados} correo(s) enviado(s)` })
    setTab('bandeja')
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ceaune-navy">Comunicados</h1>
          <p className="text-gray-400 text-sm mt-0.5">Envíe comunicados a apoderados y revise su bandeja</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {[['enviar','Enviar'],['bandeja','Bandeja']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === v ? 'bg-white text-ceaune-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'bandeja' ? '📥 ' : '📤 '}{l}
            </button>
          ))}
        </div>

        {tab === 'enviar'  && <TabEnviar onEnviado={handleEnviado} />}
        {tab === 'bandeja' && <TabBandeja />}

      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </Layout>
  )
}
