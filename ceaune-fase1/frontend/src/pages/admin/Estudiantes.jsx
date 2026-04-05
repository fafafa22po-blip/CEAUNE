import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (nombre, apellido) =>
  `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase()

// ─── Panel lateral ────────────────────────────────────────────────────────────
function FichaPanel({ estudiante, onClose }) {
  const [apoderados, setApoderados] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/estudiantes/${estudiante.id}/apoderados`)
      .then(({ data }) => setApoderados(data))
      .catch(() => setApoderados([]))
      .finally(() => setLoading(false))
  }, [estudiante.id])

  const descargarQR = () => {
    window.open(`${import.meta.env.VITE_API_URL || ''}/estudiantes/${estudiante.id}/qr`, '_blank')
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-40 shadow-2xl flex flex-col overflow-hidden">

        {/* Header del panel */}
        <div className="bg-ceaune-navy px-6 py-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-ceaune-gold/20 flex items-center justify-center shrink-0">
            <span className="text-ceaune-gold font-bold text-lg">
              {initials(estudiante.nombre, estudiante.apellido)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base leading-tight truncate">
              {estudiante.apellido}, {estudiante.nombre}
            </h2>
            <p className="text-blue-300 text-sm mt-0.5">
              {estudiante.grado} "{estudiante.seccion}" &nbsp;·&nbsp; DNI {estudiante.dni}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white transition shrink-0 mt-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Datos del estudiante */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Datos del estudiante
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'DNI',       value: estudiante.dni },
                { label: 'Grado',     value: estudiante.grado },
                { label: 'Sección',   value: estudiante.seccion },
                { label: 'Estado',    value: estudiante.activo ? 'Activo' : 'Inactivo' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-semibold text-gray-800 text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* QR */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Código QR
            </h3>
            <button
              onClick={descargarQR}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-ceaune-gold/40 text-ceaune-gold hover:bg-ceaune-gold/5 transition text-sm font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              Ver / Descargar tarjeta QR
            </button>
          </section>

          {/* Apoderados */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Apoderados vinculados
            </h3>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando apoderados...
              </div>
            ) : apoderados.length === 0 ? (
              <div className="text-center py-6 text-gray-300 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Sin apoderados registrados
              </div>
            ) : (
              <div className="space-y-3">
                {apoderados.map((a) => (
                  <div key={a.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-ceaune-teal/10 flex items-center justify-center shrink-0">
                        <span className="text-ceaune-teal font-bold text-xs">
                          {initials(a.nombre, a.apellido)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          {a.apellido}, {a.nombre}
                        </p>
                        <p className="text-xs text-gray-400">DNI {a.dni}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pl-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        <a href={`mailto:${a.email}`} className="hover:underline hover:text-ceaune-navy break-all">
                          {a.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        {a.telefono ? (
                          <a href={`tel:${a.telefono}`} className="text-gray-600 hover:underline hover:text-ceaune-navy">
                            {a.telefono}
                          </a>
                        ) : (
                          <span className="text-gray-300 italic text-xs">Sin teléfono</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function EstudiantesAdmin() {
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [filtros, setFiltros]         = useState({ grado: '', seccion: '', search: '' })
  const [seleccionado, setSeleccionado] = useState(null)

  const GRADOS   = ['1°', '2°', '3°', '4°', '5°']
  const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F']

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filtros.grado)   params.grado   = filtros.grado
      if (filtros.seccion) params.seccion  = filtros.seccion
      if (filtros.search)  params.search   = filtros.search
      const { data } = await api.get('/estudiantes/', { params })
      setEstudiantes(data)
    } catch {
      setError('No se pudieron cargar los estudiantes.')
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const setFiltro = (key, val) =>
    setFiltros(prev => ({ ...prev, [key]: val }))

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Estudiantes</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {loading ? 'Cargando...' : `${estudiantes.length} estudiante${estudiantes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={filtros.search}
            onChange={e => setFiltro('search', e.target.value)}
            placeholder="Nombre, apellido o DNI..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ceaune-gold focus:border-transparent text-gray-700 placeholder-gray-300"
          />
        </div>

        {/* Grado */}
        <select
          value={filtros.grado}
          onChange={e => setFiltro('grado', e.target.value)}
          className="py-2 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-ceaune-gold bg-white"
        >
          <option value="">Todos los grados</option>
          {GRADOS.map(g => <option key={g} value={g}>{g} grado</option>)}
        </select>

        {/* Sección */}
        <select
          value={filtros.seccion}
          onChange={e => setFiltro('seccion', e.target.value)}
          className="py-2 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-ceaune-gold bg-white"
        >
          <option value="">Todas las secciones</option>
          {SECCIONES.map(s => <option key={s} value={s}>Sección {s}</option>)}
        </select>

        {/* Limpiar */}
        {(filtros.grado || filtros.seccion || filtros.search) && (
          <button
            onClick={() => setFiltros({ grado: '', seccion: '', search: '' })}
            className="text-sm text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando estudiantes...
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="text-center py-20 text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="text-sm font-medium">Sin resultados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">DNI</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Grado / Sección</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {estudiantes.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSeleccionado(e)}
                  className="hover:bg-ceaune-gold/5 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-ceaune-navy flex items-center justify-center shrink-0">
                        <span className="text-ceaune-gold font-bold text-xs">
                          {initials(e.nombre, e.apellido)}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">
                        {e.apellido}, {e.nombre}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">{e.dni}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-ceaune-teal/10 text-ceaune-teal">
                      {e.grado} "{e.seccion}"
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel de ficha */}
      {seleccionado && (
        <FichaPanel
          estudiante={seleccionado}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </div>
  )
}
