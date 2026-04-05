import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Send, MessageCircle, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import { abrirWhatsApp } from '../../lib/externo'
import toast from 'react-hot-toast'

const TIPOS = [
  { v: 'academica',  label: 'Académica' },
  { v: 'conductual', label: 'Conductual' },
  { v: 'salud',      label: 'Salud' },
  { v: 'logro',      label: 'Logro' },
  { v: 'otro',       label: 'Otro' },
]

const TIPO_COLOR = {
  academica:  'badge-gris',
  conductual: 'badge-amarillo',
  salud:      'badge-rojo',
  logro:      'badge-verde',
  otro:       'badge-gris',
}

// ─── Tab: Contactar apoderado ────────────────────────────────────────────────
function TabContactar() {
  const [busqueda, setBusqueda] = useState('')
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
  const tutor = `${usuario.nombre} ${usuario.apellido}`

  const { data: lista = [], isLoading } = useQuery({
    queryKey: QK.tutorApoderados,
    queryFn: () => api.get('/tutor/mi-aula/apoderados').then(r => r.data),
  })

  const filtrados = busqueda
    ? lista.filter(e => `${e.nombre} ${e.apellido}`.toLowerCase().includes(busqueda.toLowerCase()))
    : lista

  const enviarWA = (apo, est) => {
    const texto = `Estimado/a ${apo.nombre}, le contactamos respecto a *${est.nombre} ${est.apellido}*.\n\n_${tutor} — CEAUNE_`
    abrirWhatsApp(apo.telefono, texto)
  }

  if (isLoading) return <div className="card text-center py-10 text-gray-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Selecciona un alumno y escríbele al apoderado directamente por WhatsApp.
      </p>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-8"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar alumno..."
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filtrados.map(est => (
            <div key={est.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-marino text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {est.nombre?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{est.apellido}, {est.nombre}</p>
                {est.apoderados.length === 0 && (
                  <p className="text-xs text-gray-400">Sin apoderado registrado</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {est.apoderados.map(apo =>
                  apo.telefono ? (
                    <button
                      key={apo.id}
                      onClick={() => enviarWA(apo, est)}
                      title={`WhatsApp a ${apo.nombre}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <MessageCircle size={12} />
                      {apo.nombre.split(' ')[0]}
                    </button>
                  ) : (
                    <span key={apo.id} className="text-xs text-gray-400">{apo.nombre} (sin tel.)</span>
                  )
                )}
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Sin resultados</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Observaciones ──────────────────────────────────────────────────────
function TabObservaciones() {
  const qc = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null)
  const [tipo, setTipo] = useState('academica')
  const [descripcion, setDescripcion] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)

  const { data: todosEstudiantes = [] } = useQuery({
    queryKey: QK.tutorEstudiantes(),
    queryFn: () => api.get('/tutor/mi-aula/estudiantes').then(r =>
      (r.data.estudiantes ?? []).map(e => ({ ...e, nombre_completo: `${e.nombre} ${e.apellido}` }))
    ),
  })

  const { data: historial = [], isLoading: cargandoHistorial } = useQuery({
    queryKey: QK.tutorObservaciones({}),
    queryFn: () => api.get('/tutor/observaciones').then(r => r.data),
  })

  const crearObservacion = useMutation({
    mutationFn: (body) => api.post('/tutor/observaciones', body),
    onSuccess: () => {
      toast.success('Observación registrada')
      setDescripcion('')
      setEstudianteSeleccionado(null)
      setBusqueda('')
      // Invalida historial y el resumen del Inicio
      qc.invalidateQueries({ queryKey: QK.tutorObservaciones({}) })
      qc.invalidateQueries({ queryKey: QK.tutorObservaciones({ por_pagina: 5 }) })
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al registrar'),
  })

  const sugerencias = busqueda.length >= 2
    ? todosEstudiantes.filter(e => e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()))
    : []

  const seleccionar = (est) => {
    setEstudianteSeleccionado(est)
    setBusqueda(est.nombre_completo)
    setMostrarSugerencias(false)
  }

  const handleEnviar = (e) => {
    e.preventDefault()
    if (!estudianteSeleccionado) return toast.error('Seleccione un alumno')
    if (!descripcion.trim()) return toast.error('La descripción es obligatoria')
    crearObservacion.mutate({
      estudiante_id: estudianteSeleccionado.id,
      tipo,
      descripcion,
      notificar_apoderado: notificar,
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulario */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-marino">Nueva observación</h2>
        <form onSubmit={handleEnviar} className="card space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Alumno</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-8"
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setEstudianteSeleccionado(null); setMostrarSugerencias(true) }}
                onFocus={() => setMostrarSugerencias(true)}
                placeholder="Buscar alumno..."
              />
            </div>
            {mostrarSugerencias && sugerencias.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                {sugerencias.map(est => (
                  <button key={est.id} type="button" onClick={() => seleccionar(est)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                    {est.nombre_completo}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setTipo(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                    tipo === v ? 'border-dorado bg-yellow-50 text-marino' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea className="input resize-none" rows={4} value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Describa la observación..." required />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-dorado" />
            <span className="text-sm text-gray-700">Notificar al apoderado por correo</span>
          </label>

          <button type="submit" disabled={crearObservacion.isPending} className="btn-primary w-full flex items-center justify-center gap-2">
            {crearObservacion.isPending
              ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              : <Send size={15} />}
            {crearObservacion.isPending ? 'Registrando...' : 'Registrar observación'}
          </button>
        </form>
      </div>

      {/* Historial */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-marino">Historial</h2>
        {cargandoHistorial ? (
          <div className="card text-center text-gray-400 py-8 text-sm">Cargando...</div>
        ) : historial.length === 0 ? (
          <div className="card text-center text-gray-400 py-8 text-sm">Sin observaciones registradas</div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {historial.map(obs => (
              <div key={obs.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-marino">{obs.nombre_estudiante}</p>
                    <p className="text-xs text-gray-400">
                      {obs.fecha ? format(new Date(obs.fecha), "d 'de' MMM yyyy", { locale: es }) : obs.fecha}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={TIPO_COLOR[obs.tipo] || 'badge-gris'}>{obs.tipo}</span>
                    {obs.correo_enviado && <Mail size={13} className="text-dorado" />}
                  </div>
                </div>
                <p className="text-sm text-gray-700">{obs.descripcion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Observaciones() {
  const location = useLocation()
  const [tab, setTab] = useState(location.state?.tab || 'contactar')

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-marino">Observaciones y Comunicación</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'contactar',     label: 'Contactar apoderado' },
          { id: 'observaciones', label: 'Observaciones' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-marino shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'contactar'     && <TabContactar />}
      {tab === 'observaciones' && <TabObservaciones />}
    </div>
  )
}
