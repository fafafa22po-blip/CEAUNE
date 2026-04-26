import { useState, useEffect, useRef } from 'react'
import { Send, Users, User, Eye, Paperclip, X, Search, Check, CheckCircle2, ScanLine, Camera, FileText } from 'lucide-react'
import { scanDocument, takePhoto, compressImage, esNativo } from '../../lib/documentScanner'
import toast from 'react-hot-toast'
import api from '../../lib/api'

import { GRADOS_POR_NIVEL, getSecciones, formatGradoSeccion, formatGrado, resolveAulaInicial } from '../../lib/nivelAcademico'
const NIVELES    = ['inicial', 'primaria', 'secundaria']
const LABEL_NIVEL = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' }
const MAX_CHARS  = 1000

const nombreEstudiante = (est) =>
  est.nombre_completo ||
  [est.apellido, est.nombre].filter(Boolean).join(' ') ||
  '—'

// ── Bottom sheet: buscar y seleccionar alumnos individuales ─────────────────

function SheetBuscarAlumno({ destinatarios, onAgregar, onQuitar, onConfirmar }) {
  const [busqueda,  setBusqueda]  = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando,  setBuscando]  = useState(false)

  const buscar = async (q) => {
    if (q.length < 2) { setResultados([]); setBuscando(false); return }
    setBuscando(true)
    try {
      const { data } = await api.get('/estudiantes/', { params: { q } })
      setResultados(data)
    } catch {
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => buscar(busqueda), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  const yaSeleccionado = (id) => destinatarios.some(d => d.id === id)

  const toggle = (est) => {
    if (yaSeleccionado(est.id)) onQuitar(est.id)
    else onAgregar(est)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onConfirmar} />

      <div className="relative w-full sm:max-w-lg lg:max-w-xl bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl max-h-[92vh] lg:max-h-[80vh] flex flex-col">

        {/* Handle — solo móvil */}
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center lg:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <h3 className="font-bold text-marino text-sm">Buscar alumnos</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {destinatarios.length > 0
                ? `${destinatarios.length} seleccionado${destinatarios.length !== 1 ? 's' : ''}`
                : 'Escribe para buscar por nombre o DNI'}
            </p>
          </div>
          <button type="button" onClick={onConfirmar}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Buscador */}
        <div className="flex-shrink-0 px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
            placeholder="Nombre, apellido o DNI…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {buscando && (
            <span className="w-4 h-4 border-2 border-dorado border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          {!buscando && busqueda && (
            <button type="button" onClick={() => { setBusqueda(''); setResultados([]) }}>
              <X size={13} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Chips de seleccionados */}
        {destinatarios.length > 0 && (
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-marino/5">
            <p className="text-[10px] font-bold text-marino uppercase tracking-wide mb-2">
              Seleccionados · {destinatarios.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {destinatarios.map(d => (
                <span key={d.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-marino text-white text-[11px] font-medium">
                  <span>{nombreEstudiante(d)}</span>
                  <span className="text-white/50 text-[10px]">
                    {formatGradoSeccion(d.nivel, d.grado, d.seccion)}
                  </span>
                  <button type="button" onClick={() => onQuitar(d.id)}
                    className="ml-0.5 hover:bg-white/25 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-colors">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto">
          {busqueda.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-marino/8 flex items-center justify-center">
                <Search size={24} className="text-marino/30" />
              </div>
              <p className="text-sm text-gray-400">Escribe al menos 2 caracteres<br />para buscar alumnos</p>
            </div>
          ) : !buscando && resultados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <Search size={24} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Sin resultados</p>
              <p className="text-xs text-gray-400">Intenta con otro nombre o DNI</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {resultados.map(est => {
                const seleccionado = yaSeleccionado(est.id)
                return (
                  <button key={est.id} type="button" onClick={() => toggle(est)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      seleccionado ? 'bg-marino/8' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${
                      seleccionado ? 'bg-marino text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {seleccionado
                        ? <svg viewBox="0 0 10 8" className="w-3.5 h-3" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : nombreEstudiante(est).charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight truncate ${
                        seleccionado ? 'text-marino' : 'text-gray-800'
                      }`}>
                        {nombreEstudiante(est)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">DNI {est.dni}</span>
                        <span className="w-px h-3 bg-gray-200 flex-shrink-0" />
                        <span className="text-xs text-gray-400">
                          {LABEL_NIVEL[est.nivel]} · {formatGradoSeccion(est.nivel, est.grado, est.seccion)}
                        </span>
                      </div>
                    </div>
                    {seleccionado && (
                      <span className="w-5 h-5 rounded-full bg-marino flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer confirmar */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
          <button type="button" onClick={onConfirmar} disabled={destinatarios.length === 0}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.98]"
            style={{ background: '#0a1f3d', color: '#c9a227' }}
          >
            <Check size={16} />
            {destinatarios.length === 0
              ? 'Selecciona al menos un alumno'
              : destinatarios.length === 1
                ? 'Confirmar · 1 alumno'
                : `Confirmar · ${destinatarios.length} alumnos`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminComunicar({ onEnviado } = {}) {
  const [tipoEnvio, setTipoEnvio] = useState('individual')

  // Individual
  const [sheetAbierto,  setSheetAbierto]  = useState(false)
  const [destinatarios, setDestinatarios] = useState([])

  // Por aula
  const [nivel,   setNivel]   = useState('')
  const [grado,   setGrado]   = useState('')
  const [seccion, setSeccion] = useState('')

  // Masivo (array de niveles; vacío = todos)
  const [nivelesMasivo, setNivelesMasivo] = useState([])

  // Contenido
  const [asunto,  setAsunto]  = useState('')
  const [mensaje, setMensaje] = useState('')
  const [adjunto,    setAdjunto]    = useState(null)
  const [escaneando, setEscaneando] = useState(false)
  const [tomando,    setTomando]    = useState(false)
  const fileRef = useRef()

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

  const agregarDestinatario = (est) => {
    if (!destinatarios.find(d => d.id === est.id))
      setDestinatarios(prev => [...prev, est])
  }

  const quitarDestinatario = (id) =>
    setDestinatarios(destinatarios.filter(d => d.id !== id))

  const toggleNivelMasivo = (n) =>
    setNivelesMasivo(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    )

  const resetForm = () => {
    setDestinatarios([])
    setSheetAbierto(false)
    setNivel(''); setGrado(''); setSeccion('')
    setNivelesMasivo([])
    setAsunto(''); setMensaje(''); setAdjunto(null)
    setContadorApoderados(null)
  }

  const handleEscanear = async () => {
    setEscaneando(true)
    try {
      const { file } = await scanDocument()
      setAdjunto(file)
    } catch (err) {
      if (err?.code !== 'CANCELLED') toast.error('No se pudo escanear el documento')
    } finally { setEscaneando(false) }
  }

  const handleTomarFoto = async () => {
    setTomando(true)
    try {
      const { file } = await takePhoto()
      setAdjunto(file)
    } catch (err) {
      if (err?.code !== 'CANCELLED') toast.error('No se pudo acceder a la cámara')
    } finally { setTomando(false) }
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
      onEnviado?.()
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

        {/* Individual — sheet de búsqueda */}
        {tipoEnvio === 'individual' && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Destinatarios</p>
              {destinatarios.length > 0 && (
                <span className="text-xs font-semibold text-marino bg-marino/10 px-2.5 py-1 rounded-full">
                  {destinatarios.length} seleccionado{destinatarios.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Chips de seleccionados */}
            {destinatarios.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {destinatarios.map((d) => (
                  <span key={d.id} className="flex items-center gap-1.5 bg-marino text-white text-xs px-3 py-1.5 rounded-xl">
                    <span className="font-semibold">{nombreEstudiante(d)}</span>
                    <span className="text-white/50">·</span>
                    <span className="text-white/65">{formatGradoSeccion(d.nivel, d.grado, d.seccion)}</span>
                    <button type="button" onClick={() => quitarDestinatario(d.id)}
                      className="ml-0.5 hover:opacity-70 transition-opacity">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Botón para abrir el sheet */}
            <button
              type="button"
              onClick={() => setSheetAbierto(true)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                destinatarios.length > 0
                  ? 'border-dashed border-marino/30 hover:border-marino/50 bg-marino/3'
                  : 'border-dashed border-gray-300 hover:border-marino/50 hover:bg-marino/3'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-marino/10 flex items-center justify-center flex-shrink-0">
                <Search size={15} className="text-marino" />
              </div>
              <div>
                <p className="text-sm font-semibold text-marino">
                  {destinatarios.length > 0 ? 'Agregar más alumnos' : 'Buscar alumnos'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Busca por nombre, apellido o DNI</p>
              </div>
            </button>
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
            {adjunto ? (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800 truncate">{adjunto.name}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">{(adjunto.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={() => setAdjunto(null)} className="text-blue-400 hover:text-blue-600">
                  <X size={14} />
                </button>
              </div>
            ) : esNativo ? (
              <div className="space-y-2">
                <button type="button" onClick={handleEscanear} disabled={escaneando || tomando}
                  className="w-full flex items-center gap-3 bg-marino/5 hover:bg-marino/10 border-2 border-marino/20 hover:border-marino/40 rounded-xl px-4 py-3.5 transition-colors">
                  <div className="w-9 h-9 bg-marino rounded-xl flex items-center justify-center flex-shrink-0">
                    {escaneando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ScanLine size={16} className="text-white" />}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-marino">{escaneando ? 'Abriendo escáner...' : 'Escanear documento'}</p>
                    <p className="text-[10px] text-marino/60">Foto con efecto escaneo · multi-página PDF</p>
                  </div>
                </button>
                <button type="button" onClick={handleTomarFoto} disabled={escaneando || tomando}
                  className="w-full flex items-center gap-3 bg-dorado/5 hover:bg-dorado/10 border-2 border-dorado/20 hover:border-dorado/40 rounded-xl px-4 py-3.5 transition-colors">
                  <div className="w-9 h-9 bg-dorado rounded-xl flex items-center justify-center flex-shrink-0">
                    {tomando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={16} className="text-white" />}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-dorado">{tomando ? 'Abriendo cámara...' : 'Tomar foto'}</p>
                    <p className="text-[10px] text-dorado/60">Captura directa con la cámara</p>
                  </div>
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={escaneando || tomando}
                  className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                  <Paperclip size={13} className="text-gray-400" />
                  <p className="text-[11px] text-gray-400">Elegir desde archivos o galería</p>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-3 border-2 border-dashed border-gray-200 hover:border-dorado rounded-xl px-4 py-3 transition-colors group">
                <div className="w-8 h-8 bg-gray-100 group-hover:bg-dorado/10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                  <Paperclip size={14} className="text-gray-400 group-hover:text-dorado transition-colors" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-600">Adjuntar archivo</p>
                  <p className="text-[10px] text-gray-400">PDF, imagen u otro documento</p>
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf"
              onChange={async (e) => {
                const raw = e.target.files[0]
                if (!raw) return setAdjunto(null)
                const file = await compressImage(raw)
                setAdjunto(file)
              }}
            />
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
                  {destinatarios.map(d => nombreEstudiante(d)).join(', ')}
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

      {/* Sheet búsqueda individual */}
      {sheetAbierto && (
        <SheetBuscarAlumno
          destinatarios={destinatarios}
          onAgregar={agregarDestinatario}
          onQuitar={quitarDestinatario}
          onConfirmar={() => setSheetAbierto(false)}
        />
      )}
    </div>
  )
}
