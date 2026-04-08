import { useState, useEffect, useRef } from 'react'
import { Search, Upload, Plus, X, Pencil, UserX, UserCheck, AlertTriangle, Printer, FileDown, CheckCircle, XCircle, Heart, GraduationCap, User, Camera, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import ModalImprimirCarnets from './ModalImprimirCarnets'

const GRADOS_POR_NIVEL = {
  inicial:    ['3', '4', '5'],
  primaria:   ['1', '2', '3', '4', '5', '6'],
  secundaria: ['1', '2', '3', '4', '5'],
}
const SECCIONES = ['A', 'B', 'C', 'D', 'E']

const NIVEL_BADGE = {
  inicial:    { label: 'Inicial',    cls: 'bg-green-100 text-green-700' },
  primaria:   { label: 'Primaria',   cls: 'bg-blue-100 text-blue-700' },
  secundaria: { label: 'Secundaria', cls: 'bg-purple-100 text-purple-700' },
}

const ROL_LABEL_PERSONAL = {
  'tutor':      'Tutor',
  'i-auxiliar': 'Aux. Inicial',
  'p-auxiliar': 'Aux. Primaria',
  's-auxiliar': 'Aux. Secundaria',
  'admin':      'Admin',
}

const MOTIVO_LABEL = {
  retiro_voluntario: 'Retiro voluntario',
  traslado: 'Traslado',
  egreso: 'Egreso',
  disciplinario: 'Disciplinario',
  otro: 'Otro',
}

const TABS_NUEVO = [
  { id: 'personal',  label: 'Personal',  icon: User },
  { id: 'academico', label: 'Académico', icon: GraduationCap },
  { id: 'salud',     label: 'Salud',     icon: Heart },
  { id: 'apoderado', label: 'Apoderado', icon: UserCheck },
]
const ORDEN_TABS_NUEVO = TABS_NUEVO.map(t => t.id)

const TABS_EDITAR = [
  { id: 'personal',  label: 'Personal',  icon: User },
  { id: 'academico', label: 'Académico', icon: GraduationCap },
  { id: 'salud',     label: 'Salud',     icon: Heart },
]
const ORDEN_TABS_EDITAR = TABS_EDITAR.map(t => t.id)

const FORM_SALUD_VACIO = {
  atencion_medica: '', tiene_alergias: false, alergias_detalle: '',
  condicion_mental_nee: '', contacto_emergencia: '',
}

export default function Estudiantes() {
  const [lista, setLista] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [importando, setImportando] = useState(false)
  const [modalResultados, setModalResultados] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const fileRef = useRef()
  const POR_PAGINA = 20

  // Filtros de la tabla
  const [filtroNivel,   setFiltroNivel]   = useState('')
  const [filtroGrado,   setFiltroGrado]   = useState('')
  const [filtroSeccion, setFiltroSeccion] = useState('')

  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  const [modalNuevo, setModalNuevo] = useState(false)
  const [tabNuevo, setTabNuevo] = useState('personal')
  const [formNuevo, setFormNuevo] = useState({
    nombre: '', apellido: '', dni: '', grado: '', seccion: '', nivel: '', sexo: '',
    ...FORM_SALUD_VACIO,
  })
  const [conApoderado, setConApoderado] = useState(false)
  const [busqApo, setBusqApo] = useState('')
  const [resultadosApo, setResultadosApo] = useState([])
  const [buscandoApo, setBuscandoApo] = useState(false)
  const [apoderadoSeleccionado, setApoderadoSeleccionado] = useState(null)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)
  const [formNuevoApo, setFormNuevoApo] = useState({
    dni: '', nombre: '', apellido: '', email: '', password: '', telefono: '',
  })
  const [creando, setCreando] = useState(false)

  const [modalEditar, setModalEditar] = useState(null)
  const [tabEditar, setTabEditar] = useState('personal')
  const [formEditar, setFormEditar] = useState({})
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const [modalDesactivar, setModalDesactivar] = useState(null)
  const [motivoDesactivacion, setMotivoDesactivacion] = useState('')
  const [desactivando, setDesactivando] = useState(false)

  const [modalReactivar, setModalReactivar] = useState(null)
  const [formReactivar, setFormReactivar] = useState({ nivel: '', grado: '', seccion: '' })
  const [reactivando, setReactivando] = useState(false)

  const [modalDNIInactivo, setModalDNIInactivo] = useState(null)

  // null = cerrado | { estudianteInicial, filtroInicial }
  const [modalImprimir, setModalImprimir] = useState(null)

  const [fotoSubiendo, setFotoSubiendo] = useState(false)

  const handleSubirFoto = async (e) => {
    const archivo = e.target.files[0]
    if (!archivo || !modalEditar) return
    setFotoSubiendo(true)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const { data } = await api.post(`/estudiantes/${modalEditar.id}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setFormEditar(f => ({ ...f, foto_url: data.foto_url }))
      setLista(prev => prev.map(est => est.id === modalEditar.id ? { ...est, foto_url: data.foto_url } : est))
      toast.success('Foto actualizada')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al subir la foto')
    } finally {
      setFotoSubiendo(false)
      e.target.value = ''
    }
  }

  const handleEliminarFoto = async () => {
    if (!modalEditar) return
    setFotoSubiendo(true)
    try {
      await api.delete(`/estudiantes/${modalEditar.id}/foto`)
      setFormEditar(f => ({ ...f, foto_url: null }))
      setLista(prev => prev.map(est => est.id === modalEditar.id ? { ...est, foto_url: null } : est))
      toast.success('Foto eliminada')
    } catch {
      toast.error('Error al eliminar la foto')
    } finally {
      setFotoSubiendo(false)
    }
  }

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/estudiantes/', {
        params: {
          q:       busqueda     || undefined,
          nivel:   filtroNivel  || undefined,
          grado:   filtroGrado  || undefined,
          seccion: filtroSeccion || undefined,
          activo:  mostrarInactivos ? false : true,
        },
      })
      setLista(Array.isArray(data) ? data : (data.items || []))
      setTotal(Array.isArray(data) ? data.length : (data.total || 0))
    } catch { toast.error('Error al cargar estudiantes') }
    finally { setCargando(false) }
  }

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [busqueda, pagina, filtroNivel, filtroGrado, filtroSeccion, mostrarInactivos])

  const limpiarFiltros = () => {
    setFiltroNivel('')
    setFiltroGrado('')
    setFiltroSeccion('')
    setPagina(1)
  }

  const hayFiltros = filtroNivel || filtroGrado || filtroSeccion
  const filtroCompleto = filtroNivel && filtroGrado && filtroSeccion

  const handleImportar = async (e) => {
    const archivo = e.target.files[0]
    if (!archivo) return
    setImportando(true)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const { data } = await api.post('/estudiantes/importar-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setModalResultados(data)
      if (data.importados > 0) cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al importar el archivo')
    } finally {
      setImportando(false)
      e.target.value = ''
    }
  }

  const descargarPlantilla = async () => {
    try {
      const resp = await api.get('/estudiantes/plantilla-excel', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_estudiantes.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar la plantilla')
    }
  }

  const buscarApoderados = async (q) => {
    setBusqApo(q)
    if (q.trim().length < 2) { setResultadosApo([]); return }
    setBuscandoApo(true)
    try {
      const { data } = await api.get('/admin/apoderados', { params: { q: q.trim(), por_pagina: 6 } })
      setResultadosApo(Array.isArray(data) ? data : (data.items || []))
    } catch {
      setResultadosApo([])
    } finally {
      setBuscandoApo(false)
    }
  }

  const seleccionarApoderado = (apo) => {
    setApoderadoSeleccionado(apo)
    setResultadosApo([])
    setBusqApo('')
  }

  const limpiarApoderado = () => {
    setApoderadoSeleccionado(null)
    setMostrarFormNuevo(false)
    setFormNuevoApo({ dni: '', nombre: '', apellido: '', email: '', password: '', telefono: '' })
    setBusqApo('')
    setResultadosApo([])
  }

  const cerrarModal = () => {
    setModalNuevo(false)
    setTabNuevo('personal')
    setFormNuevo({ nombre: '', apellido: '', dni: '', grado: '', seccion: '', nivel: '', sexo: '', ...FORM_SALUD_VACIO })
    setConApoderado(false)
    setBusqApo('')
    setResultadosApo([])
    setApoderadoSeleccionado(null)
    setMostrarFormNuevo(false)
    setFormNuevoApo({ dni: '', nombre: '', apellido: '', email: '', password: '', telefono: '' })
    setCreando(false)
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    if (creando) return

    const { nombre, apellido, dni, nivel, grado, seccion } = formNuevo
    if (!nombre.trim() || !apellido.trim() || !dni.trim()) {
      setTabNuevo('personal')
      return toast.error('Completa nombre, apellido y DNI')
    }
    if (dni.length !== 8) {
      setTabNuevo('personal')
      return toast.error('El DNI debe tener 8 dígitos')
    }
    if (!nivel || !grado.trim() || !seccion.trim()) {
      setTabNuevo('academico')
      return toast.error('Completa nivel, grado y sección')
    }

    if (conApoderado) {
      if (!apoderadoSeleccionado && !mostrarFormNuevo)
        return toast.error('Selecciona un apoderado o regístralo como nuevo')
      if (mostrarFormNuevo) {
        const { nombre, apellido, dni, email, password } = formNuevoApo
        if (!nombre.trim() || !apellido.trim() || !dni.trim() || !email.trim())
          return toast.error('Completa todos los datos del apoderado')
        if (dni.length !== 8) return toast.error('El DNI del apoderado debe tener 8 dígitos')
        if (!password || password.length < 6)
          return toast.error('La contraseña debe tener al menos 6 caracteres')
      }
    }

    setCreando(true)
    let estudianteCreado = null

    try {
      const { data: est } = await api.post('/estudiantes/', formNuevo)
      estudianteCreado = est

      if (conApoderado) {
        const payload = apoderadoSeleccionado ? { dni: apoderadoSeleccionado.dni } : formNuevoApo
        try {
          await api.post(`/estudiantes/${est.id}/apoderado`, payload)
          toast.success('Estudiante y apoderado registrados correctamente')
        } catch (errApo) {
          toast.success('Estudiante creado')
          toast.error(`No se pudo vincular el apoderado: ${errApo.response?.data?.detail || 'Error desconocido'}`)
        }
      } else {
        toast.success('Estudiante creado')
      }

      cerrarModal()
      cargar()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.codigo === 'inactivo') {
        cerrarModal()
        setModalDNIInactivo(detail.estudiante)
        return
      }
      if (estudianteCreado) {
        cerrarModal()
        cargar()
        toast.error(typeof detail === 'string' ? detail : 'Error parcial al registrar')
      } else {
        setCreando(false)
        toast.error(typeof detail === 'string' ? detail : 'Error al crear estudiante')
      }
    }
  }

  const abrirEditar = (est) => {
    setTabEditar('personal')
    setFormEditar({
      nombre: est.nombre, apellido: est.apellido, dni: est.dni,
      sexo: est.sexo || '',
      nivel: est.nivel, grado: est.grado, seccion: est.seccion,
      foto_url: est.foto_url || null,
      atencion_medica:      est.atencion_medica      || '',
      tiene_alergias:       est.tiene_alergias       || false,
      alergias_detalle:     est.alergias_detalle     || '',
      condicion_mental_nee: est.condicion_mental_nee || '',
      contacto_emergencia:  est.contacto_emergencia  || '',
    })
    setModalEditar(est)
  }

  const handleEditar = async (e) => {
    e.preventDefault()
    setGuardandoEdicion(true)
    try {
      await api.put(`/estudiantes/${modalEditar.id}`, formEditar)
      toast.success('Estudiante actualizado')
      setModalEditar(null)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const handleDesactivar = async () => {
    if (!motivoDesactivacion) return toast.error('Selecciona un motivo de desactivación')
    setDesactivando(true)
    try {
      await api.patch(`/estudiantes/${modalDesactivar.id}/desactivar`, { motivo: motivoDesactivacion })
      toast.success('Estudiante desactivado')
      setModalDesactivar(null)
      setMotivoDesactivacion('')
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al desactivar')
    } finally {
      setDesactivando(false)
    }
  }

  const handleReactivar = async () => {
    const { nivel, grado, seccion } = formReactivar
    if (!nivel || !grado || !seccion) return toast.error('Selecciona nivel, grado y sección')
    setReactivando(true)
    try {
      await api.patch(`/estudiantes/${modalReactivar.id}/reactivar`, { nivel, grado, seccion })
      toast.success('Estudiante reactivado correctamente')
      setModalReactivar(null)
      setFormReactivar({ nivel: '', grado: '', seccion: '' })
      setModalDNIInactivo(null)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al reactivar')
    } finally {
      setReactivando(false)
    }
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className="space-y-4">

      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-marino">Gestión de Estudiantes</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setMostrarInactivos(v => !v); setPagina(1) }}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl font-medium border transition-colors ${
              mostrarInactivos
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'btn-secondary'
            }`}
          >
            {mostrarInactivos ? <UserCheck size={14} /> : <UserX size={14} />}
            {mostrarInactivos ? 'Ver activos' : 'Ver inactivos'}
          </button>
          <button
            onClick={() => setModalImprimir({ estudianteInicial: null, filtroInicial: null })}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Printer size={14} /> Imprimir Carnets
          </button>
          <button
            onClick={descargarPlantilla}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <FileDown size={14} /> Plantilla
          </button>
          <label className={`btn-secondary flex items-center gap-2 text-sm cursor-pointer ${importando ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={14} />
            {importando ? 'Subiendo...' : 'Subir Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportar} />
          </label>
          {!mostrarInactivos && (
            <button onClick={() => setModalNuevo(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-8"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
          placeholder="Buscar por nombre, DNI..."
        />
      </div>

      {/* Filtros de sección */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input text-sm py-1.5"
          style={{ width: 'auto' }}
          value={filtroNivel}
          onChange={(e) => { setFiltroNivel(e.target.value); setFiltroGrado(''); setFiltroSeccion(''); setPagina(1) }}
        >
          <option value="">Todos los niveles</option>
          <option value="inicial">Inicial</option>
          <option value="primaria">Primaria</option>
          <option value="secundaria">Secundaria</option>
        </select>

        <select
          className="input text-sm py-1.5"
          style={{ width: 'auto' }}
          value={filtroGrado}
          disabled={!filtroNivel}
          onChange={(e) => { setFiltroGrado(e.target.value); setFiltroSeccion(''); setPagina(1) }}
        >
          <option value="">Todos los grados</option>
          {(GRADOS_POR_NIVEL[filtroNivel] || []).map(g => (
            <option key={g} value={g}>{g}°</option>
          ))}
        </select>

        <select
          className="input text-sm py-1.5"
          style={{ width: 'auto' }}
          value={filtroSeccion}
          disabled={!filtroGrado}
          onChange={(e) => { setFiltroSeccion(e.target.value); setPagina(1) }}
        >
          <option value="">Todas las secciones</option>
          {SECCIONES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {hayFiltros && (
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
          >
            <X size={12} /> Limpiar
          </button>
        )}

        {filtroCompleto && !mostrarInactivos && (
          <button
            onClick={() => setModalImprimir({
              estudianteInicial: null,
              filtroInicial: { nivel: filtroNivel, grado: filtroGrado, seccion: filtroSeccion },
            })}
            className="btn-primary text-sm flex items-center gap-2 ml-auto"
          >
            <Printer size={13} />
            Imprimir carnets — {filtroGrado}° {filtroSeccion}
          </button>
        )}
      </div>

      {/* Banner modo inactivos */}
      {mostrarInactivos && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertTriangle size={15} />
          Mostrando estudiantes inactivos. Para reactivar a un alumno, usa el botón de la fila.
        </div>
      )}

      {/* Tabla */}
      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Alumno</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">DNI</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Grado / Sección</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Nivel</th>
              {mostrarInactivos && (
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Motivo</th>
              )}
              <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={mostrarInactivos ? 6 : 5} className="text-center text-gray-400 py-8">Cargando...</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={mostrarInactivos ? 6 : 5} className="text-center text-gray-400 py-8">
                {mostrarInactivos ? 'No hay estudiantes inactivos' : 'Sin resultados'}
              </td></tr>
            ) : lista.map((est) => {
              const badge = NIVEL_BADGE[est.nivel]

              if (mostrarInactivos) {
                return (
                  <tr key={est.id} className="border-b border-gray-50 bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-400 font-medium">
                      {est.nombre} {est.apellido}
                      <span className="ml-2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Inactivo</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{est.dni}</td>
                    <td className="px-4 py-3 text-gray-400">{est.grado}° {est.seccion}</td>
                    <td className="px-4 py-3">
                      {badge
                        ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full opacity-50 ${badge.cls}`}>{badge.label}</span>
                        : <span className="text-gray-400 text-xs">{est.nivel}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {est.motivo_desactivacion ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          est.motivo_desactivacion === 'disciplinario'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {MOTIVO_LABEL[est.motivo_desactivacion] || est.motivo_desactivacion}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setModalReactivar(est)
                          setFormReactivar({ nivel: est.nivel, grado: est.grado, seccion: est.seccion })
                        }}
                        title="Reactivar estudiante"
                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        <UserCheck size={13} /> Reactivar
                      </button>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={est.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{est.nombre} {est.apellido}</td>
                  <td className="px-4 py-3 text-gray-500">{est.dni}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{est.grado}° {est.seccion}</td>
                  <td className="px-4 py-3">
                    {badge
                      ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                      : <span className="text-gray-400 text-xs">{est.nivel}</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModalImprimir({ estudianteInicial: est, filtroInicial: null })}
                        title="Imprimir carnet"
                        className="p-1.5 rounded-lg text-marino hover:bg-blue-50 transition-colors"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => abrirEditar(est)}
                        title="Editar"
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setModalDesactivar(est); setMotivoDesactivacion('') }}
                        title="Desactivar estudiante"
                        className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} className="btn-secondary text-xs py-1 px-3">Anterior</button>
            <span className="text-xs text-gray-500">{pagina} / {totalPaginas} — {total} estudiantes</span>
            <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="btn-secondary text-xs py-1 px-3">Siguiente</button>
          </div>
        )}
      </div>

      {/* Modal nuevo estudiante */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col" style={{ maxHeight: '92vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
              <h3 className="font-bold text-marino">Nuevo Estudiante</h3>
              <button type="button" onClick={cerrarModal}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Tab nav */}
            <div className="flex border-b border-gray-100 px-2 flex-shrink-0">
              {TABS_NUEVO.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTabNuevo(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    tabNuevo === id ? 'border-marino text-marino' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCrear} noValidate className="flex-1 overflow-y-auto flex flex-col min-h-0">

              {/* ── Tab: Personal ── */}
              {tabNuevo === 'personal' && (
                <div className="px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { name: 'nombre',   label: 'Nombre',   placeholder: 'Juan' },
                      { name: 'apellido', label: 'Apellido', placeholder: 'Perez Lopez' },
                    ].map(({ name, label, placeholder }) => (
                      <div key={name}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <input
                          className="input"
                          value={formNuevo[name]}
                          onChange={(e) => setFormNuevo({ ...formNuevo, [name]: e.target.value })}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                      <input
                        className="input"
                        value={formNuevo.dni}
                        onChange={(e) => setFormNuevo({ ...formNuevo, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                        placeholder="12345678"
                        maxLength={8}
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sexo</label>
                      <div className="flex gap-1.5">
                        {[{ v: 'M', l: '♂ M' }, { v: 'F', l: '♀ F' }].map(({ v, l }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFormNuevo({ ...formNuevo, sexo: formNuevo.sexo === v ? '' : v })}
                            className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                              formNuevo.sexo === v ? 'border-marino bg-marino text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Académico ── */}
              {tabNuevo === 'academico' && (
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                    <select
                      className="input"
                      value={formNuevo.nivel}
                      onChange={(e) => setFormNuevo({ ...formNuevo, nivel: e.target.value, grado: '' })}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="inicial">Inicial</option>
                      <option value="primaria">Primaria</option>
                      <option value="secundaria">Secundaria</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Grado</label>
                      <select
                        className="input"
                        value={formNuevo.grado}
                        onChange={(e) => setFormNuevo({ ...formNuevo, grado: e.target.value })}
                      >
                        <option value="">— elige nivel primero —</option>
                        {(GRADOS_POR_NIVEL[formNuevo.nivel] || []).map(g => (
                          <option key={g} value={g}>{g}°</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
                      <select
                        className="input"
                        value={formNuevo.seccion}
                        onChange={(e) => setFormNuevo({ ...formNuevo, seccion: e.target.value })}
                      >
                        <option value="">Seleccionar...</option>
                        {SECCIONES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Salud ── */}
              {tabNuevo === 'salud' && (
                <div className="px-6 py-4 space-y-4">
                  <p className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-xl">
                    Todos los campos son opcionales. Visible para admin, tutores y auxiliares.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de atención médica</label>
                    <select className="input" value={formNuevo.atencion_medica} onChange={e => setFormNuevo({ ...formNuevo, atencion_medica: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      <option value="ESSALUD">ESSALUD</option>
                      <option value="MINSA">MINSA</option>
                      <option value="SIS">SIS</option>
                      <option value="NINGUNO">Ninguno</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={!!formNuevo.tiene_alergias} onChange={e => setFormNuevo({ ...formNuevo, tiene_alergias: e.target.checked, alergias_detalle: e.target.checked ? formNuevo.alergias_detalle : '' })} className="w-4 h-4 accent-marino" />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tiene alergias</span>
                    </label>
                    {formNuevo.tiene_alergias && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">¿Cuál? <span className="text-red-500">*</span></label>
                        <input className="input" value={formNuevo.alergias_detalle} onChange={e => setFormNuevo({ ...formNuevo, alergias_detalle: e.target.value })} placeholder="Ej: mariscos, penicilina, polvo..." />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Condición de salud mental / NEE <span className="text-gray-400">(opcional)</span></label>
                    <textarea className="input resize-none" rows={2} value={formNuevo.condicion_mental_nee} onChange={e => setFormNuevo({ ...formNuevo, condicion_mental_nee: e.target.value })} placeholder="Ej: TDAH, TEA, dislexia, ansiedad..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contacto de emergencia <span className="text-gray-400">(opcional)</span></label>
                    <input className="input" value={formNuevo.contacto_emergencia} onChange={e => setFormNuevo({ ...formNuevo, contacto_emergencia: e.target.value })} placeholder="Ej: Mamá — 987 654 321" />
                  </div>
                </div>
              )}

              {/* ── Tab: Apoderado ── */}
              {tabNuevo === 'apoderado' && (
                <div className="px-6 py-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conApoderado}
                      onChange={(e) => { setConApoderado(e.target.checked); if (!e.target.checked) limpiarApoderado() }}
                      className="w-4 h-4 accent-marino"
                    />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Vincular apoderado</span>
                  </label>

                  {conApoderado && (
                    <div className="p-3 bg-blue-50 rounded-xl space-y-3">
                      {!apoderadoSeleccionado && !mostrarFormNuevo && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar apoderado por nombre o DNI</label>
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input className="input pl-8" value={busqApo} onChange={(e) => buscarApoderados(e.target.value)} placeholder="Ej: María López o 45678901..." autoComplete="off" />
                          </div>
                          {buscandoApo && <p className="text-xs text-gray-400 mt-1.5 px-1">Buscando...</p>}
                          {!buscandoApo && resultadosApo.length > 0 && (
                            <div className="mt-1.5 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                              {resultadosApo.map(apo => (
                                <button key={apo.id} type="button" onClick={() => seleccionarApoderado(apo)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 text-left">
                                  <div className="w-7 h-7 rounded-full bg-marino/10 text-marino flex items-center justify-center font-bold text-[11px] flex-shrink-0">{apo.nombre?.[0]}{apo.apellido?.[0]}</div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-sm font-medium text-gray-800 truncate">{apo.nombre} {apo.apellido}</p>
                                      {apo.rol !== 'apoderado' && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                                          {ROL_LABEL_PERSONAL[apo.rol] || apo.rol} · también apoderado
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-400">DNI {apo.dni}{apo.telefono ? ` · ${apo.telefono}` : ''}</p>
                                  </div>
                                </button>
                              ))}
                              <button type="button" onClick={() => { setMostrarFormNuevo(true); if (/^\d{8}$/.test(busqApo.trim())) setFormNuevoApo(f => ({ ...f, dni: busqApo.trim() })) }} className="w-full px-3 py-2.5 text-sm text-marino font-medium hover:bg-blue-50 transition-colors flex items-center gap-2 border-t border-gray-100">
                                <Plus size={14} /> Registrar como nuevo apoderado
                              </button>
                            </div>
                          )}
                          {!buscandoApo && busqApo.length >= 2 && resultadosApo.length === 0 && (
                            <div className="mt-1.5 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                              <p className="px-3 py-2 text-xs text-gray-400 text-center">Sin resultados para "{busqApo}"</p>
                              <button type="button" onClick={() => { setMostrarFormNuevo(true); if (/^\d{8}$/.test(busqApo.trim())) setFormNuevoApo(f => ({ ...f, dni: busqApo.trim() })) }} className="w-full px-3 py-2.5 text-sm text-marino font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 border-t border-gray-100">
                                <Plus size={14} /> Registrar como nuevo apoderado
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {apoderadoSeleccionado && !mostrarFormNuevo && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Apoderado seleccionado</label>
                          <div className="flex items-center justify-between bg-white border-2 border-marino/30 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-marino/10 text-marino flex items-center justify-center font-bold text-xs flex-shrink-0">{apoderadoSeleccionado.nombre?.[0]}{apoderadoSeleccionado.apellido?.[0]}</div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-gray-800 text-sm truncate">{apoderadoSeleccionado.nombre} {apoderadoSeleccionado.apellido}</p>
                                  {apoderadoSeleccionado.rol !== 'apoderado' && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                                      {ROL_LABEL_PERSONAL[apoderadoSeleccionado.rol] || apoderadoSeleccionado.rol}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 truncate">DNI {apoderadoSeleccionado.dni}{apoderadoSeleccionado.telefono && ` · ${apoderadoSeleccionado.telefono}`}</p>
                              </div>
                            </div>
                            <button type="button" onClick={limpiarApoderado} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 flex-shrink-0 ml-2 transition-colors">
                              <X size={12} /> cambiar
                            </button>
                          </div>
                        </div>
                      )}
                      {mostrarFormNuevo && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nuevo apoderado</p>
                            <button type="button" onClick={() => { setMostrarFormNuevo(false); setFormNuevoApo({ dni: '', nombre: '', apellido: '', email: '', password: '', telefono: '' }) }} className="text-xs text-marino hover:underline">← Volver a buscar</button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input className="input" value={formNuevoApo.nombre} onChange={e => setFormNuevoApo(f => ({...f, nombre: e.target.value}))} placeholder="María" /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input className="input" value={formNuevoApo.apellido} onChange={e => setFormNuevoApo(f => ({...f, apellido: e.target.value}))} placeholder="García" /></div>
                          </div>
                          <div><label className="block text-xs font-medium text-gray-600 mb-1">DNI</label><input className="input" value={formNuevoApo.dni} onChange={e => setFormNuevoApo(f => ({...f, dni: e.target.value.replace(/\D/g, '').slice(0, 8)}))} placeholder="45678901" maxLength={8} inputMode="numeric" /></div>
                          <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" className="input" value={formNuevoApo.email} onChange={e => setFormNuevoApo(f => ({...f, email: e.target.value}))} placeholder="correo@gmail.com" /></div>
                          <div><label className="block text-xs font-medium text-gray-600 mb-1">Contraseña inicial</label><input type="password" className="input" value={formNuevoApo.password} onChange={e => setFormNuevoApo(f => ({...f, password: e.target.value}))} placeholder="Mínimo 6 caracteres" /></div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp <span className="text-gray-400">(opcional)</span></label>
                            <input className="input" value={formNuevoApo.telefono} onChange={e => setFormNuevoApo(f => ({...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 9)}))} placeholder="987654321" inputMode="numeric" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Nav buttons ── */}
              <div className="flex gap-2 px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
                {tabNuevo === 'personal' ? (
                  <button type="button" onClick={cerrarModal} disabled={creando} className="btn-secondary flex-1">Cancelar</button>
                ) : (
                  <button type="button" onClick={() => setTabNuevo(ORDEN_TABS_NUEVO[ORDEN_TABS_NUEVO.indexOf(tabNuevo) - 1])} disabled={creando} className="btn-secondary flex-1">← Anterior</button>
                )}
                {tabNuevo === 'apoderado' ? (
                  <button type="submit" disabled={creando} className="btn-primary flex-1">{creando ? 'Guardando...' : 'Crear estudiante'}</button>
                ) : (
                  <button type="button" onClick={() => setTabNuevo(ORDEN_TABS_NUEVO[ORDEN_TABS_NUEVO.indexOf(tabNuevo) + 1])} className="btn-primary flex-1">Siguiente →</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar estudiante */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col" style={{ maxHeight: '92vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
              <h3 className="font-bold text-marino">Editar Estudiante</h3>
              <button type="button" onClick={() => setModalEditar(null)}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Tab nav */}
            <div className="flex border-b border-gray-100 px-2 flex-shrink-0">
              {TABS_EDITAR.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setTabEditar(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    tabEditar === id ? 'border-marino text-marino' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleEditar} noValidate className="flex-1 overflow-y-auto flex flex-col min-h-0">

              {/* ── Tab: Personal ── */}
              {tabEditar === 'personal' && (
                <div className="px-6 py-4 space-y-4">

                  {/* Foto */}
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-200">
                      {formEditar.foto_url ? (
                        <img src={formEditar.foto_url} alt="Foto" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                          {formEditar.nombre?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-600 mb-1.5">Foto del estudiante</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          fotoSubiendo ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400' : 'border-marino text-marino hover:bg-marino hover:text-white'
                        }`}>
                          <Camera size={12} />
                          {formEditar.foto_url ? 'Cambiar foto' : 'Subir foto'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleSubirFoto}
                            disabled={fotoSubiendo}
                          />
                        </label>
                        {formEditar.foto_url && !fotoSubiendo && (
                          <button
                            type="button"
                            onClick={handleEliminarFoto}
                            className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={11} /> Eliminar
                          </button>
                        )}
                      </div>
                      {fotoSubiendo && (
                        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
                          <span className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full" />
                          Procesando foto...
                        </p>
                      )}
                      {!formEditar.foto_url && !fotoSubiendo && (
                        <p className="text-xs text-gray-400 mt-1">jpg, png o webp · máx. 5 MB</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name: 'nombre',   label: 'Nombre',   placeholder: 'Juan' },
                      { name: 'apellido', label: 'Apellido', placeholder: 'Perez Lopez' },
                    ].map(({ name, label, placeholder }) => (
                      <div key={name}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <input className="input" value={formEditar[name] || ''} onChange={(e) => setFormEditar({ ...formEditar, [name]: e.target.value })} placeholder={placeholder} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                      <input className="input" value={formEditar.dni || ''} onChange={(e) => setFormEditar({ ...formEditar, dni: e.target.value })} placeholder="12345678" maxLength={8} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sexo</label>
                      <div className="flex gap-1.5">
                        {[{ v: 'M', l: '♂ M' }, { v: 'F', l: '♀ F' }].map(({ v, l }) => (
                          <button key={v} type="button" onClick={() => setFormEditar({ ...formEditar, sexo: formEditar.sexo === v ? '' : v })}
                            className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${formEditar.sexo === v ? 'border-marino bg-marino text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                          >{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Académico ── */}
              {tabEditar === 'academico' && (
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                    <select className="input" value={formEditar.nivel || ''} onChange={(e) => setFormEditar({ ...formEditar, nivel: e.target.value, grado: '' })}>
                      <option value="">Seleccionar...</option>
                      <option value="inicial">Inicial</option>
                      <option value="primaria">Primaria</option>
                      <option value="secundaria">Secundaria</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Grado</label>
                      <select className="input" value={formEditar.grado || ''} onChange={(e) => setFormEditar({ ...formEditar, grado: e.target.value })}>
                        <option value="">Seleccionar...</option>
                        {(GRADOS_POR_NIVEL[formEditar.nivel] || []).map(g => <option key={g} value={g}>{g}°</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
                      <select className="input" value={formEditar.seccion || ''} onChange={(e) => setFormEditar({ ...formEditar, seccion: e.target.value })}>
                        <option value="">Seleccionar...</option>
                        {SECCIONES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Salud ── */}
              {tabEditar === 'salud' && (
                <div className="px-6 py-4 space-y-4">
                  <p className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-xl">Todos los campos son opcionales. Visible para admin, tutores y auxiliares.</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de atención médica</label>
                    <select className="input" value={formEditar.atencion_medica || ''} onChange={e => setFormEditar({ ...formEditar, atencion_medica: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      <option value="ESSALUD">ESSALUD</option>
                      <option value="MINSA">MINSA</option>
                      <option value="SIS">SIS</option>
                      <option value="NINGUNO">Ninguno</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={!!formEditar.tiene_alergias} onChange={e => setFormEditar({ ...formEditar, tiene_alergias: e.target.checked, alergias_detalle: e.target.checked ? formEditar.alergias_detalle : '' })} className="w-4 h-4 accent-marino" />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tiene alergias</span>
                    </label>
                    {formEditar.tiene_alergias && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">¿Cuál? <span className="text-red-500">*</span></label>
                        <input className="input" value={formEditar.alergias_detalle || ''} onChange={e => setFormEditar({ ...formEditar, alergias_detalle: e.target.value })} placeholder="Ej: mariscos, penicilina, polvo..." />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Condición de salud mental / NEE <span className="text-gray-400">(opcional)</span></label>
                    <textarea className="input resize-none" rows={2} value={formEditar.condicion_mental_nee || ''} onChange={e => setFormEditar({ ...formEditar, condicion_mental_nee: e.target.value })} placeholder="Ej: TDAH, TEA, dislexia, ansiedad..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contacto de emergencia <span className="text-gray-400">(opcional)</span></label>
                    <input className="input" value={formEditar.contacto_emergencia || ''} onChange={e => setFormEditar({ ...formEditar, contacto_emergencia: e.target.value })} placeholder="Ej: Mamá — 987 654 321" />
                  </div>
                </div>
              )}

              {/* ── Nav buttons ── */}
              <div className="flex gap-2 px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
                {tabEditar === 'personal' ? (
                  <button type="button" onClick={() => setModalEditar(null)} className="btn-secondary flex-1">Cancelar</button>
                ) : (
                  <button type="button" onClick={() => setTabEditar(ORDEN_TABS_EDITAR[ORDEN_TABS_EDITAR.indexOf(tabEditar) - 1])} className="btn-secondary flex-1">← Anterior</button>
                )}
                {tabEditar === 'salud' ? (
                  <button type="submit" disabled={guardandoEdicion} className="btn-primary flex-1">{guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}</button>
                ) : (
                  <button type="button" onClick={() => setTabEditar(ORDEN_TABS_EDITAR[ORDEN_TABS_EDITAR.indexOf(tabEditar) + 1])} className="btn-primary flex-1">Siguiente →</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal imprimir carnets */}
      {modalImprimir && (
        <ModalImprimirCarnets
          estudianteInicial={modalImprimir.estudianteInicial}
          filtroInicial={modalImprimir.filtroInicial}
          onClose={() => setModalImprimir(null)}
        />
      )}

      {/* Modal desactivar estudiante */}
      {modalDesactivar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                <UserX size={24} className="text-amber-500" />
              </div>
            </div>
            <h3 className="font-bold text-gray-800 text-center mb-1">Desactivar estudiante</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              <span className="font-semibold text-gray-700">{modalDesactivar.nombre} {modalDesactivar.apellido}</span>
              {' '}quedará inactivo y no podrá registrar asistencia.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motivo de desactivación</label>
              <select
                className="input"
                value={motivoDesactivacion}
                onChange={e => setMotivoDesactivacion(e.target.value)}
              >
                <option value="">— Selecciona un motivo —</option>
                <option value="retiro_voluntario">Retiro voluntario</option>
                <option value="traslado">Traslado a otra institución</option>
                <option value="egreso">Egreso (terminó el nivel)</option>
                <option value="disciplinario">Motivo disciplinario</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            {motivoDesactivacion === 'disciplinario' && (
              <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 rounded-xl text-xs text-red-600">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                El motivo disciplinario quedará registrado. Si el estudiante es reactivado en el futuro, se mostrará una advertencia al administrador.
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setModalDesactivar(null); setMotivoDesactivacion('') }}
                disabled={desactivando}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleDesactivar}
                disabled={desactivando || !motivoDesactivacion}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {desactivando ? 'Desactivando...' : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reactivar estudiante */}
      {modalReactivar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-marino">Reactivar estudiante</h3>
              <button onClick={() => { setModalReactivar(null); setFormReactivar({ nivel: '', grado: '', seccion: '' }) }}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Asigna el aula para{' '}
              <span className="font-semibold text-gray-800">{modalReactivar.nombre} {modalReactivar.apellido}</span>.
            </p>

            {modalReactivar.motivo_desactivacion === 'disciplinario' && (
              <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Antecedente disciplinario</p>
                  <p>Este estudiante fue desactivado por motivo disciplinario. Asegúrate de que su reingreso ha sido autorizado.</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                <select
                  className="input"
                  value={formReactivar.nivel}
                  onChange={e => setFormReactivar(f => ({ ...f, nivel: e.target.value, grado: '' }))}
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
                  value={formReactivar.grado}
                  onChange={e => setFormReactivar(f => ({ ...f, grado: e.target.value }))}
                  disabled={!formReactivar.nivel}
                >
                  <option value="">— elige nivel primero —</option>
                  {(GRADOS_POR_NIVEL[formReactivar.nivel] || []).map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
                <select
                  className="input"
                  value={formReactivar.seccion}
                  onChange={e => setFormReactivar(f => ({ ...f, seccion: e.target.value }))}
                  disabled={!formReactivar.grado}
                >
                  <option value="">Seleccionar...</option>
                  {SECCIONES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => { setModalReactivar(null); setFormReactivar({ nivel: '', grado: '', seccion: '' }) }}
                disabled={reactivando}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleReactivar}
                disabled={reactivando || !formReactivar.nivel || !formReactivar.grado || !formReactivar.seccion}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {reactivando ? 'Reactivando...' : 'Reactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal resultados importación Excel */}
      {modalResultados && (() => {
        const { importados, omitidos, errores } = modalResultados
        const exito = importados > 0 && errores.length === 0
        const parcial = importados > 0 && errores.length > 0
        const fallido = importados === 0
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[85vh] flex flex-col">
              {/* Encabezado */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {exito && <CheckCircle size={22} className="text-emerald-500 flex-shrink-0" />}
                  {parcial && <AlertTriangle size={22} className="text-amber-500 flex-shrink-0" />}
                  {fallido && <XCircle size={22} className="text-red-500 flex-shrink-0" />}
                  <h3 className="font-bold text-gray-800">
                    {exito && 'Importación completada'}
                    {parcial && 'Importación con advertencias'}
                    {fallido && 'Importación fallida'}
                  </h3>
                </div>
                <button onClick={() => setModalResultados(null)}>
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {/* Resumen de contadores */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{importados}</p>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">Importados</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{omitidos}</p>
                  <p className="text-xs text-amber-700 font-medium mt-0.5">Omitidos</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-600">{importados + omitidos}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Total filas</p>
                </div>
              </div>

              {/* Lista de errores */}
              {errores.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Filas con errores ({errores.length})
                  </p>
                  <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                    {errores.map((e, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm">
                        <span className="flex-shrink-0 text-xs font-bold text-red-400 bg-red-100 px-1.5 py-0.5 rounded-md">
                          F{e.fila}
                        </span>
                        <div className="min-w-0">
                          {e.dni && (
                            <span className="text-xs text-gray-500 font-mono mr-2">{e.dni}</span>
                          )}
                          <span className="text-red-700">{e.motivo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exito && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  Todos los estudiantes fueron importados correctamente.
                </p>
              )}

              <button
                onClick={() => setModalResultados(null)}
                className="btn-primary mt-4 w-full"
              >
                Cerrar
              </button>
            </div>
          </div>
        )
      })()}

      {/* Modal DNI inactivo — al intentar crear con DNI ya registrado */}
      {modalDNIInactivo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
            </div>
            <h3 className="font-bold text-gray-800 text-center mb-1">Estudiante inactivo encontrado</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              El DNI <span className="font-semibold text-gray-700">{modalDNIInactivo.dni}</span> ya está registrado como estudiante inactivo.
            </p>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-semibold text-gray-700">{modalDNIInactivo.nombre} {modalDNIInactivo.apellido}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {modalDNIInactivo.nivel} · {modalDNIInactivo.grado}° {modalDNIInactivo.seccion}
                {modalDNIInactivo.motivo_desactivacion && (
                  <> · <span className={modalDNIInactivo.motivo_desactivacion === 'disciplinario' ? 'text-red-500 font-medium' : ''}>
                    {MOTIVO_LABEL[modalDNIInactivo.motivo_desactivacion] || modalDNIInactivo.motivo_desactivacion}
                  </span></>
                )}
              </p>
            </div>

            {modalDNIInactivo.motivo_desactivacion === 'disciplinario' && (
              <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Antecedente disciplinario</p>
                  <p>Este estudiante fue desactivado por motivo disciplinario. Verifica que su reingreso ha sido debidamente autorizado.</p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mb-4">
              ¿Deseas reactivarlo y asignarlo a un nuevo aula?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setModalDNIInactivo(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setModalReactivar(modalDNIInactivo)
                  setFormReactivar({ nivel: modalDNIInactivo.nivel, grado: modalDNIInactivo.grado, seccion: modalDNIInactivo.seccion })
                  setModalDNIInactivo(null)
                }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-xl text-sm transition-colors"
              >
                Reactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
