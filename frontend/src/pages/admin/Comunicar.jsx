import { useState, useEffect } from 'react'
import { Send, Users, User, Eye, Paperclip, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

import { GRADOS_POR_NIVEL, getSecciones, formatGradoSeccion, formatGrado, resolveAulaInicial } from '../../lib/nivelAcademico'
const NIVELES    = ['inicial', 'primaria', 'secundaria']
const LABEL_NIVEL = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' }
const MAX_CHARS  = 1000

export default function AdminComunicar() {
  const [tipoEnvio, setTipoEnvio] = useState('individual')

  // Individual
  const [busqueda,          setBusqueda]          = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando,          setBuscando]          = useState(false)
  const [destinatarios,     setDestinatarios]     = useState([])

  // Por aula
  const [nivel,   setNivel]   = useState('')
  const [grado,   setGrado]   = useState('')
  const [seccion, setSeccion] = useState('')

  // Masivo (array de niveles; vacío = todos)
  const [nivelesMasivo, setNivelesMasivo] = useState([])

  // Contenido
  const [asunto,  setAsunto]  = useState('')
  const [mensaje, setMensaje] = useState('')
  const [adjunto, setAdjunto] = useState(null)

  // UI
  const [verModal,        setVerModal]        = useState(false)
  const [enviando,        setEnviando]        = useState(false)
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false)
  const [contadorApoderados, setContadorApoderados] = useState(null)
  const [cargandoContador,   setCargandoContador]   = useState(false)

  // Contador individual
  useEffect(() => {
    if (tipoEnvio === 'individual')
      setContadorApoderados(destinatarios.length > 0 ? destinatarios.length : null)
    else if (tipoEnvio === 'masivo')
      setContadorApoderados('masivo')
  }, [destinatarios, tipoEnvio])

  // Contador aula
  useEffect(() => {
    if (tipoEnvio !== 'aula') return
    if (!nivel || !grado || !seccion) { setContadorApoderados(null); return }
    const fetch = async () => {
      setCargandoContador(true)
      try {
        const { data } = await api.get('/estudiantes/', { params: { nivel, grado, seccion } })
        setContadorApoderados(Array.isArray(data) ? data.length : (data.total ?? 0))
      } catch {
        setContadorApoderados(null)
      } finally {
        setCargandoContador(false)
      }
    }
    fetch()
  }, [nivel, grado, seccion, tipoEnvio])

  // Búsqueda de estudiantes con debounce
  const buscarEstudiantes = async (q) => {
    if (q.length < 2) { setResultadosBusqueda([]); setBuscando(false); return }
    setBuscando(true)
    try {
      const { data } = await api.get('/estudiantes/', { params: { q } })
      setResultadosBusqueda(data)
    } catch {
      setResultadosBusqueda([])
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => buscarEstudiantes(busqueda), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  const agregarDestinatario = (est) => {
    if (!destinatarios.find(d => d.id === est.id))
      setDestinatarios([...destinatarios, est])
    setBusqueda('')
    setResultadosBusqueda([])
  }

  const quitarDestinatario = (id) =>
    setDestinatarios(destinatarios.filter(d => d.id !== id))

  const toggleNivelMasivo = (n) =>
    setNivelesMasivo(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    )

  const resetForm = () => {
    setBusqueda(''); setResultadosBusqueda([]); setDestinatarios([])
    setNivel(''); setGrado(''); setSeccion('')
    setNivelesMasivo([])
    setAsunto(''); setMensaje(''); setAdjunto(null)
    setContadorApoderados(null)
  }

  const enviarComunicado = async () => {
    if (!asunto.trim())  { toast.error('El asunto es obligatorio'); return false }
    if (!mensaje.trim()) { toast.error('El mensaje es obligatorio'); return false }
    if (tipoEnvio === 'individual' && destinatarios.length === 0) {
      toast.error('Seleccione al menos un destinatario'); return false
    }
    if (tipoEnvio === 'aula' && (!nivel || !grado || !seccion)) {
      toast.error('Seleccione nivel, grado y sección'); return false
    }

    setEnviando(true)
    try {
      let adjunto_nombre    = null
      let adjunto_drive_url = null
      if (adjunto) {
        setSubiendoAdjunto(true)
        const fd = new FormData()
        fd.append('archivo', adjunto)
        const { data: dr } = await api.post('/comunicados/subir-adjunto', fd)
        adjunto_nombre    = dr.nombre
        adjunto_drive_url = dr.url
        setSubiendoAdjunto(false)
      }

      const payload = { tipo_envio: tipoEnvio, asunto, mensaje, adjunto_nombre, adjunto_drive_url }
      if (tipoEnvio === 'individual') {
        payload.estudiantes_ids = destinatarios.map(d => d.id)
      } else if (tipoEnvio === 'aula') {
        payload.nivel = nivel; payload.grado = grado; payload.seccion = seccion
      } else if (tipoEnvio === 'masivo') {
        payload.niveles = nivelesMasivo.length > 0 ? nivelesMasivo : null
      }

      await api.post('/comunicados/enviar', payload)
      toast.success('Comunicado enviado correctamente')
      resetForm()
      setVerModal(false)
      return true
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar')
      return false
    } finally {
      setEnviando(false)
      setSubiendoAdjunto(false)
    }
  }

  const handleEnviar = async (e) => { e.preventDefault(); await enviarComunicado() }

  const labelEstado = subiendoAdjunto ? 'Subiendo adjunto...' : enviando ? 'Enviando...' : 'Enviar comunicado'

  const labelContador = () => {
    if (cargandoContador) return 'Calculando destinatarios...'
    if (contadorApoderados === 'masivo') {
      return nivelesMasivo.length === 0
        ? 'Se enviará a todos los apoderados del colegio'
        : `Se enviará a los apoderados de: ${nivelesMasivo.map(n => LABEL_NIVEL[n]).join(', ')}`
    }
    return `Este comunicado llegará a ${contadorApoderados} apoderado${contadorApoderados !== 1 ? 's' : ''}`
  }

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-xl font-bold text-marino mb-6">Nuevo Comunicado</h1>

      <form onSubmit={handleEnviar} className="space-y-5">

        {/* Tipo de envío */}
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Tipo de envío</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'individual', icon: User,  label: 'Individual', desc: 'A estudiantes específicos' },
              { id: 'aula',       icon: Users, label: 'Por Aula',   desc: 'A un grado y sección'     },
              { id: 'masivo',     icon: Users, label: 'Masivo',     desc: 'A todo el colegio o nivel' },
            ].map(({ id, icon: Icon, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTipoEnvio(id)
                  resetForm()
                  if (id === 'masivo') setContadorApoderados('masivo')
                }}
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

        {/* Individual — buscador de estudiantes */}
        {tipoEnvio === 'individual' && (
          <div className="card space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Destinatarios</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="input pl-9"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar alumno por nombre o DNI..."
              />
              {buscando && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />
              )}
              {!buscando && busqueda.length >= 2 && resultadosBusqueda.length === 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 px-4 py-3 text-sm text-gray-400">
                  Sin resultados para "{busqueda}"
                </div>
              )}
              {resultadosBusqueda.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {resultadosBusqueda.map((est) => (
                    <button
                      key={est.id}
                      type="button"
                      onClick={() => agregarDestinatario(est)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-800">{est.nombre} {est.apellido}</span>
                      <span className="text-gray-400 ml-2 text-xs">
                        {LABEL_NIVEL[est.nivel]} · {formatGradoSeccion(est.nivel, est.grado, est.seccion)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {destinatarios.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {destinatarios.map((d) => (
                  <span key={d.id} className="flex items-center gap-1 bg-marino text-white text-xs px-3 py-1.5 rounded-full">
                    {d.nombre} {d.apellido}
                    <button type="button" onClick={() => quitarDestinatario(d.id)} className="hover:opacity-70 ml-0.5">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Por Aula — nivel + grado + sección */}
        {tipoEnvio === 'aula' && (
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Seleccionar Aula</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                <select
                  className="input"
                  value={nivel}
                  onChange={(e) => { setNivel(e.target.value); setGrado(''); setSeccion('') }}
                >
                  <option value="">Seleccionar...</option>
                  {NIVELES.map(n => <option key={n} value={n}>{LABEL_NIVEL[n]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Grado</label>
                <select
                  className="input"
                  value={grado}
                  onChange={(e) => { setGrado(e.target.value); setSeccion('') }}
                  disabled={!nivel}
                >
                  <option value="">Seleccionar...</option>
                  {(GRADOS_POR_NIVEL[nivel] || []).map(g => <option key={g} value={g}>{formatGrado(nivel, g)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{nivel === 'inicial' ? 'Aula' : 'Sección'}</label>
                <select
                  className="input"
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value)}
                  disabled={!grado}
                >
                  <option value="">Seleccionar...</option>
                  {getSecciones(nivel, grado).map(s => (
                    <option key={s} value={s}>
                      {nivel === 'inicial' ? resolveAulaInicial(grado, s) : s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Masivo — selector de niveles */}
        {tipoEnvio === 'masivo' && (
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Audiencia</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {NIVELES.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleNivelMasivo(n)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                    nivelesMasivo.includes(n)
                      ? 'border-dorado bg-yellow-50 text-marino'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {LABEL_NIVEL[n]}
                </button>
              ))}
            </div>
            {nivelesMasivo.length === 0 && (
              <p className="text-xs text-gray-400">Sin selección = se envía a todos los niveles del colegio</p>
            )}
          </div>
        )}

        {/* Contador de apoderados */}
        {contadorApoderados !== null && (
          <div className="flex items-center gap-2.5 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
            {cargandoContador
              ? <span className="animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full flex-shrink-0" />
              : <Users size={15} className="text-dorado flex-shrink-0" />
            }
            <p className="text-sm text-marino font-medium">{labelContador()}</p>
          </div>
        )}

        {/* Contenido del comunicado */}
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
              ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {labelEstado}</>
              : <><Send size={15} /> Enviar comunicado</>
            }
          </button>
        </div>
      </form>

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
              {tipoEnvio === 'individual' && destinatarios.length > 0 && (
                <p>
                  <span className="font-medium text-gray-700">Para:</span>{' '}
                  {destinatarios.map(d => `${d.nombre} ${d.apellido}`).join(', ')}
                </p>
              )}
              {tipoEnvio === 'individual' && destinatarios.length === 0 && (
                <p className="text-red-400">Sin destinatarios seleccionados</p>
              )}
              {tipoEnvio === 'aula' && nivel && grado && seccion && (
                <p>
                  <span className="font-medium text-gray-700">Para:</span>{' '}
                  {LABEL_NIVEL[nivel]} — {formatGradoSeccion(nivel, grado, seccion)}
                  {typeof contadorApoderados === 'number' && (
                    <span className="text-gray-400 ml-1">— {contadorApoderados} apoderados</span>
                  )}
                </p>
              )}
              {tipoEnvio === 'masivo' && (
                <p>
                  <span className="font-medium text-gray-700">Para:</span>{' '}
                  {nivelesMasivo.length === 0
                    ? 'Todos los apoderados del colegio'
                    : nivelesMasivo.map(n => LABEL_NIVEL[n]).join(', ')
                  }
                </p>
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
                onClick={enviarComunicado}
                disabled={enviando}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {enviando
                  ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {labelEstado}</>
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
