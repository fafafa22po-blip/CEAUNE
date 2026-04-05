import { useState, useEffect } from 'react'
import {
  Send, Users, User, Paperclip, X, Search, ChevronLeft,
  AlertTriangle, Check, Megaphone, MessageSquare, FileText,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { obtenerUsuario } from '../../lib/auth'

const GRADOS_POR_NIVEL = {
  inicial:    ['3', '4', '5'],
  primaria:   ['1', '2', '3', '4', '5', '6'],
  secundaria: ['1', '2', '3', '4', '5'],
}
const NIVEL_POR_ROL = {
  'i-auxiliar': 'inicial',
  'p-auxiliar': 'primaria',
  's-auxiliar': 'secundaria',
}
const SECCIONES = ['A', 'B', 'C', 'D', 'E']
const MAX_CHARS = 1000

const toggleSet = (set, val) => {
  const next = new Set(set)
  next.has(val) ? next.delete(val) : next.add(val)
  return next
}

export default function Comunicar() {
  const location = useLocation()
  const usuario  = obtenerUsuario()
  const nivel    = NIVEL_POR_ROL[usuario?.rol] || 'primaria'
  const gradosDisponibles = GRADOS_POR_NIVEL[nivel]

  const [paso, setPaso]           = useState(1)
  const [tipoEnvio, setTipoEnvio] = useState('individual')

  // Individual
  const [busqueda, setBusqueda]                     = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando, setBuscando]                     = useState(false)
  const [destinatarios, setDestinatarios]           = useState([])

  // Por aula
  const [grado, setGrado]     = useState('')
  const [seccion, setSeccion] = useState('')

  // Masivo
  const [aulasMasivoSet, setAulasMasivoSet] = useState(new Set())

  // Mensaje
  const [tipoComunicado, setTipoComunicado]     = useState('mensaje')   // 'mensaje' | 'solicitud_doc'
  const [permitirRespuestas, setPermitirRespuestas] = useState(true)
  const [asunto, setAsunto]                     = useState('')
  const [mensaje, setMensaje]                   = useState('')
  const [adjunto, setAdjunto]                   = useState(null)
  const [verModal, setVerModal]                 = useState(false)
  const [enviando, setEnviando]                 = useState(false)
  const [subiendoAdjunto, setSubiendoAdjunto]   = useState(false)
  const [contadorApoderados, setContadorApoderados] = useState(null)
  const [cargandoContador, setCargandoContador]     = useState(false)

  // Pre-cargar alumno si viene desde Escanear / Inspección
  useEffect(() => {
    const alumno = location.state?.alumno
    if (alumno) { setTipoEnvio('individual'); setDestinatarios([alumno]) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Contador — individual
  useEffect(() => {
    if (tipoEnvio !== 'individual') return
    setContadorApoderados(destinatarios.length > 0 ? destinatarios.length : null)
  }, [destinatarios, tipoEnvio])

  // Contador — aula
  useEffect(() => {
    if (tipoEnvio !== 'aula') return
    if (!grado || !seccion) { setContadorApoderados(null); return }
    const fetch = async () => {
      setCargandoContador(true)
      try {
        const { data } = await api.get('/estudiantes/', { params: { grado, seccion } })
        setContadorApoderados(Array.isArray(data) ? data.length : (data.total ?? 0))
      } catch {
        setContadorApoderados(null)
      } finally {
        setCargandoContador(false)
      }
    }
    fetch()
  }, [grado, seccion, tipoEnvio])

  // Búsqueda con debounce
  const buscarEstudiantes = async (q) => {
    if (q.length < 2) { setResultadosBusqueda([]); setBuscando(false); return }
    setBuscando(true)
    try {
      const { data } = await api.get('/estudiantes/', { params: { busqueda: q } })
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
    if (!destinatarios.find(d => d.id === est.id)) setDestinatarios([...destinatarios, est])
    setBusqueda('')
    setResultadosBusqueda([])
  }

  const quitarDestinatario = (id) => setDestinatarios(destinatarios.filter(d => d.id !== id))

  const cambiarTipo = (tipo) => {
    setTipoEnvio(tipo)
    setGrado(''); setSeccion('')
    setDestinatarios([])
    setAulasMasivoSet(new Set())
    setContadorApoderados(null)
  }

  // ── Masivo helpers ───────────────────────────────────────────────────────────

  const toggleAulaMasivo = (g, s) =>
    setAulasMasivoSet(prev => toggleSet(prev, `${g}-${s}`))

  const toggleGradoMasivo = (g) => {
    const keys = SECCIONES.map(s => `${g}-${s}`)
    const allSelected = keys.every(k => aulasMasivoSet.has(k))
    setAulasMasivoSet(prev => {
      const next = new Set(prev)
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k))
      return next
    })
  }

  const toggleSeccionMasivo = (s) => {
    const keys = gradosDisponibles.map(g => `${g}-${s}`)
    const allSelected = keys.every(k => aulasMasivoSet.has(k))
    setAulasMasivoSet(prev => {
      const next = new Set(prev)
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k))
      return next
    })
  }

  const toggleTodoMasivo = () => {
    const allKeys = gradosDisponibles.flatMap(g => SECCIONES.map(s => `${g}-${s}`))
    const allSelected = allKeys.every(k => aulasMasivoSet.has(k))
    setAulasMasivoSet(allSelected ? new Set() : new Set(allKeys))
  }

  const aulasMasivo = [...aulasMasivoSet]
    .sort((a, b) => {
      const [ga, sa] = a.split('-')
      const [gb, sb] = b.split('-')
      return ga.localeCompare(gb, undefined, { numeric: true }) || sa.localeCompare(sb)
    })
    .map(k => { const [g, s] = k.split('-'); return `${g}°${s}` })

  const todosSeleccionados = gradosDisponibles.length > 0 &&
    gradosDisponibles.every(g => SECCIONES.every(s => aulasMasivoSet.has(`${g}-${s}`)))

  // ─────────────────────────────────────────────────────────────────────────────

  const avanzar = () => {
    if (tipoEnvio === 'individual' && destinatarios.length === 0) {
      toast.error('Agrega al menos un destinatario'); return
    }
    if (tipoEnvio === 'aula' && (!grado || !seccion)) {
      toast.error('Selecciona el aula completa'); return
    }
    if (tipoEnvio === 'masivo' && aulasMasivoSet.size === 0) {
      toast.error('Selecciona al menos un aula'); return
    }
    setPaso(2)
  }

  const abrirPreview = () => {
    if (!asunto.trim())  { toast.error('El asunto es obligatorio');  return }
    if (!mensaje.trim()) { toast.error('El mensaje es obligatorio'); return }
    if (tipoComunicado === 'solicitud_doc' && !adjunto) {
      toast.error('Debes adjuntar el documento a firmar'); return
    }
    setVerModal(true)
  }

  const enviarComunicado = async () => {
    setEnviando(true)
    try {
      let adjunto_nombre = null, adjunto_drive_url = null
      if (adjunto) {
        setSubiendoAdjunto(true)
        const fd = new FormData()
        fd.append('archivo', adjunto)
        const { data: dr } = await api.post('/comunicados/subir-adjunto', fd)
        adjunto_nombre = dr.nombre; adjunto_drive_url = dr.url
        setSubiendoAdjunto(false)
      }
      const payload = {
        tipo_envio:        tipoEnvio,
        asunto,
        mensaje,
        adjunto_nombre,
        adjunto_drive_url,
        es_solicitud_doc:  tipoComunicado === 'solicitud_doc',
        permite_respuestas: tipoComunicado === 'solicitud_doc' ? true : permitirRespuestas,
      }
      if (tipoEnvio === 'individual') {
        payload.estudiantes_ids = destinatarios.map(d => d.id)
      } else if (tipoEnvio === 'aula') {
        payload.grado = grado; payload.seccion = seccion
      } else if (tipoEnvio === 'masivo') {
        payload.aulas = [...aulasMasivoSet].map(k => {
          const [g, s] = k.split('-')
          return { grado: g, seccion: s }
        })
      }
      await api.post('/comunicados/enviar', payload)
      toast.success('Comunicado enviado correctamente')
      setAsunto(''); setMensaje(''); setDestinatarios([])
      setGrado(''); setSeccion('')
      setAulasMasivoSet(new Set())
      setAdjunto(null)
      setTipoComunicado('mensaje')
      setPermitirRespuestas(true)
      setVerModal(false); setPaso(1)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar')
    } finally {
      setEnviando(false); setSubiendoAdjunto(false)
    }
  }

  const labelEstado = subiendoAdjunto ? 'Subiendo adjunto...' : 'Enviando...'

  const resumenDestinatarios = () => {
    if (tipoEnvio === 'individual') return destinatarios.map(d => d.nombre_completo).join(', ')
    if (tipoEnvio === 'aula')       return `${grado}° Sec. ${seccion}`
    if (aulasMasivo.length <= 8)    return aulasMasivo.join(', ')
    return `${aulasMasivo.length} aulas seleccionadas`
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl">

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            paso === 1 ? 'bg-marino text-white' : 'bg-emerald-500 text-white'
          }`}>
            {paso === 1 ? '1' : <Check size={12} strokeWidth={3} />}
          </div>
          <span className={`text-sm font-semibold ${paso === 1 ? 'text-marino' : 'text-gray-400'}`}>¿A quién?</span>
        </div>
        <div className="flex-1 h-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            paso === 2 ? 'bg-marino text-white' : 'bg-gray-200 text-gray-400'
          }`}>2</div>
          <span className={`text-sm font-semibold ${paso === 2 ? 'text-marino' : 'text-gray-400'}`}>Redactar</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ PASO 1 */}
      {paso === 1 && (
        <div className="space-y-5">

          {/* Tipo de envío */}
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Tipo de envío</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => cambiarTipo('individual')}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  tipoEnvio === 'individual' ? 'border-dorado bg-yellow-50 text-marino' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <User size={17} className={tipoEnvio === 'individual' ? 'text-dorado' : ''} />
                <span>Individual</span>
                <span className="text-[10px] font-normal text-gray-400 leading-tight text-center">Alumnos específicos</span>
              </button>

              <button type="button" onClick={() => cambiarTipo('aula')}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  tipoEnvio === 'aula' ? 'border-dorado bg-yellow-50 text-marino' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <Users size={17} className={tipoEnvio === 'aula' ? 'text-dorado' : ''} />
                <span>Por Aula</span>
                <span className="text-[10px] font-normal text-gray-400 leading-tight text-center">Un grado y sección</span>
              </button>

              <button type="button" onClick={() => cambiarTipo('masivo')}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  tipoEnvio === 'masivo' ? 'border-dorado bg-yellow-50 text-marino' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <Megaphone size={17} className={tipoEnvio === 'masivo' ? 'text-dorado' : ''} />
                <span>Masivo</span>
                <span className="text-[10px] font-normal text-gray-400 leading-tight text-center">Múltiples aulas</span>
              </button>
            </div>
          </div>

          {/* ══ Panel Individual ════════════════════════════════════ */}
          {tipoEnvio === 'individual' && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Buscar alumno</p>
                {destinatarios.length > 0 && (
                  <span className="text-xs font-semibold text-marino bg-marino/10 px-2.5 py-1 rounded-full">
                    {destinatarios.length} seleccionado{destinatarios.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  className="input pl-9"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Busca por nombre completo o DNI..."
                />
                {buscando && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />
                )}

                {!buscando && busqueda.length >= 2 && resultadosBusqueda.length === 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 px-4 py-3 text-sm text-gray-400">
                    Sin resultados para "{busqueda}"
                  </div>
                )}

                {resultadosBusqueda.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden max-h-56 overflow-y-auto">
                    {resultadosBusqueda.map((est) => {
                      const yaAgregado = destinatarios.some(d => d.id === est.id)
                      return (
                        <button key={est.id} type="button"
                          onClick={() => !yaAgregado && agregarDestinatario(est)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
                            yaAgregado ? 'bg-emerald-50 cursor-default' : 'hover:bg-gray-50'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold leading-tight ${yaAgregado ? 'text-emerald-700' : 'text-gray-800'}`}>
                                {est.nombre_completo}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs text-gray-400 font-mono">DNI {est.dni}</span>
                                <span className="w-px h-3 bg-gray-200 flex-shrink-0" />
                                <span className="text-xs text-gray-400">{est.grado}° Sec. {est.seccion}</span>
                              </div>
                            </div>
                            {yaAgregado && (
                              <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                <Check size={11} className="text-white" strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {destinatarios.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {destinatarios.map((d) => (
                    <span key={d.id} className="flex items-center gap-1.5 bg-marino text-white text-xs px-3 py-1.5 rounded-full">
                      <span className="font-medium">{d.nombre_completo}</span>
                      <span className="text-white/55 font-normal">· {d.grado}°{d.seccion}</span>
                      <button type="button" onClick={() => quitarDestinatario(d.id)} className="hover:opacity-70 ml-0.5">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {destinatarios.length === 0 && busqueda.length < 2 && (
                <p className="text-xs text-gray-400 text-center py-1">
                  Escribe mínimo 2 caracteres para buscar
                </p>
              )}
            </div>
          )}

          {/* ══ Panel Por Aula — selector de 2 pasos ═══════════════ */}
          {tipoEnvio === 'aula' && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Seleccionar aula</p>
                {grado && seccion && (
                  <span className="text-xs font-semibold text-marino bg-marino/10 px-2.5 py-1 rounded-full">
                    {grado}° Sec. {seccion}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-marino text-white text-[10px] font-bold">1</span>
                  Elige el grado
                </p>
                <div className="flex flex-wrap gap-2">
                  {gradosDisponibles.map((g) => {
                    const activo = grado === g
                    return (
                      <button key={g} type="button"
                        onClick={() => { setGrado(g); setSeccion('') }}
                        className={`relative px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                          activo
                            ? 'bg-marino border-marino text-white shadow-md shadow-marino/20'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-marino/40 hover:bg-marino/5'
                        }`}>
                        {activo && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-dorado rounded-full flex items-center justify-center">
                            <Check size={8} className="text-white" strokeWidth={3} />
                          </span>
                        )}
                        {g}°
                      </button>
                    )
                  })}
                </div>
              </div>

              {grado ? (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-marino text-white text-[10px] font-bold">2</span>
                    Elige la sección del <strong>{grado}° grado</strong>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {SECCIONES.map((s) => {
                      const activo = seccion === s
                      return (
                        <button key={s} type="button"
                          onClick={() => setSeccion(s)}
                          className={`relative flex flex-col items-center justify-center w-14 py-3 rounded-xl border-2 transition-all ${
                            activo
                              ? 'bg-marino border-marino text-white shadow-md shadow-marino/20 scale-105'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-marino/50 hover:bg-marino/5'
                          }`}>
                          {activo && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-dorado rounded-full flex items-center justify-center shadow-sm">
                              <Check size={9} className="text-white" strokeWidth={3} />
                            </span>
                          )}
                          <span className={`text-lg font-black leading-none ${activo ? 'text-white' : 'text-gray-700'}`}>{s}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-1 border-t border-gray-100 pt-3">
                  Primero selecciona el grado para ver las secciones
                </p>
              )}
            </div>
          )}

          {/* ══ Panel Masivo — Matriz de aulas ══════════════════════ */}
          {tipoEnvio === 'masivo' && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Seleccionar aulas</p>
                <button type="button" onClick={toggleTodoMasivo}
                  className="text-xs text-marino hover:underline font-medium">
                  {todosSeleccionados ? 'Quitar todas' : 'Seleccionar todas'}
                </button>
              </div>

              <p className="text-xs text-gray-400 -mt-2">
                Toca cada aula para seleccionarla. Toca el grado <span className="font-semibold">(fila)</span> o la sección <span className="font-semibold">(columna)</span> para marcar todo de una vez.
              </p>

              <div className="overflow-x-auto">
                <div className="grid gap-1.5 min-w-0"
                  style={{ gridTemplateColumns: `2rem repeat(${SECCIONES.length}, 1fr)` }}>
                  <div />
                  {SECCIONES.map(s => {
                    const colKeys = gradosDisponibles.map(g => `${g}-${s}`)
                    const allCol  = colKeys.every(k => aulasMasivoSet.has(k))
                    const someCol = colKeys.some(k => aulasMasivoSet.has(k))
                    return (
                      <button key={s} type="button"
                        onClick={() => toggleSeccionMasivo(s)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          allCol  ? 'bg-marino/15 text-marino' :
                          someCol ? 'bg-marino/8 text-marino/60' :
                                    'bg-gray-100 text-gray-500 hover:bg-marino/10 hover:text-marino'
                        }`}>{s}</button>
                    )
                  })}
                  {gradosDisponibles.map((g) => {
                    const rowKeys = SECCIONES.map(s => `${g}-${s}`)
                    const allRow  = rowKeys.every(k => aulasMasivoSet.has(k))
                    const someRow = rowKeys.some(k => aulasMasivoSet.has(k))
                    return (
                      <>
                        <button key={`row-${g}`} type="button"
                          onClick={() => toggleGradoMasivo(g)}
                          className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                            allRow  ? 'bg-marino/15 text-marino' :
                            someRow ? 'bg-marino/8 text-marino/60' :
                                      'bg-gray-100 text-gray-500 hover:bg-marino/10 hover:text-marino'
                          }`}>{g}°</button>
                        {SECCIONES.map((s) => {
                          const key    = `${g}-${s}`
                          const activo = aulasMasivoSet.has(key)
                          return (
                            <button key={key} type="button"
                              onClick={() => toggleAulaMasivo(g, s)}
                              className={`relative flex flex-col items-center justify-center h-12 rounded-xl border-2 transition-all ${
                                activo
                                  ? 'bg-marino border-marino text-white shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-marino/40 hover:bg-marino/5'
                              }`}>
                              {activo && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-dorado rounded-full flex items-center justify-center">
                                  <Check size={8} className="text-white" strokeWidth={3} />
                                </span>
                              )}
                              <span className={`text-sm font-black leading-none ${activo ? 'text-white' : 'text-gray-700'}`}>{s}</span>
                              <span className={`text-[9px] mt-0.5 ${activo ? 'text-white/65' : 'text-gray-400'}`}>{g}°</span>
                            </button>
                          )
                        })}
                      </>
                    )
                  })}
                </div>
              </div>

              {aulasMasivo.length > 0 ? (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5">
                  <p className="text-xs font-semibold text-gray-500 mb-2.5">
                    {aulasMasivo.length} aula{aulasMasivo.length !== 1 ? 's' : ''} seleccionada{aulasMasivo.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {aulasMasivo.map(a => (
                      <span key={a} className="text-xs bg-white border border-gray-200 text-gray-600 font-semibold px-2.5 py-1 rounded-lg">{a}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-1">Toca las celdas que quieras incluir</p>
              )}
            </div>
          )}

          {/* Contador */}
          {contadorApoderados !== null && tipoEnvio !== 'masivo' && (
            <div className="flex items-center gap-2 px-1">
              {cargandoContador
                ? <span className="animate-spin w-3.5 h-3.5 border-2 border-dorado border-t-transparent rounded-full flex-shrink-0" />
                : <Users size={13} className="text-dorado flex-shrink-0" />
              }
              <p className="text-xs text-gray-500">
                {cargandoContador
                  ? 'Calculando...'
                  : `${contadorApoderados} apoderado${contadorApoderados !== 1 ? 's' : ''} recibirán este comunicado`
                }
              </p>
            </div>
          )}

          <button type="button" onClick={avanzar} className="btn-primary w-full">
            Continuar →
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ PASO 2 */}
      {paso === 2 && (
        <div className="space-y-5">

          {/* Resumen destinatarios */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            <Users size={13} className="text-gray-400 flex-shrink-0" />
            <p className="text-xs text-gray-500 flex-1 min-w-0">
              <span className="font-semibold text-marino">Para: </span>
              <span className="truncate">{resumenDestinatarios()}</span>
            </p>
            <button type="button" onClick={() => setPaso(1)}
              className="text-xs text-marino hover:underline font-medium flex-shrink-0">
              Cambiar
            </button>
          </div>

          {/* ── Tipo de comunicado ── */}
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Tipo de comunicado</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipoComunicado('mensaje')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                  tipoComunicado === 'mensaje'
                    ? 'border-dorado bg-yellow-50 text-marino'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <MessageSquare size={18} className={tipoComunicado === 'mensaje' ? 'text-dorado flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
                <div>
                  <p className="text-sm font-semibold">Mensaje</p>
                  <p className="text-[10px] font-normal text-gray-400 leading-tight">Comunicado general</p>
                </div>
              </button>

              <button type="button" onClick={() => setTipoComunicado('solicitud_doc')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                  tipoComunicado === 'solicitud_doc'
                    ? 'border-dorado bg-yellow-50 text-marino'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <FileText size={18} className={tipoComunicado === 'solicitud_doc' ? 'text-dorado flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
                <div>
                  <p className="text-sm font-semibold">Solicitud doc.</p>
                  <p className="text-[10px] font-normal text-gray-400 leading-tight">Pedir doc. firmado</p>
                </div>
              </button>
            </div>

            {/* Contexto de solicitud doc */}
            {tipoComunicado === 'solicitud_doc' && (
              <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                <FileText size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  El apoderado verá el documento adjunto, lo firmará y te lo enviará de regreso. En tu bandeja verás quién entregó y quién no.
                </p>
              </div>
            )}
          </div>

          {/* ── Redactar ── */}
          <div className="card space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Asunto <span className="text-red-500">*</span>
              </label>
              <input
                className="input"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder={tipoComunicado === 'solicitud_doc' ? 'Ej: Autorización de salida de campo' : 'Asunto del comunicado'}
                autoFocus
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
                placeholder={tipoComunicado === 'solicitud_doc'
                  ? 'Instrucciones para el apoderado: qué debe hacer, cómo firmar y enviar el documento...'
                  : 'Escriba el mensaje aquí...'}
              />
            </div>

            {/* Adjunto — requerido para solicitud_doc */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {tipoComunicado === 'solicitud_doc' ? (
                  <>Documento a firmar <span className="text-red-500">*</span></>
                ) : (
                  <>Adjunto <span className="text-gray-400 font-normal">(opcional)</span></>
                )}
              </label>
              <div className="flex items-center gap-3">
                <label className={`btn-secondary cursor-pointer flex items-center gap-2 text-sm ${
                  tipoComunicado === 'solicitud_doc' && !adjunto ? 'border-dashed border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100' : ''
                }`}>
                  <Paperclip size={14} />
                  {adjunto ? adjunto.name : (tipoComunicado === 'solicitud_doc' ? 'Seleccionar documento...' : 'Seleccionar archivo')}
                  <input type="file" className="hidden" onChange={(e) => setAdjunto(e.target.files[0] || null)} />
                </label>
                {adjunto && (
                  <button type="button" onClick={() => setAdjunto(null)} className="text-red-400 hover:text-red-600">
                    <X size={16} />
                  </button>
                )}
              </div>
              {tipoComunicado === 'solicitud_doc' && !adjunto && (
                <p className="text-[10px] text-blue-500 mt-1.5">Adjunta el documento PDF o imagen que deben firmar</p>
              )}
            </div>

            {/* Toggle permitir respuestas — solo para tipo mensaje */}
            {tipoComunicado === 'mensaje' && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-700">Permitir respuestas</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Los apoderados podrán responderte</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermitirRespuestas(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    permitirRespuestas ? 'bg-marino' : 'bg-gray-200'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    permitirRespuestas ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setPaso(1)}
              className="btn-secondary flex items-center gap-1.5">
              <ChevronLeft size={15} /> Volver
            </button>
            <button type="button" onClick={abrirPreview}
              className="btn-primary flex items-center gap-2 flex-1 justify-center">
              <Send size={15} /> Revisar y enviar
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ MODAL CONFIRMAR */}
      {verModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-marino">Revisar antes de enviar</h3>
              <button onClick={() => setVerModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Tipo badge en modal */}
            {tipoComunicado === 'solicitud_doc' && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 mb-4">
                <FileText size={14} className="text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-700 font-medium">Solicitud de documento firmado</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Para</p>
              {tipoEnvio === 'masivo' ? (
                <div className="flex flex-wrap gap-1.5">
                  {aulasMasivo.map(a => (
                    <span key={a} className="text-xs bg-white border border-gray-200 text-gray-600 font-semibold px-2.5 py-1 rounded-lg">{a}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-700">
                  {resumenDestinatarios()}
                  {typeof contadorApoderados === 'number' && (
                    <span className="text-gray-400 ml-1.5 text-xs">— {contadorApoderados} apoderado{contadorApoderados !== 1 ? 's' : ''}</span>
                  )}
                </p>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="font-semibold text-marino">{asunto}</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{mensaje}</p>
              {adjunto && (
                <p className="text-xs text-dorado flex items-center gap-1.5">
                  <Paperclip size={12} /> {adjunto.name}
                </p>
              )}
            </div>

            {/* Resumen configuración */}
            <div className="flex flex-wrap gap-2 mt-3">
              {tipoComunicado === 'mensaje' && !permitirRespuestas && (
                <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                  Sin respuestas
                </span>
              )}
              {tipoEnvio === 'masivo' && (
                <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle size={10} /> {aulasMasivo.length} aulas
                </span>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setVerModal(false)} className="btn-secondary flex-1">Editar</button>
              <button onClick={enviarComunicado} disabled={enviando}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
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
