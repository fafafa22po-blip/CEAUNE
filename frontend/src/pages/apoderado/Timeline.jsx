import { useState, useEffect } from 'react'
import { Calendar, MessageSquare, FileText, CheckCircle, XCircle, BookOpen } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_CFG = {
  asistencia:    { icon: Calendar,     color: 'text-blue-500',   bg: 'bg-blue-50' },
  comunicado:    { icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  observacion:   { icon: BookOpen,     color: 'text-orange-500', bg: 'bg-orange-50' },
  justificacion: { icon: FileText,     color: 'text-purple-500', bg: 'bg-purple-50' },
}

export default function Timeline() {
  const [hijos, setHijos] = useState([])
  const [hijoSeleccionado, setHijoSeleccionado] = useState(null)
  const [eventos, setEventos] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [cargando, setCargando] = useState(true)

  const cargarHijos = async () => {
    try {
      const { data } = await api.get('/apoderado/mis-hijos')
      setHijos(data)
      if (data.length > 0) setHijoSeleccionado(data[0])
    } catch { toast.error('Error al cargar') }
  }

  const cargarTimeline = async () => {
    if (!hijoSeleccionado) return
    setCargando(true)
    try {
      const { data } = await api.get(`/estudiantes/${hijoSeleccionado.id}/timeline`)
      setEventos(data)
    } catch { toast.error('Error al cargar timeline') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargarHijos() }, [])
  useEffect(() => { cargarTimeline() }, [hijoSeleccionado])

  const eventosFiltrados = filtroTipo ? eventos.filter((e) => e.tipo === filtroTipo) : eventos

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-marino">Timeline</h1>

      {hijos.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {hijos.map((h) => (
            <button
              key={h.id}
              onClick={() => setHijoSeleccionado(h)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-colors text-sm ${
                hijoSeleccionado?.id === h.id
                  ? 'border-dorado bg-yellow-50 text-marino font-semibold'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {h.nombre_completo}
            </button>
          ))}
        </div>
      )}

      {/* Filtro tipo */}
      <div className="flex flex-wrap gap-2">
        {[
          { v: '',            label: 'Todo' },
          { v: 'asistencia',  label: 'Asistencia' },
          { v: 'comunicado',  label: 'Comunicados' },
          { v: 'observacion', label: 'Observaciones' },
          { v: 'justificacion', label: 'Justificaciones' },
        ].map(({ v, label }) => (
          <button
            key={v}
            onClick={() => setFiltroTipo(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtroTipo === v ? 'bg-marino text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <span className="animate-spin w-5 h-5 border-2 border-dorado border-t-transparent rounded-full mr-3" />
          Cargando...
        </div>
      ) : eventosFiltrados.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">Sin eventos</div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
          <div className="space-y-4">
            {eventosFiltrados.map((evt, i) => {
              const cfg = TIPO_CFG[evt.tipo] || TIPO_CFG.asistencia
              const Icon = cfg.icon
              return (
                <div key={i} className="relative">
                  <div className={`absolute -left-6 w-6 h-6 rounded-full ${cfg.bg} flex items-center justify-center`}>
                    <Icon size={12} className={cfg.color} />
                  </div>
                  <div className="card ml-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-marino">{evt.titulo}</p>
                        {evt.descripcion && (
                          <p className="text-xs text-gray-500 mt-1">{evt.descripcion}</p>
                        )}
                        {evt.tipo === 'justificacion' && (
                          <div className="flex items-center gap-1 mt-1">
                            {evt.estado === 'aprobada' ? (
                              <span className="badge-verde flex items-center gap-1"><CheckCircle size={10} /> Aprobada</span>
                            ) : evt.estado === 'rechazada' ? (
                              <span className="badge-rojo flex items-center gap-1"><XCircle size={10} /> Rechazada</span>
                            ) : (
                              <span className="badge-amarillo">Pendiente</span>
                            )}
                          </div>
                        )}
                        {evt.tipo === 'comunicado' && !evt.leido && (
                          <span className="badge-rojo text-[10px] mt-1">No leido</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 flex-shrink-0">
                        {evt.fecha ? format(new Date(evt.fecha), "d MMM", { locale: es }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
