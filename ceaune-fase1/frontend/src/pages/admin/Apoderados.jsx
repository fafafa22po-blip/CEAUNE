import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'

const initials = (nombre, apellido) =>
  `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase()

// ─── Panel lateral de detalle ─────────────────────────────────────────────────
function ApoderadoPanel({ apoderado, onClose }) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-40 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-ceaune-navy px-6 py-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-ceaune-gold/20 flex items-center justify-center shrink-0">
            <span className="text-ceaune-gold font-bold text-lg">
              {initials(apoderado.nombre, apoderado.apellido)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base leading-tight truncate">
              {apoderado.apellido}, {apoderado.nombre}
            </h2>
            <p className="text-blue-300 text-sm mt-0.5">Apoderado · DNI {apoderado.dni}</p>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white transition shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Datos de contacto */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Datos de contacto
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Correo electrónico</p>
                  <a href={`mailto:${apoderado.email}`} className="text-sm font-medium text-gray-700 hover:underline hover:text-ceaune-navy break-all">
                    {apoderado.email}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-400">Teléfono</p>
                  {apoderado.telefono ? (
                    <a href={`tel:${apoderado.telefono}`} className="text-sm font-medium text-gray-700 hover:underline hover:text-ceaune-navy">
                      {apoderado.telefono}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-300 italic">No registrado</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400">DNI</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">{apoderado.dni}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400">Estado</p>
                  <span className={`inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    apoderado.activo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {apoderado.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Hijos vinculados */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Hijos vinculados ({apoderado.hijos.length})
            </h3>
            {apoderado.hijos.length === 0 ? (
              <div className="text-center py-6 text-gray-300 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Sin hijos vinculados
              </div>
            ) : (
              <div className="space-y-2">
                {apoderado.hijos.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white">
                    <div className="w-9 h-9 rounded-lg bg-ceaune-navy flex items-center justify-center shrink-0">
                      <span className="text-ceaune-gold font-bold text-xs">
                        {initials(h.nombre, h.apellido)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {h.apellido}, {h.nombre}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.grado} "{h.seccion}"
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ceaune-teal/10 text-ceaune-teal shrink-0">
                      {h.grado}{h.seccion}
                    </span>
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
export default function Apoderados() {
  const [apoderados, setApoderados] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [seleccionado, setSeleccionado] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = search.trim() ? { search: search.trim() } : {}
      const { data } = await api.get('/usuarios/apoderados', { params })
      setApoderados(data)
    } catch {
      setError('No se pudieron cargar los apoderados.')
    } finally {
      setLoading(false)
    }
  }, [search])

  // Carga inicial
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault()
    cargar()
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Apoderados</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {loading ? 'Cargando...' : `${apoderados.length} apoderado${apoderados.length !== 1 ? 's' : ''} registrado${apoderados.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Buscador */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, apellido o DNI..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ceaune-gold focus:border-transparent text-gray-700 placeholder-gray-300"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-ceaune-navy text-white text-sm font-semibold hover:bg-ceaune-navy-light transition shrink-0"
        >
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setTimeout(cargar, 0) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 text-sm transition shrink-0"
          >
            Limpiar
          </button>
        )}
      </form>

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
            Cargando apoderados...
          </div>
        ) : apoderados.length === 0 ? (
          <div className="text-center py-20 text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-5.196-3.796M9 20H4v-2a4 4 0 015.196-3.796M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">Sin resultados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Apoderado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Hijos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {apoderados.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSeleccionado(a)}
                  className="hover:bg-ceaune-gold/5 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-ceaune-teal/10 flex items-center justify-center shrink-0">
                        <span className="text-ceaune-teal font-bold text-xs">
                          {initials(a.nombre, a.apellido)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{a.apellido}, {a.nombre}</p>
                        <p className="text-xs text-gray-400">DNI {a.dni}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <p className="text-gray-600 text-xs truncate max-w-[200px]">{a.email}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    {a.telefono ? (
                      <span className="text-gray-600 text-sm">{a.telefono}</span>
                    ) : (
                      <span className="text-gray-300 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {a.hijos.length === 0 ? (
                        <span className="text-gray-300 text-xs italic">Sin hijos</span>
                      ) : (
                        a.hijos.slice(0, 3).map(h => (
                          <span key={h.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ceaune-navy/10 text-ceaune-navy">
                            {h.grado}{h.seccion}
                          </span>
                        ))
                      )}
                      {a.hijos.length > 3 && (
                        <span className="text-xs text-gray-400">+{a.hijos.length - 3}</span>
                      )}
                    </div>
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

      {/* Panel de detalle */}
      {seleccionado && (
        <ApoderadoPanel
          apoderado={seleccionado}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </div>
  )
}
