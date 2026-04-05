import { useState, useCallback } from 'react'
import api from '../../lib/api'

// ─── Iconos ───────────────────────────────────────────────────────────────────
const IcoSearch = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
  </svg>
)
const IcoUser = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)
const IcoPhone = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
)
const IcoMail = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
)
const IcoChevron = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

// ─── Componente tarjeta de estudiante ─────────────────────────────────────────
function EstudianteCard({ estudiante }) {
  const [open, setOpen]           = useState(false)
  const [apoderados, setApoderados] = useState([])
  const [loading, setLoading]     = useState(false)
  const [loaded, setLoaded]       = useState(false)

  const toggle = async () => {
    if (!open && !loaded) {
      setLoading(true)
      try {
        const { data } = await api.get(`/estudiantes/${estudiante.id}/apoderados`)
        setApoderados(data)
        setLoaded(true)
      } catch {
        setApoderados([])
      } finally {
        setLoading(false)
      }
    }
    setOpen(v => !v)
  }

  const initials = `${estudiante.nombre[0]}${estudiante.apellido[0]}`.toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Cabecera de la tarjeta */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-ceaune-navy flex items-center justify-center shrink-0 shadow">
          <span className="text-ceaune-gold font-bold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">
            {estudiante.apellido}, {estudiante.nombre}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            DNI {estudiante.dni} &nbsp;·&nbsp;
            <span className="text-ceaune-teal font-medium">{estudiante.grado} "{estudiante.seccion}"</span>
          </p>
        </div>
        <span className="text-gray-400 shrink-0">
          <IcoChevron open={open} />
        </span>
      </button>

      {/* Detalle expandible */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            {IcoUser} Apoderados vinculados
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando...
            </div>
          ) : apoderados.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-1">Sin apoderados registrados.</p>
          ) : (
            <div className="space-y-3">
              {apoderados.map((a) => (
                <div key={a.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <p className="font-semibold text-gray-800 text-sm">
                    {a.apellido}, {a.nombre}
                    <span className="ml-2 text-xs text-gray-400 font-normal">DNI {a.dni}</span>
                  </p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="text-gray-400">{IcoMail}</span>
                      <a href={`mailto:${a.email}`} className="hover:text-ceaune-navy hover:underline break-all">
                        {a.email}
                      </a>
                    </div>
                    {a.telefono ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="text-gray-400">{IcoPhone}</span>
                        <a href={`tel:${a.telefono}`} className="hover:text-ceaune-navy hover:underline">
                          {a.telefono}
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-300 italic">
                        <span>{IcoPhone}</span>
                        Sin teléfono registrado
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function EstudiantesAuxiliar() {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [searched, setSearched]     = useState(false)
  const [error, setError]           = useState('')

  const buscar = useCallback(async (e) => {
    e?.preventDefault()
    const term = query.trim()
    if (!term) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/estudiantes/', { params: { search: term } })
      setResults(data)
      setSearched(true)
    } catch {
      setError('No se pudo realizar la búsqueda.')
    } finally {
      setLoading(false)
    }
  }, [query])

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Consulta de Estudiantes</h1>
        <p className="text-gray-400 text-sm mt-1">Busca por nombre, apellido o DNI para ver la ficha y datos del apoderado.</p>
      </div>

      {/* Buscador */}
      <form onSubmit={buscar} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            {IcoSearch}
          </span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nombre, apellido o DNI del estudiante..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-ceaune-gold focus:border-transparent text-gray-800 placeholder-gray-300 shadow-sm transition"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-3 rounded-xl bg-ceaune-navy text-white font-semibold text-sm hover:bg-ceaune-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shrink-0"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Resultados */}
      {searched && !loading && (
        results.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
            <p className="font-medium">Sin resultados</p>
            <p className="text-xs mt-1">Intenta con otro nombre o DNI.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">
              {results.length} estudiante{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </p>
            {results.map(e => (
              <EstudianteCard key={e.id} estudiante={e} />
            ))}
          </div>
        )
      )}

      {/* Estado inicial */}
      {!searched && !loading && (
        <div className="text-center py-16 text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <p className="text-sm">Ingresa un nombre o DNI para comenzar</p>
        </div>
      )}
    </div>
  )
}
