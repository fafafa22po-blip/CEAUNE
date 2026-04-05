import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import api from '../../lib/api'

// ─── Tarjeta de estadística ───────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
  const colors = {
    navy:   'bg-ceaune-navy text-white',
    green:  'bg-green-50 text-green-700 border border-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
    red:    'bg-red-50 text-red-700 border border-red-100',
    teal:   'bg-teal-50 text-teal-700 border border-teal-100',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold tabular-nums">{value ?? '—'}</span>
      </div>
      <p className={`text-sm font-medium ${color === 'navy' ? 'text-blue-200' : 'text-current opacity-80'}`}>
        {label}
      </p>
    </div>
  )
}

// ─── Badge estado ─────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = {
    puntual:  'badge-puntual',
    tardanza: 'badge-tardanza',
    falta:    'badge-falta',
    especial: 'badge-especial',
  }
  const labels = { puntual:'Puntual', tardanza:'Tardanza', falta:'Falta', especial:'Especial' }
  return <span className={cfg[estado] || 'badge-especial'}>{labels[estado] || estado}</span>
}

const GRADOS = ['1ro','2do','3ro','4to','5to']
const ESTADOS = ['puntual','tardanza','falta','especial']

export default function Hoy() {
  const [resumen,  setResumen]  = useState(null)
  const [lista,    setLista]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroGrado,  setFiltroGrado]  = useState('')
  const [busqueda, setBusqueda] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filtroEstado) params.set('estado', filtroEstado)
      if (filtroGrado)  params.set('grado',  filtroGrado)

      const [r1, r2] = await Promise.all([
        api.get('/asistencia/hoy'),
        api.get(`/asistencia/hoy/lista?${params}`),
      ])
      setResumen(r1.data)
      setLista(r2.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroGrado])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh cada 30s
  useEffect(() => {
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  const listaFiltrada = lista.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      r.estudiante_nombre.toLowerCase().includes(q) ||
      r.estudiante_apellido.toLowerCase().includes(q) ||
      r.estudiante_grado.toLowerCase().includes(q)
    )
  })

  const hoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ceaune-navy">Registros de Hoy</h1>
            <p className="text-gray-400 text-sm capitalize mt-0.5">{hoy}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="btn-navy py-2 px-4 text-sm"
            >
              ↻ Actualizar
            </button>
            <button
              onClick={() => window.print()}
              className="btn-gold py-2 px-4 text-sm"
            >
              🖨 Imprimir
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total alumnos"  value={resumen?.total_estudiantes} icon="👥" color="navy"   />
          <StatCard label="Puntuales"      value={resumen?.puntuales}         icon="✅" color="green"  />
          <StatCard label="Tardanzas"      value={resumen?.tardanzas}         icon="⚠️" color="yellow" />
          <StatCard label="Faltas"         value={resumen?.faltas}            icon="❌" color="red"    />
          <StatCard label="Con salida"     value={resumen?.salieron}          icon="🏃" color="teal"   />
        </div>

        {/* Filtros */}
        <div className="card mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="🔍 Buscar alumno..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ceaune-gold flex-1 min-w-40"
            />
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ceaune-gold"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
            </select>
            <select
              value={filtroGrado}
              onChange={e => setFiltroGrado(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ceaune-gold"
            >
              <option value="">Todos los grados</option>
              {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {(filtroEstado || filtroGrado || busqueda) && (
              <button
                onClick={() => { setFiltroEstado(''); setFiltroGrado(''); setBusqueda('') }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ✕ Limpiar
              </button>
            )}
            <span className="text-sm text-gray-400 ml-auto">
              {listaFiltrada.length} registro(s)
            </span>
          </div>
        </div>

        {/* Tabla */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-8 w-8 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : listaFiltrada.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-2">📭</p>
              <p>No hay registros con los filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ceaune-navy text-white text-left">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Alumno</th>
                    <th className="px-4 py-3 font-medium">Grado</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Hora</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-center">Correo</th>
                    <th className="px-4 py-3 font-medium">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((r, i) => (
                    <tr key={r.id} className={`border-t border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{r.estudiante_nombre} {r.estudiante_apellido}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.estudiante_grado} '{r.estudiante_seccion}'</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          r.tipo.includes('ingreso')
                            ? 'bg-ceaune-navy/10 text-ceaune-navy'
                            : 'bg-ceaune-teal/10 text-ceaune-teal'
                        }`}>
                          {r.tipo.includes('ingreso') ? '↗ Entrada' : '↙ Salida'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 tabular-nums font-medium">
                        {new Date(r.hora).toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="px-4 py-3"><EstadoBadge estado={r.estado} /></td>
                      <td className="px-4 py-3 text-center">
                        {r.correo_enviado
                          ? <span title="Correo enviado" className="text-green-500">✉️</span>
                          : <span title="Sin correo" className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                        {r.observacion || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
