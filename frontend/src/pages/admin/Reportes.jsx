import { useState } from 'react'
import {
  BarChart2, Download, Search, X, Users, User, BookOpen,
  CheckCircle2, Clock, AlertCircle, TrendingUp, FileDown,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Constantes ───────────────────────────────────────────────────────────────

const VISTAS = [
  { id: 'mensual', label: 'Resumen Mensual', icon: BarChart2 },
  { id: 'aula',    label: 'Por Aula',        icon: BookOpen  },
  { id: 'alumno',  label: 'Por Alumno',      icon: User      },
]

const NIVELES  = [
  { v: '',           label: 'Todos los niveles' },
  { v: 'inicial',    label: 'Inicial'           },
  { v: 'primaria',   label: 'Primaria'          },
  { v: 'secundaria', label: 'Secundaria'        },
]

import { GRADOS_POR_NIVEL, getSecciones, formatGrado, formatGradoSeccion, resolveAulaInicial } from '../../lib/nivelAcademico'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctColor(pct) {
  const n = parseFloat(pct)
  if (n >= 90) return 'text-green-600 bg-green-50'
  if (n >= 75) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function estadoColor(estado) {
  if (estado === 'puntual')  return 'text-green-700 bg-green-100'
  if (estado === 'tardanza') return 'text-amber-700 bg-amber-100'
  if (estado === 'falta')    return 'text-red-700 bg-red-100'
  return 'text-gray-600 bg-gray-100'
}

function exportarCSV(datos, vista) {
  if (!datos?.registros?.length) return
  const cols  = Object.keys(datos.registros[0])
  const head  = cols.join(',')
  const rows  = datos.registros.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(','))
  const csv   = [head, ...rows].join('\n')
  const blob  = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = `reporte_${vista}_${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Componentes de estadísticas ──────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl px-4 py-3.5 flex items-center gap-3 ${color}`}>
      <div className="w-9 h-9 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
        <Icon size={17} />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
      </div>
    </div>
  )
}

// ─── Tabla de resultados ──────────────────────────────────────────────────────

