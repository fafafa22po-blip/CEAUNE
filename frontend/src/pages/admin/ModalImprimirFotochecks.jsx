import { useState, useEffect } from 'react'
import { X, Printer, Loader2, Users, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import CarnetRecojo from '../../components/CarnetRecojo'
import { imprimirFotochecks } from '../../utils/imprimirFotochecks'
import { GRADOS_POR_NIVEL, getSecciones, formatGradoSeccion } from '../../lib/nivelAcademico'

async function fetchQrSolo(personaId) {
  const { data } = await api.get(`/recojo/admin/${personaId}/qr-solo`)
  return data.imagen_base64
}

export default function ModalImprimirFotochecks({ onClose, personaInicial = null }) {
  const modoInicial = personaInicial ? 'individual' : 'seccion'
  const [modo, setModo]     = useState(modoInicial)
  const [filtro, setFiltro] = useState({ nivel: 'inicial', grado: '', seccion: '' })
  const [items, setItems]   = useState([])   // [{ persona, qrBase64 }]
  const [cargando, setCargando] = useState(false)

  // Individual: cargar automático cuando viene persona
  useEffect(() => {
    if (modo !== 'individual' || !personaInicial) return
    let cancelado = false
    setCargando(true)
    setItems([])
    fetchQrSolo(personaInicial.id)
      .then(qrBase64 => {
        if (!cancelado) setItems([{ persona: personaInicial, qrBase64 }])
      })
      .catch(() => { if (!cancelado) toast.error('Error al cargar el QR') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [modo, personaInicial])

  const cargarSeccion = async () => {
    const { nivel, grado, seccion } = filtro
    if (!nivel || !grado || !seccion) return toast.error('Selecciona nivel, grado y sección')
    setCargando(true)
    setItems([])
    try {
      const { data } = await api.get('/recojo/admin/solicitudes', {
        params: { estado: 'activo', nivel, grado, seccion },
      })
      if (data.length === 0) {
        toast.error('No hay fotochecks activos para esta sección')
        setCargando(false)
        return
      }
      // Cargar QR de cada persona en paralelo
      const resultados = await Promise.all(
        data.map(async (persona) => {
          try {
            const qrBase64 = await fetchQrSolo(persona.id)
            return { persona, qrBase64 }
          } catch {
            return { persona, qrBase64: null }
          }
        })
      )
      setItems(resultados)
    } catch {
      toast.error('Error al cargar los fotochecks')
    } finally {
      setCargando(false)
    }
  }

  const handleImprimir = async () => {
    if (items.length === 0) return
    const datos = items.map(({ persona, qrBase64 }) => ({ ...persona, qrBase64 }))
    await imprimirFotochecks(datos)
  }

  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo)
    setItems([])
    setFiltro({ nivel: 'inicial', grado: '', seccion: '' })
  }

  const listo = items.length > 0 && !cargando
  const secciones = getSecciones(filtro.nivel, filtro.grado)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-marino" />
            <h3 className="font-bold text-marino text-base">
              {personaInicial
                ? `Fotocheck — ${personaInicial.nombre} ${personaInicial.apellido}`
                : 'Imprimir Fotochecks de Recojo'
              }
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs — solo cuando no es individual directo */}
        {!personaInicial && (
          <div className="flex border-b border-gray-100 px-5">
            {[
              { key: 'seccion',    label: 'Por Sección' },
              { key: 'individual', label: 'Individual'  },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => cambiarModo(key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  modo === key
                    ? 'border-dorado text-marino'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">

          {/* Panel filtro — Por sección */}
          {modo === 'seccion' && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {/* Nivel */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                  <select
                    className="input"
                    value={filtro.nivel}
                    onChange={e => setFiltro({ nivel: e.target.value, grado: '', seccion: '' })}
                  >
                    <option value="inicial">Inicial</option>
                    <option value="primaria">Primaria</option>
                    <option value="secundaria">Secundaria</option>
                  </select>
                </div>
                {/* Grado */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {filtro.nivel === 'inicial' ? 'Edad' : 'Grado'}
                  </label>
                  <select
                    className="input"
                    value={filtro.grado}
                    onChange={e => setFiltro({ ...filtro, grado: e.target.value, seccion: '' })}
                    disabled={!filtro.nivel}
                  >
                    <option value="">Seleccionar...</option>
                    {(GRADOS_POR_NIVEL[filtro.nivel] || []).map(g => (
                      <option key={g} value={g}>
                        {filtro.nivel === 'inicial' ? `${g} años` : `${g}°`}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Sección / Aula */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {filtro.nivel === 'inicial' ? 'Aula' : 'Sección'}
                  </label>
                  <select
                    className="input"
                    value={filtro.seccion}
                    onChange={e => setFiltro({ ...filtro, seccion: e.target.value })}
                    disabled={!filtro.grado}
                  >
                    <option value="">Seleccionar...</option>
                    {secciones.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={cargarSeccion}
                disabled={cargando || !filtro.nivel || !filtro.grado || !filtro.seccion}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {cargando
                  ? <><Loader2 size={14} className="animate-spin" /> Cargando fotochecks...</>
                  : <><Users size={14} /> Cargar Fotochecks</>
                }
              </button>
            </div>
          )}

          {/* Individual: mensaje si no hay persona */}
          {modo === 'individual' && !personaInicial && (
            <div className="text-sm text-gray-400 text-center py-8">
              Usa el botón "Imprimir fotocheck" desde la tarjeta de cada persona.
            </div>
          )}

          {/* Cargando individual */}
          {modo === 'individual' && cargando && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 size={16} className="animate-spin" />
              Preparando fotocheck...
            </div>
          )}

          {/* Vista previa */}
          {items.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                <Users size={12} />
                <span>
                  {items.length} fotocheck{items.length !== 1 ? 's' : ''} — vista previa
                  {items.length > 2 && ' (scroll para ver todos)'}
                </span>
              </p>
              <div className="flex flex-wrap gap-4">
                {items.map(({ persona, qrBase64 }, i) => (
                  <div
                    key={persona.id || i}
                    style={{
                      transform: 'scale(0.55)',
                      transformOrigin: 'top left',
                      marginBottom: '-185px',
                    }}
                  >
                    <CarnetRecojo persona={persona} qrBase64={qrBase64} />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {listo
              ? `${items.length} fotocheck${items.length !== 1 ? 's' : ''} — A4, 2×3 por hoja, guías de corte`
              : cargando
                ? 'Obteniendo datos...'
                : 'Configura el filtro y carga los fotochecks'
            }
          </p>
          <div className="flex items-center gap-2">
            {listo && modo === 'seccion' && (
              <button
                onClick={cargarSeccion}
                className="btn-secondary text-sm flex items-center gap-1.5"
                title="Recargar"
              >
                <RefreshCw size={13} />
              </button>
            )}
            <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
            <button
              onClick={handleImprimir}
              disabled={!listo}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Printer size={14} />
              Imprimir
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
