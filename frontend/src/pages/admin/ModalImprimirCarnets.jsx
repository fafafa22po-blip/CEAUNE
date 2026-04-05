import { useState, useEffect } from 'react'
import { X, Printer, Loader2, Users, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import CarnetEstudiante from '../../components/CarnetEstudiante'
import CarnetEstudianteVertical from '../../components/CarnetEstudianteVertical'
import { imprimirCarnets } from '../../utils/imprimirCarnets'
import { imprimirCarnetesVertical } from '../../utils/imprimirCarnetesVertical'

const GRADOS_POR_NIVEL = {
  inicial:    ['3', '4', '5'],
  primaria:   ['1', '2', '3', '4', '5', '6'],
  secundaria: ['1', '2', '3', '4', '5'],
}
const SECCIONES = ['A', 'B', 'C', 'D', 'E']

// Obtiene el QR limpio (solo código, sin decoraciones) de un estudiante
async function fetchQrSolo(id) {
  const { data } = await api.get(`/estudiantes/${id}/qr`, { params: { formato: 'qr_solo' } })
  return data.imagen_base64
}

export default function ModalImprimirCarnets({ onClose, estudianteInicial = null, filtroInicial = null }) {
  const modoInicial = estudianteInicial ? 'individual' : filtroInicial?.seccion ? 'seccion' : 'grado'
  const [modo, setModo] = useState(modoInicial)
  const [filtro, setFiltro] = useState(filtroInicial || { nivel: '', grado: '', seccion: '' })
  const [modelo, setModelo] = useState('horizontal') // 'horizontal' | 'vertical'

  // Lista de { estudiante, qrBase64 } listos para mostrar/imprimir
  const [carnets, setCarnets] = useState([])
  const [cargando, setCargando] = useState(false)

  // Auto-cargar cuando viene desde el botón contextual de sección
  useEffect(() => {
    if (!filtroInicial) return
    cargarLote()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-cargar cuando el modo es individual y hay estudiante
  useEffect(() => {
    if (modo !== 'individual' || !estudianteInicial) return
    let cancelado = false

    setCargando(true)
    setCarnets([])
    fetchQrSolo(estudianteInicial.id)
      .then((qrBase64) => {
        if (!cancelado) setCarnets([{ estudiante: estudianteInicial, qrBase64 }])
      })
      .catch(() => {
        if (!cancelado) toast.error('Error al cargar el QR')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => { cancelado = true }
  }, [modo, estudianteInicial])

  const cargarLote = async () => {
    const { nivel, grado, seccion } = filtro
    if (!nivel || !grado) return toast.error('Selecciona nivel y grado')
    if (modo === 'seccion' && !seccion) return toast.error('Selecciona la sección')

    setCargando(true)
    setCarnets([])

    try {
      // 1. Obtener lista de estudiantes con el filtro
      const params = { nivel, grado }
      if (modo === 'seccion') params.seccion = seccion

      const { data } = await api.get('/estudiantes/', { params })
      const lista = Array.isArray(data) ? data : (data.items || [])

      if (lista.length === 0) {
        toast.error('No hay estudiantes con ese filtro')
        setCargando(false)
        return
      }

      // 2. Obtener QR de cada uno en paralelo
      const resultados = await Promise.all(
        lista.map(async (est) => {
          try {
            const qrBase64 = await fetchQrSolo(est.id)
            return { estudiante: est, qrBase64 }
          } catch {
            return { estudiante: est, qrBase64: null }
          }
        })
      )

      setCarnets(resultados)
    } catch {
      toast.error('Error al cargar los carnets')
    } finally {
      setCargando(false)
    }
  }

  const handleImprimir = async () => {
    if (carnets.length === 0) return
    const datos = carnets.map(({ estudiante, qrBase64 }) => ({ ...estudiante, qrBase64 }))
    if (modelo === 'vertical') {
      await imprimirCarnetesVertical(datos)
    } else {
      await imprimirCarnets(datos)
    }
  }

  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo)
    setCarnets([])
    setFiltro({ nivel: '', grado: '', seccion: '' })
  }

  const listoParaImprimir = carnets.length > 0 && !cargando

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-marino" />
            <h3 className="font-bold text-marino text-base">
              {estudianteInicial
                ? `Carnet — ${estudianteInicial.nombre} ${estudianteInicial.apellido}`
                : 'Imprimir Carnets'
              }
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs de modo — solo visibles cuando NO es individual */}
        {!estudianteInicial && (
          <div className="flex border-b border-gray-100 px-5">
            {[
              { key: 'seccion', label: 'Por Sección'    },
              { key: 'grado',   label: 'Grado Completo' },
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

        {/* Selector de modelo */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
          <span className="text-xs text-gray-500 font-medium mr-1">Modelo:</span>
          {[
            { key: 'horizontal', label: 'Horizontal', sub: 'bolsillo' },
            { key: 'vertical',   label: 'Vertical',   sub: 'cuello / lanyard' },
          ].map(({ key, label, sub }) => (
            <button
              key={key}
              onClick={() => setModelo(key)}
              className={`flex flex-col items-start px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                modelo === key
                  ? 'border-dorado bg-white text-marino shadow-sm'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-white'
              }`}
            >
              <span>{label}</span>
              <span className={`text-[10px] font-normal ${modelo === key ? 'text-dorado' : 'text-gray-300'}`}>
                {sub}
              </span>
            </button>
          ))}
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">

          {/* Panel de filtros (sección / grado completo) */}
          {modo !== 'individual' && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className={`grid gap-3 ${modo === 'seccion' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                  <select
                    className="input"
                    value={filtro.nivel}
                    onChange={e => setFiltro({ nivel: e.target.value, grado: '', seccion: '' })}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="inicial">Inicial</option>
                    <option value="primaria">Primaria</option>
                    <option value="secundaria">Secundaria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Grado</label>
                  <select
                    className="input"
                    value={filtro.grado}
                    onChange={e => setFiltro({ ...filtro, grado: e.target.value, seccion: '' })}
                    disabled={!filtro.nivel}
                  >
                    <option value="">Seleccionar...</option>
                    {(GRADOS_POR_NIVEL[filtro.nivel] || []).map(g => (
                      <option key={g} value={g}>{g}°</option>
                    ))}
                  </select>
                </div>
                {modo === 'seccion' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
                    <select
                      className="input"
                      value={filtro.seccion}
                      onChange={e => setFiltro({ ...filtro, seccion: e.target.value })}
                      disabled={!filtro.grado}
                    >
                      <option value="">Seleccionar...</option>
                      {SECCIONES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={cargarLote}
                disabled={
                  cargando ||
                  !filtro.nivel ||
                  !filtro.grado ||
                  (modo === 'seccion' && !filtro.seccion)
                }
                className="btn-primary text-sm flex items-center gap-2"
              >
                {cargando
                  ? <><Loader2 size={14} className="animate-spin" /> Cargando carnets...</>
                  : <><Users size={14} /> Cargar Carnets</>
                }
              </button>
            </div>
          )}

          {/* Estado de carga para modo individual */}
          {modo === 'individual' && cargando && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 size={16} className="animate-spin" />
              Preparando carnet...
            </div>
          )}

          {/* Vista previa de carnets */}
          {carnets.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                <Users size={12} />
                <span>
                  {carnets.length} carnet{carnets.length !== 1 ? 's' : ''} — vista previa
                  {carnets.length > 2 && ' (scroll para ver todos)'}
                </span>
              </p>

              {/* Grid de previsualización con escala reducida */}
              <div className="flex flex-wrap gap-4">
                {carnets.map(({ estudiante, qrBase64 }, i) => (
                  <div
                    key={estudiante.id || i}
                    style={{
                      transform: modelo === 'vertical' ? 'scale(0.55)' : 'scale(0.70)',
                      transformOrigin: 'top left',
                      marginBottom: modelo === 'vertical' ? '-185px' : '-70px',
                    }}
                  >
                    {modelo === 'vertical'
                      ? <CarnetEstudianteVertical estudiante={estudiante} qrBase64={qrBase64} />
                      : <CarnetEstudiante        estudiante={estudiante} qrBase64={qrBase64} />
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer con acción */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {listoParaImprimir
              ? modelo === 'vertical'
                ? `${carnets.length} carnet${carnets.length !== 1 ? 's' : ''} — A4, 2×3 por hoja (cuello), guías de corte`
                : `${carnets.length} carnet${carnets.length !== 1 ? 's' : ''} — A4, 2 por fila (bolsillo), guías de corte`
              : cargando
                ? 'Obteniendo datos...'
                : 'Configura el filtro y carga los carnets'
            }
          </p>
          <div className="flex items-center gap-2">
            {listoParaImprimir && modo !== 'individual' && (
              <button
                onClick={cargarLote}
                className="btn-secondary text-sm flex items-center gap-1.5"
                title="Recargar"
              >
                <RefreshCw size={13} />
              </button>
            )}
            <button onClick={onClose} className="btn-secondary text-sm">
              Cancelar
            </button>
            <button
              onClick={handleImprimir}
              disabled={!listoParaImprimir}
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