function TablaResultados({ registros, vista }) {
  if (!registros?.length) return null

  const esMensualOAula = vista === 'mensual' || vista === 'aula'

  if (esMensualOAula) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Alumno</th>
              {vista === 'mensual' && (
                <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3">Nivel</th>
              )}
              <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Grado</th>
              <th className="text-center text-xs font-semibold text-green-600 px-3 py-3">Puntual</th>
              <th className="text-center text-xs font-semibold text-amber-600 px-3 py-3">Tardanza</th>
              <th className="text-center text-xs font-semibold text-red-600 px-3 py-3">Falta</th>
              <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-800">{r.nombre}</td>
                {vista === 'mensual' && (
                  <td className="px-3 py-2.5 text-gray-500 capitalize">{r.nivel}</td>
                )}
                <td className="px-3 py-2.5 text-center text-gray-600">
                  {formatGradoSeccion(r.nivel, r.grado, r.seccion)}
                </td>
                <td className="px-3 py-2.5 text-center font-semibold text-green-600">{r.puntual}</td>
                <td className="px-3 py-2.5 text-center font-semibold text-amber-600">{r.tardanza}</td>
                <td className="px-3 py-2.5 text-center font-semibold text-red-600">{r.falta}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pctColor(r.porcentaje_asistencia)}`}>
                    {r.porcentaje_asistencia}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Vista alumno: tabla de asistencia diaria
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Fecha</th>
            <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Estado</th>
            <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Hora</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5 text-gray-700 capitalize">
                {r.fecha ? format(new Date(r.fecha + 'T00:00:00'), "d 'de' MMMM", { locale: es }) : '—'}
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${estadoColor(r.estado)}`}>
                  {r.estado}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums">{r.hora}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Reportes() {
  const [vista,              setVista]              = useState('mensual')
  const [fechaInicio,        setFechaInicio]        = useState(format(new Date(), 'yyyy-MM-01'))
  const [fechaFin,           setFechaFin]           = useState(format(new Date(), 'yyyy-MM-dd'))
  const [nivel,              setNivel]              = useState('')
  const [grado,              setGrado]              = useState('')
  const [seccion,            setSeccion]            = useState('')
  const [busqueda,           setBusqueda]           = useState('')
  const [resultados,         setResultados]         = useState([])
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null)
  const [datos,              setDatos]              = useState(null)
  const [cargando,           setCargando]           = useState(false)
  const [descargandoPDF,     setDescargandoPDF]     = useState(false)

  // ── Buscar alumno ──────────────────────────────────────────────────────────
  const buscarAlumno = async (q) => {
    if (q.length < 2) { setResultados([]); return }
    try {
      const { data } = await api.get('/estudiantes/', { params: { busqueda: q, por_pagina: 10 } })
      setResultados(data.items || data)
    } catch { setResultados([]) }
  }

  // ── Validar campos requeridos ──────────────────────────────────────────────
  const puedeGenerar = () => {
    if (!fechaInicio || !fechaFin) return false
    if (vista === 'alumno' && !alumnoSeleccionado) return false
    if (vista === 'aula'   && (!grado || !seccion))  return false
    return true
  }

  // ── Generar reporte ────────────────────────────────────────────────────────
  const generarReporte = async () => {
    if (!puedeGenerar()) return
    setCargando(true)
    setDatos(null)
    try {
      let res
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin }

      if (vista === 'mensual') {
        if (nivel) params.nivel = nivel
        res = await api.get('/admin/reportes/mensual', { params })

      } else if (vista === 'alumno') {
        res = await api.get(`/admin/reportes/alumno/${alumnoSeleccionado.id}`, { params })

      } else if (vista === 'aula') {
        params.grado   = grado
        params.seccion = seccion
        if (nivel) params.nivel = nivel
        res = await api.get('/admin/reportes/aula', { params })
      }

      if (!res?.data?.estadisticas?.total_dias && !res?.data?.estadisticas?.total_alumnos) {
        toast('Sin días lectivos en el período seleccionado', { icon: '📋' })
      }
      setDatos(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar reporte')
    } finally {
      setCargando(false)
    }
  }

  // ── Descargar PDF ─────────────────────────────────────────────────────────
  const descargarPDF = async () => {
    setDescargandoPDF(true)
    try {
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      let url

      if (vista === 'mensual') {
        if (nivel) params.nivel = nivel
        url = '/admin/reportes/mensual/pdf'
      } else if (vista === 'aula') {
        params.grado   = grado
        params.seccion = seccion
        if (nivel) params.nivel = nivel
        url = '/admin/reportes/aula/pdf'
      } else if (vista === 'alumno') {
        url = `/admin/reportes/alumno/${alumnoSeleccionado.id}/pdf`
      }

      const resp = await api.get(url, { params, responseType: 'blob' })
      const blobUrl = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = blobUrl
      const cd = resp.headers['content-disposition'] || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      a.download = match ? match[1] : `reporte_${vista}_${fechaInicio}.pdf`
      a.click()
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setDescargandoPDF(false)
    }
  }

  // ── Limpiar al cambiar de vista ────────────────────────────────────────────
  const cambiarVista = (v) => {
    setVista(v)
    setDatos(null)
    setAlumnoSeleccionado(null)
    setBusqueda('')
    setResultados([])
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Título */}
      <div>
        <h1 className="text-xl font-bold text-marino flex items-center gap-2">
          <BarChart2 size={20} /> Reportes de Asistencia
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Genera reportes por período, aula o alumno</p>
      </div>

      {/* Selector de vista */}
      <div className="flex gap-2 flex-wrap">
        {VISTAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => cambiarVista(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              vista === id
                ? 'bg-marino text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="card space-y-4">

        {/* Fechas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Desde</label>
            <input
              type="date"
              className="input"
              value={fechaInicio}
              onChange={(e) => { setFechaInicio(e.target.value); setDatos(null) }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hasta</label>
            <input
              type="date"
              className="input"
              value={fechaFin}
              onChange={(e) => { setFechaFin(e.target.value); setDatos(null) }}
            />
          </div>
        </div>

        {/* Filtro nivel (mensual y aula) */}
        {(vista === 'mensual' || vista === 'aula') && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nivel</label>
            <select className="input" value={nivel} onChange={(e) => setNivel(e.target.value)}>
              {NIVELES.map(({ v, label }) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro aula */}
        {vista === 'aula' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {nivel === 'inicial' ? 'Edad' : 'Grado'} <span className="text-red-500">*</span>
              </label>
              <select className="input" value={grado} onChange={(e) => { setGrado(e.target.value); setSeccion('') }} disabled={!nivel}>
                <option value="">Seleccionar...</option>
                {(GRADOS_POR_NIVEL[nivel] || []).map((g) => (
                  <option key={g} value={g}>{formatGrado(nivel, g)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {nivel === 'inicial' ? 'Aula' : 'Sección'} <span className="text-red-500">*</span>
              </label>
              <select className="input" value={seccion} onChange={(e) => setSeccion(e.target.value)} disabled={!grado}>
                <option value="">Seleccionar...</option>
                {getSecciones(nivel, grado).map((s) => (
                  <option key={s} value={s}>
                    {nivel === 'inicial' ? resolveAulaInicial(grado, s) : s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Buscar alumno */}
        {vista === 'alumno' && (
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Alumno <span className="text-red-500">*</span>
            </label>
            {alumnoSeleccionado ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-marino">
                    {alumnoSeleccionado.nombre} {alumnoSeleccionado.apellido}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">
                    {alumnoSeleccionado.nivel} · {formatGradoSeccion(alumnoSeleccionado.nivel, alumnoSeleccionado.grado, alumnoSeleccionado.seccion)}
                  </p>
                </div>
                <button
                  onClick={() => { setAlumnoSeleccionado(null); setBusqueda(''); setDatos(null) }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  className="input pl-9"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); buscarAlumno(e.target.value) }}
                  placeholder="Buscar por nombre o apellido..."
                />
                {busqueda && (
                  <button
                    onClick={() => { setBusqueda(''); setResultados([]) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
                {resultados.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto">
                    {resultados.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                        onClick={() => {
                          setAlumnoSeleccionado(a)
                          setBusqueda('')
                          setResultados([])
                        }}
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {a.nombre} {a.apellido}
                        </p>
                        <p className="text-xs text-gray-400 capitalize mt-0.5">
                          {a.nivel} · {formatGradoSeccion(a.nivel, a.grado, a.seccion)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Botón generar */}
        <button
          onClick={generarReporte}
          disabled={cargando || !puedeGenerar()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <BarChart2 size={15} />
          }
          {cargando ? 'Generando...' : 'Generar reporte'}
        </button>
      </div>

      {/* ── Resultados ── */}
      {datos && (
        <div className="card space-y-5 animate-in">

          {/* Cabecera resultados */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-marino">
                {vista === 'alumno' && datos.alumno
                  ? `${datos.alumno.nombre} — ${formatGradoSeccion(datos.alumno.nivel, datos.alumno.grado, datos.alumno.seccion)}`
                  : vista === 'aula'
                  ? formatGradoSeccion(nivel, grado, seccion)
                  : 'Resumen general'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {format(new Date(fechaInicio + 'T00:00:00'), "d 'de' MMMM", { locale: es })}
                {' — '}
                {format(new Date(fechaFin + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={descargarPDF}
                disabled={descargandoPDF}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-marino hover:bg-marino/90 active:bg-marino/80 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {descargandoPDF
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <FileDown size={14} />
                }
                {descargandoPDF ? 'Generando...' : 'Descargar PDF'}
              </button>
              <button
                onClick={() => exportarCSV(datos, vista)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Download size={14} /> CSV
              </button>
            </div>
          </div>

          {/* Stats cards */}
          {datos.estadisticas && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {datos.estadisticas.total_alumnos !== undefined && (
                <StatCard
                  icon={Users}
                  label="Total alumnos"
                  value={datos.estadisticas.total_alumnos}
                  color="bg-blue-50 text-blue-700"
                />
              )}
              {datos.estadisticas.total_dias !== undefined && (
                <StatCard
                  icon={TrendingUp}
                  label="Días registrados"
                  value={datos.estadisticas.total_dias}
                  color="bg-blue-50 text-blue-700"
                />
              )}
              <StatCard
                icon={CheckCircle2}
                label="Puntual"
                value={datos.estadisticas.puntual}
                color="bg-green-50 text-green-700"
              />
              <StatCard
                icon={Clock}
                label="Tardanza"
                value={datos.estadisticas.tardanza}
                color="bg-amber-50 text-amber-700"
              />
              <StatCard
                icon={AlertCircle}
                label="Falta"
                value={datos.estadisticas.falta}
                color="bg-red-50 text-red-700"
              />
              {datos.estadisticas.porcentaje_asistencia !== undefined && (
                <StatCard
                  icon={TrendingUp}
                  label="Asistencia"
                  value={`${datos.estadisticas.porcentaje_asistencia}%`}
                  color={pctColor(datos.estadisticas.porcentaje_asistencia)}
                />
              )}
            </div>
          )}

          {/* Tabla */}
          {datos.registros?.length > 0 ? (
            <TablaResultados registros={datos.registros} vista={vista} />
          ) : (
            <div className="text-center py-10 text-gray-400">
              <BarChart2 size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm font-medium">Sin registros de asistencia en este período</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
